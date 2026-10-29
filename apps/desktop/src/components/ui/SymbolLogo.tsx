import { useEffect, useRef, useState } from 'react'
import { Droplet, Flame } from 'lucide-react'
import { BASE_URL } from '../../api/apiClient'

/** Tickers the engine said have no logo (a final answer) */
const noLogo = new Set<string>()

/**
 * When a picture fails for another reason (the engine is still starting, a logo server is out of
 * reach, the PC is offline) it is asked for again after these pauses, then given up on for now
 * (the next time the card is drawn it tries again). Without this, the cards drawn while the
 * engine started stayed lettered for the whole session.
 */
export const LOGO_RETRY_MS = [1500, 4000, 10_000, 25_000, 60_000]

/** Letters for the tile: "TCS" → "TC", "NIFTY26NOVFUT" → "NI", "M&M" → "MM" */
const lettersOf = (ticker: string) => ticker.replace(/[^A-Za-z]/g, '').slice(0, 2).toUpperCase() || '?'

/** A steady colour per name, so a symbol keeps its tile colour */
const hueOf = (ticker: string) => {
  let h = 0
  for (let i = 0; i < ticker.length; i++) h = (h * 31 + ticker.charCodeAt(i)) % 360
  return h
}

/** What a commodity is drawn as: a metal's chemical symbol in its colour, or an energy icon (MCX has no company logos) */
interface Commodity { label?: string; icon?: 'oil' | 'gas'; bg: string; fg: string }
const COMMODITIES: Array<[RegExp, Commodity]> = [
  [/^GOLD/, { label: 'Au', bg: '#f5c542', fg: '#5b4300' }],
  [/^SILVER/, { label: 'Ag', bg: '#cbd2da', fg: '#3b4350' }],
  [/^COPPER/, { label: 'Cu', bg: '#c8793e', fg: '#fff3e8' }],
  [/^ZINC/, { label: 'Zn', bg: '#7f93a8', fg: '#f1f5f9' }],
  [/^LEAD/, { label: 'Pb', bg: '#5b6470', fg: '#e5e7eb' }],
  [/^NICKEL/, { label: 'Ni', bg: '#8aa39b', fg: '#10231d' }],
  [/^ALUMINI|^ALUMINIUM/, { label: 'Al', bg: '#9fb4c7', fg: '#14202b' }],
  [/^CRUDE/, { icon: 'oil', bg: '#1f2937', fg: '#f59e0b' }],
  [/^NATURALGAS|^NATGAS/, { icon: 'gas', bg: '#0e3a4f', fg: '#38bdf8' }],
  [/^COTTON/, { label: 'Ct', bg: '#e8edf2', fg: '#3b4350' }],
  [/^MENTHA/, { label: 'Mt', bg: '#14532d', fg: '#bbf7d0' }],
]

/** The commodity a ticker is (GOLDM26NOVFUT → gold), when it is an MCX one */
function commodityOf(ticker: string, exchange?: string): Commodity | null {
  if (exchange && exchange !== 'MCX') return null
  const name = ticker.toUpperCase().replace(/\d{2}[A-Z]{3}(FUT|\d.*)$/, '')
  return COMMODITIES.find(([re]) => re.test(name))?.[1] ?? null
}

interface Props {
  ticker: string
  /** Kept for callers; the engine decides which symbols have a logo (indices like NIFTY do) */
  instrumentType?: string
  exchange?: string
  size?: number
}

/** The company's logo; for a commodity its drawn icon; otherwise a lettered tile (while it loads, or when there is none) */
export default function SymbolLogo({ ticker, exchange, size = 30 }: Props) {
  const commodity = commodityOf(ticker, exchange)
  const [final, setFinal] = useState(() => noLogo.has(ticker))
  // Showing the picture, or the letters while a failed picture waits for its next try
  const [letters, setLetters] = useState(false)
  // 0 = the first try; a retry asks under a new address so the browser doesn't reuse the failure
  const [attempt, setAttempt] = useState(0)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  useEffect(() => () => clearTimeout(timer.current), [])

  const base = `${BASE_URL}/symbols/logo/${encodeURIComponent(ticker)}`

  const failed = async () => {
    // Why? A 404 is final; anything else (503 "not ready", the engine not up yet) is "not now"
    let status = 0
    try { status = (await fetch(base, { method: 'HEAD' })).status } catch { /* engine not up yet */ }
    if (status === 404) { noLogo.add(ticker); setFinal(true); return }
    setLetters(true)
    if (attempt >= LOGO_RETRY_MS.length) return   // letters, until the card is drawn again
    timer.current = setTimeout(() => { setAttempt(attempt + 1); setLetters(false) }, LOGO_RETRY_MS[attempt])
  }

  // A commodity has no company logo anywhere: its drawn icon, without asking
  if (commodity) {
    return (
      <span className="sym-logo is-letters" style={{ width: size, height: size, fontSize: size * 0.4, background: commodity.bg, color: commodity.fg }} aria-hidden="true">
        {commodity.icon === 'oil' ? <Droplet size={size * 0.55} fill="currentColor" /> : commodity.icon === 'gas' ? <Flame size={size * 0.55} fill="currentColor" /> : commodity.label}
      </span>
    )
  }

  if (final || letters) {
    const hue = hueOf(ticker)
    return (
      <span
        className="sym-logo is-letters"
        style={{ width: size, height: size, fontSize: size * 0.38, background: `hsl(${hue} 45% 22%)`, color: `hsl(${hue} 70% 78%)` }}
        aria-hidden="true"
      >
        {lettersOf(ticker)}
      </span>
    )
  }
  return (
    <span className="sym-logo" style={{ width: size, height: size }}>
      <img
        src={attempt ? `${base}?r=${attempt}` : base}
        alt=""
        loading="lazy"
        draggable={false}
        onError={() => { void failed() }}
      />
    </span>
  )
}
