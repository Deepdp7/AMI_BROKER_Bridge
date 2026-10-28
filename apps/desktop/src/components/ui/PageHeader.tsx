/** Title row shared by the pages: glowing icon tile, title, one line under it, actions on the right */
import type { ElementType, ReactNode } from 'react'

export function PageHeader({ icon: Icon, title, subtitle, actions }: {
  icon: ElementType
  title: ReactNode
  subtitle?: ReactNode
  actions?: ReactNode
}) {
  return (
    <div className="reveal" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.9rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', minWidth: 0 }}>
        <span className="page-icon"><Icon size={19} /></span>
        <div style={{ minWidth: 0 }}>
          <h1 style={{ fontSize: '1.3rem', fontWeight: 750, color: '#eceef2', margin: 0, letterSpacing: '-0.02em', lineHeight: 1.2 }}>{title}</h1>
          {subtitle && <div style={{ fontSize: '0.8rem', color: '#8b9199', marginTop: 3 }}>{subtitle}</div>}
        </div>
      </div>
      {actions && <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>{actions}</div>}
    </div>
  )
}
