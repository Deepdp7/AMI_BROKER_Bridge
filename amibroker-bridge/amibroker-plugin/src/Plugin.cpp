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

static void WriteBarToQuotation(struct Quotation* pQ, int idx, const Bar& b) {
    if (b.timestamp <= 0) return;
    pQ[idx].Price        = b.close;
    pQ[idx].Open         = b.open;
    pQ[idx].High         = b.high;
    pQ[idx].Low          = b.low;
    pQ[idx].Volume       = b.volume;
    pQ[idx].OpenInterest = 0;
    pQ[idx].AuxData1     = 0;
    pQ[idx].AuxData2     = 0;
    time_t t = (time_t)b.timestamp;
    struct tm tm_out; memset(&tm_out, 0, sizeof(tm_out));
    localtime_s(&tm_out, &t);
    pQ[idx].DateTime.PackDate.MicroSec = 0;
    pQ[idx].DateTime.PackDate.MilliSec = 0;
    pQ[idx].DateTime.PackDate.Second   = tm_out.tm_sec;
    pQ[idx].DateTime.PackDate.Minute   = tm_out.tm_min;
    pQ[idx].DateTime.PackDate.Hour     = tm_out.tm_hour;
    pQ[idx].DateTime.PackDate.Day      = tm_out.tm_mday;
    pQ[idx].DateTime.PackDate.Month    = tm_out.tm_mon + 1;
    pQ[idx].DateTime.PackDate.Year     = tm_out.tm_year + 1900;
}

static int DoGetQuotesEx(LPCTSTR pszTicker, int nPeriodicity, int nLastValid, int nSize, struct Quotation* pQuotes) {
    if (!pszTicker || !pQuotes || nSize <= 0) return 0;
    UpdateActiveSymbol(pszTicker);

    // Calculate 'since' (timestamp of the last bar AmiBroker has)
    double since = 0;
    int startIndex = 0;
    if (nLastValid >= 0 && nLastValid < nSize) {
        struct tm tv; memset(&tv, 0, sizeof(tv));
        tv.tm_sec  = pQuotes[nLastValid].DateTime.PackDate.Second;
        tv.tm_min  = pQuotes[nLastValid].DateTime.PackDate.Minute;
        tv.tm_hour = pQuotes[nLastValid].DateTime.PackDate.Hour;
        tv.tm_mday = pQuotes[nLastValid].DateTime.PackDate.Day;
        tv.tm_mon  = pQuotes[nLastValid].DateTime.PackDate.Month - 1;
        tv.tm_year = pQuotes[nLastValid].DateTime.PackDate.Year - 1900;
        time_t t = mktime(&tv);
        if (t != (time_t)-1) since = (double)t;
        startIndex = nLastValid + 1;
    }

    // --- FAST PATH: Live bar from RAM cache (0ms, no I/O) ---
    // This is called ~every 1 second by AmiBroker's realtime timer
    // and after every WM_USER_STREAMING_UPDATE we send.
    if (nLastValid >= 0) {
        Bar live; memset(&live, 0, sizeof(Bar));
        bool hasLive = GetCachedLiveBar(pszTicker, live);

        if (hasLive && live.timestamp > 0 && live.close > 0) {
            double liveMin  = floor(live.timestamp  / 60.0) * 60.0;
            double sinceMin = floor(since / 60.0) * 60.0;

            if (liveMin == sinceMin) {
                // Update last bar in-place (same candle, price moved)
                WriteBarToQuotation(pQuotes, nLastValid, live);
                return nLastValid + 1;
            } else if (liveMin > sinceMin && startIndex < nSize) {
                // New minute candle
                WriteBarToQuotation(pQuotes, startIndex, live);
                return startIndex + 1;
            }
        }
        // No new live data - return what AmiBroker already has
        return nLastValid + 1;
    }

    // --- SLOW PATH: Initial historical load via HTTP ---
    // Only runs when nLastValid = -1 (first time symbol is loaded,
    // or after Flush Cache). AmiBroker expects this to take time.
    std::vector<Bar> outBars;
    int count = FetchBarsFromAPI(pszTicker, nSize, since, outBars);
    if (count <= 0) return 0;
    if (count > nSize) count = nSize;

    for (int i = 0; i < count; i++) {
        WriteBarToQuotation(pQuotes, i, outBars[i]);
    }

    // Also append live bar if it's newer than what we fetched
    Bar live; memset(&live, 0, sizeof(Bar));
    if (GetCachedLiveBar(pszTicker, live) && live.timestamp > 0 && live.close > 0 && count < nSize) {
        double lastFetched = outBars.empty() ? 0 : outBars.back().timestamp;
        if (live.timestamp > lastFetched) {
            WriteBarToQuotation(pQuotes, count, live);
            count++;
        } else if (!outBars.empty() && (long long)live.timestamp / 60 == (long long)lastFetched / 60) {
            WriteBarToQuotation(pQuotes, count - 1, live); // update last bar
        }
    }

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

PLUGINAPI int Notify(struct PluginNotification* pNotification) {
    if (!pNotification) return 0;
    if (pNotification->hMainWnd)
        SetAmiBrokerWindow(pNotification->hMainWnd);
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
