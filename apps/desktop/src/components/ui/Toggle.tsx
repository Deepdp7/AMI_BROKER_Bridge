/** On/off switch */
export function Toggle({ checked, onChange, id, disabled, label }: {
  checked: boolean
  onChange: (v: boolean) => void
  id: string
  disabled?: boolean
  /** Spoken name when no visible <label> points at it */
  label?: string
}) {
  return (
    <label className="toggle" htmlFor={id} style={{ opacity: disabled ? 0.45 : 1 }}>
      <input id={id} type="checkbox" checked={checked} disabled={disabled} aria-label={label} onChange={e => onChange(e.target.checked)} />
      <span className="toggle-slider" />
    </label>
  )
}
