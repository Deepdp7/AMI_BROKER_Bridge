# DataBridge Pro: testing and validation

How each required scenario is tested, which tools run it, and when a stage counts as done. Compiling is not enough: each stage must also pass its tests, the harness integrity check, and match or beat the baseline in [DATABRIDGE_PERFORMANCE_BASELINE.md](DATABRIDGE_PERFORMANCE_BASELINE.md).

## Tools

| Tool | Command | Notes |
|---|---|---|
| Engine type check | `npm run typecheck --prefix apps/server` | |
| Engine tests (vitest) | `npm test --prefix apps/server` | `tests/**/*.test.ts`. Each test worker gets its own database in a temporary `USERPROFILE` (`vitest.config.ts`, `tests/setup.ts`). To simulate a restart, use `vi.resetModules()` and re-import, as in `tests/settingsRestart.test.ts`. |
| App type check | `npm run typecheck --prefix apps/desktop` | A plain `tsc --noEmit` in `apps/desktop` checks nothing. Use `npx tsc -b` before declaring a build safe. |
| App tests | `npm test --prefix apps/desktop` | |
| Plugin build | `npm run build:plugin` | needs Visual Studio at the path in `plugins/amibroker/build.bat` |
| Plugin tests (added in Stage 2) | `npm run test:plugin` | assert-based exe: merge, ring, parser |
| Perf harness (Stage 0) | `npm run perf --prefix apps/server -- --scenario …` | simulated feed, fake plugin, fake history broker; temporary data folder; ports 17990/17991 |
| Live session | the user, with the checklist in the baseline document | real broker, real AmiBroker |

Fake servers for unit tests:
- a `ws` `WebSocketServer` on port 0, for feed reconnect and silence tests;
- a plain `http.createServer`, for stalled history bodies;
- `vi.useFakeTimers()` for backoff, watchdog and catch-up timing.

## The 22 scenarios

| # | Scenario | How it is tested | Stage | Pass when |
|---|---|---|---|---|
| 1 | Single-symbol live streaming | harness `live100` with `--symbols 1 --rate 5`; unit tests in `tests/liveFeed.test.ts` and `tests/liveCandles.test.ts` | 0 on | integrity 0 mismatches; tick rx→ipc p99 on target |
| 2 | Many symbols live | harness `live100`, `live500` | 0 on | same, at 500 symbols |
| 3 | Large symbol import | harness `import500`; route test for `/symbols/import` | 5a | at least 5× faster than baseline; loop-lag p99 on target during the import; every symbol stored, subscribed once, queued once |
| 4 | Live streaming during backfill | harness `live500_backfill` | 3, 4 | loop-lag p99 ≤ 10 ms, max ≤ 50 ms; tick rx→ipc p99 ≤ 15 ms; integrity 0 |
| 5 | Database reads and writes together | harness `live500_backfill` plus catch-ups from the fake plugin | 3d, 4 | catch-up `http.feed_bars_ms` p99 ≤ 250 ms; no write errors |
| 6 | High-frequency ticks | harness `live500 --rate 10` | 2, 9 | no growing queue; integrity 0; CPU recorded |
| 7 | Network interruption | `tests/fyersFeed.test.ts`: server refuses 12 times, then accepts; server goes silent | 1 | reconnect happens; silence caught within the threshold; `disconnected` then `connected` emitted once each |
| 8 | Feed reconnection | same file: resubscribe after reconnect; `BrokerLifecycle` catch-up 150 s after `connected` (fake timers); one test per feed fixed in Stage 8a | 1, 8 | catch-up queued; symbols resubscribed |
| 9 | Engine restart | harness: stop and restart the IPC server while the fake plugin reconnects; live session step 5 | 8 | plugin reconnects within 1 s; every viewed symbol re-syncs; status light recovers |
| 10 | App (front end) restart | manual: close and reopen the window during a live session; WS resync | 6 | the engine keeps streaming; the app shows the current state without errors |
| 11 | AmiBroker restart | manual with the user | 2, 8 | full loads on first view; quotes and status sent; symbol details pushed only if changed (5c) |
| 12 | Database lock contention | harness `live500_backfill` with health scans and catch-ups; unit test with two connections and a long writer | 3a, 4 | no `SQLITE_BUSY` errors; each slice under 10 ms |
| 13 | Temporary disk slowdown | manual: run the harness while a large file copy runs on the same disk | 4a | checkpoints run off the main thread; loop lag stays on target |
| 14 | CPU saturation | manual: run the harness while a CPU stress tool uses every core | 9 | no data loss; latency rises and falls back with no growing queue |
| 15 | RAM pressure | soak run, RSS slope | 9 | RSS slope under 5 MB/h after warm-up |
| 16 | Queue congestion | harness `live500_backpressure` | 2c | socket buffer bounded at about 1 MB; integrity 0 after the pause; safety valve tested (pause over 60 s → reconnect and re-sync) |
| 17 | Long continuous streaming | 2-hour soak (`live500` at 2× rate, repeated backfills and health scans) | 9 | every high-water mark bounded; integrity 0; targets held |
| 18 | History/live handover | unit tests: history doesn't overwrite a minute that ended under 30 s ago; live never overwrites history; plugin `MergeBars` cases | 2b, 3d | tests pass |
| 19 | Duplicate ticks | harness: SimFeed re-sends each frame 10% of the time; `liveFeed` unit test (same totalVolume, same price) | 0 on | no double-counted volume; integrity 0 |
| 20 | Out-of-order ticks | harness: SimFeed swaps 5% of adjacent updates and sends some late updates to the previous minute; plugin `RecentBars` late-update test | 2b | the bar close is the newest trade; previous-minute updates reach the plugin; integrity 0 |
| 21 | Missing tick recovery | unit: gap detection finds a removed range and queues a gap fill; plugin ring covers missed minutes without HTTP; harness: fake plugin stops reading for 3 minutes, then merges from the ring and catches up | 1, 2b, 3d | gaps filled; missed minutes present; no duplicate rows (primary key) |
| 22 | Several AmiBroker charts or consumers | manual with the user: several charts and a Real-time Quote window; two AmiBroker instances if they use it | 2 | each consumer updates; notice rate bounded (at most 20/s) |

## Integrity checks (run in every harness scenario)

1. **Final state per minute.** For every ticker and closed minute, the last `LIVE_BAR` the fake plugin got equals the stored bar after `flushPendingBars()`. For the current minute, it equals `liveFeed.getLiveBar()`.
2. **No duplicates.** `bars (tid, ts)` is the primary key; check row counts against distinct minutes generated.
3. **No silent drops.** Every simulated update either changes a bar or is a recorded duplicate or late tick. The harness counts each kind.
4. **Volume.** Each closed minute's volume equals the difference in the simulated `totalVolume` across that minute.

Any mismatch fails the stage.

## Acceptance criteria for the whole effort

These are provisional. Finalize the numbers after the Stage 0 baseline, and write the final targets here.

| # | Criterion | Target |
|---|---|---|
| 1 | No unexplained tick accumulation | loop-lag p99 ≤ 10 ms, max ≤ 50 ms in `live500_backfill`; live session: no app-caused pause over 1 s |
| 2 | No avoidable blocking of live delivery | tick rx→ipc p99 ≤ 5 ms idle, ≤ 15 ms during backfill |
| 3 | Prompt notice to AmiBroker | plugin `notify_delay_ms` p95 ≤ 55 ms while AmiBroker is idle |
| 4 | No unbounded queues | every queue has a high-water mark and a bound (optimized architecture, diagram 11) |
| 5 | No silent tick loss | integrity checks 0 mismatches in every scenario and in the soak |
| 6 | Correct history/live synchronization | handover unit tests pass; live session shows corrected bars after refresh |
| 7 | Reliable recovery | Fyers dead socket caught within 60 s during the session; reconnect never stops; catch-up 150 s after reconnect |
| 8 | No duplicates from recovery | primary key holds; plugin merge tests pass |
| 9 | Stable resources | RSS slope under 5 MB/h in the soak; CPU no higher than baseline at the same load |
| 10 | Faster symbol import | `import500` at least 5× faster |
| 11 | Steady AmiBroker updates under load | catch-up p99 ≤ 250 ms during backfill and health scans; zero global catch-up pauses; live session: `busy` and `sendmsg_ms` no worse than baseline |

**Results after Stage 9** (the numbers: baseline document, "Final comparison"; summary: the Stage 9 changelog entry): met 2-9 and 11; **1 not met in the harness** (loop lag p99 27-39 ms, max 75-84 ms during downloads; the live session decides); 10 withdrawn in Stage 0. Scenario 13 (disk contention) **fails** before and after Stage 9; scenario 13 is now run with `dd ... conv=fsync` in a loop for the whole run (a single cached `dd` ended in 2.7 s and proved nothing). Scenarios 10, 11, 22 and the live session are the user's.

## Reporting

At the end of each stage, the changelog entry lists:
- every command run and its result (pass/fail counts, the first lines of any failure);
- the harness tables (before → after);
- anything not tested, and why;
- what the user must do: install the DLL, run the live checklist, decide on optional items.
