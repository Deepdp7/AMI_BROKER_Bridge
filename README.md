# DataBridge Pro

Live and historical 1-minute market data from Indian brokers (Fyers, Zerodha Kite, Dhan)
into AmiBroker charts. Each client PC runs one desktop app that contains everything.

## How it fits together

```
 Broker APIs (Fyers / Kite / Dhan)
        │  history (HTTPS) + live ticks (WebSocket)
        ▼
 ┌──────────────────────────── apps/server ─────────────────────────────┐
 │  Data engine (Node.js) — local-api.exe in a client install            │
 │  brokers/ → market/ (live bars, backfill, gap fill) → db/ (SQLite)     │
 │  HTTP + WebSocket API on 127.0.0.1:7890   AmiBroker channel on :7891   │
 └───────────────▲──────────────────────────────────────▲───────────────┘
                 │ REST + WebSocket                      │ HTTP history + TCP live bars
 ┌───────────────┴──────────────┐          ┌─────────────┴──────────────────┐
 │ apps/desktop                  │          │ plugins/amibroker               │
 │ React UI in a Tauri window;   │          │ DataBridgePro.dll, loaded by    │
 │ the Rust shell starts and     │          │ AmiBroker (32-bit C++ data      │
 │ stops the engine              │          │ plugin)                         │
 └───────────────────────────────┘          └─────────────────────────────────┘
```

All three talk over localhost only. The engine keeps its data in
`%APPDATA%\DataBridgePro\databridge.db` (SQLite), per Windows user.

## Repository layout

```
apps/
  server/                     data engine (backend)
    src/
      index.ts                entry point: starts the API, the AmiBroker channel and the jobs
      app.ts                  Express app: middleware and route mounting
      config.ts               host and ports
      startup.ts              broker connect at start, service events → WebSocket
      jobs.ts                 08:30 instrument refresh, log rotation, parent watchdog
      api/
        routes/               one file per URL prefix (/api/brokers, /api/feed, …)
        realtime.ts           WebSocket push to the app
      amibroker/
        ipcServer.ts          TCP line protocol to the plugin (LIVE_BAR, SYNC, GET_QUOTES)
      brokers/
        BrokerManager.ts      connected broker sessions
        BrokerLifecycle.ts    login, symbol hand-over, catch-up after downtime
        brokerAuth.ts         broker login URLs
        DailyReloginService.ts
        adapters/             one folder per broker + shared adapter code
          fyers/ kite/ dhan/
      market/
        liveFeed.ts           ticks → 1-minute bars
        BackfillQueue.ts      rate-limited history downloads (newest first)
        GapDetector.ts        finds missing minutes in stored history
        AutoRefresh.ts        "Refresh All Today" during market hours
        MarketCalendar.ts     exchange sessions and holidays
        state/                download watermarks kept on disk
      db/
        index.ts              SQLite store (schema, writes, queries)
        reader.ts             read-only worker threads for heavy queries
        pgImport.ts           one-time import from the old PostgreSQL database
      ai/                     AI assistant, morning brief, news, F&O data
      lib/RateLimiter.ts
      system/ConsoleCapture.ts  engine output for the in-app Live Console
      types.ts
    tests/                    vitest (each worker gets its own scratch database)
    scripts/build-sea.js      packs the engine into local-api.exe
  desktop/                    desktop app (frontend)
    src/
      main.tsx                React entry
      app/App.tsx             layout + routes
      pages/                  one file per screen
      components/
        layout/               title bar, sidebar
        ui/                   Select, Toast, BrokerLogo, ErrorBoundary
        status/               backfill banner, symbol-list download overlay
        assistant/            AI assistant panels
      api/apiClient.ts        REST + WebSocket client for the engine
      hooks/ store/ lib/ styles/ assets/
    src-tauri/                Rust shell
      src/lib.rs              app start-up, close = quit everything
      src/engine.rs           runs local-api.exe, restarts it, stops it cleanly
      src/single_instance.rs  one app per user
      src/tray.rs             tray menu
      src/window_chrome.rs    custom title bar (Snap Layouts)
plugins/
  amibroker/                  AmiBroker data plugin (C++, 32-bit)
docs/                         user and client setup guides, sample symbol CSV
scripts/with-msvc.cjs         runs a command inside the Visual Studio build environment
```

## Commands (from the repository root)

| Command | What it does |
|---|---|
| `npm install` | installs the root tools, then each app's dependencies |
| `npm run dev` | engine (auto-restarts on save) + desktop app; closing the window stops both |
| `npm run dev:web` | engine + UI in a browser at http://localhost:5173 |
| `npm test` | engine and UI tests |
| `npm run typecheck` | TypeScript checks for both apps |
| `npm run build` | client installer: packs the engine into `local-api.exe`, then builds the app |
| `npm run build:plugin` | builds `plugins/amibroker/DataBridgePro.dll` |

Requirements: Node.js 24 (the engine uses the built-in `node:sqlite`), Rust with the MSVC
toolchain, and Visual Studio 2022+ with C++ tools (the plugin builds as 32-bit).

Installing a new plugin build: close AmiBroker, then copy `plugins\amibroker\DataBridgePro.dll`
into `C:\Program Files (x86)\AmiBroker\Plugins\` (needs administrator rights).

## Ports

| Port | Used by |
|---|---|
| 7890 | engine HTTP + WebSocket API (app, plugin history, broker login redirects) |
| 7891 | engine ↔ AmiBroker plugin live channel |
| 7892 | single-instance check of the desktop app |
| 5173 | UI dev server (development only) |

Broker app redirect URLs: `http://127.0.0.1:7890/api/callback/<fyers|zerodha_kite|dhan>`.
