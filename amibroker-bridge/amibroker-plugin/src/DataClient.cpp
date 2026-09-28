#define WIN32_LEAN_AND_MEAN
#include <winsock2.h>
#include <ws2tcpip.h>
/**
 * DataClient.cpp
 * Connects to the DataBridge Pro local Node.js API (127.0.0.1:7891)
 * and fetches real OHLCV bar data for AmiBroker using WinHTTP.
 */
#include <windows.h>
#include <winhttp.h>
#include <string>
#include <vector>
#include <sstream>

#pragma comment(lib, "winhttp.lib")
#pragma comment(lib, "ws2_32.lib")

#include "DataClient.h"
#include "Plugin.h"
#include <thread>
#include <mutex>
#include <map>
#include <chrono>

// ---- Background Live Update Poller ----
static std::thread g_pollerThread;
static std::mutex g_pollerMutex;
static bool g_bShutdown = false;
static std::map<std::string, double> g_activeSymbols; 
static std::map<std::string, Bar> g_lastKnownBars; 
static HWND g_hAmiBrokerWnd = NULL;

void UpdateActiveSymbol(const std::string& ticker) {
    std::lock_guard<std::mutex> lock(g_pollerMutex);
    g_activeSymbols[ticker] = std::chrono::duration_cast<std::chrono::seconds>(
        std::chrono::system_clock::now().time_since_epoch()).count();
}

void SetAmiBrokerWindow(HWND hWnd) {
    g_hAmiBrokerWnd = hWnd;
}

// Export the live bar getter so Plugin.cpp can use it
bool GetCachedLiveBar(const std::string& ticker, Bar& outBar) {
    std::lock_guard<std::mutex> lock(g_pollerMutex);
    auto it = g_lastKnownBars.find(ticker);
    if (it != g_lastKnownBars.end()) {
        outBar = it->second;
        return true;
    }
    return false;
}

static void LogDebug(const char* msg) {
    FILE* fp;
    if (fopen_s(&fp, "C:\\\\DataBridgePro_plugin_debug.log", "a") == 0) {
        fprintf(fp, "%s\n", msg);
        fclose(fp);
    }
}

static void PollerThreadProc() {
    WSADATA wsaData;
    if (WSAStartup(MAKEWORD(2, 2), &wsaData) != 0) return;

    while (!g_bShutdown) {
        SOCKET ConnectSocket = socket(AF_INET, SOCK_STREAM, IPPROTO_TCP);
        if (ConnectSocket == INVALID_SOCKET) {
            std::this_thread::sleep_for(std::chrono::milliseconds(1000));
            continue;
        }

        sockaddr_in clientService;
        clientService.sin_family = AF_INET;
        inet_pton(AF_INET, "127.0.0.1", &clientService.sin_addr.s_addr);
        clientService.sin_port = htons(7891);

        if (connect(ConnectSocket, (SOCKADDR*)&clientService, sizeof(clientService)) == SOCKET_ERROR) {
            closesocket(ConnectSocket);
            std::this_thread::sleep_for(std::chrono::milliseconds(1000));
            continue;
        }

        LogDebug("[IPC_CONNECT] Connected to backend on port 7891");

        char recvbuf[4096];
        int recvbuflen = 4096;
        std::string buffer;

        while (!g_bShutdown) {
            int iResult = recv(ConnectSocket, recvbuf, recvbuflen - 1, 0);
            if (iResult > 0) {
                recvbuf[iResult] = '\0';
                buffer += recvbuf;

                size_t pos = 0;
                while ((pos = buffer.find('\n')) != std::string::npos) {
                    std::string line = buffer.substr(0, pos);
                    buffer.erase(0, pos + 1);

                    if (line.rfind("LIVE_BAR|", 0) == 0) {
                        size_t p1 = line.find('|', 9);
                        if (p1 != std::string::npos) {
                            std::string ticker = line.substr(9, p1 - 9);
                            size_t p2 = line.find('|', p1 + 1);
                            size_t p3 = line.find('|', p2 + 1);
                            size_t p4 = line.find('|', p3 + 1);
                            size_t p5 = line.find('|', p4 + 1);
                            size_t p6 = line.find('|', p5 + 1);
                            size_t p7 = line.find('|', p6 + 1);

                            if (p7 != std::string::npos) {
                                Bar b;
                                b.timestamp = std::stod(line.substr(p1 + 1, p2 - p1 - 1));
                                b.open = std::stof(line.substr(p2 + 1, p3 - p2 - 1));
                                b.high = std::stof(line.substr(p3 + 1, p4 - p3 - 1));
                                b.low = std::stof(line.substr(p4 + 1, p5 - p4 - 1));
                                b.close = std::stof(line.substr(p5 + 1, p6 - p5 - 1));
                                b.volume = std::stof(line.substr(p6 + 1, p7 - p6 - 1));

                                bool changed = false;
                                {
                                    std::lock_guard<std::mutex> lock(g_pollerMutex);
                                    g_lastKnownBars[ticker] = b;
                                    changed = true; // Always trigger on push
                                }

                                if (ticker == "BDL") {
                                    static DWORD lastLog = 0;
                                    DWORD now = GetTickCount();
                                    if (now - lastLog > 2000) {
                                        lastLog = now;
                                        char logBuf[256];
                                        sprintf_s(logBuf, "[IPC_LIVE_BAR] BDL ts=%d\n[PLUGIN_CACHE_UPDATE] BDL\n[AMIBROKER_UPDATE] BDL", (int)b.timestamp);
                                        LogDebug(logBuf);
                                    }
                                }

                                if (g_hAmiBrokerWnd && IsWindow(g_hAmiBrokerWnd)) {
                                    RecentInfo* ri = new RecentInfo;
                                    memset(ri, 0, sizeof(RecentInfo));
                                    ri->nStructSize = sizeof(RecentInfo);
                                    strncpy_s(ri->Name, ticker.c_str(), sizeof(ri->Name) - 1);
                                    ri->nStatus = 1;
                                    ri->nBitmap = 0xFFFF;
                                    PostMessage(g_hAmiBrokerWnd, WM_USER_STREAMING_UPDATE, (WPARAM)ri->Name, (LPARAM)ri);
                                }
                            }
                        }
                    }
                }
            } else if (iResult == 0) {
                break;
            } else {
                break;
            }
        }
        closesocket(ConnectSocket);
    }
    WSACleanup();
}

void StartPollingThread() {
    std::lock_guard<std::mutex> lock(g_pollerMutex);
    if (!g_pollerThread.joinable()) {
        g_bShutdown = false;
        g_pollerThread = std::thread(PollerThreadProc);
    }
}

void StopPollingThread() {
    g_bShutdown = true;
    if (g_pollerThread.joinable()) {
        g_pollerThread.join();
    }
}


// ---- Fetch bars from local API ----
int FetchBarsFromAPI(const std::string& ticker, int limit, double since, std::vector<Bar>& outBars) {
    outBars.clear();

    HINTERNET hSession = WinHttpOpen(
        L"DataBridgePro/1.0",
        WINHTTP_ACCESS_TYPE_NO_PROXY,
        WINHTTP_NO_PROXY_NAME,
        WINHTTP_NO_PROXY_BYPASS,
        0
    );
    if (!hSession) return 0;

    HINTERNET hConnect = WinHttpConnect(hSession, L"127.0.0.1", 7890, 0);
    if (!hConnect) {
        WinHttpCloseHandle(hSession);
        return 0;
    }

    std::wstring wTicker = std::wstring(ticker.begin(), ticker.end());
    std::wstringstream wss;
    wss << L"/api/feed/bars?ticker=" << wTicker;
    if (limit > 0) wss << L"&limit=" << limit;
    if (since > 0) wss << L"&since=" << (long long)since;
    std::wstring wPath = wss.str();

    HINTERNET hRequest = WinHttpOpenRequest(
        hConnect,
        L"GET",
        wPath.c_str(),
        NULL, WINHTTP_NO_REFERER,
        WINHTTP_DEFAULT_ACCEPT_TYPES,
        0
    );

    if (!hRequest) {
        WinHttpCloseHandle(hConnect);
        WinHttpCloseHandle(hSession);
        return 0;
    }

    BOOL bResults = WinHttpSendRequest(
        hRequest,
        WINHTTP_NO_ADDITIONAL_HEADERS, 0,
        WINHTTP_NO_REQUEST_DATA, 0,
        0, 0
    );

    if (bResults) {
        bResults = WinHttpReceiveResponse(hRequest, NULL);
    }

    std::string responseData;
    if (bResults) {
        DWORD dwSize = 0;
        DWORD dwDownloaded = 0;
        do {
            dwSize = 0;
            if (!WinHttpQueryDataAvailable(hRequest, &dwSize)) {
                break;
            }
            if (dwSize == 0) break;

            char* pszOutBuffer = new char[dwSize + 1];
            if (WinHttpReadData(hRequest, (LPVOID)pszOutBuffer, dwSize, &dwDownloaded)) {
                pszOutBuffer[dwDownloaded] = 0;
                responseData += pszOutBuffer;
            }
            delete[] pszOutBuffer;
        } while (dwSize > 0);
    }

    WinHttpCloseHandle(hRequest);
    WinHttpCloseHandle(hConnect);
    WinHttpCloseHandle(hSession);

    // Parse CSV
    if (responseData.empty()) return 0;
    std::istringstream stream(responseData);
    std::string line;
    while (std::getline(stream, line)) {
        if (line.empty() || line == "END" || line == "END\r") continue;
        std::istringstream ls(line);
        std::string token;
        Bar b;
        if (std::getline(ls, token, ',')) b.timestamp = std::stod(token); else continue;
        if (std::getline(ls, token, ',')) b.open = std::stof(token); else continue;
        if (std::getline(ls, token, ',')) b.high = std::stof(token); else continue;
        if (std::getline(ls, token, ',')) b.low = std::stof(token); else continue;
        if (std::getline(ls, token, ',')) b.close = std::stof(token); else continue;
        if (std::getline(ls, token, ',')) b.volume = std::stof(token); else continue;
        outBars.push_back(b);
    }

    return (int)outBars.size();
}


