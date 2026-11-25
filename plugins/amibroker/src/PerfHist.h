#pragma once
// A histogram with fixed buckets, each 10% wider than the one before (the same as the engine's
// system/perf.ts): recording is a logarithm and an increment, a percentile is the upper edge of its
// bucket (within 10%), never above the largest value seen. No locking: the caller guards it.
#include <math.h>
#include <string.h>

struct PerfHist {
    static const int BUCKETS = 148;     // minValue ... minValue * 1.1^147 (about 1.2 million times minValue)
    double minValue;                    // upper edge of bucket 0, in the unit recorded (ms, or microseconds)
    unsigned counts[BUCKETS];
    unsigned long long n;
    double sum, maxValue;

    explicit PerfHist(double minV = 0.05) : minValue(minV) { Reset(); }

    void Reset() {
        memset(counts, 0, sizeof(counts));
        n = 0; sum = 0; maxValue = 0;
    }

    void Record(double v) {
        if (!(v >= 0)) return;          // NaN and negative values are not durations
        int i = v <= minValue ? 0 : (int)ceil(log(v / minValue) / log(1.1));
        if (i >= BUCKETS) i = BUCKETS - 1;
        counts[i]++; n++; sum += v;
        if (v > maxValue) maxValue = v;
    }

    double Percentile(double p) const {
        if (n == 0) return 0;
        unsigned long long rank = (unsigned long long)ceil((double)n * p / 100.0);
        if (rank < 1) rank = 1;
        unsigned long long seen = 0;
        for (int i = 0; i < BUCKETS; i++) {
            seen += counts[i];
            if (seen >= rank) {
                double edge = minValue * pow(1.1, i);
                return (i == BUCKETS - 1 || edge > maxValue) ? maxValue : edge;
            }
        }
        return maxValue;
    }
};
