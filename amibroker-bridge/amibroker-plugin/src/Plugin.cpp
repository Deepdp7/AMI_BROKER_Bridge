#define _USRDLL
#define WIN32_LEAN_AND_MEAN
#include <winsock2.h>
#include <windows.h>
#include <string>
#include <vector>
#include <time.h>
#include "Plugin.h"
#include "DataClient.h"

// Global Variables
struct SiteInterface gSite;

static void LogPlugin(const char* msg) {
    FILE* fp;
    if (fopen_s(&fp, "C:\\\\DataBridgePro_plugin_debug.log", "a") == 0) {
        fprintf(fp, "%s\n", msg);
        fclose(fp);
    }
}

// Separate function so __try can be used without C++ object unwinding
static int DoGetQuotesEx(LPCTSTR pszTicker, int nPeriodicity, int nLastValid, int nSize, struct Quotation* pQuotes) {
    if (!pszTicker || !pQuotes || nSize <= 0) return 0;

    UpdateActiveSymbol(pszTicker);

    double since = 0;
    int startIndex = 0;
    
    if (nLastValid >= 0 && nLastValid < nSize) {
        struct tm tm_val;
        memset(&tm_val, 0, sizeof(tm_val));
        tm_val.tm_sec  = pQuotes[nLastValid].DateTime.PackDate.Second;
        tm_val.tm_min  = pQuotes[nLastValid].DateTime.PackDate.Minute;
        tm_val.tm_hour = pQuotes[nLastValid].DateTime.PackDate.Hour;
        tm_val.tm_mday = pQuotes[nLastValid].DateTime.PackDate.Day;
        tm_val.tm_mon  = pQuotes[nLastValid].DateTime.PackDate.Month - 1;
        tm_val.tm_year = pQuotes[nLastValid].DateTime.PackDate.Year - 1900;
        time_t t = mktime(&tm_val);
        if (t != (time_t)-1) {
            since = (double)t;
        }
        startIndex = nLastValid + 1;
    }

    // Try IPC cache first for live incremental update
    Bar cachedBar;
    memset(&cachedBar, 0, sizeof(Bar));
    bool hasCached = GetCachedLiveBar(pszTicker, cachedBar);
    
    int count = 0;
    Bar* barData = NULL;
    Bar singleBar;
    
    if (nLastValid >= 0 && hasCached && cachedBar.timestamp > since && cachedBar.timestamp > 0) {
        singleBar = cachedBar;
        barData = &singleBar;
        count = 1;

        static DWORD lastLog = 0;
        DWORD now = GetTickCount();
        if (now - lastLog > 2000) {
            lastLog = now;
            char logBuf[128];
            sprintf_s(logBuf, "[PLUGIN_CACHE_HIT] %s ts=%d", pszTicker, (int)cachedBar.timestamp);
            LogPlugin(logBuf);
        }
    } else {
        // Full historical fetch via HTTP
        // We use a static buffer trick to avoid C++ objects inside __try
        // Just fetch directly here - no C++ vector needed
        count = 0;
        barData = NULL;
    }

    if (count > 0 && barData != NULL) {
        // Single live bar from cache
        if (startIndex >= 0 && startIndex < nSize) {
            pQuotes[startIndex].Price  = barData->close;
            pQuotes[startIndex].Open   = barData->open;
            pQuotes[startIndex].High   = barData->high;
            pQuotes[startIndex].Low    = barData->low;
            pQuotes[startIndex].Volume = barData->volume;
            pQuotes[startIndex].OpenInterest = 0;
            pQuotes[startIndex].AuxData1 = 0;
            pQuotes[startIndex].AuxData2 = 0;

            time_t t = (time_t)barData->timestamp;
            struct tm tm_out;
            memset(&tm_out, 0, sizeof(tm_out));
            localtime_s(&tm_out, &t);

            pQuotes[startIndex].DateTime.PackDate.MicroSec = 0;
            pQuotes[startIndex].DateTime.PackDate.MilliSec = 0;
            pQuotes[startIndex].DateTime.PackDate.Second   = tm_out.tm_sec;
            pQuotes[startIndex].DateTime.PackDate.Minute   = tm_out.tm_min;
            pQuotes[startIndex].DateTime.PackDate.Hour     = tm_out.tm_hour;
            pQuotes[startIndex].DateTime.PackDate.Day      = tm_out.tm_mday;
            pQuotes[startIndex].DateTime.PackDate.Month    = tm_out.tm_mon + 1;
            pQuotes[startIndex].DateTime.PackDate.Year     = tm_out.tm_year + 1900;
        }
        return startIndex + 1;
    }

    // Historical fetch (uses vector - C++ unwinding allowed in separate function)
    std::vector<Bar> outBars;
    count = FetchBarsFromAPI(pszTicker, nSize, since, outBars);
    if (count <= 0) return nLastValid + 1;

    if (startIndex + count > nSize) count = nSize - startIndex;
    if (count <= 0) return nLastValid + 1;

    for (int i = 0; i < count; i++) {
        int destIdx = startIndex + i;
        if (destIdx < 0 || destIdx >= nSize) continue;

        pQuotes[destIdx].Price  = outBars[i].close;
        pQuotes[destIdx].Open   = outBars[i].open;
        pQuotes[destIdx].High   = outBars[i].high;
        pQuotes[destIdx].Low    = outBars[i].low;
        pQuotes[destIdx].Volume = outBars[i].volume;
        pQuotes[destIdx].OpenInterest = 0;
        pQuotes[destIdx].AuxData1 = 0;
        pQuotes[destIdx].AuxData2 = 0;

        time_t t = (time_t)outBars[i].timestamp;
        if (t <= 0) continue;

        struct tm tm_out;
        memset(&tm_out, 0, sizeof(tm_out));
        localtime_s(&tm_out, &t);

        pQuotes[destIdx].DateTime.PackDate.MicroSec = 0;
        pQuotes[destIdx].DateTime.PackDate.MilliSec = 0;
        pQuotes[destIdx].DateTime.PackDate.Second   = tm_out.tm_sec;
        pQuotes[destIdx].DateTime.PackDate.Minute   = tm_out.tm_min;
        pQuotes[destIdx].DateTime.PackDate.Hour     = tm_out.tm_hour;
        pQuotes[destIdx].DateTime.PackDate.Day      = tm_out.tm_mday;
        pQuotes[destIdx].DateTime.PackDate.Month    = tm_out.tm_mon + 1;
        pQuotes[destIdx].DateTime.PackDate.Year     = tm_out.tm_year + 1900;
    }

    return startIndex + count;
}


extern "C" {

    PLUGINAPI int GetPluginInfo(struct PluginInfo* pInfo) {
        if (!pInfo) return 0;
        pInfo->nStructSize   = sizeof(struct PluginInfo);
        pInfo->nType         = PLUGIN_TYPE_DATA;
        pInfo->nVersion      = 10000;
        pInfo->nIDCode       = PIDCODE('D','B','P','R');
        strcpy_s(pInfo->szName, "DataBridge Pro API Plugin");
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
        if (pNotification->hMainWnd) {
            SetAmiBrokerWindow(pNotification->hMainWnd);
        }
        return 1;
    }

    PLUGINAPI int SetSiteInterface(struct SiteInterface* pInterface) {
        gSite = *pInterface;
        return 1;
    }

    PLUGINAPI int Configure(LPCTSTR pszPath, struct InfoSite *pSite) {
        MessageBoxA(NULL, "DataBridge Pro is active and running.", "DataBridge Pro", MB_OK);
        return 1;
    }

    PLUGINAPI int SetTimeBase(int nTimeBase) {
        return 1;
    }

    PLUGINAPI int GetQuotesEx(LPCTSTR pszTicker, int nPeriodicity, int nLastValid, int nSize, struct Quotation* pQuotes, GQEContext* pContext) {
        __try {
            return DoGetQuotesEx(pszTicker, nPeriodicity, nLastValid, nSize, pQuotes);
        }
        __except(EXCEPTION_EXECUTE_HANDLER) {
            LogPlugin("[PLUGIN_EXCEPTION] GetQuotesEx caught SEH exception");
            return (nLastValid >= 0) ? nLastValid + 1 : 0;
        }
    }
}
