import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import type { SymbolHealth } from '../../api/apiClient'

const h = vi.hoisted(() => ({
  list: [] as any[],
  repairSymbols: vi.fn(async () => ({ ok: true, checked: 1, queued: 1, complete: 0, noBroker: 0 })),
}))
vi.mock('../../api/apiClient', () => ({
  api: { getSymbolHealth: vi.fn(async () => ({ symbols: h.list })), repairSymbols: h.repairSymbols },
  wsManager: { on: () => () => {} },
}))
vi.mock('../../hooks/useApiSync', () => ({ useEngineRefresh: () => {} }))
vi.mock('../ui/Toast', () => ({ toast: { info: vi.fn(), error: vi.fn(), success: vi.fn() } }))

import { api } from '../../api/apiClient'
import { DataHealthSummary, HealthLine, useDataHealth } from './DataHealth'

const hl = (ticker: string, status: SymbolHealth['status'], missingDays = 0, extra: Partial<SymbolHealth> = {}): SymbolHealth =>
  ({ ticker, status, missingDays, missingSample: [], olderMissing: false, firstDay: '2026-01-01', lastDay: '2026-10-27', bars: 1000, ...extra })

const settle = async () => { for (let i = 0; i < 5; i++) await act(async () => { await Promise.resolve() }) }

beforeEach(() => vi.clearAllMocks())

describe('Data health summary', () => {
  it('counts in plain words and offers Repair all for what is missing', () => {
    const onRepairAll = vi.fn()
    render(<DataHealthSummary
      list={[hl('A', 'complete'), hl('B', 'complete'), hl('C', 'missing', 3), hl('D', 'empty'), hl('E', 'downloading')]}
      onRepairAll={onRepairAll} repairing={false} onlyProblems={false} setOnlyProblems={() => {}} />)
    expect(screen.getByText('Some history is missing')).toBeTruthy()
    expect(screen.getByText('2 symbols complete · 2 symbols with missing history (3 days) · 1 symbol downloading')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /repair all \(2\)/i }))
    expect(onRepairAll).toHaveBeenCalled()
  })

  it('all complete: a calm green line, no buttons', () => {
    render(<DataHealthSummary list={[hl('A', 'complete')]} onRepairAll={() => {}} repairing={false} onlyProblems={false} setOnlyProblems={() => {}} />)
    expect(screen.getByText('All history is complete')).toBeTruthy()
    expect(screen.queryByRole('button')).toBeNull()
  })
})

describe('Health line on a symbol', () => {
  it.each([
    [hl('A', 'complete'), 'History complete', false],
    [hl('A', 'missing', 3), '3 days missing', true],
    [hl('A', 'missing', 0, { olderMissing: true }), 'Older history missing', true],
    [hl('A', 'downloading'), 'Downloading history…', false],
    [hl('A', 'cancelled'), 'History cancelled', false],
    [hl('A', 'empty', 0, { firstDay: null, lastDay: null, bars: 0 }), 'No history yet', true],
  ])('%#: says "%s"', (health, text, repair) => {
    const onRepair = vi.fn()
    render(<HealthLine health={health as SymbolHealth} onRepair={onRepair} repairing={false} />)
    expect(screen.getByText(text as string)).toBeTruthy()
    const btn = screen.queryByRole('button', { name: /repair/i })
    expect(!!btn).toBe(repair)
    if (btn) { fireEvent.click(btn); expect(onRepair).toHaveBeenCalled() }
  })
})

describe('Repair', () => {
  it('repairs the chosen symbol and loads the health again', async () => {
    h.list = [hl('C', 'missing', 3)]
    let hook: ReturnType<typeof useDataHealth> | null = null
    function Probe() { hook = useDataHealth(); return null }
    render(<Probe />)
    await settle()
    expect(hook!.byTicker.get('C')?.missingDays).toBe(3)
    h.list = [hl('C', 'downloading')]
    await act(async () => { await hook!.repair(['C']) })
    await settle()
    expect(h.repairSymbols).toHaveBeenCalledWith(['C'])
    expect(hook!.byTicker.get('C')?.status).toBe('downloading')
  })
})

describe('Health line while it is not known yet', () => {
  it('shows a quiet "Checking history…" while loading, and nothing once loaded without an entry', () => {
    const { rerender } = render(<HealthLine loading onRepair={() => {}} repairing={false} />)
    expect(screen.getByText('Checking history…')).toBeTruthy()
    rerender(<HealthLine onRepair={() => {}} repairing={false} />)
    expect(screen.queryByText('Checking history…')).toBeNull()
  })
})

describe('Loading the picture', () => {
  it('keeps the last picture for the next visit, and looks again soon after an older one', async () => {
    vi.useFakeTimers()
    try {
      const get = api.getSymbolHealth as unknown as ReturnType<typeof vi.fn>
      get.mockResolvedValueOnce({ symbols: [hl('K', 'missing', 2)], fresh: false })
      get.mockResolvedValueOnce({ symbols: [hl('K', 'complete')], fresh: true })
      let hook: ReturnType<typeof useDataHealth> | null = null
      function Probe() { hook = useDataHealth(); return null }
      const first = render(<Probe />)
      await act(async () => { await vi.advanceTimersByTimeAsync(50) })
      expect(hook!.byTicker.get('K')?.status).toBe('missing') // the older picture, at once
      await act(async () => { await vi.advanceTimersByTimeAsync(3100) })
      expect(hook!.byTicker.get('K')?.status).toBe('complete') // the new one, a moment later
      expect(get).toHaveBeenCalledTimes(2)
      first.unmount()

      // Back on the page later: the last picture is there before anything is fetched
      get.mockImplementationOnce(() => new Promise(() => {})) // the engine is slow to answer
      render(<Probe />)
      expect(hook!.list?.[0].ticker).toBe('K')
      expect(hook!.byTicker.get('K')?.status).toBe('complete')
    } finally {
      vi.useRealTimers()
    }
  })
})
