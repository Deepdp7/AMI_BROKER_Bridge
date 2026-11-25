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
#include "BarMerge.h"
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

static int DoGetQuotesExImpl(LPCTSTR pszTicker, int nPeriodicity, int nLastValid, int nSize, struct Quotation* pQuotes) {
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
        // The engine gives live places to the symbols AmiBroker shows (plans with few of them)
        ReportViewed(pszTicker);

        // --- CATCH-UP: bars AmiBroker missed, fetched in the background ---
        // AmiBroker keeps its own local database, so after AmiBroker or the bridge was
        // closed it already has bars (nLastValid >= 0) but nothing for the downtime.
        // Re-sync once per bridge connection, when the bridge reports new history
        // (SYNC|ticker), or when the live bar jumps over minutes we never received. The fetch
        // runs on the plugin's own thread (RequestCatchUp); what it brought is merged here, in a
        // later call. AmiBroker never waits for the engine here.
        CatchUpResult done;
        if (TakeCatchUpResult(pszTicker, done) && done.got >= 0) {
            if (done.fullSync) MarkHistorySynced(pszTicker, done.epoch);
            int count = MergeBars(pQuotes, nLastValid + 1, nSize, done.bars);
            if (done.gapCheck) GapCheckResult(pszTicker, done.sinceMin, count != nLastValid + 1);
            if (count != nLastValid + 1) {
                char logBuf[160];
                sprintf_s(logBuf, "[SYNC] %s caught up %d missed bar(s)", pszTicker, count - (nLastValid + 1));
                LogPlugin(logBuf);
            }
            // The live bar below goes on top of what was merged
            nLastValid = count - 1;
            startIndex = count;
            since = count > 0 ? QuotationToUnix(pQuotes[nLastValid]) : 0;
        }

        Bar live; memset(&live, 0, sizeof(Bar));
        bool hasLive = GetCachedLiveBar(pszTicker, live) && live.timestamp > 0 && live.close > 0;
        double liveMin  = hasLive ? floor(live.timestamp / 60.0) * 60.0 : 0;
        double sinceMin = floor(since / 60.0) * 60.0;

        // The minutes that closed since AmiBroker's last bar, from memory: this plugin has been receiving them
        // live. AmiBroker's own last minute is among them, with its final values (the next minute may have
        // started before AmiBroker read its last ticks). `covered`: no minute in between can be missing, so
        // nothing needs asking the engine.
        std::vector<Bar> closed;
        bool covered = hasLive && liveMin > sinceMin && GetCachedBarsBetween(pszTicker, sinceMin, liveMin, closed);

        // None of this while DataBridge isn't answering (CatchUpAllowed). A gap check that
        // found nothing (minutes without trades) isn't repeated until AmiBroker's last bar
        // moves on.
        bool liveSkipsMinutes = hasLive && liveMin > sinceMin + 60;
        bool canCatchUp = nLastValid >= 0 && IsBridgeConnected() && CatchUpAllowed();
        bool fullSync = canCatchUp && NeedsHistorySync(pszTicker);
        bool gapCheck = !fullSync && canCatchUp && liveSkipsMinutes && !covered && GapCheckWorthIt(pszTicker, sinceMin) && TryBeginGapCheck(pszTicker);
        if (fullSync || gapCheck) {
            CatchUpResult want;
            double announced = BeginHistorySync(pszTicker, want.epoch);
            want.fullSync = fullSync;
            want.gapCheck = gapCheck;
            want.sinceMin = sinceMin;
            // Full sync (reconnect / bridge announced new history): re-fetch the last 24h so
            // broker-corrected candles overwrite live-built ones, or from the oldest bar the
            // bridge announced if that is earlier (a downtime hole behind newer live bars).
            // Gap check: just the tail; since-1 so the server also re-sends AmiBroker's last
            // (possibly partial) candle.
            double from = fullSync ? since - 86400 : since - 1;
            if (fullSync && announced > 0 && announced - 60 < from) from = announced - 60;
            RequestCatchUp(pszTicker, from > 0 ? from : 0, nSize, want);
        }
        if (nLastValid < 0) return 0;

        if (hasLive) {
            if (liveMin == sinceMin) {
                // Update last bar in-place (same candle, price moved)
                WriteBarToQuotation(pQuotes, nLastValid, live);
                return nLastValid + 1;
            } else if (liveMin > sinceMin) {
                // New minute candle (MergeBars shifts out the oldest bar if the array is full): the closed
                // minutes since AmiBroker's last bar, then the live one
                closed.push_back(live);
                return MergeBars(pQuotes, startIndex, nSize, closed);
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
    // Mixed EOD/intraday database: the years before the 1-minute history as daily bars, first
    int dailyCount = 0;
    if (MixedEodAllowed()) {
        std::vector<Bar> daily;
        if (FetchDailyFromAPI(pszTicker, daily) > 0) {
            // Room for all the 1-minute bars first; the oldest days go if the database is too small
            int room = nSize - (int)outBars.size();
            size_t skip = room <= 0 ? daily.size() : daily.size() > (size_t)room ? daily.size() - (size_t)room : 0;
            for (size_t i = skip; i < daily.size(); i++) {
                if (!(daily[i].close > 0)) continue;
                WriteEodToQuotation(pQuotes, dailyCount++, daily[i]);
            }
        }
    }
    int count = MergeBars(pQuotes, dailyCount, nSize, outBars);

    char logBuf[128];
    sprintf_s(logBuf, "[GQE] %s nLV=%d returned=%d", pszTicker, nLastValid, count);
    LogPlugin(logBuf);

    return count;
}

// Times each call: how long AmiBroker's own thread spends in this plugin (the numbers go to the engine once a minute)
static int DoGetQuotesEx(LPCTSTR pszTicker, int nPeriodicity, int nLastValid, int nSize, struct Quotation* pQuotes) {
    static LARGE_INTEGER freq = [] { LARGE_INTEGER f; QueryPerformanceFrequency(&f); return f; }();
    LARGE_INTEGER t0, t1;
    QueryPerformanceCounter(&t0);
    int result = DoGetQuotesExImpl(pszTicker, nPeriodicity, nLastValid, nSize, pQuotes);
    QueryPerformanceCounter(&t1);
    PerfRecordGetQuotes(nLastValid >= 0, (double)(t1.QuadPart - t0.QuadPart) * 1e6 / (double)freq.QuadPart);
    return result;
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
    if ((pNotification->nReason & (REASON_DATABASE_LOADED | REASON_SETTINGS_CHANGE)) && pNotification->pWorkspace) {
        SetDatabaseBars(pNotification->pWorkspace->NumBars);
        SetMixedEod(pNotification->pWorkspace->AllowMixedEODIntra != FALSE);
    }
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

extern "C++" {
// ---- File > Database Settings > Configure ----
// What DataBridge Pro is doing right now, the AmiBroker settings it needs, and the actions of the
// status light's menu. Brokers, symbols and history depth are set in the DataBridge Pro app.
enum { CFG_OPEN = 101, CFG_TODAY_ALL, CFG_CLOSE, CFG_STATUS, CFG_TIMER = 1 };
static const int ONE_YEAR_OF_MINUTES = 94000;   // ~250 sessions x 375 one-minute bars (NSE)

static std::string ConfigStatusText() {
    int level; std::string shortMsg, longMsg;
    GetBridgeStatus(level, shortMsg, longMsg);
    const char* light = level == 0 ? "Green" : level == 1 ? "Yellow" : level == 2 ? "Red" : "Grey";
    std::string s = std::string("Status: ") + light + " - " + shortMsg + "\r\n" + longMsg + "\r\n\r\n";
    int live = level >= 0 ? LiveSymbolCount((double)time(NULL) - 120) : 0;
    s += "Symbols with live prices in the last 2 minutes: " + std::to_string(live) + "\r\n";
    int bars = GetDatabaseBars();
    s += "This database keeps: " + (bars > 0 ? std::to_string(bars) + " bars per symbol" : std::string("(not reported yet)"));
    if (bars > 0 && bars < ONE_YEAR_OF_MINUTES) s += "  - less than a year of 1-minute bars";
    return s;
}

static const char* CONFIG_HELP =
    "DataBridge Pro brings your broker's prices and history to AmiBroker. Brokers, symbols and how many "
    "years of history to download are set in the DataBridge Pro app on this PC.\r\n\r\n"
    "Settings this database needs (File > Database Settings):\r\n"
    "  - Base time interval: 1 minute\r\n"
    "  - Number of bars: 100000 or more for a year of 1-minute history\r\n"
    "  - Intraday settings: time shift 0 (prices arrive in India time)\r\n"
    "  - Allow mixed EOD/intraday data: tick it for daily bars from the years before the\r\n"
    "    1-minute history (stocks and indices; re-open a chart to load them)\r\n\r\n"
    "Right-click the DataBridge light in the status bar for one symbol's history repair.";

static LRESULT CALLBACK ConfigWndProc(HWND hWnd, UINT msg, WPARAM wp, LPARAM lp) {
    switch (msg) {
    case WM_TIMER:
        SetDlgItemTextA(hWnd, CFG_STATUS, ConfigStatusText().c_str());
        return 0;
    case WM_COMMAND:
        switch (LOWORD(wp)) {
        case CFG_OPEN: ShowDataBridge(); return 0;
        case CFG_TODAY_ALL:
            if (!SendToBridge("CMD|TODAY_ALL"))
                MessageBoxA(hWnd, "DataBridge Pro is not running.", "DataBridge Pro", MB_OK | MB_ICONINFORMATION);
            else
                MessageBoxA(hWnd, "Today's bars of every symbol are being downloaded again. Open charts update when they arrive.",
                            "DataBridge Pro", MB_OK | MB_ICONINFORMATION);
            return 0;
        case CFG_CLOSE: case IDCANCEL: DestroyWindow(hWnd); return 0;
        }
        break;
    case WM_CLOSE: DestroyWindow(hWnd); return 0;
    case WM_DESTROY: KillTimer(hWnd, CFG_TIMER); return 0;
    }
    return DefWindowProcA(hWnd, msg, wp, lp);
}

}  // extern "C++"

EXTERN_C IMAGE_DOS_HEADER __ImageBase;

PLUGINAPI int Configure(LPCTSTR pszPath, struct InfoSite* pSite) {
    HINSTANCE hInst = (HINSTANCE)&__ImageBase;
    static bool registered = false;
    if (!registered) {
        WNDCLASSA wc = {};
        wc.lpfnWndProc = ConfigWndProc;
        wc.hInstance = hInst;
        wc.hCursor = LoadCursor(NULL, IDC_ARROW);
        wc.hbrBackground = (HBRUSH)(COLOR_BTNFACE + 1);
        wc.lpszClassName = "DataBridgeProConfig";
        registered = RegisterClassA(&wc) != 0 || GetLastError() == ERROR_CLASS_ALREADY_EXISTS;
    }
    HWND owner = GetActiveWindow();

    // Sizes in dialog-like units scaled to the screen's DPI
    HDC dc = GetDC(NULL);
    int dpi = dc ? GetDeviceCaps(dc, LOGPIXELSY) : 96;
    if (dc) ReleaseDC(NULL, dc);
    auto S = [dpi](int v) { return MulDiv(v, dpi, 96); };
    NONCLIENTMETRICSA ncm = {}; ncm.cbSize = sizeof(ncm);
    SystemParametersInfoA(SPI_GETNONCLIENTMETRICS, sizeof(ncm), &ncm, 0);
    HFONT font = CreateFontIndirectA(&ncm.lfMessageFont);

    const int W = S(560), H = S(430), M = S(14);
    RECT r = { 0, 0, W, H };
    DWORD style = WS_POPUP | WS_CAPTION | WS_SYSMENU;
    AdjustWindowRectEx(&r, style, FALSE, WS_EX_DLGMODALFRAME);
    RECT ownerRect = {};
    if (owner) GetWindowRect(owner, &ownerRect);
    int x = owner ? ownerRect.left + ((ownerRect.right - ownerRect.left) - (r.right - r.left)) / 2 : CW_USEDEFAULT;
    int y = owner ? ownerRect.top + ((ownerRect.bottom - ownerRect.top) - (r.bottom - r.top)) / 2 : CW_USEDEFAULT;
    HWND hWnd = CreateWindowExA(WS_EX_DLGMODALFRAME, "DataBridgeProConfig", "DataBridge Pro", style,
                                x, y, r.right - r.left, r.bottom - r.top, owner, NULL, hInst, NULL);
    if (!hWnd) { if (font) DeleteObject(font); return 0; }

    auto add = [&](const char* cls, const char* text, DWORD st, int id, int cx, int cy, int cw, int ch) {
        HWND c = CreateWindowExA(0, cls, text, WS_CHILD | WS_VISIBLE | st, cx, cy, cw, ch, hWnd, (HMENU)(INT_PTR)id, hInst, NULL);
        if (c && font) SendMessageA(c, WM_SETFONT, (WPARAM)font, TRUE);
        return c;
    };
    add("STATIC", ConfigStatusText().c_str(), SS_LEFT, CFG_STATUS, M, M, W - 2 * M, S(110));
    add("STATIC", "", SS_ETCHEDHORZ, 0, M, S(132), W - 2 * M, 2);
    add("STATIC", CONFIG_HELP, SS_LEFT, 0, M, S(144), W - 2 * M, S(200));
    const int bh = S(28), by = H - M - bh;
    add("BUTTON", "Open DataBridge Pro", BS_PUSHBUTTON | WS_TABSTOP, CFG_OPEN, M, by, S(160), bh);
    add("BUTTON", "Refresh today's bars (all)", BS_PUSHBUTTON | WS_TABSTOP, CFG_TODAY_ALL, M + S(170), by, S(200), bh);
    add("BUTTON", "Close", BS_DEFPUSHBUTTON | WS_TABSTOP, CFG_CLOSE, W - M - S(100), by, S(100), bh);
    SetTimer(hWnd, CFG_TIMER, 1000, NULL);

    // Modal: AmiBroker's window waits until this one closes
    if (owner) EnableWindow(owner, FALSE);
    ShowWindow(hWnd, SW_SHOW);
    MSG m;
    while (IsWindow(hWnd) && GetMessageA(&m, NULL, 0, 0) > 0) {
        if (!IsDialogMessageA(hWnd, &m)) { TranslateMessage(&m); DispatchMessageA(&m); }
    }
    if (owner) { EnableWindow(owner, TRUE); SetForegroundWindow(owner); }
    if (font) DeleteObject(font);
    return 1;
}

PLUGINAPI int SetTimeBase(int nTimeBase) {
    return 1;
}

PLUGINAPI struct RecentInfo* GetRecentInfo(LPCTSTR pszTicker) {
    if (!pszTicker) return NULL;
    if (!FillRecentInfo(pszTicker, g_recentInfoBuf)) return NULL;
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
