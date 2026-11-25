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
| loop.lag_ms | 0.143 | 0.306 | 0.655 | 2.00 | | | | | |
| tick.rx_to_feed_ms | 0.05 (floor) | 0.05 | 0.05 | 0.16 | | | | | |
| tick.feed_to_ipc_ms | 0.055 | 0.143 | 0.230 | 2.50 | | | | | |
| fake-plugin transit ms (1 ms clock) | 0.05 | - | 1.06 | 2.0 | | | | | |
| ipc.writes/s | 62 (1,979 lines/s) | | | | | | | | |
| db.live_flush_ms (every 2 s) | 0.87 | 1.8 | 1.8 | 1.8 | | | | | |
| CPU % (engine, of one core) | 2.2 | | | | | | | | |
| RSS peak MB | 184 | | | | | | | | |
| integrity mismatches | 0 (1,500 bars, 78,007 updates) | | | | | | | | |

### `live500_backfill` (plus 50 symbols × 365 days)

| Metric | p50 | p95 | p99 | max | after 3a | after 3b–3d | after 4a | final |
|---|---|---|---|---|---|---|---|---|
| loop.lag_ms | 10.4 | 219 | 266 | 315 | | | | |
| tick.feed_to_ipc_ms | 1.06 | 35.9 | 242 | 340 | | | | |
| history.parse_ms | 4.0 | 5.3 | 6.5 | 9.2 | | | | |
| backfill.chunk_cpu_ms | 35.9 | 52.6 | 63.6 | 70.5 | | | | |
| db.history_tx_ms | 20.3 | 35.9 | 47.8 | 51.7 | | | | |
| http.feed_bars_ms (the fake plugin's catch-ups) | 27.0 | 242 | 354 | 375 | | | | |
| db.wal_bytes max | 8.5 MB | | | | | | | |
| chunks/min | 597 (906 in 91 s, 21.1 M bars) | | | | | | | |
| catch-up bytes per symbol | mean 3.4 MB, max 10.6 MB (582 symbols) | | | | | | | |
| CPU % (engine, of one core) / RSS peak | 111 / 1,944 MB | | | | | | | |
| integrity mismatches | 0 (1,500 bars, 93,068 updates) | | | | | | | |

Read it against live500 above: the same 500 symbols and the same updates, and the loop lag goes from p99 0.66 ms to **266 ms**, and the time from a bar being ready to its write on AmiBroker's channel from p99 0.23 ms to **242 ms** (max 340 ms). Each history chunk holds the engine's one thread for 36 ms (median; 64 ms at p99), of which the database save is 20 ms. At 10 chunks a second that is about a third of the thread, in blocks. The loop lag is larger than any single chunk (up to 315 ms) because the catch-up answers are also built on that thread: the plugin asks for "from the announced start up to now", about 3.4 MB per symbol on average (P5), and `/api/feed/bars` re-filters those on the main thread (P14).

### `live500_health` (synthetic 100-symbol year database)

| Metric | p50 | p95 | p99 | max | after 4b | after 4c | final |
|---|---|---|---|---|---|---|---|
| health.compute_ms | 2,162 | 2,190 | 2,190 | 2,190 | | | |
| health.scan_ms | 2,162 | 2,188 | 2,188 | 2,188 | | | |
| reader.wait_ms.csv | 0.13 | 1,787 | 1,932 | 1,932 | | | |
| http.feed_bars_ms (catch-ups) | 0.60 | 1,787 | 1,936 | 1,936 | | | |
| catch-up failures (over 4 s) | 0 of 435 | | | | | | |

The 9.4 M-row database is about one fifth the size of a client's (500 symbols x a year is about 1.9 GB). A scan of 2.2 s here means about 10 s there, against the plugin's 4 s catch-up timeout. The live feed is not affected (loop lag p99 0.79 ms, max 4.2 ms): this costs AmiBroker its history requests, not its live ticks (B5). `EXPLAIN QUERY PLAN` shows why: the health query is the only one that does `SCAN b`; every other query uses the primary key.

### `live500_backpressure` (fake plugin pauses reads for 10 s)

| Metric | Baseline | after 2c |
|---|---|---|
| ipc.writable_hwm bytes | 1,246,409 (grows with the pause: about 125 KB a second at 500 symbols) | |
| engine RSS growth MB | 22 (149 to 171) | |
| lines in the burst after the pause | all 90,113 lines of the run arrive; transit p99 9,937 ms, max 10,002 ms | |
| integrity mismatches | 0 (1,000 bars, 48,000 updates) | |

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
