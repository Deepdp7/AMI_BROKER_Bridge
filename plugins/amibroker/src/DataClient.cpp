#define WIN32_LEAN_AND_MEAN
#include <winsock2.h>
#include <ws2tcpip.h>
#include <windows.h>
#include <winhttp.h>
#include <string>
#include <vector>
#include <charconv>
#pragma comment(lib, "winhttp.lib")
#pragma comment(lib, "ws2_32.lib")
#pragma comment(lib, "advapi32.lib")
#pragma comment(lib, "shell32.lib")
#include <shellapi.h>

#include "DataClient.h"
#include "Plugin.h"
#include <thread>
#include <mutex>
#include <map>
#include <deque>
#include <chrono>
#include <cmath>
#include <condition_variable>
#include <set>

static std::thread   g_pollerThread;
static std::mutex    g_pollerMutex;
static bool          g_bShutdown = false;
static std::map<std::string, Bar>    g_lastKnownBars;
// The final state of the minute before g_lastKnownBars' one: AmiBroker may not have read it yet
// when the next minute started (it reads about once a second, less often during scans)
static std::map<std::string, Bar>    g_prevMinuteBars;
static HWND          g_hAmiBrokerWnd = NULL;
// The engine connection, for the right-click menu's commands (guarded by g_sendMutex)
static SOCKET        g_ipcSocket = INVALID_SOCKET;
static std::mutex    g_sendMutex;
// What the engine says the status-bar light shows (guarded by g_pollerMutex); -1 = nothing yet
static int           g_statusLevel = -1;
static std::string   g_statusShort, g_statusLong;

// History catch-up state (guarded by g_pollerMutex).
// g_connGeneration is bumped on every successful IPC connect; a ticker whose synced
// generation differs must re-fetch the bars it missed from the bridge's HTTP API.
static bool          g_ipcConnected = false;
static unsigned      g_connGeneration = 0;
static std::map<std::string, unsigned>  g_syncedGeneration;
static std::map<std::string, ULONGLONG> g_lastGapCheck;
// Bumped by every SYNC|ticker, so an announcement arriving during a fetch is not lost
static std::map<std::string, unsigned>  g_syncEpoch;
// Oldest bar time announced (SYNC|ticker|fromSec) since the ticker last synced
static std::map<std::string, double>    g_syncFrom;

static void LogDebug(const char* msg) {
    FILE* fp;
    if (fopen_s(&fp, "C:\\Users\\Public\\DataBridgePro_plugin.log", "a") == 0) {
        fprintf(fp, "%s\n", msg);
        fclose(fp);
    }
}

void UpdateActiveSymbol(const std::string& ticker) {}   // no-op (kept for ABI compat)

void SetAmiBrokerWindow(HWND hWnd) {
    g_hAmiBrokerWnd = hWnd;
    char buf[128];
    sprintf_s(buf, "[HWND] %p IsWindow=%d", hWnd, IsWindow(hWnd));
    LogDebug(buf);
}

bool GetCachedLiveBar(const std::string& ticker, Bar& outBar) {
    std::lock_guard<std::mutex> lk(g_pollerMutex);
    auto it = g_lastKnownBars.find(ticker);
    if (it != g_lastKnownBars.end()) { outBar = it->second; return true; }
    return false;
}

int LiveSymbolCount(double sinceSec) {
    std::lock_guard<std::mutex> lk(g_pollerMutex);
    int n = 0;
    for (auto& kv : g_lastKnownBars) if (kv.second.timestamp >= sinceSec) n++;
    return n;
}

bool GetCachedPrevBar(const std::string& ticker, Bar& outBar) {
    std::lock_guard<std::mutex> lk(g_pollerMutex);
    auto it = g_prevMinuteBars.find(ticker);
    if (it != g_prevMinuteBars.end()) { outBar = it->second; return true; }
    return false;
}

bool IsBridgeConnected() {
    std::lock_guard<std::mutex> lk(g_pollerMutex);
    return g_ipcConnected;
}

// History requests only go out while the engine is connected: an HTTP request to a closed
// port takes Windows ~2 s to refuse, so with DataBridge not running every chart and every
// symbol of a scan froze AmiBroker for 2 s. Right after AmiBroker starts, the connection may
// still be on its way: then it is waited for briefly, once.
static ULONGLONG g_initTick = 0;
bool WaitForBridge(DWORD maxMs) {
    if (IsBridgeConnected()) return true;
    if (GetTickCount64() - g_initTick > 10000) return false;
    for (DWORD waited = 0; waited < maxMs; waited += 50) {
        std::this_thread::sleep_for(std::chrono::milliseconds(50));
        if (IsBridgeConnected()) return true;
    }
    return false;
}

bool NeedsHistorySync(const std::string& ticker) {
    std::lock_guard<std::mutex> lk(g_pollerMutex);
    auto it = g_syncedGeneration.find(ticker);
    return it == g_syncedGeneration.end() || it->second != g_connGeneration;
}

double BeginHistorySync(const std::string& ticker, unsigned& epoch) {
    std::lock_guard<std::mutex> lk(g_pollerMutex);
    epoch = g_syncEpoch[ticker];
    auto it = g_syncFrom.find(ticker);
    return it == g_syncFrom.end() ? 0 : it->second;
}

void MarkHistorySynced(const std::string& ticker, unsigned epoch) {
    std::lock_guard<std::mutex> lk(g_pollerMutex);
    if (g_syncEpoch[ticker] != epoch) return;   // newer history announced meanwhile: sync again
    g_syncedGeneration[ticker] = g_connGeneration;
    g_syncFrom.erase(ticker);
}

bool TryBeginGapCheck(const std::string& ticker) {
    std::lock_guard<std::mutex> lk(g_pollerMutex);
    ULONGLONG now = GetTickCount64();
    ULONGLONG& last = g_lastGapCheck[ticker];
    if (last != 0 && now - last < 30000) return false;
    last = now;
    return true;
}

// ---- Telling AmiBroker about new bars ----
// Every tick used to be handed to AmiBroker with a SendMessage that waited for it. While a scan
// kept AmiBroker busy, the socket reader sat in that wait, ticks piled up in the socket, and
// when AmiBroker came free it got all of them one by one (each redrawing charts): it froze,
// caught up, froze again. Now the reader only records the newest bar per ticker; a separate
// thread announces each changed ticker at most every NOTIFY_EVERY_MS and never waits long.
static const DWORD NOTIFY_EVERY_MS = 150;
static const UINT  NOTIFY_WAIT_MS  = 1000;
static std::thread g_notifyThread;
static std::map<std::string, Bar> g_pendingNotify;         // guarded by g_pollerMutex
// One RecentInfo per ticker that stays where it is: if AmiBroker handles a notice after we
// stopped waiting for it, the pointer it was given is still valid.
static std::map<std::string, RecentInfo> g_riSlots;         // notifier thread only

static void QueueNotify(const std::string& ticker, const Bar& b) {
    std::lock_guard<std::mutex> lk(g_pollerMutex);
    g_pendingNotify[ticker] = b;
}

// ---- The Real-time Quote window ----
// QUOTE|TICKER|last|open|high|low|prev|vol|oi|bid|ask|tickSec from the engine: the day's figures.
// The quote window used to be filled from the current 1-minute bar (its open/high/low/volume
// shown as the day's) with every field marked valid, the previous close and change among them.
struct DayQuote { float last, open, high, low, prev, vol, oi, bid, ask; double tickSec; float bidQty, askQty; };
static std::map<std::string, DayQuote> g_quotes;            // guarded by g_pollerMutex

static void HandleQuoteMessage(const std::string& raw) {
    std::string line = raw;
    if (!line.empty() && line.back() == '\r') line.pop_back();
    std::vector<std::string> f;
    size_t from = 0;
    for (;;) {
        size_t bar = line.find('|', from);
        f.push_back(line.substr(from, bar == std::string::npos ? std::string::npos : bar - from));
        if (bar == std::string::npos) break;
        from = bar + 1;
    }
    if (f.size() < 13 || f[1].empty()) return;
    DayQuote q{};
    try {
        q.last = std::stof(f[2]); q.open = std::stof(f[3]); q.high = std::stof(f[4]); q.low = std::stof(f[5]);
        q.prev = std::stof(f[6]); q.vol = std::stof(f[7]); q.oi = std::stof(f[8]);
        q.bid = std::stof(f[9]); q.ask = std::stof(f[10]); q.tickSec = std::stod(f[11]);
        if (f.size() >= 14) { q.bidQty = std::stof(f[12]); q.askQty = std::stof(f[13]); }   // newer engines
    } catch (...) { return; }
    if (!(q.last > 0)) return;
    Bar live{}; bool hasLive = false;
    {
        std::lock_guard<std::mutex> lk(g_pollerMutex);
        g_quotes[f[1]] = q;
        auto it = g_lastKnownBars.find(f[1]);
        if (it != g_lastKnownBars.end()) { live = it->second; hasLive = true; }
    }
    // A price change without a new bar (after the close, a previous close found later): refresh
    if (hasLive && live.close > 0) QueueNotify(f[1], live);
}

bool FillRecentInfo(const std::string& ticker, RecentInfo& ri) {
    Bar b{}; bool hasBar = false;
    DayQuote q{}; bool hasQuote = false;
    {
        std::lock_guard<std::mutex> lk(g_pollerMutex);
        auto it = g_lastKnownBars.find(ticker);
        if (it != g_lastKnownBars.end() && it->second.close > 0) { b = it->second; hasBar = true; }
        auto qt = g_quotes.find(ticker);
        if (qt != g_quotes.end()) { q = qt->second; hasQuote = true; }
    }
    if (!hasBar && !hasQuote) return false;

    memset(&ri, 0, sizeof(ri));
    ri.nStructSize = sizeof(RecentInfo);
    strncpy_s(ri.Name, ticker.c_str(), sizeof(ri.Name) - 1);
    int bits = RI_LAST | RI_DATEUPDATE;
    ri.fLast = hasQuote ? q.last : b.close;
    if (hasQuote && q.open > 0 && q.high > 0 && q.low > 0) {
        ri.fOpen = q.open; ri.fHigh = q.high; ri.fLow = q.low;
        bits |= RI_OPEN | RI_HIGHLOW;
    }
    if (hasQuote && q.vol > 0) {
        ri.fTotalVol = q.vol;
        ri.iTotalVol = q.vol > 2147483647.0f ? 2147483647 : (int)q.vol;
        bits |= RI_TOTALVOL;
    }
    float oi = hasQuote && q.oi > 0 ? q.oi : (hasBar ? b.oi : 0);
    if (oi > 0) { ri.fOpenInt = oi; bits |= RI_OPENINT; }
    if (hasQuote && q.prev > 0) {
        ri.fPrev = q.prev;
        ri.fChange = ri.fLast - q.prev;
        bits |= RI_PREVCHANGE;
    }
    if (hasQuote && q.bid > 0) { ri.fBid = q.bid; ri.iBidSize = (int)q.bidQty; bits |= RI_BID; }
    if (hasQuote && q.ask > 0) { ri.fAsk = q.ask; ri.iAskSize = (int)q.askQty; bits |= RI_ASK; }
    ri.nBitmap = bits;

    double when = hasQuote && q.tickSec > 0 ? q.tickSec : b.timestamp;
    time_t t = (time_t)when; struct tm ti;
    if (t > 0 && localtime_s(&ti, &t) == 0) {
        ri.nDateUpdate = ((ti.tm_year + 1900) * 10000) + ((ti.tm_mon + 1) * 100) + ti.tm_mday;
        ri.nTimeUpdate = (ti.tm_hour * 10000) + (ti.tm_min * 100) + ti.tm_sec;
    }
    // BARSREADY: AmiBroker calls GetQuotesEx to update charts; INCOMPLETE: the bar is still forming
    ri.nStatus = RI_STATUS_UPDATE | RI_STATUS_TRADE | RI_STATUS_BARSREADY | RI_STATUS_INCOMPLETE;
    if (bits & (RI_BID | RI_ASK)) ri.nStatus |= RI_STATUS_BIDASK;
    return true;
}

// Push a RecentInfo update so AmiBroker refreshes the symbol (and calls GetQuotesEx).
// False when AmiBroker didn't take it within NOTIFY_WAIT_MS (busy): try again next round.
static bool NotifyAmiBroker(const std::string& ticker, const Bar& b) {
    HWND hWnd = g_hAmiBrokerWnd;
    if (!hWnd || !IsWindow(hWnd)) return true;
    RecentInfo& ri = g_riSlots[ticker];
    if (!FillRecentInfo(ticker, ri)) return true;

    DWORD_PTR res = 0;
    BOOL taken = SendMessageTimeoutA(hWnd, WM_USER_STREAMING_UPDATE, 0, (LPARAM)&ri,
                                     SMTO_NORMAL | SMTO_ABORTIFHUNG, NOTIFY_WAIT_MS, &res) != 0;

    static DWORD lastLog2 = 0; DWORD now2 = GetTickCount();
    if (now2 - lastLog2 > 5000) {
        lastLog2 = now2;
        char lb[256];
        sprintf_s(lb,"[TICK] %s %.2f ts=%d %s",ticker.c_str(),b.close,(int)b.timestamp,taken?"ok":"busy");
        LogDebug(lb);
    }
    return taken;
}

// One notice per round, however many symbols changed: on each notice AmiBroker refreshes its
// real-time windows and reads every symbol's newest quote itself (GetRecentInfo, GetQuotesEx),
// as the ADK's own sample plugin does. One notice per symbol meant a few hundred live futures
// made it redraw thousands of times a second.
static void NotifierThreadProc() {
    while (!g_bShutdown) {
        std::this_thread::sleep_for(std::chrono::milliseconds(NOTIFY_EVERY_MS));
        std::map<std::string, Bar> batch;
        { std::lock_guard<std::mutex> lk(g_pollerMutex); batch.swap(g_pendingNotify); }
        if (batch.empty() || g_bShutdown) continue;
        // The notice carries the newest quote (the rest are read by AmiBroker)
        auto newest = batch.begin();
        for (auto it = batch.begin(); it != batch.end(); ++it)
            if (it->second.timestamp > newest->second.timestamp) newest = it;
        if (NotifyAmiBroker(newest->first, newest->second)) continue;
        // AmiBroker is busy: try again next round (newer bars that came meanwhile win)
        std::lock_guard<std::mutex> lk(g_pollerMutex);
        for (auto& kv : batch) g_pendingNotify.emplace(kv.first, kv.second);
    }
}

// ---- Keeping AmiBroker from waiting on DataBridge ----
// Catch-up fetches (bars missed, run on AmiBroker's own thread): when one fails or times out
// the engine is busy or gone, and trying again for every symbol of a scan would freeze
// AmiBroker each time. They pause for a while instead; AmiBroker keeps what it has meanwhile.
static ULONGLONG g_catchUpPausedUntil = 0;        // guarded by g_pollerMutex
static const ULONGLONG CATCH_UP_PAUSE_MS = 15000;

bool CatchUpAllowed() {
    std::lock_guard<std::mutex> lk(g_pollerMutex);
    return GetTickCount64() >= g_catchUpPausedUntil;
}

void CatchUpFailed() {
    std::lock_guard<std::mutex> lk(g_pollerMutex);
    g_catchUpPausedUntil = GetTickCount64() + CATCH_UP_PAUSE_MS;
    LogDebug("[SYNC] DataBridge did not answer: catch-up paused for 15 s");
}

// A gap check that found nothing (a contract with minutes without trades): not again until
// AmiBroker's last bar moves on. History that arrives later comes with a SYNC notice anyway.
static std::map<std::string, double> g_gapCheckedEmpty;   // guarded by g_pollerMutex

bool GapCheckWorthIt(const std::string& ticker, double sinceMin) {
    std::lock_guard<std::mutex> lk(g_pollerMutex);
    auto it = g_gapCheckedEmpty.find(ticker);
    return it == g_gapCheckedEmpty.end() || it->second != sinceMin;
}

void GapCheckResult(const std::string& ticker, double sinceMin, bool foundBars) {
    std::lock_guard<std::mutex> lk(g_pollerMutex);
    if (foundBars) g_gapCheckedEmpty.erase(ticker);
    else g_gapCheckedEmpty[ticker] = sinceMin;
}

// Full loads (AmiBroker had no bars in memory for the symbol): the same symbol loaded again and
// again means AmiBroker keeps dropping it (in-memory cache too small for the bars per symbol),
// and each load is a full history download. Told to the engine (at most every 15 min), which
// says what to change in AmiBroker.
static std::deque<std::pair<ULONGLONG, std::string>> g_fullLoads;   // guarded by g_pollerMutex
static ULONGLONG g_lastReloadNote = 0;
static int g_numBars = 0;

void SetDatabaseBars(int numBars) {
    std::lock_guard<std::mutex> lk(g_pollerMutex);
    g_numBars = numBars;
}

static bool g_mixedEod = false;   // guarded by g_pollerMutex

void SetMixedEod(bool allowed) {
    std::lock_guard<std::mutex> lk(g_pollerMutex);
    g_mixedEod = allowed;
}

bool MixedEodAllowed() {
    std::lock_guard<std::mutex> lk(g_pollerMutex);
    return g_mixedEod;
}

int GetDatabaseBars() {
    std::lock_guard<std::mutex> lk(g_pollerMutex);
    return g_numBars;
}

void NoteFullLoad(const std::string& ticker) {
    const ULONGLONG WINDOW = 15 * 60 * 1000;
    std::string note;
    {
        std::lock_guard<std::mutex> lk(g_pollerMutex);
        ULONGLONG now = GetTickCount64();
        g_fullLoads.emplace_back(now, ticker);
        while (!g_fullLoads.empty() && now - g_fullLoads.front().first > WINDOW) g_fullLoads.pop_front();
        std::map<std::string, int> count;
        for (auto& e : g_fullLoads) count[e.second]++;
        int reloaded = 0;
        for (auto& c : count) if (c.second >= 3) reloaded++;
        if (reloaded == 0 || (g_lastReloadNote && now - g_lastReloadNote < WINDOW)) return;
        g_lastReloadNote = now;
        note = "NOTE|RELOADS|" + std::to_string(reloaded) + "|" + std::to_string(g_numBars);
    }
    LogDebug(("[GQE] AmiBroker keeps reloading full histories: " + note).c_str());
    SendToBridge(note);
}

// ---- Catch-up downloads, off AmiBroker's thread ----
// Bars AmiBroker missed (a SYNC notice, a jump in the live bar) used to be fetched inside
// GetQuotesEx, on AmiBroker's own thread. While the engine was busy (a 438-symbol refresh) every
// open symbol waited there, up to seconds each: AmiBroker's data access time reached 450 ms a
// refresh (load factor over 200%) and charts stuttered. Now GetQuotesEx only asks; this thread
// fetches, one request at a time, and the next GetQuotesEx call merges what arrived (AmiBroker
// is nudged to make that call soon).
struct CatchUpJob { std::string ticker; double from = 0; int limit = 0; CatchUpResult info; };
static std::deque<CatchUpJob> g_catchUpJobs;                 // guarded by g_pollerMutex
static std::set<std::string> g_catchUpPending;               // queued, fetching, or fetched and not merged yet
static std::map<std::string, CatchUpResult> g_catchUpDone;   // guarded by g_pollerMutex
static std::condition_variable g_catchUpCv;
static std::thread g_catchUpThread;

bool RequestCatchUp(const std::string& ticker, double from, int limit, const CatchUpResult& info) {
    {
        std::lock_guard<std::mutex> lk(g_pollerMutex);
        if (g_catchUpPending.count(ticker)) return false;
        g_catchUpPending.insert(ticker);
        CatchUpJob job;
        job.ticker = ticker; job.from = from; job.limit = limit; job.info = info;
        g_catchUpJobs.push_back(std::move(job));
    }
    g_catchUpCv.notify_one();
    return true;
}

bool TakeCatchUpResult(const std::string& ticker, CatchUpResult& out) {
    std::lock_guard<std::mutex> lk(g_pollerMutex);
    auto it = g_catchUpDone.find(ticker);
    if (it == g_catchUpDone.end()) return false;
    out = std::move(it->second);
    g_catchUpDone.erase(it);
    g_catchUpPending.erase(ticker);
    return true;
}

static void CatchUpThreadProc() {
    while (!g_bShutdown) {
        CatchUpJob job;
        {
            std::unique_lock<std::mutex> lk(g_pollerMutex);
            g_catchUpCv.wait_for(lk, std::chrono::seconds(1), [] { return g_bShutdown || !g_catchUpJobs.empty(); });
            if (g_bShutdown) break;
            if (g_catchUpJobs.empty()) continue;
            job = std::move(g_catchUpJobs.front());
            g_catchUpJobs.pop_front();
        }
        std::vector<Bar> bars;
        int got = FetchBarsFromAPI(job.ticker, job.limit, job.from, bars);
        if (got < 0) CatchUpFailed();
        Bar live{}; bool hasLive = false;
        {
            std::lock_guard<std::mutex> lk(g_pollerMutex);
            job.info.got = got;
            job.info.bars = std::move(bars);
            g_catchUpDone[job.ticker] = std::move(job.info);
            auto it = g_lastKnownBars.find(job.ticker);
            if (it != g_lastKnownBars.end()) { live = it->second; hasLive = true; }
        }
        // AmiBroker calls GetQuotesEx for it soon (open charts also on their own refresh)
        if (hasLive && live.close > 0) QueueNotify(job.ticker, live);
    }
}

// SYNC|TICKER          -> bridge stored new recent history for TICKER
// SYNC|TICKER|FROMSEC  -> bridge stored history for TICKER starting at FROMSEC (unix seconds),
//                         possibly older than AmiBroker's last bar (a downtime hole)
// SYNC_ALL             -> force every ticker to re-sync
static void HandleSyncMessage(const std::string& line) {
    if (line.rfind("SYNC_ALL", 0) == 0) {
        std::lock_guard<std::mutex> lk(g_pollerMutex);
        g_syncedGeneration.clear();
        LogDebug("[SYNC] all tickers marked for history re-sync");
        return;
    }
    std::string rest = line.substr(5);
    if (!rest.empty() && rest.back() == '\r') rest.pop_back();
    double fromSec = 0;
    size_t bar = rest.find('|');
    std::string ticker = rest.substr(0, bar);
    if (bar != std::string::npos) {
        try { fromSec = std::stod(rest.substr(bar + 1)); } catch (...) { fromSec = 0; }
    }
    if (ticker.empty()) return;

    Bar live{}; bool hasLive = false;
    {
        std::lock_guard<std::mutex> lk(g_pollerMutex);
        g_syncedGeneration.erase(ticker);
        ++g_syncEpoch[ticker];
        if (fromSec > 0) {
            auto it = g_syncFrom.find(ticker);
            if (it == g_syncFrom.end() || fromSec < it->second) g_syncFrom[ticker] = fromSec;
        }
        auto it = g_lastKnownBars.find(ticker);
        if (it != g_lastKnownBars.end()) { live = it->second; hasLive = true; }
    }
    // Nudge AmiBroker so an open chart pulls the new bars right away.
    if (hasLive && live.close > 0) QueueNotify(ticker, live);
}

// ---- The DataBridge light in AmiBroker's status bar, and its right-click menu ----
// STATUS|level|short|long from the engine: level 0 green, 1 yellow, 2 red (amibroker/pluginStatus.ts)
static void HandleStatusMessage(const std::string& raw) {
    std::string line = raw;
    if (!line.empty() && line.back() == '\r') line.pop_back();
    size_t a = line.find('|', 7), b = a == std::string::npos ? a : line.find('|', a + 1);
    if (a == std::string::npos || b == std::string::npos) return;
    int level = atoi(line.substr(7, a - 7).c_str());
    std::lock_guard<std::mutex> lk(g_pollerMutex);
    g_statusLevel = level < 0 ? 0 : level > 2 ? 2 : level;
    g_statusShort = line.substr(a + 1, b - a - 1);
    g_statusLong = line.substr(b + 1);
}

void GetBridgeStatus(int& level, std::string& shortMsg, std::string& longMsg) {
    std::lock_guard<std::mutex> lk(g_pollerMutex);
    if (!g_ipcConnected || g_statusLevel < 0) {
        level = g_ipcConnected ? 1 : -1;
        shortMsg = g_ipcConnected ? "Wait" : "Off";
        longMsg = g_ipcConnected ? "DataBridge Pro is starting..." : "DataBridge Pro is not running: start it to get data.";
        return;
    }
    level = g_statusLevel; shortMsg = g_statusShort; longMsg = g_statusLong;
}

bool SendToBridge(const std::string& line) {
    std::lock_guard<std::mutex> lk(g_sendMutex);
    if (g_ipcSocket == INVALID_SOCKET) return false;
    std::string msg = line + "\n";
    return send(g_ipcSocket, msg.c_str(), (int)msg.size(), 0) == (int)msg.size();
}

// ---- Which symbols AmiBroker shows ----
// The engine gives a broker's live places to these first when the broker streams fewer symbols
// than are tracked (Fyers Standard plan: 100). A chart asks for its symbol every few seconds;
// one notice per symbol every 15 s is enough to tell what is on screen.
static std::map<std::string, ULONGLONG> g_viewSentAt;   // guarded by g_pollerMutex
static const ULONGLONG VIEW_EVERY_MS = 15000;

void ReportViewed(const std::string& ticker) {
    {
        std::lock_guard<std::mutex> lk(g_pollerMutex);
        if (!g_ipcConnected) return;
        ULONGLONG now = GetTickCount64();
        ULONGLONG& last = g_viewSentAt[ticker];
        if (last != 0 && now - last < VIEW_EVERY_MS) return;
        last = now;
    }
    SendToBridge("VIEW|" + ticker);
}

// DataBridge Pro.exe from its uninstall entry (any view: AmiBroker is often 32-bit, the app 64-bit)
static std::string FindDataBridgeExe() {
    const HKEY roots[] = { HKEY_LOCAL_MACHINE, HKEY_CURRENT_USER };
    const REGSAM views[] = { KEY_WOW64_64KEY, KEY_WOW64_32KEY };
    for (HKEY root : roots) for (REGSAM view : views) {
        HKEY un;
        if (RegOpenKeyExA(root, "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall", 0, KEY_READ | view, &un) != ERROR_SUCCESS) continue;
        char name[256];
        for (DWORD i = 0; ; i++) {
            DWORD len = sizeof(name);
            if (RegEnumKeyExA(un, i, name, &len, NULL, NULL, NULL, NULL) != ERROR_SUCCESS) break;
            char display[256] = {0}, dir[MAX_PATH] = {0};
            DWORD dl = sizeof(display), dirl = sizeof(dir);
            if (RegGetValueA(un, name, "DisplayName", RRF_RT_REG_SZ, NULL, display, &dl) != ERROR_SUCCESS) continue;
            if (_stricmp(display, "DataBridge Pro") != 0) continue;
            if (RegGetValueA(un, name, "InstallLocation", RRF_RT_REG_SZ, NULL, dir, &dirl) != ERROR_SUCCESS) continue;
            std::string exe = std::string(dir);
            if (!exe.empty() && exe.back() != '\\') exe += '\\';
            exe += "DataBridge Pro.exe";
            if (GetFileAttributesA(exe.c_str()) != INVALID_FILE_ATTRIBUTES) { RegCloseKey(un); return exe; }
        }
        RegCloseKey(un);
    }
    char path[MAX_PATH];
    if (ExpandEnvironmentStringsA("%ProgramW6432%\\DataBridge Pro\\DataBridge Pro.exe", path, MAX_PATH) &&
        GetFileAttributesA(path) != INVALID_FILE_ATTRIBUTES) return path;
    return "";
}

// The app lets a second launch bring its window forward through 127.0.0.1:7892 (single_instance.rs):
// knocking on that port is enough. When it isn't running it is started.
void ShowDataBridge() {
    std::thread([] {
        SOCKET s = socket(AF_INET, SOCK_STREAM, IPPROTO_TCP);
        if (s == INVALID_SOCKET) return;
        sockaddr_in sa{}; sa.sin_family = AF_INET; sa.sin_port = htons(7892);
        inet_pton(AF_INET, "127.0.0.1", &sa.sin_addr);
        bool running = connect(s, (SOCKADDR*)&sa, sizeof(sa)) != SOCKET_ERROR;
        if (running) { char buf[32]; recv(s, buf, sizeof(buf), 0); }
        closesocket(s);
        if (!running) {
            std::string exe = FindDataBridgeExe();
            if (!exe.empty()) ShellExecuteA(NULL, "open", exe.c_str(), NULL, NULL, SW_SHOWNORMAL);
            else MessageBoxA(NULL, "DataBridge Pro was not found on this PC.", "DataBridge Pro", MB_OK | MB_ICONINFORMATION);
        }
    }).detach();
}

// Records a LIVE_BAR: the newest bar of the ticker, and the final state of the minute before it
// (caller holds g_pollerMutex)
static void KeepLiveBar(const std::string& ticker, const Bar& b) {
    double m = floor(b.timestamp / 60.0);
    auto it = g_lastKnownBars.find(ticker);
    if (it != g_lastKnownBars.end()) {
        double cur = floor(it->second.timestamp / 60.0);
        if (m < cur) {
            // An update of the minute before (it reached us after the new one): keep it there
            auto pv = g_prevMinuteBars.find(ticker);
            if (pv != g_prevMinuteBars.end() && floor(pv->second.timestamp / 60.0) == m) pv->second = b;
            return;
        }
        if (m > cur) g_prevMinuteBars[ticker] = it->second;
    }
    g_lastKnownBars[ticker] = b;
    g_pendingNotify[ticker] = b;
}

// Background thread: listens on TCP 7891 for LIVE_BAR messages
static void PollerThreadProc() {
    WSADATA wd;
    if (WSAStartup(MAKEWORD(2,2), &wd) != 0) return;

    while (!g_bShutdown) {
        SOCKET s = socket(AF_INET, SOCK_STREAM, IPPROTO_TCP);
        if (s == INVALID_SOCKET) { std::this_thread::sleep_for(std::chrono::seconds(1)); continue; }

        sockaddr_in sa{}; sa.sin_family = AF_INET; sa.sin_port = htons(7891);
        inet_pton(AF_INET, "127.0.0.1", &sa.sin_addr);

        if (connect(s, (SOCKADDR*)&sa, sizeof(sa)) == SOCKET_ERROR) {
            closesocket(s);
            std::this_thread::sleep_for(std::chrono::seconds(1));
            continue;
        }
        {
            // New connection = bridge (re)started or AmiBroker just launched: every ticker
            // must re-fetch whatever bars it missed while we were disconnected.
            std::lock_guard<std::mutex> lk(g_pollerMutex);
            g_ipcConnected = true;
            ++g_connGeneration;
        }
        { std::lock_guard<std::mutex> lk(g_sendMutex); g_ipcSocket = s; }
        LogDebug("[IPC] Connected to 7891");

        // A read that gives up every second, so closing AmiBroker is noticed within a second: the
        // engine can stay quiet for 30 s, and this thread blocked in recv() held Release() (and so
        // the whole AmiBroker shutdown, a process with no window) until it spoke again
        DWORD rcvTimeoutMs = 1000;
        setsockopt(s, SOL_SOCKET, SO_RCVTIMEO, (const char*)&rcvTimeoutMs, sizeof(rcvTimeoutMs));

        char buf[4096]; std::string acc;
        while (!g_bShutdown) {
            int n = recv(s, buf, sizeof(buf)-1, 0);
            if (n < 0 && WSAGetLastError() == WSAETIMEDOUT) continue;
            if (n <= 0) break;
            buf[n] = '\0'; acc += buf;

            size_t p;
            while ((p = acc.find('\n')) != std::string::npos) {
                std::string line = acc.substr(0, p);
                acc.erase(0, p+1);
                if (line.rfind("SYNC", 0) == 0) { HandleSyncMessage(line); continue; }
                if (line.rfind("STATUS|", 0) == 0) { HandleStatusMessage(line); continue; }
                if (line.rfind("QUOTE|", 0) == 0) { HandleQuoteMessage(line); continue; }
                if (line.rfind("LIVE_BAR|", 0) != 0) continue;

                // LIVE_BAR|TICKER|ts|open|high|low|close|volume
                // Format: 7 pipes total, volume is LAST field (no trailing pipe)
                size_t p1=line.find('|',9);               if(p1==std::string::npos) continue; // after LIVE_BAR|
                size_t p2=line.find('|',p1+1);            if(p2==std::string::npos) continue; // after ticker
                size_t p3=line.find('|',p2+1);            if(p3==std::string::npos) continue; // after ts
                size_t p4=line.find('|',p3+1);            if(p4==std::string::npos) continue; // after open
                size_t p5=line.find('|',p4+1);            if(p5==std::string::npos) continue; // after high
                size_t p6=line.find('|',p5+1);            if(p6==std::string::npos) continue; // after low
                // p6+1 to p7 = close, p7+1 to end = volume (no p7 needed)
                size_t p7=line.find('|',p6+1);            // after volume: open interest follows (newer engines)

                std::string ticker = line.substr(9, p1-9);

                Bar b{};
                try {
                    b.timestamp = std::stod(line.substr(p1+1, p2-p1-1));
                    b.open  = std::stof(line.substr(p2+1, p3-p2-1));
                    b.high  = std::stof(line.substr(p3+1, p4-p3-1));
                    b.low   = std::stof(line.substr(p4+1, p5-p4-1));
                    b.close = std::stof(line.substr(p5+1, p6-p5-1));
                    // volume: from p6+1 to p7 (or end of string)
                    std::string volStr = (p7!=std::string::npos) 
                        ? line.substr(p6+1, p7-p6-1) 
                        : line.substr(p6+1);
                    // trim CR if any
                    if (!volStr.empty() && volStr.back()=='\r') volStr.pop_back();
                    b.volume = std::stof(volStr);
                    if (p7 != std::string::npos) {
                        std::string oiStr = line.substr(p7+1);
                        if (!oiStr.empty() && oiStr.back()=='\r') oiStr.pop_back();
                        b.oi = oiStr.empty() ? 0.0f : std::stof(oiStr);
                    }
                } catch(...) { continue; }

                {
                    std::lock_guard<std::mutex> lk(g_pollerMutex);
                    KeepLiveBar(ticker, b);
                }
            }
        }
        { std::lock_guard<std::mutex> lk(g_sendMutex); g_ipcSocket = INVALID_SOCKET; }
        closesocket(s);
        {
            std::lock_guard<std::mutex> lk(g_pollerMutex);
            g_ipcConnected = false;
            g_statusLevel = -1;   // the light shows "not running" until the engine is back
        }
        LogDebug("[IPC] Disconnected, reconnecting...");
    }
    WSACleanup();
}

void StartPollingThread() {
    std::lock_guard<std::mutex> lk(g_pollerMutex);
    if (!g_pollerThread.joinable()) {
        g_bShutdown = false;
        g_initTick = GetTickCount64();
        g_pollerThread = std::thread(PollerThreadProc);
        g_notifyThread = std::thread(NotifierThreadProc);
        g_catchUpThread = std::thread(CatchUpThreadProc);
    }
}

void StopPollingThread() {
    g_bShutdown = true;
    // Wake the reader now rather than at its next one-second timeout
    { std::lock_guard<std::mutex> lk(g_sendMutex); if (g_ipcSocket != INVALID_SOCKET) shutdown(g_ipcSocket, SD_BOTH); }
    if (g_pollerThread.joinable()) g_pollerThread.join();
    if (g_notifyThread.joinable()) g_notifyThread.join();
    g_catchUpCv.notify_all();
    if (g_catchUpThread.joinable()) g_catchUpThread.join();
    {
        std::lock_guard<std::mutex> lk(g_pollerMutex);
        g_catchUpJobs.clear(); g_catchUpPending.clear(); g_catchUpDone.clear();
    }
    CloseHttpSession();
}

// Percent-encode a ticker for the query string (M&M, GVT&D, NIFTY 50, ...)
static std::string UrlEncode(const std::string& s) {
    static const char* hex = "0123456789ABCDEF";
    std::string out;
    for (unsigned char c : s) {
        if (isalnum(c) || c == '-' || c == '_' || c == '.' || c == '~') out += (char)c;
        else { out += '%'; out += hex[c >> 4]; out += hex[c & 15]; }
    }
    return out;
}

// ---- HTTP historical bars ----
// One WinHTTP session for every request (it keeps the connection to the engine open between
// them), instead of a new session per symbol
// (AmiBroker can Release and Init the plugin again, e.g. when another database is opened)
static HINTERNET g_httpSession = NULL;
static std::mutex g_httpMutex;
static HINTERNET HttpSession() {
    std::lock_guard<std::mutex> lk(g_httpMutex);
    if (!g_httpSession)
        g_httpSession = WinHttpOpen(L"DataBridgePro/1.0", WINHTTP_ACCESS_TYPE_NO_PROXY,
                                    WINHTTP_NO_PROXY_NAME, WINHTTP_NO_PROXY_BYPASS, 0);
    return g_httpSession;
}

void CloseHttpSession() {
    std::lock_guard<std::mutex> lk(g_httpMutex);
    if (g_httpSession) { WinHttpCloseHandle(g_httpSession); g_httpSession = NULL; }
}

static int FetchBarsPath(const wchar_t* path, bool quick, std::vector<Bar>& out);

int FetchBarsFromAPI(const std::string& ticker, int limit, double since, std::vector<Bar>& out) {
    wchar_t path[512];
    swprintf_s(path, L"/api/feed/bars?ticker=%hs", UrlEncode(ticker).c_str());
    if (limit > 0) {
        wchar_t tmp[64]; swprintf_s(tmp, L"&limit=%d", limit);
        wcscat_s(path, tmp);
    }
    if (since > 0) {
        wchar_t tmp[64]; swprintf_s(tmp, L"&since=%lld", (long long)since);
        wcscat_s(path, tmp);
    }
    return FetchBarsPath(path, since > 0, out);
}

int FetchDailyFromAPI(const std::string& ticker, std::vector<Bar>& out) {
    wchar_t path[512];
    swprintf_s(path, L"/api/feed/daily?ticker=%hs", UrlEncode(ticker).c_str());
    return FetchBarsPath(path, false, out);
}

// GET `path` from the engine and parse its bar lines. `quick`: a small answer is expected (a
// catch-up), so a slow one gives up sooner. -1 when the request failed.
static int FetchBarsPath(const wchar_t* path, bool quick, std::vector<Bar>& out) {
    out.clear();
    HINTERNET hS = HttpSession();
    if (!hS) return -1;
    HINTERNET hC = WinHttpConnect(hS, L"127.0.0.1", 7890, 0);
    if (!hC) return -1;

    HINTERNET hR = WinHttpOpenRequest(hC, L"GET", path, NULL, WINHTTP_NO_REFERER,
                                      WINHTTP_DEFAULT_ACCEPT_TYPES, 0);
    if (!hR) { WinHttpCloseHandle(hC); return -1; }
    // This runs on AmiBroker's own thread. A full load (~100k bars) may take a few seconds when
    // the engine is busy; a catch-up is a few hundred bars, so a slow answer means trouble and
    // must not hold AmiBroker for long (the caller then pauses catch-ups, CatchUpFailed)
    if (quick) WinHttpSetTimeouts(hR, 1000, 1000, 2000, 4000);
    else           WinHttpSetTimeouts(hR, 2000, 2000, 5000, 20000);

    BOOL ok = WinHttpSendRequest(hR, WINHTTP_NO_ADDITIONAL_HEADERS, 0,
                                 WINHTTP_NO_REQUEST_DATA, 0, 0, 0);
    if (ok) ok = WinHttpReceiveResponse(hR, NULL);
    if (ok) {
        DWORD status = 0, len = sizeof(status);
        WinHttpQueryHeaders(hR, WINHTTP_QUERY_STATUS_CODE | WINHTTP_QUERY_FLAG_NUMBER,
                            WINHTTP_HEADER_NAME_BY_INDEX, &status, &len, WINHTTP_NO_HEADER_INDEX);
        if (status != 200) ok = FALSE;
    }
    if (!ok) { WinHttpCloseHandle(hR); WinHttpCloseHandle(hC); return -1; }

    // A full load is ~100k lines (~4 MB) and runs while AmiBroker waits: read it in big
    // pieces into one buffer and parse it in place (string streams cost several allocations
    // per bar)
    std::string resp;
    if (ok) {
        DWORD contentLen = 0, cl = sizeof(contentLen);
        if (WinHttpQueryHeaders(hR, WINHTTP_QUERY_CONTENT_LENGTH | WINHTTP_QUERY_FLAG_NUMBER,
                                WINHTTP_HEADER_NAME_BY_INDEX, &contentLen, &cl, WINHTTP_NO_HEADER_INDEX))
            resp.reserve(contentLen + 1);
        std::vector<char> chunk(256 * 1024);
        DWORD sz = 0, dl = 0;
        do {
            if (!WinHttpQueryDataAvailable(hR, &sz) || sz == 0) break;
            if (sz > chunk.size()) chunk.resize(sz);
            if (!WinHttpReadData(hR, chunk.data(), sz, &dl) || dl == 0) break;
            resp.append(chunk.data(), dl);
        } while (sz > 0);
    }
    WinHttpCloseHandle(hR); WinHttpCloseHandle(hC);

    if (resp.empty()) return 0;
    ParseBarsCsv(resp.c_str(), resp.c_str() + resp.size(), out);
    return (int)out.size();
}

// "tsSec,open,high,low,close,volume" lines (an "END" line and blank lines are skipped)
void ParseBarsCsv(const char* p, const char* end, std::vector<Bar>& out) {
    out.reserve(out.size() + (size_t)((end - p) / 40));
    while (p < end) {
        const char* eol = (const char*)memchr(p, '\n', (size_t)(end - p));
        if (!eol) eol = end;
        Bar b{};
        double v[7];
        int n = 0;
        const char* q = p;
        while (n < 7 && q < eol) {
            // from_chars: no locale (a "," decimal setting can't misread prices), ~3x strtod
            auto r = std::from_chars(q, eol, v[n]);
            if (r.ec != std::errc()) break;             // not a number ("END", garbage)
            n++;
            q = r.ptr;
            if (q < eol && *q == ',') q++;
            else break;
        }
        if (n >= 6) {   // a 7th value is open interest (F&O)
            b.timestamp = v[0];
            b.open = (float)v[1]; b.high = (float)v[2]; b.low = (float)v[3];
            b.close = (float)v[4]; b.volume = (float)v[5];
            b.oi = n == 7 ? (float)v[6] : 0.0f;
            out.push_back(b);
        }
        p = eol + 1;
    }
}
