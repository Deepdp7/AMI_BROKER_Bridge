# DataBridge Pro: optimized target architecture

The design the roadmap builds towards. Each change says which finding it answers ([ROOT_CAUSE_ANALYSIS](DATABRIDGE_ROOT_CAUSE_ANALYSIS.md)) and why it is needed. Changes marked **conditional** are built only when a measurement shows they are needed. Nothing here is a rewrite: the engine stays one Node process with the same modules, protocol, database file and UI.

## Design principles

1. **The engine's main thread is for live data.** It keeps socket I/O, tick decoding, bar state, the push to AmiBroker and small HTTP handlers. Synchronous work over about 2 ms is cut into slices or moved to a worker.
2. **Every queue is bounded or coalescing**, and reports its high-water mark. Coalescing is used only where the consumer keeps just the latest state: the same ticker's same minute, or a ticker's latest quote.
3. **No market data is lost.** Every minute's final bar state reaches the plugin and the database. Validation stays.
4. **Live beats history.** A history download or a health check never delays a live update by more than a slice. Interactive history (what AmiBroker is showing) beats the refresh, which beats bulk downloads.
5. **Recovery is automatic and quick.** A dead socket is detected in seconds, reconnects never stop, and the minutes missed are fetched soon after.
6. **Protocol changes are backward compatible.** New fields go at the end of lines. Old parsers already stop at `|`; this was checked for `SYNC` and `LIVE_BAR`.
7. **Everything is measured.** Each stage of the path has a histogram, so every later change is judged on numbers.

## Diagram 7: optimized system architecture

```mermaid
flowchart LR
  subgraph Broker["Broker"]
    WS[Live WebSocket]
    REST[History REST]
  end
  subgraph Engine["local-api.exe"]
    subgraph Main["Main thread: live first"]
      FEED[Feeds with heartbeat + uncapped reconnect]
      LF[LiveFeed bars, O1 lookups]
      IPC[ipcServer: coalesced, backpressure-aware]
      HTTP[Express :7890]
      LIM[RateLimiter: interactive > refresh > bulk]
      BQ[BackfillQueue]
      AR[AutoRefresh, runs alongside downloads]
      SL[Sliced history upserts, at most 2k rows per tx]
      PERF[perf.ts histograms + diagnostics route]
    end
    subgraph Workers["Worker threads"]
      RI[(Reader lane: interactive)]
      RB[(Reader lane: bulk)]
      MW[(Maintenance: WAL checkpoints)]
      DW[(DB writer: conditional, Stage 3e)]
    end
  end
  subgraph AB["AmiBroker"]
    PL[Plugin: 120-minute ring, event-driven notifier, range catch-up]
    UI[AmiBroker UI thread]
  end
  WS --> FEED --> LF --> IPC -->|LIVE_BAR with sendMs, QUOTE, SYNC from-to| PL --> UI
  BQ --> LIM --> REST
  AR --> LIM
  REST --> SL
  SL -. conditional .-> DW
  PL -->|/api/feed/bars since + until| HTTP --> RI
  HTTP -->|health, backup, MT5, gaps| RB
  MW -.-> RI
```

## Diagram 8: optimized live tick processing

```mermaid
sequenceDiagram
  autonumber
  participant B as Broker socket
  participant M as Engine main thread
  participant P as Plugin poller
  participant N as Plugin notifier
  participant A as AmiBroker UI
  B->>M: WS frame (rxAt stamped)
  M->>M: decode, bars, emit live_bar_updated (pendingLive by ticker and minute)
  Note over M: flush at end of the current task (microtask, if Stage 2e wins its A/B), else setImmediate
  alt socket not congested
    M->>P: one write per frame: LIVE_BAR lines with sendMs
  else writableLength over 1 MB
    M->>M: keep coalescing per ticker and minute, newest QUOTE only, wait for drain
  end
  P->>P: parse (from_chars), KeepLiveBar, minute rollover pushes final bar into 120-minute ring
  P->>N: signal condition variable
  N->>A: notice at once if 50 ms since the last one, else after the remaining gap
  A->>P: GetQuotesEx
  P-->>A: ring bars for missed minutes + live bar (no HTTP for gaps up to 2 hours)
```

**Why each change:**

| Change | Answers | Why |
|---|---|---|
| Event-driven notifier with a 50 ms minimum gap | P3 | Removes the fixed 0–150 ms wait while keeping AmiBroker's redraw rate bounded (at most 20 notices a second) |
| 120-minute ring per ticker in the plugin | P4 | Symbols AmiBroker reads occasionally (scans, watch lists, hidden charts) get their missed minutes from memory at once, instead of from a rate-limited HTTP round trip later and in bulk |
| `from_chars` parsing in the plugin | P13-style CPU | Fewer allocations per line in AmiBroker's process |
| Flush at the end of the current task (measured) | P1 | Today the flush waits a whole loop iteration, behind whatever else is queued. A microtask flush still batches a whole frame into one write. It is adopted only if the A/B test shows lower p99 at an acceptable write rate. |
| Backpressure with lossless coalescing | D1 | Memory stays bounded if AmiBroker stops reading, and the recovery burst is small and correct |
| O(1) lookups and a negative cache | P10 | Removes O(N) string scans per tick and per request |
| Heartbeat and uncapped reconnect for Fyers, plus a disconnect event | B1, B2, B3 | Detects a dead socket in 30–60 s instead of 5–6 min, never gives up, and triggers the 150 s catch-up |

## Diagram 9: optimized backfill architecture

```mermaid
sequenceDiagram
  autonumber
  participant Q as BackfillQueue
  participant L as RateLimiter (priority classes)
  participant R as Broker REST
  participant S as Sliced upsert (main) or DB writer (conditional)
  participant I as ipcServer
  participant C as Plugin catch-up
  participant H as /api/feed/bars (interactive reader lane)
  Q->>L: withPriority(bulk or interactive) acquire()
  Note over L: interactive first, then refresh, bulk at most 70 percent of the minute budget while others wait
  L-->>Q: slot
  Q->>R: GET chunk (deadline covers the body, B4)
  R-->>Q: JSON
  Q->>S: parse, validate, upsert in slices of at most 2,000 rows, yield between slices
  S-->>Q: changed count, first ts, last ts
  Q->>I: bars_gap_filled(ticker, fromSec, toSec)
  I->>C: SYNC|T|from|to (oldest from, newest to, coalesced 1 s)
  C->>H: GET since=from-60 and until=to+60 (timeout sized to the range)
  H-->>C: CSV for the range only (P5)
  alt failure
    C->>C: per-ticker backoff 2 s to 60 s (no global pause)
  end
  C-->>C: merged into AmiBroker on the next GetQuotesEx (MergeBars into the middle)
```

**Why each change:**

| Change | Answers | Why |
|---|---|---|
| Sliced upserts with yields | P1, D5 | One chunk becomes about 15 slices of a few ms each, so live ticks interleave instead of waiting 25–80 ms |
| DB writer worker (conditional, Stage 3e) | P1 | Only if slicing doesn't meet the loop-lag target: parsing and writing then leave the main thread entirely |
| Priority classes through AsyncLocalStorage | P6 | Gap fills for symbols AmiBroker is showing and the refresh no longer queue behind bulk years. No adapter signature changes. |
| AutoRefresh runs alongside downloads | P6 | On capped plans the refresh is the only source for non-live symbols; it must not stop for a 40-minute download |
| `SYNC` with a range, range fetch, size-based timeouts, per-ticker backoff | P5, B5 | The plugin downloads what changed instead of everything up to now, and one slow answer no longer freezes every symbol for 15 s |
| Live-place swaps only for repeatedly viewed symbols | P7 | Scans stop churning subscriptions and queuing forced downloads |

## Diagram 10: optimized database architecture

```mermaid
flowchart TB
  subgraph Main["Main thread connection"]
    LFB[flushLiveBars every 2 s, small]
    SL[History upserts in slices of at most 2k rows]
    CFG[settings, brokers, symbols, bulk symbol insert in one tx]
    BS[wal_autocheckpoint 20000 as backstop only, journal_size_limit 64 MB]
  end
  subgraph Maint["Maintenance worker (read-write)"]
    CK[PASSIVE checkpoint when WAL over 16 MB or every 60 s, TRUNCATE when idle or after close, timed]
  end
  subgraph Int["Reader lane: interactive"]
    CSV[csv for the plugin: since + until]
  end
  subgraph Bulk["Reader lane: bulk"]
    DC[dayCountsFor ticker: PK range]
    GAP[gaps]
    BAK[backup VACUUM INTO]
    MT5[MT5 exports, candles]
  end
  F[(databridge.db + WAL)]
  LFB --> F
  SL --> F
  CFG --> F
  CK --> F
  F --> CSV
  F --> DC
  F --> GAP
  F --> BAK
  F --> MT5
  DIRTY[dirty-ticker set from writes] --> DC
```

**Why each change:**

| Change | Answers | Why |
|---|---|---|
| Checkpoints in a maintenance worker | P2 | The commit that crosses 1,000 pages no longer runs a disk-syncing checkpoint on the live thread |
| `journal_size_limit` | P2 | The WAL file shrinks back after a large checkpoint |
| Interactive and bulk reader lanes, least-loaded dispatch | B5 | AmiBroker's requests never queue behind a health scan, a backup or an MT5 export |
| Incremental health counts for dirty tickers only, by PK range | B5 | Replaces a whole-table scan every 30 s with small indexed queries for the symbols that changed |
| `cache_size` and `mmap_size` (A/B tested) | C1 | Kept only if measurements show faster upserts or reads |
| Debounced async state files | P8 | Removes bursts of synchronous whole-file writes |

The schema is unchanged. No new indexes are added unless `EXPLAIN QUERY PLAN` shows a scan; all hot queries are `tid = ? AND ts` ranges on the primary key.

## Diagram 11: threading and queue architecture

```mermaid
flowchart LR
  subgraph EngineMain["Engine main thread"]
    Q1[tickQueue: drained every turn, HWM metric]
    Q2[pendingLive: coalesced per ticker and minute, HWM metric]
    Q3[pendingQuotes: coalesced per ticker]
    Q4[pendingBarsAppends: bounded with an alarm]
    Q5[RateLimiter queues per class]
    Q6[BackfillQueue tasks: one chunk per ticker at a time]
    Q7[SYNC pending map: coalesced per ticker, 1 s]
  end
  subgraph EngineWorkers["Engine workers"]
    W1[reader interactive x1]
    W2[reader bulk x1-2]
    W3[maintenance x1]
    W4[DB writer x1, conditional]
  end
  subgraph Plugin["Plugin threads"]
    T1[poller: socket to bar cache + ring, max 120 per ticker]
    T2[notifier: condition variable, 50 ms minimum gap]
    T3[catch-up: one request at a time, per-ticker backoff]
  end
  subgraph AmiBroker["AmiBroker"]
    U[UI thread: GetQuotesEx reads RAM only]
  end
  Q1 --> Q2 --> T1 --> T2 --> U
  Q3 --> T1
  Q7 --> T3
  U --> T3
  T3 --> W1
```

Bounds:

| Queue | Bound |
|---|---|
| `tickQueue` | drained every turn; HWM recorded |
| `pendingLive` | at most symbols × 2 entries (current and previous minute) |
| Socket buffer | about 1 MB; above that, writing pauses until drain while state keeps coalescing |
| Plugin ring | 120 bars per ticker |
| Plugin pending notices | one per ticker |
| Catch-up jobs | one per ticker, de-duplicated by `g_catchUpPending` |
| `pendingBarsAppends` | about symbols × minutes until the next flush, with an alarm if a DB failure makes it grow |
| Rate-limiter queues | bounded by the backfill slots (6 per broker) plus the refresh pool (6) plus interactive callers |

## Diagram 12: failure recovery architecture

```mermaid
stateDiagram-v2
  [*] --> Streaming
  Streaming --> Suspect: no message or pong for the threshold
  Suspect --> Reconnecting: terminate socket, emit disconnected
  Streaming --> Reconnecting: close or error, emit disconnected
  Reconnecting --> Reconnecting: backoff 5 s x 1.5 to the n, at most 30 s, jitter, never gives up
  Reconnecting --> AuthRefused: two login refusals in a row
  AuthRefused --> [*]: auth_required, app asks for login
  Reconnecting --> Streaming: login accepted, resubscribe, emit connected
  Streaming --> CatchUp: 150 s after connected following a disconnect
  CatchUp --> Streaming: gap passes queued with interactive priority, filled, SYNC range sent
```

Other recovery paths:

| Failure | Detection | Recovery |
|---|---|---|
| Engine crash | supervisor polls every 500 ms | restart with backoff. The plugin reconnects within 1 s, and the new connection generation makes every viewed symbol re-sync its last 24 h. Measure this storm in Stage 8 and spread it if needed. |
| AmiBroker restart | the plugin connects | full loads on first view; status, quotes and (only if the content changed) symbol details are pushed |
| App window closed | — | the engine keeps running until a clean shutdown request; behaviour unchanged |
| Disk slow or database locked | `db.*` histograms; `busy_timeout` | sliced transactions keep each hold short; the live-bar buffer is bounded with an alarm; nothing is dropped |
| Plugin stops reading | `writableLength` | lossless coalescing, then resume on drain |
| Network outage | feed heartbeat | reconnect; minutes missed during the outage are fetched by the post-reconnect catch-up |

## What is deliberately not changed

- The process layout (Tauri app + engine sidecar + plugin), the ports, the database file and schema, the HTTP API and the UI.
- How the live feed builds bars (exchange-time minutes, close once, history replaces them) and the 30-second settle rule for broker bars.
- "One notice per round" in the plugin, and the requeue when AmiBroker is busy.
- Validation and repair of history bars.

## Optional future work (needs a product decision)

- **Live overflow to a second broker:** symbols beyond Fyers Standard's 100 live places streamed by another connected broker, such as Kite or Dhan. This removes the refresh-only lag for those symbols, but needs a symbol-routing design and the user's agreement.
- **A user setting for the notifier gap** (for example 25–150 ms), for clients with heavy AmiBroker layouts.
