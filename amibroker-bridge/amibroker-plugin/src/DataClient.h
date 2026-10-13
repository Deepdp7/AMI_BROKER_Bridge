#pragma once
#include <string>
#include <vector>
#include <windows.h>

struct Bar {
    double timestamp;
    float open, high, low, close, volume;
};

// Returns number of bars parsed, or -1 if the HTTP request itself failed.
extern int  FetchBarsFromAPI(const std::string& ticker, int limit, double since, std::vector<Bar>& outBars);
extern void StartPollingThread();
extern void StopPollingThread();
extern void UpdateActiveSymbol(const std::string& ticker);
extern void SetAmiBrokerWindow(HWND hWnd);
extern bool GetCachedLiveBar(const std::string& ticker, Bar& outBar);

// ---- History catch-up (bars missed while AmiBroker or the bridge was closed) ----
// True while the IPC socket to the bridge (127.0.0.1:7891) is connected.
extern bool IsBridgeConnected();
// True if this ticker has not been re-synced since the last (re)connect to the bridge,
// or the bridge announced new history for it (SYNC|ticker).
extern bool NeedsHistorySync(const std::string& ticker);
extern void MarkHistorySynced(const std::string& ticker);
// Rate limiter for opportunistic gap checks (live bar skipped minutes). True at most once per 30s per ticker.
extern bool TryBeginGapCheck(const std::string& ticker);
