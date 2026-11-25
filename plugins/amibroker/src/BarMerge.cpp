#ifndef WIN32_LEAN_AND_MEAN
#define WIN32_LEAN_AND_MEAN
#endif
#include <charconv>
#include <math.h>
#include <string.h>
#include <time.h>
#include "BarMerge.h"

// ---------------------------------------------------------------------------------------------
// Bars into AmiBroker's array
// ---------------------------------------------------------------------------------------------

// localtime_s for many bar times: a full load converts ~100k of them. The UTC offset is looked
// up once per UTC hour (clock changes, where there are any, fall on those), the date is plain
// arithmetic (days -> year/month/day, H. Hinnant's civil_from_days).
static void LocalTimeOf(time_t t, struct tm& out) {
    thread_local time_t cachedHour = -1;
    thread_local long long offset = 0;
    time_t hour = t - (t % 3600);
    if (hour != cachedHour) {
        struct tm lt; memset(&lt, 0, sizeof(lt));
        if (localtime_s(&lt, &hour) != 0) { memset(&out, 0, sizeof(out)); localtime_s(&out, &t); return; }
        offset = (long long)_mkgmtime(&lt) - (long long)hour;
        cachedHour = hour;
    }
    long long wall = (long long)t + offset;
    long long days = wall >= 0 ? wall / 86400 : (wall - 86399) / 86400;
    int secs = (int)(wall - days * 86400);
    days += 719468;
    long long era = (days >= 0 ? days : days - 146096) / 146097;
    unsigned doe = (unsigned)(days - era * 146097);
    unsigned yoe = (doe - doe / 1460 + doe / 36524 - doe / 146096) / 365;
    unsigned doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    unsigned mp = (5 * doy + 2) / 153;
    unsigned d = doy - (153 * mp + 2) / 5 + 1;
    unsigned m = mp < 10 ? mp + 3 : mp - 9;
    long long y = (long long)yoe + era * 400 + (m <= 2 ? 1 : 0);
    memset(&out, 0, sizeof(out));
    out.tm_year = (int)(y - 1900);
    out.tm_mon = (int)m - 1;
    out.tm_mday = (int)d;
    out.tm_hour = secs / 3600;
    out.tm_min = (secs / 60) % 60;
    out.tm_sec = secs % 60;
}

void WriteBarToQuotation(struct Quotation* pQ, int idx, const Bar& b) {
    if (b.timestamp <= 0) return;
    pQ[idx].Price        = b.close;
    pQ[idx].Open         = b.open;
    pQ[idx].High         = b.high;
    pQ[idx].Low          = b.low;
    pQ[idx].Volume       = b.volume;
    pQ[idx].OpenInterest = b.oi;
    pQ[idx].AuxData1     = 0;
    pQ[idx].AuxData2     = 0;
    time_t t = (time_t)b.timestamp;
    struct tm tm_out;
    LocalTimeOf(t, tm_out);
    pQ[idx].DateTime.PackDate.MicroSec = 0;
    pQ[idx].DateTime.PackDate.MilliSec = 0;
    pQ[idx].DateTime.PackDate.Second   = tm_out.tm_sec;
    pQ[idx].DateTime.PackDate.Minute   = tm_out.tm_min;
    pQ[idx].DateTime.PackDate.Hour     = tm_out.tm_hour;
    pQ[idx].DateTime.PackDate.Day      = tm_out.tm_mday;
    pQ[idx].DateTime.PackDate.Month    = tm_out.tm_mon + 1;
    pQ[idx].DateTime.PackDate.Year     = tm_out.tm_year + 1900;
}

double QuotationToUnix(const struct Quotation& q) {
    struct tm tv; memset(&tv, 0, sizeof(tv));
    // An end-of-day bar (mixed EOD/intraday database) counts as its day's midnight
    bool eod = q.DateTime.PackDate.Hour == DATE_EOD_HOURS;
    tv.tm_sec  = eod ? 0 : q.DateTime.PackDate.Second;
    tv.tm_min  = eod ? 0 : q.DateTime.PackDate.Minute;
    tv.tm_hour = eod ? 0 : q.DateTime.PackDate.Hour;
    tv.tm_mday = q.DateTime.PackDate.Day;
    tv.tm_mon  = q.DateTime.PackDate.Month - 1;
    tv.tm_year = q.DateTime.PackDate.Year - 1900;
    tv.tm_isdst = -1;
    time_t t = mktime(&tv);
    return (t == (time_t)-1) ? 0 : (double)t;
}

// A daily bar as an end-of-day quotation: its India date (the engine stamps the day's midnight,
// India time), with AmiBroker's EOD marker in place of a time
void WriteEodToQuotation(struct Quotation* pQ, int idx, const Bar& b) {
    memset(&pQ[idx], 0, sizeof(struct Quotation));
    pQ[idx].Price = b.close; pQ[idx].Open = b.open; pQ[idx].High = b.high; pQ[idx].Low = b.low;
    pQ[idx].Volume = b.volume; pQ[idx].OpenInterest = b.oi;
    time_t t = (time_t)b.timestamp + 19800;
    struct tm d; gmtime_s(&d, &t);
    pQ[idx].DateTime.PackDate.Year   = d.tm_year + 1900;
    pQ[idx].DateTime.PackDate.Month  = d.tm_mon + 1;
    pQ[idx].DateTime.PackDate.Day    = d.tm_mday;
    pQ[idx].DateTime.PackDate.Hour   = DATE_EOD_HOURS;
    pQ[idx].DateTime.PackDate.Minute = DATE_EOD_MINUTES;
}

double QuotationMinute(const struct Quotation& q) { return floor(QuotationToUnix(q) / 60.0) * 60.0; }
double BarMinute(const Bar& b) { return floor(b.timestamp / 60.0) * 60.0; }

// First index in pQ[0..count) whose minute is >= `minute` (binary search).
static int LowerBoundMinute(const struct Quotation* pQ, int count, double minute) {
    int lo = 0, hi = count;
    while (lo < hi) {
        int mid = (lo + hi) / 2;
        if (QuotationMinute(pQ[mid]) < minute) lo = mid + 1; else hi = mid;
    }
    return lo;
}

// A bar in the same minute as an existing quotation overwrites it (broker history correcting live-built
// candles); bars for minutes AmiBroker does not have are inserted in time order, also in the middle of
// the array. That is how a hole left while the bridge was closed gets filled even after newer live bars
// were already appended (they used to be ignored, so the hole stayed in AmiBroker's database for good).
// Only the part from the first incoming minute on is rebuilt, so the live-tick path stays cheap. When
// the array is full the oldest quotations are dropped. Returns the new count.
int MergeBars(struct Quotation* pQ, int count, int nSize, const std::vector<Bar>& bars) {
    // Incoming bars: valid, ascending, one per minute (last wins)
    std::vector<const Bar*> in;
    for (const Bar& b : bars) {
        if (b.timestamp <= 0 || b.close <= 0) continue;
        if (!in.empty()) {
            double last = BarMinute(*in.back()), m = BarMinute(b);
            if (m == last) { in.back() = &b; continue; }
            if (m < last) continue;   // out of order (input is ascending): ignore
        }
        in.push_back(&b);
    }
    if (in.empty()) return count;

    int k = LowerBoundMinute(pQ, count, BarMinute(*in.front()));   // pQ[0..k) stays as it is
    std::vector<struct Quotation> tail;
    tail.reserve((size_t)(count - k) + in.size());
    int i = k;
    size_t j = 0;
    while (i < count || j < in.size()) {
        if (j >= in.size()) { tail.push_back(pQ[i++]); continue; }
        double bm = BarMinute(*in[j]);
        if (i < count) {
            double qm = QuotationMinute(pQ[i]);
            if (qm < bm) { tail.push_back(pQ[i++]); continue; }
            if (qm == bm) {
                struct Quotation q = pQ[i++];
                WriteBarToQuotation(&q, 0, *in[j++]);
                tail.push_back(q);
                continue;
            }
        }
        struct Quotation q;
        memset(&q, 0, sizeof(q));
        WriteBarToQuotation(&q, 0, *in[j++]);
        tail.push_back(q);
    }

    // Keep the newest nSize quotations: drop from the front (oldest) if needed
    int total = k + (int)tail.size();
    int drop = total > nSize ? total - nSize : 0;
    if (drop >= k) {
        size_t skip = (size_t)(drop - k);
        memcpy(pQ, tail.data() + skip, (tail.size() - skip) * sizeof(struct Quotation));
        return (int)(tail.size() - skip);
    }
    if (drop > 0) {
        memmove(pQ, pQ + drop, (size_t)(k - drop) * sizeof(struct Quotation));
        k -= drop;
    }
    memcpy(pQ + k, tail.data(), tail.size() * sizeof(struct Quotation));
    return k + (int)tail.size();
}

// ---------------------------------------------------------------------------------------------
// Lines from the engine
// ---------------------------------------------------------------------------------------------

// Splits on '|' into at most `max` parts (any further parts are ignored: a newer engine may add fields)
static int SplitBars(std::string_view s, std::string_view* out, int max) {
    int n = 0;
    size_t from = 0;
    for (;;) {
        size_t bar = s.find('|', from);
        if (n < max) out[n] = s.substr(from, bar == std::string_view::npos ? std::string_view::npos : bar - from);
        n++;
        if (bar == std::string_view::npos) break;
        from = bar + 1;
    }
    return n < max ? n : max;
}

// from_chars: no locale (a "," decimal setting can't misread prices) and no allocation
template <class T> static bool Num(std::string_view s, T& v) {
    if (s.empty()) return false;
    auto r = std::from_chars(s.data(), s.data() + s.size(), v);
    return r.ec == std::errc() && r.ptr == s.data() + s.size();
}

static std::string_view WithoutCr(std::string_view line) {
    if (!line.empty() && line.back() == '\r') line.remove_suffix(1);
    return line;
}

bool ParseLiveBarLine(std::string_view line, LiveBarLine& out) {
    line = WithoutCr(line);
    std::string_view f[12];
    int n = SplitBars(line, f, 12);
    if (n < 8 || f[0] != "LIVE_BAR" || f[1].empty()) return false;
    Bar b{};
    if (!Num(f[2], b.timestamp) || !Num(f[3], b.open) || !Num(f[4], b.high) || !Num(f[5], b.low) ||
        !Num(f[6], b.close) || !Num(f[7], b.volume)) return false;
    if (n >= 9 && !f[8].empty() && !Num(f[8], b.oi)) return false;
    out.ticker.assign(f[1]);
    out.bar = b;
    // Only for the timing numbers: a bad one must never cost the bar
    out.sendMs = 0;
    if (n >= 10) { double v; if (Num(f[9], v) && v > 0) out.sendMs = v; }
    return true;
}

bool ParseQuoteLine(std::string_view line, QuoteLine& out) {
    line = WithoutCr(line);
    std::string_view f[16];
    int n = SplitBars(line, f, 16);
    if (n < 13 || f[0] != "QUOTE" || f[1].empty()) return false;
    QuoteLine q;
    if (!Num(f[2], q.last) || !Num(f[3], q.open) || !Num(f[4], q.high) || !Num(f[5], q.low) ||
        !Num(f[6], q.prev) || !Num(f[7], q.vol) || !Num(f[8], q.oi) || !Num(f[9], q.bid) ||
        !Num(f[10], q.ask) || !Num(f[11], q.tickSec)) return false;
    if (n >= 14 && (!Num(f[12], q.bidQty) || !Num(f[13], q.askQty))) return false;   // newer engines
    q.ticker.assign(f[1]);
    out = std::move(q);
    return true;
}

bool ParseSyncLine(std::string_view line, SyncNotice& out) {
    line = WithoutCr(line);
    std::string_view f[5];
    int n = SplitBars(line, f, 5);
    if (n < 2 || f[0] != "SYNC" || f[1].empty()) return false;
    SyncNotice s;
    s.ticker.assign(f[1]);
    // A number that does not read is "not given": the symbol is then synced as for a notice without a range
    double v;
    if (n >= 3 && Num(f[2], v) && v > 0) s.from = v;
    if (n >= 4 && Num(f[3], v) && v > 0) s.to = v;
    if (s.from == 0) s.to = 0;   // an end without a start says nothing
    out = std::move(s);
    return true;
}

void SyncRange::Add(double fromSec, double toSec, bool owesFullSync) {
    any = true;
    from = from > 0 && fromSec > 0 ? (std::min)(from, fromSec) : (from > 0 ? from : fromSec);
    if (toSec > 0) to = (std::max)(to, toSec);
    else open = true;                       // "up to now": no end of another notice narrows that
    if (owesFullSync) open = true;
}

void SyncRange::FetchWindow(double sinceSec, bool hole, double& fetchFrom, double& fetchUntil) const {
    fetchUntil = 0;
    if (IsRange()) {
        fetchFrom = from - 60;
        if (hole) fetchFrom = (std::min)(fetchFrom, sinceSec - 1);
        else fetchUntil = to + 60;
    } else {
        fetchFrom = sinceSec - 86400;
        if (from > 0) fetchFrom = (std::min)(fetchFrom, from - 60);
    }
    if (fetchFrom < 0) fetchFrom = 0;
}

// ---------------------------------------------------------------------------------------------
// RecentBars
// ---------------------------------------------------------------------------------------------

static double MinuteOf(double ts) { return floor(ts / 60.0) * 60.0; }

// A minute that ended: kept in ring order (ascending, one per minute); the oldest go when it is full
void RecentBars::Close(const Bar& b) {
    double m = MinuteOf(b.timestamp);
    auto it = ring_.end();
    while (it != ring_.begin() && MinuteOf((it - 1)->timestamp) > m) --it;
    if (it != ring_.begin() && MinuteOf((it - 1)->timestamp) == m) *(it - 1) = b;
    else ring_.insert(it, b);
    while (ring_.size() > CAPACITY) ring_.pop_front();
    // What was dropped is gone: the ring is complete only from its oldest minute on
    if (!ring_.empty()) {
        double front = MinuteOf(ring_.front().timestamp);
        if (front > coveredFromMin_) coveredFromMin_ = front;
    }
}

RecentBars::Result RecentBars::OnLive(const Bar& b) {
    double m = MinuteOf(b.timestamp);
    if (!hasLive_) {
        live_ = b; hasLive_ = true;
        if (coveredFromMin_ == 0) coveredFromMin_ = m;
        return LiveUpdated;
    }
    double cur = MinuteOf(live_.timestamp);
    if (m >= cur) {
        // Coverage starts with the first update after a (re)connection, not with a bar from before it
        if (coveredFromMin_ == 0) coveredFromMin_ = m;
        // The minute that was live is over. Its last state counts only if every update since coverage
        // began was received; a bar left from before a disconnection may have missed its last ticks.
        if (m > cur && cur >= coveredFromMin_) Close(live_);
        live_ = b;
        return LiveUpdated;
    }
    // An update of a minute that already closed (it reached us after the next one began)
    if (coveredFromMin_ == 0 || m < coveredFromMin_) return Ignored;
    Close(b);
    return ClosedUpdated;
}

bool RecentBars::Between(double fromMin, double toMin, std::vector<Bar>& out) const {
    for (const Bar& b : ring_) {
        double m = MinuteOf(b.timestamp);
        if (m >= fromMin && m < toMin && m >= coveredFromMin_) out.push_back(b);
    }
    return coveredFromMin_ != 0 && coveredFromMin_ <= fromMin + 60;
}
