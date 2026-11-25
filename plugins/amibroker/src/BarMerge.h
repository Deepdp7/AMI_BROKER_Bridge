#pragma once
// The parts of the plugin that need no sockets, threads or AmiBroker calls: merging bars into AmiBroker's
// quotation array, reading the engine's lines, and what is kept of each symbol's recent minutes. Kept apart
// so they can be tested on their own (tests/plugin_tests.cpp).
#include <deque>
#include <string>
#include <string_view>
#include <vector>
#include "Plugin.h"

struct Bar {
    double timestamp;
    float open, high, low, close, volume;
    float oi;   // open interest (F&O), 0 when unknown
};

// ---- Bars into AmiBroker's array ----
double BarMinute(const Bar& b);                          // the bar's minute, unix seconds
double QuotationToUnix(const struct Quotation& q);
double QuotationMinute(const struct Quotation& q);
void WriteBarToQuotation(struct Quotation* pQ, int idx, const Bar& b);
// A daily bar as an end-of-day quotation (the engine stamps the day's midnight, India time)
void WriteEodToQuotation(struct Quotation* pQ, int idx, const Bar& b);

// Merge ascending bars into pQ[0..count): a bar in the same minute as an existing quotation overwrites it
// (broker history correcting live-built candles); bars for minutes AmiBroker does not have are inserted in
// time order, also in the middle of the array. When the array is full the oldest quotations are dropped.
// Returns the new count.
int MergeBars(struct Quotation* pQ, int count, int nSize, const std::vector<Bar>& bars);

// ---- Lines from the engine ----
struct LiveBarLine {
    std::string ticker;
    Bar bar{};
    double sendMs = 0;       // the engine's clock when it wrote the line (unix ms); 0 when the engine did not say
};
// LIVE_BAR|TICKER|ts|open|high|low|close|volume[|oi[|sendMs]]: oi and sendMs come from newer engines, so any
// engine works. False for a line that is not one, or has a number that is not one.
bool ParseLiveBarLine(std::string_view line, LiveBarLine& out);

struct QuoteLine {
    std::string ticker;
    float last = 0, open = 0, high = 0, low = 0, prev = 0, vol = 0, oi = 0, bid = 0, ask = 0;
    double tickSec = 0;
    float bidQty = 0, askQty = 0;
};
// QUOTE|TICKER|last|open|high|low|prev|vol|oi|bid|ask|tickSec[|bidQty|askQty]
bool ParseQuoteLine(std::string_view line, QuoteLine& out);

// ---- What is kept of one symbol's recent minutes ----
// AmiBroker reads a symbol only when a chart, a watch list or a scan asks for it: a symbol nobody looked at
// for a few minutes used to have only its newest bar here, and the minutes in between came back later, in
// one block, from the engine over HTTP. This keeps the newest bar plus the final state of every minute that
// closed since (at most CAPACITY of them), so those minutes are handed over from memory at once.
class RecentBars {
public:
    static const size_t CAPACITY = 120;

    enum Result { Ignored, LiveUpdated, ClosedUpdated };

    // The newest state of a minute, as the engine sends it (the whole minute so far, not a change).
    //   its minute is the newest or newer: it is the live bar; the minute that was live closes into the ring
    //   an earlier minute: a late update of a minute that already closed: replaces it in the ring, or is
    //     added to it if that minute had no bar yet (only for minutes since coverage began)
    Result OnLive(const Bar& b);

    bool HasLive() const { return hasLive_; }
    const Bar& Live() const { return live_; }

    // The closed minutes from `fromMin` (included: AmiBroker's own last bar, to be corrected with its final
    // state) up to `toMin` (excluded), ascending, into `out`. Returns whether the ring is complete for them:
    // every minute after `fromMin` happened while this plugin was receiving, so no minute is missing.
    // Bars from before that time are never handed out: they may have missed ticks.
    bool Between(double fromMin, double toMin, std::vector<Bar>& out) const;

    // The engine connection was lost: the minutes since then were not received, so coverage starts over with
    // the next update that arrives.
    void ResetCoverage() { coveredFromMin_ = 0; }

    double CoveredFromMin() const { return coveredFromMin_; }
    size_t ClosedCount() const { return ring_.size(); }

private:
    void Close(const Bar& b);
    Bar live_{};
    bool hasLive_ = false;
    std::deque<Bar> ring_;           // closed minutes, ascending, one per minute
    double coveredFromMin_ = 0;      // unix seconds; 0 = nothing received yet
};
