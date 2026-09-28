"use strict";

// src/workers/fyersWorker.ts
var import_worker_threads = require("worker_threads");
process.env.DEMO_TICKS = "true";
var fyers = require("fyers-api-v3");
if (!import_worker_threads.parentPort) {
  throw new Error("This file must be run as a worker thread");
}
var { token, logPath } = import_worker_threads.workerData;
var socket = null;
var heartbeatInterval = null;
var lastMessageTime = Date.now();
var lastVolume = /* @__PURE__ */ new Map();
function startHeartbeat() {
  if (heartbeatInterval) clearInterval(heartbeatInterval);
  heartbeatInterval = setInterval(() => {
    if (Date.now() - lastMessageTime > 3e4) {
      import_worker_threads.parentPort.postMessage({ type: "reconnect_request" });
    }
  }, 1e4);
}
function log(level, msg) {
  import_worker_threads.parentPort.postMessage({ type: "log", level, message: msg });
}
function doSubscribe(instruments) {
  if (process.env.DEMO_TICKS === "true") return;
  if (!socket || instruments.length === 0) return;
  try {
    const result = socket.subscribe(instruments);
    log("info", `[FYERS_WS_SUBSCRIBE] count=${instruments.length} result=${JSON.stringify(result)}`);
  } catch (e) {
    log("error", `[FYERS_WS_SUBSCRIBE] subscribe() threw: ${e}`);
  }
}
function processMessage(message) {
  log("info", `[FYERS_WS_MESSAGE] *** RECEIVED *** type=${message?.type || "data"} symbol=${message?.symbol || "none"}`);
  lastMessageTime = Date.now();
  log("info", `[RAW_FYERS_WS] ${JSON.stringify(message).substring(0, 500)}`);
  if (message && message.type && !message.symbol) return;
  if (!message || !message.symbol || !message.ltp) return;
  let tickVol = 0;
  const currentVol = message.vol_traded_today;
  if (currentVol !== void 0 && currentVol > 0) {
    const prevVol = lastVolume.get(message.symbol);
    if (prevVol !== void 0) {
      tickVol = Math.max(0, currentVol - prevVol);
    }
    lastVolume.set(message.symbol, currentVol);
  } else if (message.last_traded_qty) {
    tickVol = message.last_traded_qty;
  }
  const exchTime = message.exch_feed_time || message.exchange_feed_time;
  const tick = {
    instrumentId: message.symbol,
    timestamp: exchTime ? exchTime * 1e3 : Date.now(),
    lastPrice: message.ltp,
    volume: tickVol
  };
  if (process.env.DEMO_TICKS === "true") {
    log("info", `[DEMO_TICK_PROCESSED] symbol=${tick.instrumentId} ltp=${tick.lastPrice.toFixed(2)}`);
  }
  log("info", `[FYERS_TICK] symbol=${tick.instrumentId} price=${tick.lastPrice} vol=${tick.volume} ts=${tick.timestamp}`);
  import_worker_threads.parentPort.postMessage({ type: "ticks", ticks: [tick] });
}
function initSocket(instruments = []) {
  if (process.env.DEMO_TICKS === "true") {
    log("info", "[FyersWorker] DEMO_TICKS is true. Starting demo loop for NSE:BRITANNIA-EQ.");
    if (socket) clearInterval(socket);
    let demoPrice = 5e3;
    let demoVol = 0;
    socket = setInterval(() => {
      const sign = Math.random() > 0.5 ? 1 : -1;
      demoPrice += sign * (0.25 + Math.random() * 0.75);
      demoVol += Math.floor(Math.random() * 5) + 1;
      const timestampSec = Math.floor(Date.now() / 1e3);
      const fakeMessage = {
        symbol: "NSE:BRITANNIA-EQ",
        ltp: demoPrice,
        vol_traded_today: demoVol,
        exch_feed_time: timestampSec,
        type: "sf"
      };
      log("info", `[DEMO_TICK] symbol=NSE:BRITANNIA-EQ ltp=${demoPrice.toFixed(2)} volume=${demoVol} timestamp=${timestampSec}`);
      processMessage(fakeMessage);
    }, 1e3);
    import_worker_threads.parentPort.postMessage({ type: "log", level: "info", message: "[FyersWorker] Demo mode initialized" });
    return;
  }
  if (socket) {
    try {
      socket.close();
    } catch (_) {
    }
    socket = null;
  }
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
    heartbeatInterval = null;
  }
  log("info", `[FyersWorker] Initializing socket. Token length: ${token.length}, AppId: ${token.split(":")[0]}`);
  try {
    socket = fyers.fyersDataSocket.getInstance(token, logPath, false);
    log("info", `[FyersWorker] getInstance() succeeded`);
  } catch (initErr) {
    log("error", `[FyersWorker] getInstance() FAILED: ${initErr.message}`);
    import_worker_threads.parentPort.postMessage({ type: "error", error: "AUTH_REQUIRED", detail: initErr.message });
    return;
  }
  socket.on("connect", () => {
    log("info", "[FYERS_WS_CONNECT] WebSocket connected! Subscribing now...");
    lastMessageTime = Date.now();
    startHeartbeat();
    doSubscribe(instruments);
  });
  socket.on("message", (message) => {
    processMessage(message);
  });
  socket.on("error", (err) => {
    log("error", `[FYERS_WS_ERROR] ${JSON.stringify(err)}`);
  });
  socket.on("close", () => {
    log("warn", "[FYERS_WS_CLOSE] Socket closed. Will reconnect in 5s...");
    socket = null;
    if (heartbeatInterval) {
      clearInterval(heartbeatInterval);
      heartbeatInterval = null;
    }
    setTimeout(() => {
      import_worker_threads.parentPort.postMessage({ type: "reconnect_request" });
    }, 5e3);
  });
  socket.connect();
  if (typeof socket.autoreconnect === "function") {
    socket.autoreconnect();
    log("info", "[FyersWorker] autoreconnect() enabled");
  }
}
import_worker_threads.parentPort.on("message", (msg) => {
  if (msg.type === "init") {
    initSocket(msg.instruments);
  } else if (msg.type === "subscribe") {
    if (socket) {
      doSubscribe(msg.instruments);
    } else {
      initSocket(msg.instruments);
    }
  } else if (msg.type === "unsubscribe") {
    if (socket) {
      try {
        socket.unsubscribe(msg.instruments);
      } catch (e) {
      }
    }
  } else if (msg.type === "close") {
    if (socket) {
      if (process.env.DEMO_TICKS === "true") {
        clearInterval(socket);
      } else {
        try {
          socket.close();
        } catch (e) {
        }
      }
    }
    process.exit(0);
  }
});
