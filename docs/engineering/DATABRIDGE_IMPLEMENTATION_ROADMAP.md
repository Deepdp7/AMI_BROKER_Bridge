# DataBridge Pro: implementation roadmap

This is the implementation specification. Do the stages in order, one at a time.

Finding IDs are explained in [DATABRIDGE_ROOT_CAUSE_ANALYSIS.md](DATABRIDGE_ROOT_CAUSE_ANALYSIS.md), and the target design in [DATABRIDGE_OPTIMIZED_ARCHITECTURE.md](DATABRIDGE_OPTIMIZED_ARCHITECTURE.md). Line numbers are from commit `8bdf906`: re-check them first.

## How every stage runs

1. **Verify.** Re-read the code for each finding in the stage. If the code doesn't match this document:
   - stop that item;
   - write the difference into the "Discrepancies" table in ROOT_CAUSE_ANALYSIS;
   - correct this roadmap;
   - then continue.
2. **Implement** only what the stage lists. Match the surrounding style: short plain-English "why" comments, the same naming, no new dependencies.
3. **Check.**
   - `npm run typecheck --prefix apps/server` and `npm test --prefix apps/server`.
   - `npm run typecheck --prefix apps/desktop` and `npm test --prefix apps/desktop`. A plain `tsc --noEmit` in `apps/desktop` checks nothing.
   - If the plugin changed: `npm run build:plugin` and `npm run test:plugin`. The test script is added in Stage 2.
4. **Measure** with `npm run perf --prefix apps/server` (from Stage 0 on), and compare with [DATABRIDGE_PERFORMANCE_BASELINE.md](DATABRIDGE_PERFORMANCE_BASELINE.md). The harness integrity check (the fake plugin's final state matches the engine) must pass.
5. **Document**: add a changelog entry (what changed, test output summary, before/after numbers) and update the baseline tables.
6. **Commit** on branch `perf/live-tick-pipeline` as `perf(stage N): …`, then stop and report to the user.

Never touch the real `%APPDATA%\DataBridgePro`. Tests and the harness use an isolated `USERPROFILE`, `HOME` and `APPDATA`, plus `DATABRIDGE_NO_PG_IMPORT=1`, as `apps/server/vitest.config.ts` does. Never print broker tokens. The user installs the DLL and runs live-market sessions.

## Critical path and dependencies

```
Stage 0 ─► Stage 1 ─► Stage 2 (2a, 2b, 2c, 2d, then the 2e A/B)
                  └─► Stage 3a ─► 3b ─► 3c ─► 3d (needs 2b's plugin restructuring) ─► [3e only if triggered]
                                              └─► Stage 4a ─► 4b ─► 4c ─► 4d
                                                              └─► Stage 5 ─► Stage 6 ─► Stage 8 ─► Stage 9
Stage 7: only when a measurement calls for it
```

---

## Stage 0: instrumentation and baseline (no behaviour change)

**Goal:** per-stage latency, queue and resource numbers for the engine and the plugin, plus a repeatable harness. Without these, nothing later can be judged. Addresses C2 and R1–R7.

### 0.1 Metrics module: new `apps/server/src/system/perf.ts`
- **`Histogram`**: fixed geometric buckets from 0.05 ms to 60,000 ms with ratio 1.1, about 147 buckets.
  - `record(ms)` is O(1): `idx = ceil(log(ms / 0.05) / log(1.1))`, clamped.
  - Keep the exact `max`, `sum` and `count`.
  - `snapshot()` returns `{ count, p50, p95, p99, max, mean }`; a percentile is its bucket's upper bound (within 10%).
- **`perf` singleton**:
  - `hist(name)`, `count(name, n = 1)`, `gauge(name, value)` (keeps last and max);
  - `snapshot()` returns `{ lastMinute, sinceStart }`; `rollMinute()`.
  - Record into a "current minute" set and a "since start" set.
- **Off switch**: `DATABRIDGE_PERF=0` makes every call a no-op. Use it to measure the instrumentation's overhead.
- Once a minute, log one line:
  `[Perf] loop lag p99 X ms max Y | tick rx→ipc p99 Z ms | ipc writes N | db history tx p99 … | reader wait p99 … | plugin notify p95 … (from NOTE|PERF)`

### 0.2 Event-loop lag: `apps/server/src/system/stallWatch.ts`

> **Corrected during Stage 0 (see the Discrepancies table in ROOT_CAUSE_ANALYSIS).** The first version of this section used only `monitorEventLoopDelay`. On Windows it is quantized by the 15.6 ms timer tick: an idle loop reads p50 14–16 ms and p99 20–33 ms at every resolution tried (1, 5, 10, 20 ms), so it cannot test a "p99 ≤ 10 ms" target or see a 5 ms stall. A worker-thread ping measures the same thing to about 0.1 ms.

- Keep the 500 ms warning.
- **New primary metric `loop.lag_ms`:** a small worker thread (an eval'd source string, like `db/reader.ts`) sleeps with `Atomics.wait` and posts `performance.timeOrigin + performance.now()` about every 13–16 ms (the timer tick limits how often it can wake, not how exactly the lag is read). The main thread subtracts that stamp from its own `performance.timeOrigin + performance.now()` when the message is handled and records the result into the histogram `loop.lag_ms`. Both threads share one `timeOrigin`, so the clocks agree (checked on this PC: idle lag p50 0.16 ms, p99 0.38 ms; injected 25 ms and 80 ms blocks read back as 25 and 81 ms).
- **Secondary, `monitorEventLoopDelay` (resolution 10):** every minute record its p50, p99 and max as the gauges `loop.eld_p50_ms`, `loop.eld_p99_ms`, `loop.eld_max_ms`. Their idle floor on Windows is about 15 ms: a stall of N ms reads about N + 15 ms.
- **Sampling limit:** about 65–80 samples a second, so a stall shorter than about 13 ms is seen only in proportion to its length. `tick.feed_to_ipc_ms` (sampled on every update, hundreds a second) stays the primary delivery metric; `loop.lag_ms` is the explanation for it.
- The acceptance targets that said "loop-lag" (p99 ≤ 10 ms, max ≤ 50 ms) now apply to `loop.lag_ms`.

### 0.3 Hooks: record only; behaviour stays the same

| Metric | Where | How |
|---|---|---|
| `tick.rx_to_feed_ms` | `FyersHSMClient` `ws.on('message')` (:219) sets `rxAt = performance.now()`, passed through `parseBinaryMessage` and `queueNormalizedTick` to `normalized.rxAt`. `BrokerManager` (:51-53) sets `rxAt` when missing. Add `rxAt?: number` to `NormalizedTick` (`IBrokerAdapter.ts:39`) and to `HSMMappedTick`. | at the start of `liveFeed.processRealTick` |
| `tick.feed_to_ipc_ms` | `processRealTick` passes `at: performance.now()` in the `live_bar_updated` payload. `ipcServer` keeps the earliest `at` per pending entry. | at write time in `flushLive`, record `now − at` for each entry written |
| `tick.age_ms` | `liveFeed.ts:389-396` (wall clock minus exchange stamp) | also record into perf |
| `feed.interarrival_ms` | `processRealTick`: last receive time per key | provider cadence (R6) |
| `ipc.writes`, `ipc.lines`, `ipc.bytes`, gauge `ipc.writable_hwm` | `flushLive` | after each `client.write`, gauge `client.writableLength` |
| `db.live_flush_ms`, rows | `flushLiveBars` (`db/index.ts:378-396`) | time around `tx()` |
| `db.history_tx_ms`, rows | `upsertBarsToHistory` (:419-449) | time around `tx()` |
| gauge `db.wal_bytes` | a timer every 5 s: `fs.promises.stat(DB_FILE + '-wal')` | asynchronous |
| gauge `db.pending_live_bars` | size of `pendingBarsAppends` | every 5 s |
| `reader.wait_ms.<op>`, `reader.exec_ms.<op>` | `reader.ts` `call()`: send `sentAt`; the worker replies with `startedAt` and `endedAt` | **Use `performance.timeOrigin + performance.now()` on both sides.** A worker's `performance.now()` has its own time origin. |
| `http.feed_bars_ms`, `http.feed_bars_rows` | `api/routes/feed.ts` `/bars` | from handler entry to `send`; rows = count of `\n` |
| `history.parse_ms` | `FyersAdapter.getHistoricalBars` | from text received to the mapped array |
| `backfill.chunk_cpu_ms` | `BackfillQueue.processChunk` | around repair, validate, `upsertBarsToHistory` and `learnClosedDays` (:796-811) |
| `limiter.wait_ms` | `RateLimiter.acquire` | add an optional `name` constructor argument, used in the metric name |
| `health.compute_ms`, `health.scan_ms` | `DataHealth.compute` | around the whole function and around `readDayCounts` |
| `sync.notices`, `sync.tickers` | `notifyAmiBrokerHistoryChanged` flush | counters |
| `catchup.state_writes` | `PersistedSet.save`, `setHistoryFloorMs`, coverage `saveNow` | counter (gives a baseline for P8) |

### 0.4 Fyers ping probe (R7): `FyersHSMClient`
- After login, send `this.ws.ping()` every 15 s and listen for `'pong'`.
- Log `[FYERS_HSM] server answers pings` once, on the first pong. After 3 pings with no pong, log `[FYERS_HSM] no pong after 3 pings` once.
- Count `fyers.pongs`. Act on nothing yet.

### 0.5 Plugin timing (`plugins/amibroker/src/DataClient.cpp`, `Plugin.cpp`)

**Protocol (compatible).** The engine appends a 10th field to `LIVE_BAR`: `LIVE_BAR|T|ts|o|h|l|c|v|oi|sendMs`. In `ipcServer.ts:129`, store the line without its newline and add `|${Date.now()}\n` at flush time.
- An old plugin parses `oi` with `stof("123|1732…")`, which gives 123, so nothing changes for it.
- The new plugin splits off the extra field and records `transit = NowMs() − sendMs`. `NowMs()` comes from `GetSystemTimePreciseAsFileTime`, converted to unix ms.

**C++ histogram.** Add a small `PerfHist` (same geometric buckets as the engine) behind its own `g_perfMutex`. Never use `g_pollerMutex` for it.

| Plugin metric | Where |
|---|---|
| `transit_ms` | poller, per `LIVE_BAR` that has `sendMs` |
| `notify_delay_ms` | change `g_pendingNotify`'s value to `{ Bar bar; double firstRecvMs; }`. At send time, record `now − oldest firstRecvMs` in the batch. |
| `sendmsg_ms`, `busy` | around `SendMessageTimeoutA` (:255) |
| `gqe_fast_us`, `gqe_slow_ms` | `DoGetQuotesEx`, timed with `QueryPerformanceCounter` |
| `visible_ms` | the time from receiving a live bar to AmiBroker first reading it in the fast path. Keep `g_lastRecvMs[ticker]` and `g_seenRecvMs[ticker]`; record once per received update. |
| `catchup_ms`, `catchup_fail`, `catchup_bars` | `CatchUpThreadProc` |
| `lines` | poller |

**Reporting.** Every 60 s (checked in the notifier thread's loop), send:

`NOTE|PERF|transit_p50=…|transit_p99=…|notify_p95=…|notify_max=…|sendmsg_p99=…|busy=…|gqe_fast_p99_us=…|gqe_slow_max_ms=…|visible_p95=…|catchup_p99=…|catchup_fail=…|lines=…`

Send it with `SendToBridge`, write it to the plugin log, then reset the window.

**Engine side.** `pluginStatus.handlePluginNote` (:91) parses `PERF` into a "last plugin perf" object and still ignores unknown kinds.

### 0.6 Diagnostics route
- Add `GET /perf` in `apps/server/src/api/routes/logs.ts`. The router is mounted at both `/api/logs` and `/api/diagnostics`, so it is served at `/api/diagnostics/perf`.
- It returns:
  - `perf.snapshot()` and the last plugin perf;
  - `process.memoryUsage()` and `process.cpuUsage()`;
  - backfill queue length and running workers;
  - limiter queue lengths;
  - `db.wal_bytes` and `pendingBarsAppends`;
  - IPC client count and the `writableLength` of each client.
- The request logger must skip it (`app.ts:48`).

### 0.7 Port overrides (harness only)
- `config.ts:8`: `AMIBROKER_IPC_PORT = Number(process.env.DATABRIDGE_IPC_PORT) || 7891`.
- `PORT` already exists.
- The plugin always uses 7891.

### 0.8 Harness: new `apps/server/tests/perf/` (test-only)
- The files must not match `*.test.ts`, so vitest skips them. They are never imported from `src`, so esbuild never bundles them.
- Add `"perf": "tsx tests/perf/run.ts"` to `apps/server/package.json`.
- Add `apps/server/tests/perf/results/` to `.gitignore`.

**`run.ts`** takes `--scenario <name> --seconds N --symbols N --rate R`.
1. Set the environment **before importing anything from `src`**:
   - a temp directory from `fs.mkdtempSync(os.tmpdir() + '/dbp-perf-')`;
   - `USERPROFILE`, `HOME` and `APPDATA` all set to it, and `DATABRIDGE_DB_PATH` set to a file inside it;
   - `DATABRIDGE_NO_PG_IMPORT=1`;
   - a random 32-byte hex `DATABRIDGE_SECRET_KEY`;
   - `PORT=17990` and `DATABRIDGE_IPC_PORT=17991`. Don't use 17890, which is used by the charting-platform test hooks.
2. Then `await import(...)` only what's needed:
   - `system/ConsoleCapture`, `app`, `api/realtime.attachRealtime`, an http server, `startup.wireEngineEvents`, `amibroker/ipcServer.startAmiBrokerIpc`, `liveFeed.start()` and `startStallWatch()`;
   - **not** `index.ts`, which would start broker auto-connect, AutoRefresh, MorningBrief and DailyHistory.
3. The IPC server calls `process.exit(0)` on `EADDRINUSE`. Pick free ports and report clearly if they are taken.

**SimFeed (`simFeed.ts`)**
- Add N symbols with `liveFeed.addSymbolByTicker(T, 'sim-1', 'MCX', 'FUT', token)`.
  - **Use MCX.** `liveFeed.inSession` treats only NSE, BSE, NFO and BFO as fixed 09:15–15:30 sessions. With NSE symbols, a run outside market hours builds no bars at all.
- Every 10 ms, emit frames of up to 50 scrips through `brokerManager.emit('tick', {...})`, with these fields:
  - `instrumentId` and `brokerId: 'sim-1'`;
  - `lastPrice` (random walk);
  - `totalVolume`, increasing;
  - `timestamp` = the wall clock floored to whole seconds, like real feeds;
  - `rxAt`.
- Each symbol gets R updates a second.

**Fake plugin (`fakePlugin.ts`)**
- `net.connect(17991)`, then parse lines.
- Record its own `transit_ms` from `sendMs`.
- Keep the final state per `ticker|minute` (the last line wins).
- **Integrity check** at the end:
  1. call `flushPendingBars()`;
  2. for every closed minute, the fake plugin's final state must equal the stored bar (`readBarsCsv`);
  3. for the current minute, it must equal `liveFeed.getLiveBar(T, 'sim-1')`;
  4. report mismatches; any mismatch is a failure.
- Can pause reading for N seconds, to test backpressure (D1).
- Can issue catch-up requests (`GET /api/feed/bars?ticker=T&since=…`) every 200 ms. Record `http_ms`.

**Fake history adapter (`fakeHistory.ts`)**
- An object with:
  - `getHistoricalBars(token, '1m', from, to)`: wait the configured latency, generate NSE-session minutes on weekdays (03:45–10:00 UTC), run a `JSON.parse(JSON.stringify({ candles }))` round trip to get a realistic parse cost, and map to bars;
  - `maxIntradayHistoryDays = 95`, `historyRequestsPerMinute()`, `resolveSymbol(t) → t`, `subscribe`/`unsubscribe` (async, small delay);
  - its own `RateLimiter(10, 600)`, so a short run processes many chunks.
- Put it in place with `(brokerManager as any).activeAdapters.set('sim-1', fake)`.

**Synthetic database (`syntheticDb.ts`)**
- 100 tickers × 250 days × 375 bars, inserted through `upsertBarsToHistory` in large batches before the timed window. Cache the file between runs, keyed by its parameters.

**Scenarios**

| Name | What runs |
|---|---|
| `idle` | engine only |
| `live100` | 100 symbols, 2 updates/s each |
| `live500` | 500 symbols, 2 updates/s each |
| `live500_backfill` | live500, plus 50 tickers enqueued for 365 days with the fake history adapter |
| `live500_health` | live500 on the synthetic DB, `computeHealth(true)` in a loop, plus fake-plugin catch-ups |
| `live500_backpressure` | live500 with the fake plugin pausing its reads for 10 s |
| `import500` | insert a broker row with `stmts.insertBroker.run`, then `POST /api/brokers/sim-1/symbols` with 500 symbols, timed |
| `explain` | prints `EXPLAIN QUERY PLAN` for every prepared statement in `db/index.ts` and `db/reader.ts` (used in Stage 4d) |

**Output**
- Write `results/<date>-<scenario>.json` and print a markdown table: p50, p95, p99 and max for each metric, the high-water marks, CPU time (`process.cpuUsage()`), peak RSS and integrity mismatches.
- Copy the table into the baseline document.
- Run each scenario once with `DATABRIDGE_PERF=0` for CPU-time comparison: the overhead must be under 1%.

### 0.9 Live baseline (the user runs it; prepare the checklist)
The checklist is in [DATABRIDGE_PERFORMANCE_BASELINE.md](DATABRIDGE_PERFORMANCE_BASELINE.md): install the instrumented build, run one market session in phases, then export `/api/diagnostics/perf` and the plugin log.

**Tests for Stage 0**
- `tests/perf.test.ts`: histogram buckets, percentiles, the off switch.
- A `NOTE|PERF` parse test in `tests/pluginStatus.test.ts`.
- The `LIVE_BAR` line still parses in the existing tests, and the extra field is ignored by an old-style parse.

**Rollback:** revert. **Exit:** baseline tables filled from the harness; the live checklist handed to the user; overhead measured.

### Stage 0 as built (what differs from the text above)
- **Metrics module:** `perf.ts` uses `perf.record(name, value)`, `perf.count`, `perf.gauge`, `perf.probe(name, fn)` (a module that owns a queue says how full it is when `/api/diagnostics/perf` asks: `db`, `ipc`, `backfill`, `limiters`), `perf.setPlugin`, `parsePluginPerf` and `formatPerfLine`. There are no histogram handles. The once-a-minute roll and `[Perf]` line are driven by `stallWatch.ts`.
- **Loop lag:** `loop.lag_ms` is a worker-thread probe (see 0.2); `monitorEventLoopDelay` is kept as `loop.eld_*` gauges.
- **Added to the spec:** `feed.interarrival_ms.<broker>`, `fyers.pong_rtt_ms`, `http.feed_bars_rows` (a counter), `db.history_rows`/`db.history_changed`/`db.live_flush_rows` (counters), `tick.age_ms`; in the plugin `stale_p95` (the oldest unread update's wait) and `catchup_bars`. The `NOTE|PERF` line carries them.
- **Rate limiters:** every adapter's limiter is named (`limiter.wait_ms.fyers`, ...); unnamed ones are `other`.
- **Plugin:** the precise clock is looked up by name at run time (`GetSystemTimePreciseAsFileTime` is Windows 8+; a missing import would stop AmiBroker loading the plugin) and falls back to the coarse one. `PerfHist.h` is new. There is still no plugin test project: it arrives in Stage 2.
- **Harness:** the engine may not start child processes (the symbol-details push would otherwise run PowerShell against a real AmiBroker); `--real-ports`, `--with-downloads`, `--dup`/`--swap`; `live500_backfill` is topped up; `tests/perf/overhead.ts` times the instrumentation directly because a metrics-on/off comparison of whole runs is too noisy; `tests/perf/tsconfig.json` type-checks the harness (`npx tsc -p tests/perf/tsconfig.json`, in `apps/server`).
- **Tests:** `tests/perf.test.ts` (13 tests, including the `NOTE|PERF` handling and the route); `tests/liveCandles.test.ts` now reads the new last field of `LIVE_BAR`.
- **Not in Stage 0:** the Fyers ping probe only logs and counts (`fyers.pongs`, `fyers.pong_rtt_ms`): its answer (R7) comes from a live session. `db.checkpoint_ms` waits for Stage 4a.

---

## Stage 1: critical bug fixes (B1–B4, P8, P9)

### 1a. B1: Fyers reconnect never gives up (`FyersHSMClient.ts`)
- **`triggerReconnect` (:269-285):** delete the `reconnectAttempts > 10` return. Use `delay = min(5000 × 1.5^(n−1), 30000) × (0.8 + 0.4 × Math.random())`.
- **`subscribe` (:335):** reconnect when `!this.isConnecting && !this.reconnectTimer && (!this.ws || this.ws.readyState !== WebSocket.OPEN)`.
- **Keep:** the "no subscriptions, don't reconnect" rule (:237-239) and the two-refusal stop (`onAuthRefused`).

### 1b. B2: heartbeat (`startWatchdog`, :759-780)
- **Timer:** every 15 s. If the socket is open, call `ws.ping()`; keep `lastPongAt` on `'pong'` and `lastMessageTime` (already kept).
- **Pongs supported**, learned this run (the first pong sets it): the socket is dead after 30 s since the newer of the last pong and the last message.
- **Otherwise:**
  - in session (`isMarketSession(now, 'NSE') || isMarketSession(now, 'MCX')` from `market/MarketCalendar`): dead after 60 s with no message;
  - outside the session: 300 s, as today.
- **When dead:** take the existing terminate path (:766-777), then emit `'disconnected'` (1c).
- **Check:** importing `MarketCalendar` into the client creates no import cycle.

### 1c. B3: emit `'disconnected'` once per drop
- Add `private dropReported = false`.
- In the close handler (:224), `onAuthRefused` (:513) and the watchdog terminate: if it isn't set yet, set it and `this.emit('disconnected')`.
- On a successful login (:490-495), reset it before emitting `'connected'`.
- Constructor: `constructor(accessToken: string, opts: { url?: string } = {})`, with `this.hsmUrl = opts.url ?? default`.
- **Effect:** `FyersAdapter` (:201-204, 260-263) already maps the event to `connection_state DISCONNECTED`. So `BrokerManager` updates the broker status, and `BrokerLifecycle` (:163-177) then runs the catch-up 150 s after `connected`.

### 1d. B4: deadline covers the body (`FyersAdapter.getHistoricalBars`, :682-694)
- Clear the timer only after `await res.text()`. Raise it to 60 s total.
- An abort during `text()` throws `AbortError`, which the existing catch (:759) turns into a retryable timeout.
- Grep the other adapters for `clearTimeout(` placed before `.text()` or `.json()`, and fix them the same way.

### 1e. P9 (`liveFeed.ts:588`)
Add `const CORES = Math.max(1, os.availableParallelism())` at module level and use it.

### 1f. P8: state files are written in the background
**`market/state/backfillState.ts`**
- `save()` schedules a write 500 ms later.
- The write: `fs.promises.writeFile(tmp)`, then `fs.promises.rename(tmp, STATE_FILE)`.
  - If the rename fails (Windows can refuse while antivirus holds the file), write the file directly instead.
- `flushSync()` writes synchronously. Register it with `process.on('exit', …)`, the same pattern as `closeDb` in `db/index.ts:847`.

**`market/state/coverageState.ts`**
- `setHistoryFloorMs`, `clearHistoryFloor` and `clearVerifiedThrough` use the same debounced writer.
- `saveNow` stays for exit.

**Tests**
- `tests/fyersFeed.test.ts`, using a `ws` `WebSocketServer` on a random port and the new URL option:
  - the server refuses 12 times, then accepts: the client reconnects;
  - the server goes silent: the client terminates within the threshold;
  - close, then login: `'disconnected'` then `'connected'` are emitted once each;
  - with fake timers, `BrokerLifecycle` queues the catch-up after 150 s (mock `queueCatchUp`, or spy on `backfillQueue.enqueueGapPass`).
- A fake HTTP server that stalls the body: `getHistoricalBars` rejects within 60 s (fake timers or a short test timeout).
- `tests/stateFiles.test.ts`: 500 adds produce one write; the content survives a restart (the `vi.resetModules()` pattern from `tests/settingsRestart.test.ts`).

**Risk:** low. **Rollback:** revert the commit.

**Expected gain:**
- A dead Fyers socket is caught in about 30–60 s instead of 5–6 min, and live data never stops for good.
- Gaps after a drop are filled about 150 s after the reconnect instead of up to 30 min later.
- Bursts of synchronous file writes disappear.

---

## Stage 2: live tick pipeline (P3, P4, P10, D1, plus a measured flush change)

> **Done (2026-11-25), with three differences from the text below (see the Discrepancies table in ROOT_CAUSE_ANALYSIS):** the notifier sleeps on a high-resolution timer, because a plain sleep stretched the 50 ms gap to 50-73 ms; `RecentBars` holds the live bar itself and `GetCachedPrevBar` is gone; the flush at the end of the task is now the default (`DATABRIDGE_IPC_FLUSH=immediate` restores the old timing). Stage 3d builds on `BarMerge.h/.cpp`, `RecentBars`, and `tests/dll_host.cpp` (a stand-in for AmiBroker that loads the DLL: `plugins\amibroker\tests\build-dll-host.bat`).

### 2a. P3: event-driven notifier (`DataClient.cpp:146-287`)
- Add `static std::condition_variable g_notifyCv;` and a `MIN_GAP_MS = 50` constant, replacing `NOTIFY_EVERY_MS`.
- **The loop:**
  1. Take a `unique_lock` on `g_pollerMutex`.
  2. `wait_for(lk, 1 s, [] { return g_bShutdown || !g_pendingNotify.empty(); })`.
  3. If less than `MIN_GAP_MS` has passed since the last notice, unlock, `Sleep` the remainder, and lock again.
  4. Swap out the batch and unlock.
  5. Send as today: one notice for the newest ticker. Requeue on busy; `emplace` keeps the newer entries that arrived meanwhile.
  6. Record `lastSent`.
- **Signalling:** call `g_notifyCv.notify_one()` after the lock blocks in `PollerThreadProc` (after `KeepLiveBar`), in `QueueNotify` and in `HandleQuoteMessage`.
- **Shutdown:** `StopPollingThread` calls `notify_all()` before `join`.
- **Timing notes:**
  - `Sleep` and `GetTickCount64` have about 15.6 ms resolution, so the real gap is about 47–63 ms. That is fine.
  - Don't call `timeBeginPeriod`: it changes the timer resolution for all of AmiBroker.
- Keep "one notice per round": per-symbol notices made AmiBroker redraw thousands of times a second (code comment at :268-271).

### 2b. P4: 120-minute ring, extracted and tested

**Extract pure code into `plugins/amibroker/src/BarMerge.h/.cpp`:**
- from `Plugin.cpp`: `LocalTimeOf`, `WriteBarToQuotation`, `QuotationToUnix`, `QuotationMinute`, `BarMinute`, `LowerBoundMinute`, `MergeBars`;
- new: a `LIVE_BAR` and `QUOTE` line parser using `std::from_chars`, which returns ticker, bar and the optional `sendMs`;
- new: a `RecentBars` class, pure with no locking, holding:
  - `std::deque<Bar>` of the final states of closed minutes, ascending, at most 120;
  - `double coveredFromMin`: the earliest minute from which every live minute received is in the ring.

**`RecentBars` methods:**
- `OnLive(const Bar& b, Bar& lastKnown, bool& hasLast)`: the `KeepLiveBar` logic.
  - New minute: push the previous minute's final state.
  - Late update of the previous minute: update the ring's last element.
  - Older than that: ignore, as today.
- `Between(double fromMinExcl, double toMinExcl, std::vector<Bar>& out)`: returns whether the ring covers `fromMin + 60`, that is, `coveredFromMin <= fromMin + 60`.
- `ResetCoverage()`.

**`DataClient.cpp`:**
- `g_recent: std::map<std::string, RecentBars>` under `g_pollerMutex`.
- `KeepLiveBar` uses it. `GetCachedPrevBar` returns `ring.back()` when the minute matches.
- New `bool GetCachedBarsBetween(ticker, fromMin, toMin, out)`.
- On every new IPC connection (:610-616), call `ResetCoverage()` on all rings: minutes during the disconnection weren't received.
- Coverage starts at the first live minute received after a connection. When the front is evicted, coverage moves to the new front.

**`Plugin.cpp` `DoGetQuotesEx` fast path (:226-272):**
- First, when `hasLive && liveMin > sinceMin`: `covered = GetCachedBarsBetween(ticker, sinceMin, liveMin, ringBars)`.
- Gap check: `gapCheck = !fullSync && canCatchUp && liveSkipsMinutes && !covered && GapCheckWorthIt && TryBeginGapCheck`.
- The new-minute branch merges `ringBars` (minutes in `(sinceMin, liveMin)`), then `live`, with `MergeBars`. The ring replaces the "previous bar only" logic.
- Keep the order: a finished catch-up result is merged first, then ring and live (D6).

**Plugin tests (new `plugins/amibroker/tests/`):**
- `plugin_tests.cpp`: an assert-based exe.
  - `MergeBars`: append; overwrite the same minute; insert in the middle; array full drops the oldest; out-of-order input ignored.
  - `RecentBars`: rollover; late update of the previous minute; eviction at 120; coverage after reset.
  - Parser: old 9-field line, new 10-field line, CR endings, garbage.
- `build-tests.bat`: call `vcvars32` like `build.bat`, run `cl /MT /O2 /std:c++17 /EHsc /I..\src plugin_tests.cpp ..\src\BarMerge.cpp /Fe:plugin_tests.exe`, then run it.
- Add `BarMerge.cpp` to `build.bat` and `CMakeLists.txt`.
- Root `package.json`: `"test:plugin": "cmd /c plugins\\amibroker\\tests\\build-tests.bat"`.

### 2c. D1: backpressure with lossless coalescing (`ipcServer.ts:99-131`)

**Per-client state:** `{ socket, pendingLive: Map<string, { line: string; at: number }>, pendingQuotes: Set<string>, congested: boolean, congestedSince: number }`. It replaces the shared maps; usually there is one client.

**`live_bar_updated`:** set the entry in every client's `pendingLive`, keyed `ticker|minute` as today. Re-inserting moves it to the end, so order follows updates.

**`flushLive`:** for each client that isn't congested:
1. build the message;
2. `write`;
3. if `writableLength > 1_048_576`, set `congested` and `congestedSince`;
4. on `'drain'`, clear `congested` and `queueFlush()`.

**Safety valve:** if a client stays congested for more than 60 s, or its `pendingLive` holds more than 200,000 entries, `destroy()` it. The plugin reconnects at once, and the new connection generation makes it re-sync history from the database. Log it as a warning.

**Why this loses no data:** the plugin keeps only the newest state per ticker-minute, and every minute's final state stays in the map until it is written.

### 2d. P10: O(1) lookups (`liveFeed.ts`)
- Add `private keyByTickerBroker = new Map<string, string>()` with keys `${brokerId}|${ticker}`.
- Keep it in step everywhere `instruments` is keyed:
  - `addInstrument`;
  - `updateResolvedToken`;
  - `moveSymbolToBroker`;
  - the re-key in `processRealTick` (:300-308);
  - `removeSymbolByTicker`;
  - `removeAllInstruments`.
- `getLiveBar` uses the index.
- Add `private unknownIds = new Set<string>()` for `${brokerId}:${instrumentId}` values that matched nothing.
  - Skip the fallback scan for those ids.
  - Clear the set on `addInstrument`, `updateResolvedToken` and `moveSymbolToBroker`, and when it exceeds 10,000 entries.
- `tests/liveFeed.test.ts` and `tests/liveCandles.test.ts` must still pass. Add tests: re-keying keeps lookups working; an unknown id is scanned once.

### 2e. Measured A/B: when the push to AmiBroker is flushed
- Add `DATABRIDGE_IPC_FLUSH=immediate|microtask`, default `immediate`, which is today's `setImmediate`.
- In `microtask` mode, `queueFlush` uses `queueMicrotask(flushLive)`. That flushes when the current task ends: still one write per WebSocket frame or per `processQueue` batch, with no extra loop iteration.
- Run `live500` and `live500_backfill` in both modes. Compare `tick.feed_to_ipc_ms` p99 and `ipc.writes` per second.
- Make `microtask` the default only if p99 improves and writes per second stay under about 2,000. Record the decision in the changelog.
- Optionally try emitting Fyers ticks straight from the message handler (dropping the `setImmediate` in `queueNormalizedTick`), measured the same way.

**Plugin build and install:**
- `npm run build:plugin` and `npm run test:plugin`.
- **The user installs it:** close AmiBroker first and keep the old DLL as `DataBridgePro.dll.bak`.
- Compatibility check: an old engine with the new plugin works with no `sendMs` and no range. A new engine with the old plugin works because the extra fields are ignored.

**Risk:**
- 2a: medium (AmiBroker redraw load; tune `MIN_GAP_MS` against `sendmsg_ms`).
- 2b: medium, so test well.
- 2c and 2d: low.

**Rollback:** revert. For the plugin, restore the `.bak` DLL.

**Expected gain:**
- About 75 ms less average delay (up to 150 ms at worst) from plugin receive to AmiBroker notice.
- Symbols that aren't on a chart get missed minutes without HTTP for gaps of up to 2 hours.
- Bounded memory if AmiBroker stalls.

---

## Stage 3: backfill isolation (P1, P5, P6, and P7's interaction)

### 3a. P1: commit history in slices (`db/index.ts:419-449`)
- Keep building `byMinute` as today. Then commit in slices of `HISTORY_SLICE_ROWS = 2000`: `changed += tx(() => { … slice … })`.
- Between slices: `await new Promise<void>(r => setImmediate(r))`.
- Resolve `tickerId()` in the first slice.
- The return value is the same: the total changed count.
- Concurrent upserts for different tickers interleave whole slices. Each `tx()` runs to completion synchronously, so there is no nesting and the non-re-entrant `tx()` is fine.
- `bars_gap_filled` is emitted by the caller after the `await`, which is after the last slice (D5).
- **Redefine `backfill.chunk_cpu_ms`** (`BackfillQueue.processChunk`). Stage 0 times it from `fetched.map(repairBar)` to `learnClosedDays`, which is honest only while the save is one transaction (the `await` gives nothing else a turn). With slices the awaits do, so make it the sum of the synchronous pieces (repair and validate, each slice, `learnClosedDays`) and keep `db.history_tx_ms` per slice.
- `upsertDailyBars` is synchronous with one caller (`DailyHistory.ts:116`) and small chunks. Leave it unless measurements show it over 5 ms.

### 3b. P6: priority classes in the rate limiter
**New `apps/server/src/lib/priority.ts`:**
```ts
import { AsyncLocalStorage } from 'async_hooks'
export type Priority = 'interactive' | 'refresh' | 'bulk'
const store = new AsyncLocalStorage<Priority>()
/** Runs fn with this history-request priority (read by RateLimiter.acquire) */
export function withPriority<T>(p: Priority, fn: () => Promise<T>): Promise<T> { return store.run(p, fn) }
export function currentPriority(): Priority { return store.getStore() ?? 'refresh' }
```

**`lib/RateLimiter.ts`:** replace the single `tail` chain with a FIFO waiter queue per class and one pump.
- `acquire()` reads `currentPriority()`, pushes `{ resolve, cls }` and calls `pump()`.
- `pump()`:
  1. pick the next waiter: interactive first, then refresh, then bulk;
  2. bulk is eligible only if no higher class waited in the last 60 s, or bulk starts in the last minute are under 70% of the budget;
  3. compute the wait with today's slot logic, kept as a pure function: pause, budget, even spacing when lowered, the per-second cap and the clock-back fix;
  4. resolve, or set **one** timer for the wait.
- `pause()`, `limited()` and `perMinuteBudget` keep their behaviour.
- Existing tests must pass: `tests/backfillOrder.test.ts:208-272` and `tests/planLimits.test.ts:229`.
- No adapter changes: the store follows the `await`s into `acquireDataRequest` (`FyersAdapter.ts:49-60`) and the other adapters' limiters.

**Call sites:**

| Where | Priority |
|---|---|
| `BackfillQueue.fetchChunk` (:678-703) | `interactive` when `this.priorityTickers.has(task.ticker)` or the task is forced; otherwise `bulk`. Add `interactive?: boolean` to `BackfillTask` and set it in `enqueueGapFill` when `forceEvenDuringMarket` is true (manual Today, plugin `CMD|TODAY`, liveSlots). |
| `AutoRefresh.refreshOne` (:179-213) | `refresh` |
| `startup.fetchTodayBars` (:84-118) | `refresh` |
| `DailyHistory` | `bulk` |
| Everything else | the default, `refresh` |

**Off switch:** setting `historyPriorities` (default on). When off, every request is treated as one class: today's FIFO.

### 3c. AutoRefresh runs alongside downloads (`AutoRefresh.ts`)
- Remove the early return in `tick()` (:136-143) and the `yieldToDownload` stop in `run()` (:216-218, 222).
- Keep the `waitingFor` field in the status type, always `null`. `apps/desktop/src/pages/FeedStatus.tsx` reads it; check that the page still reads well.
- Keep the daily-allowance logic (`passSymbols`, `requestsLeft`).

### 3d. P5: SYNC with a range, range catch-up, per-ticker backoff

**Engine:**
- `ipcServer.notifyAmiBrokerHistoryChanged(ticker, fromSec = 0, toSec = 0)`:
  - pending entries become `{ from, to }`, with `from = min` of non-zero values and `to = max`;
  - the line is `SYNC|T|from|to` when both are known, `SYNC|T|from` when only from is, else `SYNC|T`.
- `BackfillQueue` (:817) emits `{ ticker, fromSec, toSec }`, taking the minimum and maximum `ts` of `good`. The listener at `ipcServer.ts:141` passes them on.
- `AutoRefresh.notifySync` and `index.ts` (`autoRefresh.start(notifyAmiBrokerHistoryChanged)`) change to `(ticker, fromSec, toSec)`; AutoRefresh passes the range of `good`.
- `startup.fetchTodayBars` (:102) passes the first and last bar.
- `api/routes/feed.ts`: parse `until`, pass it to `stmts.getBarsCsvSinceAsync.get(ticker, since, limit, until)`, and append the live line only when `until` is absent.
- `db/reader.ts` `rawBars`: `WHERE tid = ? AND ts > ? AND ts <= ? ORDER BY ts DESC LIMIT ?`. The default `until` is `9e15`, so the full-load path is unchanged.

**Plugin:**
- Add `g_syncTo` next to `g_syncFrom` (`DataClient.cpp:49-51`). `HandleSyncMessage` (:442-473) parses the optional second number and keeps the maximum.
- `BeginHistorySync` returns from and to. `MarkHistorySynced` erases both.
- In `DoGetQuotesEx` (`Plugin.cpp:239-253`), a full sync with an announced range fetches `[from − 60, to + 60]` with `until`. A connection-generation sync with no range keeps today's last-24-hours rule.
- `FetchBarsFromAPI(ticker, limit, since, until, out)`. The timeout depends on size: about 5,000 expected bars or fewer (`(until − since) / 60`, or `limit`) uses the quick timeouts; anything bigger uses the full ones.

**Backoff:**
- Background catch-ups (`CatchUpThreadProc`): a failure while the bridge is connected sets a per-ticker backoff of 2 s, doubling to 60 s, and doesn't pause anything else. `CatchUpAllowed(ticker)` checks it.
- **Keep the global 15 s pause for the slow-path full load** (`Plugin.cpp:283-288`). That one runs on AmiBroker's own thread, and without the pause a stuck engine would freeze AmiBroker for every symbol of a scan.
- The global pause also stays when the bridge isn't connected.

**Compatibility:** old plugin + new engine reads `stod("from|to")` as `from` and behaves as today. New plugin + old engine sees no `to` and behaves as today.

**Tests:**
- Engine: `SYNC` coalescing (min from, max to) and `feed.ts` `until`. `tests/api.test.ts` has supertest patterns.
- Plugin: parsing `SYNC` with and without `to`.
- Harness: `live500_backfill` bytes per symbol before and after.

### 3e. Conditional: database writer worker (only if, after 3a–3d, `loop.lag_ms` p99 in `live500_backfill` is still over 10 ms or max over 50 ms)
- A worker built from an eval'd source string, like `db/reader.ts`, so it runs inside the SEA exe. It owns a read-write connection and becomes the **only writer** of `bars` and `daily_bars`.
- The main thread sends the raw history text plus `{ ticker, format, fromMs, toMs }`. The worker parses, repairs (port `repairBar`), validates (port `validateBar`) and upserts in slices.
- The worker returns `{ changed, firstTs, lastTs, perDayCounts }`. Change `learnClosedDays` (`MarketCalendar.ts:183`, which takes `bars: { ts }[]` today) to accept the per-day counts.
- Live bars (`flushLiveBars`) and logs also go through the worker, so writers don't contend under `busy_timeout`. Settings, brokers and symbols stay on main: they are rare and small.
- Risk is medium: every adapter's history parse becomes a format the worker knows. Do Fyers first and measure.

**Risk:**
- 3a: low.
- 3b: medium, because daily allowances and refusals must stay correct. Watch for -360 and 429 in harness logs.
- 3c: low to medium (more history requests during downloads, by design).
- 3d: medium.

**Rollback:** revert. Turning off `historyPriorities` restores FIFO.

**Expected gain:**
- Backfill stalls drop from tens of ms to a few ms per slice.
- Non-live symbols keep refreshing during downloads.
- Catch-up bytes per symbol fall by about 2.5–4 times.
- One slow request no longer pauses every symbol.

---

## Stage 4: SQLite (P2, B5, C1)

### 4a. P2: checkpoints off the main thread
**`db/index.ts` `SCHEMA`:** add `PRAGMA wal_autocheckpoint = 20000;` (a backstop only) and `PRAGMA journal_size_limit = 67108864;`.

**New `db/maintenance.ts`:** a worker from an eval'd string, like `reader.ts`.
- **Connection:** opens the database **read-write**, because a read-only connection can't checkpoint, with `PRAGMA busy_timeout = 5000`.
- **PASSIVE checkpoint:** every 5 s it stats the `-wal` file. If it is over 16 MB, or 60 s have passed since the last checkpoint, it runs `PRAGMA wal_checkpoint(PASSIVE)` and posts `{ ms, busy, log, checkpointed }` to main, which records `db.checkpoint_ms`.
- **TRUNCATE checkpoint:** only when the main thread reports no writes for 30 s and neither NSE nor MCX is in session.
- Started from `db/index.ts` after the schema exists, the same way `setReaderDbFile` is used.

**A/B (keep only if better):** `PRAGMA cache_size = -65536` on the main connection, and `PRAGMA mmap_size = 268435456` on the readers. Compare `db.history_tx_ms` and `reader.exec_ms.csv`.

### 4b. B5: reader lanes (`db/reader.ts`)
- Lanes: `interactive` (1 worker) and `bulk` (2 workers).
- `call(op, args, lane)` picks the worker in the lane with the fewest pending requests.
- Default lane per op: `csv` → interactive; `gaps`, `candles`, `hiLo`, `dayCounts`, `dayCountsRange`, `backupTo` → bulk.
- Callers that are bulk by nature pass `'bulk'` for `csv`: `platforms/mt5.ts` (:82, :143) and the other exports. Add an optional `lane` parameter to `readBarsCsv`.

### 4c. B5: incremental health (`market/DataHealth.ts`, `db/reader.ts`, `db/index.ts`)
**New reader op `dayCountsRange({ ticker, fromSec, toSec })`:**
`SELECT (ts + 19800) / 86400 AS d, COUNT(*) AS n FROM bars WHERE tid = ? AND ts >= ? AND ts < ? GROUP BY d`. This is a primary-key range read.

**`db/index.ts`:** export `barWrites = new EventEmitter()` and emit:
- `('changed', ticker, fromSec, toSec)` per ticker from `flushLiveBars` (minimum and maximum minute in the batch), and from `upsertBarsToHistory` when `changed > 0`;
- `('removed', ticker)` from `deleteSymbol`;
- `('reset')` from `cleanDatabase` and `fullForceClean`.

Emit from `db` only; `db` must not import `market` (no cycle).

**`DataHealth`:**
- Keep `days: Map<ticker, Map<day, count>>` and `dirty: Map<ticker, [fromSec, toSec]>`, the union of changed ranges.
- **Warm-up** (first compute, or the depth setting changed by more than a day): loop over tickers, one `dayCountsRange` at a time on the bulk lane, from the depth start to now.
- **Later computes:** recompute only the dirty ranges (replace the day entries inside them), then build the result as today. The calendar logic stays.
- Keep the stale-while-recompute behaviour and the `fresh` flag.
- Remove the old full-table `dayCounts` op once nothing uses it.

**UI (`apps/desktop/src/components/status/DataHealth.tsx`):** a module-level in-flight promise, so all `useDataHealth` instances share one request.

**Tests:** health matches a full recompute after a sequence of live flushes and history upserts. Extend `tests/dataHealth.test.ts`.

### 4d. Query plans
- Run the harness `explain` scenario.
- Record each plan in ROOT_CAUSE_ANALYSIS under a "Query plans" heading.
- Add an index only if a hot query shows `SCAN`. Today's hot queries are all `tid = ?` primary-key ranges.

**Risk:**
- 4a: low to medium. If the worker dies, the backstop checkpoint still runs, and its death is logged.
- 4b: low.
- 4c: medium; test that its counts match a full recompute.

**Rollback:** revert.

**Expected gain:**
- No disk-syncing checkpoint on the live thread.
- AmiBroker's catch-ups never queue behind health scans, backups or exports.
- Health recompute in milliseconds after warm-up.

---

## Stage 5: symbol management (P13, P7, P12)

### 5a. P13: bulk add and import

> **Corrected after the Stage 0 baseline (see the Discrepancies table in ROOT_CAUSE_ANALYSIS).** The harness's `import500` takes 60 ms of engine time for 500 symbols, so "at least 5 times faster" is not a meaningful target. Keep the batching below (one transaction, one subscribe call, one log line, one `enqueueBatch`) and measure these instead: the number of subscribe calls (500 → 1), log lines (2,001 → a few), and the loop lag with `--with-downloads`. Before changing anything else here, time a real import in a live session (the user runs it): the first load of the broker's symbol list, the history downloads at the broker's request limit, and the symbol push into AmiBroker; those are the candidates for what clients feel as slow.
**`db/index.ts`: new `stmts.insertSymbols.run(rows[])`**
- Runs one `tx()` over `q.upsertSymbol`.
- Updates `symbolsCache` through a temporary `Map` index (by broker and ticker), so it stays O(n).

**`market/liveFeed.ts`: new `addSymbolsByTicker(list)`**
- Uses `addInstrument` and the status setup of `addSymbolByTicker`.
- Writes one summary log line instead of one per symbol.

**`brokers/addSymbols.ts` `addSymbolsToBroker(brokerId, symbols, opts = { resolve: true })`, in this order:**
1. Resolve with concurrency 8; skip when `opts.resolve` is false.
2. `insertSymbols`.
3. `addSymbolsByTicker`.
4. **One** `await brokerManager.subscribe(brokerId, allRaw)`. The Fyers client already sends batches of 50.
5. `allowHistory(tickers)` once, then `enqueueBatch`.
6. One summary log, then `pushSymbolDetailsSoon()`.

Keep the per-symbol error logging and the `{ added, total }` result.

**Import route (`api/routes/brokers.ts:490-552`)**
- Keep its parsing and validation.
- Call `addSymbolsToBroker(id, symbols, { resolve: false })` (the route becomes async). It stores what it stores today: instrument id and raw symbol both equal to the ticker.
- Call `backfilledTickers.delete` per ticker, as today; it is cheap after 1f.

**Measure:** harness `import500` before and after: subscribe calls, log lines, and loop lag with and without `--with-downloads`. (The first version of this target, "at least 5 times faster", was withdrawn: the baseline is 60 ms.)

### 5b. P7: live places only for symbols viewed repeatedly (`market/liveSlots.ts`)
- `viewedAt` becomes the last 3 view times per ticker.
- **Wanted:** at least 2 views, at least 10 s apart, within the last 60 s. Charts report every 15 s, scans once.
- **Keeping a place:** unchanged; the last view within 5 minutes.
- `MAX_SWAPS_PER_ROUND` goes from 10 to 5.
- The today gap-fill for a symbol that gains a place is marked interactive, so it gets `interactive` priority (3b).
- **Tests:** a single VIEW doesn't swap; repeated VIEWs do; swaps are capped. Check whether `tests/planLimits.test.ts` covers liveSlots.

### 5c. P12: OLE symbol-details push only when something changed (`amibroker/symbolDetails.ts`)
- **Save what was pushed:** after a successful push, save the TSV to `%APPDATA%\DataBridgePro\amibroker\symbol-details.last.tsv`, alongside the script and data files already there.
- **Push reason:** `schedulePush(delayMs, reason)` with `'connect' | 'added' | 'daily'`.
  - `connect`: push only lines that differ from the last pushed file, or nothing.
  - `added`: push only the new or changed lines.
  - `daily` (08:45 IST, before the market): push the full list, which also covers an AmiBroker database the user switched to.
- **Callers:**
  - `ipcServer.ts:157` uses `'connect'`;
  - `addSymbols` and the import route use `'added'`;
  - `startSymbolDetailsSync` uses `'daily'`.
- **Measure:** time the PowerShell run and log its duration with the count. The plugin's `busy` count during the push gives R5.

**Risk:** low. **Rollback:** revert.

**Expected gain:**
- Imports at least 5 times faster with no live stall.
- Scans no longer churn live places or queue forced downloads.
- No AmiBroker freeze on reconnect when nothing changed.

---

## Stage 6: front-end, back-end and IPC cleanup (P14, P15, P16, QUOTE rate)

- **6a: request logger** (`app.ts:44-57`): also skip `/api/symbols/health`, `/api/backfill/status`, `/api/status/*` and `/api/diagnostics/perf`.
- **6b: P14** (`feed.ts`):
  - remove the `since` re-filter (:127-133);
  - append the live line only when its ts is greater than `since` and greater than the last CSV row, and `until` is absent;
  - bound `feedResponseCache` at 16 MB total, evicting the oldest first.
- **6c: health request sharing** (`DataHealth.tsx`): done in 4c; check it.
- **6d: QUOTE rate limit** (`ipcServer.ts:135-139`):
  - send each ticker's `QUOTE` at most every 250 ms, always the latest state;
  - deferred tickers go into a set, flushed by one timer at the earliest due time;
  - `LIVE_BAR` is not limited.
- **6e: P16, the legacy `GET_QUOTES`** (`ipcServer.ts:194-284`):
  - no `DataClient.cpp` in git history ever sent it (checked 2026-11-25);
  - unless the user knows of a DLL built outside this repository, replace the branch with a one-time warning and an `END` reply;
  - remove the now-unused auto-register code and update the protocol comment at the top of the file.

**Tests:** route tests for `since`/`until`, the cache bound and the request logger. A QUOTE timing test with fake timers.

**Risk:** low.

---

## Stage 7: resources (only where measured)

- **P11, per-tick allocations:** only if a profile at the soak rate (`node --cpu-prof`, or `--trace-gc` in the harness) shows GC pauses over 5 ms. Candidates: `BrokerManager` `{...tick}` (mutate and add `brokerId`), `{...bar}` in the `live_bar_updated` payload (listeners must not keep references), and the de-duplication string in `FyersHSMClient`.
- **Log volume:**
  - BackfillQueue's per-chunk "Fetching…"/"Saved…" lines become one summary a minute (chunks, bars, tickers, errors); keep errors and warnings immediate;
  - `FyersHSMClient`'s 30 s `[System Status]` line is printed only when it changes.
- **`backend.log`:** rotating it while the engine runs needs the engine to own its log file (C3). Do it only if the user wants it; reducing volume comes first.

---

## Stage 8: reliability and recovery

- **8a. Every feed reports its drops.**
  - Check each adapter and feed (Kite, Dhan, Upstox, Angel, Noren, XTS, Kotak) for `connection_state` `DISCONNECTED` on a drop and `CONNECTED` on recovery, as in B3.
  - Fix any that don't report, so the 150 s catch-up works for every broker.
  - Add one test per fixed feed.
- **8b. Engine restart storm.**
  - After an engine restart, the plugin re-syncs the last 24 h of every symbol AmiBroker asks for.
  - Measure with the user (plugin catch-up counters after a restart during the session).
  - If it overloads the engine: use `since − 1 h` for the generation sync, and let the engine announce real downtime ranges with `SYNC|T|from|to` from its catch-up.
- **8c. Database write failures** (`flushLiveBars` retry, `db/index.ts:391-394`):
  - gauge `db.pending_live_bars`;
  - warn at 50,000 bars;
  - above 500,000, stop buffering the oldest and clear those tickers' verified watermark, so gap detection refetches them from the broker;
  - log an error each minute while this lasts;
  - never drop data without a logged recovery path.
- **8d. Fyers token expiry during the session** (`FyersAdapter.scheduleExpiry`): a test that expiry leads to `auth_failed`, the adapter being dropped and the login flow opening once. Confirm the daily re-login path still works.
- **8e. Plugin reconnect:** after an engine restart, ring coverage resets (2b), every viewed symbol re-syncs, and the status light recovers. This is a manual check with the user.
- **8f.** Update diagram 12 in the optimized architecture document with whatever changed.

---

## Stage 9: stress testing and validation

- Run every scenario in [DATABRIDGE_TESTING_AND_VALIDATION.md](DATABRIDGE_TESTING_AND_VALIDATION.md).
- **Soak:** 2 hours of `live500` at 2× rate (4 updates/s per symbol), with a backfill and health scans repeating every 10 minutes.
  - **Pass:** RSS slope under 5 MB per hour after warm-up, every high-water mark bounded, zero integrity mismatches, loop-lag p99 on target throughout.
- Final before/after table against the Stage 0 baseline in the baseline document; summary in the changelog.
- With the user: a full live session using the same checklist as the baseline, then compare.

---

## Feature flags and switches added

| Name | Where | Default | Purpose |
|---|---|---|---|
| `DATABRIDGE_PERF` | env | on | `0` turns off metrics, to measure overhead |
| `DATABRIDGE_IPC_PORT` | env | 7891 | harness only |
| `DATABRIDGE_IPC_FLUSH` | env | `immediate` (maybe `microtask` after 2e) | flush-timing A/B |
| `historyPriorities` | setting | on | off restores FIFO history requests |
| `MIN_GAP_MS` | plugin constant | 50 | notifier gap (a possible future user setting) |
| `HISTORY_SLICE_ROWS` | engine constant | 2000 | slice size for history commits |
