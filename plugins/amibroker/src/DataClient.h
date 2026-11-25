#pragma once
#include <string>
#include <vector>
#include <windows.h>
#include "BarMerge.h"   // Bar, and what is kept of each symbol's recent minutes

// The newest `limit` bars after `since` (unix s) and, when `until` > 0, not after `until`.
// Returns number of bars parsed, or -1 if the HTTP request itself failed.
extern int  FetchBarsFromAPI(const std::string& ticker, int limit, double since, double until, std::vector<Bar>& outBars);
// Daily bars of the days before the ticker's 1-minute history (timestamp = the day's midnight,
// India time); same return values
extern int  FetchDailyFromAPI(const std::string& ticker, std::vector<Bar>& outBars);
// AmiBroker's "Allow mixed EOD/intraday data" for the loaded database
extern void SetMixedEod(bool allowed);
extern bool MixedEodAllowed();
// Appends the bars of "tsSec,open,high,low,close,volume[,oi]" lines in [p, end) to out
extern void ParseBarsCsv(const char* p, const char* end, std::vector<Bar>& out);
extern void StartPollingThread();
extern void StopPollingThread();
extern void UpdateActiveSymbol(const std::string& ticker);
extern void SetAmiBrokerWindow(HWND hWnd);
extern bool GetCachedLiveBar(const std::string& ticker, Bar& outBar);
// The closed minutes from `fromMin` (included) to `toMin` (excluded) that were received live, ascending, added
// to `out`. True when none can be missing: every minute after `fromMin` happened while the engine was connected.
extern bool GetCachedBarsBetween(const std::string& ticker, double fromMin, double toMin, std::vector<Bar>& out);
// The Real-time Quote window's figures for a ticker: the day's (QUOTE| from the engine), the live
// bar's price when no quote came yet. False when nothing is known.
struct RecentInfo;
extern bool FillRecentInfo(const std::string& ticker, RecentInfo& ri);
// Symbols with a live bar from `sinceSec` (unix seconds) on
extern int LiveSymbolCount(double sinceSec);
// The database's "Number of bars" as last reported by AmiBroker (0 = not known yet)
extern int GetDatabaseBars();

// ---- The DataBridge light in AmiBroker's status bar and its right-click menu ----
// level: 0 green, 1 yellow, 2 red, -1 DataBridge Pro not running
extern void GetBridgeStatus(int& level, std::string& shortMsg, std::string& longMsg);
// One command line to the engine ("CMD|REPAIR|TCS"); false when it isn't connected
extern bool SendToBridge(const std::string& line);
// Brings the DataBridge Pro window forward (starts it when it isn't running)
extern void ShowDataBridge();
extern void CloseHttpSession();

// ---- How long the plugin's own steps take (reported to the engine once a minute: NOTE|PERF) ----
// One GetQuotesEx call: fastPath = AmiBroker had bars already (live update), otherwise a symbol load
extern void PerfRecordGetQuotes(bool fastPath, double micros);

// ---- Keeping AmiBroker from waiting on DataBridge ----
// Loading a symbol's history on AmiBroker's own thread: all of them pause for a while after one failed or
// timed out (engine busy or gone)
extern bool CatchUpAllowed();
extern void CatchUpFailed();
// Background catch-ups: a symbol whose fetch failed waits 2 s, then twice as long up to 60 s; only three
// failures in a row pause everything (CatchUpFailed)
extern bool CatchUpAllowedFor(const std::string& ticker);
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
// Starts a catch-up fetch: returns what the bridge announced for this ticker since it last synced
// (a range to fetch, or only a start) and the announcement epoch it belongs to.
extern SyncRange BeginHistorySync(const std::string& ticker, unsigned& epoch);
// Marks the ticker synced, unless the bridge announced more history after BeginHistorySync.
extern void MarkHistorySynced(const std::string& ticker, unsigned epoch);
// Rate limiter for opportunistic gap checks (live bar skipped minutes). True at most once per 30s per ticker.
extern bool TryBeginGapCheck(const std::string& ticker);

// ---- Catch-up downloads, off AmiBroker's thread ----
// What a background catch-up brought back, and what it was for
struct CatchUpResult {
    std::vector<Bar> bars;
    int got = 0;            // bars fetched, -1 when the request failed
    unsigned epoch = 0;     // BeginHistorySync's epoch (full syncs)
    bool fullSync = false;
    bool gapCheck = false;
    double sinceMin = 0;    // AmiBroker's last minute when it was asked for (gap checks)
};
// Queues a fetch of the ticker's bars after `from` (unix s) and, when `until` > 0, up to it; false when one is
// already on its way
extern bool RequestCatchUp(const std::string& ticker, double from, double until, int limit, const CatchUpResult& info);
// The fetched bars, once (true), to merge into AmiBroker's array
extern bool TakeCatchUpResult(const std::string& ticker, CatchUpResult& out);
// AmiBroker asked for this symbol: told to the engine (at most every 15 s), which gives a
// broker's live places to the symbols on screen first
extern void ReportViewed(const std::string& ticker);
