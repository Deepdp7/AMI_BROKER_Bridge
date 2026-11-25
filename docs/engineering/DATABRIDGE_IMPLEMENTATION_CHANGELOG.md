# DataBridge Pro: implementation changelog

One entry per stage, newest at the top. An entry is written when its stage is finished and verified, never before. Entries record what changed, the evidence that it works, and what was not done.

## Template

```
## Stage N: <title> (YYYY-MM-DD, commit <hash>)

**Findings addressed:** B1, P3, …
**Discrepancies found while verifying:** none / see ROOT_CAUSE_ANALYSIS "Discrepancies"

**Changes**
- <file>: <what changed and why, one line each>

**Checks**
- npm run typecheck --prefix apps/server: pass
- npm test --prefix apps/server: N passed, 0 failed
- npm run typecheck --prefix apps/desktop: pass
- npm test --prefix apps/desktop: N passed, 0 failed
- npm run build:plugin / npm run test:plugin: pass / not affected
- Harness integrity: 0 mismatches (<scenarios>)

**Before → after** (p50 / p99 / max)
| Metric | Before | After |
|---|---|---|

**Not done / follow-ups**
- …

**For the user**
- e.g. install the rebuilt DLL (close AmiBroker first, keep DataBridgePro.dll.bak); run the live checklist
```

---

## Audit and plan (2026-11-25, no code changes)

- Wrote the eight engineering documents in `docs/engineering/` from a full audit of the engine, the plugin, the database, the IPC channel and the app at commit `8bdf906`.
- Added `DATABRIDGE_DEPLOYMENT_ARCHITECTURE.md`: the fully local architecture stays the default, SQLite stays, and no central data VPS (broker terms and NSE licensing). It changes nothing in Stages 0–9.
- No source files were changed.
- Next: Stage 0 (instrumentation and baseline harness).

## Stage 8: reliability and recovery (2026-11-25)

**Findings addressed:** 8a, 8b, 8c, 8d, 8e (no B/P/D numbers: the stage is the roadmap's own). Verified against the code at `4b04423` first: as described, except where the Discrepancies say otherwise (five rows).

**Changes**
- Engine, four feeds (`DhanFeed`, `KiteTicker`, `AngelFeed`, `UpstoxFeed`) (8a): `disconnected` is reported once per outage, not for each failed attempt to get back; `connected` starts a new outage account. All seven feeds already reported drops and recoveries.
- Engine `db/index.ts` (8c): when the database does not take writes, the live bars wait in memory and are tried again after 4, 8, 16 s and then every 30 s (before: every 2 s, and at every read); a warning at 50,000 waiting; above 500,000 the oldest are given up down to 450,000, said in the log each time and announced to `barWrites` as `lost`; one error line a minute while it lasts; one line when saving works again. `BackfillQueue` moves each lost ticker's verified-through mark back to the minute before its first lost bar (`lowerVerifiedThroughMs` in `coverageState`), so the next gap pass fetches those minutes from the broker. The exit flush ignores the wait.
- Engine `brokers/BrokerManager.ts` (8d): the first `auth_failed` of an adapter is handled; later ones from the same adapter are ignored (two reports of one dead token used to announce `auth_required` twice).
- Harness: scenario `restart_storm`.
- Tests: `feedDrops` (8: each of the four feeds twice), `liveWriteFailure` (3), `tokenExpiry` (3: the chain, a late report, the daily re-login). Each was checked against the code it guards (the unguarded Dhan feed, a lifted limit, and the double announcement, which the new test found).

**Checks**
- `npm run typecheck --prefix apps/server`: pass. `npm test --prefix apps/server`: 448 passed, 2 failed (the same 2: noren, upstoxAngel).
- `npm run typecheck --prefix apps/desktop`: pass. `npm test --prefix apps/desktop`: 138 of 138 (not touched).
- The plugin is **not changed** in this stage (no new DLL).

**Measured**
- Restart storm: 300 serial 24-hour catch-ups in 0.28 s (0.95 ms each); loop lag p99 1.7 ms. No change needed.
- The real DLL across an engine stop and start: reconnected, re-synced the 3 viewed symbols, kept updating, `busy` 0.

**Not done / follow-ups**
- **The live part of 8b and 8e** is yours (below).
- The Noren, XTS and Kotak "once per outage" guards were read, not driven by a test (their `connected` follows a protocol reply).
- The daily re-login fires only if the engine is running at exactly 08:50 IST (it checks for that minute): an engine started at 08:51 does not catch up. The 06:00 expiry report and the saved-token login at start cover it; changing it is a separate decision.

**For the user**
- **No new DLL. The engine changes need the rebuilt engine** (`npm run build:server`) or `npm run dev`. **The Stage 2/3 DLL is still not installed** (yours is the 18 Nov build).
- **Live check of an engine restart (8b, 8e)**, in a market session with AmiBroker open on a few charts and a watch list: close DataBridge Pro, wait 30 s, start it again, then (a) the DataBridge light in AmiBroker's status bar goes grey or red and then green by itself; (b) the charts fill in the minutes of the gap within a minute or two, without a block of bars appearing late for symbols you were not looking at; (c) in `C:\Users\Public\DataBridgePro_plugin.log` the next `NOTE|PERF` line shows `catchup_n` (how many symbols re-synced), `catchup_p99` and `busy`: please send me those three numbers.
- If the disk ever fills up, the engine log shows `[DB] Failed to write live bars ... waiting in memory` once a minute, and when space is back `[DB] Live bars are being saved again`.

## Stage 7: resources (2026-11-25)

**Findings addressed:** P11 and the log volume, measured first as the roadmap says; nothing else. Verified against the code at `f6e8a16`.
**Result:** P11 is **not changed** (not needed). One log line made rarer. A regression from Stage 5 found and fixed. Five rows in ROOT_CAUSE_ANALYSIS "Discrepancies".

**Measurements** (details in DATABRIDGE_PERFORMANCE_BASELINE.md, "Resources at the soak rate")
- GC at 2,000 ticks a second (twice the expected rate): 0.08% of the time, longest pause 3.5 ms; at 1,000 ticks a second longest 5.3 ms once in 60 s. CPU 3.8-5.6% of one core, RSS 168-215 MB, loop lag p99 1.1-1.4 ms.
- Log: an idle live session wrote 31 lines a minute, 30 of them `[IPC_LIVE_BAR] Broadcasted` (every 2 s). One line costs about 2.6 microseconds.

**Changes**
- Engine `amibroker/ipcServer.ts`: the `[IPC_LIVE_BAR]` sample line is written once a minute (was every 2 s): 31 lines a minute became 2. `ipc.quotes_deferred` (which counted every held-back symbol at every flush) is replaced by `ipc.quotes_coalesced` (an update that took the place of one already waiting).
- Desktop `lib/activity.ts`: the "Added X" rule reads the batch line `[ADD_SYMBOL] N symbol(s) added to ...` that Stage 5 introduced (and still the per-symbol one). **This was a regression of Stage 5**: after it, adding symbols did not show in the Activity page. A server test now pins the line's form (`symbolManagement`), and a desktop test the rule (`activity.test.ts`).
- Tests: +1 desktop (the batch line, alone and merged with the old one), assertions in `symbolManagement` and `cleanup` (the line's form, the coalesced counter, the sample line once).

**Checks**
- `npm run typecheck --prefix apps/server`: pass. `npm test --prefix apps/server`: 434 passed, 2 failed (the same 2: noren, upstoxAngel).
- `npm run typecheck --prefix apps/desktop`: pass. `npm test --prefix apps/desktop`: 138 of 138 (one new).
- The plugin is **not changed** in this stage (no new DLL). Harness: integrity 0 mismatches.

**Before to after**
| Metric | Before | After |
|---|---|---|
| Log lines of an idle live session, per minute | 31 | **2** |
| GC at twice the tick rate | (not measured) | 0.08% of the time, longest pause 3.5 ms: no change needed |

**Not done / follow-ups**
- **P11 (per-tick allocations): not needed**, see above.
- **BackfillQueue's per-chunk lines and Fyers' `[System Status]` / `[Warning] No Live Data`: left as they are.** They cost nothing measurable, and the Activity page builds its "Downloaded history" and "Some symbols aren't getting live prices" cards from them, so printing them less often would change what the app shows.
- **`backend.log` rotation while running: not done** (needs the engine to own its log file). The real file is 6.7 MB after four weeks and is cut at 20 MB when the engine starts. Worth doing only for an always-on engine.
- The Activity page's rule for `[IPC_CONNECT] AmiBroker connected` matches nothing (the engine stopped printing that line before this work). Adding the line back would make "AmiBroker connected" appear in Activity again: a small separate change, if you want it.
- **Lesson**: the add log line is read by the app. Any engine line the app parses needs a test on both sides; the other lines the app parses were checked against everything changed in Stages 3-7 and match.

**For the user**
- **No new DLL. The engine changes need the rebuilt engine** (`npm run build:server`) or `npm run dev`. **The Stage 2/3 DLL is still not installed on your PC** (the one in AmiBroker's Plugins folder is from 18 Nov).
- After adding symbols, the Activity page should show "Added N symbols" again.
- The Live Console shows an `[IPC_LIVE_BAR]` line once a minute instead of every 2 s: that is intended.

## Stage 6: front-end, back-end and IPC cleanup (2026-11-25)

**Findings addressed:** P14 (6b), P15 (6a), P16 (6e), the QUOTE rate (6d); 6c was done in Stage 4c. Verified against the code at `40b9d0e` first: as described.
**Discrepancies found while verifying and measuring:** six, in ROOT_CAUSE_ANALYSIS "Discrepancies" (6a, 6b, 6d, 6e, and the profile that led to the slice scheduler).

**Changes**
- Engine `app.ts` (6a): the request log leaves out `/api/status/*`, `/api/backfill/status`, `/api/symbols/health`, `/api/ping` besides the paths it left out already.
- Engine `api/routes/feed.ts` (6b): the catch-up answer is the database's text as it is (the query already says `ts > since`); the live line is added only when it is newer than `since` and than the last stored bar, and not for a range (`until`). The answers kept for the 50 ms throttle are bounded at 16 MB in all, the oldest first (`feedCacheStats`, also on the diagnostics page as `feedCache`).
- Engine `amibroker/ipcServer.ts` (6d): a symbol's QUOTE goes out at most every 250 ms, always with its newest figures (what waits is sent by one timer set for the earliest due time); LIVE_BAR is not limited. `ipc.quotes_deferred` counts them.
- Engine `amibroker/ipcServer.ts` (6e): `GET_QUOTES`, which no plugin sends (see the discrepancy row), is answered `END` with a one-time warning; the auto-register code and the imports it needed are gone, and the comments in `config.ts`, `liveFeed.ts` and the README say what the channel carries now.
- Engine `db/index.ts` (a follow-up of 3a, found by profiling): `takeSliceTurn`: history slices take one turn of the event loop each, across all chunks being saved, instead of every chunk yielding for itself.
- Tests: `cleanup` (5: the answer with and without `since`/`until` and its live line, the 16 MB bound over 20 big symbols, the log, the QUOTE rate over real sockets, `GET_QUOTES`), `historySlices` (+1: six chunks at once take 18 turns for 18 slices). The three that follow from breaking the code on purpose (QUOTE limit off, bound lifted, old yield) all fail.

**Checks**
- `npm run typecheck --prefix apps/server`: pass. `npm test --prefix apps/server`: 434 passed, 2 failed (the same 2: noren, upstoxAngel).
- `npm run typecheck --prefix apps/desktop`: pass. `npm test --prefix apps/desktop`: 137 of 137 (not touched).
- The plugin is **not changed** in this stage (no new DLL).
- Harness: integrity 0 mismatches in every run.

**Before to after** (`live500_backfill`, two 90 s runs each; details in DATABRIDGE_PERFORMANCE_BASELINE.md)
| Metric | Before (Stage 4 end) | After |
|---|---|---|
| Loop lag p95 / worst | 16.8 / 77-92 ms | **10.4 / 64-71 ms** (p99 39-43 ms: unchanged) |
| Catch-up answer p50 / p95 / p99 (engine side) | 20-22 / 48 / 58-64 ms | **15 / 33-36 / 40-43 ms** |
| What the plugin waits for an answer, p50 / p99 | 24.5 / 85 ms | **18.4 / 58 ms** |
| Engine memory at its peak | 1.09-1.12 GB | **0.82-0.85 GB** |
| Request-log lines for the app's polling | one per request | none |

**Not done / follow-ups**
- **The loop lag p99 in `live500_backfill` is still about 40 ms.** The profile (CPU, 40 s) shows the main thread idle 70% of the time and nothing above 1% apart from the 2 ms SQLite slices (16%) and the fake broker's JSON parsing (3%): there is no long call left in the engine's own code to remove. The harness runs its fake plugin and fake broker in the same thread and makes 10 chunks a second against a real broker's 45 a minute, so the live baseline is where this number means something. If it is still high there, the next thing to try is moving the JSON parse of a broker's answer off the main thread (Stage 3e's idea, for the parse only).
- `liveFeed.setStreaming` is unused now (only `GET_QUOTES` called it); left in place.
- QUOTE limiting only shows on symbols that change more than 4 times a second.
- The DLL installed in your AmiBroker (`C:\Program Files (x86)\AmiBroker\Plugins\DataBridgePro.dll`) is a build of 18 Nov: it has none of the Stage 2 and 3 plugin changes yet (the notifier, the 120-minute memory, the range catch-up).

**For the user**
- **No new DLL in this stage; but the Stage 2/3 DLL is still not installed** (yours is from 18 Nov): close AmiBroker, keep the old `DataBridgePro.dll` as `DataBridgePro.dll.bak`, copy in `plugins\amibroker\DataBridgePro.dll`, start AmiBroker. It works with the older and the newer engine alike.
- **The engine changes need the rebuilt engine** (`npm run build:server`) or `npm run dev`.
- In the engine log, the polling lines are gone: if you want to check something about the app's polling, `/api/status/feed` and the others are not logged any more.
- If the log shows `[IPC] A plugin sent GET_QUOTES`, an old plugin is installed: tell me.

## Stage 5: symbol management (2026-11-25)

**Findings addressed:** P13 (5a), P7 (5b), P12 (5c). Verified against the code at `3e15e07` first: as described (P13 already reduced by the Stage 0 baseline: the engine's own work is small; the per-symbol subscribe calls, log lines and transactions are what the batching removes).
**Discrepancies found while verifying:** ten, in ROOT_CAUSE_ANALYSIS "Discrepancies" (5a, 5b, 5c).

**Changes**
- Engine `db/index.ts`, `market/liveFeed.ts`, `market/BackfillQueue.ts`, `brokers/addSymbols.ts`, `api/routes/brokers.ts` (5a): `stmts.insertSymbols` saves many symbols in one transaction and updates the symbol cache through an index (linear, not a search per symbol; a failed batch falls back to one at a time); `liveFeed.addSymbolsByTicker` does what `addSymbolByTicker` does with one log line; `enqueueBatch` queues history with one log line. `addSymbolsToBroker(brokerId, symbols, { resolve })` looks the broker's names up 8 at a time, saves, adds to the feed, makes **one** subscribe call, queues history together, writes one summary line, asks for the AmiBroker push. Import CSV (`POST /symbols/import`) keeps its parsing and checks and calls it with `resolve: false`; it waits for the subscribe now.
- Engine `market/liveSlots.ts` (5b): the last 3 looks of each symbol are kept (reports less than 1 s apart count as one); a symbol wants a live place when it was asked for at least twice, 10 s or more apart, within 60 s (a chart reports every 15 s, a scan touches a symbol once); keeping a place is unchanged (a look in the last 5 minutes); at most 5 swaps a round (10 before). Its today gap-fill was already `interactive` (Stage 3b).
- Engine `amibroker/symbolDetails.ts` (5c): what was sent last is kept in `%APPDATA%/DataBridgePro/amibroker/symbol-details.last.json`; a push on connect (`'connect'`) or after symbols were added (`'added'`) sends only the new or changed lines, and nothing at all (no PowerShell, no call into AmiBroker) when none differ; the daily push (`'daily'`) sends everything and waits for the NSE and MCX sessions to be closed; after a push with failures the memory is dropped so the next one sends everything. Each push logs its time (`symbols.push_ms`, `symbols.pushed`). `DATABRIDGE_SYMBOL_PUSH=full` sends everything every time (the old behaviour).
- Tests: `symbolManagement` (10: batch add, resolve concurrency, one subscribe, skipped symbol, import without lookups, re-adding, one log line, liveSlots rules and the cap of 5), `symbolDetails` (+7: first push full, nothing new = no call, only new or changed lines, daily full, failures forgotten, AmiBroker closed, forced full), `symbolImport` (+1: one subscribe for the file), `planLimits` (the existing liveSlots test now looks twice).

**Checks**
- `npm run typecheck --prefix apps/server`: pass. `npm test --prefix apps/server`: 428 passed, 2 failed (the same 2: noren, upstoxAngel). 18 new tests; changing the swap cap back and the two-look rule off on purpose made 4 of them fail.
- `npm run typecheck --prefix apps/desktop`: pass. `npm test --prefix apps/desktop`: 137 of 137 (not touched).
- The plugin is **not changed** in this stage (no new DLL).

**Before to after** (`import500`, details in DATABRIDGE_PERFORMANCE_BASELINE.md)
| Metric | Before | After |
|---|---|---|
| Subscribe calls for 500 symbols | 500 | **1** |
| Log lines | 2,001 | **4** (22 with downloads running) |
| Engine time for the import | 60 ms | 40 ms |
| Loop lag, worst, no downloads | 25 ms | 15 ms |
| Loop lag, worst, downloads started with the import | 241 ms | **63 ms** (Stage 3's slices) |
| Calls into AmiBroker when it connects and nothing changed (438 symbols) | about 2,200 | **0** |

**Not done / follow-ups**
- **P12's real cost (R5) is unmeasured.** Measuring it writes into the user's AmiBroker database. The push now logs how long it takes ("in N s"), for the live checklist.
- **A switched or emptied AmiBroker database** is not noticed on connect any more: its symbol details arrive with the next daily push (after 08:45 IST, outside the sessions), or immediately if `symbol-details.last.json` is deleted. If that turns out to matter, the plugin can tell the engine which database it loaded (a small DLL change).
- A chart newly opened on a symbol without a live place waits for its second look (up to 15 s, then the 10 s round) before it gets one. Until then the auto-refresh keeps it current.
- Each imported symbol still sends its own `backfill_progress` event to the app (the download card shows each); only the log lines were batched.

**For the user**
- **No new DLL.** The plugin is the one from Stage 3. **The engine changes need the rebuilt engine** (`npm run build:server`) or `npm run dev`.
- Import a list (Import CSV, or a Chartink scan): it should be added at once, with a single line in the log.
- Open AmiBroker with DataBridge Pro running and look in the engine log for `[SymbolDetails]`: on the first start after this update it sends everything once ("in N s": please tell me N, and whether AmiBroker stuttered), and after that "up to date, nothing sent".
- If a symbol's name, lot size or tick size is not what the broker's list says in AmiBroker, delete `%APPDATA%/DataBridgePro/amibroker/symbol-details.last.json` and restart AmiBroker: everything is sent again.

## Stage 4: SQLite (2026-11-25)

**Findings addressed:** P2 (4a), B5 (4b, 4c), C1 (A/B, not kept), 4d (plans). Verified against the code at `542159a` first: all as described (checkpoints inside COMMIT with default settings; the health query is the only table scan; reads round-robin over two workers).
**Discrepancies found while verifying and measuring:** seven, all in ROOT_CAUSE_ANALYSIS "Discrepancies" (the important one: the stall that remained after Stage 3 was `learnClosedDays`, not checkpoints).

**Changes**
- Engine `db/maintenance.ts` (new, 4a): a worker with its own read-write connection copies the write-ahead log into the database file (PASSIVE, never blocks the writer) when the log passes 16 MB or a minute after the last one, and empties the log file (TRUNCATE) once nothing was written for 30 s. `db/index.ts`: the engine's own connection keeps an automatic checkpoint only as a last resort (20,000 pages instead of the default 1,000) and `journal_size_limit` is 64 MB; a PASSIVE checkpoint on exit. If the worker dies it is restarted after 30 s and the last-resort limit takes over meanwhile. `DATABRIDGE_MAINTENANCE=0` switches all of it off (the old settings). New metrics: `db.checkpoint_ms` (per mode), `db.checkpoints`, `db.checkpoints_busy`, `db.checkpoint_errors`, `db.maintenance_restarts`.
- Engine `db/reader.ts` (4b): two lanes. `interactive` (one worker) serves the plugin's history requests; `bulk` (two workers) serves gap scans, candles, high/low, backups, health and the exports of the platforms (`platforms/mt5.ts`, `exports.ts`, `liveCsv.ts` ask for it). A request goes to the worker of its lane with the fewest waiting. The probe `readers` shows what waits on each.
- Engine `market/DataHealth.ts`, `db/index.ts`, `db/reader.ts` (4c): `barWrites` ('changed' with the minutes written, 'removed', 'reset') tells what the database wrote. The health keeps per symbol the bars of each IST day (16-bit counts, 2 bytes a day: 3 MB for 438 symbols at 10 years) and counts again only the days written since (a symbol at a time on the bulk lane at first, two requests at once). The old whole-table `dayCounts` is removed. `forgetHealthState()` brings the first-time count back.
- Desktop `DataHealth.tsx` (4c): one request at a time for the health picture; after a repair it asks anew.
- Engine `market/MarketCalendar.ts`: `learnClosedDays` finds each bar's day with integer maths and makes a text date once per day (22 ms to 1.5 ms per chunk of 38,000 bars; same result).
- Settings for measuring only: `DATABRIDGE_SQLITE_CACHE_KIB` (writer page cache), `DATABRIDGE_SQLITE_MMAP_MB` (readers). Not on by default (A/B showed nothing beyond run-to-run variation).
- Harness `tests/perf/explain.ts`: the new query; plans recorded in ROOT_CAUSE_ANALYSIS "Query plans".
- Tests: `dbMaintenance` (the worker copies and empties the log while the writer goes on, the settings of the connection, the lanes, the range counts), `dataHealth` (3 new: only a written day is read, equals a full recount after live bars + history + a new + a removed symbol, a wipe), `marketCalendar` (1), `DataHealth.test.tsx` (1).

**Checks**
- `npm run typecheck --prefix apps/server`: pass. `npm test --prefix apps/server`: 410 passed, 2 failed (the same 2: noren, upstoxAngel). 8 new tests; dropping the `changed` listener on purpose made two of them fail.
- `npm run typecheck --prefix apps/desktop`: pass. `npm test --prefix apps/desktop`: 137 of 137 (one new).
- The plugin is **not changed** in this stage (no new DLL).
- Harness: integrity 0 mismatches in every run.

**Before to after** (details in DATABRIDGE_PERFORMANCE_BASELINE.md)
| Metric | Before | After |
|---|---|---|
| `live500_backfill`: loop.lag_ms p50 / p95 / p99 / max | 2.5-4.0 / 58-200 / 112-266 / 186-317 (Stage 3 build: 0.87 / 43 / 77 / 132 in its best run) | **0.3 / 16.8 / 40 / 77-92** |
| a history slice's transaction (p99 / max) | 16.8-24.5 / 73-80 ms | **2.3-2.7 / 5.4-5.7 ms** |
| longest single piece of one chunk (`learnClosedDays`) | 22 ms | 1.5 ms |
| chunk work (backfill.chunk_cpu_ms p50 / p99) | 43-52 / 77-85 ms | **22-25 / 29-33 ms** |
| engine CPU in that scenario (one core) | 94-98% | **58%** |
| `live500_health`: a plugin catch-up waiting behind the health scan (reader.wait_ms.csv p99 / max) | 1,932 / 1,932 ms | **0.45 / 36.6 ms** |
| `live500_health`: catch-up answer p99 | 1,936 ms | **1.7 ms** |
| `live500_health`: the health picture (compute) | 2,162 ms every time | first 938 ms, then **2.5 ms (p50), 11 ms (p99)** |

**Not done / follow-ups**
- **The loop lag p99 in `live500_backfill` is 40 ms, not under 10 ms.** What is left is not the database: the catch-up answers built on the main thread (P14: `/api/feed/bars` splits, filters and joins the text again, Stage 6b) and the harness's pace (10 chunks a second against a real broker's 45 a minute). 6b is the next step for that number; it can be done before Stage 5 if you prefer.
- **3e (database writer thread) is not needed** on these numbers: see ROADMAP.
- `cache_size` and `mmap_size` could behave differently on a client's 2 GB database than on the harness's: the settings are there for the live checklist.
- The first health picture after a start counts every symbol (one request each, two at a time): about 1 s per 100 symbols-years on this machine, on the bulk lane, so nothing else waits for it.
- The memory: two more worker threads (a third reader, the checkpoint worker), about 10-20 MB.

**For the user**
- **No new DLL.** The plugin is the one from Stage 3.
- **The engine changes need the rebuilt engine** (`npm run build:server`) or `npm run dev`.
- On a market day: do the numbers of the live checklist (`/api/diagnostics/perf`: `db.checkpoint_ms`, `readers`, `reader.wait_ms.csv`) look like the harness? Symbol Setup should show its health lines at once the second time.
- If anything about the database behaves strangely, `DATABRIDGE_MAINTENANCE=0` in the engine's environment restores the old checkpoint settings (and nothing else).
- The log file next to the database (`databridge.db-wal`) can be up to 64 MB while a big download runs; it is emptied when the engine is idle.

## Stage 3: backfill isolation (2026-11-25)

**Findings addressed:** P1 (3a), P6 (3b, 3c), P5 (3d). 3e (database writer thread) not started, see below. Verified against the code at `2130a20` first: all as described.
**Discrepancies found while verifying and measuring:** five, all in ROOT_CAUSE_ANALYSIS "Discrepancies" (3a, 3b twice, 3d twice, the harness's classes).

**Changes**
- Engine `db/index.ts` (3a): `upsertBarsToHistory` commits in slices of `HISTORY_SLICE_ROWS` = 2,000 rows, with a turn of the event loop (`setImmediate`) between slices; same return value; an optional `work.syncMs` collects the time held without a break. `historyRangeSec(bars)` gives the oldest and newest bar of a chunk. `BackfillQueue` redefines `backfill.chunk_cpu_ms` as the sum of the synchronous pieces, and emits `bars_gap_filled` with `{ ticker, fromSec, toSec }` after the last slice.
- Engine `lib/priority.ts` (new) and `lib/RateLimiter.ts` (3b): one queue per class (interactive, refresh, bulk) and one timer; the pacing rules (pause, budget, even spacing, per-second cap, clock-back fix) are kept as they were. After an urgent request had to wait, bulk requests keep to 70% of the minute's budget for a minute. Call sites: `BackfillQueue.fetchChunk` (`interactive` for a symbol AmiBroker is loading or a forced "today" fill, `bulk` otherwise), `AutoRefresh` and the start-up fetch (`refresh`), `DailyHistory` (`bulk`). The setting `historyPriorities` (no screen; on unless set to `false`) turns it off: every request is `refresh`, i.e. first come, first served. New metrics `limiter.wait_ms.<name>.<class>`; the diagnostics page shows `pendingByClass`.
- Engine `AutoRefresh.ts` (3c): no longer waits for a history download (the early return in `tick` and the stop in `run` are gone); `waitingFor` stays in the status, always `null`.
- Engine `ipcServer.ts`, `api/routes/feed.ts`, `db/reader.ts` (3d): `SYNC|ticker|from|to` (an entry keeps the oldest start and the newest end; a notice without an end leaves it open); `/api/feed/bars?until=` and the reader's `ts <= until` (inclusive; the live bar is not appended for a range).
- Plugin `BarMerge.h/.cpp` (3d): `ParseSyncLine`, `SyncRange` (what was announced, as one range, only while every notice had both ends and nothing else was owed), `RetryBackoff` (2 s doubling to 60 s). `DataClient.cpp` / `Plugin.cpp`: a full sync with an announced range fetches `[from - 60, to + 60]` only; the timeouts depend on the size asked for (5,000 minutes or fewer are quick); a failed background catch-up backs off that symbol only, three in a row pause all; `NOTE|PERF` carries `catchup_n` and `catchup_ranged` (at the end of the line).
- Harness: the fake plugin fetches ranges like the new plugin (`--old-sync` behaves like the old one).
- Tests: `historySlices` (slices, `historyRangeSec`, `until` in the database and over HTTP), `historyPriorities` (7 tests on the limiter and the context), `syncRange` (the lines on the wire), 26 new plugin checks.

**Checks**
- `npm run typecheck --prefix apps/server`: pass. `npm test --prefix apps/server`: 402 passed, 2 failed (the same 2: noren, upstoxAngel). 12 new tests; breaking the slice size on purpose was caught.
- `npm run typecheck --prefix apps/desktop`: pass. `npm test --prefix apps/desktop`: 136 of 136 (not touched).
- `npm run build:plugin`: built. `npm run test:plugin`: 105 checks, 0 failed (79 before).
- Harness: integrity 0 mismatches in every run; real DLL against the harness engine: 0 mismatches.

**Before to after** (details in DATABRIDGE_PERFORMANCE_BASELINE.md; `live500_backfill`, 90 s, the "before" run on the same machine in the same sitting, slicing off and the old SYNC behaviour)
| Metric | Before | After |
|---|---|---|
| loop.lag_ms p50 / p95 / p99 / max | 4.0 / 200 / **266** / 317 | 0.87 / 43.4 / **77.0** / 132 (3.5× lower p99; **not under the 10 ms target**) |
| Bar ready to written on AmiBroker's channel (feed_to_ipc) p99 / max | 0.72 / 7.5 ms | 0.25 / 2.2 ms |
| Transaction of a history chunk (db.history_tx_ms) p50 / p99 | 22.3 / 93 ms (25,000 rows) | **1.7** / 24.5 ms (2,000 rows; the p99 is the log checkpoints, 4a) |
| Catch-up bytes per symbol | mean 2.75 MB, max 10.6 MB | **mean 1.22 MB, max 4.17 MB** (2.0×); rows served 34.6 M to 17.8 M |
| Catch-up answers (http.feed_bars_ms) p95 / p99 | 136 / 292 ms | **58 / 85 ms** |
| Engine CPU (one core) | 91% | 76% |
| One slow catch-up | paused every symbol for 15 s | holds back that symbol only (2 s doubling to 60 s) |

**Not done / follow-ups**
- **3e (database writer thread) not started.** The trigger is met on the numbers (p99 77 ms), but the remaining stalls are the log checkpoints inside COMMIT (4a), the catch-up answers built on the main thread (P14, 6b) and the one unsliced piece of each chunk (repair, validate, `Map`, `learnClosedDays`; estimated 15-25 ms). A writer thread would remove none of the first two. Re-measure after 4a and decide then.
- The roadmap's expected catch-up saving (2.5-4×) was 2.0× in the harness.
- `DATABRIDGE_HISTORY_SLICE_ROWS` (a number; default 2000) sets the slice size: a huge value brings back one transaction per chunk, for comparing runs.
- Refresh against bulk is tested by the unit tests only: the harness marks nearly everything `interactive`. The live checklist shows it: in a market session with a capped plan, non-live symbols should keep refreshing while a big download runs (`auto_refresh` status no longer says "Waiting for history download").
- AutoRefresh now takes priority over bulk downloads, so during a refresh pass (6 requests in flight, a pass takes minutes with hundreds of symbols) downloads get the rest of the broker's budget. The gap between passes (never shorter than the last pass took) leaves bulk at least half of the time.

**For the user**
- **Install the rebuilt plugin again** (it has the range fetch and the backoff): close AmiBroker, keep the current `DataBridgePro.dll` as `DataBridgePro.dll.bak`, copy in `plugins\amibroker\DataBridgePro.dll`, start AmiBroker. It works with the older and the newer engine alike.
- **The engine changes need the rebuilt engine** (`npm run build:server`) or `npm run dev`.
- On a market day, with a download running: do non-live symbols still refresh, and do open charts fill in without a long pause? Tell me if History looks different (a hole, a repeated block).
- If the priorities cause trouble, the setting `historyPriorities` = `false` restores first come, first served (PUT `/api/settings`).

## Stage 2: live tick pipeline (2026-11-25)

**Findings addressed:** P3, P4, P10, D1, and the flush timing (2e). Verified against the code at `4067f86` first: all as described.
**Discrepancies found while verifying:** none. Three found while measuring, all in ROOT_CAUSE_ANALYSIS "Discrepancies" (2a, 2b, 2e).

**Changes**
- Plugin `BarMerge.h/.cpp` (new): the merge code moved out of `Plugin.cpp` unchanged; `ParseLiveBarLine` / `ParseQuoteLine` (`std::from_chars`, no locale, no allocation per field); `RecentBars`, the live bar of a symbol plus the final state of each minute that closed since (120 at most), with the rule for when it is complete.
- Plugin `DataClient.cpp` (P3, P4):
  - the notifier waits for a change and sends a notice at once, at least 50 ms apart, on a high-resolution timer. It woke every 150 ms before.
  - the three per-symbol maps are one `RecentBars` map; coverage starts again on every connection to the engine.
  - lines are read in place and cut off once per read, not once per line; one wake-up of the notifier per read.
- Plugin `Plugin.cpp`: `GetQuotesEx` hands over the closed minutes since AmiBroker's last bar from memory (that last bar too, with its final values); the engine is asked over HTTP only when the ring cannot be complete for the gap.
- Plugin tests: `tests/plugin_tests.cpp` (79 checks), `npm run test:plugin`; `tests/dll_host.cpp` + `build-dll-host.bat`, the stand-in for AmiBroker. `build.bat` and `CMakeLists.txt` build `BarMerge.cpp`.
- Engine `ipcServer.ts` (D1, 2e): what waits to go out is kept per client; a client whose socket holds 1 MB is not written to until it drains, and gets the newest state of every symbol and minute then (nothing is lost: the plugin keeps only that). A client that takes nothing for 60 s, or has 200,000 updates waiting, is disconnected (it reconnects and fetches what it missed). The flush is at the end of the current task by default.
- Engine `liveFeed.ts` (P10): `getLiveBar` is a lookup through an index kept in step with every re-key, move and removal; a tick id that matches no symbol is searched for once, until the symbol list changes (`feed.fallback_scans` counts the searches).

**Checks**
- `npm run typecheck --prefix apps/server`: pass. `npm test --prefix apps/server`: 390 passed, 2 failed (the same 2: noren, upstoxAngel). 7 new tests (`ipcBackpressure`, `liveFeedLookup`).
- `npm run typecheck --prefix apps/desktop`: pass. `npm test --prefix apps/desktop`: 136 of 136 (not touched).
- `npm run build:plugin`: built. `npm run test:plugin`: 79 checks, 0 failed (and 2 deliberate breakages of `RecentBars` were caught by it).
- Harness: integrity 0 mismatches in every run (live500, live500_backfill, live500_backpressure, and the real DLL runs).

**Before to after** (details in DATABRIDGE_PERFORMANCE_BASELINE.md)
| Metric | Before | After |
|---|---|---|
| Notice to AmiBroker, change received to sent (real DLL, p95) | 173 ms | **51 ms** (gaps 150-173 ms became 50.1-51.6 ms; 6.3 to 19.8 notices a second, 20 is the limit) |
| A symbol nobody read for 5 minutes | missed minutes asked of the engine, merged later | all of them from memory; no request to the engine (real DLL, 330 s) |
| Bar ready to written on AmiBroker's channel during downloads (p99) | 181 ms | 0.66 ms (the loop lag itself is unchanged: Stage 3) |
| Plugin paused 10 s (socket buffer) | 1.25 MB and growing | 1.05 MB, then it stops; at most one entry per symbol and minute waits |
| GetQuotesEx fast path p99 | 18.7 us | 10.6-12.8 us |

**Not done / follow-ups**
- The Fyers ticks are still handed on with a `setImmediate` in `FyersHSMClient.processQueue`; the harness feeds the engine past that client, so the effect of removing it cannot be measured here. Left as it is.
- What the plugin sends a symbol that was never read after a reconnection is unchanged (a full sync of the last 24 h over HTTP); Stage 3d narrows it.
- The host answers a notice at once. How AmiBroker copes with up to 20 notices a second, with real charts and scans, is for the live checklist: look at `sendmsg_p99`, `busy` and AmiBroker's own load. If it is too much, `MIN_NOTICE_GAP` (DataClient.cpp) is the one number to raise.

**For the user**
- **Install the rebuilt plugin:** close AmiBroker, keep the old `DataBridgePro.dll` in its Plugins folder as `DataBridgePro.dll.bak`, copy in `plugins\amibroker\DataBridgePro.dll`, start AmiBroker. It works with the older and the newer engine alike. To go back, put the `.bak` back.
- The engine changes need the rebuilt engine (`npm run build:server`) or `npm run dev`.
- On a market day, run the live checklist (DATABRIDGE_PERFORMANCE_BASELINE.md): compare `notify_p95`, `visible_p95`, `sendmsg_p99`, `busy`. Tell me if charts redraw more than before.
- The real-DLL tests appended a few hundred lines (SIM symbols, `NOTE|PERF` reports) to `C:\Users\Public\DataBridgePro_plugin.log`.

## Stage 1: critical bug fixes (2026-11-25)

**Findings addressed:** B1, B2, B3, B4, P8, P9 (verified against the code at `6a3c451` first: all as described, only line numbers had moved).
**Discrepancies found while verifying:** none. Two small implementation choices, below.

**Changes**
- `FyersHSMClient.ts`:
  - B1: no limit on reconnect attempts. The wait is 5 s growing by half each time, never over 30 s, spread +-20% (`reconnectDelayMs`). A symbol added while the socket is closed now starts a connection (it only did when no socket object existed at all, which is never after a drop).
  - B2: the silence check runs every 15 s (was 60 s). Limit: 30 s once Fyers has answered a ping (an answer or a message counts), otherwise 60 s during the NSE or MCX session and 5 min outside it (`silenceLimitMs`, `checkSocketAlive`).
  - B3: emits `disconnected` once per drop (socket closed, login refused, silence), and only for a feed that had logged in, so `BrokerLifecycle` queues the catch-up 150 s after it returns. The adapter already mapped the event; nothing emitted it.
  - Constructor takes `{ url }` (tests).
- `FyersAdapter.getHistoricalBars` (B4): the abort timer is now 60 s and stays armed until the whole body has been read (it was 30 s and cleared when the headers arrived). `history.parse_ms` kept. No other adapter has the pattern: all use `AbortSignal.timeout`, which covers the body.
- `lib/DebouncedFile.ts` (new), `market/state/backfillState.ts`, `market/state/coverageState.ts` (P8): the three state files are saved in the background, 500 ms after the last change, through a .part file renamed over the real one (written in place if the rename is refused); anything pending is written when the engine exits. `catchup.state_writes` counts real writes.
- `liveFeed.ts` (P9): the CPU count is read once (`os.availableParallelism()`), not by `os.cpus()` every second.

**Two choices the roadmap left open**
- The reconnect backoff resets when a login is taken, not when the socket opens. Resetting on open meant a server that accepts the socket and then drops it (the 2026-10-29 loop) was retried every 5 s for ever.
- `disconnected` is not sent for a feed that never logged in: its first failure is not a "drop", and the catch-up after it would only repeat the one `activateBroker` already queued.

**Checks**
- `npm run typecheck --prefix apps/server`: pass.
- `npm test --prefix apps/server`: 383 passed, 2 failed (the same 2 as before: noren and upstoxAngel). 17 new tests in `tests/fyersResilience.test.ts` and `tests/stateFiles.test.ts`; the existing Fyers, backfill and live feed tests pass unchanged.
- `npm run typecheck --prefix apps/desktop`: pass. `npm test --prefix apps/desktop`: 136 of 136 passed (not touched).
- Plugin: not changed, not rebuilt.
- The two behaviour tests (no reconnect limit, body deadline) were run against the old code and fail there.
- Harness: integrity 0 mismatches in live500 and live500_backfill.

**Before to after**
| Metric | Before | After |
|---|---|---|
| Fyers reconnect | stops after 10 attempts (~6 min) | never stops (30 s ceiling) |
| Dead Fyers socket noticed | 5-6 min | 30-60 s in the session (unit test; needs a market day to see on the live feed) |
| Catch-up after a Fyers drop | never started (no event) | 150 s after the feed returns (test of the whole chain) |
| Stalled history body | held a slot ~5 min | given up at 60 s |
| `catchup.state_writes` in live500_backfill (91 s) | 476 and 597 whole-file writes on the engine's thread | 205 background writes |
| live500 and live500_backfill tick delay, loop lag | see baseline | the same within run-to-run variation (not a target of this stage) |

**Not done / follow-ups**
- **R7 is still open** (does Fyers answer pings?). It needs a market day: with the Stage 0 build, look for `[FYERS_HSM] server answers pings` or `no pong after 3 pings` in the log. Until then B2 works either way: 30 s if it answers, otherwise 60 s of silence in the session. If it does not answer and a client tracks few, quiet symbols, a 60 s silence in the session would reconnect needlessly (about every minute, harmless but noisy); the log line says why.
- The Fyers login request (`validate-authcode`, `FyersAdapter.ts:229`) has no timeout. Not part of this stage.
- The harness does not exercise the state files (import500 never calls them: baseline 0 writes); the stage's evidence for P8 is the unit test (500 changes, 1 write) and the counter in live500_backfill.

**For the user**
- Nothing to install: the plugin is unchanged. The engine fixes need the rebuilt engine (`npm run build:server`) or `npm run dev`.
- On the next market day, check the log for the two ping lines above and tell me which appears.

## Stage 0: instrumentation and baseline (2026-11-25)

**Findings addressed:** C2 and R1-R7 (measurement only; no behaviour changed).
**Discrepancies found while verifying (all in ROOT_CAUSE_ANALYSIS, "Discrepancies"):**
1. `monitorEventLoopDelay` cannot test the plan's loop-delay targets on Windows (15.6 ms timer tick: an idle loop reads p50 14-16 ms). Added `loop.lag_ms`, a worker-thread ping accurate to about 0.1 ms; the targets now apply to it.
2. Two server tests fail before any change (`noren.test.ts`, `upstoxAngel.test.ts`, "resolves names stored by other brokers"): their fixtures' only crude-oil contract expired on 2026-11-19. Not touched.
3. P13: the baseline shows the engine's own cost of importing 500 symbols is 60 ms, so Stage 5a's "5 times faster" target was withdrawn and the stage re-scoped.

**Changes**
- `system/perf.ts` (metrics: histograms, counters, levels, probes, the once-a-minute line), `system/stallWatch.ts` (loop lag probe and the minute roll), `lib/RateLimiter.ts` (wait time and queue length, named limiters).
- Hooks, recording only: `FyersHSMClient` (receive stamp, ping probe), `BrokerManager`, `liveFeed`, `ipcServer` (`tick.feed_to_ipc_ms`, write counters, the 10th `LIVE_BAR` field `sendMs`, SYNC counters, a probe), `db/index.ts` (live flush, history transaction, WAL size, bars waiting), `db/reader.ts` (wait and run time per operation, one clock across threads), `api/routes/feed.ts`, `FyersAdapter` (parse time), `BackfillQueue`, `DataHealth`, the two state files.
- `pluginStatus` reads `NOTE|PERF`; `GET /api/diagnostics/perf` (not logged); `DATABRIDGE_IPC_PORT`.
- Plugin: `PerfHist.h`; timing in the reader, notifier, catch-up thread and `GetQuotesEx`; a `NOTE|PERF` line once a minute. Rebuilt with `npm run build:plugin` (not installed anywhere).
- Harness `apps/server/tests/perf` (`npm run perf`): simulated feed, fake plugin, fake history broker, synthetic database, scenarios idle, live100, live500, live500_backfill, live500_health, live500_backpressure, import500, explain.

**Checks**
- `npm run typecheck --prefix apps/server`: pass. Harness type check: pass.
- `npm test --prefix apps/server`: 366 passed, 2 failed (the 2 above; before the work: 353 passed, 2 failed of 355). 13 new tests, plus one existing test updated for the new field.
- `npm run typecheck --prefix apps/desktop`: pass. `npm test --prefix apps/desktop`: 136 of 136 passed (not touched by this stage).
- `npm run build:plugin`: DLL built. Tried against the harness engine with a small loader: loaded, notified, answered `GetQuotesEx`, and its `NOTE|PERF` report reached the engine.
- Harness integrity (final state per minute, volumes, nothing missing): 0 mismatches in live100, live500, live500_backfill, live500_health and live500_backpressure.

**Baseline** (full tables in DATABRIDGE_PERFORMANCE_BASELINE.md)
| Metric | live500 | live500 + history downloads |
|---|---|---|
| loop.lag_ms p99 / max | 0.66 / 2.0 ms | **266 / 315 ms** |
| tick.feed_to_ipc_ms p99 / max | 0.23 / 2.5 ms | **242 / 340 ms** |
| backfill.chunk_cpu_ms p50 / p99 | - | 36 / 64 ms |
| plugin notice delay p95 (measured with the DLL) | 181 ms | |
| health scan (9.4 M rows) | 2.2 s per round; the plugin's history requests wait up to 1.9 s behind it | |
| socket buffer in a 10 s plugin pause | 1.2 MB, nothing lost | |

**Not done / follow-ups**
- Live baseline (the checklist) and R7 (does Fyers answer pings): need a market session.
- Instrumentation cost: recording is 0.07 us per update (0.1-0.3%); with the timestamps 0.27 us (0.5-1.2% of the engine's CPU per update). A whole-run on/off comparison was too noisy to use.
- No plugin test project yet (Stage 2). `db.checkpoint_ms` waits for Stage 4a. `backfill.chunk_cpu_ms` must be redefined in Stage 3a (noted there).
- The two failing tests are for the user to decide on.

**For the user**
- Nothing is installed. To get the plugin's own timing in AmiBroker, close AmiBroker, keep the old `DataBridgePro.dll` as `DataBridgePro.dll.bak`, and copy in `plugins/amibroker/DataBridgePro.dll` (rebuilt). The plugin and the engine work with older versions of each other.
- Run the live checklist in DATABRIDGE_PERFORMANCE_BASELINE.md on a market day, with this build.
- The smoke test of the DLL appended a few lines to `C:\Users\Public\DataBridgePro_plugin.log` (the test's own, with SIM symbols).
