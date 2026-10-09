import { describe, expect, it } from 'vitest'
import { base64UrlToBytes, isIOSDevice, pushStatus, type PushEnv } from './push'

const ok: PushEnv = {
  hasServiceWorker: true,
  hasPushManager: true,
  hasNotification: true,
  isIOS: false,
  standalone: false,
  permission: 'default',
  subscribed: false,
}

describe('pushStatus', () => {
  it('asks when everything is supported and nobody asked yet', () => {
    expect(pushStatus(ok)).toBe('ask')
  })

  it('needs the Home Screen on iOS', () => {
    expect(pushStatus({ ...ok, isIOS: true, hasPushManager: false })).toBe('needs_install')
    expect(pushStatus({ ...ok, isIOS: true, standalone: true })).toBe('ask')
  })

  it('respects a denial and reports on/off', () => {
    expect(pushStatus({ ...ok, permission: 'denied' })).toBe('denied')
    expect(pushStatus({ ...ok, permission: 'granted', subscribed: true })).toBe('on')
    expect(pushStatus({ ...ok, permission: 'granted' })).toBe('off')
  })

  it('is unsupported without push APIs', () => {
    expect(pushStatus({ ...ok, hasPushManager: false })).toBe('unsupported')
  })
})

describe('isIOSDevice', () => {
  it('spots iPhones and iPads that claim to be Macs', () => {
    expect(isIOSDevice('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)', 5)).toBe(true)
    expect(isIOSDevice('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 5)).toBe(true)
    expect(isIOSDevice('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 0)).toBe(false)
    expect(isIOSDevice('Mozilla/5.0 (Linux; Android 15)', 5)).toBe(false)
  })
})

describe('base64UrlToBytes', () => {
  it('decodes url-safe base64 without padding', () => {
    expect([...base64UrlToBytes('-_8')]).toEqual([251, 255])
  })
})
