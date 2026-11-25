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
