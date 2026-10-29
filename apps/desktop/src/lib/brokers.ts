/**
 * What the app tells clients about each broker: how to get API keys, how they log in, and how
 * fast 1-minute history downloads from it (from each broker's published limits: days of data
 * per request × requests allowed per minute).
 */
export interface BrokerInfo {
  name: string
  description: string
  authType: string
  apiUrl: string
  /** Where the client creates the API key, shown in the Add Broker dialog */
  setup: string
  keyLabel?: string
  secretLabel?: string
  /** The account's user ID is typed in too (the engine needs it for this broker) */
  userId?: { label: string; placeholder: string }
  /** The broker may leave you on its own page after login: offer to paste that page's address */
  pasteFallback?: boolean
  /** Logs in with the keys alone, no browser page (XTS market data API, Kotak Neo) */
  direct?: boolean
  /** The "secret" is several fields (Kotak: mobile, MPIN, authenticator key); they are sent joined with "|" */
  secretParts?: { label: string; placeholder: string; hidden?: boolean }[]
  /** History download speed, 1 (slow) to 5 (fastest) */
  speed: 1 | 2 | 3 | 4 | 5
  speedNote: string
}

export const BROKER_INFO: Record<string, BrokerInfo> = {
  dhan: {
    name: 'Dhan',
    description: 'DhanHQ v2. 1-minute history (5 years) + live market feed.',
    authType: 'Browser login (API Key + Secret)',
    apiUrl: 'https://dhanhq.co',
    setup: 'On web.dhan.co → My Profile → Access DhanHQ APIs, choose "API key" and create one. History and live data need Dhan\'s Data API plan.',
    userId: { label: 'Dhan Client ID', placeholder: '10-digit Client ID from your Dhan profile' },
    speed: 5,
    speedNote: 'Fastest history: about 3 months of data per request, 5 requests a second.',
  },
  zerodha_kite: {
    name: 'Zerodha Kite',
    description: 'Kite Connect v3. 1-minute history (60 days per request) + WebSocket tick stream.',
    authType: 'Browser login (API Key + Secret)',
    apiUrl: 'https://kite.trade',
    setup: 'Create an app on developers.kite.trade (the paid Kite Connect plan — the free Personal plan has no market data). Copy its API key and API secret.',
    speed: 4,
    speedNote: 'Fast history: about 2 months of data per request, 3 requests a second.',
  },
  angel_one: {
    name: 'Angel One',
    description: 'Angel One SmartAPI. 1-minute history (30 days per request) + WebSocket 2.0 feed.',
    authType: 'Browser login (SmartAPI key)',
    apiUrl: 'https://smartapi.angelone.in',
    setup: 'On smartapi.angelone.in → My Apps, create an app with the redirect URL below and copy its API Key and Secret Key. You log in on Angel One\'s own page; no PIN or TOTP is typed here.',
    keyLabel: 'API Key', secretLabel: 'Secret Key',
    speed: 4,
    speedNote: 'Fast history: about a month of data per request, 3 requests a second.',
  },
  fyers: {
    name: 'Fyers',
    description: 'Fyers API v3. 1-minute historical data + tick stream.',
    authType: 'Browser login (App ID + Secret)',
    apiUrl: 'https://fyers.in',
    setup: 'Create an app on myapi.fyers.in → Dashboard → Create App. Its App ID (ends in -100) is the API Key, its Secret ID the API Secret.',
    keyLabel: 'App ID (API Key)', secretLabel: 'Secret ID (API Secret)',
    speed: 3,
    speedNote: 'Medium: about 3 months of data per request, but only about 50 requests a minute and a daily limit.',
  },
  upstox: {
    name: 'Upstox',
    description: 'Upstox API v3. 1-minute history since 2022 + market data feed.',
    authType: 'Browser login (API Key + Secret)',
    apiUrl: 'https://upstox.com',
    setup: 'On account.upstox.com/developer/apps, create an app with the redirect URL below and copy its API Key and API Secret.',
    speed: 2,
    speedNote: 'Medium: about a month of data per request, about 60 requests a minute. History starts in 2022.',
  },
  flattrade: {
    name: 'Flattrade',
    description: 'Flattrade Pi API (v2). 1-minute history + live touchline feed.',
    authType: 'Browser login (API Key + Secret)',
    apiUrl: 'https://flattrade.in',
    setup: 'On wall.flattrade.in → Pi → API (v2), create an API key with the redirect URL below and your static IP, wait for approval, then copy the API key and secret key.',
    keyLabel: 'API Key', secretLabel: 'Secret Key',
    speed: 1,
    speedNote: 'Slow history: about 5 days of data per request.',
  },
  shoonya: {
    name: 'Shoonya',
    description: 'Finvasia Shoonya API. 1-minute history + live touchline feed.',
    authType: 'Browser login (OAuth Client ID + Secret)',
    apiUrl: 'https://shoonya.com',
    setup: 'On trade.shoonya.com → profile → API Key, set the redirect URL below and register this PC\'s internet (static) IP address (Shoonya refuses API calls from other IPs). Copy the Client ID and Secret Code.',
    keyLabel: 'Client ID (OAuth)', secretLabel: 'Secret Code',
    userId: { label: 'Shoonya User ID', placeholder: 'Your Shoonya login ID, e.g. FA12345' },
    pasteFallback: true,
    speed: 1,
    speedNote: 'Slow history: about 5 days of data per request.',
  },
  zebu: {
    name: 'Zebu',
    description: 'Zebu MYNT API (Noren). 1-minute history + live touchline feed.',
    authType: 'Browser login (OAuth Client ID + Secret)',
    apiUrl: 'https://zebuetrade.com',
    setup: 'In the Zebu MYNT app → API, create an app with the redirect URL below and this PC\'s internet (static) IP address (Zebu requires it). Copy the OAuth Client ID (your user ID followed by _U) and the Secret key.',
    keyLabel: 'Client ID (OAuth)', secretLabel: 'Secret Key',
    userId: { label: 'Zebu User ID', placeholder: 'Your Zebu login ID, e.g. Z56004' },
    pasteFallback: true,
    speed: 1,
    speedNote: 'Slow history: about 5 days of data per request.',
  },
  tradesmart: {
    name: 'TradeSmart',
    description: 'TradeSmart API v2 (Noren). 1-minute history + live touchline feed.',
    authType: 'Browser login (App ID + Secret)',
    apiUrl: 'https://tradesmartonline.in',
    setup: 'On TradeSmart\'s API dashboard, create an app with the redirect URL below and this PC\'s internet (static) IP address. Copy its App ID and Secret key.',
    keyLabel: 'App ID (OAuth Client ID)', secretLabel: 'Secret Key',
    userId: { label: 'TradeSmart User ID', placeholder: 'Your TradeSmart login ID' },
    pasteFallback: true,
    speed: 1,
    speedNote: 'Slow history: about 5 days of data per request, 120 requests a minute.',
  },
  kotak_neo: {
    name: 'Kotak Neo',
    description: 'Kotak Neo Trade API v2. 1-minute history for NSE, BSE and F&O + live feed.',
    authType: 'Access token + client code, mobile, MPIN and authenticator key (no browser)',
    apiUrl: 'https://www.kotaksecurities.com',
    setup: 'In the Kotak Neo app or website go to Invest → Trade API, create an application and copy its access token. You also need your client code (UCC), the mobile number registered with Kotak, your trading MPIN, and an authenticator registered for the API: when it shows the secret key next to the QR code, copy that key here (DataBridge Pro then makes the daily code by itself). A 6-digit code works for one login only. Commodity (MCX) and currency have live prices but no history at Kotak, so they are not listed.',
    keyLabel: 'Access Token',
    userId: { label: 'Kotak Client Code (UCC)', placeholder: 'Your client code, e.g. A1B2C' },
    secretParts: [
      { label: 'Registered mobile number', placeholder: '10-digit mobile number' },
      { label: 'Trading MPIN', placeholder: '6-digit MPIN', hidden: true },
      { label: 'Authenticator secret key (or the 6-digit code now)', placeholder: 'Letters and digits 2-7, from the authenticator setup' },
    ],
    direct: true,
    speed: 2,
    speedNote: 'Medium: about a month of data per request, but only about one request a second.',
  },
  ...Object.fromEntries(([
    ['compositedge', 'Compositedge', 'https://www.compositedge.com', 'On Compositedge\'s XTS developer portal'],
    ['fivepaisa_xts', '5paisa (XTS)', 'https://www.5paisa.com', 'On 5paisa\'s XTS developer portal'],
    ['jainam', 'Jainam', 'https://www.jainam.in', 'On Jainam\'s XTS developer portal (jtrade.jainam.in)'],
    ['ibulls', 'IndiaBulls', 'https://www.indiabullssecurities.com', 'On IndiaBulls\' XTS developer portal'],
    ['rmoney', 'Rmoney', 'https://www.rmoneyindia.com', 'On Rmoney\'s XTS developer portal'],
  ] as const).map(([key, name, apiUrl, where]): [string, BrokerInfo] => [key, {
    name,
    description: `${name} XTS market data API. 1-minute history + live touchline feed.`,
    authType: 'Market Data API key (no browser login)',
    apiUrl,
    setup: `${where}, create a Market Data API app (not an Interactive one) and copy its API Key and Secret Key. No redirect URL is needed.`,
    keyLabel: 'Market Data API Key', secretLabel: 'Market Data Secret Key',
    direct: true,
    speed: 2,
    speedNote: 'Medium: about 6 days of data per request, paced to about 60 requests a minute.',
  }])),
}

/** Fastest history first */
export const BROKER_ORDER = [
  'dhan', 'zerodha_kite', 'angel_one', 'fyers', 'upstox', 'kotak_neo',
  'compositedge', 'fivepaisa_xts', 'jainam', 'ibulls', 'rmoney',
  'flattrade', 'shoonya', 'zebu', 'tradesmart',
]

export const SPEED_LABEL: Record<number, string> = { 5: 'Fastest', 4: 'Fast', 3: 'Medium', 2: 'Medium', 1: 'Slow' }
export const SPEED_COLOR: Record<number, string> = { 5: 'var(--accent)', 4: '#22c55e', 3: '#f59e0b', 2: '#f59e0b', 1: '#fb7185' }

export const redirectUrlFor = (brokerType: string) => `http://127.0.0.1:7890/api/callback/${brokerType}`
