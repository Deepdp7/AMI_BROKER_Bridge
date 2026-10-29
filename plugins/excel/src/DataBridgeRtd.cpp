// DataBridge Pro live prices in Excel: an RTD server ("DataBridge.RTD").
//
//   =RTD("DataBridge.RTD",,"RELIANCE","LTP")        last price (also OPEN HIGH LOW PREVCLOSE CHANGE
//                                                    CHANGE% VOLUME OI BID ASK TIME LOT STATUS)
//   =RTD("DataBridge.RTD",,"RELIANCE","BAR","5m",1,"CLOSE")
//                                                    a bar of history: timeframe 1m 5m 15m 30m 1h 1d,
//                                                    1 = the bar forming now (moves live), 2 = the one
//                                                    before…; TIME OPEN HIGH LOW CLOSE VOLUME
//
// Excel loads this DLL into its own process and calls it on its main thread. A worker thread
// reads every symbol's quote from the DataBridge engine on this PC (GET 127.0.0.1:7890
// /api/platforms/quotes, twice a second); a timer on Excel's thread then tells Excel when
// something changed (IRTDUpdateEvent::UpdateNotify), and Excel collects the new values
// (RefreshData). When the engine is not running, cells keep their last values.
//
// Registered per user (HKCU\Software\Classes), so no administrator rights are needed: the
// DataBridge app runs regsvr32 on the copy that matches Excel (64- or 32-bit).

#ifndef WIN32_LEAN_AND_MEAN
#define WIN32_LEAN_AND_MEAN
#endif
#include <windows.h>
#include <olectl.h>
#include <ole2.h>
#include <oleauto.h>
#include <winhttp.h>
#include <string>
#include <map>
#include <vector>
#include <mutex>
#include <thread>
#include <atomic>
#include <cstdlib>
#include <cstring>

// ---- The RTD interfaces (from Excel's type library) ----
static const CLSID CLSID_DataBridgeRtd = {0x12D634FE,0x108A,0x42AD,{0x8E,0xAC,0xCD,0x62,0x7B,0xB3,0xA0,0x45}};
static const IID IID_IRtdServer      = {0xEC0E6191,0xDB51,0x11D3,{0x8F,0x3E,0x00,0xC0,0x4F,0x36,0x51,0xB8}};
static const IID IID_IRTDUpdateEvent = {0xA43788C1,0xD91B,0x11D3,{0x8F,0x39,0x00,0xC0,0x4F,0x36,0x51,0xB8}};
static const GUID LIBID_Excel        = {0x00020813,0x0000,0x0000,{0xC0,0x00,0x00,0x00,0x00,0x00,0x00,0x46}};
static const wchar_t* PROGID = L"DataBridge.RTD";
static const wchar_t* CLSID_TEXT = L"{12D634FE-108A-42AD-8EAC-CD627BB3A045}";

struct IRTDUpdateEvent : public IDispatch {
    virtual HRESULT STDMETHODCALLTYPE UpdateNotify() = 0;
    virtual HRESULT STDMETHODCALLTYPE get_HeartbeatInterval(long* value) = 0;
    virtual HRESULT STDMETHODCALLTYPE put_HeartbeatInterval(long value) = 0;
    virtual HRESULT STDMETHODCALLTYPE Disconnect() = 0;
};

struct IRtdServer : public IDispatch {
    virtual HRESULT STDMETHODCALLTYPE ServerStart(IRTDUpdateEvent* callback, long* result) = 0;
    virtual HRESULT STDMETHODCALLTYPE ConnectData(long topicId, SAFEARRAY** strings, VARIANT_BOOL* getNewValues, VARIANT* value) = 0;
    virtual HRESULT STDMETHODCALLTYPE RefreshData(long* topicCount, SAFEARRAY** data) = 0;
    virtual HRESULT STDMETHODCALLTYPE DisconnectData(long topicId) = 0;
    virtual HRESULT STDMETHODCALLTYPE Heartbeat(long* result) = 0;
    virtual HRESULT STDMETHODCALLTYPE ServerTerminate() = 0;
};

static HMODULE g_module = NULL;
static std::atomic<long> g_objects(0), g_locks(0);

// ---- Quotes from the engine ----
struct Quote {
    double ltp = 0, open = 0, high = 0, low = 0, prev = 0, change = 0, changePct = 0;
    double volume = 0, oi = 0, bid = 0, ask = 0, timeMs = 0, lot = 0;
    std::string status;
};

static std::string Upper(std::string s) { for (auto& c : s) c = (char)toupper((unsigned char)c); return s; }

// "TICKER|ltp|open|high|low|prev|change|change%|volume|oi|bid|ask|timeMs|lot|status" per line
static std::map<std::string, Quote> ParseQuotes(const std::string& text) {
    std::map<std::string, Quote> out;
    size_t pos = 0;
    while (pos < text.size()) {
        size_t end = text.find('\n', pos);
        if (end == std::string::npos) end = text.size();
        std::string line = text.substr(pos, end - pos);
        pos = end + 1;
        if (!line.empty() && line.back() == '\r') line.pop_back();
        std::vector<std::string> f;
        size_t a = 0;
        for (;;) {
            size_t b = line.find('|', a);
            f.push_back(line.substr(a, b == std::string::npos ? std::string::npos : b - a));
            if (b == std::string::npos) break;
            a = b + 1;
        }
        if (f.size() < 14 || f[0].empty()) continue;
        Quote q;
        double* nums[] = { &q.ltp, &q.open, &q.high, &q.low, &q.prev, &q.change, &q.changePct, &q.volume, &q.oi, &q.bid, &q.ask, &q.timeMs, &q.lot };
        for (int i = 0; i < 13; i++) *nums[i] = strtod(f[i + 1].c_str(), NULL);
        if (f.size() > 14) q.status = f[14];
        out[Upper(f[0])] = q;
    }
    return out;
}

static std::mutex g_quoteMutex;
static std::map<std::string, Quote> g_quotes;     // guarded by g_quoteMutex
static std::atomic<long> g_version(0);             // bumped on every change of g_quotes / engine state
static std::atomic<bool> g_everReceived(false);
static std::atomic<bool> g_engineUp(false);

// The engine's port: 7890, unless DATABRIDGE_PORT or HKCU\Software\DataBridge Pro\Excel "Port"
// says otherwise (tests run next to a working DataBridge)
static INTERNET_PORT EnginePort() {
    wchar_t buf[16];
    DWORD n = GetEnvironmentVariableW(L"DATABRIDGE_PORT", buf, 16);
    int p = (n > 0 && n < 16) ? _wtoi(buf) : 0;
    if (p <= 0) {
        DWORD v = 0, size = sizeof(v);
        if (RegGetValueW(HKEY_CURRENT_USER, L"Software\\DataBridge Pro\\Excel", L"Port", RRF_RT_REG_DWORD, NULL, &v, &size) == ERROR_SUCCESS) p = (int)v;
    }
    return (INTERNET_PORT)(p > 0 && p < 65536 ? p : 7890);
}

// GET a path from the engine; returns the HTTP status (0 when the engine can't be reached)
static DWORD FetchPath(HINTERNET session, const std::wstring& path, std::string& body) {
    HINTERNET conn = WinHttpConnect(session, L"127.0.0.1", EnginePort(), 0);
    if (!conn) return 0;
    HINTERNET req = WinHttpOpenRequest(conn, L"GET", path.c_str(), NULL, WINHTTP_NO_REFERER, WINHTTP_DEFAULT_ACCEPT_TYPES, 0);
    DWORD status = 0;
    if (req) {
        WinHttpSetTimeouts(req, 1000, 1000, 2000, 3000);
        if (WinHttpSendRequest(req, WINHTTP_NO_ADDITIONAL_HEADERS, 0, WINHTTP_NO_REQUEST_DATA, 0, 0, 0) && WinHttpReceiveResponse(req, NULL)) {
            DWORD size = sizeof(status);
            WinHttpQueryHeaders(req, WINHTTP_QUERY_STATUS_CODE | WINHTTP_QUERY_FLAG_NUMBER, NULL, &status, &size, NULL);
            body.clear();
            DWORD avail = 0;
            while (WinHttpQueryDataAvailable(req, &avail) && avail > 0) {
                std::string chunk(avail, '\0');
                DWORD read = 0;
                if (!WinHttpReadData(req, &chunk[0], avail, &read) || read == 0) break;
                body.append(chunk.data(), read);
            }
        }
        WinHttpCloseHandle(req);
    }
    WinHttpCloseHandle(conn);
    return status;
}

static bool FetchQuotes(HINTERNET session, std::string& body) {
    return FetchPath(session, L"/api/platforms/quotes", body) == 200;
}

// ---- Bars of history (=RTD(…,"TCS","BAR","5m",1,"CLOSE")) ----
struct Bar { double t = 0, o = 0, h = 0, l = 0, c = 0, v = 0; };

// Keyed by "TICKER\tTF"; all guarded by g_barMutex
static std::mutex g_barMutex;
static std::map<std::string, int> g_barWants;                 // how many bars the open cells need
static std::map<std::string, std::vector<Bar>> g_bars;        // newest first (bar 1 = forming)
static std::map<std::string, std::string> g_barErrors;        // the engine's answer when it has none

static std::string BarKey(const std::string& ticker, const std::string& tf) { return ticker + "\t" + tf; }

// "unixSec|o|h|l|c|v" lines, newest first
static std::vector<Bar> ParseBars(const std::string& text) {
    std::vector<Bar> out;
    size_t pos = 0;
    while (pos < text.size()) {
        size_t end = text.find('\n', pos);
        if (end == std::string::npos) end = text.size();
        std::string line = text.substr(pos, end - pos);
        pos = end + 1;
        std::vector<double> f;
        size_t a = 0;
        for (;;) {
            size_t b = line.find('|', a);
            f.push_back(strtod(line.substr(a, b == std::string::npos ? std::string::npos : b - a).c_str(), NULL));
            if (b == std::string::npos) break;
            a = b + 1;
        }
        if (f.size() < 6 || f[0] <= 0) continue;
        Bar bar;
        bar.t = f[0]; bar.o = f[1]; bar.h = f[2]; bar.l = f[3]; bar.c = f[4]; bar.v = f[5];
        out.push_back(bar);
    }
    return out;
}

static std::wstring UrlPart(const std::string& s) {
    static const char* hex = "0123456789ABCDEF";
    std::wstring out;
    for (unsigned char c : s) {
        if (isalnum(c) || c == '-' || c == '_' || c == '.' || c == '~') out += (wchar_t)c;
        else { out += L'%'; out += (wchar_t)hex[c >> 4]; out += (wchar_t)hex[c & 15]; }
    }
    return out;
}

// Every key the open cells ask for, fetched again (the forming bar moves with each tick)
static void FetchBars(HINTERNET session) {
    std::map<std::string, int> wants;
    { std::lock_guard<std::mutex> lk(g_barMutex); wants = g_barWants; }
    static std::map<std::string, std::string> lastBodies;   // poller thread only
    for (auto& w : wants) {
        size_t tab = w.first.find('\t');
        std::string ticker = w.first.substr(0, tab), tf = w.first.substr(tab + 1);
        std::wstring path = L"/api/platforms/bars?ticker=" + UrlPart(ticker) + L"&tf=" + UrlPart(tf) + L"&n=" + std::to_wstring(w.second);
        std::string body;
        DWORD status = FetchPath(session, path, body);
        if (status == 0) return;   // engine gone: the quotes loop says so
        std::string tag = std::to_string(status) + ":" + body;
        if (lastBodies[w.first] == tag) continue;
        lastBodies[w.first] = tag;
        {
            std::lock_guard<std::mutex> lk(g_barMutex);
            if (status == 200) { g_bars[w.first] = ParseBars(body); g_barErrors.erase(w.first); }
            else { g_bars.erase(w.first); g_barErrors[w.first] = body.empty() ? "No bars (" + std::to_string(status) + ")" : body; }
        }
        g_version++;
    }
}

class Poller {
public:
    void Start() {
        if (running_.exchange(true)) return;
        thread_ = std::thread([this] { Run(); });
    }
    void Stop() {
        if (!running_.exchange(false)) return;
        if (thread_.joinable()) thread_.join();
    }
private:
    void Run() {
        HINTERNET session = WinHttpOpen(L"DataBridgeRTD/1.0", WINHTTP_ACCESS_TYPE_NO_PROXY, WINHTTP_NO_PROXY_NAME, WINHTTP_NO_PROXY_BYPASS, 0);
        std::string body, lastBody;
        unsigned round = 0;
        while (running_) {
            bool ok = session && FetchQuotes(session, body);
            // Bars once a second, only while some cell shows one
            if (ok && (round++ % 2) == 0) FetchBars(session);
            if (ok) {
                if (body != lastBody) {
                    auto parsed = ParseQuotes(body);
                    { std::lock_guard<std::mutex> lk(g_quoteMutex); g_quotes.swap(parsed); }
                    lastBody = body;
                    g_everReceived = true;
                    g_version++;
                }
                if (!g_engineUp.exchange(true)) g_version++;
            } else if (g_engineUp.exchange(false)) {
                g_version++;
            }
            // Twice a second; quick to notice Excel closing
            for (int i = 0; i < 5 && running_; i++) Sleep(100);
        }
        if (session) WinHttpCloseHandle(session);
    }
    std::atomic<bool> running_{false};
    std::thread thread_;
};

// ---- What a cell shows ----
static VARIANT Num(double v) { VARIANT r; VariantInit(&r); r.vt = VT_R8; r.dblVal = v; return r; }
static VARIANT Text(const std::wstring& s) { VARIANT r; VariantInit(&r); r.vt = VT_BSTR; r.bstrVal = SysAllocString(s.c_str()); return r; }
static std::wstring Wide(const std::string& s) { return std::wstring(s.begin(), s.end()); }

// Unix ms → Excel date-time (local time of this PC)
static VARIANT ExcelTime(double unixMs) {
    VARIANT r; VariantInit(&r);
    if (unixMs <= 0) return Text(L"");
    ULONGLONG ft = (ULONGLONG)(unixMs * 10000.0) + 116444736000000000ULL;
    FILETIME utc = { (DWORD)ft, (DWORD)(ft >> 32) }, local;
    SYSTEMTIME st;
    FileTimeToLocalFileTime(&utc, &local);
    FileTimeToSystemTime(&local, &st);
    r.vt = VT_DATE;
    SystemTimeToVariantTime(&st, &r.date);
    return r;
}

static VARIANT ValueFor(const std::string& ticker, const std::string& field) {
    if (!g_everReceived) return Text(g_engineUp ? L"Waiting for prices" : L"DataBridge Pro is not running");
    Quote q;
    {
        std::lock_guard<std::mutex> lk(g_quoteMutex);
        auto it = g_quotes.find(ticker);
        if (it == g_quotes.end()) return Text(L"Not in DataBridge: " + Wide(ticker));
        q = it->second;
    }
    const std::string& f = field;
    if (f == "LTP" || f == "LAST" || f == "PRICE" || f == "CLOSE") return Num(q.ltp);
    if (f == "OPEN") return Num(q.open);
    if (f == "HIGH") return Num(q.high);
    if (f == "LOW") return Num(q.low);
    if (f == "PREVCLOSE" || f == "PREV" || f == "PREVIOUSCLOSE") return Num(q.prev);
    if (f == "CHANGE" || f == "CHG") return Num(q.change);
    if (f == "CHANGE%" || f == "CHG%" || f == "PCHANGE" || f == "CHANGEPCT") return Num(q.changePct);
    if (f == "VOLUME" || f == "VOL") return Num(q.volume);
    if (f == "OI" || f == "OPENINTEREST") return Num(q.oi);
    if (f == "BID") return Num(q.bid);
    if (f == "ASK") return Num(q.ask);
    if (f == "TIME" || f == "LASTTRADETIME") return ExcelTime(q.timeMs);
    if (f == "LOT" || f == "LOTSIZE") return Num(q.lot);
    if (f == "STATUS") return Text(Wide(q.status));
    return Text(L"Unknown field " + Wide(f) + L" (LTP, OPEN, HIGH, LOW, PREVCLOSE, CHANGE, CHANGE%, VOLUME, OI, BID, ASK, TIME, LOT, STATUS)");
}

// One bar's field: index 1 = the bar forming now, 2 = the one before…
static VARIANT BarValue(const std::string& ticker, const std::string& tf, int index, const std::string& field) {
    std::string key = BarKey(ticker, tf);
    Bar b;
    {
        std::lock_guard<std::mutex> lk(g_barMutex);
        auto err = g_barErrors.find(key);
        if (err != g_barErrors.end()) return Text(Wide(err->second) + L": " + Wide(ticker));
        auto it = g_bars.find(key);
        if (it == g_bars.end()) return Text(g_engineUp ? L"Loading bars" : L"DataBridge Pro is not running");
        if (index < 1 || index > (int)it->second.size()) return Text(L"");   // older than the stored history
        b = it->second[index - 1];
    }
    const std::string& f = field;
    if (f == "TIME" || f == "DATE" || f == "DATETIME") return ExcelTime(b.t * 1000.0);
    if (f == "OPEN" || f == "O") return Num(b.o);
    if (f == "HIGH" || f == "H") return Num(b.h);
    if (f == "LOW" || f == "L") return Num(b.l);
    if (f == "CLOSE" || f == "C" || f == "LTP" || f == "LAST") return Num(b.c);
    if (f == "VOLUME" || f == "VOL" || f == "V") return Num(b.v);
    return Text(L"Unknown bar field " + Wide(f) + L" (TIME, OPEN, HIGH, LOW, CLOSE, VOLUME)");
}

static bool SameValue(const VARIANT& a, const VARIANT& b) {
    if (a.vt != b.vt) return false;
    if (a.vt == VT_R8) return a.dblVal == b.dblVal;
    if (a.vt == VT_DATE) return a.date == b.date;
    if (a.vt == VT_BSTR) return wcscmp(a.bstrVal ? a.bstrVal : L"", b.bstrVal ? b.bstrVal : L"") == 0;
    return false;
}

// ---- The server ----
struct Topic {
    std::string ticker, field;
    // "BAR" topics: timeframe, which bar (1 = forming) and which of its values
    std::string tf, barField;
    int index = 1;
    VARIANT last;
};

static VARIANT TopicValue(const Topic& t) {
    if (t.field == "BAR") return BarValue(t.ticker, t.tf, t.index, t.barField);
    return ValueFor(t.ticker, t.field);
}

static const UINT_PTR TIMER_ID = 1;
static const UINT TIMER_MS = 300;

class RtdServer : public IRtdServer {
public:
    RtdServer() { g_objects++; LoadTypeInfo(); }
    ~RtdServer() {
        Shutdown();
        if (typeInfo_) typeInfo_->Release();
        g_objects--;
    }

    // IUnknown
    HRESULT STDMETHODCALLTYPE QueryInterface(REFIID riid, void** ppv) override {
        if (!ppv) return E_POINTER;
        if (riid == IID_IUnknown || riid == IID_IDispatch || riid == IID_IRtdServer) { *ppv = static_cast<IRtdServer*>(this); AddRef(); return S_OK; }
        *ppv = NULL;
        return E_NOINTERFACE;
    }
    ULONG STDMETHODCALLTYPE AddRef() override { return ++refs_; }
    ULONG STDMETHODCALLTYPE Release() override { long r = --refs_; if (r == 0) delete this; return r; }

    // IDispatch, through Excel's own description of IRtdServer (used if Excel calls by name)
    HRESULT STDMETHODCALLTYPE GetTypeInfoCount(UINT* n) override { if (!n) return E_POINTER; *n = typeInfo_ ? 1 : 0; return S_OK; }
    HRESULT STDMETHODCALLTYPE GetTypeInfo(UINT i, LCID, ITypeInfo** ti) override {
        if (!ti) return E_POINTER;
        if (i != 0 || !typeInfo_) { *ti = NULL; return DISP_E_BADINDEX; }
        typeInfo_->AddRef(); *ti = typeInfo_; return S_OK;
    }
    HRESULT STDMETHODCALLTYPE GetIDsOfNames(REFIID, LPOLESTR* names, UINT count, LCID, DISPID* ids) override {
        return typeInfo_ ? DispGetIDsOfNames(typeInfo_, names, count, ids) : E_NOTIMPL;
    }
    HRESULT STDMETHODCALLTYPE Invoke(DISPID id, REFIID, LCID, WORD flags, DISPPARAMS* params, VARIANT* result, EXCEPINFO* ex, UINT* argErr) override {
        return typeInfo_ ? DispInvoke(static_cast<IRtdServer*>(this), typeInfo_, id, flags, params, result, ex, argErr) : E_NOTIMPL;
    }

    // IRtdServer
    HRESULT STDMETHODCALLTYPE ServerStart(IRTDUpdateEvent* callback, long* result) override {
        if (!callback || !result) return E_POINTER;
        callback_ = callback;
        callback_->AddRef();
        CreateTimerWindow();
        poller_.Start();
        *result = 1;
        return S_OK;
    }

    HRESULT STDMETHODCALLTYPE ConnectData(long topicId, SAFEARRAY** strings, VARIANT_BOOL* getNewValues, VARIANT* value) override {
        if (!strings || !*strings || !value) return E_POINTER;
        std::vector<std::string> args;
        LONG lo = 0, hi = -1;
        SafeArrayGetLBound(*strings, 1, &lo);
        SafeArrayGetUBound(*strings, 1, &hi);
        for (LONG i = lo; i <= hi; i++) {
            VARIANT v; VariantInit(&v);
            if (SUCCEEDED(SafeArrayGetElement(*strings, &i, &v))) {
                VARIANT s; VariantInit(&s);
                if (SUCCEEDED(VariantChangeType(&s, &v, 0, VT_BSTR)) && s.bstrVal) {
                    int n = WideCharToMultiByte(CP_UTF8, 0, s.bstrVal, -1, NULL, 0, NULL, NULL);
                    std::string a(n > 0 ? n - 1 : 0, '\0');
                    if (n > 1) WideCharToMultiByte(CP_UTF8, 0, s.bstrVal, -1, &a[0], n, NULL, NULL);
                    args.push_back(a);
                }
                VariantClear(&s);
            }
            VariantClear(&v);
        }
        Topic t;
        t.ticker = Upper(args.size() > 0 ? Trim(args[0]) : "");
        t.field = Upper(args.size() > 1 ? Trim(args[1]) : "LTP");
        if (t.field.empty()) t.field = "LTP";
        if (t.field == "BAR") {
            t.tf = Upper(args.size() > 2 && !Trim(args[2]).empty() ? Trim(args[2]) : "1M");
            t.index = args.size() > 3 ? atoi(Trim(args[3]).c_str()) : 1;
            if (t.index < 1) t.index = 1;
            if (t.index > 2000) t.index = 2000;
            t.barField = Upper(args.size() > 4 && !Trim(args[4]).empty() ? Trim(args[4]) : "CLOSE");
        }
        VariantInit(&t.last);
        VARIANT now = t.ticker.empty() ? Text(L"Give a symbol: =RTD(\"DataBridge.RTD\",,\"RELIANCE\",\"LTP\")") : TopicValue(t);
        VariantCopy(&t.last, &now);
        VariantInit(value);
        VariantCopy(value, &now);
        VariantClear(&now);
        topics_[topicId] = t;
        if (t.field == "BAR") UpdateBarWants();
        if (getNewValues) *getNewValues = VARIANT_TRUE;
        return S_OK;
    }

    HRESULT STDMETHODCALLTYPE RefreshData(long* topicCount, SAFEARRAY** data) override {
        if (!topicCount || !data) return E_POINTER;
        std::vector<std::pair<long, VARIANT>> changed;
        for (auto& kv : topics_) {
            if (kv.second.ticker.empty()) continue;
            VARIANT v = TopicValue(kv.second);
            if (SameValue(v, kv.second.last)) { VariantClear(&v); continue; }
            VariantClear(&kv.second.last);
            VariantCopy(&kv.second.last, &v);
            changed.push_back({ kv.first, v });
        }
        SAFEARRAYBOUND bounds[2];
        bounds[0].lLbound = 0; bounds[0].cElements = 2;
        bounds[1].lLbound = 0; bounds[1].cElements = (ULONG)changed.size();
        SAFEARRAY* out = SafeArrayCreate(VT_VARIANT, 2, bounds);
        if (!out) { for (auto& c : changed) VariantClear(&c.second); return E_OUTOFMEMORY; }
        for (LONG i = 0; i < (LONG)changed.size(); i++) {
            LONG idx[2];
            VARIANT id; VariantInit(&id); id.vt = VT_I4; id.lVal = changed[i].first;
            idx[0] = 0; idx[1] = i; SafeArrayPutElement(out, idx, &id);
            idx[0] = 1; idx[1] = i; SafeArrayPutElement(out, idx, &changed[i].second);
            VariantClear(&changed[i].second);
        }
        *topicCount = (long)changed.size();
        *data = out;
        notified_ = false;
        return S_OK;
    }

    HRESULT STDMETHODCALLTYPE DisconnectData(long topicId) override {
        auto it = topics_.find(topicId);
        if (it != topics_.end()) {
            bool bar = it->second.field == "BAR";
            VariantClear(&it->second.last);
            topics_.erase(it);
            if (bar) UpdateBarWants();
        }
        return S_OK;
    }

    HRESULT STDMETHODCALLTYPE Heartbeat(long* result) override { if (!result) return E_POINTER; *result = 1; return S_OK; }

    HRESULT STDMETHODCALLTYPE ServerTerminate() override { Shutdown(); return S_OK; }

private:
    // Which symbol + timeframe pairs the poller fetches, and how many bars back the cells reach
    void UpdateBarWants() {
        std::map<std::string, int> wants;
        for (auto& kv : topics_) {
            if (kv.second.field != "BAR" || kv.second.ticker.empty()) continue;
            int& n = wants[BarKey(kv.second.ticker, kv.second.tf)];
            if (kv.second.index > n) n = kv.second.index;
        }
        std::lock_guard<std::mutex> lk(g_barMutex);
        g_barWants.swap(wants);
    }

    static std::string Trim(const std::string& s) {
        size_t a = s.find_first_not_of(" \t"), b = s.find_last_not_of(" \t");
        return a == std::string::npos ? "" : s.substr(a, b - a + 1);
    }

    void LoadTypeInfo() {
        ITypeLib* lib = NULL;
        for (WORD minor = 9; minor >= 5 && !lib; minor--) {
            if (FAILED(LoadRegTypeLib(LIBID_Excel, 1, minor, 0, &lib))) lib = NULL;
        }
        if (lib) { lib->GetTypeInfoOfGuid(IID_IRtdServer, &typeInfo_); lib->Release(); }
    }

    // A message-only window on Excel's thread: its timer is where Excel is told about new values
    static LRESULT CALLBACK WndProc(HWND hwnd, UINT msg, WPARAM wp, LPARAM lp) {
        if (msg == WM_TIMER && wp == TIMER_ID) {
            auto self = reinterpret_cast<RtdServer*>(GetWindowLongPtrW(hwnd, GWLP_USERDATA));
            if (self) self->OnTimer();
            return 0;
        }
        return DefWindowProcW(hwnd, msg, wp, lp);
    }

    void CreateTimerWindow() {
        WNDCLASSW wc = {};
        wc.lpfnWndProc = WndProc;
        wc.hInstance = g_module;
        wc.lpszClassName = L"DataBridgeRtdTimer";
        RegisterClassW(&wc);
        hwnd_ = CreateWindowExW(0, wc.lpszClassName, L"", 0, 0, 0, 0, 0, HWND_MESSAGE, NULL, g_module, NULL);
        if (hwnd_) {
            SetWindowLongPtrW(hwnd_, GWLP_USERDATA, reinterpret_cast<LONG_PTR>(this));
            SetTimer(hwnd_, TIMER_ID, TIMER_MS, NULL);
        }
    }

    void OnTimer() {
        long v = g_version.load();
        if (v == seenVersion_ || !callback_ || topics_.empty()) return;
        seenVersion_ = v;
        // One notice until Excel has collected the values (again after 5 s, in case Excel was busy
        // editing a cell and dropped it)
        ULONGLONG now = GetTickCount64();
        if (!notified_ || now - notifiedAt_ > 5000) { notified_ = true; notifiedAt_ = now; callback_->UpdateNotify(); }
    }

    void Shutdown() {
        poller_.Stop();
        if (hwnd_) { KillTimer(hwnd_, TIMER_ID); DestroyWindow(hwnd_); hwnd_ = NULL; }
        for (auto& kv : topics_) VariantClear(&kv.second.last);
        topics_.clear();
        if (callback_) { callback_->Release(); callback_ = NULL; }
    }

    std::atomic<long> refs_{1};
    ITypeInfo* typeInfo_ = NULL;
    IRTDUpdateEvent* callback_ = NULL;
    HWND hwnd_ = NULL;
    std::map<long, Topic> topics_;
    long seenVersion_ = -1;
    bool notified_ = false;
    ULONGLONG notifiedAt_ = 0;
    Poller poller_;
};

// ---- COM plumbing ----
class Factory : public IClassFactory {
public:
    HRESULT STDMETHODCALLTYPE QueryInterface(REFIID riid, void** ppv) override {
        if (!ppv) return E_POINTER;
        if (riid == IID_IUnknown || riid == IID_IClassFactory) { *ppv = static_cast<IClassFactory*>(this); AddRef(); return S_OK; }
        *ppv = NULL;
        return E_NOINTERFACE;
    }
    ULONG STDMETHODCALLTYPE AddRef() override { return 2; }
    ULONG STDMETHODCALLTYPE Release() override { return 1; }
    HRESULT STDMETHODCALLTYPE CreateInstance(IUnknown* outer, REFIID riid, void** ppv) override {
        if (outer) return CLASS_E_NOAGGREGATION;
        RtdServer* s = new (std::nothrow) RtdServer();
        if (!s) return E_OUTOFMEMORY;
        HRESULT hr = s->QueryInterface(riid, ppv);
        s->Release();
        return hr;
    }
    HRESULT STDMETHODCALLTYPE LockServer(BOOL lock) override { if (lock) g_locks++; else g_locks--; return S_OK; }
};
static Factory g_factory;

extern "C" BOOL WINAPI DllMain(HINSTANCE h, DWORD reason, LPVOID) {
    if (reason == DLL_PROCESS_ATTACH) { g_module = h; DisableThreadLibraryCalls(h); }
    return TRUE;
}

extern "C" HRESULT __stdcall DllGetClassObject(REFCLSID clsid, REFIID riid, void** ppv) {
    if (clsid != CLSID_DataBridgeRtd) return CLASS_E_CLASSNOTAVAILABLE;
    return g_factory.QueryInterface(riid, ppv);
}

extern "C" HRESULT __stdcall DllCanUnloadNow() { return g_objects == 0 && g_locks == 0 ? S_OK : S_FALSE; }

static bool SetKey(const std::wstring& key, const wchar_t* name, const std::wstring& value) {
    HKEY h;
    if (RegCreateKeyExW(HKEY_CURRENT_USER, key.c_str(), 0, NULL, 0, KEY_WRITE, NULL, &h, NULL) != ERROR_SUCCESS) return false;
    LONG r = RegSetValueExW(h, name, 0, REG_SZ, (const BYTE*)value.c_str(), (DWORD)((value.size() + 1) * sizeof(wchar_t)));
    RegCloseKey(h);
    return r == ERROR_SUCCESS;
}

// Per user: HKCU\Software\Classes (no administrator rights needed)
extern "C" HRESULT __stdcall DllRegisterServer() {
    wchar_t path[MAX_PATH];
    if (!GetModuleFileNameW(g_module, path, MAX_PATH)) return SELFREG_E_CLASS;
    std::wstring classes = L"Software\\Classes\\";
    std::wstring clsidKey = classes + L"CLSID\\" + CLSID_TEXT;
    bool ok = SetKey(classes + PROGID, NULL, L"DataBridge Pro live prices")
        && SetKey(classes + PROGID + L"\\CLSID", NULL, CLSID_TEXT)
        && SetKey(clsidKey, NULL, L"DataBridge Pro live prices")
        && SetKey(clsidKey + L"\\ProgID", NULL, PROGID)
        && SetKey(clsidKey + L"\\InprocServer32", NULL, path)
        && SetKey(clsidKey + L"\\InprocServer32", L"ThreadingModel", L"Apartment");
    return ok ? S_OK : SELFREG_E_CLASS;
}

extern "C" HRESULT __stdcall DllUnregisterServer() {
    std::wstring classes = L"Software\\Classes\\";
    RegDeleteTreeW(HKEY_CURRENT_USER, (classes + PROGID).c_str());
    RegDeleteTreeW(HKEY_CURRENT_USER, (classes + L"CLSID\\" + CLSID_TEXT).c_str());
    return S_OK;
}
