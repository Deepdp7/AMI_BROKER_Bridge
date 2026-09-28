#pragma once
#include <string>
#include <vector>
#include <windows.h>

struct Bar {
    double timestamp;
    float open;
    float high;
    float low;
    float close;
    float volume;
};

extern int FetchBarsFromAPI(const std::string& ticker, int limit, double since, std::vector<Bar>& outBars);

extern void StartPollingThread();
extern void StopPollingThread();
extern void UpdateActiveSymbol(const std::string& ticker);
extern void SetAmiBrokerWindow(HWND hWnd);

extern bool GetCachedLiveBar(const std::string& ticker, Bar& outBar);


