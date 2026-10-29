//+------------------------------------------------------------------+
//| DataBridge.mq5 — DataBridge Pro prices as MetaTrader 5 custom    |
//| symbols (history and live 1-minute bars).                        |
//|                                                                  |
//| DataBridge Pro writes into this terminal's MQL5\Files\DataBridge: |
//|   symbols.txt          TICKER|digits|lot|description per line     |
//|   hist\<TICKER>.csv    full 1-minute history: time,o,h,l,c,v      |
//|   recent.csv           the last few days of every symbol:         |
//|                        TICKER,time,o,h,l,c,v (refreshed each min) |
//|   live.csv             the forming bar of every symbol (each sec) |
//| Times are India time written as seconds, so charts show NSE hours.|
//| This service reads them (only files that changed) and updates     |
//| custom symbols under Custom\DataBridge. Start it once from the    |
//| Navigator (Services → DataBridge → Start); MT5 restarts it itself.|
//+------------------------------------------------------------------+
#property service
#property copyright "DataBridge Pro"
#property version   "1.00"
#property description "DataBridge Pro live and historical Indian market data as custom symbols"

#define DIR       "DataBridge\\"
#define GROUP     "DataBridge"
#define POLL_MS   500

string   g_known[];        // custom symbols created so far
string   g_histName[];     // history files imported, with their file time
datetime g_histTime[];
datetime g_symbolsTime = 0, g_recentTime = 0, g_liveTime = 0;

//--- file time, or 0 when the file isn't there
datetime FileTime(const string name)
  {
   if(!FileIsExist(name)) return 0;
   return (datetime)FileGetInteger(name, FILE_MODIFY_DATE, false);
  }

int OpenText(const string name)
  {
   return FileOpen(name, FILE_READ | FILE_TXT | FILE_ANSI | FILE_SHARE_READ | FILE_SHARE_WRITE);
  }

bool IsKnown(const string sym)
  {
   for(int i = ArraySize(g_known) - 1; i >= 0; i--) if(g_known[i] == sym) return true;
   return false;
  }

//--- creates (or updates) a custom symbol
void EnsureSymbol(const string sym, const int digits, const double lot, const string description)
  {
   if(!SymbolInfoInteger(sym, SYMBOL_CUSTOM))
     {
      if(!CustomSymbolCreate(sym, GROUP, NULL))
        {
         // A broker symbol with the same name: leave it alone
         if(!SymbolInfoInteger(sym, SYMBOL_CUSTOM)) { PrintFormat("DataBridge: cannot create %s (error %d)", sym, GetLastError()); return; }
        }
     }
   CustomSymbolSetInteger(sym, SYMBOL_DIGITS, digits);
   CustomSymbolSetDouble(sym, SYMBOL_POINT, MathPow(10.0, -digits));
   CustomSymbolSetInteger(sym, SYMBOL_CHART_MODE, SYMBOL_CHART_MODE_LAST);
   if(lot > 0) CustomSymbolSetDouble(sym, SYMBOL_TRADE_CONTRACT_SIZE, lot);
   if(description != "") CustomSymbolSetString(sym, SYMBOL_DESCRIPTION, description);
   CustomSymbolSetString(sym, SYMBOL_CURRENCY_BASE, "INR");
   CustomSymbolSetString(sym, SYMBOL_CURRENCY_PROFIT, "INR");
   SymbolSelect(sym, true);
   if(!IsKnown(sym)) { int n = ArraySize(g_known); ArrayResize(g_known, n + 1); g_known[n] = sym; }
  }

void ReadSymbols()
  {
   string name = DIR + "symbols.txt";
   datetime t = FileTime(name);
   if(t == 0 || t == g_symbolsTime) return;
   int h = OpenText(name);
   if(h == INVALID_HANDLE) return;
   while(!FileIsEnding(h))
     {
      string line = FileReadString(h);
      string f[];
      if(StringSplit(line, '|', f) < 2 || f[0] == "") continue;
      EnsureSymbol(f[0], (int)StringToInteger(f[1]), ArraySize(f) > 2 ? StringToDouble(f[2]) : 0, ArraySize(f) > 3 ? f[3] : "");
     }
   FileClose(h);
   g_symbolsTime = t;
  }

//--- "time,o,h,l,c,v" → a bar
bool ParseBar(string &f[], const int at, MqlRates &r)
  {
   if(ArraySize(f) < at + 6) return false;
   r.time        = (datetime)StringToInteger(f[at]);
   r.open        = StringToDouble(f[at + 1]);
   r.high        = StringToDouble(f[at + 2]);
   r.low         = StringToDouble(f[at + 3]);
   r.close       = StringToDouble(f[at + 4]);
   r.tick_volume = (long)StringToDouble(f[at + 5]);
   r.real_volume = r.tick_volume;
   r.spread      = 0;
   return r.time > 0 && r.open > 0 && r.close > 0;
  }

void ImportHistoryFile(const string file)
  {
   string path = DIR + "hist\\" + file;
   datetime t = FileTime(path);
   int slot = -1;
   for(int i = ArraySize(g_histName) - 1; i >= 0; i--) if(g_histName[i] == file) { slot = i; break; }
   if(slot >= 0 && g_histTime[slot] == t) return;
   string sym = StringSubstr(file, 0, StringLen(file) - 4);   // "RELIANCE.csv" → RELIANCE
   if(!IsKnown(sym)) return;
   int h = OpenText(path);
   if(h == INVALID_HANDLE) return;
   MqlRates rates[];
   int n = 0;
   ArrayResize(rates, 0, 100000);
   while(!FileIsEnding(h))
     {
      string f[];
      if(StringSplit(FileReadString(h), ',', f) < 6) continue;
      MqlRates r;
      if(!ParseBar(f, 0, r)) continue;
      ArrayResize(rates, n + 1, 100000);
      rates[n++] = r;
     }
   FileClose(h);
   if(n > 0 && CustomRatesReplace(sym, rates[0].time, rates[n - 1].time, rates) < 0)
      PrintFormat("DataBridge: history of %s not loaded (error %d)", sym, GetLastError());
   if(slot < 0) { slot = ArraySize(g_histName); ArrayResize(g_histName, slot + 1); ArrayResize(g_histTime, slot + 1); g_histName[slot] = file; }
   g_histTime[slot] = t;
  }

void ImportHistory()
  {
   string file;
   long finder = FileFindFirst(DIR + "hist\\*.csv", file);
   if(finder == INVALID_HANDLE) return;
   do ImportHistoryFile(file); while(FileFindNext(finder, file) && !IsStopped());
   FileFindClose(finder);
  }

//--- recent.csv / live.csv: "TICKER,time,o,h,l,c,v" — each bar added or replaced
void ApplyBars(const string name, datetime &seen, const bool tick)
  {
   datetime t = FileTime(DIR + name);
   if(t == 0 || t == seen) return;
   int h = OpenText(DIR + name);
   if(h == INVALID_HANDLE) return;
   while(!FileIsEnding(h))
     {
      string f[];
      if(StringSplit(FileReadString(h), ',', f) < 7 || !IsKnown(f[0])) continue;
      MqlRates r[1];
      if(!ParseBar(f, 1, r[0])) continue;
      CustomRatesUpdate(f[0], r);
      if(tick)
        {
         // The price in Market Watch follows the last trade
         MqlTick k[1];
         ZeroMemory(k);
         k[0].time = r[0].time;
         k[0].time_msc = (long)r[0].time * 1000;
         k[0].bid = r[0].close; k[0].ask = r[0].close; k[0].last = r[0].close;
         k[0].flags = TICK_FLAG_BID | TICK_FLAG_ASK | TICK_FLAG_LAST;
         CustomTicksAdd(f[0], k);
        }
     }
   FileClose(h);
   seen = t;
  }

void OnStart()
  {
   Print("DataBridge: started, reading MQL5\\Files\\DataBridge");
   while(!IsStopped())
     {
      ReadSymbols();
      ImportHistory();
      ApplyBars("recent.csv", g_recentTime, false);
      ApplyBars("live.csv", g_liveTime, true);
      Sleep(POLL_MS);
     }
  }
