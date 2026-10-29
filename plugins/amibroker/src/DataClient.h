#pragma once
#include <string>
#include <vector>
#include <windows.h>

struct Bar {
    double timestamp;
    float open, high, low, close, volume;
    float oi;   // open interest (F&O), 0 when unknown
};

// Returns number of bars parsed, or -1 if the HTTP request itself failed.
extern int  FetchBarsFromAPI(const std::string& ticker, int limit, double since, std::vector<Bar>& outBars);
// Appends the bars of "tsSec,open,high,low,close,volume[,oi]" lines in [p, end) to out
extern void ParseBarsCsv(const char* p, const char* end, std::vector<Bar>& out);
extern void StartPollingThread();
extern void StopPollingThread();
extern void UpdateActiveSymbol(const std::string& ticker);
extern void SetAmiBrokerWindow(HWND hWnd);
extern bool GetCachedLiveBar(const std::string& ticker, Bar& outBar);

// ---- The DataBridge light in AmiBroker's status bar and its right-click menu ----
// level: 0 green, 1 yellow, 2 red, -1 DataBridge Pro not running
extern void GetBridgeStatus(int& level, std::string& shortMsg, std::string& longMsg);
// One command line to the engine ("CMD|REPAIR|TCS"); false when it isn't connected
extern bool SendToBridge(const std::string& line);
// Brings the DataBridge Pro window forward (starts it when it isn't running)
extern void ShowDataBridge();
extern void CloseHttpSession();

// ---- Keeping AmiBroker from waiting on DataBridge ----
// Catch-up fetches pause for a while after one failed or timed out (engine busy or gone)
extern bool CatchUpAllowed();
extern void CatchUpFailed();
// A gap check that found nothing is not repeated until AmiBroker's last bar moves on
extern bool GapCheckWorthIt(const std::string& ticker, double sinceMin);
extern void GapCheckResult(const std::string& ticker, double sinceMin, bool foundBars);
// Full loads, to notice AmiBroker reloading the same symbols again and again
extern void NoteFullLoad(const std::string& ticker);
// The database's "Number of bars" (File > Database Settings), for that note
extern void SetDatabaseBars(int numBars);

// ---- History catch-up (bars missed while AmiBroker or the bridge was closed) ----
// True while the IPC socket to the bridge (127.0.0.1:7891) is connected.
extern bool IsBridgeConnected();
// IsBridgeConnected, waiting up to maxMs for it in the first seconds after AmiBroker started
extern bool WaitForBridge(DWORD maxMs);
// True if this ticker has not been re-synced since the last (re)connect to the bridge,
// or the bridge announced new history for it (SYNC|ticker[|fromSec]).
extern bool NeedsHistorySync(const std::string& ticker);
// Starts a catch-up fetch: returns the oldest bar time the bridge announced for this ticker
// (0 if none) and the announcement epoch it belongs to.
extern double BeginHistorySync(const std::string& ticker, unsigned& epoch);
// Marks the ticker synced, unless the bridge announced more history after BeginHistorySync.
extern void MarkHistorySynced(const std::string& ticker, unsigned epoch);
// Rate limiter for opportunistic gap checks (live bar skipped minutes). True at most once per 30s per ticker.
extern bool TryBeginGapCheck(const std::string& ticker);
