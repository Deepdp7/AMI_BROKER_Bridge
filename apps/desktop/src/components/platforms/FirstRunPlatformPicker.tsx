import { useEffect, useState } from 'react'
import { usePlatforms } from '../../lib/platforms'
import { PlatformPicker } from './PlatformPicker'

// "Later" puts it off until the next start, not for good
let dismissedThisRun = false

/** Asks once which platforms the user works with (until they answer) */
export function FirstRunPlatformPicker() {
  const { state } = usePlatforms()
  const [open, setOpen] = useState(false)
  useEffect(() => {
    if (state && !state.asked && !dismissedThisRun) setOpen(true)
  }, [state])
  if (!state) return null
  return (
    <PlatformPicker
      open={open}
      platforms={state.platforms}
      chosen={state.chosen}
      onClose={() => { dismissedThisRun = true; setOpen(false) }}
    />
  )
}
