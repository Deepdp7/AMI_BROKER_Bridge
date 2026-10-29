#define _USRDLL
#define WIN32_LEAN_AND_MEAN
#include <winsock2.h>
#include <windows.h>
#include <string>
#include <vector>
#include <map>
#include <math.h>
#include <time.h>
#include "Plugin.h"
#include "DataClient.h"

struct SiteInterface gSite;
static RecentInfo g_recentInfoBuf;

static void LogPlugin(const char* msg) {
    FILE* fp;
    if (fopen_s(&fp, "C:\\Users\\Public\\DataBridgePro_plugin.log", "a") == 0) {
        fprintf(fp, "%s\n", msg);
        fclose(fp);
    }
}

// localtime_s for many bar times: a full load converts ~100k of them. The UTC offset is looked
// up once per UTC hour (clock changes, where there are any, fall on those), the date is plain
// arithmetic (days → year/month/day, H. Hinnant's civil_from_days).
static void LocalTimeOf(time_t t, struct tm& out) {
    thread_local time_t cachedHour = -1;
    thread_local long long offset = 0;
    time_t hour = t - (t % 3600);
    if (hour != cachedHour) {
        struct tm lt; memset(&lt, 0, sizeof(lt));
        if (localtime_s(&lt, &hour) != 0) { memset(&out, 0, sizeof(out)); localtime_s(&out, &t); return; }
        offset = (long long)_mkgmtime(&lt) - (long long)hour;
        cachedHour = hour;
    }
    long long wall = (long long)t + offset;
    long long days = wall >= 0 ? wall / 86400 : (wall - 86399) / 86400;
    int secs = (int)(wall - days * 86400);
    days += 719468;
    long long era = (days >= 0 ? days : days - 146096) / 146097;
    unsigned doe = (unsigned)(days - era * 146097);
    unsigned yoe = (doe - doe / 1460 + doe / 36524 - doe / 146096) / 365;
    unsigned doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    unsigned mp = (5 * doy + 2) / 153;
    unsigned d = doy - (153 * mp + 2) / 5 + 1;
    unsigned m = mp < 10 ? mp + 3 : mp - 9;
    long long y = (long long)yoe + era * 400 + (m <= 2 ? 1 : 0);
    memset(&out, 0, sizeof(out));
    out.tm_year = (int)(y - 1900);
    out.tm_mon = (int)m - 1;
    out.tm_mday = (int)d;
    out.tm_hour = secs / 3600;
    out.tm_min = (secs / 60) % 60;
    out.tm_sec = secs % 60;
}

static void WriteBarToQuotation(struct Quotation* pQ, int idx, const Bar& b) {
    if (b.timestamp <= 0) return;
    pQ[idx].Price        = b.close;
    pQ[idx].Open         = b.open;
    pQ[idx].High         = b.high;
    pQ[idx].Low          = b.low;
    pQ[idx].Volume       = b.volume;
    pQ[idx].OpenInterest = b.oi;
    pQ[idx].AuxData1     = 0;
    pQ[idx].AuxData2     = 0;
    time_t t = (time_t)b.timestamp;
    struct tm tm_out;
    LocalTimeOf(t, tm_out);
    pQ[idx].DateTime.PackDate.MicroSec = 0;
    pQ[idx].DateTime.PackDate.MilliSec = 0;
    pQ[idx].DateTime.PackDate.Second   = tm_out.tm_sec;
    pQ[idx].DateTime.PackDate.Minute   = tm_out.tm_min;
    pQ[idx].DateTime.PackDate.Hour     = tm_out.tm_hour;
    pQ[idx].DateTime.PackDate.Day      = tm_out.tm_mday;
    pQ[idx].DateTime.PackDate.Month    = tm_out.tm_mon + 1;
    pQ[idx].DateTime.PackDate.Year     = tm_out.tm_year + 1900;
}

static double QuotationToUnix(const struct Quotation& q) {
    struct tm tv; memset(&tv, 0, sizeof(tv));
    tv.tm_sec  = q.DateTime.PackDate.Second;
    tv.tm_min  = q.DateTime.PackDate.Minute;
    tv.tm_hour = q.DateTime.PackDate.Hour;
    tv.tm_mday = q.DateTime.PackDate.Day;
    tv.tm_mon  = q.DateTime.PackDate.Month - 1;
    tv.tm_year = q.DateTime.PackDate.Year - 1900;
    tv.tm_isdst = -1;
    time_t t = mktime(&tv);
    return (t == (time_t)-1) ? 0 : (double)t;
}

static double QuotationMinute(const struct Quotation& q) { return floor(QuotationToUnix(q) / 60.0) * 60.0; }
static double BarMinute(const Bar& b) { return floor(b.timestamp / 60.0) * 60.0; }

// First index in pQ[0..count) whose minute is >= `minute` (binary search).
static int LowerBoundMinute(const struct Quotation* pQ, int count, double minute) {
    int lo = 0, hi = count;
    while (lo < hi) {
        int mid = (lo + hi) / 2;
        if (QuotationMinute(pQ[mid]) < minute) lo = mid + 1; else hi = mid;
    }
    return lo;
}

// Merge ascending bars into pQ[0..count): a bar in the same minute as an existing quotation
// overwrites it (broker history correcting live-built candles); bars for minutes AmiBroker
// does not have are inserted in time order, also in the middle of the array. That is how a
// hole left while the bridge was closed gets filled even after newer live bars were already
// appended (they used to be ignored, so the hole stayed in AmiBroker's database for good).
// Only the part from the first incoming minute on is rebuilt, so the live-tick path stays
// cheap. When the array is full the oldest quotations are dropped. Returns the new count.
static int MergeBars(struct Quotation* pQ, int count, int nSize, const std::vector<Bar>& bars) {
    // Incoming bars: valid, ascending, one per minute (last wins)
    std::vector<const Bar*> in;
    for (const Bar& b : bars) {
        if (b.timestamp <= 0 || b.close <= 0) continue;
        if (!in.empty()) {
            double last = BarMinute(*in.back()), m = BarMinute(b);
            if (m == last) { in.back() = &b; continue; }
            if (m < last) continue;   // out of order (input is ascending): ignore
        }
        in.push_back(&b);
    }
    if (in.empty()) return count;

    int k = LowerBoundMinute(pQ, count, BarMinute(*in.front()));   // pQ[0..k) stays as it is
    std::vector<struct Quotation> tail;
    tail.reserve((size_t)(count - k) + in.size());
    int i = k;
    size_t j = 0;
    while (i < count || j < in.size()) {
        if (j >= in.size()) { tail.push_back(pQ[i++]); continue; }
        double bm = BarMinute(*in[j]);
        if (i < count) {
            double qm = QuotationMinute(pQ[i]);
            if (qm < bm) { tail.push_back(pQ[i++]); continue; }
            if (qm == bm) {
                struct Quotation q = pQ[i++];
                WriteBarToQuotation(&q, 0, *in[j++]);
                tail.push_back(q);
                continue;
            }
        }
        struct Quotation q;
        memset(&q, 0, sizeof(q));
        WriteBarToQuotation(&q, 0, *in[j++]);
        tail.push_back(q);
    }

    // Keep the newest nSize quotations: drop from the front (oldest) if needed
    int total = k + (int)tail.size();
    int drop = total > nSize ? total - nSize : 0;
    if (drop >= k) {
        size_t skip = (size_t)(drop - k);
        memcpy(pQ, tail.data() + skip, (tail.size() - skip) * sizeof(struct Quotation));
        return (int)(tail.size() - skip);
    }
    if (drop > 0) {
        memmove(pQ, pQ + drop, (size_t)(k - drop) * sizeof(struct Quotation));
        k -= drop;
    }
    memcpy(pQ + k, tail.data(), tail.size() * sizeof(struct Quotation));
    return k + (int)tail.size();
}

static int DoGetQuotesEx(LPCTSTR pszTicker, int nPeriodicity, int nLastValid, int nSize, struct Quotation* pQuotes) {
    if (!pszTicker || !pQuotes || nSize <= 0) return 0;
    UpdateActiveSymbol(pszTicker);

    // Calculate 'since' (timestamp of the last bar AmiBroker has)
    double since = 0;
    int startIndex = 0;
    if (nLastValid >= 0 && nLastValid < nSize) {
        since = QuotationToUnix(pQuotes[nLastValid]);
        startIndex = nLastValid + 1;
    }

    // --- FAST PATH: Live bar from RAM cache (0ms, no I/O) ---
    // This is called ~every 1 second by AmiBroker's realtime timer
    // and after every WM_USER_STREAMING_UPDATE we send.
    if (nLastValid >= 0) {
        Bar live; memset(&live, 0, sizeof(Bar));
        bool hasLive = GetCachedLiveBar(pszTicker, live) && live.timestamp > 0 && live.close > 0;
        double liveMin  = hasLive ? floor(live.timestamp / 60.0) * 60.0 : 0;
        double sinceMin = floor(since / 60.0) * 60.0;

        // --- CATCH-UP PATH: fetch bars AmiBroker missed ---
        // AmiBroker keeps its own local database, so after AmiBroker or the bridge was
        // closed it already has bars (nLastValid >= 0) but nothing for the downtime.
        // Re-sync once per bridge connection, when the bridge reports new history
        // (SYNC|ticker), or when the live bar jumps over minutes we never received.
        // None of this while DataBridge isn't answering (CatchUpAllowed): AmiBroker would wait
        // on it for every symbol of a scan. A gap check that found nothing (minutes without
        // trades) isn't repeated until AmiBroker's last bar moves on.
        bool liveSkipsMinutes = hasLive && liveMin > sinceMin + 60;
        bool canCatchUp = IsBridgeConnected() && CatchUpAllowed();
        bool fullSync = canCatchUp && NeedsHistorySync(pszTicker);
        bool gapCheck = !fullSync && canCatchUp && liveSkipsMinutes && GapCheckWorthIt(pszTicker, sinceMin) && TryBeginGapCheck(pszTicker);
        if (fullSync || gapCheck) {
            std::vector<Bar> missed;
            unsigned epoch = 0;
            double announced = BeginHistorySync(pszTicker, epoch);
            // Full sync (reconnect / bridge announced new history): re-fetch the last 24h so
            // broker-corrected candles overwrite live-built ones, or from the oldest bar the
            // bridge announced if that is earlier (a downtime hole behind newer live bars).
            // Gap check: just the tail; since-1 so the server also re-sends AmiBroker's last
            // (possibly partial) candle.
            double from = fullSync ? since - 86400 : since - 1;
            if (fullSync && announced > 0 && announced - 60 < from) from = announced - 60;
            int got = FetchBarsFromAPI(pszTicker, nSize, from > 0 ? from : 0, missed);
            if (got >= 0) {
                if (fullSync) MarkHistorySynced(pszTicker, epoch);
                int count = MergeBars(pQuotes, nLastValid + 1, nSize, missed);
                if (gapCheck) GapCheckResult(pszTicker, sinceMin, count != nLastValid + 1);
                if (count != nLastValid + 1) {
                    char logBuf[160];
                    sprintf_s(logBuf, "[SYNC] %s caught up %d missed bar(s)", pszTicker, count - (nLastValid + 1));
                    LogPlugin(logBuf);
                    return count;   // the engine's answer ends with the live bar
                }
                // Nothing new: the live bar below still goes in, in this same call
            } else {
                CatchUpFailed();
            }
        }

        if (hasLive) {
            if (liveMin == sinceMin) {
                // Update last bar in-place (same candle, price moved)
                WriteBarToQuotation(pQuotes, nLastValid, live);
                return nLastValid + 1;
            } else if (liveMin > sinceMin) {
                // New minute candle (MergeBars shifts out the oldest bar if the array is full)
                return MergeBars(pQuotes, startIndex, nSize, std::vector<Bar>{ live });
            }
        }
        // No new live data - return what AmiBroker already has
        return nLastValid + 1;
    }

    // --- SLOW PATH: Initial historical load via HTTP ---
    // Only runs when nLastValid = -1 (first time symbol is loaded,
    // or after Flush Cache). AmiBroker expects this to take time.
    // While DataBridge isn't running or answering, don't wait on it for every symbol (2 s for
    // Windows to refuse a closed port, up to 20 s for a stuck engine); AmiBroker asks again on
    // its next refresh, and the symbol loads once DataBridge is back.
    if (!WaitForBridge(1500) || !CatchUpAllowed()) return 0;
    std::vector<Bar> outBars;
    unsigned epoch = 0;
    BeginHistorySync(pszTicker, epoch);
    int got = FetchBarsFromAPI(pszTicker, nSize, since, outBars);
    if (got < 0 && IsBridgeConnected()) CatchUpFailed();   // engine running but not answering
    if (got <= 0) return 0;
    MarkHistorySynced(pszTicker, epoch);
    NoteFullLoad(pszTicker);

    // Also merge the live bar (replaces the last candle if same minute, appends if newer)
    Bar live; memset(&live, 0, sizeof(Bar));
    if (GetCachedLiveBar(pszTicker, live) && live.timestamp > 0 && live.close > 0) {
        outBars.push_back(live);
    }
    int count = MergeBars(pQuotes, 0, nSize, outBars);

    char logBuf[128];
    sprintf_s(logBuf, "[GQE] %s nLV=%d returned=%d", pszTicker, nLastValid, count);
    LogPlugin(logBuf);

    return count;
}

extern "C" {

PLUGINAPI int GetPluginInfo(struct PluginInfo* pInfo) {
    if (!pInfo) return 0;
    pInfo->nStructSize   = sizeof(struct PluginInfo);
    pInfo->nType         = PLUGIN_TYPE_DATA;
    pInfo->nVersion      = 10000;
    pInfo->nIDCode       = PIDCODE('D','B','P','R');
    strcpy_s(pInfo->szName,   "DataBridge Pro API Plugin");
    strcpy_s(pInfo->szVendor, "DataBridge");
    pInfo->nCertificate  = 13012679;
    pInfo->nMinAmiVersion = 387000;
    return 1;
}

PLUGINAPI int Init(void) {
    StartPollingThread();
    return 1;
}

PLUGINAPI int Release(void) {
    StopPollingThread();
    return 1;
}

// Right-click on the DataBridge light: actions for the symbol on screen, and the app
enum { MENU_REPAIR = 1, MENU_TODAY, MENU_TODAY_ALL, MENU_OPEN };

static void ShowStatusMenu(HWND hWnd, const char* ticker) {
    int level; std::string shortMsg, longMsg;
    GetBridgeStatus(level, shortMsg, longMsg);
    bool connected = level >= 0;
    UINT on = MF_STRING | (connected ? 0 : MF_GRAYED);
    bool hasTicker = ticker && *ticker;
    std::string repair = hasTicker ? std::string("Backfill ") + ticker + " (download missing history)" : "Backfill current symbol";
    std::string today = hasTicker ? std::string("Refresh today's bars of ") + ticker : "Refresh today's bars of current symbol";

    HMENU menu = CreatePopupMenu();
    if (!menu) return;
    AppendMenuA(menu, MF_STRING | MF_GRAYED, 0, (std::string("DataBridge Pro: ") + shortMsg).c_str());
    AppendMenuA(menu, MF_SEPARATOR, 0, NULL);
    AppendMenuA(menu, hasTicker ? on : (MF_STRING | MF_GRAYED), MENU_REPAIR, repair.c_str());
    AppendMenuA(menu, hasTicker ? on : (MF_STRING | MF_GRAYED), MENU_TODAY, today.c_str());
    AppendMenuA(menu, on, MENU_TODAY_ALL, "Refresh today's bars of all symbols");
    AppendMenuA(menu, MF_SEPARATOR, 0, NULL);
    AppendMenuA(menu, MF_STRING, MENU_OPEN, "Open DataBridge Pro");

    POINT pt; GetCursorPos(&pt);
    SetForegroundWindow(hWnd);
    int cmd = TrackPopupMenu(menu, TPM_RETURNCMD | TPM_NONOTIFY | TPM_RIGHTBUTTON | TPM_BOTTOMALIGN, pt.x, pt.y, 0, hWnd, NULL);
    DestroyMenu(menu);

    std::string t = hasTicker ? ticker : "";
    bool sent = true;
    switch (cmd) {
        case MENU_REPAIR:    sent = SendToBridge("CMD|REPAIR|" + t); break;
        case MENU_TODAY:     sent = SendToBridge("CMD|TODAY|" + t); break;
        case MENU_TODAY_ALL: sent = SendToBridge("CMD|TODAY_ALL"); break;
        case MENU_OPEN:      ShowDataBridge(); break;
        default: break;
    }
    if (!sent) MessageBoxA(hWnd, "DataBridge Pro is not running.", "DataBridge Pro", MB_OK | MB_ICONINFORMATION);
}

PLUGINAPI int Notify(struct PluginNotification* pNotification) {
    if (!pNotification) return 0;
    if (pNotification->hMainWnd)
        SetAmiBrokerWindow(pNotification->hMainWnd);
    if ((pNotification->nReason & (REASON_DATABASE_LOADED | REASON_SETTINGS_CHANGE)) && pNotification->pWorkspace)
        SetDatabaseBars(pNotification->pWorkspace->NumBars);
    if (pNotification->nReason & REASON_STATUS_RMBCLICK) {
        // The symbol on screen (StockInfo is new as of AmiBroker 5.30; older ones pass the old struct only)
        const char* ticker = NULL;
        if (pNotification->nStructSize >= (int)sizeof(struct PluginNotification) && pNotification->pCurrentSINew)
            ticker = pNotification->pCurrentSINew->ShortName;
        ShowStatusMenu(pNotification->hMainWnd, ticker);
    }
    return 1;
}

// The DataBridge light in AmiBroker's status bar (AmiBroker asks for it now and then).
// Status code: top bits 0 OK, 1 warning, 2 minor error, 3 severe; the colour fills the pane.
PLUGINAPI int GetPluginStatus(struct PluginStatus* status) {
    if (!status) return 0;
    int level; std::string shortMsg, longMsg;
    GetBridgeStatus(level, shortMsg, longMsg);
    status->nStructSize = sizeof(struct PluginStatus);
    switch (level) {
        case 0:  status->nStatusCode = 0x00000000; status->clrStatusColor = RGB(0, 200, 83); break;
        case 1:  status->nStatusCode = 0x10000000; status->clrStatusColor = RGB(255, 193, 7); break;
        case 2:  status->nStatusCode = 0x20000000; status->clrStatusColor = RGB(244, 67, 54); break;
        default: status->nStatusCode = 0x30000000; status->clrStatusColor = RGB(158, 158, 158); break;
    }
    strncpy_s(status->szShortMessage, shortMsg.c_str(), _TRUNCATE);
    strncpy_s(status->szLongMessage, longMsg.c_str(), _TRUNCATE);
    return 1;
}

PLUGINAPI int SetSiteInterface(struct SiteInterface* pInterface) {
    gSite = *pInterface;
    return 1;
}

PLUGINAPI int Configure(LPCTSTR pszPath, struct InfoSite* pSite) {
    MessageBoxA(NULL, "DataBridge Pro is active.", "DataBridge Pro", MB_OK);
    return 1;
}

PLUGINAPI int SetTimeBase(int nTimeBase) {
    return 1;
}

PLUGINAPI struct RecentInfo* GetRecentInfo(LPCTSTR pszTicker) {
    if (!pszTicker) return NULL;
    Bar b; memset(&b, 0, sizeof(Bar));
    if (!GetCachedLiveBar(pszTicker, b) || b.close <= 0.0f) return NULL;

    memset(&g_recentInfoBuf, 0, sizeof(RecentInfo));
    g_recentInfoBuf.nStructSize = sizeof(RecentInfo);
    strncpy_s(g_recentInfoBuf.Name, pszTicker, sizeof(g_recentInfoBuf.Name) - 1);

    g_recentInfoBuf.fOpen     = b.open;
    g_recentInfoBuf.fHigh     = b.high;
    g_recentInfoBuf.fLow      = b.low;
    g_recentInfoBuf.fLast     = b.close;
    g_recentInfoBuf.iTotalVol = (int)b.volume;
    g_recentInfoBuf.iTradeVol = (int)b.volume;
    g_recentInfoBuf.fOpenInt  = b.oi;

    time_t t = (time_t)b.timestamp;
    struct tm ti; localtime_s(&ti, &t);
    g_recentInfoBuf.nDateUpdate = ((ti.tm_year+1900)*10000) + ((ti.tm_mon+1)*100) + ti.tm_mday;
    g_recentInfoBuf.nTimeUpdate = (ti.tm_hour*10000) + (ti.tm_min*100) + ti.tm_sec;

    g_recentInfoBuf.nBitmap = 0xFFFF;
    // BARSREADY: AmiBroker will call GetQuotesEx to update chart
    // INCOMPLETE: bar is still forming (don't close/finalize it)
    g_recentInfoBuf.nStatus = RI_STATUS_UPDATE | RI_STATUS_TRADE | RI_STATUS_BARSREADY | RI_STATUS_INCOMPLETE;
    return &g_recentInfoBuf;
}

PLUGINAPI int GetQuotesEx(LPCTSTR pszTicker, int nPeriodicity, int nLastValid, int nSize, struct Quotation* pQuotes, GQEContext* pContext) {
    __try {
        return DoGetQuotesEx(pszTicker, nPeriodicity, nLastValid, nSize, pQuotes);
    }
    __except(EXCEPTION_EXECUTE_HANDLER) {
        LogPlugin("[EXCEPTION] GetQuotesEx SEH");
        return (nLastValid >= 0) ? nLastValid + 1 : 0;
    }
}

} // extern "C"
