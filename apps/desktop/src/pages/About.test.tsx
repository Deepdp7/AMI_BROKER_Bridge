import { describe, it, expect, vi } from 'vitest'
import { render, screen, act } from '@testing-library/react'

vi.mock('@tauri-apps/api/app', () => ({ getVersion: vi.fn(async () => '1.2.3') }))

import { AboutPage } from './About'

describe('About page', () => {
  it('shows the version, the getting-started steps and the supported brokers; no technology stack', async () => {
    const { container } = render(<AboutPage />)
    await act(async () => { await Promise.resolve() })

    expect(screen.getAllByText(/v1\.2\.3/).length).toBeGreaterThan(0)
    for (const step of ['Connect your broker', 'Add your symbols', 'Set up AmiBroker', 'Open a chart']) {
      expect(screen.getByText(step)).toBeTruthy()
    }
    for (const broker of ['Zerodha Kite', 'Fyers', 'Dhan', 'Upstox', 'Angel One', 'Flattrade', 'Shoonya']) {
      expect(screen.getByText(broker)).toBeTruthy()
    }
    expect(screen.getByText('7')).toBeTruthy() // "Brokers supported" counts the list

    const text = container.textContent || ''
    expect(text).not.toMatch(/technology stack|tauri|react 19|ring buffer/i)
    // No dead "Documentation" link
    expect(container.querySelectorAll('a[href="#"]')).toHaveLength(0)
  })
})
