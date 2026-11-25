/** Network settings of the data engine. Everything binds to localhost only. */
export const HOST = '127.0.0.1'

/** HTTP + WebSocket API: the desktop app, the AmiBroker plugin's history requests, broker login redirects */
export const HTTP_PORT = Number(process.env.PORT) || 7890

/**
 * Line protocol to the AmiBroker plugin (LIVE_BAR / QUOTE / SYNC push, VIEW / NOTE / CMD back). The plugin always uses 7891:
 * the override is for the performance harness, which runs beside a real engine.
 */
export const AMIBROKER_IPC_PORT = Number(process.env.DATABRIDGE_IPC_PORT) || 7891
