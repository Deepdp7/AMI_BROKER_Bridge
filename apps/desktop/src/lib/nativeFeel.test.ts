import { describe, it, expect, beforeEach } from 'vitest'
import { installNativeFeel, stopAutofill } from './nativeFeel'

const ac = (id: string) => document.getElementById(id)!.getAttribute('autocomplete')

describe('autofill is off for every field', () => {
  beforeEach(() => { document.body.innerHTML = '' })

  it('turns it off for text, password and textarea fields, and leaves checkboxes alone', () => {
    document.body.innerHTML = `
      <input id="key" type="text">
      <input id="secret" type="password">
      <textarea id="chat"></textarea>
      <input id="tick" type="checkbox">`
    stopAutofill(document)
    expect(ac('key')).toBe('off')
    expect(ac('secret')).toBe('new-password')
    expect(ac('chat')).toBe('off')
    expect(ac('tick')).toBeNull()
  })

  it('keeps a field that sets its own autocomplete', () => {
    document.body.innerHTML = '<input id="mine" type="text" autocomplete="username">'
    stopAutofill(document)
    expect(ac('mine')).toBe('username')
  })

  it('covers fields added later, and fields that switch between text and password', async () => {
    installNativeFeel()
    const wrap = document.createElement('div')
    wrap.innerHTML = '<input id="late" type="text"><input id="flip" type="text">'
    document.body.appendChild(wrap)
    await Promise.resolve()
    expect(ac('late')).toBe('off')
    expect(ac('flip')).toBe('off')

    ;(document.getElementById('flip') as HTMLInputElement).type = 'password'
    await Promise.resolve()
    expect(ac('flip')).toBe('new-password')
  })
})
