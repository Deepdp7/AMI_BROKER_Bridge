# DataBridge Pro: root cause analysis

Every finding from the audit, with the evidence behind it. Line numbers refer to commit `8bdf906`. Re-check them before changing code; if the code differs, record it in the "Discrepancies" section at the end.

**Status**
- **Confirmed**: the code shows it does this.
- **Mechanism confirmed**: the code shows how it happens; how big it is must be measured (Stage 0).
- **Needs evidence**: plausible; needs a runtime measurement before any fix.

**Severity**: how much it hurts live delivery to AmiBroker (Critical / High / Medium / Low). No finding is rated Critical: none is proven to cause most of the buffering on its own until Stage 0 measures it.

## Findings by category

| Category | Findings |
|---|---|
| 1. Confirmed bugs | B1, B2, B3, B4 |
| 2. Confirmed performance bottlenecks | P3, P4, P5, P8, P9, P10, P13, P14 |
| 3. Potential architectural bottlenecks (mechanism confirmed, size to measure) | P1, P2, B5, P6 |
| 4. Configuration problems | C1, C2, C3 |
| 5. Data integrity risks | D2, D3, D4, D5, D6 |
| 6. Concurrency risks | D1, B5 (reader dispatch), P2 (checkpoint vs readers) |
| 7. Resource utilization problems | P9, P11, P14 (response cache), P15 |
| 8. AmiBroker integration problems | P3, P4, P7, P12, P16, A1 |
| 9. Network and provider problems | N1, N2, N3, B2 |
| 10. Areas requiring more runtime evidence | R1–R7 |

---

## 1. Confirmed bugs

### B1: Fyers live feed stops reconnecting for good
- **Component**: `apps/server/src/brokers/adapters/fyers/FyersHSMClient.ts`
- **Root cause**: `triggerReconnect()` returns without scheduling anything once `reconnectAttempts > 10` (lines 276-279), and nothing restarts the client. The delays are 5 s × 1.5ⁿ⁻¹, capped at 60 s, so the tenth attempt comes about 5.7 minutes after the first failure. `subscribe()` only calls `connect()` when `!this.ws` (line 335), but `this.ws` still holds the closed socket. The counter is reset only on a successful `open` (line 213).
- **Evidence**: the lines above. The other feeds (`KiteTicker.ts:218-224`, `DhanFeed.ts:253-260`, `UpstoxFeed.ts:241`, `NorenFeed.ts:157`, `AngelFeed.ts:177`, `XtsFeed.ts:207`, `KotakFeed.ts:331`) have no cap.
- **Symptoms**: after a network outage of about 6 minutes or more, Fyers symbols never stream again. They update only through the 5-minute auto-refresh, until the user logs in again or restarts the app. The log line is "Max reconnect attempts reached."
- **Severity**: High.
- **Performance impact**: live data stops entirely for the rest of the session.
- **Reproduction**: run a fake WebSocket server that refuses connections. Point the client at it (this needs the constructor URL option added in Stage 1). Advance fake timers past 10 attempts, then make the server accept again; no reconnect happens.
- **Recommended solution**: no attempt cap while subscriptions exist. Backoff 5 s × 1.5ⁿ⁻¹, capped at 30 s, with ±20% jitter. Reset on successful login. Keep the existing stop after two login refusals in a row (`onAuthRefused`), which is a different case.
- **Risk**: low. A permanently down server is retried every 30 s, which is harmless.
- **Dependencies**: B3 (emit disconnect/connect so the catch-up runs after recovery).
- **Verification**: unit test with a fake server that refuses N > 10 times, then accepts. The client connects and resubscribes.

### B2: Fyers needs 5–6 minutes to notice a dead connection
- **Component**: `FyersHSMClient.ts`
- **Root cause**: the watchdog checks every 60 s and reconnects only after 300 s without any message (lines 759-780). The client never sends WebSocket pings. A half-open TCP connection (Wi-Fi switch, sleep and wake, NAT timeout, VPN) shows no error, so the socket sits silent.
- **Evidence**: the lines above. Compare `KiteTicker.ts:230-236` (30 s), `DhanFeed.ts:266-272` (45 s), `UpstoxFeed.ts:252-258` (60 s) and `AngelFeed.ts:188-191` (70 s with pong).
- **Symptoms**: Fyers symbols go stale. The Feed Status page shows them STALE after 60 s, but nothing reconnects for up to 6 minutes. When the feed comes back, the missing minutes arrive in bulk from history.
- **Severity**: High.
- **Performance impact**: minutes of missing live data per incident.
- **Reproduction**: fake server that accepts, logs in, then stops sending without closing.
- **Recommended solution**: send `ws.ping()` every 15 s and track the last pong and the last message. Stage 0 first logs whether Fyers answers pings (R7).
  - If it does: treat 30 s without a pong or a message as dead, and terminate and reconnect.
  - If it doesn't: treat 60 s without a message during the session (`MarketCalendar.isMarketSession(now, 'NSE')` or `'MCX'`) as dead, and keep 300 s outside the session.
- **Risk**: a quiet symbol set during the session could cause a needless reconnect if pongs don't work. The probe in Stage 0 settles that first.
- **Dependencies**: R7.
- **Verification**: fake server goes silent; reconnect within the threshold plus 15 s.

### B3: Fyers never reports a disconnect, so the post-outage catch-up never runs
- **Component**: `FyersHSMClient.ts`, `FyersAdapter.ts`, `brokers/BrokerLifecycle.ts`
- **Root cause**: `FyersAdapter` listens for the client's `'disconnected'` event (lines 201-204 and 260-263) and turns it into `connection_state: DISCONNECTED`. `FyersHSMClient` emits `'connected'`, `'auth_failed'`, `'tick'`, `'live_cap'` and `'log_entry'`, but never `'disconnected'`. That applies to the close handler (224-243), `onAuthRefused` (513-529) and the watchdog terminate (764-778). `BrokerLifecycle.startPeriodicCatchUp` (lines 163-177) queues a catch-up 150 s after a broker goes `disconnected` and then `connected` again. For Fyers it never sees the first half.
- **Evidence**: none of the client's `emit(` calls passes `'disconnected'` (searched the whole file).
- **Symptoms**: after a Fyers drop, the minutes missed are filled only by the 30-minute periodic catch-up or the auto-refresh, so they appear in AmiBroker late and in one block.
- **Severity**: High.
- **Performance impact**: gaps of up to 30 minutes after each drop.
- **Reproduction**: unit test: emit a close on the client, then a login; with fake timers, `queueCatchUp` is never called.
- **Recommended solution**: emit `'disconnected'` once per drop from the close handler, `onAuthRefused` and the watchdog terminate. Use a flag that `'connected'` resets.
- **Risk**: low. `BrokerManager` updates the broker status in the database on every state change; that is one small write per drop.
- **Dependencies**: none.
- **Verification**: the test above sees `queueCatchUp(brokerId)` 150 s after the reconnect.

### B4: Fyers history downloads have no deadline once headers arrive
- **Component**: `FyersAdapter.getHistoricalBars` (lines 648-764)
- **Root cause**: the 30 s abort timer is cleared as soon as `fetch` resolves, which happens when the headers arrive (lines 684-692). Then `await res.text()` (line 694) has no deadline except undici's default body timeout of about 300 s.
- **Evidence**: the lines above.
- **Symptoms**: a body that stalls mid-transfer holds one of the six download slots for minutes. Downloads slow down, with no error shown.
- **Severity**: Medium.
- **Performance impact**: lost download throughput during network trouble.
- **Reproduction**: fake HTTP server sends headers and half a body, then stalls.
- **Recommended solution**: clear the timer only after `res.text()` has finished. Use a 60 s deadline for 95-day chunks. Check the other adapters for the same pattern (`clearTimeout` before `.text()` or `.json()`).
- **Risk**: low.
- **Verification**: the stalled-body test aborts within the deadline, and the backfill retries the chunk.

---

## 2. Confirmed performance bottlenecks

### P3: the plugin notifies AmiBroker on a fixed 150 ms timer
- **Component**: `plugins/amibroker/src/DataClient.cpp`
- **Root cause**: `NotifierThreadProc` sleeps 150 ms (`NOTIFY_EVERY_MS`, line 146), then swaps out the pending set and sends one `WM_USER_STREAMING_UPDATE` with `SendMessageTimeoutA` (1,000 ms, `SMTO_ABORTIFHUNG`, lines 248-287). A change that arrives just after a round waits nearly the full 150 ms.
- **Evidence**: lines 146, 272-287.
- **Symptoms**: updates step instead of flowing. That adds 0–150 ms (about 75 ms on average) to every update, even when the engine and AmiBroker are idle.
- **Severity**: Medium. It is probably the largest delay the application adds when nothing else is going on.
- **Reproduction**: Stage 0's plugin timing (time from a bar arriving to its notice).
- **Recommended solution**: an event-driven notifier. It waits on a condition variable signalled by `KeepLiveBar`, `QueueNotify` and `HandleQuoteMessage`. It sends at once when at least `MIN_GAP_MS` (50) has passed since the last notice, otherwise it waits out the remainder (fire on the leading edge, coalesce the rest). Keep the "one notice per round" design: hundreds of notices per second made AmiBroker redraw thousands of times, as recorded in the code comment at lines 268-271. Keep re-queueing when AmiBroker is busy.
- **Risk**: medium. More frequent notices raise AmiBroker's redraw load. 50 ms caps it at 20 notices a second. Tune it with the measured `SendMessageTimeout` durations.
- **Dependencies**: Stage 0 plugin metrics.
- **Verification**: plugin p95 from receive to notice ≤ 55 ms with AmiBroker idle; AmiBroker CPU not higher than baseline.

### P4: the plugin remembers only two minutes per symbol
- **Component**: `DataClient.cpp`, `Plugin.cpp`
- **Root cause**: `g_lastKnownBars` holds the newest bar and `g_prevMinuteBars` the final state of the minute before (lines 29-32, 576-591). Suppose AmiBroker's last bar for a symbol is minute M and it next asks at M+3 or later. The fast path merges only M+2 (previous) and M+3 (live). The gap from M+1 onward then needs a "gap check": an HTTP catch-up, allowed at most once per 30 s per ticker (`TryBeginGapCheck`, lines 131-138) and only while catch-ups aren't paused (`Plugin.cpp:235-253`). The bars arrive on a later `GetQuotesEx` call.
- **Evidence**: the lines above.
- **Symptoms**: symbols that aren't on an open chart (watch lists, Real-time Quote window, explorations, scans, charts in background tabs) show missing minutes that fill in later as a block. It also adds HTTP and database load.
- **Severity**: Medium.
- **Reproduction**: open a symbol in a chart, switch to another layout for 3 minutes, switch back. The plugin log shows `[SYNC] … caught up N missed bar(s)` after a delay.
- **Recommended solution**: a per-ticker ring of the last 120 final closed-minute bars, filled in `KeepLiveBar` when the minute rolls over (about 1 MB for 500 symbols). In `DoGetQuotesEx`, when the live bar is more than one minute past AmiBroker's last bar, merge the ring bars between them first. Ask the engine over HTTP only when the ring doesn't reach back to AmiBroker's last bar.
- **Risk**: low to medium. These are the same live-built bars the engine stores; broker history still replaces them later through SYNC.
- **Verification**: plugin unit tests for the ring and merge; manual test as in the reproduction, with no HTTP request in the plugin log.

### P5: every history chunk makes AmiBroker re-download up to now
- **Component**: `market/BackfillQueue.ts`, `amibroker/ipcServer.ts`, `Plugin.cpp`, `DataClient.cpp`, `api/routes/feed.ts`
- **Root cause**:
  - Each chunk that changed bars emits `bars_gap_filled` (`BackfillQueue.ts:817`), and `ipcServer.ts:57-74` sends `SYNC|T|fromSec`.
  - The plugin then fetches from `fromSec − 60` (or the last 24 h) **up to now** (`Plugin.cpp:245-252`). Downloads go newest-first in 95-day chunks, so a 1-year backfill makes the plugin download about 95 + 190 + 285 + 365 days for that symbol: roughly 2.5–4 times the data.
  - One catch-up thread runs them in series (`DataClient.cpp:410-436`).
  - Every request with `since > 0` counts as "quick", with 1/1/2/4 s timeouts (line 763 and line 787), even when it is 100,000 bars.
  - A timeout calls `CatchUpFailed()`, which pauses **every** catch-up for 15 s (lines 293-305).
- **Evidence**: the lines above. The local plugin log has 2 "catch-up paused" lines.
- **Symptoms**: during and after downloads, history appears in AmiBroker late and unevenly; one slow answer stalls every symbol for 15 s.
- **Severity**: Medium.
- **Reproduction**: harness scenario `live500+backfill` with the fake plugin issuing catch-ups; count bytes per symbol.
- **Recommended solution**:
  - `SYNC|T|from|to`: the engine keeps the oldest from and newest to per ticker within the 1-second window.
  - `/api/feed/bars` gains `until=`; the reader query adds `ts <= until`.
  - The plugin fetches only the announced range (±60 s).
  - Choose the timeout from the requested size, not from `since > 0`.
  - Replace the global pause with per-ticker backoff (2 s doubling to 60 s); keep a global pause only when the engine isn't connected.
- **Compatibility**: an old plugin reads `stod("from|to")` as `from`, so it behaves as today. A new plugin with an old engine sees no `to`, so it behaves as today.
- **Risk**: medium. `MergeBars` already handles merging into the middle of the array (`Plugin.cpp:124-183`), but test it.
- **Dependencies**: P4 (plugin restructuring), B5 (reader lanes).
- **Verification**: bytes moved per symbol in a 1-year backfill drop to about one year's worth; no global pauses.

### P8: whole-file synchronous writes for state files
- **Component**: `market/state/backfillState.ts`, `market/state/coverageState.ts`
- **Root cause**: `PersistedSet.add()` and `delete()` rewrite the whole JSON file with `writeFileSync` each time (lines 19-34, 50-57). `queueCatchUp` calls add or delete once per symbol (`BrokerLifecycle.ts:221-222`), and the import route calls delete once per line (`brokers.ts:537`). `setHistoryFloorMs` writes synchronously on each call (`coverageState.ts:84-93`). In the same file, `setVerifiedThroughMs` is already debounced.
- **Symptoms**: hundreds of synchronous disk writes in a burst (startup, every 30 minutes, after reconnects, imports), each holding the engine thread.
- **Severity**: Medium.
- **Reproduction**: catch-up over 500 symbols; count writes (Stage 0 counter).
- **Recommended solution**: debounced (500 ms) asynchronous write to a temporary file, then rename; flush synchronously on exit (same hook as `closeDb`).
- **Risk**: a crash inside the 500 ms window loses the last state change. These are optimization markers: the next pass recomputes them.
- **Verification**: `tests/stateFiles.test.ts`: many adds produce one write; the content survives a simulated restart.

### P9: `os.cpus()` called once a second
- **Component**: `market/liveFeed.ts:588` (`_getCoreStats`)
- **Root cause**: on Windows, `os.cpus()` queries model and speed for every CPU (registry reads). It runs only to get the core count.
- **Severity**: Low. **Fix**: cache `os.availableParallelism()` once. **Verify**: microbenchmark before and after.

### P10: linear scans in the live feed
- **Component**: `liveFeed.ts`
- **Root cause**: a tick whose instrument id doesn't match a key runs an O(N) loop with string operations (lines 269-313). Misses aren't cached, so an unmapped id pays this on every tick. `getLiveBar` (116-126) is O(N) and runs on every `/api/feed/bars` request.
- **Severity**: Low. **Fix**: a `ticker|broker → key` index kept in step with `instruments`, plus a negative cache of unknown ids, cleared on add and re-key. **Verify**: liveFeed unit tests; microbenchmark with 500 instruments.

### P13: symbol add and import are per-symbol and synchronous
- **Component**: `brokers/addSymbols.ts`, `api/routes/brokers.ts` (`/:id/symbols/import`)
- **Root cause**:
  - `addSymbolsToBroker` (lines 14-58) loops one symbol at a time: resolve, insert in its own autocommit transaction, add to the live feed (which logs and broadcasts), an **awaited** subscribe for that one symbol, then enqueue (one more log and broadcast).
  - The import route (lines 490-552) runs the whole loop synchronously inside one request handler. Per line it does an insert, a subscribe that isn't awaited, `allowHistory` (which may write settings) and `backfilledTickers.delete` (a whole-file write, P8).
  - For Fyers, each one-symbol subscribe sends its own subscription packet and four log lines (`FyersHSMClient.ts:349-350, 468-469`).
- **Symptoms**: slow imports; live data held while an import runs. **Corrected by the Stage 0 baseline (see Discrepancies):** the engine's own work for 500 symbols is about 60 ms, so this is a tidiness and log-volume finding, not yet shown to be what makes imports slow.
- **Severity**: Medium for imports, Low for live data.
- **Reproduction**: harness scenario `import500`.
- **Recommended solution**:
  - resolve with concurrency 8;
  - a new bulk `stmts.insertSymbols(rows)` writing everything in one transaction;
  - add to the live feed in one pass with one summary log;
  - **one** `brokerManager.subscribe(brokerId, allRaw)` (the Fyers client already splits into batches of 50) and one `enqueueBatch`;
  - the import route reuses this path.
- **Risk**: low. Keep each symbol's error reported separately.
- **Verification**: import of 500 symbols at least 5 times faster; loop-lag p99 during the import stays at target.

### P14: extra work and memory in `/api/feed/bars`
- **Component**: `api/routes/feed.ts`
- **Root cause**: for `since > 0`, the CSV the SQL query already filtered (`ts > since`) is split and filtered again on the engine thread (lines 127-133). That filter exists only to drop a live-bar line that may not be newer than `since`. `feedResponseCache` holds full answers (up to about 4 MB each for full loads) for 5–15 s (lines 14-25).
- **Severity**: Low. **Fix**: append the live line only when its timestamp is greater than `since` and greater than the last CSV row, and drop the re-filter. Bound the cache by total bytes (for example 16 MB) and evict the oldest first. **Verify**: route tests (`tests/api.test.ts` patterns); catch-up p99.

---

## 3. Potential architectural bottlenecks (mechanism confirmed, size to measure)

### P1: history work runs on the engine's only thread
- **Component**: `market/BackfillQueue.ts`, `brokers/adapters/*/…Adapter.getHistoricalBars`, `db/index.ts`, `market/AutoRefresh.ts`
- **Root cause**: for each chunk, all of this runs synchronously on the main thread:
  - `JSON.parse` of up to about 35,000 candles (about 1.5 MB) and the mapping to bar objects (`FyersAdapter.ts:694-718`);
  - `map(repairBar)` and `filter(validateBar)` (`BackfillQueue.ts:796-802`);
  - building a Map and running up to 35,000 SQLite upserts in **one** transaction (`db/index.ts:419-449`); the code comment at `db/index.ts:14` says a 25k-bar chunk commits in about 25 ms;
  - `learnClosedDays` (`BackfillQueue.ts:811`).

  Up to 6 chunks per broker are in flight (`BackfillQueue.ts:103`). The auto-refresh does the same for each symbol (`AutoRefresh.ts:187-191`).
- **Why it matters**: the push to AmiBroker is scheduled with `setImmediate` (`ipcServer.ts:103-107`). While a chunk is processed, every tick waits; afterwards they all go out in one write. That is the "pause, then burst" pattern. `stallWatch` reports only stalls of 500 ms or more (`system/stallWatch.ts:9`), so stalls of 20–100 ms have never been logged.
- **Symptoms**: live updates in AmiBroker clump during downloads and refreshes.
- **Severity**: High (likely the main engine-side cause; needs measuring).
- **Reproduction**: harness `live500+backfill`: compare `loop.lag_ms` and `tick.feed_to_ipc_ms` with `live500`.
- **Recommended solution**:
  - Stage 3a: commit in slices of 2,000 rows or fewer and yield to the event loop between slices.
  - Stage 3e, only if loop-lag p99 during backfill is still over 10 ms: a database-writer worker thread that parses, validates and upserts history off the main thread, and becomes the only writer of `bars` and `daily_bars`.
- **Risk**: 3a is low (rows are independent; announce SYNC after the last slice). 3e is medium (a second writer connection; see the Stage 3e notes in the roadmap).
- **Dependencies**: Stage 0 metrics.
- **Verification**: loop-lag p99 ≤ 10 ms and max ≤ 50 ms during `live500+backfill`.

### P2: WAL checkpoints run synchronously inside commits
- **Component**: `db/index.ts:86-90`
- **Root cause**: only `busy_timeout`, `journal_mode=WAL`, `synchronous=NORMAL` and `temp_store` are set. With SQLite's default `wal_autocheckpoint=1000` (about 4 MB), the commit that crosses the threshold runs the checkpoint on the main thread. With `synchronous=NORMAL` in WAL mode, a checkpoint syncs both the WAL and the database file to disk. On an HDD, a slow SSD or with antivirus scanning, that can take tens to hundreds of ms. A reader holding a long read transaction (the full-table health scan, `VACUUM INTO` for backups, a 100k-bar CSV) stops the checkpoint from finishing, so the WAL keeps growing. No `journal_size_limit` is set.
- **Evidence**: the PRAGMA block; WAL 795 KB on this PC at idle.
- **Symptoms**: occasional longer stalls during downloads.
- **Severity**: High until measured.
- **Reproduction**: Stage 0 `db.checkpoint_ms` and `db.history_tx_ms` maximums; check whether the commit-time spikes match WAL size drops.
- **Recommended solution** (Stage 4a):
  - main connection: `wal_autocheckpoint=20000`, as a backstop only, and `journal_size_limit=67108864`;
  - a maintenance worker with its own read-write connection runs `PRAGMA wal_checkpoint(PASSIVE)` when the WAL is over 16 MB or every 60 s, and `TRUNCATE` after the market closes or when idle;
  - measure each checkpoint.

  A read-only connection cannot checkpoint, so this has to be a separate read-write connection.
- **Risk**: low to medium. If the worker dies, the backstop still checkpoints.
- **Verification**: no commit over 20 ms caused by a checkpoint; the WAL stays bounded.

### B5: the health check scans the whole bars table and blocks AmiBroker's reads
- **Component**: `db/reader.ts`, `market/DataHealth.ts`, `apps/desktop/src/components/status/DataHealth.tsx`, plugin catch-up
- **Root cause**:
  - The `dayRows` query (`reader.ts:49-51`: `WHERE b.ts >= ? GROUP BY b.tid, d`) can't use the `(tid, ts)` primary key, so it reads the whole table (0.9 GB on this PC; about 1.9 GB per 500 symbol-years).
  - `computeHealth` caches for 30 s and serves stale answers for up to 5 minutes while it recomputes in the background (`DataHealth.ts:50-73`).
  - The UI calls it on mount, on every resync (60 s and on window focus), 4 s after each finished download, and 3 s after a stale answer (`DataHealth.tsx:24-51`). `problem.txt` shows `/api/symbols/health` about once a second during downloads.
  - Readers are picked round-robin (`reader.ts:158-167`), so every other AmiBroker request queues behind the scan.
  - The plugin's catch-up gives up after 4 s, and that pauses all catch-ups for 15 s (P5).
- **Symptoms**: with Symbol Setup open during downloads, AmiBroker gets history late; the plugin log shows "catch-up paused".
- **Severity**: Medium (the scan duration at client scale is still unknown: R2).
- **Reproduction**: harness `live500+healthscan` with the synthetic database; measure `/api/feed/bars` p99 and `reader.wait_ms.csv`.
- **Recommended solution** (Stage 4b and 4c):
  - two reader lanes: `interactive` for the plugin's `csv` requests, and `bulk` for health, backup, gap scans, candles and MT5 exports, with least-loaded dispatch inside each lane;
  - incremental health: a per-ticker day count using the primary-key range, a dirty set of tickers whose bars changed, and recompute only those (full pass only at warm-up);
  - the UI shares one in-flight request.
- **Risk**: low.
- **Verification**: `/api/feed/bars` p99 ≤ 250 ms while health recomputes; `health.compute_ms` far lower after warm-up.

### P6: bulk downloads starve the refresh that non-live symbols depend on
- **Component**: `lib/RateLimiter.ts`, `market/AutoRefresh.ts`, `market/BackfillQueue.ts`
- **Root cause**: each adapter has one first-come-first-served limiter for every history request (`RateLimiter.ts:33-38`; Fyers 3/s and 45/min, `FyersAdapter.ts:41`). The backfill keeps 6 requests per broker waiting there. The auto-refresh doesn't start, and stops early, while the backfill queue has any work (`AutoRefresh.ts:136-143, 216-218`). On a capped plan the refresh is the only source for symbols without a live place.
- **Evidence**: the code; project notes from the 2026-11-19 incident (338 of 438 symbols without live places).
- **Symptoms**: during long downloads, non-live symbols stop updating in AmiBroker, sometimes for tens of minutes.
- **Severity**: Medium (High on capped plans).
- **Reproduction**: harness with a fake capped adapter: start a 400-symbol backfill and record how long the refresh waits.
- **Recommended solution** (Stage 3b and 3c):
  - priority classes in `RateLimiter`, read from an `AsyncLocalStorage` context (`lib/priority.ts`, `withPriority(p, fn)`), so no adapter signature changes;
  - classes: `interactive` (forced and AmiBroker-viewed gap fills, live-place gap fills), `refresh` (auto-refresh, startup today fetch) and `bulk` (backfill);
  - strict priority, but bulk may use at most 70% of the minute budget while a higher class has waited in the last 60 s;
  - the auto-refresh stops yielding to downloads.
- **Risk**: medium. The daily allowance logic (`fyersPlan.ts`, `AutoRefresh.passSymbols`) must still hold; downloads take longer.
- **Verification**: refresh passes keep their interval during a backfill; no new 429/-360 refusals.

---

## 4. Configuration problems

### C1: SQLite settings left at defaults
`cache_size` (2 MB default), `mmap_size`, `wal_autocheckpoint` and `journal_size_limit` are not set (`db/index.ts:86-90`). Covered by P2. Try `cache_size=-65536` on the writer and `mmap_size=268435456` on the readers as a measured A/B test in Stage 4a; keep them only if they help.

### C2: the stall watch can't see the stalls that matter
`stallWatch.ts` logs only when the worst stall in a minute is 500 ms or more (line 9), and records nothing else. Stalls of 20–100 ms, which are enough to clump ticks, are invisible. Stage 0 adds per-minute p50, p99 and max. Node's own `monitorEventLoopDelay` is too coarse on Windows to do this (see the Discrepancies table), so Stage 0 measures `loop.lag_ms` with a worker-thread ping instead.

### C3: `backend.log` grows without limit during a session
The Tauri supervisor sends the engine's stdout and stderr to a file (`engine.rs:110-113`). It checks the 20 MB limit only when it spawns the engine (lines 77-85). On Windows, Node writes to a file synchronously, so every `console.log` is a synchronous write on the engine thread. Stage 6a and Stage 7 reduce the log volume; rotation while running is optional.

---

## 5. Data integrity risks

| ID | Risk | Evidence | Decision |
|---|---|---|---|
| D2 | Live bars sit in memory until the minute closes plus up to 2 s; a crash loses them | `liveFeed.ts:480-493`, `db/index.ts:375-396` | Accepted: gap detection and the auto-refresh restore them from broker history. Add a gauge for `pendingBarsAppends` and an alarm if it grows (Stage 8). |
| D3 | Broker history overwrites a live-built minute 30 s after the minute ends, even if the broker's bar is still missing late trades | `HISTORY_SETTLE_MS`, `db/index.ts:408-437` | Accepted by design: later refresh passes and the after-close pass write the final values |
| D4 | Late ticks for a closed minute are ignored by the engine | `liveFeed.ts:361` | Accepted: the plugin still accepts late updates to the previous minute (`KeepLiveBar`), and broker history corrects the stored bar |
| D5 | Committing history in slices (Stage 3a) makes part of a chunk visible before the rest | — | Rows are independent; emit SYNC only after the last slice |
| D6 | A catch-up result is merged into AmiBroker on a *later* `GetQuotesEx`; live bars may have advanced in between | `Plugin.cpp:211-225` | Safe: `MergeBars` rebuilds only from the first incoming minute and keeps newer bars; the live bar is applied afterwards. Keep this order in Stage 2b and 3d. |

---

## 6. Concurrency risks

### D1: no backpressure on the AmiBroker socket
- **Component**: `amibroker/ipcServer.ts:108-121`
- **Root cause**: `client.write(msg)` never checks `writableLength`. If the plugin stops reading, Node buffers without limit. That happens if AmiBroker's process is suspended or a debugger stops it; the plugin's reader thread is otherwise independent of AmiBroker's UI thread.
- **Severity**: Medium (memory growth, then a huge burst on recovery).
- **Recommended solution**: per client, when `writableLength` > 1 MB, stop writing until `'drain'`. Keep coalescing in `pendingLive`, which is already keyed by ticker and minute, so no minute's final state is lost. Send only the newest QUOTE per ticker on resume. Record the high-water mark.
- **Why this loses nothing**: the plugin keeps only the newest state per ticker-minute (`KeepLiveBar`), and the final state of every minute is still sent.
- **Verification**: harness with the fake plugin pausing its reads for 10 s: bounded memory, and the final state per ticker-minute is correct afterwards.

Also see B5 (round-robin reader dispatch) and P2 (checkpoints against long readers).

---

## 7. Resource utilization problems

- **P9**: `os.cpus()` once a second (see section 2).
- **P11** (needs evidence): per-tick allocations. `{...tick, brokerId}` in `BrokerManager.ts:52`, `{...bar}` in `liveFeed.ts:365`, a template string for de-duplication in `FyersHSMClient.ts:695`, and a key string in `ipcServer.ts:127`. Change these only if profiling at the soak rate shows GC pauses (Stage 7).
- **P14**: `feedResponseCache` keeps multi-MB strings (see section 2).
- **P15**: log noise.
  - The request logger prints a JSON line for UI polling (`app.ts:44-57`; `problem.txt` shows `/api/symbols/health` about once a second).
  - The backfill prints 2–3 lines per chunk.
  - The Fyers client prints `[System Status]` every 30 s.

  All of it is synchronous file output (C3). Fix: skip `/api/symbols/health`, `/api/backfill/status` and `/api/status/*` in the request logger; one per-minute summary for backfill.

---

## 8. AmiBroker integration problems

- **P3, P4**: see section 2.
- **P7: AmiBroker scans churn the live places.** The plugin reports `VIEW|T` from every `GetQuotesEx` call, including scans and explorations (`Plugin.cpp:202`; `DataClient.cpp:514-524`, once per 15 s per ticker). `liveSlots.rebalance` gives live places to any symbol viewed in the last 90 s, swapping up to 10 per 10 s round (`liveSlots.ts:20-24, 82-122`). Each newly live symbol queues a *forced* today gap fill (`liveSlots.ts:112`). That keeps the backfill queue busy, which pauses the auto-refresh (P6). **Fix** (Stage 5b): charts ask continually, while a scan touches a symbol once. So count a symbol as "wanted" only after at least 2 VIEWs at least 10 s apart within the last 60 s. Cap swaps at 5 per round, and give the gap fill `interactive` priority. **Verify**: liveSlots unit test (a single VIEW causes no swap; repeated VIEWs do).
- **P12 (needs evidence): the OLE symbol-details push may freeze AmiBroker.** On every plugin connection (`ipcServer.ts:157`, 5 s later) and daily, PowerShell walks every symbol through AmiBroker's COM objects. That is about 5 cross-process calls per symbol, roughly 2,000 for 438 symbols (`symbolDetails.ts:112-181`). AmiBroker runs COM calls on its UI thread, so while the script runs AmiBroker may not process notices or redraw. **Fix** (Stage 5c): store a hash of the last pushed TSV and skip the push when it hasn't changed; during the session, push only when symbols were added. Time the script. **Verify**: R5 measurement; no push on reconnect without changes.
- **P16: the legacy `GET_QUOTES` reply on the live socket.** `ipcServer.ts:194-284` answers `GET_QUOTES T` with up to 100,000 bars written into the **same** socket as live bars, and auto-registers unknown symbols. No version of `DataClient.cpp` in this repository's history ever sends `GET_QUOTES`: every commit of both plugin paths was checked on 2026-11-25. **Fix** (Stage 6e): unless the user knows of a DLL built outside this repository, remove the bulk reply (answer `END`) and log a warning once.
- **A1 (needs evidence): AmiBroker's own load.** Load factor, the in-memory cache size, the chart refresh interval and heavy formulas are outside the bridge. The 2026-11-19 client had a load factor of 227%. The plugin already reports repeated full reloads (`NOTE|RELOADS`). Stage 0's plugin timing (`GetQuotesEx` durations, `SendMessageTimeout` durations and busy count) separates AmiBroker-side delay from bridge delay.

---

## 9. Network and provider problems

- **N1: Fyers plan limit.** Standard streams 100 live symbols. The others get **no** snapshot and no error, and are kept current only by the history refresh (project notes, `fyersPlan.ts`, `liveSlots.ts`). That is a limit of the plan, not a defect. Options: Fyers Prime (5,000 live), or a future feature that puts the overflow on a second connected broker's live feed. That is a product decision for the user.
- **N2: feed timestamps are whole seconds.** `tick.age_ms` (wall clock minus exchange time) is coarse. Provider latency and cadence must be measured as receive inter-arrival per symbol (Stage 0), separately from application latency.
- **N3: socket options checked.** The AmiBroker socket sets `TCP_NODELAY` and keep-alive 15 s (`ipcServer.ts:150-151`). The plugin's WinHTTP session is reused (`DataClient.cpp:735-748`). The broker sockets use the `ws` library defaults. No change is recommended without a measurement.
- **B2**: see section 1.

---

## 10. Areas requiring more runtime evidence

| ID | Question | How to get it |
|---|---|---|
| R1 | Event-loop delay during downloads at 438 symbols | Stage 0 `loop.lag_ms` on the client-like live run |
| R2 | How long the health scan takes on a client database | Stage 0 `health.compute_ms`; harness synthetic database |
| R3 | WAL checkpoint durations on client disks | Stage 0 `db.checkpoint_ms` (explicit checkpoint timing plus commit spikes) |
| R4 | How long AmiBroker takes to accept a notice during scans; whether one notice refreshes all charts | Plugin `sendmsg_ms` and busy count; compare GetQuotesEx calls per notice |
| R5 | How long the OLE push takes and whether AmiBroker freezes during it | Time the script; plugin busy count during the push |
| R6 | Fyers tick inter-arrival per symbol (provider cadence) | Stage 0 receive inter-arrival histogram per broker |
| R7 | Whether the Fyers HSM server answers WebSocket pings | Stage 0 ping/pong probe (log only) |

---

## Discrepancies found during implementation

Record any finding here that does not match the code when re-checked, with the correction made to the plan.

| Date | Stage | Finding | What the code actually does | Plan correction |
|---|---|---|---|---|
| 2026-11-25 | 0 | C2 and the roadmap (0.2, acceptance targets) measure event-loop delay with `monitorEventLoopDelay` and set targets "p99 ≤ 10 ms, max ≤ 50 ms" | Not a code mismatch: a measurement problem found while verifying. On Windows `monitorEventLoopDelay` is quantized by the 15.6 ms timer tick. Idle readings on this PC: resolution 1 → p50 13.96 / p99 20.81 ms; 5 → 15.42 / 24.30; 10 → 15.87 / 32.95; 20 → 20.87 / 33.11. A busy-loop of 80 ms read as 95 ms. So it cannot test a 10 ms target or see a short stall. | Added `loop.lag_ms`, a worker-thread ping with about 0.1 ms accuracy (probe on this PC: idle p50 0.16 ms, p99 0.38 ms; known 25/25/80 ms blocks read 25/24/81 ms). The "loop-lag" targets now apply to it. `monitorEventLoopDelay` stays as the secondary gauges `loop.eld_*` (about 15 ms floor). Roadmap 0.2 and the baseline metric table are updated; the other documents only had the name changed. |
| 2026-11-25 | 0 | The roadmap treats the existing test suites as passing | Before any change, `npm test --prefix apps/server` gives 353 passed and 2 failed of 355. Both failures are "resolves names stored by other brokers" (`tests/noren.test.ts`, `tests/upstoxAngel.test.ts`): they expect `MCX:CRUDEOIL26NOVFUT`, but `nearestFuture` (`InstrumentMaster.ts:202-207`) compares each contract's expiry with the real clock, and the fixtures' only crude contract expires 2026-11-19, before today (2026-11-25), so it returns nothing (`expected undefined`). Desktop: 136 of 136 passed; both type checks pass. | No change to the roadmap. These 2 failures are known and date-dependent, not caused by this work: every stage must show the same 2 failures and nothing new. Fixing them (the tests should not hard-code a contract month) is a separate small change for the user to approve. |
| 2026-11-25 | 0 (found by its baseline; affects Stage 5a) | P13 says imports are slow because they work one symbol at a time, and Stage 5a promises "at least 5 times faster" | The harness's `import500` (500 symbols posted to `/api/brokers/:id/symbols`, a subscribe that returns at once, downloads held back) takes **60 ms** of the engine's time, 0.12 ms a symbol, and the loop lag stays under 26 ms. The real Fyers `subscribe` and `resolveSymbol` (`FyersAdapter.ts:327-392, 873-897`) are string handling plus a linear scan of the symbol list per call, so they are of the same order. The per-symbol shape is real (500 inserts, 500 subscribe calls, 2,001 log lines), but it costs the engine well under a second. | P13 is rated Low and unproven as a cause of slow imports. Stage 5a keeps the batching (it is cheap and removes the log noise) but its goal changes from "5 times faster" to "no more than one subscribe call, one transaction and one log line per import", and the claim about slow imports is to be settled by measuring a real import end to end in a live session (first load of the broker's symbol list, the downloads at the broker's request limit, the OLE push). The baseline document has the figures. |
