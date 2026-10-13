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

// Index of the quotation in pQ[0..count) whose minute equals `minute`, or -1 (binary search).
static int FindQuotationByMinute(const struct Quotation* pQ, int count, double minute) {
    int lo = 0, hi = count - 1;
    while (lo <= hi) {
        int mid = (lo + hi) / 2;
        double m = floor(QuotationToUnix(pQ[mid]) / 60.0) * 60.0;
        if (m == minute) return mid;
        if (m < minute) lo = mid + 1; else hi = mid - 1;
    }
    return -1;
}

// Merge ascending bars into pQ[0..count): a bar in the same minute as an existing
// quotation overwrites it (broker history correcting live-built candles), newer bars are
// appended, and older bars with no matching quotation are ignored. When the array is
// full the oldest quotations are shifted out. Returns the new number of valid quotations.
static int MergeBars(struct Quotation* pQ, int count, int nSize, const std::vector<Bar>& bars) {
    double lastMin = count > 0 ? floor(QuotationToUnix(pQ[count - 1]) / 60.0) * 60.0 : -1;
    std::vector<const Bar*> fresh;
    for (const Bar& b : bars) {
        if (b.timestamp <= 0 || b.close <= 0) continue;
        double bMin = floor(b.timestamp / 60.0) * 60.0;
        if (bMin < lastMin) {
            int idx = FindQuotationByMinute(pQ, count, bMin);
            if (idx >= 0) WriteBarToQuotation(pQ, idx, b);
            continue;
        }
        if (bMin == lastMin) {
            if (!fresh.empty()) fresh.back() = &b;
            else if (count > 0) WriteBarToQuotation(pQ, count - 1, b);
            continue;
        }
        fresh.push_back(&b);
        lastMin = bMin;
    }
    if (fresh.empty()) return count;

    if (fresh.size() > (size_t)nSize) fresh.erase(fresh.begin(), fresh.end() - nSize);
    int overflow = count + (int)fresh.size() - nSize;
    if (overflow > 0) {
        memmove(pQ, pQ + overflow, (size_t)(count - overflow) * sizeof(struct Quotation));
        count -= overflow;
    }
    for (const Bar* b : fresh) WriteBarToQuotation(pQ, count++, *b);
    return count;
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
        bool liveSkipsMinutes = hasLive && liveMin > sinceMin + 60;
        bool fullSync = IsBridgeConnected() && NeedsHistorySync(pszTicker);
        if (fullSync || (IsBridgeConnected() && liveSkipsMinutes && TryBeginGapCheck(pszTicker))) {
            std::vector<Bar> missed;
            // Full sync (reconnect / bridge announced new history): re-fetch the last 24h so
            // broker-corrected candles overwrite live-built ones. Gap check: just the tail;
            // since-1 so the server also re-sends AmiBroker's last (possibly partial) candle.
            double from = fullSync ? since - 86400 : since - 1;
            int got = FetchBarsFromAPI(pszTicker, nSize, from > 0 ? from : 0, missed);
            if (got >= 0) {
                MarkHistorySynced(pszTicker);
                int count = MergeBars(pQuotes, nLastValid + 1, nSize, missed);
                if (count != nLastValid + 1) {
                    char logBuf[160];
                    sprintf_s(logBuf, "[SYNC] %s caught up %d missed bar(s)", pszTicker, count - (nLastValid + 1));
                    LogPlugin(logBuf);
                }
                return count;
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
    std::vector<Bar> outBars;
    if (FetchBarsFromAPI(pszTicker, nSize, since, outBars) <= 0) return 0;
    MarkHistorySynced(pszTicker);

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
