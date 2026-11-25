# DataBridge Pro: performance baseline

The numbers every change is judged against.
- **Stage 0** builds the instrumentation and the harness, then fills in the "Baseline" columns.
- **Later stages** add their own columns.
- **Live baseline**: the user's live session (checklist below) fills in that table.

All latencies are reported as **p50 / p95 / p99 / max**. Feed (provider) latency, application latency and AmiBroker's own time are recorded separately and never added together.

## Evidence available before Stage 0

From this PC (8 symbols, Fyers), read on 2026-11-25:

| Source | Finding |
|---|---|
| `backend.log` (2026-10-25 to 2026-11-22) | 0 `[Perf]` stall lines (the threshold is 500 ms, so smaller stalls are not visible); 12 Fyers socket disconnects; catch-up passes of 0.1–0.2 s for 8 symbols; AutoRefresh pass of 7 symbols in 24.8 s |
| `DataBridgePro_plugin.log` (4,445 lines) | 303 `[TICK] ok`, 0 `busy`; 2 "catch-up paused for 15 s"; 22 "caught up N missed bar(s)" (up to 2,695 bars); 83 full loads; 118 IPC reconnects (mostly dev restarts) |
| Database | `databridge.db` 0.9 GB, WAL 795 KB at idle |
| Client incident 2026-11-19 (project notes) | 438 symbols on Fyers Standard, 338 never live; AmiBroker load factor 227% |

None of this measures latency per stage, which is why Stage 0 exists.

## Metric definitions

### Engine (`apps/server/src/system/perf.ts`, `GET /api/diagnostics/perf`)

| Metric | Unit | Meaning | Kind |
|---|---|---|---|
| `loop.lag_ms` | ms | how long the main thread took to answer a ping from a worker thread (about 65–80 pings a second; accurate to about 0.1 ms) | application |
| `loop.eld_p50_ms`, `loop.eld_p99_ms`, `loop.eld_max_ms` | ms | Node's `monitorEventLoopDelay` (10 ms resolution), once a minute. **On Windows an idle loop reads about 15 ms** because of the 15.6 ms timer tick, so only compare these with each other | application (coarse) |
| `tick.rx_to_feed_ms` | ms | WS frame received → `processRealTick` starts | application |
| `tick.feed_to_ipc_ms` | ms | `processRealTick` → `LIVE_BAR` written to the plugin socket | application |
| `tick.age_ms` | ms | PC clock minus exchange timestamp (whole-second stamps, coarse) | provider + network + clock |
| `feed.interarrival_ms` | ms | time between updates of the same symbol | provider cadence |
| `ipc.writes`, `ipc.lines`, `ipc.bytes` | count/s | push volume | — |
| `ipc.writable_hwm` | bytes | highest socket buffer | queue |
| `db.live_flush_ms`, `db.live_flush_rows` | ms, rows | 2-second live-bar commit | application (disk) |
| `db.history_tx_ms`, `db.history_rows` | ms, rows | history upsert transaction (per chunk, or per slice from Stage 3a) | application (disk) |
| `db.checkpoint_ms` | ms | WAL checkpoint duration (Stage 4a on; before that, look for commit spikes) | disk |
| `db.wal_bytes` | bytes | WAL size | queue |
| `db.pending_live_bars` | bars | live bars waiting to be committed | queue |
| `reader.wait_ms.<op>`, `reader.exec_ms.<op>` | ms | reader queue wait and run time per operation | application |
| `http.feed_bars_ms`, `http.feed_bars_rows` | ms, rows | AmiBroker's history request, end to end in the engine | application |
| `history.parse_ms` | ms | broker JSON → bar objects | application |
| `backfill.chunk_cpu_ms` | ms | synchronous main-thread work per chunk | application |
| `limiter.wait_ms` (per limiter, per class from 3b) | ms | wait for a broker request slot | plan limits |
| `health.compute_ms`, `health.scan_ms` | ms | Symbol Setup health | application |
| `sync.notices`, `sync.tickers` | count | SYNC lines sent to the plugin | — |
| `catchup.state_writes` | count | state-file writes | disk |
| `fyers.pongs` | count | WS pongs from Fyers (R7) | provider |

### Plugin (`NOTE|PERF` every 60 s, also written to `C:\Users\Public\DataBridgePro_plugin.log`)

| Metric | Unit | Meaning | Kind |
|---|---|---|---|
| `transit_ms` | ms | engine `sendMs` → plugin received (same PC clock) | application + OS |
| `notify_delay_ms` | ms | first unsent change received → notice sent to AmiBroker | application |
| `sendmsg_ms` | ms | `SendMessageTimeout` duration (AmiBroker accepting the notice) | **AmiBroker** |
| `busy` | count | notices AmiBroker didn't accept within 1 s | **AmiBroker** |
| `gqe_fast_us` | µs | `GetQuotesEx` live path | application (inside AmiBroker) |
| `gqe_slow_ms` | ms | `GetQuotesEx` full load (HTTP) | application + engine |
| `visible_ms` | ms | live bar received → AmiBroker first reads it | application + **AmiBroker** |
| `catchup_ms`, `catchup_fail`, `catchup_bars` | ms, count, bars | background history catch-ups | application + engine |
| `lines` | count | lines received | — |

**End-to-end application latency** (broker frame received to the bar visible to AmiBroker) ≈ `tick.rx_to_feed_ms` + `tick.feed_to_ipc_ms` + `transit_ms` + `visible_ms`. Chart drawing time after that is AmiBroker's and is not measured.

## Running the harness

```
npm run perf --prefix apps/server -- --scenario live500 --seconds 180
npm run perf --prefix apps/server -- --scenario live500_backfill --seconds 300
npm run perf --prefix apps/server -- --scenario live500_health --seconds 180
npm run perf --prefix apps/server -- --scenario live500_backpressure --seconds 120
npm run perf --prefix apps/server -- --scenario import500
npm run perf --prefix apps/server -- --scenario explain
DATABRIDGE_PERF=0 npm run perf --prefix apps/server -- --scenario live500 --seconds 180   (overhead check)
```

Options: `--seconds N`, `--symbols N`, `--rate R` (updates per symbol per second), `--dup P` and `--swap P` (the chance that an update is sent twice, or swaps places with the symbol's next one), `--with-downloads` (import500 only), `--real-ports` (see below).

How the harness runs (as built in Stage 0):
- It uses a new temporary data folder each run (never `%APPDATA%\DataBridgePro`; older runs' folders are removed at the start of the next) and ports 17990/17991. `--real-ports` uses 7890/7891 instead, where the real plugin DLL looks: only for trying a rebuilt DLL against the harness, with the real engine stopped.
- The engine cannot start child processes there. Its symbol-details push runs PowerShell against a running AmiBroker through OLE, which would add the simulated symbols to a real one (a run showed it trying: `execFile powershell.exe`, blocked).
- Simulated symbols are on MCX, so bars build at any time of day.
- 3 s of warm-up, then every number is reset and the timed window starts.
- Results go to `apps/server/tests/perf/results/` as JSON, and a markdown table is printed. Copy that table into the sections below.
- Each run ends with the integrity check: the last state of every minute the fake plugin received equals what the engine stored (and the live bar for the current minute); the volumes of a symbol's minutes add up to what the feed sent; no stored bar of the run is missing from what the plugin received. Any difference fails the run (exit code 1).

Things to know when reading the numbers:
- A histogram's lowest bucket is 0.05 ms, so anything faster reads 0.05 (`tick.rx_to_feed_ms` in the harness: the simulated feed hands over in microseconds).
- `tick.age_ms` in the harness is spread evenly over 0-1000 ms by construction (the simulated exchange stamps whole seconds). It only means something in a live session.
- `tick.rx_to_feed_ms` in the harness measures from the simulated feed's emit, not from a socket read. The real socket to feed step is measured only in a live session.
- `live500_backfill`: 50 tickers with a year of history queued, topped up (10 more whenever fewer than 20 tasks wait) so the load lasts the whole run. The simulated broker answers 10 requests a second (a real Fyers allows 0.75): the load per chunk is real, the rate is a stress rate. The 500 live symbols count as already downloaded, as in a running engine. The fake plugin does what the real one does on a SYNC: fetch the bars from the announced start up to now (P5).
- `import500` holds the history downloads back (the numbers are the import's own); `--with-downloads` lets them start with the import.
- RSS peaks in the harness come from the development runtime. The shipped engine runs with `--optimize-for-size` and peaks far lower: compare harness runs only with each other.
- This PC is fast (Core Ultra 9, 24 threads). A client's will be slower, so read the shape of the numbers (what rises when history downloads) more than their size.

Record the machine with every run: CPU, cores, RAM, disk type, Windows version, Node version (`node -v`, currently v24.18.1), and whether antivirus scans `%TEMP%`.

## Baseline: harness (fill in during Stage 0)

Machine: Intel Core Ultra 9 275HX, 24 threads, 31 GB RAM, Windows 10.0.26300, Node 24.18.1 · Date: 2026-11-25 · Code: commit `8bdf906` plus the Stage 0 instrumentation (no behaviour change)

### `live500` (500 symbols × 2 updates/s)

| Metric | p50 | p95 | p99 | max | after Stage 1 | after Stage 2 | after Stage 3 | after Stage 4 | final |
|---|---|---|---|---|---|---|---|---|---|
| loop.lag_ms | 0.143 | 0.306 | 0.655 | 2.00 | 0.118 / 0.448 / 1.83 | 0.253 / 1.28 / 8.55 (one spike in 5,007 samples) | | | |
| tick.rx_to_feed_ms | 0.05 (floor) | 0.05 | 0.05 | 0.16 | 0.05 / 0.05 / 0.14 | 0.05 / 0.05 / 0.24 | | | |
| tick.feed_to_ipc_ms | 0.055 | 0.143 | 0.230 | 2.50 | 0.067 / 0.278 / 2.32 | 0.050 / 0.278 / 1.18 | | | |
| fake-plugin transit ms (1 ms clock) | 0.05 | - | 1.06 | 2.0 | 0.05 / 1.06 / 2.0 | 0.05 / 1.06 / 9.0 | | | |
| ipc.writes/s | 62 (1,979 lines/s) | | | | 63 (1,975 lines/s) | 68 (1,973 lines/s) | | | |
| db.live_flush_ms (every 2 s) | 0.87 | 1.8 | 1.8 | 1.8 | 1.6 (one sample: 60 s run) | 1.0 / 2.8 (2 samples) | | | |
| CPU % (engine, of one core) | 2.2 | | | | 3.4 (a 60 s run: start-up counts for more than in 180 s) | 4.8 | | | |
| RSS peak MB | 184 | | | | 184 | 172 | | | |
| integrity mismatches | 0 (1,500 bars, 78,007 updates) | | | | 0 (1,000 bars, 63,000 updates) | 0 (1,000 bars, 63,007 updates) | | | |

### `live500_backfill` (plus 50 symbols × 365 days)

| Metric | p50 | p95 | p99 | max | after 3a | after 3b–3d | after 4a | final |
|---|---|---|---|---|---|---|---|---|
| loop.lag_ms | 10.4 | 219 | 266 | 315 | | 0.87 / 43.4 / 77.0 / 132 | 0.28 / 16.8 / 39.5 / 91.8 (second run: 0.31 / 16.8 / 43.4 / 77.0) | |
| tick.feed_to_ipc_ms | 1.06 | 35.9 | 242 | 340 | | 0.050 / 0.157 / 0.253 / 2.18 | 0.050 / 0.118 / 0.190 / 0.75 | |
| history.parse_ms | 4.0 | 5.3 | 6.5 | 9.2 | | 4.0 / 7.8 / 10.4 / 13.2 | (unchanged) | |
| backfill.chunk_cpu_ms | 35.9 | 52.6 | 63.6 | 70.5 | | 43.4 / 70 / 77 / 95 (the sum of the pieces, see 3a: not the same thing as before) | 22.3 / 29.7 / 32.6 / 34.2 | |
| db.history_tx_ms | 20.3 | 35.9 | 47.8 | 51.7 | | 1.7 / 3.3 / 24.5 / 42.6 (one slice of 2,000 rows; before: one chunk) | 1.55 / 2.06 / 2.74 / 5.4 (a slice) | |
| http.feed_bars_ms (the fake plugin's catch-ups) | 27.0 | 242 | 354 | 375 | | 24.5 / 57.8 / 84.6 / 152 | 20.3 / 47.8 / 63.6 / 79.7 | |
| db.wal_bytes max | 8.5 MB | | | | | 5.2 MB | 64-68 MB, steady (journal_size_limit; the worker empties it every second or so) | |
| chunks/min | 597 (906 in 91 s, 21.1 M bars) | | | | | 598 (906 in 91 s) | | |
| catch-up bytes per symbol | mean 3.4 MB, max 10.6 MB (582 symbols) | | | | | mean 1.22 MB, max 4.17 MB (613 symbols) | | |
| CPU % (engine, of one core) / RSS peak | 111 / 1,944 MB | | | | | 76 / 1,296 MB | 58 / 1,118 MB | |
| integrity mismatches | 0 (1,500 bars, 93,068 updates) | | | | | 0 (1,000 bars, 92,998 updates) | 0 (1,000 bars, 93,016 updates) | |

**After Stage 1** (a second 91 s run, same scenario): loop.lag_ms p50 / p99 / max 0.60 / 242 / 299 ms; tick.feed_to_ipc_ms 0.49 / 181 / 290 ms; backfill.chunk_cpu_ms 35.9 / 57.8 / 61.2 ms; 906 chunks, 0 failed history requests; integrity 0 mismatches (1,000 bars, 92,998 updates). Stage 1 does not touch this path, so this run differs from the baseline only by run-to-run variation (the two baseline runs of this scenario also differ, p99 lag 242-266 ms). The one number Stage 1 is meant to move: `catchup.state_writes` was 476 and 597 in the two baseline runs and is **205** now (2.3 a second). Since Stage 1 they are background writes, at most one per file every 500 ms, not whole-file writes on the engine's thread at every change.

**After Stage 2** (the flush at the end of the task, 90 s, one run each way on the same machine; "feed_to_ipc" = a bar ready to its write on AmiBroker's channel):

| | before (Stage 1 build) p50 / p95 / p99 / max | after p50 / p95 / p99 / max |
|---|---|---|
| tick.feed_to_ipc_ms | 0.34 / 16.8 / **181** / 276 | 0.067 / 0.45 / **0.66** / 1.9 |
| loop.lag_ms | 0.60 / 181 / 242 / 286 | 1.87 / 200 / 266 / 311 |
| http.feed_bars_ms (catch-ups) | 24.5 / 102 / 242 / 336 | 27.0 / 165 / 292 / 390 |
| ipc.writes a second | 61 | 68 |
| integrity | 0 mismatches | 0 mismatches |

The loop lag is **not** better: the engine's one thread is still busy for 200-300 ms at a time with history chunks (Stage 3 changes that). What changed is that a bar that has been processed is written at once, instead of waiting in line behind the next chunk. A tick that arrives *while* a chunk is being processed still waits for that chunk.

**After Stage 3** (3a to 3d together, 90 s, the same scenario, three runs on the same machine in one sitting: "before" = slicing switched off with `DATABRIDGE_HISTORY_SLICE_ROWS=100000000` and the fake plugin behaving like the plugin of before Stage 3 (`--old-sync`: a SYNC fetch runs from the start to now); "3a only" = slices on, old plugin behaviour; "after" = everything):

| | before p50 / p95 / p99 / max | 3a only | after (3a-3d) |
|---|---|---|---|
| loop.lag_ms | 4.0 / 200 / **266** / 317 | 1.70 / 47.8 / **70.0** / 112 | 0.87 / 43.4 / **77.0** / 132 |
| tick.feed_to_ipc_ms | 0.067 / 0.448 / 0.721 / 7.5 | 0.050 / 0.173 / 0.278 / 0.95 | 0.050 / 0.157 / 0.253 / 2.18 |
| db.history_tx_ms (a chunk before, a slice after) | 22.3 / 77 / 93 / 124 | 1.7 / 3.3 / 24.5 / 33.8 | 1.7 / 3.3 / 24.5 / 42.6 |
| http.feed_bars_ms (catch-ups) | 24.5 / 136 / 292 / 391 | 24.5 / 112.7 / 136 / 177 | 24.5 / 57.8 / 84.6 / 152 |
| catch-up bytes per symbol | mean 2.75 MB, max 10.6 MB | mean 2.46 MB, max 10.6 MB | mean 1.22 MB, max 4.17 MB |
| rows served to catch-ups | 34.6 M | 34.5 M | 17.8 M |
| engine CPU, of one core | 91% | 96% | 76% |
| integrity | 0 mismatches | 0 mismatches | 0 mismatches |

The "before" run agrees with the earlier baseline runs (loop.lag_ms p99 242-266 ms), so this is not run-to-run variation. What each part did:

- **3a (slices) is the part that moves the loop lag**: p99 266 to 70 ms, max 317 to 112 ms, and the time from a bar being ready to its write on AmiBroker's channel (feed_to_ipc) p99 0.72 to 0.28 ms. A transaction is 2,000 rows, 1.7 ms (p50) instead of a chunk's 22 ms; the p99 of a slice (24.5 ms) and its max are checkpoints of the write-ahead log inside COMMIT (P2, Stage 4a).
- **3d (ranges) halves the catch-up volume** (2.0×, not the 2.5-4× the roadmap expected: a chunk of the harness is 95 days, and the saving is the tail from a chunk to now, so it grows with the length of the download): catch-up answers p95 136 to 58 ms, p99 292 to 85 ms, engine CPU 91% to 76%. It does not change the loop lag p99 (70 to 77 ms is noise between runs).
- **The loop lag is still not under 10 ms** (p99 77 ms, max 132 ms). A chunk's own work is still 43 ms in several pieces (backfill.chunk_cpu_ms, 39 ms p50 / 77 ms p99): the slices are about 20 ms of that, the rest is one piece, the repair, validate and `Map` of the 25,000 bars before the first slice and `learnClosedDays` after the last one (estimated 15-25 ms). On top of that come the catch-up answers built and re-filtered on the main thread (P14, Stage 6b) and the checkpoints (4a).
- **The classes in the limiter** (`limiter.wait_ms.sim.interactive` / `.bulk`): 711 of the 906 chunks were `interactive`, because the harness's plugin asks for those symbols over `/api/feed/bars`, which marks them as "a chart is waiting" (`prioritize`), as the real plugin does when AmiBroker loads a symbol. The priority between auto-refresh and bulk downloads is therefore not exercised by this harness (the unit tests cover it: `tests/historyPriorities.test.ts`).

Read it against live500 above: the same 500 symbols and the same updates, and the loop lag goes from p99 0.66 ms to **266 ms**, and the time from a bar being ready to its write on AmiBroker's channel from p99 0.23 ms to **242 ms** (max 340 ms). Each history chunk holds the engine's one thread for 36 ms (median; 64 ms at p99), of which the database save is 20 ms. At 10 chunks a second that is about a third of the thread, in blocks. The loop lag is larger than any single chunk (up to 315 ms) because the catch-up answers are also built on that thread: the plugin asks for "from the announced start up to now", about 3.4 MB per symbol on average (P5), and `/api/feed/bars` re-filters those on the main thread (P14).

**After Stage 4** (4a, and the piece that turned out to matter more: `learnClosedDays`, see the Discrepancies table; 90 s runs on the same machine in one sitting):

| | Stage 3 (the run above) | 4a: worker checkpoints, p50 / p95 / p99 / max | 4a switched off (`DATABRIDGE_MAINTENANCE=0`) | 4a + `learnClosedDays` fix, run 1 | run 2 |
|---|---|---|---|---|---|
| loop.lag_ms | 0.87 / 43.4 / 77.0 / 132 | 2.49 / 57.8 / 112.7 / 226 | 3.01 / 63.6 / 112.7 / 186 | **0.28 / 16.8 / 39.5 / 91.8** | 0.31 / 16.8 / 43.4 / 77.0 |
| tick.feed_to_ipc_ms | 0.050 / 0.157 / 0.253 / 2.18 | 0.055 / 0.253 / 0.492 / 0.85 | 0.055 / 0.230 / 0.370 / 1.33 | 0.050 / 0.118 / 0.190 / 0.75 | 0.050 / 0.118 / 0.190 / 0.81 |
| db.history_tx_ms (a slice of 2,000 rows) | 1.7 / 3.3 / 24.5 / 42.6 | 2.26 / 3.31 / **3.65** / 73.1 | 2.26 / 3.31 / **16.75** / 80.4 | 1.55 / 2.06 / 2.74 / **5.4** | 1.55 / 1.87 / 2.26 / 5.7 |
| backfill.chunk_cpu_ms | 43.4 / 70 / 77 / 95 | 52.6 / 63.6 / 70 / 133 | 52.6 / 77 / 84.6 / 124 | **22.3 / 29.7 / 32.6 / 34.2** | 24.5 / 27 / 29 / 29 |
| http.feed_bars_ms (catch-ups) | 24.5 / 57.8 / 84.6 / 152 | 32.6 / 84.6 / 150 / 198 | 32.6 / 84.6 / 124 / 184 | 20.3 / 47.8 / 63.6 / 79.7 | 22.3 / 47.8 / 57.8 / 98 |
| reader.wait_ms.csv | 0.08 / 0.60 / 39.5 / 52 | 0.08 / 13.8 / 32.6 / 45 | 0.09 / 13.8 / 39.5 / 51 | 0.07 / 0.25 / 16.8 / 29 | 0.08 / 0.19 / 24.5 / 46 |
| db.checkpoint_ms (on the worker) | - | 29.7 / 52.6 / 65 / 65 (89 in 90 s) | - | (same) | |
| engine CPU, of one core | 76% | 98.5% | 94% | **58%** | 58% |
| integrity | 0 | 0 | 0 | 0 | 0 |

- **Checkpoints (4a)**: with the worker, a slice's p99 is 3.7 ms; with it switched off (the same code otherwise) 16.8 ms. The checkpoints themselves are not cheaper: 30 ms (median) each, 89 of them in 90 s, but they now happen on the worker's thread. The log file stays at its 64 MB limit while the download runs (it is reused, not grown) and is emptied to zero bytes after 30 s without writes.
- **The loop lag p99 is the same with and without the worker (112.7 ms both)**: checkpoints were not what held the thread. The pieces of a chunk were timed on their own (37,875 bars): repair 1 ms, validate 1 ms, the save 40 ms in 19 slices of about 2 ms each, and **`learnClosedDays` 22 ms in one piece** (a `Date` and a text date made for each of the 37,875 bars). Making the text date once per day instead brought it to 1.5 ms, and the loop lag p99 from 112 to **40 ms**, the longest piece of a chunk from 22 ms to about 3 ms, the engine's CPU from 98% to 58%.
- **Still above the 10 ms target** (p99 40 ms, max 77-92 ms). A chunk is now all small pieces; what remains is the catch-up answers built on the main thread (`/api/feed/bars` splits, filters and joins the text of 30,000 lines for a `since` request: P14, Stage 6b) and the harness's own load (10 chunks a second; a real broker allows 45 a minute, so about one in 13).
- **`cache_size` 64 MB on the writer (A/B, not kept)**: slice p50 2.26 ms (same), p99 3.31 ms (3.65); loop lag p99 93 ms (113, within the run-to-run spread). **`mmap_size` 256 MB on the readers (A/B, not kept)**: reader.exec_ms.csv 20.3 / 43.4 / 47.8 (20.3 / 43.4 / 52.6), wait p95 8.6 ms (13.8). Neither gives a difference larger than the variation between identical runs on this machine, and the harness database (a few hundred MB, mostly in the file cache) is the case where they would help least: a client's 2 GB database could behave differently, so both stay as settings for measuring (`DATABRIDGE_SQLITE_CACHE_KIB`, `DATABRIDGE_SQLITE_MMAP_MB`) and neither is on by default.

### `live500_health` (synthetic 100-symbol year database)

| Metric | p50 | p95 | p99 | max | after 4b | after 4c | final |
|---|---|---|---|---|---|---|---|
| health.compute_ms | 2,162 | 2,190 | 2,190 | 2,190 | (with 4c) | 2.5 / 5.3 / 11.4 / 938 (the first one, which counts every symbol; 118 later ones read only what was written) | |
| health.scan_ms (one request) | 2,162 | 2,188 | 2,188 | 2,188 | (with 4c) | 0.06 / 20.3 / 20.3 / 26.9 (620 requests, 1,600 ranges) | |
| reader.wait_ms.csv | 0.13 | 1,787 | 1,932 | 1,932 | 0.11 / 0.25 / 0.45 / 36.6 | 0.11 / 0.25 / 0.45 / 36.6 | |
| http.feed_bars_ms (catch-ups) | 0.60 | 1,787 | 1,936 | 1,936 | 0.54 / 0.96 / 1.70 / 38.6 | 0.54 / 0.96 / 1.70 / 38.6 | |
| catch-up failures (over 4 s) | 0 of 435 | | | | 0 of 582 | 0 of 582 | |

The 9.4 M-row database is about one fifth the size of a client's (500 symbols x a year is about 1.9 GB). A scan of 2.2 s here means about 10 s there, against the plugin's 4 s catch-up timeout. The live feed is not affected (loop lag p99 0.79 ms, max 4.2 ms): this costs AmiBroker its history requests, not its live ticks (B5). `EXPLAIN QUERY PLAN` shows why: the health query is the only one that does `SCAN b`; every other query uses the primary key.

**After Stage 4** (4b and 4c were measured together: one run of 120 s, health recomputed once a second, 100 symbols x a year, the fake plugin asking for a catch-up every 200 ms): a catch-up of the plugin used to wait up to 1.9 s behind the health scan on the same reader (p99 1,932 ms; on a client's database five times larger, about 10 s against the plugin's 4 s timeout). It now waits **0.45 ms (p99), 36.6 ms at the worst**: the scan is not on its worker any more (own lane) and mostly does not happen (only what was written is counted again: 1,600 small range reads for the whole run). The first picture, which counts every symbol, takes 0.94 s here (was 2.2 s, also because two bulk workers share it); every later one 2.5 ms (p50), 11 ms (p99). The live feed was not affected before and is not now (loop lag p99 1.9 ms).

### `live500_backpressure` (fake plugin pauses reads for 10 s)

| Metric | Baseline | after 2c |
|---|---|---|
| ipc.writable_hwm bytes | 1,246,409 (grows with the pause: about 125 KB a second at 500 symbols) | **1,052,425**, then it stops growing: the limit is 1 MB, and what changes after that waits as at most one entry per symbol and minute (500 here) |
| engine RSS growth MB | 22 (149 to 171) | 20 (166 to 186). A 10 s pause only just reaches the limit; the unit test pauses longer: nothing grows past it |
| lines in the burst after the pause | all 90,113 lines of the run arrive; transit p99 9,937 ms, max 10,002 ms | 59,257 LIVE_BAR lines for 62,998 updates: the newest state of each minute, not every update; transit p99 9,937 ms (the pause) |
| integrity mismatches | 0 (1,000 bars, 48,000 updates) | 0 (1,000 bars, 62,998 updates) |

### `import500`

| Metric | Baseline | after 5a |
|---|---|---|
| total time s | 0.06 (500 symbols, downloads held back) | |
| loop.lag_ms max during import | 25 | |
| state-file writes | 0 | |
| subscribe calls | 500 | |
| log lines | 2,001 | |

**This baseline contradicts P13's premise.** With a subscribe that returns at once, the engine adds 500 symbols in 60 ms of its own work (0.12 ms a symbol), so there is nothing here to make "5 times faster". With the downloads allowed to start (`--with-downloads`) the first six chunks arrive together and the loop lags 241 ms. What makes a real import slow is what it sets going: 500 symbols x a year of history at a broker's request limit (Fyers: 45 a minute, so about 45 minutes for the downloads), the first load of the broker's symbol list, and the symbol push into AmiBroker (P12). See the Discrepancies table in ROOT_CAUSE_ANALYSIS and Stage 5a in the roadmap.

### Instrumentation overhead

The first way to measure it, a full `live500` run with metrics on and off, is too noisy to show anything: identical runs differ by up to 2x in CPU per update (on: 21.6, 47.5, 60.5 us; off: 43.9, 37.5 us). So the pieces are timed directly (`npx tsx tests/perf/overhead.ts`):

| What | Cost |
|---|---|
| `perf.record(name, value)`, metrics on | 20 ns |
| `perf.record(...)`, metrics off | 1.3 ns |
| `performance.now()` (taken whether metrics are on or off) | 40 ns |
| One live update: 4 `record` calls and 5 timestamps | **0.27 us with metrics on** (0.20 us of it the timestamps); 0.07 us of recording is what `DATABRIDGE_PERF=0` removes |
| Against the engine's CPU per live update (21.6 us in the quietest run, 38-60 us in the others) | **0.5-1.2%** in all, of which recording itself is 0.1-0.3% |

The criterion was "under 1%". The recording alone meets it; with the timestamps, the quietest run is a little over (1.2%). Reported as measured. The loop-lag probe adds about 70 small messages a second between two threads (not measurable in the runs above).

### The rebuilt plugin against the harness engine (`--real-ports`, 80 s, 3 symbols read once a second)

A small loader played AmiBroker's part (loaded `DataBridgePro.dll`, gave it a window, called `GetQuotesEx` each second, answered the notices). The plugin's own `NOTE|PERF` report reached the engine and was parsed:

| Plugin figure | Value | Meaning |
|---|---|---|
| transit p50 / p99 | 1.2 / 1.9 ms | the engine writing a line to the plugin reading it (the engine's clock has 1 ms steps) |
| notify p95 / max | **181 / 185 ms** | a change received to the notice sent to AmiBroker: the fixed 150 ms notifier timer (P3), measured |
| sendmsg p99, busy | 21 ms, 0 | AmiBroker taking the notice (here: a window that answers at once) |
| gqe_fast p99 | 71 us | `GetQuotesEx` with bars in memory |
| visible p95 / stale p95 | 102 / 609 ms | latest update to first read / oldest unread update to read; the loader reads once a second, so these show the loader's rhythm, not AmiBroker's |
| catchup p99, fail, bars | 19 ms, 0, 3 | one background history download |
| lines | 24,176 | |

473 notices reached the loader's window in 80 s (about 6 a second) and the three symbols' bars were updated. The plugin log carries the same report line.

**After Stage 2** (the rebuilt DLL, `tests/dll_host.cpp` as the host, the harness engine with 100 symbols updating twice a second, 72 s, 3 symbols read; the Stage 0 DLL tried the same way for the "before"):

| Plugin figure | Stage 0 DLL | Stage 2 DLL | Meaning |
|---|---|---|---|
| gap between notices (host side) min / p50 / p95 / max | 150 / 157 / 166 / 173 ms | **50.1 / 50.5 / 50.9 / 51.6 ms** | the notifier now sends a notice as soon as something changed, at most one every 50 ms |
| notices a second | 6.3 | 19.8 | the upper limit by design is 20 |
| notify p95 | 173 ms | **51.1 ms** | a change received to the notice sent |
| visible p95 | 165 ms | 47.8 ms | latest update to first read |
| gqe_fast p99 | 18.7 us | 10.6-12.8 us | GetQuotesEx with bars in memory |
| transit p99, sendmsg p99, busy | 5.9 ms, 1.3 ms, 0 | 1.7 ms, 0.7 ms, 0 | |
| integrity | 0 mismatches | 0 mismatches | |

With the first version of the new notifier (a plain sleep for the gap) the gaps were 50-73 ms and notify p95 70 ms: Windows rounds a sleep up to its 15.6 ms clock tick. The shipped one waits on a high-resolution timer owned by the notifier thread (no change to the clock tick, which would affect all of AmiBroker).

**A symbol nobody read for 5 minutes** (330 s run: 2 symbols read all the time, one read in the first 20 s and the last 8 s only): it came back with 8 bars, the same as the two that were read all the time, and the plugin log has no "caught up" line for it after its first read; the per-minute reports show catchup_p99 = 0 for the rest of the run. Its missed minutes came from the plugin's memory. 6,531 notices in 330 s, 0 busy, integrity 0 mismatches.

What this does not show: AmiBroker's own cost of taking 20 notices a second (the host answers at once). `sendmsg_p99` and `busy` in the live checklist are where it would show.

**After Stage 3** (the rebuilt DLL, `tests/dll_host.cpp`, the harness engine on the real ports with `live500_backfill`, 100 s, 6 backfilled symbols read):

| | Result |
|---|---|
| host: notices, gap between notices | 1,560 (19.5 a second), 50.1 / 50.5 / 51.6 ms (min / p50 / p95) |
| plugin report | notify p95 52.6 ms, sendmsg p99 1.06 ms, busy 0, catchup_fail 0, gqe_fast p99 9.6 us |
| background catch-ups in the minute | 7, of which 1 asked for a range only (`catchup_ranged`); the others were the first sync after the connection (owed the last 24 hours, so not narrowed, by design) |
| a symbol read while its history downloaded | 19,999 bars arrived by catch-up and were merged ("caught up 19999 missed bar(s)") |
| integrity | 0 mismatches (1,500 bars, 102,997 updates) |

The harness's backfilled symbols have no live feed and their history is fetched while the host reads them, so this run shows that the new DLL and the new engine work together and that a ranged fetch happens on the wire; the number of bytes is measured with the fake plugin above and the range logic by `plugin_tests.cpp` (105 checks).

## Live baseline checklist (the user runs this)

Use a market day, ideally with the usual client symbol list (or as many symbols as possible), on the **instrumented build from Stage 0**.

1. Before 09:15:
   - install the instrumented engine and plugin (close AmiBroker first; keep the old DLL as `DataBridgePro.dll.bak`);
   - note the PC (CPU, RAM, disk) and how many symbols are tracked and live.
2. 09:30–09:45, **idle**: AmiBroker open with your normal charts. Don't download anything.
3. 09:45–10:00, **download**: in Symbol Setup, run Repair on 20–50 symbols, or add some symbols with a year of history.
4. 10:00–10:10, **scan**: run your usual AmiBroker scan or exploration twice, with Symbol Setup open.
5. 10:10, **restart**: restart the app once (engine restart), then keep watching for 5 minutes.
6. 10:20: open `http://127.0.0.1:7890/api/diagnostics/perf` in a browser and save the page. Also copy:
   - `C:\Users\Public\DataBridgePro_plugin.log`;
   - `%APPDATA%\DataBridgePro\logs\backend.log`.
7. Note any moment AmiBroker visibly paused, with the clock time.

Hand these to the implementer. They fill in the table below and compare it with the harness.

### Live session results (to fill in)

Date: … · Symbols tracked / live: … · Broker and plan: … · PC: …

| Phase | loop.lag_ms p99/max | tick rx→ipc p99 | plugin transit p99 | notify_delay p95 | sendmsg p99 / busy | visible_ms p95 | catch-up p99 / fails | Notes |
|---|---|---|---|---|---|---|---|---|
| idle | | | | | | | | |
| download | | | | | | | | |
| scan | | | | | | | | |
| after restart | | | | | | | | |
