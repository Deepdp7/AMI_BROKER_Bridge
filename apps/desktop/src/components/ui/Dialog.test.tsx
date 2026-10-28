import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { ConfirmHost, confirmDialog } from './Dialog'

const settle = async () => { for (let i = 0; i < 4; i++) await act(async () => { await Promise.resolve() }) }

describe('In-app confirm', () => {
  it('resolves true on confirm and false on cancel or Escape', async () => {
    render(<ConfirmHost />)
    let answer: boolean | undefined
    act(() => { confirmDialog({ title: 'Remove Fyers?', message: 'Keys are deleted.', confirmLabel: 'Remove broker', tone: 'danger' }).then(a => { answer = a }) })
    expect(screen.getByText('Remove Fyers?')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Remove broker' }))
    await settle()
    expect(answer).toBe(true)

    act(() => { confirmDialog({ title: 'Again?' }).then(a => { answer = a }) })
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    await settle()
    expect(answer).toBe(false)

    act(() => { confirmDialog({ title: 'Once more?' }).then(a => { answer = a }) })
    answer = undefined
    fireEvent.keyDown(window, { key: 'Escape' })
    await settle()
    expect(answer).toBe(false)
  })

  it('type-to-confirm keeps the button off until the word is typed', async () => {
    render(<ConfirmHost />)
    let answer: boolean | undefined
    act(() => { confirmDialog({ title: 'Factory reset?', confirmLabel: 'Reset everything', typeToConfirm: 'RESET' }).then(a => { answer = a }) })
    const button = screen.getByRole('button', { name: 'Reset everything' }) as HTMLButtonElement
    expect(button.disabled).toBe(true)
    fireEvent.change(screen.getByLabelText(/to confirm/i), { target: { value: 'res' } })
    expect(button.disabled).toBe(true)
    fireEvent.change(screen.getByLabelText(/to confirm/i), { target: { value: 'reset' } })
    expect(button.disabled).toBe(false)
    fireEvent.click(button)
    await settle()
    expect(answer).toBe(true)
  })
})
