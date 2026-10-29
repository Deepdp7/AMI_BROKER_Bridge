import zerodhaKite from '../../assets/brokers/zerodha_kite.png'
import fyers from '../../assets/brokers/fyers.png'
import dhan from '../../assets/brokers/dhan.png'
import upstox from '../../assets/brokers/upstox.png'
import angelOne from '../../assets/brokers/angel_one.png'
import flattrade from '../../assets/brokers/flattrade.png'
import shoonya from '../../assets/brokers/shoonya.png'
import zebu from '../../assets/brokers/zebu.png'
import kotakNeo from '../../assets/brokers/kotak_neo.png'
import compositedge from '../../assets/brokers/compositedge.png'
import fivepaisa from '../../assets/brokers/fivepaisa_xts.png'
import jainam from '../../assets/brokers/jainam.png'
import ibulls from '../../assets/brokers/ibulls.png'
import rmoney from '../../assets/brokers/rmoney.png'
import tradesmart from '../../assets/brokers/tradesmart.png'

/**
 * Broker marks, taken from each broker's own website icon. `light` ones have a transparent
 * background and a mark that is dark or blue, so they sit on a light tile; the others carry
 * their own fill (a circle or a coloured square) and stand bare.
 */
const LOGOS: Record<string, { src: string; light: boolean }> = {
  zerodha_kite: { src: zerodhaKite, light: true },
  fyers: { src: fyers, light: true },
  angel_one: { src: angelOne, light: true },
  flattrade: { src: flattrade, light: true },
  dhan: { src: dhan, light: false },
  shoonya: { src: shoonya, light: false },
  upstox: { src: upstox, light: false },
  zebu: { src: zebu, light: true },
  kotak_neo: { src: kotakNeo, light: false },
  compositedge: { src: compositedge, light: false },
  fivepaisa_xts: { src: fivepaisa, light: false },
  // The mark has a black stroke that vanishes on the dark theme
  jainam: { src: jainam, light: true },
  ibulls: { src: ibulls, light: false },
  rmoney: { src: rmoney, light: false },
  tradesmart: { src: tradesmart, light: false },
}

export const BROKER_NAMES: Record<string, string> = {
  zerodha_kite: 'Zerodha Kite',
  fyers: 'Fyers',
  dhan: 'Dhan',
  angel_one: 'Angel One',
  upstox: 'Upstox',
  flattrade: 'Flattrade',
  shoonya: 'Shoonya',
  zebu: 'Zebu',
  tradesmart: 'TradeSmart',
  compositedge: 'Compositedge',
  fivepaisa_xts: '5paisa (XTS)',
  jainam: 'Jainam',
  ibulls: 'IndiaBulls',
  rmoney: 'Rmoney',
  kotak_neo: 'Kotak Neo',
}

interface Props {
  brokerType: string
  size?: number
}

export default function BrokerLogo({ brokerType, size = 24 }: Props) {
  const logo = LOGOS[brokerType]
  const name = BROKER_NAMES[brokerType] || 'Broker'
  if (!logo) {
    return (
      <span className="broker-logo is-fallback" style={{ width: size, height: size, fontSize: size * 0.4 }} aria-label={name}>
        {name.slice(0, 2).toUpperCase()}
      </span>
    )
  }
  const pad = logo.light ? Math.max(2, Math.round(size * 0.14)) : 0
  return (
    <span className={`broker-logo${logo.light ? ' is-light' : ''}`} style={{ width: size, height: size, padding: pad }}>
      <img src={logo.src} alt={`${name} logo`} draggable={false} />
    </span>
  )
}
