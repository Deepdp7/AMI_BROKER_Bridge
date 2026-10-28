/**
 * The symbol list at most every `ms` (live prices can arrive 10 times a second; Symbol Setup
 * and Broker Connection don't need that). Adding or removing a symbol shows at once.
 */
import { useEffect, useState } from 'react'
import { useAppStore, type SymbolFeed } from '../store/appStore'

export function useThrottledSymbols(ms = 1000): SymbolFeed[] {
  const [value, setValue] = useState(() => useAppStore.getState().symbols)

  useEffect(() => {
    let latest = useAppStore.getState().symbols
    let shown = latest
    let last = Date.now()
    let timer: ReturnType<typeof setTimeout> | null = null
    setValue(latest)

    const show = () => {
      timer = null
      last = Date.now()
      shown = latest
      setValue(latest)
    }
    const unsub = useAppStore.subscribe(state => {
      if (state.symbols === latest) return
      latest = state.symbols
      // Added or removed: the user is waiting for it
      if (latest.length !== shown.length || Date.now() - last >= ms) {
        if (timer) clearTimeout(timer)
        show()
      } else if (!timer) {
        timer = setTimeout(show, ms - (Date.now() - last))
      }
    })
    return () => { unsub(); if (timer) clearTimeout(timer) }
  }, [ms])

  return value
}
