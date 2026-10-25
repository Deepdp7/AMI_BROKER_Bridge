/** Network settings of the data engine. Everything binds to localhost only. */
export const HOST = '127.0.0.1'

/** HTTP + WebSocket API: the desktop app, the AmiBroker plugin's history requests, broker login redirects */
export const HTTP_PORT = Number(process.env.PORT) || 7890

/** Line protocol to the AmiBroker plugin (LIVE_BAR / SYNC push, GET_QUOTES) */
export const AMIBROKER_IPC_PORT = 7891
