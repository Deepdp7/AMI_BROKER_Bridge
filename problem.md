◇ injected env (5) from ..\..\Roaming\DataBridgePro\.env
◇ injected env (5) from C:\Users\Windows\AppData\Roaming\DataBridgePro\.env
{"ts":"2026-09-30T07:28:07.850Z","event":"server_started","host":"127.0.0.1","port":7890,"endpoints":["http://127.0.0.1:7890/api/brokers","http://127.0.0.1:7890/api/status/feed","http://127.0.0.1:7890/api/status/health","http://127.0.0.1:7890/api/settings","http://127.0.0.1:7890/api/logs","ws://127.0.0.1:7890/api/status/stream"]}
[IPC] AmiBroker TCP Server listening on 127.0.0.1:7891
[POSTGRES] Connected successfully
[DB] Loading last 3 days of bars from PostgreSQL into RAM cache...
[Init] Log level: info
[INFO] [FeedSimulator] Symbol added: COALINDIA (BSE)
[Init] Auto-connecting broker fyers-edf11f90...
[FYERS_HSM_STATUS] starting
[FYERS_HSM_CONNECT] Connecting to wss://socket.fyers.in/hsm/v1-5/prod...
[FYERS_HSM_CONNECT] Connected.
[FYERS_HSM_STATUS] connected
[FYERS_HSM_AUTH] Authenticating binary stream...
[FYERS_HSM_AUTH] Auth successful.
[FYERS_HSM_STATUS] authenticated
[LIVE_BACKFILL_CONCURRENCY] liveWorker=connected_idle backfillWorker=running
[DB] Loaded 26704 bars into RAM cache
[FyersAdapter] Master CSV cache loaded with 57451 symbols.
[FYERS_HSM_SUBSCRIBE] Subscribing to 1 topics...
[FYERS_HSM_STATUS] subscribed symbols=BSE:COALINDIA-A
[HSM_SUB_BATCH] batch=1 symbols=1 bytes=19
[HSM_SUB_SEND] count=1 firstToken=sf|bse_cm|533278 lastToken=sf|bse_cm|533278 packetBytes=30
[Init] Ticker COALINDIA is up to date on disk (last bar: 2026-09-30T07:27).
[HSM_SUB_ACK] received status=ACK
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790753288|430|430|430|430|86
[INFO] [FeedSimulator] Feed simulator started: 1 instruments
[Live Tick] 2026-09-30 07:28:08 | BSE:COALINDIA-A | ₹ 429.95 | Vol: 18
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790753290|429.95|429.95|429.95|429.95|18
[Live Tick] 2026-09-30 07:28:10 | BSE:COALINDIA-A | ₹ 429.95 | Vol: 18
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:28:11 | BSE:COALINDIA-A | ₹ 429.95 | Vol: 18
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790753292|429.95|429.95|429.95|429.95|18
[Live Tick] 2026-09-30 07:28:12 | BSE:COALINDIA-A | ₹ 429.95 | Vol: 18
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:28:14 | BSE:COALINDIA-A | ₹ 429.95 | Vol: 18
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790753295|429.95|429.95|429.95|429.95|18
[Live Tick] 2026-09-30 07:28:15 | BSE:COALINDIA-A | ₹ 429.95 | Vol: 18
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:28:16 | BSE:COALINDIA-A | ₹ 429.95 | Vol: 18
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790753297|429.95|429.95|429.95|429.95|18
[Live Tick] 2026-09-30 07:28:17 | BSE:COALINDIA-A | ₹ 429.95 | Vol: 18
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:28:19 | BSE:COALINDIA-A | ₹ 429.95 | Vol: 18
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790753300|429.95|429.95|429.95|429.95|18
[Live Tick] 2026-09-30 07:28:20 | BSE:COALINDIA-A | ₹ 429.95 | Vol: 18
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:28:21 | BSE:COALINDIA-A | ₹ 429.95 | Vol: 18
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790753302|429.95|429.95|429.95|429.95|18
[Live Tick] 2026-09-30 07:28:22 | BSE:COALINDIA-A | ₹ 429.95 | Vol: 18
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
{"ts":"2026-09-30T07:28:24.014Z","method":"GET","path":"/api/settings","ip":"127.0.0.1"}
{"ts":"2026-09-30T07:28:24.017Z","method":"GET","path":"/api/brokers/fyers-edf11f90/master/status","ip":"127.0.0.1"}
{"ts":"2026-09-30T07:28:24.023Z","method":"GET","path":"/api/settings","ip":"127.0.0.1"}
{"ts":"2026-09-30T07:28:24.037Z","method":"GET","path":"/api/brokers","ip":"127.0.0.1"}
{"ts":"2026-09-30T07:28:24.046Z","method":"GET","path":"/api/status/feed","ip":"127.0.0.1"}
{"ts":"2026-09-30T07:28:24.056Z","method":"GET","path":"/api/logs","ip":"127.0.0.1"}
{"ts":"2026-09-30T07:28:24.071Z","method":"GET","path":"/api/backfill/status","ip":"127.0.0.1"}
{"ts":"2026-09-30T07:28:24.080Z","event":"ws_connected","clients":1}
[Live Tick] 2026-09-30 07:28:24 | BSE:COALINDIA-A | ₹ 429.95 | Vol: 18
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790753305|430.3|430.3|430.3|430.3|1
[Live Tick] 2026-09-30 07:28:25 | BSE:COALINDIA-A | ₹ 430.30 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:28:26 | BSE:COALINDIA-A | ₹ 430.30 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790753308|430.3|430.3|430.3|430.3|1
[Live Tick] 2026-09-30 07:28:28 | BSE:COALINDIA-A | ₹ 430.30 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:28:29 | BSE:COALINDIA-A | ₹ 430.30 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790753310|430.3|430.3|430.3|430.3|1
[Live Tick] 2026-09-30 07:28:30 | BSE:COALINDIA-A | ₹ 430.30 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:28:31 | BSE:COALINDIA-A | ₹ 430.30 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790753313|430.3|430.3|430.3|430.3|1
[Live Tick] 2026-09-30 07:28:33 | BSE:COALINDIA-A | ₹ 430.30 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790753315|430.3|430.3|430.3|430.3|1
[Live Tick] 2026-09-30 07:28:35 | BSE:COALINDIA-A | ₹ 430.30 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[System Status] Total Symbols Active: 1 | Receiving Live Ticks: 1
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790753318|430.3|430.3|430.3|430.3|1
[Live Tick] 2026-09-30 07:28:38 | BSE:COALINDIA-A | ₹ 430.30 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790753321|430.3|430.3|430.3|430.3|1
[Live Tick] 2026-09-30 07:28:41 | BSE:COALINDIA-A | ₹ 430.30 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:28:42 | BSE:COALINDIA-A | ₹ 430.30 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790753323|430.3|430.3|430.3|430.3|1
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:28:44 | BSE:COALINDIA-A | ₹ 430.30 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790753325|430.3|430.3|430.3|430.3|1
[Live Tick] 2026-09-30 07:28:45 | BSE:COALINDIA-A | ₹ 430.30 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:28:47 | BSE:COALINDIA-A | ₹ 430.30 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790753328|430.3|430.3|430.3|430.3|1
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:28:49 | BSE:COALINDIA-A | ₹ 430.30 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790753331|429.95|429.95|429.95|429.95|1
[Live Tick] 2026-09-30 07:28:51 | BSE:COALINDIA-A | ₹ 429.95 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790753333|429.95|429.95|429.95|429.95|1
[Live Tick] 2026-09-30 07:28:53 | BSE:COALINDIA-A | ₹ 429.95 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:28:54 | BSE:COALINDIA-A | ₹ 429.95 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790753336|429.95|429.95|429.95|429.95|1
[Live Tick] 2026-09-30 07:28:56 | BSE:COALINDIA-A | ₹ 429.95 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:28:57 | BSE:COALINDIA-A | ₹ 429.95 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790753338|429.95|429.95|429.95|429.95|1
[Live Tick] 2026-09-30 07:28:58 | BSE:COALINDIA-A | ₹ 429.95 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:28:59 | BSE:COALINDIA-A | ₹ 429.95 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790753341|429.95|429.95|429.95|429.95|1
[Live Tick] 2026-09-30 07:29:01 | BSE:COALINDIA-A | ₹ 429.95 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:29:02 | BSE:COALINDIA-A | ₹ 429.95 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790753343|429.95|429.95|429.95|429.95|1
[Live Tick] 2026-09-30 07:29:03 | BSE:COALINDIA-A | ₹ 429.95 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:29:05 | BSE:COALINDIA-A | ₹ 429.95 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790753346|429.95|429.95|429.95|429.95|1
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[System Status] Total Symbols Active: 1 | Receiving Live Ticks: 1
[Live Tick] 2026-09-30 07:29:07 | BSE:COALINDIA-A | ₹ 429.95 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790753348|429.95|429.95|429.95|429.95|1
[Live Tick] 2026-09-30 07:29:08 | BSE:COALINDIA-A | ₹ 429.95 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:29:10 | BSE:COALINDIA-A | ₹ 429.95 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790753351|429.95|429.95|429.95|429.95|1
[Live Tick] 2026-09-30 07:29:11 | BSE:COALINDIA-A | ₹ 429.95 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790753353|429.85|429.85|429.85|429.85|3
[Live Tick] 2026-09-30 07:29:13 | BSE:COALINDIA-A | ₹ 429.85 | Vol: 3
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:29:15 | BSE:COALINDIA-A | ₹ 429.85 | Vol: 3
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790753356|429.85|429.85|429.85|429.85|3
[Live Tick] 2026-09-30 07:29:16 | BSE:COALINDIA-A | ₹ 429.85 | Vol: 3
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:29:17 | BSE:COALINDIA-A | ₹ 429.85 | Vol: 3
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790753359|429.85|429.85|429.85|429.85|3
[Live Tick] 2026-09-30 07:29:19 | BSE:COALINDIA-A | ₹ 429.85 | Vol: 3
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790753361|429.85|429.85|429.85|429.85|3
[Live Tick] 2026-09-30 07:29:21 | BSE:COALINDIA-A | ₹ 429.85 | Vol: 3
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:29:22 | BSE:COALINDIA-A | ₹ 429.85 | Vol: 3
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790753365|429.85|429.85|429.85|429.85|3
[Live Tick] 2026-09-30 07:29:25 | BSE:COALINDIA-A | ₹ 429.85 | Vol: 3
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:29:26 | BSE:COALINDIA-A | ₹ 429.85 | Vol: 3
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790753368|429.85|429.85|429.85|429.85|3
[Live Tick] 2026-09-30 07:29:28 | BSE:COALINDIA-A | ₹ 429.85 | Vol: 3
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790753370|429.85|429.85|429.85|429.85|3
[Live Tick] 2026-09-30 07:29:30 | BSE:COALINDIA-A | ₹ 429.85 | Vol: 3
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:29:31 | BSE:COALINDIA-A | ₹ 430.30 | Vol: 79
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790753373|430.3|430.3|430.3|430.3|79
[Live Tick] 2026-09-30 07:29:33 | BSE:COALINDIA-A | ₹ 430.30 | Vol: 79
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790753375|430.3|430.3|430.3|430.3|79
[Live Tick] 2026-09-30 07:29:35 | BSE:COALINDIA-A | ₹ 430.30 | Vol: 79
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:29:36 | BSE:COALINDIA-A | ₹ 430.30 | Vol: 79
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[System Status] Total Symbols Active: 1 | Receiving Live Ticks: 1
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790753378|430.3|430.3|430.3|430.3|79
[Live Tick] 2026-09-30 07:29:38 | BSE:COALINDIA-A | ₹ 430.30 | Vol: 79
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790753380|430.3|430.3|430.3|430.3|79
[Live Tick] 2026-09-30 07:29:40 | BSE:COALINDIA-A | ₹ 430.30 | Vol: 79
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:29:42 | BSE:COALINDIA-A | ₹ 430.30 | Vol: 79
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790753383|430.3|430.3|430.3|430.3|79
[Live Tick] 2026-09-30 07:29:43 | BSE:COALINDIA-A | ₹ 430.30 | Vol: 79
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:29:44 | BSE:COALINDIA-A | ₹ 430.30 | Vol: 79
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790753385|430.3|430.3|430.3|430.3|79
[Live Tick] 2026-09-30 07:29:45 | BSE:COALINDIA-A | ₹ 430.30 | Vol: 79
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:29:47 | BSE:COALINDIA-A | ₹ 430.30 | Vol: 78
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790753388|430.3|430.3|430.3|430.3|78
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:29:49 | BSE:COALINDIA-A | ₹ 430.30 | Vol: 78
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790753390|430.3|430.3|430.3|430.3|78
[Live Tick] 2026-09-30 07:29:50 | BSE:COALINDIA-A | ₹ 430.30 | Vol: 78
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790753393|430.3|430.3|430.3|430.3|78
[Live Tick] 2026-09-30 07:29:53 | BSE:COALINDIA-A | ₹ 430.30 | Vol: 78
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:29:54 | BSE:COALINDIA-A | ₹ 430.30 | Vol: 78
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790753395|430.3|430.3|430.3|430.3|78
[Live Tick] 2026-09-30 07:29:55 | BSE:COALINDIA-A | ₹ 430.30 | Vol: 78
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:29:57 | BSE:COALINDIA-A | ₹ 430.30 | Vol: 78
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790753400|429.8|429.8|429.8|429.8|30
[Live Tick] 2026-09-30 07:30:00 | BSE:COALINDIA-A | ₹ 429.80 | Vol: 30
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:30:01 | BSE:COALINDIA-A | ₹ 429.80 | Vol: 30
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790753402|429.8|429.8|429.8|429.8|30
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790753404|429.8|429.8|429.8|429.8|30
[Live Tick] 2026-09-30 07:30:04 | BSE:COALINDIA-A | ₹ 429.80 | Vol: 30
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:30:06 | BSE:COALINDIA-A | ₹ 429.85 | Vol: 47
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[System Status] Total Symbols Active: 1 | Receiving Live Ticks: 1
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790753407|429.85|429.85|429.85|429.85|47
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:30:08 | BSE:COALINDIA-A | ₹ 429.85 | Vol: 47
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790753409|429.85|429.85|429.85|429.85|47
[Live Tick] 2026-09-30 07:30:09 | BSE:COALINDIA-A | ₹ 429.85 | Vol: 47
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:30:11 | BSE:COALINDIA-A | ₹ 429.85 | Vol: 47
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790753412|429.85|429.85|429.85|429.85|47
[Live Tick] 2026-09-30 07:30:12 | BSE:COALINDIA-A | ₹ 429.85 | Vol: 47
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:30:13 | BSE:COALINDIA-A | ₹ 429.85 | Vol: 47
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790753415|429.85|429.85|429.85|429.85|47
[Live Tick] 2026-09-30 07:30:15 | BSE:COALINDIA-A | ₹ 429.85 | Vol: 47
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:30:16 | BSE:COALINDIA-A | ₹ 429.85 | Vol: 47
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790753417|429.85|429.85|429.85|429.85|47
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790753420|429.85|429.85|429.85|429.85|10
[Live Tick] 2026-09-30 07:30:20 | BSE:COALINDIA-A | ₹ 429.85 | Vol: 10
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790753423|429.85|429.85|429.85|429.85|10
[Live Tick] 2026-09-30 07:30:23 | BSE:COALINDIA-A | ₹ 429.85 | Vol: 10
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:30:25 | BSE:COALINDIA-A | ₹ 429.90 | Vol: 11
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790753427|429.9|429.9|429.9|429.9|11
[Live Tick] 2026-09-30 07:30:27 | BSE:COALINDIA-A | ₹ 429.90 | Vol: 11
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790753430|429.9|429.9|429.9|429.9|32
[Live Tick] 2026-09-30 07:30:30 | BSE:COALINDIA-A | ₹ 429.90 | Vol: 32
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:30:31 | BSE:COALINDIA-A | ₹ 429.90 | Vol: 32
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790753432|429.9|429.9|429.9|429.9|32
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:30:33 | BSE:COALINDIA-A | ₹ 429.90 | Vol: 32
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:30:34 | BSE:COALINDIA-A | ₹ 429.90 | Vol: 8
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790753435|429.9|429.9|429.9|429.9|8
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:30:36 | BSE:COALINDIA-A | ₹ 429.90 | Vol: 8
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[System Status] Total Symbols Active: 1 | Receiving Live Ticks: 1
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790753438|430.1|430.1|430.1|430.1|1
[Live Tick] 2026-09-30 07:30:38 | BSE:COALINDIA-A | ₹ 430.10 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790753440|430.1|430.1|430.1|430.1|1
[Live Tick] 2026-09-30 07:30:40 | BSE:COALINDIA-A | ₹ 430.10 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:30:41 | BSE:COALINDIA-A | ₹ 430.10 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790753443|430.1|430.1|430.1|430.1|1
[Live Tick] 2026-09-30 07:30:43 | BSE:COALINDIA-A | ₹ 430.10 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:30:44 | BSE:COALINDIA-A | ₹ 429.80 | Vol: 1
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790753445|429.8|429.8|429.8|429.8|1
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:30:46 | BSE:COALINDIA-A | ₹ 429.80 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790753448|429.8|429.8|429.8|429.8|1
[Live Tick] 2026-09-30 07:30:48 | BSE:COALINDIA-A | ₹ 429.80 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:30:49 | BSE:COALINDIA-A | ₹ 429.85 | Vol: 13
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790753450|429.85|429.85|429.85|429.85|13
[Live Tick] 2026-09-30 07:30:50 | BSE:COALINDIA-A | ₹ 429.85 | Vol: 13
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:30:52 | BSE:COALINDIA-A | ₹ 429.85 | Vol: 13
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790753453|429.85|429.85|429.85|429.85|13
[Live Tick] 2026-09-30 07:30:53 | BSE:COALINDIA-A | ₹ 429.85 | Vol: 13
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790753455|429.85|429.85|429.85|429.85|13
[Live Tick] 2026-09-30 07:30:55 | BSE:COALINDIA-A | ₹ 429.85 | Vol: 13
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790753458|429.85|429.85|429.85|429.85|13
[Live Tick] 2026-09-30 07:30:58 | BSE:COALINDIA-A | ₹ 429.85 | Vol: 13
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:30:59 | BSE:COALINDIA-A | ₹ 429.85 | Vol: 13
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790753460|429.8|429.8|429.8|429.8|30
[Live Tick] 2026-09-30 07:31:00 | BSE:COALINDIA-A | ₹ 429.80 | Vol: 30
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:31:02 | BSE:COALINDIA-A | ₹ 430.10 | Vol: 26
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790753463|430.1|430.1|430.1|430.1|26
[Live Tick] 2026-09-30 07:31:03 | BSE:COALINDIA-A | ₹ 430.10 | Vol: 26
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:31:04 | BSE:COALINDIA-A | ₹ 429.80 | Vol: 21
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[System Status] Total Symbols Active: 1 | Receiving Live Ticks: 1
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790753467|429.8|429.8|429.8|429.8|21
[Live Tick] 2026-09-30 07:31:07 | BSE:COALINDIA-A | ₹ 429.80 | Vol: 21
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:31:08 | BSE:COALINDIA-A | ₹ 429.80 | Vol: 21
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790753470|429.8|429.8|429.8|429.8|21
[Live Tick] 2026-09-30 07:31:10 | BSE:COALINDIA-A | ₹ 429.80 | Vol: 21
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790753472|429.8|429.8|429.8|429.8|21
[Live Tick] 2026-09-30 07:31:12 | BSE:COALINDIA-A | ₹ 429.80 | Vol: 21
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:31:13 | BSE:COALINDIA-A | ₹ 429.80 | Vol: 21
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790753474|429.8|429.8|429.8|429.8|21
[Live Tick] 2026-09-30 07:31:14 | BSE:COALINDIA-A | ₹ 429.80 | Vol: 21
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:31:16 | BSE:COALINDIA-A | ₹ 429.80 | Vol: 21
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790753477|429.8|429.8|429.8|429.8|21
[Live Tick] 2026-09-30 07:31:17 | BSE:COALINDIA-A | ₹ 429.80 | Vol: 21
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:31:18 | BSE:COALINDIA-A | ₹ 429.80 | Vol: 21
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790753480|429.8|429.8|429.8|429.8|21
[Live Tick] 2026-09-30 07:31:20 | BSE:COALINDIA-A | ₹ 429.80 | Vol: 21
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790753482|429.8|429.8|429.8|429.8|21
[Live Tick] 2026-09-30 07:31:22 | BSE:COALINDIA-A | ₹ 429.80 | Vol: 21
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:31:23 | BSE:COALINDIA-A | ₹ 429.80 | Vol: 21
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790753484|429.8|429.8|429.75|429.75|34
[Live Tick] 2026-09-30 07:31:24 | BSE:COALINDIA-A | ₹ 429.75 | Vol: 13
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:31:26 | BSE:COALINDIA-A | ₹ 429.75 | Vol: 13
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790753487|429.75|429.75|429.75|429.75|13
[Live Tick] 2026-09-30 07:31:27 | BSE:COALINDIA-A | ₹ 429.75 | Vol: 13
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790753490|429.75|429.75|429.75|429.75|13
[Live Tick] 2026-09-30 07:31:30 | BSE:COALINDIA-A | ₹ 429.75 | Vol: 13
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:31:31 | BSE:COALINDIA-A | ₹ 430.10 | Vol: 246
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790753492|430.1|430.1|430.1|430.1|246
[Live Tick] 2026-09-30 07:31:32 | BSE:COALINDIA-A | ₹ 430.10 | Vol: 246
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:31:33 | BSE:COALINDIA-A | ₹ 430.10 | Vol: 246
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790753495|430.1|430.1|430.1|430.1|246
[Live Tick] 2026-09-30 07:31:35 | BSE:COALINDIA-A | ₹ 430.10 | Vol: 246
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:31:36 | BSE:COALINDIA-A | ₹ 430.10 | Vol: 246
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[System Status] Total Symbols Active: 1 | Receiving Live Ticks: 1
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790753497|430.1|430.1|430.1|430.1|246
[Live Tick] 2026-09-30 07:31:37 | BSE:COALINDIA-A | ₹ 430.10 | Vol: 246
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:31:39 | BSE:COALINDIA-A | ₹ 430.10 | Vol: 246
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790753500|430.1|430.1|430.1|430.1|246
[Live Tick] 2026-09-30 07:31:40 | BSE:COALINDIA-A | ₹ 430.10 | Vol: 246
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:31:41 | BSE:COALINDIA-A | ₹ 430.10 | Vol: 246
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790753502|430.1|430.1|430.1|430.1|246
[Live Tick] 2026-09-30 07:31:42 | BSE:COALINDIA-A | ₹ 430.10 | Vol: 246
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:31:44 | BSE:COALINDIA-A | ₹ 429.75 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790753505|429.75|429.75|429.75|429.75|1
[Live Tick] 2026-09-30 07:31:45 | BSE:COALINDIA-A | ₹ 429.75 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:31:46 | BSE:COALINDIA-A | ₹ 429.75 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790753509|429.75|429.75|429.75|429.75|1
[Live Tick] 2026-09-30 07:31:49 | BSE:COALINDIA-A | ₹ 429.75 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:31:50 | BSE:COALINDIA-A | ₹ 429.75 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790753512|429.75|429.75|429.75|429.75|1
[Live Tick] 2026-09-30 07:31:52 | BSE:COALINDIA-A | ₹ 429.75 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790753514|429.75|429.75|429.75|429.75|1
[Live Tick] 2026-09-30 07:31:54 | BSE:COALINDIA-A | ₹ 429.75 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:31:55 | BSE:COALINDIA-A | ₹ 429.75 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790753516|429.75|429.75|429.75|429.75|1
[Live Tick] 2026-09-30 07:31:56 | BSE:COALINDIA-A | ₹ 429.75 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:31:58 | BSE:COALINDIA-A | ₹ 429.75 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790753519|429.75|429.75|429.75|429.75|1
[Live Tick] 2026-09-30 07:31:59 | BSE:COALINDIA-A | ₹ 429.75 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:32:00 | BSE:COALINDIA-A | ₹ 429.75 | Vol: 6
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790753522|429.75|429.75|429.75|429.75|6
[Live Tick] 2026-09-30 07:32:02 | BSE:COALINDIA-A | ₹ 429.75 | Vol: 6
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790753524|429.75|429.75|429.75|429.75|6
[Live Tick] 2026-09-30 07:32:04 | BSE:COALINDIA-A | ₹ 429.75 | Vol: 6
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:32:06 | BSE:COALINDIA-A | ₹ 429.75 | Vol: 6
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[System Status] Total Symbols Active: 1 | Receiving Live Ticks: 1
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790753527|429.75|429.75|429.75|429.75|6
[Live Tick] 2026-09-30 07:32:07 | BSE:COALINDIA-A | ₹ 429.75 | Vol: 6
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790753529|429.75|429.75|429.75|429.75|8
[Live Tick] 2026-09-30 07:32:09 | BSE:COALINDIA-A | ₹ 429.75 | Vol: 8
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:32:10 | BSE:COALINDIA-A | ₹ 429.75 | Vol: 8
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790753532|429.75|429.75|429.75|429.75|11
[Live Tick] 2026-09-30 07:32:12 | BSE:COALINDIA-A | ₹ 429.75 | Vol: 11
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:32:13 | BSE:COALINDIA-A | ₹ 429.75 | Vol: 11
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790753534|429.75|429.75|429.75|429.75|11
[Live Tick] 2026-09-30 07:32:14 | BSE:COALINDIA-A | ₹ 429.75 | Vol: 11
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:32:16 | BSE:COALINDIA-A | ₹ 430.20 | Vol: 123
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790753537|430.2|430.2|430.2|430.2|123
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:32:18 | BSE:COALINDIA-A | ₹ 430.20 | Vol: 123
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790753539|430.2|430.2|430.2|430.2|123
[Live Tick] 2026-09-30 07:32:19 | BSE:COALINDIA-A | ₹ 430.20 | Vol: 123
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790753542|430.2|430.2|430.2|430.2|123
[Live Tick] 2026-09-30 07:32:22 | BSE:COALINDIA-A | ₹ 430.20 | Vol: 123
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:32:23 | BSE:COALINDIA-A | ₹ 430.20 | Vol: 123
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790753544|430.2|430.2|430.2|430.2|123
[Live Tick] 2026-09-30 07:32:24 | BSE:COALINDIA-A | ₹ 430.20 | Vol: 123
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:32:26 | BSE:COALINDIA-A | ₹ 430.20 | Vol: 123
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790753547|430.2|430.2|430.2|430.2|123
[Live Tick] 2026-09-30 07:32:27 | BSE:COALINDIA-A | ₹ 430.20 | Vol: 123
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:32:28 | BSE:COALINDIA-A | ₹ 430.20 | Vol: 123
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790753550|429.8|429.8|429.8|429.8|32
[Live Tick] 2026-09-30 07:32:30 | BSE:COALINDIA-A | ₹ 429.80 | Vol: 32
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790753552|429.8|429.8|429.8|429.8|32
[Live Tick] 2026-09-30 07:32:32 | BSE:COALINDIA-A | ₹ 429.80 | Vol: 32
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:32:33 | BSE:COALINDIA-A | ₹ 429.80 | Vol: 32
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790753556|429.8|429.8|429.8|429.8|32
[Live Tick] 2026-09-30 07:32:36 | BSE:COALINDIA-A | ₹ 429.80 | Vol: 32
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[System Status] Total Symbols Active: 1 | Receiving Live Ticks: 1
[Live Tick] 2026-09-30 07:32:37 | BSE:COALINDIA-A | ₹ 429.80 | Vol: 32
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790753558|429.8|429.8|429.8|429.8|32
[Live Tick] 2026-09-30 07:32:38 | BSE:COALINDIA-A | ₹ 429.80 | Vol: 32
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:32:40 | BSE:COALINDIA-A | ₹ 429.80 | Vol: 32
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790753561|429.8|429.8|429.8|429.8|32
[Live Tick] 2026-09-30 07:32:41 | BSE:COALINDIA-A | ₹ 429.80 | Vol: 32
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:32:42 | BSE:COALINDIA-A | ₹ 429.80 | Vol: 32
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790753563|429.8|429.8|429.8|429.8|32
[Live Tick] 2026-09-30 07:32:43 | BSE:COALINDIA-A | ₹ 429.80 | Vol: 32
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:32:45 | BSE:COALINDIA-A | ₹ 429.80 | Vol: 32
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790753566|429.8|429.8|429.8|429.8|32
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:32:47 | BSE:COALINDIA-A | ₹ 429.90 | Vol: 11
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790753569|429.9|429.9|429.9|429.9|11
[Live Tick] 2026-09-30 07:32:49 | BSE:COALINDIA-A | ₹ 429.90 | Vol: 11
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:32:50 | BSE:COALINDIA-A | ₹ 429.90 | Vol: 11
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790753571|429.9|429.9|429.9|429.9|11
[Live Tick] 2026-09-30 07:32:51 | BSE:COALINDIA-A | ₹ 429.90 | Vol: 11
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:32:53 | BSE:COALINDIA-A | ₹ 429.90 | Vol: 11
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790753574|429.9|429.9|429.9|429.9|11
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:32:55 | BSE:COALINDIA-A | ₹ 429.90 | Vol: 11
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790753576|429.9|429.9|429.9|429.9|11
[Live Tick] 2026-09-30 07:32:56 | BSE:COALINDIA-A | ₹ 429.90 | Vol: 11
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:32:58 | BSE:COALINDIA-A | ₹ 429.90 | Vol: 11
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790753579|429.9|429.9|429.9|429.9|11
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:33:00 | BSE:COALINDIA-A | ₹ 429.90 | Vol: 11
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790753581|430.2|430.2|430.2|430.2|200
[Live Tick] 2026-09-30 07:33:01 | BSE:COALINDIA-A | ₹ 430.20 | Vol: 200
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:33:03 | BSE:COALINDIA-A | ₹ 430.20 | Vol: 200
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790753584|430.2|430.2|430.2|430.2|200
[Live Tick] 2026-09-30 07:33:04 | BSE:COALINDIA-A | ₹ 430.20 | Vol: 200
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:33:05 | BSE:COALINDIA-A | ₹ 430.20 | Vol: 200
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[System Status] Total Symbols Active: 1 | Receiving Live Ticks: 1
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790753587|430.2|430.2|430.2|430.2|200
[Live Tick] 2026-09-30 07:33:07 | BSE:COALINDIA-A | ₹ 430.20 | Vol: 200
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790753589|430.2|430.2|430.2|430.2|200
[Live Tick] 2026-09-30 07:33:09 | BSE:COALINDIA-A | ₹ 430.20 | Vol: 200
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:33:10 | BSE:COALINDIA-A | ₹ 430.20 | Vol: 200
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790753592|430.2|430.2|430.2|430.2|200
[Live Tick] 2026-09-30 07:33:12 | BSE:COALINDIA-A | ₹ 430.20 | Vol: 200
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:33:13 | BSE:COALINDIA-A | ₹ 430.20 | Vol: 200
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790753594|430.2|430.2|430.2|430.2|200
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:33:15 | BSE:COALINDIA-A | ₹ 430.20 | Vol: 200
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790753597|430.2|430.2|430.2|430.2|200
[Live Tick] 2026-09-30 07:33:17 | BSE:COALINDIA-A | ₹ 430.20 | Vol: 200
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:33:18 | BSE:COALINDIA-A | ₹ 429.85 | Vol: 14
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790753599|429.85|429.85|429.85|429.85|14
[Live Tick] 2026-09-30 07:33:19 | BSE:COALINDIA-A | ₹ 429.85 | Vol: 14
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:33:21 | BSE:COALINDIA-A | ₹ 429.85 | Vol: 14
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790753602|429.85|429.85|429.85|429.85|14
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:33:23 | BSE:COALINDIA-A | ₹ 429.85 | Vol: 14
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790753604|429.85|429.85|429.85|429.85|14
[Live Tick] 2026-09-30 07:33:24 | BSE:COALINDIA-A | ₹ 429.85 | Vol: 14
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790753607|429.85|429.85|429.85|429.85|14
[Live Tick] 2026-09-30 07:33:27 | BSE:COALINDIA-A | ₹ 429.85 | Vol: 14
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:33:28 | BSE:COALINDIA-A | ₹ 429.85 | Vol: 14
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790753609|429.85|429.85|429.85|429.85|14
[Live Tick] 2026-09-30 07:33:29 | BSE:COALINDIA-A | ₹ 429.85 | Vol: 14
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:33:31 | BSE:COALINDIA-A | ₹ 429.85 | Vol: 14
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790753612|429.85|429.85|429.85|429.85|14
[Live Tick] 2026-09-30 07:33:32 | BSE:COALINDIA-A | ₹ 429.85 | Vol: 14
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:33:33 | BSE:COALINDIA-A | ₹ 429.85 | Vol: 14
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790753614|429.85|429.85|429.85|429.85|14
[Live Tick] 2026-09-30 07:33:34 | BSE:COALINDIA-A | ₹ 429.85 | Vol: 14
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:33:36 | BSE:COALINDIA-A | ₹ 429.85 | Vol: 14
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[System Status] Total Symbols Active: 1 | Receiving Live Ticks: 1
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790753617|429.85|429.85|429.85|429.85|14
[Live Tick] 2026-09-30 07:33:37 | BSE:COALINDIA-A | ₹ 429.85 | Vol: 14
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:33:38 | BSE:COALINDIA-A | ₹ 429.85 | Vol: 14
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790753621|429.85|429.85|429.85|429.85|14
[Live Tick] 2026-09-30 07:33:41 | BSE:COALINDIA-A | ₹ 429.85 | Vol: 14
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:33:42 | BSE:COALINDIA-A | ₹ 429.85 | Vol: 14
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790753623|429.85|429.85|429.85|429.85|14
[Live Tick] 2026-09-30 07:33:43 | BSE:COALINDIA-A | ₹ 429.85 | Vol: 14
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:33:45 | BSE:COALINDIA-A | ₹ 429.65 | Vol: 410
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790753626|429.65|429.65|429.65|429.65|410
[Live Tick] 2026-09-30 07:33:46 | BSE:COALINDIA-A | ₹ 429.65 | Vol: 410
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:33:47 | BSE:COALINDIA-A | ₹ 429.65 | Vol: 410
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790753628|429.65|429.65|429.65|429.65|410
[Live Tick] 2026-09-30 07:33:48 | BSE:COALINDIA-A | ₹ 429.65 | Vol: 410
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:33:50 | BSE:COALINDIA-A | ₹ 429.65 | Vol: 410
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790753631|429.65|429.65|429.65|429.65|410
[Live Tick] 2026-09-30 07:33:51 | BSE:COALINDIA-A | ₹ 429.65 | Vol: 410
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:33:52 | BSE:COALINDIA-A | ₹ 429.65 | Vol: 410
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790753634|429.65|429.65|429.65|429.65|410
[Live Tick] 2026-09-30 07:33:54 | BSE:COALINDIA-A | ₹ 429.65 | Vol: 410
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790753636|429.65|429.65|429.65|429.65|410
[Live Tick] 2026-09-30 07:33:56 | BSE:COALINDIA-A | ₹ 429.65 | Vol: 410
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:33:57 | BSE:COALINDIA-A | ₹ 429.65 | Vol: 410
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790753639|429.65|429.65|429.65|429.65|410
[Live Tick] 2026-09-30 07:33:59 | BSE:COALINDIA-A | ₹ 429.65 | Vol: 410
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:34:00 | BSE:COALINDIA-A | ₹ 429.65 | Vol: 410
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790753641|430|430|430|430|269
[Live Tick] 2026-09-30 07:34:01 | BSE:COALINDIA-A | ₹ 430.00 | Vol: 269
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:34:02 | BSE:COALINDIA-A | ₹ 430.00 | Vol: 269
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790753644|430|430|430|430|269
[Live Tick] 2026-09-30 07:34:04 | BSE:COALINDIA-A | ₹ 430.00 | Vol: 269
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:34:05 | BSE:COALINDIA-A | ₹ 429.80 | Vol: 12
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790753646|429.8|429.8|429.8|429.8|12
[Live Tick] 2026-09-30 07:34:06 | BSE:COALINDIA-A | ₹ 429.80 | Vol: 12
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[System Status] Total Symbols Active: 1 | Receiving Live Ticks: 1
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790753649|429.8|429.8|429.8|429.8|12
[Live Tick] 2026-09-30 07:34:09 | BSE:COALINDIA-A | ₹ 429.80 | Vol: 12
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:34:10 | BSE:COALINDIA-A | ₹ 429.80 | Vol: 12
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[API] AmiBroker requested unknown symbol CIPLA, ignoring. Please add it via the UI.
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790753651|429.8|429.8|429.8|429.8|12
[Live Tick] 2026-09-30 07:34:11 | BSE:COALINDIA-A | ₹ 429.80 | Vol: 12
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:34:13 | BSE:COALINDIA-A | ₹ 429.80 | Vol: 12
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790753654|429.8|429.8|429.8|429.8|12
[Live Tick] 2026-09-30 07:34:14 | BSE:COALINDIA-A | ₹ 429.80 | Vol: 12
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:34:15 | BSE:COALINDIA-A | ₹ 429.80 | Vol: 12
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790753656|429.8|429.8|429.8|429.8|12
[Live Tick] 2026-09-30 07:34:16 | BSE:COALINDIA-A | ₹ 429.80 | Vol: 12
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:34:18 | BSE:COALINDIA-A | ₹ 429.80 | Vol: 12
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790753660|429.8|429.8|429.8|429.8|12
[Live Tick] 2026-09-30 07:34:20 | BSE:COALINDIA-A | ₹ 429.80 | Vol: 12
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:34:22 | BSE:COALINDIA-A | ₹ 429.80 | Vol: 12
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790753663|429.8|429.8|429.8|429.8|12
[Live Tick] 2026-09-30 07:34:23 | BSE:COALINDIA-A | ₹ 429.80 | Vol: 12
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790753665|429.8|429.8|429.8|429.8|12
[Live Tick] 2026-09-30 07:34:25 | BSE:COALINDIA-A | ₹ 429.80 | Vol: 12
[API] AmiBroker requested unknown symbol GAIL-FUT, ignoring. Please add it via the UI.
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:34:27 | BSE:COALINDIA-A | ₹ 429.80 | Vol: 12
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790753668|429.8|429.8|429.8|429.8|12
[Live Tick] 2026-09-30 07:34:28 | BSE:COALINDIA-A | ₹ 429.80 | Vol: 12
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[API] AmiBroker requested unknown symbol M, ignoring. Please add it via the UI.
[Live Tick] 2026-09-30 07:34:29 | BSE:COALINDIA-A | ₹ 429.80 | Vol: 12
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[API] AmiBroker requested unknown symbol MARUTI, ignoring. Please add it via the UI.
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790753670|429.8|429.8|429.8|429.8|12
[Live Tick] 2026-09-30 07:34:30 | BSE:COALINDIA-A | ₹ 429.80 | Vol: 12
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:34:32 | BSE:COALINDIA-A | ₹ 430.15 | Vol: 10
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[API] AmiBroker requested unknown symbol TCS, ignoring. Please add it via the UI.
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790753673|430.15|430.15|430.15|430.15|10
[Live Tick] 2026-09-30 07:34:33 | BSE:COALINDIA-A | ₹ 430.15 | Vol: 10
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:34:34 | BSE:COALINDIA-A | ₹ 430.15 | Vol: 10
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790753676|430.15|430.15|430.15|430.15|10
[Live Tick] 2026-09-30 07:34:36 | BSE:COALINDIA-A | ₹ 430.15 | Vol: 10
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[System Status] Total Symbols Active: 1 | Receiving Live Ticks: 1
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[API] AmiBroker requested unknown symbol BAJAJINDEF, ignoring. Please add it via the UI.
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790753678|430.15|430.15|430.15|430.15|10
[Live Tick] 2026-09-30 07:34:38 | BSE:COALINDIA-A | ₹ 430.15 | Vol: 10
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:34:39 | BSE:COALINDIA-A | ₹ 430.15 | Vol: 10
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790753681|430.15|430.15|430.15|430.15|10
[Live Tick] 2026-09-30 07:34:41 | BSE:COALINDIA-A | ₹ 430.15 | Vol: 10
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[API] AmiBroker requested unknown symbol ABCAPITAL, ignoring. Please add it via the UI.
[Live Tick] 2026-09-30 07:34:42 | BSE:COALINDIA-A | ₹ 430.15 | Vol: 10
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790753684|430.15|430.15|430.15|430.15|10
[Live Tick] 2026-09-30 07:34:44 | BSE:COALINDIA-A | ₹ 430.15 | Vol: 10
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:34:45 | BSE:COALINDIA-A | ₹ 430.15 | Vol: 10
[API] AmiBroker requested unknown symbol 360NE, ignoring. Please add it via the UI.
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790753686|430.15|430.15|430.15|430.15|10
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:34:47 | BSE:COALINDIA-A | ₹ 430.15 | Vol: 10
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790753689|430.15|430.15|430.15|430.15|10
[Live Tick] 2026-09-30 07:34:49 | BSE:COALINDIA-A | ₹ 430.15 | Vol: 10
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790753692|430.15|430.15|430.15|430.15|10
[Live Tick] 2026-09-30 07:34:52 | BSE:COALINDIA-A | ₹ 430.15 | Vol: 10
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:34:53 | BSE:COALINDIA-A | ₹ 430.15 | Vol: 10
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790753695|430.15|430.15|430.15|430.15|10
[Live Tick] 2026-09-30 07:34:55 | BSE:COALINDIA-A | ₹ 430.15 | Vol: 10
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:34:56 | BSE:COALINDIA-A | ₹ 430.15 | Vol: 10
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
{"ts":"2026-09-30T07:34:57.907Z","method":"GET","path":"/api/brokers/fyers-edf11f90/search","ip":"127.0.0.1"}
{"ts":"2026-09-30T07:34:58.254Z","method":"GET","path":"/api/brokers/fyers-edf11f90/search","ip":"127.0.0.1"}
{"ts":"2026-09-30T07:34:58.483Z","method":"GET","path":"/api/brokers/fyers-edf11f90/search","ip":"127.0.0.1"}
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790753697|429.7|429.7|429.7|429.7|199
[Live Tick] 2026-09-30 07:34:57 | BSE:COALINDIA-A | ₹ 429.70 | Vol: 199
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
{"ts":"2026-09-30T07:35:00.033Z","method":"POST","path":"/api/brokers/fyers-edf11f90/symbols","ip":"127.0.0.1"}
[INFO] [FeedSimulator] Symbol added: CIPLA (NSE)
[Backfill] CIPLA : Queued for backfill (365 days)
[BackfillQueue] Fetching CIPLA (NSE:CIPLA-EQ) [1 in queue] from 2025-09-30 to 2025-10-30...
[FYERS_HSM_SUBSCRIBE] Subscribing to 1 topics...
[FYERS_HSM_STATUS] subscribed symbols=NSE:CIPLA-EQ
[HSM_SUB_BATCH] batch=1 symbols=1 bytes=16
[HSM_SUB_SEND] count=1 firstToken=sf|nse_cm|694 lastToken=sf|nse_cm|694 packetBytes=27
[HSM_SUB_ACK] received status=ACK
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|CIPLA|1790753699|1364.6|1364.6|1364.6|1364.6|1
[Live Tick] 2026-09-30 07:34:59 | NSE:CIPLA-EQ | ₹ 1364.60 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[BackfillQueue] Saved 7561 bars for CIPLA (2025-09-30 to 2025-10-30)
[BackfillQueue] Fetching CIPLA (NSE:CIPLA-EQ) [1 in queue] from 2025-10-30 to 2025-11-29...
[Live Tick] 2026-09-30 07:35:01 | NSE:CIPLA-EQ | ₹ 1364.60 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[BackfillQueue] Saved 7875 bars for CIPLA (2025-10-30 to 2025-11-29)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[BackfillQueue] Fetching CIPLA (NSE:CIPLA-EQ) [1 in queue] from 2025-11-29 to 2025-12-29...
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|CIPLA|1790753702|1364.6|1364.6|1364.6|1364.6|47
[Live Tick] 2026-09-30 07:35:02 | NSE:CIPLA-EQ | ₹ 1364.60 | Vol: 47
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[BackfillQueue] Saved 7500 bars for CIPLA (2025-11-29 to 2025-12-29)
[BackfillQueue] Fetching CIPLA (NSE:CIPLA-EQ) [1 in queue] from 2025-12-29 to 2026-01-28...
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[BackfillQueue] Saved 7875 bars for CIPLA (2025-12-29 to 2026-01-28)
[BackfillQueue] Fetching CIPLA (NSE:CIPLA-EQ) [1 in queue] from 2026-01-28 to 2026-02-27...
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790753704|430|430|430|430|155
[Live Tick] 2026-09-30 07:35:04 | BSE:COALINDIA-A | ₹ 430.00 | Vol: 155
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[BackfillQueue] Saved 9000 bars for CIPLA (2026-01-28 to 2026-02-27)
[BackfillQueue] Fetching CIPLA (NSE:CIPLA-EQ) [1 in queue] from 2026-02-27 to 2026-03-29...
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
{"ts":"2026-09-30T07:35:06.206Z","method":"GET","path":"/api/brokers/fyers-edf11f90/search","ip":"127.0.0.1"}
{"ts":"2026-09-30T07:35:06.415Z","method":"GET","path":"/api/brokers/fyers-edf11f90/search","ip":"127.0.0.1"}
[BackfillQueue] Saved 7125 bars for CIPLA (2026-02-27 to 2026-03-29)
[BackfillQueue] Fetching CIPLA (NSE:CIPLA-EQ) [1 in queue] from 2026-03-29 to 2026-04-28...
[Live Tick] 2026-09-30 07:35:06 | NSE:CIPLA-EQ | ₹ 1364.60 | Vol: 2
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790753706|429.75|429.75|429.75|429.75|19
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[BackfillQueue] Saved 7125 bars for CIPLA (2026-03-29 to 2026-04-28)
[BackfillQueue] Fetching CIPLA (NSE:CIPLA-EQ) [1 in queue] from 2026-04-28 to 2026-05-28...
[System Status] Total Symbols Active: 2 | Receiving Live Ticks: 2
[Live Tick] 2026-09-30 07:35:07 | BSE:COALINDIA-A | ₹ 429.75 | Vol: 19
[BackfillQueue] Saved 7875 bars for CIPLA (2026-04-28 to 2026-05-28)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[BackfillQueue] Fetching CIPLA (NSE:CIPLA-EQ) [1 in queue] from 2026-05-28 to 2026-06-27...
[BackfillQueue] Saved 7500 bars for CIPLA (2026-05-28 to 2026-06-27)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790753709|429.75|429.75|429.75|429.75|19
[Live Tick] 2026-09-30 07:35:09 | BSE:COALINDIA-A | ₹ 429.75 | Vol: 19
[BackfillQueue] Fetching CIPLA (NSE:CIPLA-EQ) [1 in queue] from 2026-06-27 to 2026-07-27...
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:35:10 | NSE:CIPLA-EQ | ₹ 1364.60 | Vol: 2
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[BackfillQueue] Saved 7875 bars for CIPLA (2026-06-27 to 2026-07-27)
[BackfillQueue] Fetching CIPLA (NSE:CIPLA-EQ) [1 in queue] from 2026-07-27 to 2026-08-26...
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|CIPLA|1790753711|1364.6|1364.6|1364.6|1364.6|2
[Live Tick] 2026-09-30 07:35:11 | NSE:CIPLA-EQ | ₹ 1364.60 | Vol: 2
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[BackfillQueue] Saved 8625 bars for CIPLA (2026-07-27 to 2026-08-26)
[BackfillQueue] Fetching CIPLA (NSE:CIPLA-EQ) [1 in queue] from 2026-08-26 to 2026-09-25...
[Live Tick] 2026-09-30 07:35:12 | BSE:COALINDIA-A | ₹ 429.75 | Vol: 19
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[BackfillQueue] Saved 8257 bars for CIPLA (2026-08-26 to 2026-09-25)
[BackfillQueue] Fetching CIPLA (NSE:CIPLA-EQ) [1 in queue] from 2026-09-25 to 2026-09-30...
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[BackfillQueue] Saved 1356 bars for CIPLA (2026-09-25 to 2026-09-30)
[BackfillQueue] 365-Day Backfill for CIPLA completed successfully!
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790753714|429.75|429.75|429.75|429.75|19
[Live Tick] 2026-09-30 07:35:14 | BSE:COALINDIA-A | ₹ 429.75 | Vol: 19
[GapDetector] CIPLA: 3 gap(s): 2026-01-15T03:45→2026-03-31T09:59, 2026-05-28T03:45→2026-06-26T09:59, 2026-09-14T03:45→2026-09-14T09:59
[BackfillQueue] Enqueued gap-fill for CIPLA: 2026-01-15 → 2026-03-31
[BackfillQueue] Enqueued gap-fill for CIPLA: 2026-05-28 → 2026-06-26
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[BackfillQueue] Fetching CIPLA (NSE:CIPLA-EQ) [2 in queue] from 2026-01-15 to 2026-02-14...
[BackfillQueue] Saved 7875 bars for CIPLA (2026-01-15 to 2026-02-14)
[BackfillQueue] Fetching CIPLA (NSE:CIPLA-EQ) [2 in queue] from 2026-02-14 to 2026-03-16...
[Live Tick] 2026-09-30 07:35:15 | BSE:COALINDIA-A | ₹ 429.75 | Vol: 19
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[BackfillQueue] Saved 7500 bars for CIPLA (2026-02-14 to 2026-03-16)
[BackfillQueue] Fetching CIPLA (NSE:CIPLA-EQ) [2 in queue] from 2026-03-16 to 2026-03-31...
[BackfillQueue] Saved 3750 bars for CIPLA (2026-03-16 to 2026-03-31)
[BackfillQueue] Gap-fill for CIPLA completed successfully!
[BackfillQueue] Fetching CIPLA (NSE:CIPLA-EQ) [1 in queue] from 2026-05-28 to 2026-06-26...
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|CIPLA|1790753716|1364.6|1364.6|1364.6|1364.6|11
[Live Tick] 2026-09-30 07:35:16 | NSE:CIPLA-EQ | ₹ 1364.60 | Vol: 11
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[BackfillQueue] Saved 7500 bars for CIPLA (2026-05-28 to 2026-06-26)
[BackfillQueue] Gap-fill for CIPLA completed successfully!
{"ts":"2026-09-30T07:35:18.024Z","method":"POST","path":"/api/brokers/fyers-edf11f90/symbols","ip":"127.0.0.1"}
[INFO] [FeedSimulator] Symbol added: TCS (NSE)
[Backfill] TCS : Queued for backfill (365 days)
[FYERS_HSM_SUBSCRIBE] Subscribing to 1 topics...
[FYERS_HSM_STATUS] subscribed symbols=NSE:TCS-EQ
[HSM_SUB_BATCH] batch=1 symbols=1 bytes=18
[HSM_SUB_SEND] count=1 firstToken=sf|nse_cm|11536 lastToken=sf|nse_cm|11536 packetBytes=29
[BackfillQueue] Fetching TCS (NSE:TCS-EQ) [1 in queue] from 2025-09-30 to 2025-10-30...
[HSM_SUB_ACK] received status=ACK
[BackfillQueue] Saved 7561 bars for TCS (2025-09-30 to 2025-10-30)
[BackfillQueue] Fetching TCS (NSE:TCS-EQ) [1 in queue] from 2025-10-30 to 2025-11-29...
[Live Tick] 2026-09-30 07:35:18 | BSE:COALINDIA-A | ₹ 429.75 | Vol: 19
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|TCS|1790753719|2067.5|2067.5|2067.5|2067.5|75
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[BackfillQueue] Saved 7875 bars for TCS (2025-10-30 to 2025-11-29)
[BackfillQueue] Fetching TCS (NSE:TCS-EQ) [1 in queue] from 2025-11-29 to 2025-12-29...
[Live Tick] 2026-09-30 07:35:19 | NSE:TCS-EQ | ₹ 2067.30 | Vol: 1
[BackfillQueue] Saved 7500 bars for TCS (2025-11-29 to 2025-12-29)
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[BackfillQueue] Fetching TCS (NSE:TCS-EQ) [1 in queue] from 2025-12-29 to 2026-01-28...
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[BackfillQueue] Saved 7875 bars for TCS (2025-12-29 to 2026-01-28)
[BackfillQueue] Fetching TCS (NSE:TCS-EQ) [1 in queue] from 2026-01-28 to 2026-02-27...
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790753721|429.75|429.75|429.75|429.75|19
[Live Tick] 2026-09-30 07:35:21 | BSE:COALINDIA-A | ₹ 429.75 | Vol: 19
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[BackfillQueue] Saved 9000 bars for TCS (2026-01-28 to 2026-02-27)
[BackfillQueue] Fetching TCS (NSE:TCS-EQ) [1 in queue] from 2026-02-27 to 2026-03-29...
[Live Tick] 2026-09-30 07:35:23 | BSE:COALINDIA-A | ₹ 429.95 | Vol: 9
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[BackfillQueue] Saved 7125 bars for TCS (2026-02-27 to 2026-03-29)
[BackfillQueue] Fetching TCS (NSE:TCS-EQ) [1 in queue] from 2026-03-29 to 2026-04-28...
[BackfillQueue] Saved 7125 bars for TCS (2026-03-29 to 2026-04-28)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790753724|430|430|430|430|11
[Live Tick] 2026-09-30 07:35:24 | BSE:COALINDIA-A | ₹ 430.00 | Vol: 11
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[BackfillQueue] Fetching TCS (NSE:TCS-EQ) [1 in queue] from 2026-04-28 to 2026-05-28...
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[BackfillQueue] Saved 7875 bars for TCS (2026-04-28 to 2026-05-28)
[BackfillQueue] Fetching TCS (NSE:TCS-EQ) [1 in queue] from 2026-05-28 to 2026-06-27...
[Live Tick] 2026-09-30 07:35:25 | BSE:COALINDIA-A | ₹ 430.00 | Vol: 11
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[BackfillQueue] Saved 7500 bars for TCS (2026-05-28 to 2026-06-27)
[BackfillQueue] Fetching TCS (NSE:TCS-EQ) [1 in queue] from 2026-06-27 to 2026-07-27...
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|CIPLA|1790753727|1364.6|1364.6|1364.6|1364.6|11
[Live Tick] 2026-09-30 07:35:27 | NSE:CIPLA-EQ | ₹ 1364.60 | Vol: 11
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[BackfillQueue] Saved 7875 bars for TCS (2026-06-27 to 2026-07-27)
[BackfillQueue] Fetching TCS (NSE:TCS-EQ) [1 in queue] from 2026-07-27 to 2026-08-26...
[Live Tick] 2026-09-30 07:35:28 | BSE:COALINDIA-A | ₹ 430.00 | Vol: 11
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[BackfillQueue] Saved 8625 bars for TCS (2026-07-27 to 2026-08-26)
[BackfillQueue] Fetching TCS (NSE:TCS-EQ) [1 in queue] from 2026-08-26 to 2026-09-25...
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790753729|430|430|430|430|11
[Live Tick] 2026-09-30 07:35:29 | BSE:COALINDIA-A | ₹ 430.00 | Vol: 11
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[BackfillQueue] Saved 8257 bars for TCS (2026-08-26 to 2026-09-25)
[BackfillQueue] Fetching TCS (NSE:TCS-EQ) [1 in queue] from 2026-09-25 to 2026-09-30...
[BackfillQueue] Saved 1356 bars for TCS (2026-09-25 to 2026-09-30)
[BackfillQueue] 365-Day Backfill for TCS completed successfully!
[GapDetector] TCS: 3 gap(s): 2026-01-15T03:45→2026-03-31T09:59, 2026-05-28T03:45→2026-06-26T09:59, 2026-09-14T03:45→2026-09-14T09:59
[BackfillQueue] Enqueued gap-fill for TCS: 2026-01-15 → 2026-03-31
[BackfillQueue] Enqueued gap-fill for TCS: 2026-05-28 → 2026-06-26
[BackfillQueue] Fetching TCS (NSE:TCS-EQ) [2 in queue] from 2026-01-15 to 2026-02-14...
[Live Tick] 2026-09-30 07:35:30 | BSE:COALINDIA-A | ₹ 430.00 | Vol: 11
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[BackfillQueue] Saved 7875 bars for TCS (2026-01-15 to 2026-02-14)
[BackfillQueue] Fetching TCS (NSE:TCS-EQ) [2 in queue] from 2026-02-14 to 2026-03-16...
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|TCS|1790753731|2068|2068|2068|2068|10
[Live Tick] 2026-09-30 07:35:31 | NSE:TCS-EQ | ₹ 2068.00 | Vol: 10
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[BackfillQueue] Saved 7500 bars for TCS (2026-02-14 to 2026-03-16)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[BackfillQueue] Fetching TCS (NSE:TCS-EQ) [2 in queue] from 2026-03-16 to 2026-03-31...
[BackfillQueue] Saved 3750 bars for TCS (2026-03-16 to 2026-03-31)
[BackfillQueue] Gap-fill for TCS completed successfully!
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[BackfillQueue] Fetching TCS (NSE:TCS-EQ) [1 in queue] from 2026-05-28 to 2026-06-26...
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:35:32 | NSE:TCS-EQ | ₹ 2067.50 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[BackfillQueue] Saved 7500 bars for TCS (2026-05-28 to 2026-06-26)
[BackfillQueue] Gap-fill for TCS completed successfully!
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|TCS|1790753734|2068.1|2068.1|2068.1|2068.1|25
[Live Tick] 2026-09-30 07:35:34 | NSE:TCS-EQ | ₹ 2068.10 | Vol: 25
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:35:35 | NSE:TCS-EQ | ₹ 2068.20 | Vol: 5
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|CIPLA|1790753736|1364.6|1364.6|1364.6|1364.6|1
[DEBUG] [FeedSimulator] Batch write: 3 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:35:37 | BSE:COALINDIA-A | ₹ 430.00 | Vol: 11
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[System Status] Total Symbols Active: 3 | Receiving Live Ticks: 3
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:35:38 | NSE:TCS-EQ | ₹ 2068.20 | Vol: 25
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|TCS|1790753738|2068.2|2068.2|2068|2068|26
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:35:39 | BSE:COALINDIA-A | ₹ 430.00 | Vol: 11
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:35:40 | BSE:COALINDIA-A | ₹ 430.00 | Vol: 11
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|TCS|1790753740|2068.2|2068.2|2068.1|2068.2|12
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:35:42 | NSE:CIPLA-EQ | ₹ 1364.60 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|TCS|1790753743|2068.2|2068.2|2068.2|2068.2|5
[Live Tick] 2026-09-30 07:35:43 | BSE:COALINDIA-A | ₹ 430.00 | Vol: 11
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:35:44 | BSE:COALINDIA-A | ₹ 430.00 | Vol: 11
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|CIPLA|1790753745|1364.6|1364.6|1364.6|1364.6|3
[Live Tick] 2026-09-30 07:35:45 | NSE:CIPLA-EQ | ₹ 1364.60 | Vol: 3
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:35:47 | BSE:COALINDIA-A | ₹ 430.15 | Vol: 195
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|TCS|1790753747|2068.1|2068.1|2068.1|2068.1|5
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:35:48 | NSE:TCS-EQ | ₹ 2068.20 | Vol: 2
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:35:49 | NSE:CIPLA-EQ | ₹ 1364.60 | Vol: 3
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790753750|430.15|430.15|430.15|430.15|195
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:35:50 | NSE:TCS-EQ | ₹ 2068.20 | Vol: 3
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790753752|429.75|429.75|429.75|429.75|42
[Live Tick] 2026-09-30 07:35:52 | BSE:COALINDIA-A | ₹ 429.75 | Vol: 42
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:35:53 | BSE:COALINDIA-A | ₹ 429.75 | Vol: 42
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|TCS|1790753754|2068.1|2068.1|2068.1|2068.1|2
[Live Tick] 2026-09-30 07:35:54 | NSE:TCS-EQ | ₹ 2068.10 | Vol: 2
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:35:56 | BSE:COALINDIA-A | ₹ 429.75 | Vol: 42
[DEBUG] [FeedSimulator] Batch write: 3 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|TCS|1790753757|2068.3|2068.3|2068.3|2068.3|4
[Live Tick] 2026-09-30 07:35:57 | NSE:TCS-EQ | ₹ 2068.30 | Vol: 4
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:35:58 | NSE:TCS-EQ | ₹ 2068.30 | Vol: 26
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|TCS|1790753759|2068.3|2068.3|2068.3|2068.3|26
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:35:59 | BSE:COALINDIA-A | ₹ 429.75 | Vol: 42
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:36:01 | NSE:CIPLA-EQ | ₹ 1364.70 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|CIPLA|1790753762|1364.7|1364.7|1364.7|1364.7|1
[Live Tick] 2026-09-30 07:36:02 | NSE:CIPLA-EQ | ₹ 1364.70 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 3 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:36:03 | BSE:COALINDIA-A | ₹ 430.20 | Vol: 59
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|TCS|1790753764|2069|2069|2069|2069|1
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:36:05 | BSE:COALINDIA-A | ₹ 430.20 | Vol: 59
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:36:06 | NSE:TCS-EQ | ₹ 2069.00 | Vol: 8
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|CIPLA|1790753767|1364.7|1364.7|1364.7|1364.7|1
[System Status] Total Symbols Active: 3 | Receiving Live Ticks: 3
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:36:07 | NSE:TCS-EQ | ₹ 2069.00 | Vol: 5
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790753769|430.2|430.2|430.2|430.2|59
[Live Tick] 2026-09-30 07:36:09 | BSE:COALINDIA-A | ₹ 430.20 | Vol: 59
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:36:10 | NSE:TCS-EQ | ₹ 2069.00 | Vol: 7
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790753771|430.2|430.2|430.2|430.2|59
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:36:12 | NSE:CIPLA-EQ | ₹ 1364.70 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:36:13 | BSE:COALINDIA-A | ₹ 430.20 | Vol: 59
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|TCS|1790753774|2069|2069|2069|2069|7
[Live Tick] 2026-09-30 07:36:14 | NSE:TCS-EQ | ₹ 2069.00 | Vol: 7
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:36:15 | BSE:COALINDIA-A | ₹ 430.20 | Vol: 59
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790753776|430.2|430.2|430.2|430.2|59
[Live Tick] 2026-09-30 07:36:16 | BSE:COALINDIA-A | ₹ 430.20 | Vol: 59
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:36:17 | BSE:COALINDIA-A | ₹ 430.20 | Vol: 59
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|TCS|1790753778|2069.1|2069.1|2069.1|2069.1|34
[Live Tick] 2026-09-30 07:36:18 | NSE:TCS-EQ | ₹ 2069.10 | Vol: 34
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:36:19 | NSE:TCS-EQ | ₹ 2068.80 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|CIPLA|1790753780|1364.8|1364.8|1364.8|1364.8|1
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:36:21 | BSE:COALINDIA-A | ₹ 430.20 | Vol: 59
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:36:22 | NSE:TCS-EQ | ₹ 2068.80 | Vol: 33
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|TCS|1790753783|2068.7|2068.7|2068.7|2068.7|15
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:36:24 | BSE:COALINDIA-A | ₹ 429.80 | Vol: 13
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:36:25 | NSE:CIPLA-EQ | ₹ 1364.80 | Vol: 2
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790753785|429.8|429.8|429.8|429.8|13
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:36:26 | NSE:TCS-EQ | ₹ 2069.10 | Vol: 25
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:36:27 | NSE:TCS-EQ | ₹ 2069.10 | Vol: 25
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|TCS|1790753788|2069.1|2069.1|2069.1|2069.1|25
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:36:28 | BSE:COALINDIA-A | ₹ 429.80 | Vol: 13
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:36:29 | NSE:TCS-EQ | ₹ 2069.20 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|TCS|1790753790|2069.2|2069.2|2069.2|2069.2|4
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:36:31 | NSE:CIPLA-EQ | ₹ 1364.80 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:36:32 | BSE:COALINDIA-A | ₹ 429.80 | Vol: 13
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790753793|429.8|429.8|429.8|429.8|13
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:36:33 | NSE:TCS-EQ | ₹ 2069.20 | Vol: 2
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:36:34 | BSE:COALINDIA-A | ₹ 429.80 | Vol: 13
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|TCS|1790753795|2069.2|2069.6|2069.2|2069.6|18
[Live Tick] 2026-09-30 07:36:35 | NSE:TCS-EQ | ₹ 2069.60 | Vol: 14
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:36:36 | NSE:TCS-EQ | ₹ 2069.60 | Vol: 14
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[System Status] Total Symbols Active: 3 | Receiving Live Ticks: 3
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|TCS|1790753797|2069.6|2069.6|2069.6|2069.6|14
[Live Tick] 2026-09-30 07:36:37 | NSE:TCS-EQ | ₹ 2069.60 | Vol: 14
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:36:38 | NSE:TCS-EQ | ₹ 2069.60 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|TCS|1790753799|2069.4|2069.6|2069.4|2069.6|5
[Live Tick] 2026-09-30 07:36:40 | NSE:TCS-EQ | ₹ 2069.60 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:36:41 | NSE:CIPLA-EQ | ₹ 1364.90 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790753802|429.95|429.95|429.95|429.95|10
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:36:42 | NSE:TCS-EQ | ₹ 2069.50 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:36:43 | NSE:TCS-EQ | ₹ 2069.20 | Vol: 18
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790753804|429.95|429.95|429.95|429.95|10
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:36:45 | NSE:TCS-EQ | ₹ 2069.20 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|TCS|1790753806|2069.6|2069.6|2069.6|2069.6|99
[Live Tick] 2026-09-30 07:36:46 | NSE:TCS-EQ | ₹ 2069.60 | Vol: 99
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:36:48 | NSE:TCS-EQ | ₹ 2069.10 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|TCS|1790753809|2069.5|2069.5|2069.5|2069.5|13
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:36:49 | BSE:COALINDIA-A | ₹ 429.95 | Vol: 10
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:36:50 | NSE:TCS-EQ | ₹ 2069.50 | Vol: 13
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|CIPLA|1790753812|1364.7|1364.7|1364.7|1364.7|1
[Live Tick] 2026-09-30 07:36:52 | NSE:CIPLA-EQ | ₹ 1364.70 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:36:53 | NSE:CIPLA-EQ | ₹ 1364.70 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|TCS|1790753814|2069.4|2069.4|2069.4|2069.4|10
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:36:54 | NSE:TCS-EQ | ₹ 2069.20 | Vol: 2
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:36:55 | NSE:CIPLA-EQ | ₹ 1364.80 | Vol: 6
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|TCS|1790753816|2069|2069|2069|2069|1
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:36:57 | BSE:COALINDIA-A | ₹ 429.95 | Vol: 10
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|CIPLA|1790753818|1364.8|1364.8|1364.8|1364.8|6
[Live Tick] 2026-09-30 07:36:58 | NSE:CIPLA-EQ | ₹ 1364.80 | Vol: 6
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:37:00 | NSE:TCS-EQ | ₹ 2069.00 | Vol: 3
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790753821|429.95|429.95|429.95|429.95|10
[Live Tick] 2026-09-30 07:37:01 | BSE:COALINDIA-A | ₹ 429.95 | Vol: 10
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:37:02 | NSE:TCS-EQ | ₹ 2069.00 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|TCS|1790753823|2069|2069|2069|2069|1
[Live Tick] 2026-09-30 07:37:03 | NSE:TCS-EQ | ₹ 2069.00 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:37:04 | NSE:TCS-EQ | ₹ 2068.90 | Vol: 2
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|TCS|1790753826|2068.8|2068.8|2068.8|2068.8|2
[Live Tick] 2026-09-30 07:37:06 | NSE:TCS-EQ | ₹ 2068.80 | Vol: 2
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[System Status] Total Symbols Active: 3 | Receiving Live Ticks: 3
[Live Tick] 2026-09-30 07:37:07 | NSE:TCS-EQ | ₹ 2069.00 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|CIPLA|1790753828|1364.8|1364.8|1364.8|1364.8|2
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:37:08 | NSE:TCS-EQ | ₹ 2069.00 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:37:10 | BSE:COALINDIA-A | ₹ 429.95 | Vol: 10
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|TCS|1790753831|2069|2069|2069|2069|7
[Live Tick] 2026-09-30 07:37:11 | NSE:TCS-EQ | ₹ 2069.00 | Vol: 7
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:37:12 | BSE:COALINDIA-A | ₹ 429.95 | Vol: 10
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|TCS|1790753833|2069|2069|2069|2069|1
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:37:13 | BSE:COALINDIA-A | ₹ 429.95 | Vol: 10
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:37:14 | NSE:TCS-EQ | ₹ 2069.00 | Vol: 31
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|TCS|1790753835|2069|2069|2068.9|2068.9|41
[Live Tick] 2026-09-30 07:37:16 | NSE:TCS-EQ | ₹ 2068.90 | Vol: 39
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:37:17 | NSE:TCS-EQ | ₹ 2068.90 | Vol: 39
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790753838|429.7|429.7|429.7|429.7|5
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:37:18 | NSE:CIPLA-EQ | ₹ 1364.80 | Vol: 11
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790753840|429.7|429.7|429.7|429.7|5
[Live Tick] 2026-09-30 07:37:20 | BSE:COALINDIA-A | ₹ 429.70 | Vol: 5
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:37:21 | BSE:COALINDIA-A | ₹ 429.70 | Vol: 5
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790753842|429.7|429.7|429.7|429.7|5
[Live Tick] 2026-09-30 07:37:22 | BSE:COALINDIA-A | ₹ 429.70 | Vol: 5
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:37:24 | BSE:COALINDIA-A | ₹ 429.70 | Vol: 33
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|CIPLA|1790753845|1364.8|1364.8|1364.8|1364.8|6
[Live Tick] 2026-09-30 07:37:25 | NSE:CIPLA-EQ | ₹ 1364.80 | Vol: 6
[DEBUG] [FeedSimulator] Batch write: 3 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:37:26 | NSE:TCS-EQ | ₹ 2068.70 | Vol: 36
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|TCS|1790753847|2068.7|2068.7|2068.7|2068.7|4
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:37:27 | BSE:COALINDIA-A | ₹ 429.70 | Vol: 33
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:37:29 | BSE:COALINDIA-A | ₹ 429.70 | Vol: 33
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|TCS|1790753849|2068.7|2068.7|2068.7|2068.7|2
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:37:30 | BSE:COALINDIA-A | ₹ 429.70 | Vol: 33
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:37:31 | BSE:COALINDIA-A | ₹ 430.15 | Vol: 100
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|TCS|1790753851|2068.7|2068.7|2068.7|2068.7|1
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:37:32 | NSE:TCS-EQ | ₹ 2068.70 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|TCS|1790753853|2068.6|2068.6|2068.6|2068.6|2
[Live Tick] 2026-09-30 07:37:33 | NSE:TCS-EQ | ₹ 2068.60 | Vol: 2
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:37:35 | NSE:TCS-EQ | ₹ 2068.70 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|TCS|1790753855|2068.7|2068.7|2068.2|2068.2|2
[Live Tick] 2026-09-30 07:37:36 | BSE:COALINDIA-A | ₹ 430.15 | Vol: 100
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[System Status] Total Symbols Active: 3 | Receiving Live Ticks: 3
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790753858|430.15|430.15|430.15|430.15|100
[Live Tick] 2026-09-30 07:37:38 | BSE:COALINDIA-A | ₹ 430.15 | Vol: 100
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:37:39 | NSE:TCS-EQ | ₹ 2068.70 | Vol: 5
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790753860|430.15|430.15|430.15|430.15|100
[Live Tick] 2026-09-30 07:37:40 | BSE:COALINDIA-A | ₹ 430.15 | Vol: 100
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:37:42 | BSE:COALINDIA-A | ₹ 430.15 | Vol: 100
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|TCS|1790753862|2068.3|2068.3|2068.3|2068.3|5
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:37:43 | NSE:CIPLA-EQ | ₹ 1364.70 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790753865|430.15|430.15|430.15|430.15|100
[Live Tick] 2026-09-30 07:37:45 | BSE:COALINDIA-A | ₹ 430.15 | Vol: 100
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:37:47 | BSE:COALINDIA-A | ₹ 430.15 | Vol: 100
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790753868|430.15|430.15|430.15|430.15|100
[Live Tick] 2026-09-30 07:37:48 | NSE:CIPLA-EQ | ₹ 1364.80 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:37:49 | BSE:COALINDIA-A | ₹ 429.70 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|CIPLA|1790753870|1364.8|1364.8|1364.8|1364.8|1
[Live Tick] 2026-09-30 07:37:50 | NSE:CIPLA-EQ | ₹ 1364.80 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:37:52 | BSE:COALINDIA-A | ₹ 429.70 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|CIPLA|1790753873|1364.7|1364.7|1364.7|1364.7|1
[Live Tick] 2026-09-30 07:37:53 | NSE:CIPLA-EQ | ₹ 1364.70 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:37:54 | NSE:TCS-EQ | ₹ 2068.30 | Vol: 3
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790753875|429.7|429.7|429.7|429.7|1
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:37:56 | BSE:COALINDIA-A | ₹ 429.70 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|CIPLA|1790753877|1364.8|1364.8|1364.8|1364.8|1
[Live Tick] 2026-09-30 07:37:57 | NSE:CIPLA-EQ | ₹ 1364.80 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:37:59 | NSE:TCS-EQ | ₹ 2068.50 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|TCS|1790753880|2068.4|2068.4|2068.4|2068.4|4
[Live Tick] 2026-09-30 07:38:00 | NSE:TCS-EQ | ₹ 2068.40 | Vol: 4
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:38:02 | BSE:COALINDIA-A | ₹ 430.15 | Vol: 194
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|CIPLA|1790753883|1364.8|1364.8|1364.8|1364.8|1
[Live Tick] 2026-09-30 07:38:03 | NSE:CIPLA-EQ | ₹ 1364.80 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:38:04 | BSE:COALINDIA-A | ₹ 430.15 | Vol: 194
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790753886|430.15|430.15|430.15|430.15|194
[Live Tick] 2026-09-30 07:38:06 | BSE:COALINDIA-A | ₹ 430.15 | Vol: 194
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:38:06 | NSE:TCS-EQ | ₹ 2068.80 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[System Status] Total Symbols Active: 3 | Receiving Live Ticks: 3
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790753888|430.15|430.15|430.15|430.15|194
[Live Tick] 2026-09-30 07:38:08 | BSE:COALINDIA-A | ₹ 430.15 | Vol: 194
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:38:10 | NSE:TCS-EQ | ₹ 2068.80 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790753891|430.15|430.15|430.15|430.15|194
[Live Tick] 2026-09-30 07:38:11 | BSE:COALINDIA-A | ₹ 430.15 | Vol: 194
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:38:12 | BSE:COALINDIA-A | ₹ 429.70 | Vol: 51
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790753893|429.65|429.65|429.65|429.65|23
[Live Tick] 2026-09-30 07:38:13 | BSE:COALINDIA-A | ₹ 429.65 | Vol: 23
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:38:14 | BSE:COALINDIA-A | ₹ 429.50 | Vol: 164
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|TCS|1790753895|2068.5|2068.5|2068.5|2068.5|1
[Live Tick] 2026-09-30 07:38:15 | NSE:TCS-EQ | ₹ 2068.50 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:38:17 | BSE:COALINDIA-A | ₹ 429.40 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|CIPLA|1790753898|1364.7|1364.7|1364.7|1364.7|1
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:38:18 | BSE:COALINDIA-A | ₹ 429.40 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:38:20 | BSE:COALINDIA-A | ₹ 429.40 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790753901|429.35|429.35|429.35|429.35|2
[Live Tick] 2026-09-30 07:38:21 | BSE:COALINDIA-A | ₹ 429.35 | Vol: 2
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:38:22 | BSE:COALINDIA-A | ₹ 429.60 | Vol: 7
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|CIPLA|1790753903|1364|1364|1364|1364|1
[Live Tick] 2026-09-30 07:38:23 | NSE:CIPLA-EQ | ₹ 1364.00 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 3 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:38:25 | NSE:CIPLA-EQ | ₹ 1364.50 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790753906|429.55|429.55|429.55|429.55|4
[Live Tick] 2026-09-30 07:38:26 | BSE:COALINDIA-A | ₹ 429.55 | Vol: 4
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:38:27 | BSE:COALINDIA-A | ₹ 429.55 | Vol: 4
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790753909|429.55|429.55|429.55|429.55|4
[Live Tick] 2026-09-30 07:38:29 | BSE:COALINDIA-A | ₹ 429.55 | Vol: 4
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:38:30 | NSE:CIPLA-EQ | ₹ 1364.40 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790753911|429.55|429.55|429.55|429.55|4
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:38:32 | BSE:COALINDIA-A | ₹ 429.55 | Vol: 4
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790753914|429.55|429.55|429.55|429.55|1
[Live Tick] 2026-09-30 07:38:34 | BSE:COALINDIA-A | ₹ 429.55 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:38:35 | NSE:CIPLA-EQ | ₹ 1364.40 | Vol: 11
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790753916|429.55|429.55|429.55|429.55|1
[Live Tick] 2026-09-30 07:38:36 | BSE:COALINDIA-A | ₹ 429.55 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[System Status] Total Symbols Active: 3 | Receiving Live Ticks: 3
[Live Tick] 2026-09-30 07:38:38 | BSE:COALINDIA-A | ₹ 429.55 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790753919|429.55|429.55|429.55|429.55|1
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:38:39 | NSE:CIPLA-EQ | ₹ 1364.40 | Vol: 11
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|TCS|1790753921|2068.9|2068.9|2068.9|2068.9|1
[Live Tick] 2026-09-30 07:38:41 | NSE:TCS-EQ | ₹ 2068.90 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:38:42 | NSE:CIPLA-EQ | ₹ 1364.20 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790753923|429.65|429.65|429.65|429.65|18
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:38:44 | BSE:COALINDIA-A | ₹ 429.65 | Vol: 18
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:38:45 | NSE:TCS-EQ | ₹ 2068.90 | Vol: 19
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790753925|429.65|429.65|429.65|429.65|18
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:38:46 | BSE:COALINDIA-A | ₹ 430.10 | Vol: 33
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790753928|429.7|429.7|429.7|429.7|1
[Live Tick] 2026-09-30 07:38:48 | BSE:COALINDIA-A | ₹ 429.70 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:38:48 | NSE:CIPLA-EQ | ₹ 1364.00 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790753930|429.7|429.7|429.7|429.7|1
[Live Tick] 2026-09-30 07:38:50 | BSE:COALINDIA-A | ₹ 429.70 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790753933|429.7|429.7|429.7|429.7|1
[Live Tick] 2026-09-30 07:38:53 | BSE:COALINDIA-A | ₹ 429.70 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:38:54 | BSE:COALINDIA-A | ₹ 429.70 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|TCS|1790753935|2068.5|2068.5|2068.5|2068.5|1
[Live Tick] 2026-09-30 07:38:55 | NSE:TCS-EQ | ₹ 2068.50 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:38:57 | BSE:COALINDIA-A | ₹ 429.70 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|TCS|1790753937|2068.5|2068.5|2068.5|2068.5|4
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:38:59 | BSE:COALINDIA-A | ₹ 429.70 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|CIPLA|1790753940|1364.4|1364.4|1364.4|1364.4|1
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:39:00 | NSE:TCS-EQ | ₹ 2068.60 | Vol: 22
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:39:02 | BSE:COALINDIA-A | ₹ 429.70 | Vol: 23
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|TCS|1790753942|2068.6|2068.6|2068.6|2068.6|14
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:39:03 | BSE:COALINDIA-A | ₹ 429.70 | Vol: 23
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:39:04 | BSE:COALINDIA-A | ₹ 429.70 | Vol: 23
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790753945|429.6|429.6|429.6|429.6|15
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:39:05 | NSE:CIPLA-EQ | ₹ 1364.40 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790753947|429.5|429.5|429.5|429.5|134
[Live Tick] 2026-09-30 07:39:07 | BSE:COALINDIA-A | ₹ 429.50 | Vol: 134
[System Status] Total Symbols Active: 3 | Receiving Live Ticks: 3
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:39:08 | BSE:COALINDIA-A | ₹ 429.50 | Vol: 134
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790753949|429.5|429.5|429.5|429.5|134
[Live Tick] 2026-09-30 07:39:09 | BSE:COALINDIA-A | ₹ 429.50 | Vol: 134
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:39:10 | NSE:CIPLA-EQ | ₹ 1364.40 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|CIPLA|1790753951|1364.4|1364.4|1364.4|1364.4|2
[Live Tick] 2026-09-30 07:39:11 | NSE:CIPLA-EQ | ₹ 1364.40 | Vol: 2
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:39:13 | NSE:TCS-EQ | ₹ 2068.60 | Vol: 20
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790753954|429.5|429.5|429.5|429.5|134
[Live Tick] 2026-09-30 07:39:14 | BSE:COALINDIA-A | ₹ 429.50 | Vol: 134
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:39:15 | NSE:TCS-EQ | ₹ 2068.60 | Vol: 20
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790753957|429.55|429.55|429.55|429.55|6
[Live Tick] 2026-09-30 07:39:17 | BSE:COALINDIA-A | ₹ 429.55 | Vol: 6
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:39:18 | BSE:COALINDIA-A | ₹ 429.55 | Vol: 6
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790753960|429.55|429.55|429.55|429.55|6
[Live Tick] 2026-09-30 07:39:20 | BSE:COALINDIA-A | ₹ 429.55 | Vol: 6
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790753962|429.55|429.55|429.55|429.55|6
[Live Tick] 2026-09-30 07:39:22 | BSE:COALINDIA-A | ₹ 429.55 | Vol: 6
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:39:23 | BSE:COALINDIA-A | ₹ 429.55 | Vol: 6
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790753965|429.55|429.55|429.55|429.55|6
[Live Tick] 2026-09-30 07:39:25 | BSE:COALINDIA-A | ₹ 429.55 | Vol: 6
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:39:26 | NSE:CIPLA-EQ | ₹ 1364.40 | Vol: 4
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790753967|429.55|429.55|429.55|429.55|6
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:39:27 | BSE:COALINDIA-A | ₹ 429.60 | Vol: 15
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:39:29 | BSE:COALINDIA-A | ₹ 429.60 | Vol: 15
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790753970|429.6|429.6|429.6|429.6|15
[Live Tick] 2026-09-30 07:39:30 | BSE:COALINDIA-A | ₹ 429.60 | Vol: 15
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790753972|429.6|429.6|429.6|429.6|1
[Live Tick] 2026-09-30 07:39:32 | BSE:COALINDIA-A | ₹ 429.60 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:39:33 | BSE:COALINDIA-A | ₹ 429.60 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790753975|429.6|429.6|429.6|429.6|1
[Live Tick] 2026-09-30 07:39:35 | BSE:COALINDIA-A | ₹ 429.60 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:39:36 | NSE:TCS-EQ | ₹ 2068.00 | Vol: 81
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[System Status] Total Symbols Active: 3 | Receiving Live Ticks: 3
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790753977|429.65|429.65|429.65|429.65|2
[Live Tick] 2026-09-30 07:39:37 | BSE:COALINDIA-A | ₹ 429.65 | Vol: 2
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:39:38 | NSE:TCS-EQ | ₹ 2068.00 | Vol: 11
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790753980|429.65|429.65|429.65|429.65|2
[Live Tick] 2026-09-30 07:39:40 | BSE:COALINDIA-A | ₹ 429.65 | Vol: 2
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:39:41 | NSE:TCS-EQ | ₹ 2068.30 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790753982|429.9|429.9|429.9|429.9|14
[Live Tick] 2026-09-30 07:39:42 | BSE:COALINDIA-A | ₹ 429.90 | Vol: 14
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:39:44 | BSE:COALINDIA-A | ₹ 429.65 | Vol: 3
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|TCS|1790753984|2068.3|2068.3|2068.1|2068.1|21
[Live Tick] 2026-09-30 07:39:45 | BSE:COALINDIA-A | ₹ 429.65 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:39:46 | NSE:TCS-EQ | ₹ 2068.30 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790753987|429.65|429.65|429.65|429.65|1
[Live Tick] 2026-09-30 07:39:47 | BSE:COALINDIA-A | ₹ 429.65 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:39:49 | BSE:COALINDIA-A | ₹ 429.65 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790753990|429.65|429.65|429.65|429.65|1
[Live Tick] 2026-09-30 07:39:50 | BSE:COALINDIA-A | ₹ 429.65 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:39:51 | BSE:COALINDIA-A | ₹ 429.65 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790753992|429.65|429.65|429.65|429.65|1
[Live Tick] 2026-09-30 07:39:52 | BSE:COALINDIA-A | ₹ 429.65 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:39:54 | NSE:TCS-EQ | ₹ 2068.10 | Vol: 10
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|TCS|1790753994|2068.1|2068.2|2068.1|2068.2|11
[Live Tick] 2026-09-30 07:39:55 | BSE:COALINDIA-A | ₹ 429.65 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:39:56 | NSE:TCS-EQ | ₹ 2068.20 | Vol: 20
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790753997|429.65|429.65|429.65|429.65|1
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:39:58 | BSE:COALINDIA-A | ₹ 429.65 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790753999|429.65|429.65|429.65|429.65|1
[Live Tick] 2026-09-30 07:39:59 | BSE:COALINDIA-A | ₹ 429.65 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:40:00 | BSE:COALINDIA-A | ₹ 429.65 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790754001|429.65|429.65|429.6|429.6|2
[Live Tick] 2026-09-30 07:40:01 | BSE:COALINDIA-A | ₹ 429.60 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:40:03 | BSE:COALINDIA-A | ₹ 429.60 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|TCS|1790754003|2068.2|2068.2|2068.2|2068.2|2
[Live Tick] 2026-09-30 07:40:03 | NSE:TCS-EQ | ₹ 2068.20 | Vol: 2
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:40:05 | NSE:CIPLA-EQ | ₹ 1364.40 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|CIPLA|1790754006|1364.4|1364.4|1364.4|1364.4|1
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:40:06 | NSE:TCS-EQ | ₹ 2068.20 | Vol: 2
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[System Status] Total Symbols Active: 3 | Receiving Live Ticks: 3
[Live Tick] 2026-09-30 07:40:07 | BSE:COALINDIA-A | ₹ 429.60 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|TCS|1790754009|2068.2|2068.2|2068.2|2068.2|3
[Live Tick] 2026-09-30 07:40:09 | NSE:TCS-EQ | ₹ 2068.20 | Vol: 3
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:40:10 | BSE:COALINDIA-A | ₹ 429.60 | Vol: 2
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|CIPLA|1790754011|1364.3|1364.3|1364.3|1364.3|1
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:40:12 | BSE:COALINDIA-A | ₹ 429.50 | Vol: 13
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:40:13 | BSE:COALINDIA-A | ₹ 429.50 | Vol: 13
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|TCS|1790754013|2068.2|2068.2|2068.2|2068.2|1
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:40:14 | BSE:COALINDIA-A | ₹ 429.55 | Vol: 5
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790754016|429.55|429.55|429.55|429.55|5
[Live Tick] 2026-09-30 07:40:16 | BSE:COALINDIA-A | ₹ 429.55 | Vol: 5
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790754018|429.55|429.55|429.55|429.55|1
[Live Tick] 2026-09-30 07:40:18 | BSE:COALINDIA-A | ₹ 429.55 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:40:19 | NSE:TCS-EQ | ₹ 2068.10 | Vol: 26
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|TCS|1790754020|2068.2|2068.2|2068.2|2068.2|3
[Live Tick] 2026-09-30 07:40:20 | NSE:TCS-EQ | ₹ 2068.20 | Vol: 3
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:40:22 | NSE:TCS-EQ | ₹ 2068.10 | Vol: 4
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790754023|429.55|429.55|429.55|429.55|1
[Live Tick] 2026-09-30 07:40:23 | BSE:COALINDIA-A | ₹ 429.55 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:40:24 | BSE:COALINDIA-A | ₹ 429.55 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790754026|429.55|429.55|429.55|429.55|1
[Live Tick] 2026-09-30 07:40:26 | BSE:COALINDIA-A | ₹ 429.55 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:40:27 | NSE:TCS-EQ | ₹ 2068.30 | Vol: 4
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790754030|429.55|429.55|429.55|429.55|1
[Live Tick] 2026-09-30 07:40:30 | BSE:COALINDIA-A | ₹ 429.55 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:40:31 | NSE:CIPLA-EQ | ₹ 1364.30 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790754032|429.55|429.55|429.55|429.55|1
[Live Tick] 2026-09-30 07:40:32 | BSE:COALINDIA-A | ₹ 429.55 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:40:33 | BSE:COALINDIA-A | ₹ 429.55 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790754034|429.5|429.55|429.5|429.55|116
[Live Tick] 2026-09-30 07:40:34 | BSE:COALINDIA-A | ₹ 429.55 | Vol: 100
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:40:35 | NSE:TCS-EQ | ₹ 2068.30 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|CIPLA|1790754037|1364.3|1364.3|1364.3|1364.3|1
[Live Tick] 2026-09-30 07:40:37 | NSE:CIPLA-EQ | ₹ 1364.30 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[System Status] Total Symbols Active: 3 | Receiving Live Ticks: 3
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:40:38 | NSE:TCS-EQ | ₹ 2068.40 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790754039|429.55|429.55|429.55|429.55|100
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:40:40 | BSE:COALINDIA-A | ₹ 429.55 | Vol: 100
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790754041|429.55|429.55|429.55|429.55|100
[Live Tick] 2026-09-30 07:40:41 | BSE:COALINDIA-A | ₹ 429.55 | Vol: 100
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:40:42 | NSE:CIPLA-EQ | ₹ 1364.30 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|TCS|1790754044|2068.6|2068.6|2068.6|2068.6|1
[Live Tick] 2026-09-30 07:40:44 | NSE:TCS-EQ | ₹ 2068.60 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:40:46 | NSE:CIPLA-EQ | ₹ 1364.30 | Vol: 3
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|CIPLA|1790754047|1364.3|1364.3|1364.3|1364.3|3
[Live Tick] 2026-09-30 07:40:47 | NSE:CIPLA-EQ | ₹ 1364.30 | Vol: 3
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:40:49 | NSE:TCS-EQ | ₹ 2068.60 | Vol: 3
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790754050|429.5|429.5|429.5|429.5|2
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:40:50 | NSE:CIPLA-EQ | ₹ 1364.30 | Vol: 2
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|CIPLA|1790754052|1364.3|1364.3|1364.3|1364.3|2
[Live Tick] 2026-09-30 07:40:52 | NSE:CIPLA-EQ | ₹ 1364.30 | Vol: 2
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:40:53 | NSE:TCS-EQ | ₹ 2068.40 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790754055|429.5|429.5|429.5|429.5|2
[Live Tick] 2026-09-30 07:40:55 | BSE:COALINDIA-A | ₹ 429.50 | Vol: 2
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:40:56 | NSE:TCS-EQ | ₹ 2068.60 | Vol: 8
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|CIPLA|1790754057|1364.3|1364.3|1364.3|1364.3|1
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:40:58 | NSE:TCS-EQ | ₹ 2068.40 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:40:59 | BSE:COALINDIA-A | ₹ 429.50 | Vol: 2
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|TCS|1790754059|2068.4|2068.4|2068.4|2068.4|7
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:41:00 | BSE:COALINDIA-A | ₹ 429.50 | Vol: 2
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:41:01 | NSE:TCS-EQ | ₹ 2068.70 | Vol: 5
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|CIPLA|1790754062|1364.4|1364.4|1364.4|1364.4|3
[Live Tick] 2026-09-30 07:41:02 | NSE:CIPLA-EQ | ₹ 1364.40 | Vol: 3
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:41:04 | BSE:COALINDIA-A | ₹ 429.55 | Vol: 22
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790754065|429.5|429.5|429.5|429.5|200
[Live Tick] 2026-09-30 07:41:05 | BSE:COALINDIA-A | ₹ 429.50 | Vol: 200
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:41:06 | BSE:COALINDIA-A | ₹ 429.50 | Vol: 200
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[System Status] Total Symbols Active: 3 | Receiving Live Ticks: 3
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|CIPLA|1790754067|1364.4|1364.4|1364.4|1364.4|1
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:41:08 | NSE:TCS-EQ | ₹ 2068.40 | Vol: 5
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:41:09 | BSE:COALINDIA-A | ₹ 429.45 | Vol: 5
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|TCS|1790754070|2068.3|2068.3|2068.3|2068.3|1
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:41:11 | BSE:COALINDIA-A | ₹ 429.45 | Vol: 5
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:41:12 | BSE:COALINDIA-A | ₹ 429.45 | Vol: 7
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790754073|429.45|429.45|429.45|429.45|7
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:41:13 | NSE:TCS-EQ | ₹ 2068.00 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:41:14 | BSE:COALINDIA-A | ₹ 429.40 | Vol: 53
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790754076|429.75|429.75|429.75|429.75|6
[Live Tick] 2026-09-30 07:41:16 | BSE:COALINDIA-A | ₹ 429.75 | Vol: 6
[DEBUG] [FeedSimulator] Batch write: 3 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790754078|429.75|429.75|429.75|429.75|6
[Live Tick] 2026-09-30 07:41:18 | BSE:COALINDIA-A | ₹ 429.75 | Vol: 6
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:41:19 | NSE:TCS-EQ | ₹ 2067.90 | Vol: 31
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790754080|429.75|429.75|429.75|429.75|6
[Live Tick] 2026-09-30 07:41:20 | BSE:COALINDIA-A | ₹ 429.75 | Vol: 6
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:41:22 | NSE:TCS-EQ | ₹ 2068.00 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 3 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|CIPLA|1790754083|1364.4|1364.4|1364.4|1364.4|1
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:41:23 | BSE:COALINDIA-A | ₹ 429.75 | Vol: 6
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:41:24 | BSE:COALINDIA-A | ₹ 429.40 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|CIPLA|1790754085|1364.4|1364.4|1364.4|1364.4|11
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:41:26 | BSE:COALINDIA-A | ₹ 429.35 | Vol: 4
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790754087|429.35|429.35|429.35|429.35|4
[Live Tick] 2026-09-30 07:41:27 | BSE:COALINDIA-A | ₹ 429.35 | Vol: 4
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|TCS|1790754090|2068.3|2068.3|2068.3|2068.3|3
[Live Tick] 2026-09-30 07:41:30 | NSE:TCS-EQ | ₹ 2068.30 | Vol: 3
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:41:31 | BSE:COALINDIA-A | ₹ 429.60 | Vol: 14
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|TCS|1790754093|2068.3|2068.3|2068.3|2068.3|1
[Live Tick] 2026-09-30 07:41:33 | NSE:TCS-EQ | ₹ 2068.30 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:41:33 | NSE:CIPLA-EQ | ₹ 1364.30 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790754095|429.6|429.6|429.6|429.6|14
[Live Tick] 2026-09-30 07:41:35 | BSE:COALINDIA-A | ₹ 429.60 | Vol: 14
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:41:36 | NSE:TCS-EQ | ₹ 2068.00 | Vol: 3
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[System Status] Total Symbols Active: 3 | Receiving Live Ticks: 3
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790754097|429.4|429.4|429.4|429.4|4
[Live Tick] 2026-09-30 07:41:37 | BSE:COALINDIA-A | ₹ 429.40 | Vol: 4
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:41:39 | NSE:TCS-EQ | ₹ 2068.00 | Vol: 3
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790754100|429.4|429.4|429.4|429.4|4
[Live Tick] 2026-09-30 07:41:40 | BSE:COALINDIA-A | ₹ 429.40 | Vol: 4
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:41:41 | NSE:TCS-EQ | ₹ 2068.00 | Vol: 55
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|TCS|1790754102|2067.9|2067.9|2067.9|2067.9|13
[Live Tick] 2026-09-30 07:41:42 | NSE:TCS-EQ | ₹ 2067.90 | Vol: 13
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:41:43 | BSE:COALINDIA-A | ₹ 429.40 | Vol: 4
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|TCS|1790754104|2068|2068|2067.9|2067.9|2
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:41:45 | NSE:CIPLA-EQ | ₹ 1364.40 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:41:46 | NSE:TCS-EQ | ₹ 2068.20 | Vol: 5
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|TCS|1790754107|2068.2|2068.2|2068.2|2068.2|2
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:41:47 | NSE:CIPLA-EQ | ₹ 1364.40 | Vol: 2
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:41:48 | BSE:COALINDIA-A | ₹ 429.90 | Vol: 113
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|CIPLA|1790754109|1364.4|1364.4|1364.4|1364.4|2
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:41:50 | NSE:TCS-EQ | ₹ 2068.20 | Vol: 3
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|TCS|1790754111|2068.2|2068.2|2068.2|2068.2|3
[Live Tick] 2026-09-30 07:41:51 | NSE:TCS-EQ | ₹ 2068.20 | Vol: 3
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:41:52 | BSE:COALINDIA-A | ₹ 429.50 | Vol: 2
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|TCS|1790754113|2068.2|2068.2|2068.2|2068.2|3
[Live Tick] 2026-09-30 07:41:53 | NSE:TCS-EQ | ₹ 2068.20 | Vol: 3
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:41:55 | NSE:TCS-EQ | ₹ 2068.20 | Vol: 2
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|CIPLA|1790754116|1364.4|1364.4|1364.4|1364.4|11
[Live Tick] 2026-09-30 07:41:56 | NSE:CIPLA-EQ | ₹ 1364.40 | Vol: 11
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:41:58 | BSE:COALINDIA-A | ₹ 429.50 | Vol: 2
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|CIPLA|1790754119|1364.4|1364.4|1364.4|1364.4|11
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:42:00 | NSE:TCS-EQ | ₹ 2068.30 | Vol: 2
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|TCS|1790754121|2068.2|2068.2|2068.2|2068.2|1
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:42:01 | BSE:COALINDIA-A | ₹ 429.35 | Vol: 30
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:42:02 | BSE:COALINDIA-A | ₹ 429.35 | Vol: 30
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|TCS|1790754123|2067.9|2067.9|2067.9|2067.9|2
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:42:04 | NSE:TCS-EQ | ₹ 2067.90 | Vol: 2
[DEBUG] [FeedSimulator] Batch write: 3 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|TCS|1790754125|2068|2068|2068|2068|9
[Live Tick] 2026-09-30 07:42:05 | NSE:TCS-EQ | ₹ 2068.00 | Vol: 9
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:42:06 | BSE:COALINDIA-A | ₹ 429.35 | Vol: 86
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[System Status] Total Symbols Active: 3 | Receiving Live Ticks: 3
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|TCS|1790754128|2067.9|2067.9|2067.9|2067.9|3
[Live Tick] 2026-09-30 07:42:08 | NSE:TCS-EQ | ₹ 2067.90 | Vol: 3
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:42:09 | BSE:COALINDIA-A | ₹ 429.35 | Vol: 86
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790754130|429.35|429.35|429.35|429.35|86
[Live Tick] 2026-09-30 07:42:10 | BSE:COALINDIA-A | ₹ 429.35 | Vol: 86
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:42:11 | BSE:COALINDIA-A | ₹ 429.35 | Vol: 86
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|TCS|1790754132|2068|2068|2068|2068|1
[Live Tick] 2026-09-30 07:42:12 | NSE:TCS-EQ | ₹ 2068.00 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:42:14 | NSE:CIPLA-EQ | ₹ 1364.10 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|TCS|1790754135|2068.2|2068.2|2068.2|2068.2|10
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:42:15 | BSE:COALINDIA-A | ₹ 429.35 | Vol: 86
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:42:16 | BSE:COALINDIA-A | ₹ 429.35 | Vol: 86
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790754137|429.35|429.35|429.35|429.35|86
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:42:18 | NSE:TCS-EQ | ₹ 2068.00 | Vol: 5
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790754139|429.35|429.35|429.35|429.35|86
[Live Tick] 2026-09-30 07:42:19 | BSE:COALINDIA-A | ₹ 429.35 | Vol: 86
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:42:20 | BSE:COALINDIA-A | ₹ 429.35 | Vol: 86
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790754142|429.3|429.3|429.3|429.3|2
[Live Tick] 2026-09-30 07:42:22 | BSE:COALINDIA-A | ₹ 429.30 | Vol: 2
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:42:23 | NSE:TCS-EQ | ₹ 2067.80 | Vol: 14
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|TCS|1790754144|2067.9|2067.9|2067.8|2067.8|5
[Live Tick] 2026-09-30 07:42:24 | NSE:TCS-EQ | ₹ 2067.80 | Vol: 2
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:42:25 | BSE:COALINDIA-A | ₹ 429.30 | Vol: 2
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|TCS|1790754146|2067.9|2067.9|2067.9|2067.9|11
[Live Tick] 2026-09-30 07:42:26 | NSE:TCS-EQ | ₹ 2067.90 | Vol: 11
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:42:28 | NSE:TCS-EQ | ₹ 2067.70 | Vol: 12
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|TCS|1790754149|2067.8|2067.8|2067.8|2067.8|2
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:42:29 | BSE:COALINDIA-A | ₹ 429.30 | Vol: 2
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:42:30 | NSE:TCS-EQ | ₹ 2068.00 | Vol: 4
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|TCS|1790754151|2068|2068|2068|2068|4
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:42:32 | NSE:TCS-EQ | ₹ 2068.00 | Vol: 4
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:42:33 | NSE:CIPLA-EQ | ₹ 1364.00 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790754153|429.75|429.75|429.75|429.75|10
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:42:34 | NSE:CIPLA-EQ | ₹ 1364.10 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790754156|429.75|429.75|429.75|429.75|10
[Live Tick] 2026-09-30 07:42:36 | BSE:COALINDIA-A | ₹ 429.75 | Vol: 10
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:42:37 | BSE:COALINDIA-A | ₹ 429.75 | Vol: 10
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[System Status] Total Symbols Active: 3 | Receiving Live Ticks: 3
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|TCS|1790754158|2067.8|2067.8|2067.8|2067.8|1
[Live Tick] 2026-09-30 07:42:38 | NSE:TCS-EQ | ₹ 2067.80 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:42:39 | NSE:TCS-EQ | ₹ 2067.50 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|TCS|1790754160|2067.4|2067.4|2067.4|2067.4|1
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:42:41 | NSE:CIPLA-EQ | ₹ 1364.10 | Vol: 8
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:42:42 | BSE:COALINDIA-A | ₹ 429.75 | Vol: 10
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|TCS|1790754163|2068|2068|2068|2068|1
[Live Tick] 2026-09-30 07:42:43 | NSE:TCS-EQ | ₹ 2068.00 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:42:44 | NSE:TCS-EQ | ₹ 2068.00 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|TCS|1790754166|2068|2068|2068|2068|19
[Live Tick] 2026-09-30 07:42:46 | NSE:TCS-EQ | ₹ 2068.00 | Vol: 19
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:42:47 | BSE:COALINDIA-A | ₹ 429.75 | Vol: 10
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|CIPLA|1790754168|1364|1364|1364|1364|1
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:42:49 | NSE:TCS-EQ | ₹ 2067.50 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|TCS|1790754170|2067.7|2067.7|2067.7|2067.7|1
[Live Tick] 2026-09-30 07:42:50 | NSE:TCS-EQ | ₹ 2067.70 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:42:51 | BSE:COALINDIA-A | ₹ 429.75 | Vol: 10
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|TCS|1790754172|2067.9|2067.9|2067.9|2067.9|1
[Live Tick] 2026-09-30 07:42:52 | NSE:TCS-EQ | ₹ 2067.90 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:42:53 | BSE:COALINDIA-A | ₹ 429.75 | Vol: 10
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|TCS|1790754174|2068|2068|2067.9|2067.9|5
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:42:55 | BSE:COALINDIA-A | ₹ 429.75 | Vol: 10
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:42:56 | NSE:TCS-EQ | ₹ 2068.20 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|CIPLA|1790754177|1363.9|1363.9|1363.9|1363.9|5
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:42:57 | NSE:TCS-EQ | ₹ 2068.20 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:42:58 | NSE:TCS-EQ | ₹ 2068.50 | Vol: 1
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|TCS|1790754179|2068.4|2068.4|2068.4|2068.4|17
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:42:59 | BSE:COALINDIA-A | ₹ 429.75 | Vol: 10
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|TCS|1790754181|2068.9|2068.9|2068.9|2068.9|3
[Live Tick] 2026-09-30 07:43:01 | NSE:TCS-EQ | ₹ 2068.90 | Vol: 3
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:43:02 | NSE:TCS-EQ | ₹ 2068.90 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|TCS|1790754183|2068.9|2068.9|2068.9|2068.9|1
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:43:04 | BSE:COALINDIA-A | ₹ 429.75 | Vol: 10
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|TCS|1790754186|2068.6|2068.6|2068.6|2068.6|1
[Live Tick] 2026-09-30 07:43:06 | NSE:TCS-EQ | ₹ 2068.60 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[System Status] Total Symbols Active: 3 | Receiving Live Ticks: 3
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:43:07 | BSE:COALINDIA-A | ₹ 429.75 | Vol: 10
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790754189|429.75|429.75|429.75|429.75|10
[Live Tick] 2026-09-30 07:43:09 | BSE:COALINDIA-A | ₹ 429.75 | Vol: 10
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:43:10 | NSE:TCS-EQ | ₹ 2068.90 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790754191|429.45|429.45|429.45|429.45|1
[Live Tick] 2026-09-30 07:43:11 | BSE:COALINDIA-A | ₹ 429.45 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 3 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:43:13 | BSE:COALINDIA-A | ₹ 429.45 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790754194|429.45|429.45|429.45|429.45|1
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:43:14 | NSE:TCS-EQ | ₹ 2068.60 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:43:16 | NSE:CIPLA-EQ | ₹ 1363.80 | Vol: 4
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790754196|429.45|429.45|429.45|429.45|1
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:43:17 | BSE:COALINDIA-A | ₹ 429.45 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:43:18 | NSE:TCS-EQ | ₹ 2068.60 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|CIPLA|1790754199|1363.8|1363.8|1363.8|1363.8|1
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:43:20 | BSE:COALINDIA-A | ₹ 429.45 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|TCS|1790754201|2069|2069|2069|2069|5
[Live Tick] 2026-09-30 07:43:21 | NSE:TCS-EQ | ₹ 2069.00 | Vol: 5
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:43:22 | NSE:CIPLA-EQ | ₹ 1363.80 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|TCS|1790754203|2069|2069|2069|2069|5
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:43:24 | NSE:TCS-EQ | ₹ 2069.00 | Vol: 3
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:43:25 | NSE:TCS-EQ | ₹ 2068.50 | Vol: 14
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790754206|429.45|429.45|429.45|429.45|1
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:43:27 | NSE:TCS-EQ | ₹ 2068.90 | Vol: 4
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790754208|429.45|429.45|429.45|429.45|1
[Live Tick] 2026-09-30 07:43:28 | BSE:COALINDIA-A | ₹ 429.45 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:43:29 | NSE:TCS-EQ | ₹ 2068.90 | Vol: 3
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|TCS|1790754210|2068.9|2068.9|2068.9|2068.9|3
[Live Tick] 2026-09-30 07:43:30 | NSE:TCS-EQ | ₹ 2068.90 | Vol: 3
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:43:32 | NSE:TCS-EQ | ₹ 2068.60 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|CIPLA|1790754212|1363.8|1363.8|1363.8|1363.8|1
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:43:33 | BSE:COALINDIA-A | ₹ 429.45 | Vol: 31
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:43:34 | NSE:TCS-EQ | ₹ 2068.60 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|TCS|1790754214|2068.6|2068.9|2068.6|2068.9|2
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:43:35 | BSE:COALINDIA-A | ₹ 429.45 | Vol: 31
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790754217|429.45|429.45|429.45|429.45|27
[Live Tick] 2026-09-30 07:43:37 | BSE:COALINDIA-A | ₹ 429.45 | Vol: 27
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[System Status] Total Symbols Active: 3 | Receiving Live Ticks: 3
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:43:38 | BSE:COALINDIA-A | ₹ 429.35 | Vol: 24
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|TCS|1790754219|2068.8|2068.8|2068.6|2068.6|6
[Live Tick] 2026-09-30 07:43:39 | NSE:TCS-EQ | ₹ 2068.60 | Vol: 2
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:43:40 | BSE:COALINDIA-A | ₹ 429.35 | Vol: 24
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|TCS|1790754221|2068.8|2068.8|2068.8|2068.8|21
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:43:42 | NSE:TCS-EQ | ₹ 2068.80 | Vol: 15
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|TCS|1790754223|2068.8|2068.8|2068.8|2068.8|15
[Live Tick] 2026-09-30 07:43:43 | NSE:TCS-EQ | ₹ 2068.80 | Vol: 15
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:43:44 | BSE:COALINDIA-A | ₹ 429.35 | Vol: 24
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790754226|429.35|429.35|429.35|429.35|24
[Live Tick] 2026-09-30 07:43:46 | BSE:COALINDIA-A | ₹ 429.35 | Vol: 24
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:43:47 | NSE:TCS-EQ | ₹ 2068.80 | Vol: 9
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|TCS|1790754228|2068.8|2068.8|2068.8|2068.8|9
[Live Tick] 2026-09-30 07:43:48 | NSE:TCS-EQ | ₹ 2068.80 | Vol: 9
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:43:49 | NSE:TCS-EQ | ₹ 2068.70 | Vol: 3
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|TCS|1790754230|2068.7|2068.7|2068.7|2068.7|3
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:43:51 | BSE:COALINDIA-A | ₹ 429.35 | Vol: 24
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:43:52 | NSE:CIPLA-EQ | ₹ 1363.70 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|TCS|1790754233|2068.5|2068.5|2068.5|2068.5|14
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:43:53 | NSE:CIPLA-EQ | ₹ 1363.70 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|TCS|1790754235|2068.7|2068.7|2068.7|2068.7|21
[Live Tick] 2026-09-30 07:43:55 | NSE:TCS-EQ | ₹ 2068.70 | Vol: 21
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:43:56 | BSE:COALINDIA-A | ₹ 429.35 | Vol: 24
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|TCS|1790754237|2068.6|2068.6|2068.6|2068.6|1
[Live Tick] 2026-09-30 07:43:57 | NSE:TCS-EQ | ₹ 2068.60 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:43:58 | NSE:TCS-EQ | ₹ 2068.60 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|TCS|1790754239|2068.6|2068.6|2068.6|2068.6|1
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:43:59 | BSE:COALINDIA-A | ₹ 429.35 | Vol: 24
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:44:01 | NSE:TCS-EQ | ₹ 2068.60 | Vol: 3
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|TCS|1790754242|2068.7|2068.7|2068.7|2068.7|4
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:44:02 | NSE:TCS-EQ | ₹ 2068.60 | Vol: 2
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:44:03 | NSE:CIPLA-EQ | ₹ 1363.80 | Vol: 2
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|TCS|1790754244|2068.6|2068.6|2068.6|2068.6|4
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:44:05 | NSE:TCS-EQ | ₹ 2068.70 | Vol: 3
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|TCS|1790754246|2068.6|2068.6|2068.6|2068.6|2
[Live Tick] 2026-09-30 07:44:06 | NSE:TCS-EQ | ₹ 2068.60 | Vol: 2
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[System Status] Total Symbols Active: 3 | Receiving Live Ticks: 3
[Live Tick] 2026-09-30 07:44:07 | BSE:COALINDIA-A | ₹ 429.45 | Vol: 46
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|TCS|1790754248|2068.6|2068.7|2068.6|2068.7|3
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:44:09 | NSE:CIPLA-EQ | ₹ 1363.80 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:44:10 | NSE:TCS-EQ | ₹ 2068.70 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|TCS|1790754251|2068.7|2068.7|2068.7|2068.7|7
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:44:11 | BSE:COALINDIA-A | ₹ 429.45 | Vol: 46
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:44:12 | BSE:COALINDIA-A | ₹ 429.45 | Vol: 46
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|CIPLA|1790754253|1363.8|1363.8|1363.8|1363.8|10
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:44:14 | NSE:TCS-EQ | ₹ 2068.70 | Vol: 4
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|TCS|1790754255|2068.7|2068.7|2068.7|2068.7|20
[Live Tick] 2026-09-30 07:44:15 | NSE:TCS-EQ | ₹ 2068.70 | Vol: 20
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:44:16 | BSE:COALINDIA-A | ₹ 429.45 | Vol: 5
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|TCS|1790754257|2068|2068|2067.9|2067.9|9
[Live Tick] 2026-09-30 07:44:18 | NSE:TCS-EQ | ₹ 2067.90 | Vol: 4
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:44:19 | NSE:TCS-EQ | ₹ 2067.90 | Vol: 4
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790754259|429.45|429.45|429.45|429.45|5
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:44:20 | BSE:COALINDIA-A | ₹ 429.45 | Vol: 5
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790754261|429.45|429.45|429.45|429.45|5
[Live Tick] 2026-09-30 07:44:21 | BSE:COALINDIA-A | ₹ 429.45 | Vol: 5
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:44:23 | NSE:TCS-EQ | ₹ 2067.60 | Vol: 13
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|TCS|1790754264|2067.7|2067.7|2067.7|2067.7|3
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:44:24 | BSE:COALINDIA-A | ₹ 429.45 | Vol: 5
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:44:25 | NSE:TCS-EQ | ₹ 2067.70 | Vol: 20
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|TCS|1790754265|2067.7|2067.9|2067.7|2067.9|26
[Live Tick] 2026-09-30 07:44:26 | NSE:TCS-EQ | ₹ 2067.90 | Vol: 6
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|CIPLA|1790754268|1363.8|1363.8|1363.8|1363.8|13
[Live Tick] 2026-09-30 07:44:28 | NSE:CIPLA-EQ | ₹ 1363.80 | Vol: 13
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:44:30 | NSE:CIPLA-EQ | ₹ 1363.90 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|TCS|1790754270|2067.9|2067.9|2067.9|2067.9|3
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:44:31 | NSE:CIPLA-EQ | ₹ 1364.10 | Vol: 8
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:44:32 | BSE:COALINDIA-A | ₹ 429.90 | Vol: 9
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|TCS|1790754272|2067.9|2067.9|2067.9|2067.9|1
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:44:33 | NSE:TCS-EQ | ₹ 2067.90 | Vol: 4
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|TCS|1790754274|2067.9|2067.9|2067.9|2067.9|5
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:44:34 | BSE:COALINDIA-A | ₹ 429.90 | Vol: 9
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:44:36 | BSE:COALINDIA-A | ₹ 429.90 | Vol: 9
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|TCS|1790754277|2067.8|2067.8|2067.8|2067.8|1
[Live Tick] 2026-09-30 07:44:37 | NSE:TCS-EQ | ₹ 2067.80 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[System Status] Total Symbols Active: 3 | Receiving Live Ticks: 3
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790754279|429.9|429.9|429.9|429.9|9
[Live Tick] 2026-09-30 07:44:39 | BSE:COALINDIA-A | ₹ 429.90 | Vol: 9
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:44:41 | NSE:TCS-EQ | ₹ 2067.80 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790754283|429.45|429.45|429.45|429.45|1
[Live Tick] 2026-09-30 07:44:43 | BSE:COALINDIA-A | ₹ 429.45 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 3 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:44:45 | NSE:CIPLA-EQ | ₹ 1364.20 | Vol: 9
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790754285|429.45|429.45|429.45|429.45|1
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:44:46 | BSE:COALINDIA-A | ₹ 429.45 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:44:47 | BSE:COALINDIA-A | ₹ 429.65 | Vol: 9
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790754288|429.65|429.65|429.65|429.65|9
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:44:49 | NSE:TCS-EQ | ₹ 2067.90 | Vol: 7
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:44:50 | BSE:COALINDIA-A | ₹ 429.65 | Vol: 9
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790754290|429.65|429.65|429.5|429.5|38
[Live Tick] 2026-09-30 07:44:51 | NSE:CIPLA-EQ | ₹ 1364.20 | Vol: 2
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:44:52 | BSE:COALINDIA-A | ₹ 429.50 | Vol: 29
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790754293|429.5|429.5|429.5|429.5|29
[Live Tick] 2026-09-30 07:44:53 | BSE:COALINDIA-A | ₹ 429.50 | Vol: 29
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:44:54 | BSE:COALINDIA-A | ₹ 429.50 | Vol: 29
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790754296|429.5|429.5|429.5|429.5|29
[Live Tick] 2026-09-30 07:44:56 | BSE:COALINDIA-A | ₹ 429.50 | Vol: 29
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:44:57 | NSE:CIPLA-EQ | ₹ 1364.20 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790754299|429.5|429.5|429.5|429.5|29
[Live Tick] 2026-09-30 07:44:59 | BSE:COALINDIA-A | ₹ 429.50 | Vol: 29
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:45:01 | NSE:CIPLA-EQ | ₹ 1364.20 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|TCS|1790754301|2067.6|2067.7|2067.6|2067.7|33
[Live Tick] 2026-09-30 07:45:03 | NSE:TCS-EQ | ₹ 2067.60 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|CIPLA|1790754305|1364.2|1364.2|1364.2|1364.2|11
[Live Tick] 2026-09-30 07:45:05 | NSE:CIPLA-EQ | ₹ 1364.20 | Vol: 11
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:45:06 | BSE:COALINDIA-A | ₹ 429.95 | Vol: 217
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|TCS|1790754307|2067.7|2067.7|2067.7|2067.7|3
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[System Status] Total Symbols Active: 3 | Receiving Live Ticks: 3
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:45:08 | BSE:COALINDIA-A | ₹ 429.95 | Vol: 217
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|TCS|1790754309|2067.7|2067.7|2067.7|2067.7|4
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:45:10 | BSE:COALINDIA-A | ₹ 429.95 | Vol: 217
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|TCS|1790754311|2067.7|2067.7|2067.7|2067.7|12
[Live Tick] 2026-09-30 07:45:11 | NSE:TCS-EQ | ₹ 2067.70 | Vol: 12
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:45:12 | NSE:TCS-EQ | ₹ 2068.00 | Vol: 5
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790754314|429.95|429.95|429.95|429.95|217
[Live Tick] 2026-09-30 07:45:14 | BSE:COALINDIA-A | ₹ 429.95 | Vol: 217
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:45:16 | NSE:CIPLA-EQ | ₹ 1364.20 | Vol: 11
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790754316|429.95|429.95|429.95|429.95|217
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:45:17 | NSE:TCS-EQ | ₹ 2068.00 | Vol: 20
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790754318|429.95|429.95|429.95|429.95|217
[Live Tick] 2026-09-30 07:45:18 | BSE:COALINDIA-A | ₹ 429.95 | Vol: 217
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:45:20 | BSE:COALINDIA-A | ₹ 429.65 | Vol: 7
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790754321|429.65|429.65|429.65|429.65|7
[Live Tick] 2026-09-30 07:45:21 | BSE:COALINDIA-A | ₹ 429.65 | Vol: 7
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:45:22 | BSE:COALINDIA-A | ₹ 429.65 | Vol: 7
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|TCS|1790754325|2067.9|2067.9|2067.9|2067.9|20
[Live Tick] 2026-09-30 07:45:25 | NSE:TCS-EQ | ₹ 2067.90 | Vol: 20
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:45:26 | NSE:CIPLA-EQ | ₹ 1364.30 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|CIPLA|1790754327|1364.3|1364.3|1364.3|1364.3|1
[Live Tick] 2026-09-30 07:45:27 | NSE:CIPLA-EQ | ₹ 1364.30 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:45:29 | BSE:COALINDIA-A | ₹ 429.65 | Vol: 7
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|TCS|1790754330|2067.9|2067.9|2067.9|2067.9|27
[Live Tick] 2026-09-30 07:45:30 | NSE:TCS-EQ | ₹ 2067.90 | Vol: 27
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:45:31 | NSE:TCS-EQ | ₹ 2067.80 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|CIPLA|1790754333|1363.8|1363.8|1363.8|1363.8|92
[Live Tick] 2026-09-30 07:45:33 | NSE:CIPLA-EQ | ₹ 1363.80 | Vol: 92
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:45:34 | NSE:TCS-EQ | ₹ 2067.80 | Vol: 6
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|CIPLA|1790754335|1363.9|1363.9|1363.9|1363.9|1
[Live Tick] 2026-09-30 07:45:35 | NSE:CIPLA-EQ | ₹ 1363.90 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:45:36 | NSE:CIPLA-EQ | ₹ 1363.90 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[System Status] Total Symbols Active: 3 | Receiving Live Ticks: 3
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790754338|429.65|429.65|429.65|429.65|300
[Live Tick] 2026-09-30 07:45:38 | BSE:COALINDIA-A | ₹ 429.65 | Vol: 300
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:45:39 | BSE:COALINDIA-A | ₹ 429.65 | Vol: 300
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790754340|429.65|429.65|429.65|429.65|300
[Live Tick] 2026-09-30 07:45:40 | BSE:COALINDIA-A | ₹ 429.65 | Vol: 300
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:45:41 | NSE:CIPLA-EQ | ₹ 1364.00 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 3 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790754343|429.65|429.65|429.65|429.65|300
[Live Tick] 2026-09-30 07:45:43 | BSE:COALINDIA-A | ₹ 429.65 | Vol: 300
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:45:44 | NSE:CIPLA-EQ | ₹ 1364.00 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|CIPLA|1790754346|1364.2|1364.2|1364.2|1364.2|11
[Live Tick] 2026-09-30 07:45:46 | NSE:CIPLA-EQ | ₹ 1364.20 | Vol: 11
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:45:48 | NSE:TCS-EQ | ₹ 2068.50 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|CIPLA|1790754348|1364.2|1364.2|1364.2|1364.2|11
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:45:49 | BSE:COALINDIA-A | ₹ 429.70 | Vol: 12
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:45:50 | NSE:CIPLA-EQ | ₹ 1364.20 | Vol: 11
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790754351|429.7|429.7|429.7|429.7|12
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:45:51 | NSE:CIPLA-EQ | ₹ 1364.20 | Vol: 11
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|CIPLA|1790754353|1364.2|1364.2|1364.2|1364.2|11
[Live Tick] 2026-09-30 07:45:53 | NSE:CIPLA-EQ | ₹ 1364.20 | Vol: 11
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:45:54 | NSE:TCS-EQ | ₹ 2069.10 | Vol: 3
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|CIPLA|1790754355|1364.2|1364.2|1364.2|1364.2|5
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:45:55 | BSE:COALINDIA-A | ₹ 429.70 | Vol: 12
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:45:57 | NSE:CIPLA-EQ | ₹ 1364.20 | Vol: 5
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|CIPLA|1790754358|1364.2|1364.2|1364.2|1364.2|5
[Live Tick] 2026-09-30 07:45:58 | NSE:CIPLA-EQ | ₹ 1364.20 | Vol: 5
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:45:59 | NSE:CIPLA-EQ | ₹ 1364.20 | Vol: 5
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|CIPLA|1790754360|1364.3|1364.3|1364.3|1364.3|11
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:46:01 | NSE:CIPLA-EQ | ₹ 1364.00 | Vol: 6
[DEBUG] [FeedSimulator] Batch write: 3 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:46:02 | BSE:COALINDIA-A | ₹ 430.05 | Vol: 168
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|CIPLA|1790754362|1363.7|1363.7|1363.7|1363.7|1
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:46:03 | NSE:CIPLA-EQ | ₹ 1363.70 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790754364|430.05|430.05|430.05|430.05|168
[Live Tick] 2026-09-30 07:46:04 | BSE:COALINDIA-A | ₹ 430.05 | Vol: 168
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:46:06 | BSE:COALINDIA-A | ₹ 430.05 | Vol: 168
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790754367|430.05|430.05|430.05|430.05|168
[Live Tick] 2026-09-30 07:46:07 | BSE:COALINDIA-A | ₹ 430.05 | Vol: 168
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[System Status] Total Symbols Active: 3 | Receiving Live Ticks: 3
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:46:08 | BSE:COALINDIA-A | ₹ 430.05 | Vol: 168
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|TCS|1790754369|2068.7|2068.7|2068.5|2068.5|6
[Live Tick] 2026-09-30 07:46:09 | BSE:COALINDIA-A | ₹ 430.05 | Vol: 168
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:46:11 | NSE:CIPLA-EQ | ₹ 1364.00 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|TCS|1790754372|2068.7|2068.7|2068.7|2068.7|4
[Live Tick] 2026-09-30 07:46:12 | NSE:TCS-EQ | ₹ 2068.70 | Vol: 4
[DEBUG] [FeedSimulator] Batch write: 3 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:46:13 | NSE:TCS-EQ | ₹ 2068.70 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|CIPLA|1790754375|1364|1364|1364|1364|2
[Live Tick] 2026-09-30 07:46:15 | NSE:CIPLA-EQ | ₹ 1364.00 | Vol: 2
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:46:16 | BSE:COALINDIA-A | ₹ 429.55 | Vol: 22
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|CIPLA|1790754377|1364|1364|1364|1364|2
[Live Tick] 2026-09-30 07:46:17 | NSE:CIPLA-EQ | ₹ 1364.00 | Vol: 2
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:46:18 | BSE:COALINDIA-A | ₹ 429.55 | Vol: 22
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|TCS|1790754379|2068.6|2068.6|2068.6|2068.6|12
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:46:20 | NSE:CIPLA-EQ | ₹ 1364.10 | Vol: 16
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:46:21 | BSE:COALINDIA-A | ₹ 429.60 | Vol: 2
[DEBUG] [FeedSimulator] Batch write: 3 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|CIPLA|1790754382|1364.1|1364.1|1364.1|1364.1|16
[Live Tick] 2026-09-30 07:46:22 | NSE:CIPLA-EQ | ₹ 1364.10 | Vol: 16
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:46:24 | BSE:COALINDIA-A | ₹ 429.60 | Vol: 2
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|TCS|1790754384|2068.6|2068.6|2068.6|2068.6|1
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:46:25 | NSE:TCS-EQ | ₹ 2068.70 | Vol: 63
[DEBUG] [FeedSimulator] Batch write: 3 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|CIPLA|1790754386|1364|1364|1364|1364|1
[Live Tick] 2026-09-30 07:46:26 | NSE:CIPLA-EQ | ₹ 1364.00 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:46:27 | BSE:COALINDIA-A | ₹ 429.60 | Vol: 2
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790754389|429.6|429.6|429.6|429.6|2
[Live Tick] 2026-09-30 07:46:29 | BSE:COALINDIA-A | ₹ 429.60 | Vol: 2
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:46:30 | NSE:CIPLA-EQ | ₹ 1364.00 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790754391|429.6|429.6|429.6|429.6|2
[Live Tick] 2026-09-30 07:46:31 | BSE:COALINDIA-A | ₹ 429.60 | Vol: 2
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:46:32 | NSE:CIPLA-EQ | ₹ 1364.00 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|TCS|1790754394|2068|2068|2068|2068|1
[Live Tick] 2026-09-30 07:46:34 | NSE:TCS-EQ | ₹ 2068.00 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:46:35 | BSE:COALINDIA-A | ₹ 429.60 | Vol: 2
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790754397|429.6|429.6|429.6|429.6|2
[Live Tick] 2026-09-30 07:46:37 | BSE:COALINDIA-A | ₹ 429.60 | Vol: 2
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[System Status] Total Symbols Active: 3 | Receiving Live Ticks: 3
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:46:38 | BSE:COALINDIA-A | ₹ 429.60 | Vol: 2
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790754399|429.6|429.6|429.6|429.6|2
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:46:40 | BSE:COALINDIA-A | ₹ 429.60 | Vol: 2
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|CIPLA|1790754401|1363.7|1363.7|1363.7|1363.7|1
[Live Tick] 2026-09-30 07:46:41 | NSE:CIPLA-EQ | ₹ 1363.70 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:46:42 | BSE:COALINDIA-A | ₹ 429.60 | Vol: 2
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|CIPLA|1790754404|1363.7|1363.7|1363.7|1363.7|1
[Live Tick] 2026-09-30 07:46:44 | NSE:CIPLA-EQ | ₹ 1363.70 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:46:45 | BSE:COALINDIA-A | ₹ 429.50 | Vol: 13
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790754406|429.95|429.95|429.95|429.95|150
[Live Tick] 2026-09-30 07:46:46 | BSE:COALINDIA-A | ₹ 429.95 | Vol: 150
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:46:48 | BSE:COALINDIA-A | ₹ 429.95 | Vol: 150
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790754409|429.95|429.95|429.95|429.95|150
[Live Tick] 2026-09-30 07:46:49 | BSE:COALINDIA-A | ₹ 429.95 | Vol: 150
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:46:51 | BSE:COALINDIA-A | ₹ 429.95 | Vol: 150
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790754412|429.95|429.95|429.95|429.95|150
[Live Tick] 2026-09-30 07:46:52 | BSE:COALINDIA-A | ₹ 429.95 | Vol: 150
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:46:54 | NSE:CIPLA-EQ | ₹ 1363.70 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|TCS|1790754414|2068.5|2068.5|2068.4|2068.4|4
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:46:56 | BSE:COALINDIA-A | ₹ 429.95 | Vol: 150
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|CIPLA|1790754417|1364.1|1364.1|1364.1|1364.1|7
[Live Tick] 2026-09-30 07:46:57 | NSE:CIPLA-EQ | ₹ 1364.10 | Vol: 7
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:46:58 | BSE:COALINDIA-A | ₹ 429.95 | Vol: 150
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790754419|429.95|429.95|429.95|429.95|150
[Live Tick] 2026-09-30 07:46:59 | BSE:COALINDIA-A | ₹ 429.95 | Vol: 150
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:47:00 | BSE:COALINDIA-A | ₹ 429.95 | Vol: 150
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790754422|429.55|429.55|429.55|429.55|59
[Live Tick] 2026-09-30 07:47:02 | BSE:COALINDIA-A | ₹ 429.55 | Vol: 59
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:47:03 | BSE:COALINDIA-A | ₹ 429.55 | Vol: 59
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790754424|429.55|429.55|429.55|429.55|59
[Live Tick] 2026-09-30 07:47:04 | BSE:COALINDIA-A | ₹ 429.55 | Vol: 59
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:47:06 | BSE:COALINDIA-A | ₹ 429.55 | Vol: 59
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[System Status] Total Symbols Active: 3 | Receiving Live Ticks: 3
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790754427|429.45|429.45|429.45|429.45|131
[Live Tick] 2026-09-30 07:47:07 | BSE:COALINDIA-A | ₹ 429.45 | Vol: 131
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:47:08 | BSE:COALINDIA-A | ₹ 429.45 | Vol: 131
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790754429|429.45|429.45|429.45|429.45|131
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:47:09 | NSE:CIPLA-EQ | ₹ 1364.10 | Vol: 2
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:47:11 | NSE:CIPLA-EQ | ₹ 1364.10 | Vol: 6
[DEBUG] [FeedSimulator] Batch write: 3 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790754432|429.3|429.3|429.3|429.3|337
[Live Tick] 2026-09-30 07:47:12 | BSE:COALINDIA-A | ₹ 429.30 | Vol: 337
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:47:14 | NSE:TCS-EQ | ₹ 2069.30 | Vol: 37
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790754434|429.3|429.3|429.3|429.3|337
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:47:15 | BSE:COALINDIA-A | ₹ 429.30 | Vol: 337
[DEBUG] [FeedSimulator] Batch write: 3 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:47:16 | BSE:COALINDIA-A | ₹ 429.60 | Vol: 103
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|TCS|1790754437|2069|2069|2069|2069|24
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:47:17 | BSE:COALINDIA-A | ₹ 429.10 | Vol: 72
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790754439|429.1|429.1|429.1|429.1|72
[Live Tick] 2026-09-30 07:47:19 | BSE:COALINDIA-A | ₹ 429.10 | Vol: 72
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:47:21 | BSE:COALINDIA-A | ₹ 429.10 | Vol: 72
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790754442|429.15|429.15|429.15|429.15|289
[Live Tick] 2026-09-30 07:47:22 | BSE:COALINDIA-A | ₹ 429.15 | Vol: 289
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:47:23 | BSE:COALINDIA-A | ₹ 429.15 | Vol: 289
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790754444|429.15|429.15|429.05|429.05|303
[Live Tick] 2026-09-30 07:47:24 | BSE:COALINDIA-A | ₹ 429.05 | Vol: 14
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:47:26 | BSE:COALINDIA-A | ₹ 429.00 | Vol: 751
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|TCS|1790754447|2069.1|2069.1|2069.1|2069.1|1
[Live Tick] 2026-09-30 07:47:27 | NSE:TCS-EQ | ₹ 2069.10 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:47:28 | BSE:COALINDIA-A | ₹ 428.90 | Vol: 10
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790754450|428.9|428.9|428.9|428.9|10
[Live Tick] 2026-09-30 07:47:30 | BSE:COALINDIA-A | ₹ 428.90 | Vol: 10
[DEBUG] [FeedSimulator] Batch write: 3 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:47:31 | BSE:COALINDIA-A | ₹ 429.25 | Vol: 73
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790754452|429|429|429|429|4
[Live Tick] 2026-09-30 07:47:32 | BSE:COALINDIA-A | ₹ 429.00 | Vol: 4
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:47:34 | NSE:CIPLA-EQ | ₹ 1364.20 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|CIPLA|1790754455|1364.2|1364.2|1364.2|1364.2|2
[Live Tick] 2026-09-30 07:47:35 | BSE:COALINDIA-A | ₹ 429.00 | Vol: 37
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:47:36 | NSE:CIPLA-EQ | ₹ 1364.30 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[System Status] Total Symbols Active: 3 | Receiving Live Ticks: 3
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|CIPLA|1790754457|1364.3|1364.3|1364.3|1364.3|1
[Live Tick] 2026-09-30 07:47:37 | NSE:CIPLA-EQ | ₹ 1364.30 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:47:39 | BSE:COALINDIA-A | ₹ 429.00 | Vol: 37
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|CIPLA|1790754460|1364.3|1364.3|1364.3|1364.3|5
[DEBUG] [FeedSimulator] Batch write: 3 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:47:41 | NSE:CIPLA-EQ | ₹ 1364.30 | Vol: 5
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|CIPLA|1790754462|1364.3|1364.3|1364.3|1364.3|5
[Live Tick] 2026-09-30 07:47:42 | NSE:CIPLA-EQ | ₹ 1364.30 | Vol: 5
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:47:43 | NSE:CIPLA-EQ | ₹ 1364.20 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|CIPLA|1790754465|1364.3|1364.3|1364.3|1364.3|11
[Live Tick] 2026-09-30 07:47:45 | NSE:CIPLA-EQ | ₹ 1364.30 | Vol: 11
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:47:46 | NSE:CIPLA-EQ | ₹ 1364.30 | Vol: 11
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|TCS|1790754467|2069.1|2069.1|2069.1|2069.1|19
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:47:47 | NSE:CIPLA-EQ | ₹ 1364.30 | Vol: 11
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:47:49 | BSE:COALINDIA-A | ₹ 429.00 | Vol: 631
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|CIPLA|1790754469|1364.3|1364.3|1364.3|1364.3|1
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:47:50 | NSE:CIPLA-EQ | ₹ 1364.30 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|TCS|1790754471|2069|2069|2069|2069|3
[Live Tick] 2026-09-30 07:47:51 | NSE:TCS-EQ | ₹ 2069.00 | Vol: 3
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:47:52 | NSE:CIPLA-EQ | ₹ 1364.30 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 3 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|TCS|1790754474|2068.9|2068.9|2068.9|2068.9|3
[Live Tick] 2026-09-30 07:47:54 | NSE:TCS-EQ | ₹ 2068.90 | Vol: 3
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:47:55 | BSE:COALINDIA-A | ₹ 429.05 | Vol: 49
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|CIPLA|1790754476|1364.3|1364.3|1364.3|1364.3|8
[Live Tick] 2026-09-30 07:47:56 | NSE:CIPLA-EQ | ₹ 1364.30 | Vol: 8
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:47:57 | NSE:CIPLA-EQ | ₹ 1364.30 | Vol: 8
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|CIPLA|1790754478|1364.3|1364.3|1364.3|1364.3|8
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:47:59 | BSE:COALINDIA-A | ₹ 429.05 | Vol: 49
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:48:00 | BSE:COALINDIA-A | ₹ 429.05 | Vol: 49
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|CIPLA|1790754480|1364.3|1364.3|1364.3|1364.3|1
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:48:01 | NSE:CIPLA-EQ | ₹ 1364.30 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790754483|429.2|429.2|429.2|429.2|3
[Live Tick] 2026-09-30 07:48:03 | BSE:COALINDIA-A | ₹ 429.20 | Vol: 3
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:48:04 | NSE:CIPLA-EQ | ₹ 1364.60 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790754486|429.2|429.2|429.2|429.2|3
[Live Tick] 2026-09-30 07:48:06 | BSE:COALINDIA-A | ₹ 429.20 | Vol: 3
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[System Status] Total Symbols Active: 3 | Receiving Live Ticks: 3
[Live Tick] 2026-09-30 07:48:07 | NSE:CIPLA-EQ | ₹ 1364.60 | Vol: 2
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790754488|429.05|429.05|429.05|429.05|75
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:48:09 | NSE:TCS-EQ | ₹ 2068.20 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|CIPLA|1790754490|1364.5|1364.5|1364.5|1364.5|1
[Live Tick] 2026-09-30 07:48:10 | NSE:CIPLA-EQ | ₹ 1364.50 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:48:12 | BSE:COALINDIA-A | ₹ 429.05 | Vol: 3
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|CIPLA|1790754492|1364.6|1364.6|1364.6|1364.6|2
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:48:13 | BSE:COALINDIA-A | ₹ 429.05 | Vol: 3
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|CIPLA|1790754494|1364.6|1364.6|1364.6|1364.6|2
[Live Tick] 2026-09-30 07:48:14 | NSE:CIPLA-EQ | ₹ 1364.60 | Vol: 2
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:48:16 | NSE:TCS-EQ | ₹ 2068.30 | Vol: 10
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790754497|429.5|429.5|429.5|429.5|40
[Live Tick] 2026-09-30 07:48:17 | BSE:COALINDIA-A | ₹ 429.50 | Vol: 40
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:48:18 | NSE:CIPLA-EQ | ₹ 1364.60 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|CIPLA|1790754499|1364.6|1364.6|1364.6|1364.6|1
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:48:20 | BSE:COALINDIA-A | ₹ 429.50 | Vol: 40
[DEBUG] [FeedSimulator] Batch write: 3 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:48:21 | NSE:TCS-EQ | ₹ 2068.20 | Vol: 7
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|CIPLA|1790754501|1364.4|1364.4|1364.4|1364.4|1
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:48:22 | BSE:COALINDIA-A | ₹ 429.50 | Vol: 40
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:48:23 | NSE:CIPLA-EQ | ₹ 1364.40 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 3 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|CIPLA|1790754504|1364.4|1364.4|1364.4|1364.4|1
[Live Tick] 2026-09-30 07:48:24 | NSE:CIPLA-EQ | ₹ 1364.40 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:48:26 | BSE:COALINDIA-A | ₹ 429.50 | Vol: 40
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790754507|429.5|429.5|429.5|429.5|40
[Live Tick] 2026-09-30 07:48:27 | BSE:COALINDIA-A | ₹ 429.50 | Vol: 40
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:48:28 | NSE:TCS-EQ | ₹ 2068.10 | Vol: 19
[DEBUG] [FeedSimulator] Batch write: 3 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|CIPLA|1790754509|1364.6|1364.6|1364|1364|98
[Live Tick] 2026-09-30 07:48:29 | NSE:CIPLA-EQ | ₹ 1364.00 | Vol: 97
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:48:31 | BSE:COALINDIA-A | ₹ 429.05 | Vol: 46
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|TCS|1790754512|2067.7|2067.7|2067.7|2067.7|1
[Live Tick] 2026-09-30 07:48:32 | NSE:TCS-EQ | ₹ 2067.70 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:48:33 | NSE:CIPLA-EQ | ₹ 1364.50 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|CIPLA|1790754514|1364.5|1364.5|1364.5|1364.5|1
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:48:35 | NSE:CIPLA-EQ | ₹ 1364.50 | Vol: 3
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|TCS|1790754516|2068.1|2068.1|2068.1|2068.1|15
[Live Tick] 2026-09-30 07:48:36 | NSE:TCS-EQ | ₹ 2068.10 | Vol: 15
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[System Status] Total Symbols Active: 3 | Receiving Live Ticks: 3
[Live Tick] 2026-09-30 07:48:37 | BSE:COALINDIA-A | ₹ 429.05 | Vol: 46
[DEBUG] [FeedSimulator] Batch write: 3 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790754519|429.05|429.05|429.05|429.05|46
[Live Tick] 2026-09-30 07:48:39 | BSE:COALINDIA-A | ₹ 429.05 | Vol: 46
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:48:40 | NSE:CIPLA-EQ | ₹ 1362.00 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790754521|429|429|429|429|70
[Live Tick] 2026-09-30 07:48:41 | BSE:COALINDIA-A | ₹ 429.00 | Vol: 70
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:48:42 | NSE:TCS-EQ | ₹ 2068.10 | Vol: 4
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|CIPLA|1790754523|1361.5|1361.5|1361.5|1361.5|1
[Live Tick] 2026-09-30 07:48:43 | NSE:CIPLA-EQ | ₹ 1361.50 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:48:45 | BSE:COALINDIA-A | ₹ 429.00 | Vol: 70
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|CIPLA|1790754526|1361.1|1361.1|1361.1|1361.1|1
[Live Tick] 2026-09-30 07:48:46 | NSE:CIPLA-EQ | ₹ 1361.10 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:48:47 | NSE:CIPLA-EQ | ₹ 1361.10 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|CIPLA|1790754528|1361.1|1361.1|1361.1|1361.1|1
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:48:49 | BSE:COALINDIA-A | ₹ 429.20 | Vol: 148
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:48:50 | NSE:CIPLA-EQ | ₹ 1360.90 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|TCS|1790754531|2068.2|2068.2|2068.2|2068.2|3
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:48:51 | NSE:CIPLA-EQ | ₹ 1360.90 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:48:52 | BSE:COALINDIA-A | ₹ 429.20 | Vol: 148
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|CIPLA|1790754533|1360.9|1360.9|1360.9|1360.9|1
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:48:54 | BSE:COALINDIA-A | ₹ 429.20 | Vol: 148
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:48:55 | NSE:CIPLA-EQ | ₹ 1361.50 | Vol: 11
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|CIPLA|1790754536|1361.5|1361.5|1361.5|1361.5|11
[Live Tick] 2026-09-30 07:48:56 | NSE:CIPLA-EQ | ₹ 1361.50 | Vol: 11
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:48:58 | NSE:CIPLA-EQ | ₹ 1361.40 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|TCS|1790754538|2068|2068|2068|2068|14
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:48:59 | BSE:COALINDIA-A | ₹ 429.20 | Vol: 148
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:49:00 | NSE:CIPLA-EQ | ₹ 1361.40 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|CIPLA|1790754540|1361.4|1361.5|1361.4|1361.5|2
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:49:01 | NSE:CIPLA-EQ | ₹ 1361.50 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790754543|429|429|429|429|330
[Live Tick] 2026-09-30 07:49:03 | BSE:COALINDIA-A | ₹ 429.00 | Vol: 330
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:49:04 | BSE:COALINDIA-A | ₹ 429.00 | Vol: 330
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|CIPLA|1790754545|1361.5|1361.5|1361.5|1361.5|1
[Live Tick] 2026-09-30 07:49:05 | NSE:CIPLA-EQ | ₹ 1361.50 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:49:06 | BSE:COALINDIA-A | ₹ 429.00 | Vol: 330
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|CIPLA|1790754547|1361.5|1361.5|1361.5|1361.5|7
[System Status] Total Symbols Active: 3 | Receiving Live Ticks: 3
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:49:08 | BSE:COALINDIA-A | ₹ 429.00 | Vol: 51
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:49:09 | NSE:TCS-EQ | ₹ 2068.00 | Vol: 3
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|TCS|1790754549|2068|2068|2067.8|2067.8|4
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:49:10 | BSE:COALINDIA-A | ₹ 429.20 | Vol: 25
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|CIPLA|1790754552|1361.6|1361.6|1361.6|1361.6|1
[Live Tick] 2026-09-30 07:49:12 | NSE:CIPLA-EQ | ₹ 1361.60 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:49:13 | NSE:CIPLA-EQ | ₹ 1361.50 | Vol: 124
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|TCS|1790754554|2068|2068|2068|2068|1
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:49:14 | BSE:COALINDIA-A | ₹ 429.20 | Vol: 25
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:49:15 | NSE:CIPLA-EQ | ₹ 1361.00 | Vol: 8
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|CIPLA|1790754556|1361.3|1361.3|1361.3|1361.3|10
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:49:17 | BSE:COALINDIA-A | ₹ 429.35 | Vol: 138
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:49:18 | NSE:TCS-EQ | ₹ 2067.90 | Vol: 3
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|CIPLA|1790754558|1361.3|1361.3|1361.3|1361.3|10
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:49:19 | BSE:COALINDIA-A | ₹ 429.35 | Vol: 138
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
{"ts":"2026-09-30T07:49:21.476Z","event":"ws_disconnected","clients":0}
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790754560|429.35|429.35|429.35|429.35|138
[Live Tick] 2026-09-30 07:49:20 | BSE:COALINDIA-A | ₹ 429.35 | Vol: 138
{"ts":"2026-09-30T07:49:21.587Z","method":"GET","path":"/api/settings","ip":"127.0.0.1"}
{"ts":"2026-09-30T07:49:21.590Z","method":"GET","path":"/api/brokers/fyers-edf11f90/master/status","ip":"127.0.0.1"}
{"ts":"2026-09-30T07:49:21.607Z","method":"GET","path":"/api/settings","ip":"127.0.0.1"}
{"ts":"2026-09-30T07:49:21.615Z","method":"GET","path":"/api/brokers","ip":"127.0.0.1"}
{"ts":"2026-09-30T07:49:21.624Z","method":"GET","path":"/api/status/feed","ip":"127.0.0.1"}
{"ts":"2026-09-30T07:49:21.636Z","method":"GET","path":"/api/logs","ip":"127.0.0.1"}
{"ts":"2026-09-30T07:49:21.649Z","method":"GET","path":"/api/backfill/status","ip":"127.0.0.1"}
{"ts":"2026-09-30T07:49:21.667Z","event":"ws_connected","clients":1}
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:49:22 | BSE:COALINDIA-A | ₹ 429.35 | Vol: 138
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|CIPLA|1790754563|1361|1361|1361|1361|1
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:49:24 | NSE:TCS-EQ | ₹ 2067.80 | Vol: 3
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|TCS|1790754565|2067.8|2067.8|2067.8|2067.8|18
[Live Tick] 2026-09-30 07:49:25 | NSE:TCS-EQ | ₹ 2067.80 | Vol: 18
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:49:26 | BSE:COALINDIA-A | ₹ 429.35 | Vol: 138
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|CIPLA|1790754567|1361.6|1361.6|1361.6|1361.6|5
[Live Tick] 2026-09-30 07:49:27 | NSE:CIPLA-EQ | ₹ 1361.60 | Vol: 5
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:49:29 | NSE:CIPLA-EQ | ₹ 1361.60 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790754570|429.35|429.35|429.35|429.35|138
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:49:31 | BSE:COALINDIA-A | ₹ 429.35 | Vol: 138
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790754572|429.3|429.3|429.3|429.3|256
[Live Tick] 2026-09-30 07:49:32 | BSE:COALINDIA-A | ₹ 429.30 | Vol: 256
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:49:33 | BSE:COALINDIA-A | ₹ 429.30 | Vol: 256
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|CIPLA|1790754574|1361|1361|1361|1361|6
[Live Tick] 2026-09-30 07:49:34 | NSE:CIPLA-EQ | ₹ 1361.00 | Vol: 6
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 3 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:49:36 | BSE:COALINDIA-A | ₹ 429.00 | Vol: 37
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|CIPLA|1790754576|1361.5|1361.5|1361.5|1361.5|11
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:49:37 | NSE:CIPLA-EQ | ₹ 1361.50 | Vol: 11
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[System Status] Total Symbols Active: 3 | Receiving Live Ticks: 3
[Live Tick] 2026-09-30 07:49:38 | NSE:CIPLA-EQ | ₹ 1361.50 | Vol: 11
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790754579|429|429|429|429|37
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:49:40 | NSE:TCS-EQ | ₹ 2067.70 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790754581|429|429|429|429|37
[Live Tick] 2026-09-30 07:49:41 | BSE:COALINDIA-A | ₹ 429.00 | Vol: 37
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:49:42 | BSE:COALINDIA-A | ₹ 429.00 | Vol: 37
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|CIPLA|1790754583|1361.8|1361.8|1361.8|1361.8|1
[Live Tick] 2026-09-30 07:49:43 | NSE:CIPLA-EQ | ₹ 1361.80 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:49:44 | NSE:CIPLA-EQ | ₹ 1361.80 | Vol: 4
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|TCS|1790754586|2067.7|2067.7|2067.7|2067.7|16
[Live Tick] 2026-09-30 07:49:46 | NSE:TCS-EQ | ₹ 2067.70 | Vol: 16
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:49:47 | BSE:COALINDIA-A | ₹ 429.00 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|CIPLA|1790754588|1361.8|1361.8|1361.8|1361.8|5
[Live Tick] 2026-09-30 07:49:48 | NSE:CIPLA-EQ | ₹ 1361.80 | Vol: 5
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:49:50 | BSE:COALINDIA-A | ₹ 429.00 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|CIPLA|1790754590|1361.8|1361.8|1361.8|1361.8|5
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:49:51 | NSE:TCS-EQ | ₹ 2067.60 | Vol: 3
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:49:52 | BSE:COALINDIA-A | ₹ 429.00 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|TCS|1790754593|2067.6|2067.6|2067.6|2067.6|3
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:49:53 | NSE:CIPLA-EQ | ₹ 1361.80 | Vol: 5
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:49:55 | NSE:TCS-EQ | ₹ 2067.60 | Vol: 15
[DEBUG] [FeedSimulator] Batch write: 3 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|TCS|1790754596|2067.6|2067.6|2067.6|2067.6|57
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:49:56 | BSE:COALINDIA-A | ₹ 429.00 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:49:57 | BSE:COALINDIA-A | ₹ 429.00 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|TCS|1790754598|2066.9|2066.9|2066.9|2066.9|7
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:49:58 | NSE:TCS-EQ | ₹ 2067.40 | Vol: 25
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790754600|429.15|429.15|429.15|429.15|28
[Live Tick] 2026-09-30 07:50:00 | BSE:COALINDIA-A | ₹ 429.15 | Vol: 28
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:50:01 | NSE:CIPLA-EQ | ₹ 1361.70 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|CIPLA|1790754602|1361.3|1361.3|1361.3|1361.3|2
[Live Tick] 2026-09-30 07:50:02 | NSE:CIPLA-EQ | ₹ 1361.30 | Vol: 2
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:50:04 | BSE:COALINDIA-A | ₹ 429.75 | Vol: 269
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|TCS|1790754605|2068|2068|2068|2068|10
[Live Tick] 2026-09-30 07:50:05 | NSE:TCS-EQ | ₹ 2068.00 | Vol: 10
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:50:06 | NSE:CIPLA-EQ | ₹ 1361.80 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|CIPLA|1790754607|1361.8|1361.8|1361.8|1361.8|1
[System Status] Total Symbols Active: 3 | Receiving Live Ticks: 3
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:50:08 | BSE:COALINDIA-A | ₹ 429.40 | Vol: 147
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|CIPLA|1790754609|1361.8|1361.8|1361.8|1361.8|1
[Live Tick] 2026-09-30 07:50:09 | NSE:CIPLA-EQ | ₹ 1361.80 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:50:10 | BSE:COALINDIA-A | ₹ 429.40 | Vol: 147
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|CIPLA|1790754611|1362.1|1362.1|1362.1|1362.1|5
[Live Tick] 2026-09-30 07:50:11 | NSE:CIPLA-EQ | ₹ 1362.10 | Vol: 5
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:50:13 | BSE:COALINDIA-A | ₹ 429.40 | Vol: 147
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|CIPLA|1790754614|1362.5|1362.5|1362.5|1362.5|1
[Live Tick] 2026-09-30 07:50:14 | NSE:CIPLA-EQ | ₹ 1362.50 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:50:15 | BSE:COALINDIA-A | ₹ 429.40 | Vol: 147
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|CIPLA|1790754616|1362.5|1362.5|1362.5|1362.5|11
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:50:16 | BSE:COALINDIA-A | ₹ 429.95 | Vol: 156
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:50:18 | BSE:COALINDIA-A | ₹ 429.95 | Vol: 156
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|CIPLA|1790754618|1362.5|1362.5|1362.3|1362.3|12
[Live Tick] 2026-09-30 07:50:19 | NSE:TCS-EQ | ₹ 2068.50 | Vol: 7
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:50:20 | NSE:CIPLA-EQ | ₹ 1362.30 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790754620|429.75|429.75|429.75|429.75|3
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 3 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:50:21 | BSE:COALINDIA-A | ₹ 429.50 | Vol: 328
[DEBUG] [FeedSimulator] Batch write: 3 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790754623|429.5|429.5|429.5|429.5|328
[Live Tick] 2026-09-30 07:50:23 | BSE:COALINDIA-A | ₹ 429.50 | Vol: 328
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:50:24 | NSE:CIPLA-EQ | ₹ 1362.50 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790754626|429.5|429.5|429.5|429.5|328
[Live Tick] 2026-09-30 07:50:26 | BSE:COALINDIA-A | ₹ 429.50 | Vol: 328
[DEBUG] [FeedSimulator] Batch write: 3 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:50:27 | NSE:CIPLA-EQ | ₹ 1362.50 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790754628|429.1|429.1|429.1|429.1|26
[Live Tick] 2026-09-30 07:50:28 | BSE:COALINDIA-A | ₹ 429.10 | Vol: 26
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:50:29 | NSE:CIPLA-EQ | ₹ 1362.50 | Vol: 18
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790754630|429.1|429.1|429.1|429.1|26
[Live Tick] 2026-09-30 07:50:30 | BSE:COALINDIA-A | ₹ 429.10 | Vol: 26
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 3 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:50:32 | BSE:COALINDIA-A | ₹ 429.60 | Vol: 278
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|CIPLA|1790754633|1362.5|1362.5|1362.5|1362.5|18
[Live Tick] 2026-09-30 07:50:33 | NSE:CIPLA-EQ | ₹ 1362.50 | Vol: 18
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:50:34 | NSE:CIPLA-EQ | ₹ 1362.50 | Vol: 18
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|TCS|1790754635|2068.3|2068.3|2068.3|2068.3|26
[DEBUG] [FeedSimulator] Batch write: 3 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:50:36 | NSE:CIPLA-EQ | ₹ 1362.50 | Vol: 6
[DEBUG] [FeedSimulator] Batch write: 3 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:50:37 | BSE:COALINDIA-A | ₹ 429.60 | Vol: 278
{"ts":"2026-09-30T07:50:38.152Z","method":"GET","path":"/api/status/feed","ip":"127.0.0.1"}
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[System Status] Total Symbols Active: 3 | Receiving Live Ticks: 3
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|TCS|1790754637|2068.3|2068.3|2067.8|2067.8|27
[Live Tick] 2026-09-30 07:50:38 | NSE:CIPLA-EQ | ₹ 1362.50 | Vol: 6
[DEBUG] [FeedSimulator] Batch write: 3 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:50:39 | NSE:TCS-EQ | ₹ 2067.80 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|TCS|1790754640|2068.3|2068.3|2068.3|2068.3|2
[DEBUG] [FeedSimulator] Batch write: 3 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:50:41 | NSE:TCS-EQ | ₹ 2068.30 | Vol: 2
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|CIPLA|1790754642|1362.4|1362.4|1362.4|1362.4|1
[Live Tick] 2026-09-30 07:50:42 | NSE:CIPLA-EQ | ₹ 1362.40 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:50:43 | NSE:CIPLA-EQ | ₹ 1362.40 | Vol: 3
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|CIPLA|1790754644|1362.4|1362.4|1362.4|1362.4|3
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:50:45 | NSE:TCS-EQ | ₹ 2068.30 | Vol: 3
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:50:46 | BSE:COALINDIA-A | ₹ 429.25 | Vol: 37
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|CIPLA|1790754646|1362.4|1362.4|1362.4|1362.4|1
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:50:47 | NSE:TCS-EQ | ₹ 2068.00 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790754648|429.2|429.2|429.2|429.2|116
[Live Tick] 2026-09-30 07:50:48 | BSE:COALINDIA-A | ₹ 429.20 | Vol: 116
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:50:49 | BSE:COALINDIA-A | ₹ 429.20 | Vol: 116
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|CIPLA|1790754651|1362.4|1362.4|1362.4|1362.4|1
[Live Tick] 2026-09-30 07:50:51 | NSE:CIPLA-EQ | ₹ 1362.40 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:50:52 | NSE:TCS-EQ | ₹ 2068.50 | Vol: 9
[DEBUG] [FeedSimulator] Batch write: 3 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|TCS|1790754653|2068.4|2068.4|2068.4|2068.4|4
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:50:53 | BSE:COALINDIA-A | ₹ 429.20 | Vol: 37
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 3 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:50:55 | BSE:COALINDIA-A | ₹ 429.20 | Vol: 37
[DEBUG] [FeedSimulator] Batch write: 3 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|TCS|1790754655|2068.4|2068.5|2068.4|2068.5|24
[Live Tick] 2026-09-30 07:50:56 | NSE:TCS-EQ | ₹ 2068.50 | Vol: 11
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:50:57 | BSE:COALINDIA-A | ₹ 429.45 | Vol: 18
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790754658|429.45|429.45|429.45|429.45|18
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:50:58 | NSE:TCS-EQ | ₹ 2068.40 | Vol: 5
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790754660|429.45|429.45|429.45|429.45|18
[Live Tick] 2026-09-30 07:51:00 | BSE:COALINDIA-A | ₹ 429.45 | Vol: 18
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:51:01 | NSE:CIPLA-EQ | ₹ 1362.50 | Vol: 21
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|CIPLA|1790754662|1362.5|1362.5|1362.5|1362.5|21
[Live Tick] 2026-09-30 07:51:02 | NSE:CIPLA-EQ | ₹ 1362.50 | Vol: 21
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:51:03 | BSE:COALINDIA-A | ₹ 429.25 | Vol: 37
[DEBUG] [FeedSimulator] Batch write: 3 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|CIPLA|1790754664|1362.5|1362.5|1362.5|1362.5|21
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:51:05 | NSE:TCS-EQ | ₹ 2068.30 | Vol: 7
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:51:06 | NSE:TCS-EQ | ₹ 2068.40 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|CIPLA|1790754666|1362.8|1362.8|1362.8|1362.8|2
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:51:07 | NSE:CIPLA-EQ | ₹ 1362.80 | Vol: 2
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[System Status] Total Symbols Active: 3 | Receiving Live Ticks: 3
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|TCS|1790754669|2068.5|2068.5|2068.5|2068.5|17
[Live Tick] 2026-09-30 07:51:09 | NSE:TCS-EQ | ₹ 2068.50 | Vol: 17
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:51:10 | NSE:CIPLA-EQ | ₹ 1362.80 | Vol: 2
[DEBUG] [FeedSimulator] Batch write: 3 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|TCS|1790754671|2068.4|2068.4|2068.4|2068.4|2
[Live Tick] 2026-09-30 07:51:11 | NSE:TCS-EQ | ₹ 2068.40 | Vol: 2
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:51:12 | BSE:COALINDIA-A | ₹ 429.20 | Vol: 146
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|CIPLA|1790754673|1362.1|1362.1|1362.1|1362.1|11
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:51:14 | BSE:COALINDIA-A | ₹ 429.20 | Vol: 146
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:51:15 | NSE:CIPLA-EQ | ₹ 1362.10 | Vol: 11
[DEBUG] [FeedSimulator] Batch write: 3 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|CIPLA|1790754676|1362.1|1362.1|1362.1|1362.1|11
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:51:16 | NSE:TCS-EQ | ₹ 2068.50 | Vol: 3
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:51:17 | NSE:TCS-EQ | ₹ 2068.50 | Vol: 3
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|CIPLA|1790754678|1363.2|1363.2|1363.2|1363.2|17
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:51:19 | NSE:CIPLA-EQ | ₹ 1363.20 | Vol: 17
[DEBUG] [FeedSimulator] Batch write: 3 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|TCS|1790754680|2068.2|2068.2|2068.2|2068.2|1
[Live Tick] 2026-09-30 07:51:20 | NSE:TCS-EQ | ₹ 2068.20 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:51:21 | NSE:TCS-EQ | ₹ 2068.30 | Vol: 18
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|CIPLA|1790754682|1362.5|1362.7|1362.5|1362.7|6
[Live Tick] 2026-09-30 07:51:22 | NSE:CIPLA-EQ | ₹ 1362.70 | Vol: 4
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:51:24 | NSE:TCS-EQ | ₹ 2068.30 | Vol: 3
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|CIPLA|1790754684|1362.8|1362.8|1362.8|1362.8|1
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:51:25 | NSE:CIPLA-EQ | ₹ 1362.80 | Vol: 4
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:51:26 | BSE:COALINDIA-A | ₹ 429.25 | Vol: 95
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|CIPLA|1790754686|1362.9|1362.9|1362.9|1362.9|9
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:51:27 | BSE:COALINDIA-A | ₹ 429.25 | Vol: 49
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790754689|429.25|429.25|429.25|429.25|46
[Live Tick] 2026-09-30 07:51:29 | BSE:COALINDIA-A | ₹ 429.25 | Vol: 46
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:51:30 | BSE:COALINDIA-A | ₹ 429.20 | Vol: 3
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 3 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|CIPLA|1790754691|1362.9|1362.9|1362.5|1362.5|3
[Live Tick] 2026-09-30 07:51:31 | NSE:CIPLA-EQ | ₹ 1362.50 | Vol: 2
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:51:32 | NSE:TCS-EQ | ₹ 2069.00 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|TCS|1790754694|2068.9|2068.9|2068.9|2068.9|3
[Live Tick] 2026-09-30 07:51:34 | NSE:TCS-EQ | ₹ 2068.90 | Vol: 3
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:51:35 | BSE:COALINDIA-A | ₹ 429.25 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|CIPLA|1790754696|1361.6|1361.6|1361.6|1361.6|5
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:51:36 | NSE:TCS-EQ | ₹ 2069.00 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[System Status] Total Symbols Active: 3 | Receiving Live Ticks: 3
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|CIPLA|1790754698|1361.8|1361.8|1361.8|1361.8|1
[Live Tick] 2026-09-30 07:51:38 | NSE:CIPLA-EQ | ₹ 1361.80 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:51:39 | BSE:COALINDIA-A | ₹ 429.25 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|CIPLA|1790754701|1361.9|1361.9|1361.9|1361.9|7
[Live Tick] 2026-09-30 07:51:41 | NSE:CIPLA-EQ | ₹ 1361.90 | Vol: 7
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:51:43 | NSE:CIPLA-EQ | ₹ 1361.90 | Vol: 7
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790754703|429.3|429.3|429.3|429.3|355
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:51:44 | NSE:CIPLA-EQ | ₹ 1361.90 | Vol: 7
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|CIPLA|1790754706|1362|1362|1362|1362|9
[Live Tick] 2026-09-30 07:51:46 | NSE:CIPLA-EQ | ₹ 1362.00 | Vol: 9
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:51:47 | BSE:COALINDIA-A | ₹ 429.30 | Vol: 355
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790754708|429.3|429.3|429.3|429.3|355
[Live Tick] 2026-09-30 07:51:48 | BSE:COALINDIA-A | ₹ 429.30 | Vol: 355
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:51:49 | NSE:TCS-EQ | ₹ 2068.60 | Vol: 9
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|CIPLA|1790754710|1361.9|1361.9|1361.9|1361.9|4
[Live Tick] 2026-09-30 07:51:50 | NSE:CIPLA-EQ | ₹ 1361.90 | Vol: 4
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:51:52 | NSE:TCS-EQ | ₹ 2068.70 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|CIPLA|1790754712|1361.8|1361.8|1361.8|1361.8|1
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:51:53 | BSE:COALINDIA-A | ₹ 429.30 | Vol: 355
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 3 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:51:54 | NSE:CIPLA-EQ | ₹ 1361.80 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|CIPLA|1790754715|1361.8|1361.8|1361.8|1361.8|6
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:51:56 | BSE:COALINDIA-A | ₹ 429.30 | Vol: 355
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|CIPLA|1790754717|1361.8|1361.8|1361.8|1361.8|5
[Live Tick] 2026-09-30 07:51:57 | NSE:CIPLA-EQ | ₹ 1361.80 | Vol: 5
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:51:59 | BSE:COALINDIA-A | ₹ 429.30 | Vol: 355
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|CIPLA|1790754719|1361.8|1361.8|1361.8|1361.8|5
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:52:00 | NSE:CIPLA-EQ | ₹ 1361.80 | Vol: 5
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|TCS|1790754722|2069|2069|2069|2069|1
[Live Tick] 2026-09-30 07:52:02 | NSE:TCS-EQ | ₹ 2069.00 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:52:03 | BSE:COALINDIA-A | ₹ 429.75 | Vol: 249
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790754725|429.75|429.75|429.75|429.75|249
[Live Tick] 2026-09-30 07:52:05 | BSE:COALINDIA-A | ₹ 429.75 | Vol: 249
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:52:06 | NSE:CIPLA-EQ | ₹ 1361.80 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|CIPLA|1790754727|1361.8|1361.8|1361.8|1361.8|1
[Live Tick] 2026-09-30 07:52:07 | NSE:CIPLA-EQ | ₹ 1361.80 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[System Status] Total Symbols Active: 3 | Receiving Live Ticks: 3
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:52:09 | NSE:CIPLA-EQ | ₹ 1362.20 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|CIPLA|1790754730|1362.2|1362.2|1362.2|1362.2|2
[Live Tick] 2026-09-30 07:52:10 | BSE:COALINDIA-A | ₹ 429.45 | Vol: 201
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:52:11 | NSE:CIPLA-EQ | ₹ 1362.20 | Vol: 6
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|CIPLA|1790754732|1362.2|1362.2|1362.2|1362.2|6
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:52:12 | BSE:COALINDIA-A | ₹ 429.40 | Vol: 52
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:52:14 | BSE:COALINDIA-A | ₹ 429.40 | Vol: 52
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|CIPLA|1790754734|1362.2|1362.2|1362.2|1362.2|6
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:52:15 | NSE:CIPLA-EQ | ₹ 1362.20 | Vol: 11
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790754736|429.45|429.45|429.45|429.45|1
[Live Tick] 2026-09-30 07:52:16 | BSE:COALINDIA-A | ₹ 429.45 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:52:17 | BSE:COALINDIA-A | ₹ 429.45 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|CIPLA|1790754739|1362.1|1362.1|1362.1|1362.1|1
[Live Tick] 2026-09-30 07:52:19 | NSE:CIPLA-EQ | ₹ 1362.10 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:52:20 | BSE:COALINDIA-A | ₹ 429.45 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790754741|429.45|429.45|429.45|429.45|1
[Live Tick] 2026-09-30 07:52:21 | BSE:COALINDIA-A | ₹ 429.45 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:52:22 | NSE:TCS-EQ | ₹ 2069.80 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|CIPLA|1790754744|1362.2|1362.2|1362.2|1362.2|30
[Live Tick] 2026-09-30 07:52:24 | NSE:CIPLA-EQ | ₹ 1362.20 | Vol: 30
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:52:25 | BSE:COALINDIA-A | ₹ 429.45 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|CIPLA|1790754746|1362.1|1362.1|1362.1|1362.1|11
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:52:26 | BSE:COALINDIA-A | ₹ 429.45 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:52:28 | BSE:COALINDIA-A | ₹ 429.45 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|CIPLA|1790754748|1361.8|1361.8|1361.8|1361.8|1
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:52:29 | BSE:COALINDIA-A | ₹ 429.45 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|CIPLA|1790754750|1361.8|1361.8|1361.8|1361.8|1
[Live Tick] 2026-09-30 07:52:30 | NSE:CIPLA-EQ | ₹ 1361.80 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:52:31 | BSE:COALINDIA-A | ₹ 429.45 | Vol: 199
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|CIPLA|1790754752|1361.8|1361.8|1361.8|1361.8|1
[Live Tick] 2026-09-30 07:52:32 | NSE:CIPLA-EQ | ₹ 1361.80 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:52:34 | NSE:CIPLA-EQ | ₹ 1362.10 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|CIPLA|1790754754|1362.1|1362.1|1361.9|1361.9|4
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:52:35 | BSE:COALINDIA-A | ₹ 429.05 | Vol: 23
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|TCS|1790754757|2069.9|2069.9|2069.9|2069.9|3
[Live Tick] 2026-09-30 07:52:37 | NSE:TCS-EQ | ₹ 2069.90 | Vol: 3
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[System Status] Total Symbols Active: 3 | Receiving Live Ticks: 3
[Live Tick] 2026-09-30 07:52:38 | BSE:COALINDIA-A | ₹ 429.05 | Vol: 23
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|TCS|1790754760|2069.9|2069.9|2069.9|2069.9|8
[Live Tick] 2026-09-30 07:52:40 | NSE:TCS-EQ | ₹ 2069.90 | Vol: 8
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:52:41 | BSE:COALINDIA-A | ₹ 429.00 | Vol: 42
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790754762|429|429|429|429|42
[Live Tick] 2026-09-30 07:52:42 | BSE:COALINDIA-A | ₹ 429.00 | Vol: 42
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:52:43 | NSE:TCS-EQ | ₹ 2069.70 | Vol: 4
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|TCS|1790754764|2069.5|2069.5|2069.5|2069.5|5
[Live Tick] 2026-09-30 07:52:44 | NSE:TCS-EQ | ₹ 2069.50 | Vol: 5
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:52:45 | NSE:TCS-EQ | ₹ 2069.20 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|TCS|1790754766|2069.6|2069.6|2069.6|2069.6|1
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:52:47 | BSE:COALINDIA-A | ₹ 429.00 | Vol: 221
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:52:48 | BSE:COALINDIA-A | ₹ 429.00 | Vol: 221
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|CIPLA|1790754769|1362|1362|1362|1362|1
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:52:49 | NSE:TCS-EQ | ₹ 2069.50 | Vol: 2
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:52:50 | NSE:TCS-EQ | ₹ 2069.60 | Vol: 3
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790754771|429|429|429|429|221
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:52:52 | BSE:COALINDIA-A | ₹ 429.00 | Vol: 221
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790754773|429.2|429.2|429.2|429.2|3
[Live Tick] 2026-09-30 07:52:53 | BSE:COALINDIA-A | ₹ 429.20 | Vol: 3
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:52:54 | BSE:COALINDIA-A | ₹ 429.20 | Vol: 3
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790754776|429|429|429|429|37
[Live Tick] 2026-09-30 07:52:56 | BSE:COALINDIA-A | ₹ 429.00 | Vol: 37
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:52:57 | BSE:COALINDIA-A | ₹ 429.00 | Vol: 37
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|CIPLA|1790754778|1360.9|1360.9|1360.9|1360.9|14
[Live Tick] 2026-09-30 07:52:58 | NSE:CIPLA-EQ | ₹ 1360.90 | Vol: 14
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:52:59 | NSE:TCS-EQ | ₹ 2069.30 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|TCS|1790754780|2069.3|2069.3|2069.3|2069.3|1
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:53:01 | BSE:COALINDIA-A | ₹ 429.25 | Vol: 48
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:53:02 | NSE:TCS-EQ | ₹ 2069.60 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|TCS|1790754783|2069.6|2069.6|2069.6|2069.6|3
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:53:03 | BSE:COALINDIA-A | ₹ 429.25 | Vol: 48
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:53:04 | NSE:CIPLA-EQ | ₹ 1361.70 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|TCS|1790754785|2069.7|2069.7|2069.7|2069.7|5
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:53:06 | NSE:TCS-EQ | ₹ 2069.40 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|TCS|1790754787|2069.3|2069.3|2069.3|2069.3|5
[Live Tick] 2026-09-30 07:53:07 | NSE:TCS-EQ | ₹ 2069.30 | Vol: 5
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[System Status] Total Symbols Active: 3 | Receiving Live Ticks: 3
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:53:08 | BSE:COALINDIA-A | ₹ 429.25 | Vol: 48
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790754790|429.25|429.25|429.25|429.25|48
[Live Tick] 2026-09-30 07:53:10 | BSE:COALINDIA-A | ₹ 429.25 | Vol: 48
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:53:11 | NSE:CIPLA-EQ | ₹ 1361.60 | Vol: 6
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|TCS|1790754792|2069.3|2069.3|2069.3|2069.3|3
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:53:12 | BSE:COALINDIA-A | ₹ 429.00 | Vol: 36
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:53:13 | BSE:COALINDIA-A | ₹ 428.95 | Vol: 40
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|TCS|1790754794|2069.2|2069.2|2069.2|2069.2|1
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:53:15 | BSE:COALINDIA-A | ₹ 428.95 | Vol: 40
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|TCS|1790754796|2069|2069|2069|2069|1
[Live Tick] 2026-09-30 07:53:16 | NSE:TCS-EQ | ₹ 2069.00 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:53:17 | BSE:COALINDIA-A | ₹ 429.00 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|TCS|1790754798|2068.4|2068.4|2068.4|2068.4|8
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:53:19 | NSE:CIPLA-EQ | ₹ 1361.60 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|TCS|1790754801|2068.7|2068.7|2068.7|2068.7|1
[Live Tick] 2026-09-30 07:53:21 | NSE:TCS-EQ | ₹ 2068.70 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:53:22 | BSE:COALINDIA-A | ₹ 429.00 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|TCS|1790754803|2068.6|2068.6|2068.6|2068.6|5
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:53:24 | BSE:COALINDIA-A | ₹ 429.00 | Vol: 38
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:53:25 | NSE:CIPLA-EQ | ₹ 1361.60 | Vol: 11
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|TCS|1790754806|2068.7|2068.7|2068.7|2068.7|67
[Live Tick] 2026-09-30 07:53:26 | NSE:TCS-EQ | ₹ 2068.70 | Vol: 67
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:53:28 | NSE:TCS-EQ | ₹ 2068.60 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790754809|429|429|429|429|38
[Live Tick] 2026-09-30 07:53:29 | BSE:COALINDIA-A | ₹ 429.00 | Vol: 38
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:53:30 | NSE:TCS-EQ | ₹ 2068.90 | Vol: 3
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|TCS|1790754811|2068.9|2068.9|2068.9|2068.9|3
[Live Tick] 2026-09-30 07:53:31 | NSE:TCS-EQ | ₹ 2068.90 | Vol: 3
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:53:32 | BSE:COALINDIA-A | ₹ 429.00 | Vol: 37
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|TCS|1790754813|2068.9|2068.9|2068.9|2068.9|5
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:53:34 | BSE:COALINDIA-A | ₹ 429.00 | Vol: 37
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:53:35 | NSE:CIPLA-EQ | ₹ 1361.60 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|TCS|1790754816|2069.2|2069.2|2069.2|2069.2|1
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:53:36 | BSE:COALINDIA-A | ₹ 429.00 | Vol: 37
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[System Status] Total Symbols Active: 3 | Receiving Live Ticks: 3
[Live Tick] 2026-09-30 07:53:38 | BSE:COALINDIA-A | ₹ 429.00 | Vol: 37
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|TCS|1790754819|2069|2069|2069|2069|3
[Live Tick] 2026-09-30 07:53:39 | NSE:TCS-EQ | ₹ 2069.00 | Vol: 3
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:53:40 | NSE:CIPLA-EQ | ₹ 1361.60 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790754822|429.35|429.35|429.35|429.35|1
[Live Tick] 2026-09-30 07:53:42 | BSE:COALINDIA-A | ₹ 429.35 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:53:43 | NSE:TCS-EQ | ₹ 2069.10 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790754824|429.35|429.35|429.35|429.35|1
[Live Tick] 2026-09-30 07:53:44 | BSE:COALINDIA-A | ₹ 429.35 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:53:45 | NSE:CIPLA-EQ | ₹ 1361.60 | Vol: 11
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790754827|429.25|429.25|429.25|429.25|15
[Live Tick] 2026-09-30 07:53:47 | BSE:COALINDIA-A | ₹ 429.25 | Vol: 15
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:53:49 | NSE:TCS-EQ | ₹ 2069.10 | Vol: 4
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790754829|429.25|429.25|429.25|429.25|15
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:53:50 | NSE:CIPLA-EQ | ₹ 1361.60 | Vol: 2
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790754832|429.05|429.05|429.05|429.05|5
[Live Tick] 2026-09-30 07:53:52 | BSE:COALINDIA-A | ₹ 429.05 | Vol: 5
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:53:53 | BSE:COALINDIA-A | ₹ 429.05 | Vol: 5
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|TCS|1790754834|2068.8|2068.8|2068.8|2068.8|1
[Live Tick] 2026-09-30 07:53:54 | NSE:TCS-EQ | ₹ 2068.80 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:53:56 | NSE:TCS-EQ | ₹ 2068.90 | Vol: 68
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790754837|429.05|429.05|429.05|429.05|5
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:53:58 | NSE:TCS-EQ | ₹ 2069.00 | Vol: 445
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790754839|429.05|429.05|429.05|429.05|20
[Live Tick] 2026-09-30 07:53:59 | BSE:COALINDIA-A | ₹ 429.05 | Vol: 20
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:54:00 | NSE:TCS-EQ | ₹ 2069.10 | Vol: 5
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790754842|429.05|429.05|429.05|429.05|20
[Live Tick] 2026-09-30 07:54:02 | BSE:COALINDIA-A | ₹ 429.05 | Vol: 20
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:54:03 | BSE:COALINDIA-A | ₹ 429.05 | Vol: 20
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|TCS|1790754844|2069.1|2069.1|2069.1|2069.1|8
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:54:04 | NSE:TCS-EQ | ₹ 2069.20 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:54:05 | NSE:TCS-EQ | ₹ 2069.10 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|TCS|1790754846|2069.2|2069.2|2069.2|2069.2|3
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:54:07 | BSE:COALINDIA-A | ₹ 429.00 | Vol: 49
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[System Status] Total Symbols Active: 3 | Receiving Live Ticks: 3
[Live Tick] 2026-09-30 07:54:08 | BSE:COALINDIA-A | ₹ 429.00 | Vol: 49
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790754849|429|429|429|429|49
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:54:10 | BSE:COALINDIA-A | ₹ 429.00 | Vol: 49
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790754851|429|429|429|429|49
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:54:11 | NSE:CIPLA-EQ | ₹ 1360.80 | Vol: 11
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|TCS|1790754853|2068.9|2068.9|2068.9|2068.9|6
[Live Tick] 2026-09-30 07:54:13 | NSE:TCS-EQ | ₹ 2068.90 | Vol: 6
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:54:15 | NSE:TCS-EQ | ₹ 2069.10 | Vol: 10
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|TCS|1790754856|2069.1|2069.1|2069.1|2069.1|10
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:54:16 | BSE:COALINDIA-A | ₹ 429.20 | Vol: 23
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790754858|429.2|429.2|429.2|429.2|23
[Live Tick] 2026-09-30 07:54:18 | BSE:COALINDIA-A | ₹ 429.20 | Vol: 23
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:54:20 | BSE:COALINDIA-A | ₹ 429.20 | Vol: 23
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|CIPLA|1790754860|1361.6|1361.6|1361.6|1361.6|1
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:54:21 | NSE:TCS-EQ | ₹ 2068.70 | Vol: 3
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:54:22 | BSE:COALINDIA-A | ₹ 429.00 | Vol: 37
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790754863|429|429|429|429|37
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:54:24 | BSE:COALINDIA-A | ₹ 429.00 | Vol: 37
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790754865|429|429|429|429|37
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:54:25 | NSE:CIPLA-EQ | ₹ 1361.70 | Vol: 11
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:54:27 | NSE:CIPLA-EQ | ₹ 1361.70 | Vol: 11
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|TCS|1790754867|2069|2069|2069|2069|5
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:54:28 | BSE:COALINDIA-A | ₹ 429.00 | Vol: 37
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|CIPLA|1790754869|1361.7|1361.7|1361.7|1361.7|1
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:54:30 | BSE:COALINDIA-A | ₹ 429.00 | Vol: 37
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:54:31 | NSE:TCS-EQ | ₹ 2068.70 | Vol: 63
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|CIPLA|1790754872|1361.7|1361.7|1361.7|1361.7|1
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:54:32 | NSE:TCS-EQ | ₹ 2069.00 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:54:34 | BSE:COALINDIA-A | ₹ 429.30 | Vol: 49
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790754875|429.3|429.3|429.3|429.3|49
[Live Tick] 2026-09-30 07:54:35 | BSE:COALINDIA-A | ₹ 429.30 | Vol: 49
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:54:36 | NSE:TCS-EQ | ₹ 2068.80 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[System Status] Total Symbols Active: 3 | Receiving Live Ticks: 3
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|TCS|1790754877|2068.8|2068.8|2068.8|2068.8|1
[Live Tick] 2026-09-30 07:54:37 | NSE:TCS-EQ | ₹ 2068.80 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:54:39 | BSE:COALINDIA-A | ₹ 429.30 | Vol: 49
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|TCS|1790754880|2068.9|2068.9|2068.9|2068.9|1
[Live Tick] 2026-09-30 07:54:40 | NSE:TCS-EQ | ₹ 2068.90 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:54:41 | BSE:COALINDIA-A | ₹ 429.50 | Vol: 23
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|TCS|1790754882|2068.9|2068.9|2068.9|2068.9|18
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:54:43 | BSE:COALINDIA-A | ₹ 429.20 | Vol: 37
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|TCS|1790754884|2068.6|2068.6|2068.6|2068.6|1
[Live Tick] 2026-09-30 07:54:44 | NSE:TCS-EQ | ₹ 2068.60 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:54:45 | BSE:COALINDIA-A | ₹ 429.40 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790754886|429.15|429.15|429.15|429.15|37
[Live Tick] 2026-09-30 07:54:46 | BSE:COALINDIA-A | ₹ 429.15 | Vol: 37
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:54:48 | BSE:COALINDIA-A | ₹ 429.15 | Vol: 37
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|TCS|1790754890|2068.7|2068.7|2068.7|2068.7|2
[Live Tick] 2026-09-30 07:54:50 | NSE:TCS-EQ | ₹ 2068.70 | Vol: 2
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:54:52 | NSE:CIPLA-EQ | ₹ 1361.80 | Vol: 2
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790754893|429.15|429.15|429.15|429.15|37
[Live Tick] 2026-09-30 07:54:53 | BSE:COALINDIA-A | ₹ 429.15 | Vol: 37
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:54:54 | BSE:COALINDIA-A | ₹ 429.15 | Vol: 37
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|TCS|1790754895|2068.7|2068.7|2068.7|2068.7|21
[Live Tick] 2026-09-30 07:54:55 | NSE:TCS-EQ | ₹ 2068.70 | Vol: 21
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:54:56 | NSE:CIPLA-EQ | ₹ 1361.80 | Vol: 10
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790754898|429.15|429.15|429.15|429.15|37
[Live Tick] 2026-09-30 07:54:58 | BSE:COALINDIA-A | ₹ 429.15 | Vol: 37
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:54:59 | BSE:COALINDIA-A | ₹ 429.15 | Vol: 37
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|CIPLA|1790754900|1361.8|1361.8|1361.8|1361.8|1
[Live Tick] 2026-09-30 07:55:00 | NSE:CIPLA-EQ | ₹ 1361.80 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:55:02 | NSE:TCS-EQ | ₹ 2068.60 | Vol: 12
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|CIPLA|1790754902|1361.6|1361.6|1361.6|1361.6|1
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:55:03 | NSE:TCS-EQ | ₹ 2068.70 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790754905|429.5|429.5|429.5|429.5|266
[Live Tick] 2026-09-30 07:55:05 | BSE:COALINDIA-A | ₹ 429.50 | Vol: 266
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:55:06 | BSE:COALINDIA-A | ₹ 429.50 | Vol: 266
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790754907|429.5|429.5|429.5|429.5|266
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[System Status] Total Symbols Active: 3 | Receiving Live Ticks: 3
[Live Tick] 2026-09-30 07:55:08 | BSE:COALINDIA-A | ₹ 429.50 | Vol: 266
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790754909|429.5|429.5|429.5|429.5|266
[Live Tick] 2026-09-30 07:55:09 | BSE:COALINDIA-A | ₹ 429.50 | Vol: 266
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:55:10 | NSE:CIPLA-EQ | ₹ 1362.20 | Vol: 9
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[System Status] Total Symbols Active: 3 | Receiving Live Ticks: 3
[System Status] Total Symbols Active: 3 | Receiving Live Ticks: 3
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|CIPLA|1790754911|1362.3|1362.3|1362.3|1362.3|1
[Live Tick] 2026-09-30 07:55:11 | NSE:CIPLA-EQ | ₹ 1362.30 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 77 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 88 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:56:35 | NSE:TCS-EQ | ₹ 2070.00 | Vol: 12
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|TCS|1790754996|2070|2070|2070|2070|12
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:56:36 | BSE:COALINDIA-A | ₹ 429.10 | Vol: 188
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:56:37 | NSE:CIPLA-EQ | ₹ 1361.80 | Vol: 11
[DEBUG] [FeedSimulator] Batch write: 3 bars persisted (250ms flush)
[System Status] Total Symbols Active: 3 | Receiving Live Ticks: 3
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|TCS|1790754998|2069.9|2069.9|2069.9|2069.9|28
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:56:38 | BSE:COALINDIA-A | ₹ 429.10 | Vol: 37
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:56:39 | NSE:TCS-EQ | ₹ 2069.90 | Vol: 3
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|TCS|1790755001|2070.4|2070.4|2070.4|2070.4|7
[Live Tick] 2026-09-30 07:56:41 | NSE:TCS-EQ | ₹ 2070.40 | Vol: 7
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:56:42 | BSE:COALINDIA-A | ₹ 429.05 | Vol: 37
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|TCS|1790755004|2070|2070|2070|2070|1
[Live Tick] 2026-09-30 07:56:44 | NSE:TCS-EQ | ₹ 2070.00 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|TCS|1790755006|2070.2|2070.2|2070.2|2070.2|5
[Live Tick] 2026-09-30 07:56:46 | NSE:TCS-EQ | ₹ 2070.20 | Vol: 5
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:56:47 | BSE:COALINDIA-A | ₹ 429.40 | Vol: 23
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|TCS|1790755008|2070.2|2070.2|2070.1|2070.1|4
[Live Tick] 2026-09-30 07:56:48 | NSE:TCS-EQ | ₹ 2070.10 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:56:50 | BSE:COALINDIA-A | ₹ 429.40 | Vol: 23
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790755011|429.4|429.4|429.4|429.4|23
[Live Tick] 2026-09-30 07:56:51 | BSE:COALINDIA-A | ₹ 429.40 | Vol: 23
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:56:52 | NSE:TCS-EQ | ₹ 2070.10 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|CIPLA|1790755014|1361.7|1361.7|1361.7|1361.7|1
[Live Tick] 2026-09-30 07:56:54 | NSE:CIPLA-EQ | ₹ 1361.70 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:56:55 | BSE:COALINDIA-A | ₹ 429.05 | Vol: 38
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|CIPLA|1790755016|1361.7|1361.7|1361.7|1361.7|7
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:56:56 | BSE:COALINDIA-A | ₹ 429.05 | Vol: 38
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|CIPLA|1790755018|1362.2|1362.2|1362.2|1362.2|8
[Live Tick] 2026-09-30 07:56:58 | NSE:CIPLA-EQ | ₹ 1362.20 | Vol: 8
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:56:59 | BSE:COALINDIA-A | ₹ 429.05 | Vol: 38
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|TCS|1790755020|2070.2|2070.2|2070.2|2070.2|5
[Live Tick] 2026-09-30 07:57:00 | NSE:TCS-EQ | ₹ 2070.20 | Vol: 5
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:57:01 | NSE:CIPLA-EQ | ₹ 1362.20 | Vol: 2
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|TCS|1790755022|2069.8|2069.8|2069.8|2069.8|50
[Live Tick] 2026-09-30 07:57:02 | NSE:TCS-EQ | ₹ 2069.80 | Vol: 50
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 3 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:57:04 | NSE:CIPLA-EQ | ₹ 1362.20 | Vol: 2
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|TCS|1790755025|2069.8|2069.8|2069.8|2069.8|2
[Live Tick] 2026-09-30 07:57:05 | NSE:TCS-EQ | ₹ 2069.80 | Vol: 2
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:57:07 | BSE:COALINDIA-A | ₹ 429.05 | Vol: 37
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|TCS|1790755027|2069.5|2069.5|2069.5|2069.5|84
[System Status] Total Symbols Active: 3 | Receiving Live Ticks: 3
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:57:08 | NSE:TCS-EQ | ₹ 2070.00 | Vol: 60
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:57:09 | BSE:COALINDIA-A | ₹ 429.05 | Vol: 79
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|TCS|1790755029|2070|2070|2070|2070|1
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:57:10 | NSE:TCS-EQ | ₹ 2069.50 | Vol: 12
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|TCS|1790755032|2069.6|2069.6|2069.6|2069.6|9
[Live Tick] 2026-09-30 07:57:12 | NSE:TCS-EQ | ₹ 2069.60 | Vol: 9
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:57:13 | BSE:COALINDIA-A | ₹ 429.05 | Vol: 79
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|TCS|1790755034|2069.6|2069.6|2069.6|2069.6|6
[Live Tick] 2026-09-30 07:57:14 | NSE:TCS-EQ | ₹ 2069.60 | Vol: 6
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:57:16 | BSE:COALINDIA-A | ₹ 429.30 | Vol: 280
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|TCS|1790755036|2069.6|2069.6|2069.6|2069.6|4
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:57:17 | NSE:TCS-EQ | ₹ 2069.60 | Vol: 3
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|CIPLA|1790755038|1361.8|1361.8|1361.8|1361.8|2
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:57:19 | NSE:CIPLA-EQ | ₹ 1361.80 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|TCS|1790755040|2069.7|2069.7|2069.6|2069.6|5
[Live Tick] 2026-09-30 07:57:20 | NSE:TCS-EQ | ₹ 2069.60 | Vol: 2
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:57:22 | NSE:TCS-EQ | ₹ 2069.60 | Vol: 2
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|CIPLA|1790755043|1362.4|1362.4|1362.4|1362.4|2
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:57:24 | NSE:TCS-EQ | ₹ 2069.60 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:57:25 | BSE:COALINDIA-A | ₹ 429.30 | Vol: 280
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|TCS|1790755045|2069.7|2069.7|2069.7|2069.7|2
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:57:26 | NSE:TCS-EQ | ₹ 2069.60 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:57:27 | BSE:COALINDIA-A | ₹ 429.30 | Vol: 280
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|TCS|1790755047|2069.6|2069.6|2069.6|2069.6|1
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:57:28 | NSE:TCS-EQ | ₹ 2069.60 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 3 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790755049|429.3|429.3|429.3|429.3|280
[Live Tick] 2026-09-30 07:57:29 | BSE:COALINDIA-A | ₹ 429.30 | Vol: 280
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:57:31 | BSE:COALINDIA-A | ₹ 429.35 | Vol: 7
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790755052|429.35|429.35|429.35|429.35|7
[Live Tick] 2026-09-30 07:57:32 | BSE:COALINDIA-A | ₹ 429.35 | Vol: 7
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:57:33 | BSE:COALINDIA-A | ₹ 429.35 | Vol: 7
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|CIPLA|1790755055|1362.4|1362.4|1362.4|1362.4|11
[Live Tick] 2026-09-30 07:57:35 | NSE:CIPLA-EQ | ₹ 1362.40 | Vol: 11
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|TCS|1790755057|2069.6|2069.6|2069.6|2069.6|1
[Live Tick] 2026-09-30 07:57:37 | NSE:TCS-EQ | ₹ 2069.60 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[System Status] Total Symbols Active: 3 | Receiving Live Ticks: 3
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:57:38 | BSE:COALINDIA-A | ₹ 429.00 | Vol: 85
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|CIPLA|1790755059|1362.2|1362.2|1362.2|1362.2|1
[Live Tick] 2026-09-30 07:57:39 | NSE:CIPLA-EQ | ₹ 1362.20 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 3 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:57:41 | BSE:COALINDIA-A | ₹ 429.05 | Vol: 37
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790755062|429.05|429.05|429.05|429.05|37
[Live Tick] 2026-09-30 07:57:42 | BSE:COALINDIA-A | ₹ 429.05 | Vol: 37
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:57:43 | NSE:CIPLA-EQ | ₹ 1362.10 | Vol: 2
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|TCS|1790755065|2069.7|2069.7|2069.7|2069.7|2
[Live Tick] 2026-09-30 07:57:45 | NSE:TCS-EQ | ₹ 2069.70 | Vol: 2
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:57:46 | NSE:TCS-EQ | ₹ 2069.70 | Vol: 5
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790755067|429|429|429|429|10
[Live Tick] 2026-09-30 07:57:47 | BSE:COALINDIA-A | ₹ 429.00 | Vol: 10
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:57:48 | NSE:TCS-EQ | ₹ 2069.70 | Vol: 2
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|CIPLA|1790755069|1362.4|1362.4|1362.4|1362.4|1
[Live Tick] 2026-09-30 07:57:49 | NSE:CIPLA-EQ | ₹ 1362.40 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 3 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:57:51 | NSE:TCS-EQ | ₹ 2070.00 | Vol: 3
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|TCS|1790755072|2070|2070|2070|2070|1
[Live Tick] 2026-09-30 07:57:52 | NSE:TCS-EQ | ₹ 2070.00 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:57:54 | BSE:COALINDIA-A | ₹ 429.10 | Vol: 288
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|TCS|1790755074|2069.9|2069.9|2069.9|2069.9|1
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:57:55 | NSE:TCS-EQ | ₹ 2070.00 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:57:56 | BSE:COALINDIA-A | ₹ 429.10 | Vol: 18
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790755077|429.1|429.1|429.1|429.1|18
[Live Tick] 2026-09-30 07:57:57 | BSE:COALINDIA-A | ₹ 429.10 | Vol: 18
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:57:58 | NSE:TCS-EQ | ₹ 2069.60 | Vol: 2
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790755080|429.1|429.1|429.1|429.1|18
[Live Tick] 2026-09-30 07:58:00 | BSE:COALINDIA-A | ₹ 429.10 | Vol: 18
[DEBUG] [FeedSimulator] Batch write: 3 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:58:01 | NSE:CIPLA-EQ | ₹ 1362.40 | Vol: 16
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|TCS|1790755082|2069.9|2069.9|2069.9|2069.9|1
[Live Tick] 2026-09-30 07:58:02 | NSE:TCS-EQ | ₹ 2069.90 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:58:04 | BSE:COALINDIA-A | ₹ 429.10 | Vol: 51
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|CIPLA|1790755085|1362.4|1362.4|1362.4|1362.4|11
[Live Tick] 2026-09-30 07:58:05 | NSE:CIPLA-EQ | ₹ 1362.40 | Vol: 11
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:58:06 | BSE:COALINDIA-A | ₹ 429.10 | Vol: 51
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[System Status] Total Symbols Active: 3 | Receiving Live Ticks: 3
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|TCS|1790755088|2069.1|2069.1|2069.1|2069.1|21
[Live Tick] 2026-09-30 07:58:08 | NSE:TCS-EQ | ₹ 2069.10 | Vol: 21
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:58:09 | BSE:COALINDIA-A | ₹ 429.10 | Vol: 37
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790755090|429.1|429.1|429.1|429.1|37
[Live Tick] 2026-09-30 07:58:10 | BSE:COALINDIA-A | ₹ 429.10 | Vol: 37
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:58:11 | NSE:TCS-EQ | ₹ 2068.70 | Vol: 2
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790755093|429.1|429.1|429.1|429.1|37
[Live Tick] 2026-09-30 07:58:13 | BSE:COALINDIA-A | ₹ 429.10 | Vol: 37
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|CIPLA|1790755095|1362.4|1362.4|1362.4|1362.4|8
[Live Tick] 2026-09-30 07:58:15 | NSE:CIPLA-EQ | ₹ 1362.40 | Vol: 8
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:58:16 | NSE:CIPLA-EQ | ₹ 1361.30 | Vol: 266
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|CIPLA|1790755097|1362.3|1362.3|1362.3|1362.3|1
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:58:18 | NSE:TCS-EQ | ₹ 2069.00 | Vol: 3
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:58:19 | BSE:COALINDIA-A | ₹ 429.20 | Vol: 281
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|TCS|1790755100|2069|2069|2069|2069|1
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:58:20 | BSE:COALINDIA-A | ₹ 429.20 | Vol: 281
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:58:21 | NSE:CIPLA-EQ | ₹ 1362.30 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790755102|429.2|429.2|429.2|429.2|281
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:58:23 | NSE:TCS-EQ | ₹ 2068.70 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790755104|429.2|429.2|429.2|429.2|281
[Live Tick] 2026-09-30 07:58:24 | BSE:COALINDIA-A | ₹ 429.20 | Vol: 281
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:58:25 | BSE:COALINDIA-A | ₹ 429.20 | Vol: 281
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|CIPLA|1790755107|1362|1362|1362|1362|1
[Live Tick] 2026-09-30 07:58:27 | NSE:CIPLA-EQ | ₹ 1362.00 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:58:28 | NSE:TCS-EQ | ₹ 2069.00 | Vol: 4
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790755109|429.2|429.2|429.2|429.2|281
[Live Tick] 2026-09-30 07:58:29 | BSE:COALINDIA-A | ₹ 429.20 | Vol: 281
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:58:31 | BSE:COALINDIA-A | ₹ 429.20 | Vol: 281
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790755112|429.45|429.45|429.45|429.45|252
[Live Tick] 2026-09-30 07:58:32 | NSE:CIPLA-EQ | ₹ 1361.60 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:58:33 | BSE:COALINDIA-A | ₹ 429.45 | Vol: 252
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|TCS|1790755114|2068.7|2068.7|2068.7|2068.7|1
[Live Tick] 2026-09-30 07:58:34 | NSE:TCS-EQ | ₹ 2068.70 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:58:36 | BSE:COALINDIA-A | ₹ 429.45 | Vol: 252
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790755117|429.45|429.45|429.45|429.45|252
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:58:37 | NSE:CIPLA-EQ | ₹ 1361.10 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[System Status] Total Symbols Active: 3 | Receiving Live Ticks: 3
[Live Tick] 2026-09-30 07:58:38 | BSE:COALINDIA-A | ₹ 429.45 | Vol: 252
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|TCS|1790755119|2068.5|2068.5|2068.5|2068.5|4
[Live Tick] 2026-09-30 07:58:39 | NSE:TCS-EQ | ₹ 2068.50 | Vol: 4
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:58:41 | NSE:TCS-EQ | ₹ 2068.60 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790755122|429.45|429.45|429.45|429.45|252
[Live Tick] 2026-09-30 07:58:42 | BSE:COALINDIA-A | ₹ 429.45 | Vol: 252
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:58:43 | BSE:COALINDIA-A | ₹ 429.45 | Vol: 252
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|TCS|1790755124|2068.6|2068.6|2068.6|2068.6|1
[Live Tick] 2026-09-30 07:58:44 | NSE:TCS-EQ | ₹ 2068.60 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:58:45 | NSE:TCS-EQ | ₹ 2068.60 | Vol: 3
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|TCS|1790755126|2068.6|2068.6|2068.6|2068.6|3
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:58:47 | BSE:COALINDIA-A | ₹ 429.10 | Vol: 185
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:58:48 | NSE:TCS-EQ | ₹ 2068.70 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|TCS|1790755128|2068.7|2068.9|2068.7|2068.9|2
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:58:50 | BSE:COALINDIA-A | ₹ 429.10 | Vol: 185
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790755131|429.1|429.1|429.1|429.1|185
[Live Tick] 2026-09-30 07:58:51 | BSE:COALINDIA-A | ₹ 429.10 | Vol: 185
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:58:52 | NSE:TCS-EQ | ₹ 2068.70 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790755133|429.1|429.1|429.1|429.1|185
[Live Tick] 2026-09-30 07:58:53 | BSE:COALINDIA-A | ₹ 429.10 | Vol: 185
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:58:55 | BSE:COALINDIA-A | ₹ 429.10 | Vol: 66
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|TCS|1790755136|2068.8|2068.8|2068.8|2068.8|21
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:58:56 | BSE:COALINDIA-A | ₹ 429.10 | Vol: 66
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:58:57 | NSE:TCS-EQ | ₹ 2068.70 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|TCS|1790755138|2068.7|2068.7|2068.7|2068.7|3
[Live Tick] 2026-09-30 07:58:58 | NSE:TCS-EQ | ₹ 2068.70 | Vol: 3
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:59:00 | NSE:TCS-EQ | ₹ 2068.70 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|TCS|1790755141|2068.8|2068.8|2068.8|2068.8|8
[Live Tick] 2026-09-30 07:59:01 | NSE:TCS-EQ | ₹ 2068.80 | Vol: 8
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:59:02 | NSE:TCS-EQ | ₹ 2068.80 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|TCS|1790755143|2068.8|2068.8|2068.8|2068.8|3
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:59:03 | NSE:TCS-EQ | ₹ 2068.70 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:59:05 | NSE:TCS-EQ | ₹ 2068.80 | Vol: 9
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|CIPLA|1790755145|1362.5|1362.5|1362.5|1362.5|4
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:59:06 | NSE:TCS-EQ | ₹ 2068.80 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[System Status] Total Symbols Active: 3 | Receiving Live Ticks: 3
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|CIPLA|1790755147|1362.3|1362.3|1362.3|1362.3|1
[Live Tick] 2026-09-30 07:59:07 | NSE:CIPLA-EQ | ₹ 1362.30 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:59:08 | NSE:TCS-EQ | ₹ 2068.70 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|TCS|1790755149|2068.7|2068.8|2068.7|2068.8|16
[Live Tick] 2026-09-30 07:59:10 | BSE:COALINDIA-A | ₹ 429.10 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:59:11 | NSE:TCS-EQ | ₹ 2068.80 | Vol: 13
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|CIPLA|1790755151|1362.5|1362.5|1362.5|1362.5|6
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:59:12 | NSE:TCS-EQ | ₹ 2068.80 | Vol: 4
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:59:13 | NSE:TCS-EQ | ₹ 2068.70 | Vol: 2
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|TCS|1790755154|2068.8|2068.8|2068.8|2068.8|1
[Live Tick] 2026-09-30 07:59:14 | NSE:TCS-EQ | ₹ 2068.80 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:59:16 | NSE:TCS-EQ | ₹ 2068.80 | Vol: 20
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790755157|429.45|429.45|429.45|429.45|164
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:59:17 | NSE:TCS-EQ | ₹ 2068.70 | Vol: 2
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|CIPLA|1790755159|1362.5|1362.5|1362.5|1362.5|2
[Live Tick] 2026-09-30 07:59:19 | NSE:CIPLA-EQ | ₹ 1362.50 | Vol: 2
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:59:20 | BSE:COALINDIA-A | ₹ 429.15 | Vol: 167
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|TCS|1790755161|2068.6|2068.6|2068.5|2068.5|7
[Live Tick] 2026-09-30 07:59:21 | NSE:TCS-EQ | ₹ 2068.50 | Vol: 4
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:59:23 | NSE:TCS-EQ | ₹ 2068.50 | Vol: 2
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|TCS|1790755164|2068.5|2068.5|2068.5|2068.5|2
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:59:24 | BSE:COALINDIA-A | ₹ 429.15 | Vol: 167
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:59:25 | NSE:CIPLA-EQ | ₹ 1362.50 | Vol: 11
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|TCS|1790755166|2068.6|2068.6|2068.6|2068.6|22
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:59:27 | NSE:TCS-EQ | ₹ 2068.60 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790755168|429.1|429.1|429.1|429.1|200
[Live Tick] 2026-09-30 07:59:28 | BSE:COALINDIA-A | ₹ 429.10 | Vol: 200
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:59:29 | NSE:CIPLA-EQ | ₹ 1362.50 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790755170|429.1|429.1|429.1|429.1|134
[Live Tick] 2026-09-30 07:59:30 | BSE:COALINDIA-A | ₹ 429.10 | Vol: 134
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:59:31 | NSE:CIPLA-EQ | ₹ 1362.20 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|TCS|1790755173|2068.6|2068.6|2068.6|2068.6|3
[Live Tick] 2026-09-30 07:59:33 | NSE:TCS-EQ | ₹ 2068.60 | Vol: 3
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:59:34 | NSE:TCS-EQ | ₹ 2068.50 | Vol: 2
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|TCS|1790755175|2068.6|2068.6|2068.6|2068.6|8
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:59:35 | BSE:COALINDIA-A | ₹ 429.10 | Vol: 134
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790755177|429.1|429.1|429.1|429.1|134
[Live Tick] 2026-09-30 07:59:37 | BSE:COALINDIA-A | ₹ 429.10 | Vol: 134
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[System Status] Total Symbols Active: 3 | Receiving Live Ticks: 3
[Live Tick] 2026-09-30 07:59:38 | NSE:TCS-EQ | ₹ 2068.50 | Vol: 2
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790755179|429.05|429.05|429.05|429.05|52
[Live Tick] 2026-09-30 07:59:39 | BSE:COALINDIA-A | ₹ 429.05 | Vol: 52
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:59:40 | NSE:TCS-EQ | ₹ 2068.60 | Vol: 5
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 3 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790755182|429.05|429.05|429.05|429.05|52
[Live Tick] 2026-09-30 07:59:42 | BSE:COALINDIA-A | ₹ 429.05 | Vol: 52
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:59:43 | BSE:COALINDIA-A | ₹ 429.05 | Vol: 52
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|CIPLA|1790755184|1362.3|1362.3|1362.3|1362.3|5
[Live Tick] 2026-09-30 07:59:44 | NSE:CIPLA-EQ | ₹ 1362.30 | Vol: 5
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:59:46 | BSE:COALINDIA-A | ₹ 429.05 | Vol: 37
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|TCS|1790755186|2068.6|2068.6|2068.6|2068.6|10
[Live Tick] 2026-09-30 07:59:46 | NSE:TCS-EQ | ₹ 2068.60 | Vol: 10
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:59:48 | NSE:TCS-EQ | ₹ 2068.60 | Vol: 3
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790755189|429.05|429.05|429.05|429.05|52
[Live Tick] 2026-09-30 07:59:49 | BSE:COALINDIA-A | ₹ 429.05 | Vol: 52
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:59:50 | NSE:TCS-EQ | ₹ 2068.60 | Vol: 30
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|CIPLA|1790755192|1362|1362|1362|1362|1
[Live Tick] 2026-09-30 07:59:52 | NSE:CIPLA-EQ | ₹ 1362.00 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:59:53 | BSE:COALINDIA-A | ₹ 429.05 | Vol: 52
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|TCS|1790755194|2068.5|2068.5|2068.5|2068.5|3
[Live Tick] 2026-09-30 07:59:54 | NSE:TCS-EQ | ₹ 2068.50 | Vol: 3
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:59:56 | NSE:TCS-EQ | ₹ 2068.60 | Vol: 57
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|CIPLA|1790755197|1362.3|1362.3|1362.3|1362.3|3
[Live Tick] 2026-09-30 07:59:57 | NSE:CIPLA-EQ | ₹ 1362.30 | Vol: 3
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 07:59:58 | BSE:COALINDIA-A | ₹ 429.05 | Vol: 52
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790755200|429.05|429.05|429.05|429.05|52
[Live Tick] 2026-09-30 08:00:00 | BSE:COALINDIA-A | ₹ 429.05 | Vol: 52
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[Live Tick] 2026-09-30 08:00:01 | NSE:TCS-EQ | ₹ 2068.10 | Vol: 8
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|CIPLA|1790755202|1362.3|1362.3|1362.3|1362.3|17
[Live Tick] 2026-09-30 08:00:02 | NSE:CIPLA-EQ | ₹ 1362.30 | Vol: 17
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 08:00:03 | BSE:COALINDIA-A | ₹ 429.35 | Vol: 266
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790755205|429.35|429.35|429.35|429.35|266
[Live Tick] 2026-09-30 08:00:05 | BSE:COALINDIA-A | ₹ 429.35 | Vol: 266
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 08:00:06 | NSE:CIPLA-EQ | ₹ 1361.70 | Vol: 4
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[System Status] Total Symbols Active: 3 | Receiving Live Ticks: 3
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790755207|429.05|429.05|429.05|429.05|39
[Live Tick] 2026-09-30 08:00:07 | BSE:COALINDIA-A | ₹ 429.05 | Vol: 39
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 08:00:09 | BSE:COALINDIA-A | ₹ 429.05 | Vol: 39
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790755210|429.05|429.05|429.05|429.05|39
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 08:00:11 | NSE:TCS-EQ | ₹ 2068.10 | Vol: 63
[DEBUG] [FeedSimulator] Batch write: 3 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790755212|429.05|429.05|429.05|429.05|39
[Live Tick] 2026-09-30 08:00:12 | BSE:COALINDIA-A | ₹ 429.05 | Vol: 39
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 08:00:13 | NSE:CIPLA-EQ | ₹ 1362.40 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790755215|429.05|429.05|429.05|429.05|39
[Live Tick] 2026-09-30 08:00:15 | BSE:COALINDIA-A | ₹ 429.05 | Vol: 39
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[Live Tick] 2026-09-30 08:00:16 | BSE:COALINDIA-A | ₹ 429.05 | Vol: 39
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790755217|429.05|429.1|429.05|429.1|91
[Live Tick] 2026-09-30 08:00:17 | BSE:COALINDIA-A | ₹ 429.10 | Vol: 52
[Live Tick] 2026-09-30 08:00:18 | NSE:TCS-EQ | ₹ 2068.10 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|TCS|1790755220|2068.2|2068.2|2068.2|2068.2|2
[Live Tick] 2026-09-30 08:00:20 | NSE:TCS-EQ | ₹ 2068.20 | Vol: 2
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[Live Tick] 2026-09-30 08:00:21 | BSE:COALINDIA-A | ₹ 429.10 | Vol: 52
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|TCS|1790755222|2068.2|2068.2|2068.2|2068.2|15
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[Live Tick] 2026-09-30 08:00:23 | NSE:TCS-EQ | ₹ 2068.10 | Vol: 15
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 08:00:24 | BSE:COALINDIA-A | ₹ 429.00 | Vol: 142
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|TCS|1790755224|2068.2|2068.2|2068.1|2068.1|22
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 08:00:25 | BSE:COALINDIA-A | ₹ 429.00 | Vol: 142
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[Live Tick] 2026-09-30 08:00:26 | BSE:COALINDIA-A | ₹ 429.00 | Vol: 142
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|CIPLA|1790755227|1362.3|1362.3|1362.3|1362.3|6
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 08:00:28 | NSE:CIPLA-EQ | ₹ 1362.30 | Vol: 6
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|TCS|1790755229|2068.4|2068.4|2068.4|2068.4|2
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 08:00:30 | BSE:COALINDIA-A | ₹ 429.05 | Vol: 36
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790755231|429|429|429|429|37
[Live Tick] 2026-09-30 08:00:31 | BSE:COALINDIA-A | ₹ 429.00 | Vol: 37
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[Live Tick] 2026-09-30 08:00:33 | BSE:COALINDIA-A | ₹ 429.00 | Vol: 37
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|TCS|1790755234|2068.4|2068.4|2068.4|2068.4|3
[Live Tick] 2026-09-30 08:00:34 | NSE:TCS-EQ | ₹ 2068.40 | Vol: 3
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[Live Tick] 2026-09-30 08:00:35 | NSE:CIPLA-EQ | ₹ 1362.50 | Vol: 11
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|TCS|1790755236|2068.3|2068.3|2068.3|2068.3|1
[Live Tick] 2026-09-30 08:00:36 | NSE:TCS-EQ | ₹ 2068.30 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[System Status] Total Symbols Active: 3 | Receiving Live Ticks: 3
[Live Tick] 2026-09-30 08:00:38 | NSE:TCS-EQ | ₹ 2068.30 | Vol: 2
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|TCS|1790755238|2068.3|2068.8|2068.3|2068.8|26
[Live Tick] 2026-09-30 08:00:39 | BSE:COALINDIA-A | ₹ 429.00 | Vol: 37
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 08:00:40 | BSE:COALINDIA-A | ₹ 429.00 | Vol: 37
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790755241|429|429|429|429|37
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[Live Tick] 2026-09-30 08:00:42 | NSE:TCS-EQ | ₹ 2068.80 | Vol: 3
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790755243|429.3|429.3|429.3|429.3|10
[Live Tick] 2026-09-30 08:00:43 | BSE:COALINDIA-A | ₹ 429.30 | Vol: 10
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 08:00:44 | NSE:TCS-EQ | ₹ 2068.70 | Vol: 4
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|CIPLA|1790755246|1362.6|1362.6|1362.6|1362.6|11
[Live Tick] 2026-09-30 08:00:46 | NSE:CIPLA-EQ | ₹ 1362.60 | Vol: 11
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[Live Tick] 2026-09-30 08:00:48 | BSE:COALINDIA-A | ₹ 429.45 | Vol: 219
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|TCS|1790755248|2069|2069|2069|2069|13
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 08:00:49 | BSE:COALINDIA-A | ₹ 429.45 | Vol: 219
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790755251|429.1|429.1|429.1|429.1|147
[Live Tick] 2026-09-30 08:00:51 | BSE:COALINDIA-A | ₹ 429.10 | Vol: 147
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[Live Tick] 2026-09-30 08:00:52 | NSE:CIPLA-EQ | ₹ 1363.30 | Vol: 9
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790755253|429.15|429.15|429.15|429.15|95
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 08:00:54 | BSE:COALINDIA-A | ₹ 429.15 | Vol: 95
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|TCS|1790755255|2069|2069|2069|2069|21
[Live Tick] 2026-09-30 08:00:55 | NSE:TCS-EQ | ₹ 2069.00 | Vol: 21
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 08:00:57 | NSE:TCS-EQ | ₹ 2069.00 | Vol: 20
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790755258|429.15|429.15|429.15|429.15|95
[Live Tick] 2026-09-30 08:00:58 | BSE:COALINDIA-A | ₹ 429.15 | Vol: 95
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[Live Tick] 2026-09-30 08:01:00 | BSE:COALINDIA-A | ₹ 429.15 | Vol: 95
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790755261|429.6|429.6|429.6|429.6|9
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|TCS|1790755261|2069|2069|2069|2069|9
[Live Tick] 2026-09-30 08:01:01 | NSE:TCS-EQ | ₹ 2069.00 | Vol: 9
[DEBUG] [FeedSimulator] Batch write: 8 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 08:01:06 | BSE:COALINDIA-A | ₹ 429.60 | Vol: 9
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|CIPLA|1790755267|1362.8|1362.8|1362.8|1362.8|3
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 08:01:07 | NSE:TCS-EQ | ₹ 2069.70 | Vol: 1
[System Status] Total Symbols Active: 3 | Receiving Live Ticks: 3
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[Live Tick] 2026-09-30 08:01:08 | BSE:COALINDIA-A | ₹ 429.60 | Vol: 9
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|TCS|1790755269|2069.7|2069.7|2069.7|2069.7|3
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[Live Tick] 2026-09-30 08:01:10 | BSE:COALINDIA-A | ₹ 429.60 | Vol: 9
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 08:01:10 | NSE:CIPLA-EQ | ₹ 1363.20 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790755271|429.6|429.6|429.6|429.6|9
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 08:01:12 | NSE:CIPLA-EQ | ₹ 1363.20 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 3 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790755273|429.6|429.6|429.6|429.6|9
[Live Tick] 2026-09-30 08:01:13 | BSE:COALINDIA-A | ₹ 429.60 | Vol: 9
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 08:01:15 | BSE:COALINDIA-A | ₹ 429.60 | Vol: 9
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790755276|429.6|429.6|429.6|429.6|9
[Live Tick] 2026-09-30 08:01:16 | BSE:COALINDIA-A | ₹ 429.60 | Vol: 9
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 08:01:17 | NSE:CIPLA-EQ | ₹ 1363.30 | Vol: 2
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|CIPLA|1790755279|1363.3|1363.3|1363.3|1363.3|2
[Live Tick] 2026-09-30 08:01:19 | NSE:CIPLA-EQ | ₹ 1363.30 | Vol: 2
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790755281|429.6|429.6|429.6|429.6|9
[Live Tick] 2026-09-30 08:01:21 | BSE:COALINDIA-A | ₹ 429.60 | Vol: 9
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 08:01:22 | NSE:CIPLA-EQ | ₹ 1363.30 | Vol: 2
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790755284|429.6|429.6|429.6|429.6|9
[Live Tick] 2026-09-30 08:01:24 | BSE:COALINDIA-A | ₹ 429.60 | Vol: 9
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 08:01:25 | NSE:TCS-EQ | ₹ 2069.90 | Vol: 10
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|TCS|1790755285|2069.9|2069.9|2069.6|2069.6|11
[Live Tick] 2026-09-30 08:01:26 | BSE:COALINDIA-A | ₹ 429.60 | Vol: 9
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 08:01:27 | NSE:TCS-EQ | ₹ 2069.90 | Vol: 4
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790755288|429.6|429.6|429.6|429.6|9
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 08:01:28 | NSE:CIPLA-EQ | ₹ 1363.40 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[Live Tick] 2026-09-30 08:01:30 | NSE:CIPLA-EQ | ₹ 1363.40 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790755290|429.6|429.6|429.6|429.6|9
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[Live Tick] 2026-09-30 08:01:31 | BSE:COALINDIA-A | ₹ 429.65 | Vol: 154
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790755293|429.65|429.65|429.65|429.65|154
[Live Tick] 2026-09-30 08:01:33 | BSE:COALINDIA-A | ₹ 429.65 | Vol: 154
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[Live Tick] 2026-09-30 08:01:35 | NSE:TCS-EQ | ₹ 2070.10 | Vol: 19
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|TCS|1790755295|2070.1|2070.1|2070|2070|20
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 08:01:36 | NSE:TCS-EQ | ₹ 2069.80 | Vol: 3
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 08:01:37 | BSE:COALINDIA-A | ₹ 429.65 | Vol: 154
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[System Status] Total Symbols Active: 3 | Receiving Live Ticks: 3
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|TCS|1790755298|2070|2070|2070|2070|5
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[Live Tick] 2026-09-30 08:01:39 | NSE:TCS-EQ | ₹ 2070.00 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|TCS|1790755300|2069.7|2069.7|2069.7|2069.7|3
[Live Tick] 2026-09-30 08:01:40 | NSE:TCS-EQ | ₹ 2069.70 | Vol: 3
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 08:01:41 | NSE:CIPLA-EQ | ₹ 1363.30 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|TCS|1790755302|2069.7|2070|2069.7|2070|8
[Live Tick] 2026-09-30 08:01:43 | NSE:TCS-EQ | ₹ 2070.00 | Vol: 5
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790755304|429.65|429.65|429.65|429.65|154
[Live Tick] 2026-09-30 08:01:44 | BSE:COALINDIA-A | ₹ 429.65 | Vol: 154
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[Live Tick] 2026-09-30 08:01:45 | BSE:COALINDIA-A | ₹ 429.30 | Vol: 54
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|CIPLA|1790755306|1363.5|1363.5|1363.5|1363.5|6
[Live Tick] 2026-09-30 08:01:46 | NSE:CIPLA-EQ | ₹ 1363.50 | Vol: 6
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 08:01:48 | NSE:TCS-EQ | ₹ 2070.00 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|TCS|1790755309|2070|2070|2070|2070|1
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 08:01:49 | BSE:COALINDIA-A | ₹ 429.30 | Vol: 54
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[Live Tick] 2026-09-30 08:01:50 | BSE:COALINDIA-A | ₹ 429.30 | Vol: 54
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790755311|429.3|429.3|429.3|429.3|54
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 08:01:51 | NSE:CIPLA-EQ | ₹ 1363.30 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 08:01:52 | NSE:TCS-EQ | ₹ 2070.10 | Vol: 121
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790755313|429.3|429.3|429.3|429.3|54
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 08:01:54 | NSE:TCS-EQ | ₹ 2070.20 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 08:01:55 | NSE:CIPLA-EQ | ₹ 1363.30 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|TCS|1790755316|2070.3|2070.3|2070.3|2070.3|32
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 08:01:56 | BSE:COALINDIA-A | ₹ 429.30 | Vol: 54
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 08:01:57 | NSE:CIPLA-EQ | ₹ 1363.30 | Vol: 14
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|TCS|1790755318|2070.3|2070.3|2070.3|2070.3|10
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 08:01:58 | BSE:COALINDIA-A | ₹ 429.30 | Vol: 54
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 08:01:59 | BSE:COALINDIA-A | ₹ 429.30 | Vol: 54
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|TCS|1790755320|2070.3|2070.3|2070.3|2070.3|18
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 08:02:00 | NSE:TCS-EQ | ₹ 2070.50 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 08:02:02 | BSE:COALINDIA-A | ₹ 429.80 | Vol: 222
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|CIPLA|1790755322|1363.5|1363.5|1363.5|1363.5|16
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[Live Tick] 2026-09-30 08:02:03 | NSE:TCS-EQ | ₹ 2070.50 | Vol: 3
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790755324|429.6|429.6|429.6|429.6|1
[Live Tick] 2026-09-30 08:02:04 | BSE:COALINDIA-A | ₹ 429.60 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 3 bars persisted (250ms flush)
[Live Tick] 2026-09-30 08:02:06 | BSE:COALINDIA-A | ₹ 429.60 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790755327|429.6|429.6|429.6|429.6|1
[Live Tick] 2026-09-30 08:02:07 | BSE:COALINDIA-A | ₹ 429.60 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[System Status] Total Symbols Active: 3 | Receiving Live Ticks: 3
[Live Tick] 2026-09-30 08:02:08 | BSE:COALINDIA-A | ₹ 429.60 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|TCS|1790755329|2070.4|2070.4|2070.4|2070.4|1
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 08:02:09 | NSE:TCS-EQ | ₹ 2070.30 | Vol: 2
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[Live Tick] 2026-09-30 08:02:10 | NSE:TCS-EQ | ₹ 2070.40 | Vol: 10
[DEBUG] [FeedSimulator] Batch write: 3 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790755332|429.6|429.6|429.6|429.6|1
[Live Tick] 2026-09-30 08:02:12 | BSE:COALINDIA-A | ₹ 429.60 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 08:02:13 | NSE:TCS-EQ | ₹ 2070.80 | Vol: 2
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790755335|429.6|429.6|429.6|429.6|1
[Live Tick] 2026-09-30 08:02:15 | BSE:COALINDIA-A | ₹ 429.60 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 08:02:16 | NSE:CIPLA-EQ | ₹ 1363.50 | Vol: 11
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790755337|429.45|429.45|429.45|429.45|12
[Live Tick] 2026-09-30 08:02:17 | BSE:COALINDIA-A | ₹ 429.45 | Vol: 12
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 08:02:18 | BSE:COALINDIA-A | ₹ 429.45 | Vol: 12
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|TCS|1790755339|2070.4|2070.4|2070.3|2070.3|10
[Live Tick] 2026-09-30 08:02:19 | NSE:TCS-EQ | ₹ 2070.30 | Vol: 5
[DEBUG] [FeedSimulator] Batch write: 3 bars persisted (250ms flush)
[Live Tick] 2026-09-30 08:02:21 | NSE:TCS-EQ | ₹ 2070.40 | Vol: 2
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|TCS|1790755342|2070.4|2070.4|2070.4|2070.4|2
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 08:02:22 | BSE:COALINDIA-A | ₹ 429.45 | Vol: 12
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790755344|429.45|429.45|429.45|429.45|12
[Live Tick] 2026-09-30 08:02:24 | BSE:COALINDIA-A | ₹ 429.45 | Vol: 12
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 08:02:25 | NSE:TCS-EQ | ₹ 2070.00 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790755346|429.45|429.45|429.45|429.45|12
[Live Tick] 2026-09-30 08:02:26 | BSE:COALINDIA-A | ₹ 429.45 | Vol: 12
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 08:02:27 | BSE:COALINDIA-A | ₹ 429.45 | Vol: 12
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|CIPLA|1790755348|1363.5|1363.5|1363.5|1363.5|11
[Live Tick] 2026-09-30 08:02:28 | NSE:CIPLA-EQ | ₹ 1363.50 | Vol: 11
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 08:02:30 | BSE:COALINDIA-A | ₹ 429.45 | Vol: 12
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790755351|429.45|429.45|429.45|429.45|12
[Live Tick] 2026-09-30 08:02:31 | BSE:COALINDIA-A | ₹ 429.45 | Vol: 12
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[Live Tick] 2026-09-30 08:02:32 | BSE:COALINDIA-A | ₹ 429.45 | Vol: 12
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|CIPLA|1790755353|1363.1|1363.1|1363.1|1363.1|15
[Live Tick] 2026-09-30 08:02:33 | NSE:CIPLA-EQ | ₹ 1363.10 | Vol: 15
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 08:02:34 | NSE:TCS-EQ | ₹ 2070.30 | Vol: 67
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790755356|429.45|429.45|429.45|429.45|12
[Live Tick] 2026-09-30 08:02:36 | BSE:COALINDIA-A | ₹ 429.45 | Vol: 12
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 3 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[System Status] Total Symbols Active: 3 | Receiving Live Ticks: 3
[Live Tick] 2026-09-30 08:02:37 | NSE:TCS-EQ | ₹ 2070.10 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790755359|429.45|429.45|429.45|429.45|12
[Live Tick] 2026-09-30 08:02:39 | BSE:COALINDIA-A | ₹ 429.45 | Vol: 12
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 08:02:40 | BSE:COALINDIA-A | ₹ 429.45 | Vol: 12
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790755361|429.45|429.45|429.45|429.45|12
[Live Tick] 2026-09-30 08:02:41 | BSE:COALINDIA-A | ₹ 429.45 | Vol: 12
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790755364|429.45|429.45|429.45|429.45|12
[Live Tick] 2026-09-30 08:02:44 | BSE:COALINDIA-A | ₹ 429.45 | Vol: 12
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 08:02:45 | NSE:CIPLA-EQ | ₹ 1363.30 | Vol: 6
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790755366|429.45|429.45|429.45|429.45|12
[Live Tick] 2026-09-30 08:02:46 | BSE:COALINDIA-A | ₹ 429.45 | Vol: 12
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 08:02:48 | NSE:TCS-EQ | ₹ 2070.20 | Vol: 3
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790755369|429.45|429.45|429.45|429.45|12
[Live Tick] 2026-09-30 08:02:49 | BSE:COALINDIA-A | ₹ 429.45 | Vol: 12
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 08:02:51 | NSE:CIPLA-EQ | ₹ 1363.20 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790755372|429.45|429.45|429.45|429.45|12
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 08:02:53 | BSE:COALINDIA-A | ₹ 429.45 | Vol: 12
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|TCS|1790755374|2070.1|2070.1|2070.1|2070.1|3
[Live Tick] 2026-09-30 08:02:54 | NSE:TCS-EQ | ₹ 2070.10 | Vol: 3
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 08:02:55 | NSE:CIPLA-EQ | ₹ 1363.30 | Vol: 11
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|TCS|1790755377|2070.2|2070.2|2070.2|2070.2|15
[Live Tick] 2026-09-30 08:02:57 | NSE:TCS-EQ | ₹ 2070.20 | Vol: 15
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 08:02:58 | BSE:COALINDIA-A | ₹ 429.45 | Vol: 12
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|TCS|1790755379|2070.5|2070.5|2070.5|2070.5|4
[Live Tick] 2026-09-30 08:02:59 | NSE:TCS-EQ | ₹ 2070.50 | Vol: 4
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 08:03:00 | NSE:TCS-EQ | ₹ 2070.50 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|CIPLA|1790755381|1363.3|1363.3|1363.3|1363.3|5
[Live Tick] 2026-09-30 08:03:01 | NSE:CIPLA-EQ | ₹ 1363.30 | Vol: 5
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 08:03:03 | BSE:COALINDIA-A | ₹ 429.75 | Vol: 238
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|TCS|1790755384|2070.5|2070.5|2070.5|2070.5|1
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 08:03:05 | BSE:COALINDIA-A | ₹ 429.75 | Vol: 238
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|CIPLA|1790755386|1363.3|1363.3|1363.3|1363.3|10
[Live Tick] 2026-09-30 08:03:06 | NSE:CIPLA-EQ | ₹ 1363.30 | Vol: 10
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 08:03:07 | BSE:COALINDIA-A | ₹ 429.75 | Vol: 238
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[System Status] Total Symbols Active: 3 | Receiving Live Ticks: 3
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790755388|429.75|429.75|429.75|429.75|238
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 08:03:08 | NSE:CIPLA-EQ | ₹ 1363.20 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790755390|429.75|429.75|429.75|429.75|238
[Live Tick] 2026-09-30 08:03:10 | BSE:COALINDIA-A | ₹ 429.75 | Vol: 238
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 08:03:12 | NSE:TCS-EQ | ₹ 2070.40 | Vol: 5
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790755393|429.75|429.75|429.75|429.75|238
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[Live Tick] 2026-09-30 08:03:14 | NSE:TCS-EQ | ₹ 2070.40 | Vol: 5
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 08:03:15 | BSE:COALINDIA-A | ₹ 429.75 | Vol: 238
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790755396|429.75|429.75|429.75|429.75|238
[Live Tick] 2026-09-30 08:03:16 | BSE:COALINDIA-A | ₹ 429.75 | Vol: 238
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 08:03:18 | NSE:CIPLA-EQ | ₹ 1363.20 | Vol: 1
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790755398|429.75|429.75|429.75|429.75|238
[DEBUG] [FeedSimulator] Batch write: 3 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 08:03:19 | NSE:TCS-EQ | ₹ 2070.40 | Vol: 5
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|CIPLA|1790755401|1363.2|1363.2|1363.2|1363.2|5
[Live Tick] 2026-09-30 08:03:21 | NSE:CIPLA-EQ | ₹ 1363.20 | Vol: 5
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 08:03:22 | BSE:COALINDIA-A | ₹ 429.45 | Vol: 2
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790755403|429.45|429.45|429.45|429.45|2
[Live Tick] 2026-09-30 08:03:23 | BSE:COALINDIA-A | ₹ 429.45 | Vol: 2
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 08:03:25 | BSE:COALINDIA-A | ₹ 429.45 | Vol: 2
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790755406|429.45|429.45|429.45|429.45|2
[Live Tick] 2026-09-30 08:03:26 | BSE:COALINDIA-A | ₹ 429.45 | Vol: 2
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 08:03:27 | BSE:COALINDIA-A | ₹ 429.45 | Vol: 2
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790755409|429.45|429.45|429.45|429.45|2
[Live Tick] 2026-09-30 08:03:29 | BSE:COALINDIA-A | ₹ 429.45 | Vol: 2
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 08:03:30 | NSE:TCS-EQ | ₹ 2070.10 | Vol: 5
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790755411|429.4|429.4|429.4|429.4|32
[Live Tick] 2026-09-30 08:03:31 | BSE:COALINDIA-A | ₹ 429.40 | Vol: 32
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 08:03:32 | BSE:COALINDIA-A | ₹ 429.40 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 2 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|TCS|1790755414|2070.3|2070.3|2070.3|2070.3|1
[Live Tick] 2026-09-30 08:03:34 | NSE:TCS-EQ | ₹ 2070.30 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 08:03:35 | BSE:COALINDIA-A | ₹ 429.35 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|CIPLA|1790755416|1363.2|1363.2|1363.2|1363.2|11
[Live Tick] 2026-09-30 08:03:36 | NSE:CIPLA-EQ | ₹ 1363.20 | Vol: 11
[DEBUG] [FeedSimulator] Batch write: 3 bars persisted (250ms flush)
[System Status] Total Symbols Active: 3 | Receiving Live Ticks: 3
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 08:03:37 | BSE:COALINDIA-A | ₹ 429.25 | Vol: 13
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|CIPLA|1790755418|1363.2|1363.2|1363.2|1363.2|11
[Live Tick] 2026-09-30 08:03:38 | NSE:CIPLA-EQ | ₹ 1363.20 | Vol: 11
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[Live Tick] 2026-09-30 08:03:40 | BSE:COALINDIA-A | ₹ 429.25 | Vol: 22
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[IPC_LIVE_BAR] Broadcasted: LIVE_BAR|COALINDIA|1790755421|429.2|429.2|429.2|429.2|1
[Live Tick] 2026-09-30 08:03:41 | BSE:COALINDIA-A | ₹ 429.20 | Vol: 1
[DEBUG] [FeedSimulator] Batch write: 1 bars persisted (250ms flush)
[D