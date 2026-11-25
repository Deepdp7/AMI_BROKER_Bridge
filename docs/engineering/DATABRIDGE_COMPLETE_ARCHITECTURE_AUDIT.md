# DataBridge Pro: complete architecture audit

Audit date: 2026-11-25. Code at commit `8bdf906` (branch `main`).
Scope: every layer between a broker's live feed and an AmiBroker chart.
Written for whoever implements the changes (the next coding agent and later engineers). Every claim here cites the code it comes from.

## The problem

Clients report that live data in AmiBroker "buffers":
- prices stop moving, then several updates arrive at once;
- history and filled gaps appear late, and in bulk;
- importing many symbols is slow.

The goal is to deliver live data to AmiBroker as promptly and steadily as the broker feed, Windows and AmiBroker's plugin interface allow. Every queue should be bounded, there should be no avoidable blocking, the system should recover automatically, and no market data may be lost.

## How the audit was done

- Read the real implementation of the native plugin, the IPC server, the live feed, the Fyers socket client and adapter, the SQLite store and reader workers, the backfill queue, auto-refresh, catch-up, live places, symbol import, the HTTP routes, the WebSocket push, the desktop sync hooks and the Tauri engine supervisor. Other broker feeds were checked only for their reconnect and watchdog code.
- Traced one tick from the broker socket to the AmiBroker chart, noting the thread, buffer and delay at each step.
- Looked for every place where work runs on the engine's only thread, every queue without a bound, every timer-driven delay and every recovery path.
- Checked the runtime logs on this PC:
  - `%APPDATA%\DataBridgePro\logs\backend.log` (6.7 MB, 2026-10-25 to 2026-11-22);
  - `C:\Users\Public\DataBridgePro_plugin.log` (4,445 lines).
- Searched git history (for example, to check whether any plugin version ever sent `GET_QUOTES`: none did).

**Limits of the runtime evidence.** This PC tracks 8 symbols. Its logs show:
- no `[Perf]` stall of 500 ms or more;
- 12 Fyers socket disconnects;
- 2 plugin "catch-up paused" events and 0 "busy" AmiBroker notices.

The reference client workload is 438 symbols on a Fyers Standard plan (100 of them live). On 2026-11-19 that client had 338 symbols without live prices and an AmiBroker load factor of 227%, as recorded in project notes. Today's logs cannot show how big each effect is at that scale. So the roadmap starts with instrumentation (Stage 0) and a baseline, and only then changes behaviour.

## Main findings

**The engine runs everything on one thread.** That covers:
- decoding broker messages, building bars and pushing to AmiBroker;
- the history work: parsing broker JSON, validating and SQLite writes;
- WAL checkpoints with disk syncs;
- HTTP handlers, file writes and logging.

Only database reads run on two worker threads. Any long synchronous job holds every live tick behind it. Afterwards the held ticks go out together, which looks exactly like "pause, then burst". The engine's own stall watch only reports stalls of 500 ms or more, so stalls of 20–100 ms have never shown up in the logs.

**The plugin adds its own delay and has a short memory.**
- It tells AmiBroker about new data on a fixed 150 ms timer.
- It remembers only the latest bar and the previous minute per symbol. A symbol that AmiBroker hasn't read for more than a minute (scans, watch lists, background charts) loses the minutes in between. They come back only through a rate-limited HTTP round trip, later and in a block.

**History reaches AmiBroker through a narrow, fragile path.**
- Every downloaded chunk tells the plugin to re-download that symbol from the chunk's start *up to now*.
- One plugin thread handles these one at a time, with a 4-second timeout even for big requests.
- One timeout pauses all catch-ups for 15 seconds.
- The Symbol Setup health check scans the whole bars table on one of the two reader threads. AmiBroker's requests that land behind it wait.

**Fyers outages last longer than they need to.**
- The Fyers live socket gives up after 10 reconnect attempts (about 6 minutes of trouble).
- It needs 5–6 minutes to notice a dead connection. The other brokers need 30–70 seconds.
- It never reports a disconnect, so the "fetch what was missed, 150 s after the feed returns" step never runs for Fyers.

**On capped plans, bulk downloads starve the near-live refresh.** Fyers Standard streams 100 symbols live; the rest rely on the automatic refresh of today's bars. That refresh does not run at all while any history download is queued. AmiBroker scans make this worse: they shuffle the live places, and each newly live symbol queues a forced download.

## Most likely causes of "pause, then burst", in order

| # | Cause | IDs | Status |
|---|---|---|---|
| 1 | Engine thread blocked by history parsing and writes, and by WAL checkpoints | P1, P2 | Mechanism confirmed; size to be measured |
| 2 | Fixed 150 ms notifier plus AmiBroker being busy | P3 | Confirmed; AmiBroker share to be measured |
| 3 | Plugin keeps only 2 minutes per symbol | P4 | Confirmed |
| 4 | Catch-up pipeline: full-table health scan, re-fetch up to now, global pause | B5, P5 | Confirmed mechanism |
| 5 | Fyers socket failure handling | B1, B2, B3 | Confirmed |
| 6 | Refresh starvation on capped plans; live-place churn from scans | P6, P7 | Confirmed mechanism |
| 7 | OLE symbol-details push and AmiBroker's own load | P12 | Needs runtime evidence |

Not every "buffering" report is a bridge fault. On a Fyers Standard plan, symbols beyond the first 100 can only be refreshed from history every few minutes. That is a plan limit, and only Prime, or putting the overflow on a second broker's live feed, removes it.

## The documents

| Document | What it holds |
|---|---|
| [DATABRIDGE_ROOT_CAUSE_ANALYSIS.md](DATABRIDGE_ROOT_CAUSE_ANALYSIS.md) | Every finding with evidence, effect, fix, risk and verification; the 10 categories |
| [DATABRIDGE_CURRENT_ARCHITECTURE.md](DATABRIDGE_CURRENT_ARCHITECTURE.md) | The system as built: processes, channels, the tick path stage by stage, diagrams 1–6 |
| [DATABRIDGE_OPTIMIZED_ARCHITECTURE.md](DATABRIDGE_OPTIMIZED_ARCHITECTURE.md) | The target design, diagrams 7–12, and why each change is needed |
| [DATABRIDGE_IMPLEMENTATION_ROADMAP.md](DATABRIDGE_IMPLEMENTATION_ROADMAP.md) | Stages 0–9: files, functions, strategy, tests, risks, rollback (the implementation specification) |
| [DATABRIDGE_PERFORMANCE_BASELINE.md](DATABRIDGE_PERFORMANCE_BASELINE.md) | Metric definitions, the harness, baseline tables to fill in, and the live-session checklist |
| [DATABRIDGE_TESTING_AND_VALIDATION.md](DATABRIDGE_TESTING_AND_VALIDATION.md) | The 22 required test scenarios, how each is tested, and the acceptance criteria |
| [DATABRIDGE_IMPLEMENTATION_CHANGELOG.md](DATABRIDGE_IMPLEMENTATION_CHANGELOG.md) | What each stage changed, with test results and before/after numbers |
| [DATABRIDGE_DEPLOYMENT_ARCHITECTURE.md](DATABRIDGE_DEPLOYMENT_ARCHITECTURE.md) | Background, not a stage: local vs VPS vs hybrid, SQLite vs PostgreSQL/Prisma, privacy and data licensing. Confirms the fully local architecture the roadmap targets. |

## Rules for implementation

1. Measure first (Stage 0), then fix confirmed causes, one stage at a time.
2. Before each stage, re-check its findings against the code. If the code differs from these documents, stop, record the difference and the corrected plan in ROOT_CAUSE_ANALYSIS and ROADMAP, then continue.
3. Never drop market data. Coalescing is allowed only for repeated states of the same symbol's same minute, which the plugin overwrites anyway.
4. Keep the plugin protocol backward compatible both ways, and keep APIs and the UI design as they are.
5. Every stage ends with type checks, tests, a plugin build when the plugin changed, a harness run compared with the baseline, and an updated changelog.
6. Installing the rebuilt DLL and running live-market sessions are steps for the user.
