import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import Select from './Select'

const OPTIONS = [
  { value: 'fyers', label: 'Fyers' },
  { value: 'zerodha_kite', label: 'Zerodha Kite' },
  { value: 'dhan', label: 'Dhan' },
]

describe('Select', () => {
  it('shows the selected option and opens its list on click', () => {
    render(<Select value="fyers" options={OPTIONS} onChange={() => {}} />)
    const trigger = screen.getByRole('combobox')
    expect(trigger).toHaveTextContent('Fyers')
    expect(screen.queryByRole('listbox')).toBeNull()

    fireEvent.click(trigger)
    expect(screen.getByRole('listbox')).toBeInTheDocument()
    expect(screen.getAllByRole('option')).toHaveLength(3)
    expect(screen.getByRole('option', { name: 'Fyers' })).toHaveAttribute('aria-selected', 'true')
  })

  it('picks an option with the mouse and closes', () => {
    const onChange = vi.fn()
    render(<Select value="fyers" options={OPTIONS} onChange={onChange} />)
    fireEvent.click(screen.getByRole('combobox'))
    fireEvent.click(screen.getByRole('option', { name: 'Dhan' }))
    expect(onChange).toHaveBeenCalledWith('dhan')
    expect(screen.queryByRole('listbox')).toBeNull()
  })

  it('works from the keyboard: arrows move, Enter picks, Escape closes', () => {
    const onChange = vi.fn()
    render(<Select value="fyers" options={OPTIONS} onChange={onChange} />)
    const trigger = screen.getByRole('combobox')

    fireEvent.keyDown(trigger, { key: 'ArrowDown' }) // opens on the current option
    fireEvent.keyDown(trigger, { key: 'ArrowDown' })
    fireEvent.keyDown(trigger, { key: 'Enter' })
    expect(onChange).toHaveBeenCalledWith('zerodha_kite')

    fireEvent.keyDown(trigger, { key: 'ArrowDown' })
    expect(screen.getByRole('listbox')).toBeInTheDocument()
    fireEvent.keyDown(trigger, { key: 'Escape' })
    expect(screen.queryByRole('listbox')).toBeNull()
  })

  it('shows the placeholder when nothing is selected', () => {
    render(<Select value="" options={OPTIONS} onChange={() => {}} placeholder="Choose a broker" />)
    expect(screen.getByRole('combobox')).toHaveTextContent('Choose a broker')
  })
})
