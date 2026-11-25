// Tests of the plugin's pure parts (BarMerge): merging bars into AmiBroker's array, the engine's lines, and
// the recent minutes kept per symbol. A plain program: prints each failure, exits 1 if there was any.
//   plugins\amibroker\tests\build-tests.bat   (npm run test:plugin)
#ifndef WIN32_LEAN_AND_MEAN
#define WIN32_LEAN_AND_MEAN
#endif
#include <stdio.h>
#include <string.h>
#include <string>
#include <vector>
#include "BarMerge.h"

static int g_checks = 0, g_failed = 0;
#define CHECK(cond) do { g_checks++; if (!(cond)) { g_failed++; printf("  FAIL %s:%d  %s\n", __FILE__, __LINE__, #cond); } } while (0)
#define SECTION(name) printf("%s\n", name)

// A minute, in unix seconds. 1788000000 is a whole number of minutes.
static const double BASE = 1788000000.0;
static double Min(int n) { return BASE + 60.0 * n; }

static Bar MkBar(int minute, float o, float h, float l, float c, float v, float oi = 0, double secIntoMinute = 0) {
    Bar b{}; b.timestamp = Min(minute) + secIntoMinute; b.open = o; b.high = h; b.low = l; b.close = c; b.volume = v; b.oi = oi;
    return b;
}
static Bar Px(int minute, float price) { return MkBar(minute, price, price, price, price, 1); }

// ---- MergeBars ----
static std::vector<Quotation> Quotes(std::initializer_list<Bar> bars) {
    std::vector<Quotation> q(bars.size() + 64);
    int i = 0;
    for (const Bar& b : bars) WriteBarToQuotation(q.data(), i++, b);
    return q;
}

static void TestMerge() {
    SECTION("MergeBars");
    {   // a new minute is appended
        auto q = Quotes({ Px(0, 10), Px(1, 11) });
        int n = MergeBars(q.data(), 2, (int)q.size(), { Px(2, 12) });
        CHECK(n == 3);
        CHECK(QuotationMinute(q[2]) == Min(2) && q[2].Price == 12);
    }
    {   // the same minute is overwritten, including the values AmiBroker had from before the last ticks
        auto q = Quotes({ Px(0, 10), MkBar(1, 11, 11.5f, 10.5f, 11.2f, 100) });
        int n = MergeBars(q.data(), 2, (int)q.size(), { MkBar(1, 11, 12, 10.5f, 11.9f, 250, 7) });
        CHECK(n == 2);
        CHECK(q[1].High == 12 && q[1].Price == 11.9f && q[1].Volume == 250 && q[1].OpenInterest == 7);
    }
    {   // a hole behind newer bars is filled in place, order kept
        auto q = Quotes({ Px(0, 10), Px(1, 11), Px(5, 15), Px(6, 16) });
        int n = MergeBars(q.data(), 4, (int)q.size(), { Px(2, 12), Px(3, 13), Px(4, 14) });
        CHECK(n == 7);
        for (int i = 0; i < 7; i++) CHECK(QuotationMinute(q[i]) == Min(i) && q[i].Price == 10 + (float)i);
    }
    {   // the array is full: the oldest are dropped
        std::vector<Quotation> q(3);
        WriteBarToQuotation(q.data(), 0, Px(0, 10)); WriteBarToQuotation(q.data(), 1, Px(1, 11)); WriteBarToQuotation(q.data(), 2, Px(2, 12));
        int n = MergeBars(q.data(), 3, 3, { Px(3, 13), Px(4, 14) });
        CHECK(n == 3);
        CHECK(QuotationMinute(q[0]) == Min(2) && QuotationMinute(q[2]) == Min(4));
    }
    {   // out-of-order input and invalid bars are ignored
        auto q = Quotes({ Px(0, 10) });
        int n = MergeBars(q.data(), 1, (int)q.size(), { Px(3, 13), Px(2, 99), MkBar(4, 0, 0, 0, 0, 0), Px(5, 15) });
        CHECK(n == 3);
        CHECK(QuotationMinute(q[1]) == Min(3) && QuotationMinute(q[2]) == Min(5));
    }
    {   // nothing to merge
        auto q = Quotes({ Px(0, 10) });
        CHECK(MergeBars(q.data(), 1, (int)q.size(), {}) == 1);
    }
}

// ---- The engine's lines ----
static void TestParser() {
    SECTION("LIVE_BAR lines");
    LiveBarLine l;
    CHECK(ParseLiveBarLine("LIVE_BAR|RELIANCE|1788000060|2858.4|2860|2857.5|2859.1|1200", l));
    CHECK(l.ticker == "RELIANCE" && l.bar.timestamp == 1788000060.0 && l.bar.open == 2858.4f && l.bar.high == 2860.0f);
    CHECK(l.bar.low == 2857.5f && l.bar.close == 2859.1f && l.bar.volume == 1200.0f && l.bar.oi == 0 && l.sendMs == 0);

    CHECK(ParseLiveBarLine("LIVE_BAR|NIFTY26NOVFUT|1788000060|1|2|0.5|1.5|1e+06|7500", l));          // 9 fields: an engine from before sendMs
    CHECK(l.bar.volume == 1000000.0f && l.bar.oi == 7500.0f && l.sendMs == 0);

    CHECK(ParseLiveBarLine("LIVE_BAR|M&M|1788000060|1|2|1|2|5|0|1788000061234", l));                 // 10 fields: the current engine
    CHECK(l.ticker == "M&M" && l.bar.oi == 0 && l.sendMs == 1788000061234.0);

    CHECK(ParseLiveBarLine("LIVE_BAR|TCS|1788000060|1|2|1|2|5|0|1788000061234\r", l));               // CR before the newline
    CHECK(l.sendMs == 1788000061234.0);
    CHECK(ParseLiveBarLine("LIVE_BAR|TCS|1788000060|1|2|1|2|5|\r", l) && l.bar.oi == 0);            // an empty open interest is none

    CHECK(ParseLiveBarLine("LIVE_BAR|TCS|1788000060|1|2|1|2|5|3|nonsense", l));                      // a bad sendMs never costs the bar
    CHECK(l.bar.oi == 3 && l.sendMs == 0);
    CHECK(ParseLiveBarLine("LIVE_BAR|TCS|1788000060|1|2|1|2|5|3|99|a|newer|fields", l));             // later fields are ignored

    CHECK(!ParseLiveBarLine("LIVE_BAR|TCS|1788000060|1|2|1|2", l));                                  // volume missing
    CHECK(!ParseLiveBarLine("LIVE_BAR|TCS|1788000060|1|2|x|2|5", l));                                // not a number
    CHECK(!ParseLiveBarLine("LIVE_BAR|TCS|1788000060|1|2|1|2|5|abc", l));                            // a bad open interest
    CHECK(!ParseLiveBarLine("LIVE_BAR||1788000060|1|2|1|2|5", l));                                   // no ticker
    CHECK(!ParseLiveBarLine("LIVE_BARS|TCS|1788000060|1|2|1|2|5", l));                               // not that line
    CHECK(!ParseLiveBarLine("QUOTE|TCS|1|2|3|4|5|6|7|8|9|10|11|12", l));
    CHECK(!ParseLiveBarLine("LIVE_BAR|TCS|1788000060|2858,4|2|1|2|5", l));                           // a decimal comma is not a price
    CHECK(!ParseLiveBarLine("", l));

    SECTION("QUOTE lines");
    QuoteLine q;
    CHECK(ParseQuoteLine("QUOTE|TCS|3500.5|3480|3510|3475|3490|120000|0|3500|3500.5|1788000050|300|450", q));
    CHECK(q.ticker == "TCS" && q.last == 3500.5f && q.open == 3480 && q.high == 3510 && q.low == 3475 && q.prev == 3490);
    CHECK(q.vol == 120000 && q.oi == 0 && q.bid == 3500 && q.ask == 3500.5f && q.tickSec == 1788000050.0 && q.bidQty == 300 && q.askQty == 450);
    CHECK(ParseQuoteLine("QUOTE|TCS|1|2|3|4|5|6|7|8|9|10|11\r", q) && q.bidQty == 0 && q.askQty == 0);   // an engine without the quantities
    CHECK(!ParseQuoteLine("QUOTE|TCS|1|2|3|4|5|6|7|8|9|10", q));                                    // too short
    CHECK(!ParseQuoteLine("QUOTE|TCS|1|2|3|4|5|6|7|8|9|x|11|12|13", q));
    CHECK(!ParseQuoteLine("QUOTE||1|2|3|4|5|6|7|8|9|10|11|12|13", q));
}

// ---- History announcements and the retry backoff ----
static void TestSync() {
    SECTION("SYNC lines");
    SyncNotice s;
    CHECK(ParseSyncLine("SYNC|RELIANCE", s) && s.ticker == "RELIANCE" && s.from == 0 && s.to == 0);
    CHECK(ParseSyncLine("SYNC|RELIANCE|1788000000", s) && s.from == 1788000000.0 && s.to == 0);         // an engine from before the end was sent
    CHECK(ParseSyncLine("SYNC|M&M|1788000000|1788086400\r", s) && s.ticker == "M&M" && s.from == 1788000000.0 && s.to == 1788086400.0);
    CHECK(ParseSyncLine("SYNC|TCS|1788000000|1788086400|newer|fields", s) && s.to == 1788086400.0);     // later fields are ignored
    CHECK(ParseSyncLine("SYNC|TCS|abc|1788086400", s) && s.from == 0 && s.to == 0);                      // an unreadable start: no range
    CHECK(ParseSyncLine("SYNC|TCS|1788000000|abc", s) && s.from == 1788000000.0 && s.to == 0);
    CHECK(ParseSyncLine("SYNC|TCS|0|1788086400", s) && s.from == 0 && s.to == 0);                       // an end without a start says nothing
    CHECK(!ParseSyncLine("SYNC_ALL", s));
    CHECK(!ParseSyncLine("SYNC|", s));
    CHECK(!ParseSyncLine("SYNC", s));
    CHECK(!ParseSyncLine("LIVE_BAR|TCS|1|2|3|4|5|6", s));

    SECTION("What a sync fetches");
    {
        const double day = 86400, since = 10 * day;
        double from, until;
        SyncRange r;
        r.FetchWindow(since, false, from, until);                             // nothing announced (a new connection): the last 24 hours
        CHECK(from == since - day && until == 0);
        r.Add(since - 3 * day, since - 2 * day, false);
        r.FetchWindow(since, false, from, until);                             // a range: that only
        CHECK(from == since - 3 * day - 60 && until == since - 2 * day + 60);
        r.FetchWindow(since, true, from, until);                              // minutes missing before the live bar: up to now as well
        CHECK(from == since - 3 * day - 60 && until == 0);
        SyncRange later;
        later.Add(since + 7200, since + 7500, false);                         // corrections two hours after AmiBroker's last bar
        later.FetchWindow(since, true, from, until);
        CHECK(from == since - 1 && until == 0);                               // the minutes in between too, not only the range
        later.FetchWindow(since, false, from, until);
        CHECK(from == since + 7140 && until == since + 7560);                 // none missing: the range only
        SyncRange open;
        open.Add(since - 5 * day, 0, false);
        open.FetchWindow(since, false, from, until);                          // a start only: from there to now
        CHECK(from == since - 5 * day - 60 && until == 0);
        SyncRange owed;
        owed.MarkOpen();
        owed.Add(since - 60, since, false);                                   // a range announced while 24 hours are owed
        owed.FetchWindow(since, false, from, until);
        CHECK(from == since - day && until == 0);
    }

    SECTION("What was announced, as one range");
    {
        SyncRange r;
        CHECK(!r.IsRange());
        r.Add(1000, 2000, false);
        CHECK(r.IsRange() && r.from == 1000 && r.to == 2000);
        r.Add(500, 800, false);                          // a chunk further back: the range grows both ways
        CHECK(r.IsRange() && r.from == 500 && r.to == 2000);
        r.Add(1500, 3000, false);
        CHECK(r.IsRange() && r.from == 500 && r.to == 3000);
        r.Add(0, 0, false);                              // a notice without a range: "recent bars changed", up to now
        CHECK(!r.IsRange() && r.from == 500);            // the start is kept: the fetch then runs from there to now
    }
    {
        SyncRange r;
        r.Add(1000, 2000, true);                         // the symbol still owed its last 24 hours
        CHECK(!r.IsRange() && r.from == 1000);
    }
    {
        SyncRange r;
        r.Add(1000, 0, false);                           // an engine that sends no end
        CHECK(!r.IsRange() && r.from == 1000);
        SyncRange q;
        q.Add(1000, 2000, false);
        q.MarkOpen();                                    // the connection was renewed
        CHECK(!q.IsRange());
    }

    SECTION("Retry backoff");
    {
        RetryBackoff b;
        CHECK(b.Allowed(0) && b.Allowed(1000000));
        b.Failed(10000);
        CHECK(b.DelayMs() == 2000 && !b.Allowed(11999) && b.Allowed(12000));
        b.Failed(12000);
        CHECK(b.DelayMs() == 4000 && !b.Allowed(15999) && b.Allowed(16000));
        for (int i = 0; i < 10; i++) b.Failed(100000);
        CHECK(b.DelayMs() == 60000);                     // never longer than a minute
        CHECK(!b.Allowed(159999) && b.Allowed(160000));
        b.Succeeded();
        CHECK(b.DelayMs() == 0 && b.Allowed(0));
        b.Failed(5000);
        CHECK(b.DelayMs() == 2000);                      // starts again from 2 s
    }
}

// ---- RecentBars ----
static void TestRecent() {
    SECTION("RecentBars: live bar and minute rollover");
    {
        RecentBars r;
        CHECK(!r.HasLive());
        CHECK(r.OnLive(MkBar(0, 10, 10, 10, 10, 1, 0, 5)) == RecentBars::LiveUpdated);
        CHECK(r.HasLive() && r.Live().close == 10 && r.ClosedCount() == 0);
        CHECK(r.OnLive(MkBar(0, 10, 12, 9, 11, 7, 0, 40)) == RecentBars::LiveUpdated);     // same minute: the newest state
        CHECK(r.Live().close == 11 && r.ClosedCount() == 0);
        CHECK(r.OnLive(MkBar(1, 11, 11, 11, 11, 2)) == RecentBars::LiveUpdated);           // the next minute: minute 0 closes with its last state
        CHECK(r.ClosedCount() == 1 && r.Live().timestamp == Min(1));
        std::vector<Bar> got;
        CHECK(r.Between(Min(0), Min(1), got));
        CHECK(got.size() == 1 && got[0].high == 12 && got[0].close == 11 && got[0].volume == 7);
    }
    SECTION("RecentBars: Between, covered, and minutes without ticks");
    {
        RecentBars r;
        r.OnLive(Px(10, 1)); r.OnLive(Px(11, 2)); r.OnLive(Px(12, 3)); r.OnLive(Px(17, 4));      // 13..16 had no ticks
        std::vector<Bar> got;
        CHECK(r.Between(Min(10), Min(17), got));                          // coverage began at minute 10
        CHECK(got.size() == 3 && got[0].timestamp == Min(10) && got[2].timestamp == Min(12));
        got.clear();
        CHECK(r.Between(Min(11), Min(12), got) && got.size() == 1 && got[0].timestamp == Min(11));   // from is included, to is not
        got.clear();
        CHECK(r.Between(Min(9), Min(17), got));                           // AmiBroker's last bar 9: minute 10 on is covered
        CHECK(got.size() == 3);
        got.clear();
        CHECK(!r.Between(Min(8), Min(17), got));                          // minute 9 would be missing
        CHECK(got.size() == 3);                                           // what is there is still handed over
    }
    SECTION("RecentBars: a late update of a minute that closed");
    {
        RecentBars r;
        r.OnLive(Px(0, 1)); r.OnLive(Px(1, 2)); r.OnLive(Px(2, 3));                            // 0 and 1 closed, 2 live
        CHECK(r.OnLive(MkBar(1, 2, 9, 2, 5, 40)) == RecentBars::ClosedUpdated);                // minute 1 got more trades after minute 2 began
        CHECK(r.Live().timestamp == Min(2) && r.Live().close == 3);                            // the live bar is untouched
        std::vector<Bar> got; r.Between(Min(0), Min(2), got);
        CHECK(got.size() == 2 && got[1].high == 9 && got[1].volume == 40);
    }
    {   // a minute with no bar yet, first heard of late: added in order
        RecentBars r;
        r.OnLive(Px(0, 1)); r.OnLive(Px(2, 3)); r.OnLive(Px(3, 4));                            // 0 and 2 closed; 1 never had an update
        CHECK(r.OnLive(Px(1, 2)) == RecentBars::ClosedUpdated);
        std::vector<Bar> got; r.Between(Min(0), Min(3), got);
        CHECK(got.size() == 3 && got[0].timestamp == Min(0) && got[1].timestamp == Min(1) && got[2].timestamp == Min(2));
    }
    {   // a late update from before coverage began is not taken
        RecentBars r;
        r.OnLive(Px(10, 1));
        CHECK(r.OnLive(Px(5, 9)) == RecentBars::Ignored);
        CHECK(r.ClosedCount() == 0);
    }
    SECTION("RecentBars: the ring holds 120 minutes");
    {
        RecentBars r;
        for (int m = 0; m <= 130; m++) r.OnLive(Px(m, (float)m));                              // 130 closed, 130 is live
        CHECK(r.ClosedCount() == RecentBars::CAPACITY);
        CHECK(r.CoveredFromMin() == Min(10));                                                  // minutes 0..9 are gone
        std::vector<Bar> got;
        CHECK(r.Between(Min(9), Min(130), got) && got.size() == 120 && got.front().timestamp == Min(10));
        got.clear();
        CHECK(!r.Between(Min(5), Min(130), got));                                              // too far back: the engine is asked
        CHECK(got.size() == 120);
    }
    SECTION("RecentBars: coverage starts again after the engine connection was lost");
    {
        RecentBars r;
        r.OnLive(Px(0, 1)); r.OnLive(Px(1, 2));                                                // 0 closed, 1 live
        r.ResetCoverage();                                                                     // disconnected; minutes 1..4 were not received
        r.OnLive(Px(5, 6));                                                                    // back: minute 1's bar may have missed its last ticks
        CHECK(r.CoveredFromMin() == Min(5));
        std::vector<Bar> got;
        CHECK(!r.Between(Min(1), Min(5), got) && got.empty());                                 // nothing from before is handed out
        r.OnLive(Px(6, 7));
        got.clear();
        CHECK(r.Between(Min(4), Min(6), got) && got.size() == 1 && got[0].timestamp == Min(5));
    }
    {   // the same minute again after a short outage: the bar is the full state, so nothing is lost
        RecentBars r;
        r.OnLive(Px(0, 1)); r.OnLive(MkBar(1, 2, 3, 2, 3, 5));
        r.ResetCoverage();
        r.OnLive(MkBar(1, 2, 4, 2, 4, 9));
        CHECK(r.CoveredFromMin() == Min(1) && r.Live().high == 4);
        r.OnLive(Px(2, 5));
        std::vector<Bar> got; CHECK(r.Between(Min(0), Min(2), got));
        CHECK(got.size() == 1 && got[0].timestamp == Min(1) && got[0].volume == 9);
    }
}

int main() {
    TestMerge();
    TestParser();
    TestSync();
    TestRecent();
    printf("\n%d checks, %d failed\n", g_checks, g_failed);
    return g_failed ? 1 : 0;
}
