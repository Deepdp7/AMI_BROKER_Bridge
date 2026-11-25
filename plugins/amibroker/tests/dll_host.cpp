// A stand-in for AmiBroker, to try a built DataBridgePro.dll against an engine (the perf harness with
// --real-ports, or the real one): loads the DLL, gives it a window, calls GetQuotesEx for some symbols once a
// second and again on every notice (as AmiBroker does for the symbols it shows), and says at the end how many
// notices arrived and how far apart. The DLL's own timings (NOTE|PERF) go to the engine and to its log.
//
//   build-dll-host.bat
//   build\dll_host.exe <path to DataBridgePro.dll> <seconds> <TICKER,TICKER,...>
// A ticker written late:TICKER is read in the first 20 s and the last 8 s only, like a symbol nobody looked at for
// minutes: what comes back for it at the end is what the plugin kept in memory (check the plugin log for a
// "[SYNC] TICKER caught up" line: that would mean the engine had to be asked).
//
// Must be built 32-bit, like the DLL (AmiBroker is 32-bit): the .bat does that.
#ifndef WIN32_LEAN_AND_MEAN
#define WIN32_LEAN_AND_MEAN
#endif
#include <algorithm>
#include <math.h>
#include <stdio.h>
#include <stdlib.h>
#include <time.h>
#include <string>
#include <vector>
#include "BarMerge.h"

typedef int (*GetPluginInfoFn)(struct PluginInfo*);
typedef int (*InitFn)(void);
typedef int (*ReleaseFn)(void);
typedef int (*NotifyFn)(struct PluginNotification*);
typedef int (*GetQuotesExFn)(LPCTSTR, int, int, int, struct Quotation*, GQEContext*);

static const int NSIZE = 20000;

struct Series { std::string ticker; std::vector<Quotation> q; int lastValid = 0; double lastClose = 0; unsigned changes = 0; bool late = false; };
static std::vector<Series> g_series;
static GetQuotesExFn g_getQuotes = nullptr;
static LARGE_INTEGER g_freq;
static std::vector<double> g_noticeAtMs;       // when each notice arrived (ms since start)
static double g_gqeTotalMs = 0; static unsigned g_gqeCalls = 0;

static double NowMs() { LARGE_INTEGER t; QueryPerformanceCounter(&t); return (double)t.QuadPart * 1000.0 / (double)g_freq.QuadPart; }

static double g_start = 0, g_seconds = 0;
static bool LateReadsOpen() { double t = NowMs() - g_start; return t < 20000 || t > g_seconds * 1000 - 8000; }

static void ReadAll() {
    for (Series& s : g_series) {
        if (s.late && !LateReadsOpen()) continue;
        double t0 = NowMs();
        int n = g_getQuotes(s.ticker.c_str(), 0, s.lastValid, NSIZE, s.q.data(), nullptr);
        g_gqeTotalMs += NowMs() - t0; g_gqeCalls++;
        if (n > 0) {
            s.lastValid = n - 1;
            double close = s.q[s.lastValid].Price;
            if (close != s.lastClose) { s.lastClose = close; s.changes++; }
        }
    }
}

static const UINT WM_STREAMING = WM_USER + 13000;     // WM_USER_STREAMING_UPDATE

static LRESULT CALLBACK HostWndProc(HWND h, UINT m, WPARAM w, LPARAM l) {
    if (m == WM_STREAMING) {
        g_noticeAtMs.push_back(NowMs() - g_start);
        ReadAll();                                    // AmiBroker asks for the symbols it shows after each notice
        return 1;
    }
    return DefWindowProcA(h, m, w, l);
}

int main(int argc, char** argv) {
    if (argc < 4) { printf("usage: dll_host <DataBridgePro.dll> <seconds> <TICKER,TICKER,...>\n"); return 2; }
    QueryPerformanceFrequency(&g_freq);
    HMODULE dll = LoadLibraryA(argv[1]);
    if (!dll) { printf("could not load %s (error %lu): is it 32-bit, like this program?\n", argv[1], GetLastError()); return 2; }
    auto init = (InitFn)GetProcAddress(dll, "Init");
    auto release = (ReleaseFn)GetProcAddress(dll, "Release");
    auto notify = (NotifyFn)GetProcAddress(dll, "Notify");
    g_getQuotes = (GetQuotesExFn)GetProcAddress(dll, "GetQuotesEx");
    if (!init || !release || !notify || !g_getQuotes) { printf("the DLL lacks Init, Release, Notify or GetQuotesEx\n"); return 2; }

    double seconds = atof(argv[2]);
    g_seconds = seconds;
    std::string list = argv[3];
    for (size_t from = 0; from <= list.size();) {
        size_t comma = list.find(',', from);
        std::string t = list.substr(from, comma == std::string::npos ? std::string::npos : comma - from);
        bool late = t.rfind("late:", 0) == 0;
        if (late) t = t.substr(5);
        if (!t.empty()) { Series sr; sr.ticker = t; sr.late = late; g_series.push_back(std::move(sr)); }
        if (comma == std::string::npos) break;
        from = comma + 1;
    }

    WNDCLASSA wc = {}; wc.lpfnWndProc = HostWndProc; wc.hInstance = GetModuleHandleA(NULL); wc.lpszClassName = "DbpDllHost";
    RegisterClassA(&wc);
    HWND hwnd = CreateWindowA("DbpDllHost", "DataBridge DLL host", WS_OVERLAPPED, 0, 0, 10, 10, NULL, NULL, wc.hInstance, NULL);

    // Each symbol starts with one bar five minutes old, as a chart that was last drawn a few minutes ago
    double now = (double)time(NULL);
    for (Series& s : g_series) {
        s.q.assign(NSIZE, Quotation{});
        Bar b{}; b.timestamp = floor(now / 60.0) * 60.0 - 300.0; b.open = b.high = b.low = b.close = 1; b.volume = 1;
        WriteBarToQuotation(s.q.data(), 0, b);
        s.lastValid = 0;
    }

    init();
    PluginNotification pn = {}; pn.nStructSize = sizeof(pn); pn.nReason = REASON_DATABASE_LOADED; pn.hMainWnd = hwnd;
    notify(&pn);
    printf("host: %zu symbols, %.0f s\n", g_series.size(), seconds);

    g_start = NowMs();
    double nextRead = 1000;
    while (NowMs() - g_start < seconds * 1000) {
        MsgWaitForMultipleObjects(0, NULL, FALSE, 10, QS_ALLINPUT);
        MSG msg;
        while (PeekMessageA(&msg, NULL, 0, 0, PM_REMOVE)) { TranslateMessage(&msg); DispatchMessageA(&msg); }
        if (NowMs() - g_start >= nextRead) { ReadAll(); nextRead += 1000; }
    }

    std::vector<double> gaps;
    for (size_t i = 1; i < g_noticeAtMs.size(); i++) gaps.push_back(g_noticeAtMs[i] - g_noticeAtMs[i - 1]);
    std::sort(gaps.begin(), gaps.end());
    auto pct = [&](double p) { return gaps.empty() ? 0.0 : gaps[(size_t)((gaps.size() - 1) * p)]; };
    printf("notices: %zu (%.1f a second)\n", g_noticeAtMs.size(), g_noticeAtMs.size() / seconds);
    printf("gap between notices ms: min %.1f  p50 %.1f  p95 %.1f  max %.1f\n", gaps.empty() ? 0.0 : gaps.front(), pct(0.5), pct(0.95), gaps.empty() ? 0.0 : gaps.back());
    printf("GetQuotesEx: %u calls, %.3f ms each on average\n", g_gqeCalls, g_gqeCalls ? g_gqeTotalMs / g_gqeCalls : 0.0);
    for (const Series& s : g_series) printf("  %-18s bars %d, close %.2f, changed %u times%s\n", s.ticker.c_str(), s.lastValid + 1, s.lastClose, s.changes, s.late ? "  (read late)" : "");
    release();
    return 0;
}
