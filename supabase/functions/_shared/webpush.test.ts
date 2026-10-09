import { describe, expect, it } from 'vitest'
import {
  b64urlDecode,
  b64urlEncode,
  buildPushRequest,
  deriveKeys,
  encryptPayload,
  vapidAuthorization,
} from './webpush'

async function browserKeys() {
  const pair = (await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, [
    'deriveBits',
  ])) as CryptoKeyPair
  const pub = new Uint8Array(await crypto.subtle.exportKey('raw', pair.publicKey))
  const auth = crypto.getRandomValues(new Uint8Array(16))
  return { pair, p256dh: b64urlEncode(pub), auth: b64urlEncode(auth) }
}

/** What the browser does on receipt (RFC 8291 §3.4 / RFC 8188), to check our sender against. */
async function decrypt(body: Uint8Array, ua: Awaited<ReturnType<typeof browserKeys>>) {
  const salt = body.slice(0, 16)
  const idlen = body[20] ?? 0
  const asPublic = body.slice(21, 21 + idlen)
  const cipher = body.slice(21 + idlen)
  const as = await crypto.subtle.importKey('raw', asPublic, { name: 'ECDH', namedCurve: 'P-256' }, false, [])
  const secret = new Uint8Array(
    await crypto.subtle.deriveBits({ name: 'ECDH', public: as }, ua.pair.privateKey, 256),
  )
  const { cek, nonce } = await deriveKeys(
    secret,
    b64urlDecode(ua.auth),
    b64urlDecode(ua.p256dh),
    asPublic,
    salt,
  )
  const key = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['decrypt'])
  const plain = new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: nonce }, key, cipher))
  expect(plain[plain.length - 1]).toBe(2)
  return new TextDecoder().decode(plain.slice(0, -1))
}

async function vapidKeys() {
  const pair = (await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, [
    'sign',
    'verify',
  ])) as CryptoKeyPair
  const pub = new Uint8Array(await crypto.subtle.exportKey('raw', pair.publicKey))
  const jwk = await crypto.subtle.exportKey('jwk', pair.privateKey)
  return {
    pair,
    keys: { publicKey: b64urlEncode(pub), privateKey: jwk.d ?? '', subject: 'mailto:builder@example.com' },
  }
}

describe('base64url', () => {
  it('round-trips bytes without padding', () => {
    const bytes = Uint8Array.from([0, 250, 251, 252, 253, 254, 255])
    const s = b64urlEncode(bytes)
    expect(s).not.toMatch(/[+/=]/)
    expect([...b64urlDecode(s)]).toEqual([...bytes])
  })
})

describe('encryptPayload', () => {
  it('produces an aes128gcm record the browser can decrypt', async () => {
    const ua = await browserKeys()
    const body = await encryptPayload(ua, JSON.stringify({ title: 'Break time ☕' }))
    expect([...body.slice(16, 20)]).toEqual([0, 0, 16, 0])
    expect(body[20]).toBe(65)
    expect(JSON.parse(await decrypt(body, ua))).toEqual({ title: 'Break time ☕' })
  })

  it('uses a fresh key and salt every time', async () => {
    const ua = await browserKeys()
    const a = await encryptPayload(ua, 'x')
    const b = await encryptPayload(ua, 'x')
    expect(b64urlEncode(a.slice(0, 16))).not.toBe(b64urlEncode(b.slice(0, 16)))
  })
})

describe('vapidAuthorization', () => {
  it('signs a JWT for the push service origin that verifies with the public key', async () => {
    const { pair, keys } = await vapidKeys()
    const header = await vapidAuthorization('https://fcm.googleapis.com/fcm/send/abc', keys, 1_800_000_000)
    const m = /^vapid t=([^.]+)\.([^.]+)\.([^,]+), k=(.+)$/.exec(header)
    expect(m).not.toBeNull()
    const [, h = '', c = '', sig = '', k] = m ?? []
    expect(k).toBe(keys.publicKey)
    const claims = JSON.parse(new TextDecoder().decode(b64urlDecode(c))) as Record<string, unknown>
    expect(claims).toEqual({
      aud: 'https://fcm.googleapis.com',
      exp: 1_800_000_000 + 43_200,
      sub: keys.subject,
    })
    const ok = await crypto.subtle.verify(
      { name: 'ECDSA', hash: 'SHA-256' },
      pair.publicKey,
      b64urlDecode(sig),
      new TextEncoder().encode(`${h}.${c}`),
    )
    expect(ok).toBe(true)
  })
})

describe('buildPushRequest', () => {
  it('sets the headers push services require', async () => {
    const ua = await browserKeys()
    const { keys } = await vapidKeys()
    const req = await buildPushRequest(
      { endpoint: 'https://web.push.apple.com/abc', ...ua },
      { title: 'hi' },
      keys,
      { ttl: 600, urgency: 'high', topic: 'room_active:1234-5678' },
    )
    expect(req.url).toBe('https://web.push.apple.com/abc')
    expect(req.init.headers).toMatchObject({
      'Content-Encoding': 'aes128gcm',
      TTL: '600',
      Urgency: 'high',
      Topic: 'room_active1234-5678',
    })
    expect(JSON.parse(await decrypt(req.init.body, ua))).toEqual({ title: 'hi' })
  })
})
