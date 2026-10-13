#define WIN32_LEAN_AND_MEAN
#include <winsock2.h>
#include <ws2tcpip.h>
#include <windows.h>
#include <winhttp.h>
#include <string>
#include <vector>
#include <sstream>
#pragma comment(lib, "winhttp.lib")
#pragma comment(lib, "ws2_32.lib")

#include "DataClient.h"
#include "Plugin.h"
#include <thread>
#include <mutex>
#include <map>
#include <chrono>

static std::thread   g_pollerThread;
static std::mutex    g_pollerMutex;
static bool          g_bShutdown = false;
static std::map<std::string, Bar>    g_lastKnownBars;
static HWND          g_hAmiBrokerWnd = NULL;

// History catch-up state (guarded by g_pollerMutex).
// g_connGeneration is bumped on every successful IPC connect; a ticker whose synced
// generation differs must re-fetch the bars it missed from the bridge's HTTP API.
static bool          g_ipcConnected = false;
static unsigned      g_connGeneration = 0;
static std::map<std::string, unsigned>  g_syncedGeneration;
static std::map<std::string, ULONGLONG> g_lastGapCheck;

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

bool IsBridgeConnected() {
    std::lock_guard<std::mutex> lk(g_pollerMutex);
    return g_ipcConnected;
}

bool NeedsHistorySync(const std::string& ticker) {
    std::lock_guard<std::mutex> lk(g_pollerMutex);
    auto it = g_syncedGeneration.find(ticker);
    return it == g_syncedGeneration.end() || it->second != g_connGeneration;
}

void MarkHistorySynced(const std::string& ticker) {
    std::lock_guard<std::mutex> lk(g_pollerMutex);
    g_syncedGeneration[ticker] = g_connGeneration;
}

bool TryBeginGapCheck(const std::string& ticker) {
    std::lock_guard<std::mutex> lk(g_pollerMutex);
    ULONGLONG now = GetTickCount64();
    ULONGLONG& last = g_lastGapCheck[ticker];
    if (last != 0 && now - last < 30000) return false;
    last = now;
    return true;
}

// Push a RecentInfo update so AmiBroker refreshes the symbol (and calls GetQuotesEx).
static void NotifyAmiBroker(const std::string& ticker, const Bar& b) {
    if (!g_hAmiBrokerWnd || !IsWindow(g_hAmiBrokerWnd)) return;
    RecentInfo ri{};
    ri.nStructSize = sizeof(RecentInfo);
    strncpy_s(ri.Name, ticker.c_str(), sizeof(ri.Name)-1);
    ri.fOpen=b.open; ri.fHigh=b.high; ri.fLow=b.low; ri.fLast=b.close;
    ri.iTotalVol=(int)b.volume; ri.iTradeVol=(int)b.volume;
    time_t t=(time_t)b.timestamp; struct tm ti; localtime_s(&ti,&t);
    ri.nDateUpdate=((ti.tm_year+1900)*10000)+((ti.tm_mon+1)*100)+ti.tm_mday;
    ri.nTimeUpdate=(ti.tm_hour*10000)+(ti.tm_min*100)+ti.tm_sec;
    ri.nBitmap  = 0xFFFF;
    ri.nStatus  = RI_STATUS_UPDATE|RI_STATUS_TRADE|RI_STATUS_BARSREADY|RI_STATUS_INCOMPLETE;

    LRESULT res = SendMessage(g_hAmiBrokerWnd, WM_USER_STREAMING_UPDATE, 0, (LPARAM)&ri);

    static DWORD lastLog2 = 0; DWORD now2 = GetTickCount();
    if (now2 - lastLog2 > 5000) {
        lastLog2 = now2;
        char lb[256];
        sprintf_s(lb,"[TICK] %s %.2f ts=%d res=%d",ticker.c_str(),b.close,(int)b.timestamp,(int)res);
        LogDebug(lb);
    }
}

// SYNC|TICKER  -> bridge stored new history for TICKER (gap-fill / backfill finished)
// SYNC_ALL     -> force every ticker to re-sync
static void HandleSyncMessage(const std::string& line) {
    if (line.rfind("SYNC_ALL", 0) == 0) {
        std::lock_guard<std::mutex> lk(g_pollerMutex);
        g_syncedGeneration.clear();
        LogDebug("[SYNC] all tickers marked for history re-sync");
        return;
    }
    std::string ticker = line.substr(5);
    if (!ticker.empty() && ticker.back() == '\r') ticker.pop_back();
    if (ticker.empty()) return;

    Bar live{}; bool hasLive = false;
    {
        std::lock_guard<std::mutex> lk(g_pollerMutex);
        g_syncedGeneration.erase(ticker);
        auto it = g_lastKnownBars.find(ticker);
        if (it != g_lastKnownBars.end()) { live = it->second; hasLive = true; }
    }
    // Nudge AmiBroker so an open chart pulls the new bars right away.
    if (hasLive && live.close > 0) NotifyAmiBroker(ticker, live);
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
        LogDebug("[IPC] Connected to 7891");

        char buf[4096]; std::string acc;
        while (!g_bShutdown) {
            int n = recv(s, buf, sizeof(buf)-1, 0);
            if (n <= 0) break;
            buf[n] = '\0'; acc += buf;

            size_t p;
            while ((p = acc.find('\n')) != std::string::npos) {
                std::string line = acc.substr(0, p);
                acc.erase(0, p+1);
                if (line.rfind("SYNC", 0) == 0) { HandleSyncMessage(line); continue; }
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
                size_t p7=line.find('|',p6+1);            // after close (optional trailing pipe)

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
                } catch(...) { continue; }

                { std::lock_guard<std::mutex> lk(g_pollerMutex); g_lastKnownBars[ticker] = b; }

                NotifyAmiBroker(ticker, b);
            }
        }
        closesocket(s);
        { std::lock_guard<std::mutex> lk(g_pollerMutex); g_ipcConnected = false; }
        LogDebug("[IPC] Disconnected, reconnecting...");
    }
    WSACleanup();
}

void StartPollingThread() {
    std::lock_guard<std::mutex> lk(g_pollerMutex);
    if (!g_pollerThread.joinable()) {
        g_bShutdown = false;
        g_pollerThread = std::thread(PollerThreadProc);
    }
}

void StopPollingThread() {
    g_bShutdown = true;
    if (g_pollerThread.joinable()) g_pollerThread.join();
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
int FetchBarsFromAPI(const std::string& ticker, int limit, double since, std::vector<Bar>& out) {
    out.clear();
    HINTERNET hS = WinHttpOpen(L"DataBridgePro/1.0", WINHTTP_ACCESS_TYPE_NO_PROXY,
                               WINHTTP_NO_PROXY_NAME, WINHTTP_NO_PROXY_BYPASS, 0);
    if (!hS) return -1;
    // This runs on AmiBroker's UI thread — never let a stuck bridge freeze the charts.
    WinHttpSetTimeouts(hS, 2000, 2000, 5000, 15000);
    HINTERNET hC = WinHttpConnect(hS, L"127.0.0.1", 7890, 0);
    if (!hC) { WinHttpCloseHandle(hS); return -1; }

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

    HINTERNET hR = WinHttpOpenRequest(hC, L"GET", path, NULL, WINHTTP_NO_REFERER,
                                      WINHTTP_DEFAULT_ACCEPT_TYPES, 0);
    if (!hR) { WinHttpCloseHandle(hC); WinHttpCloseHandle(hS); return -1; }

    BOOL ok = WinHttpSendRequest(hR, WINHTTP_NO_ADDITIONAL_HEADERS, 0,
                                 WINHTTP_NO_REQUEST_DATA, 0, 0, 0);
    if (ok) ok = WinHttpReceiveResponse(hR, NULL);
    if (ok) {
        DWORD status = 0, len = sizeof(status);
        WinHttpQueryHeaders(hR, WINHTTP_QUERY_STATUS_CODE | WINHTTP_QUERY_FLAG_NUMBER,
                            WINHTTP_HEADER_NAME_BY_INDEX, &status, &len, WINHTTP_NO_HEADER_INDEX);
        if (status != 200) ok = FALSE;
    }
    if (!ok) { WinHttpCloseHandle(hR); WinHttpCloseHandle(hC); WinHttpCloseHandle(hS); return -1; }

    std::string resp;
    if (ok) {
        DWORD sz=0, dl=0;
        do {
            if (!WinHttpQueryDataAvailable(hR,&sz)||sz==0) break;
            char* p=new char[sz+1];
            if (WinHttpReadData(hR,(LPVOID)p,sz,&dl)) { p[dl]=0; resp+=p; }
            delete[] p;
        } while (sz>0);
    }
    WinHttpCloseHandle(hR); WinHttpCloseHandle(hC); WinHttpCloseHandle(hS);

    if (resp.empty()) return 0;
    std::istringstream ss(resp); std::string line;
    while (std::getline(ss,line)) {
        if (line.empty()||line=="END"||line=="END\r") continue;
        std::istringstream ls(line); std::string tok; Bar b{};
        try {
            if (std::getline(ls,tok,',')) b.timestamp=std::stod(tok); else continue;
            if (std::getline(ls,tok,',')) b.open =std::stof(tok); else continue;
            if (std::getline(ls,tok,',')) b.high =std::stof(tok); else continue;
            if (std::getline(ls,tok,',')) b.low  =std::stof(tok); else continue;
            if (std::getline(ls,tok,',')) b.close=std::stof(tok); else continue;
            if (std::getline(ls,tok,',')) b.volume=std::stof(tok); else continue;
        } catch(...) { continue; }
        out.push_back(b);
    }
    return (int)out.size();
}
