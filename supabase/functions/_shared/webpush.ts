// Web Push (RFC 8291 message encryption + RFC 8292 VAPID) on WebCrypto only: runs in Deno (Edge
// Functions) and Node (tests) with no third-party push library to trust.

export interface PushTarget {
  endpoint: string
  /** Browser's P-256 public key, base64url (65 bytes uncompressed). */
  p256dh: string
  /** Browser's auth secret, base64url (16 bytes). */
  auth: string
}

export interface VapidKeys {
  /** base64url, 65-byte uncompressed P-256 point (the same value the client subscribes with). */
  publicKey: string
  /** base64url, 32-byte private scalar d. */
  privateKey: string
  /** mailto: or https: contact for push services. */
  subject: string
}

const enc = new TextEncoder()
const bytes = (text: string): Bytes => new Uint8Array(enc.encode(text))
/** Byte arrays backed by a plain ArrayBuffer, as WebCrypto and fetch expect. */
export type Bytes = Uint8Array<ArrayBuffer>

export function b64urlDecode(s: string): Bytes {
  const pad = '='.repeat((4 - (s.length % 4)) % 4)
  const bin = atob((s + pad).replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from(bin, (c) => c.charCodeAt(0))
}

export function b64urlEncode(bytes: Uint8Array): string {
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function concat(...parts: Uint8Array[]): Bytes {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0))
  let i = 0
  for (const p of parts) {
    out.set(p, i)
    i += p.length
  }
  return out
}

async function hmac(key: Bytes, data: Bytes): Promise<Bytes> {
  const k = await crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  return new Uint8Array(await crypto.subtle.sign('HMAC', k, data))
}

/** HKDF with a single output block (all lengths here are ≤ 32 bytes). */
async function hkdf(salt: Bytes, ikm: Bytes, info: Bytes, length: number): Promise<Bytes> {
  const prk = await hmac(salt, ikm)
  return (await hmac(prk, concat(info, new Uint8Array([1])))).slice(0, length)
}

/** Derives the content key and nonce shared by sender and receiver (RFC 8291 §3.4). */
export async function deriveKeys(
  ecdhSecret: Bytes,
  authSecret: Bytes,
  uaPublic: Bytes,
  asPublic: Bytes,
  salt: Bytes,
): Promise<{ cek: Bytes; nonce: Bytes }> {
  const keyInfo = concat(bytes('WebPush: info\0'), uaPublic, asPublic)
  const ikm = await hkdf(authSecret, ecdhSecret, keyInfo, 32)
  const cek = await hkdf(salt, ikm, bytes('Content-Encoding: aes128gcm\0'), 16)
  const nonce = await hkdf(salt, ikm, bytes('Content-Encoding: nonce\0'), 12)
  return { cek, nonce }
}

/** Encrypts one push message as a single aes128gcm record. */
export async function encryptPayload(
  target: Pick<PushTarget, 'p256dh' | 'auth'>,
  plaintext: string,
): Promise<Bytes> {
  const uaPublic = b64urlDecode(target.p256dh)
  const authSecret = b64urlDecode(target.auth)
  const ua = await crypto.subtle.importKey('raw', uaPublic, { name: 'ECDH', namedCurve: 'P-256' }, false, [])
  const as = (await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, [
    'deriveBits',
  ])) as CryptoKeyPair
  const asPublic = new Uint8Array(await crypto.subtle.exportKey('raw', as.publicKey))
  const ecdhSecret = new Uint8Array(
    await crypto.subtle.deriveBits({ name: 'ECDH', public: ua }, as.privateKey, 256),
  )
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const { cek, nonce } = await deriveKeys(ecdhSecret, authSecret, uaPublic, asPublic, salt)
  const key = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt'])
  const padded = concat(bytes(plaintext), new Uint8Array([2])) // 0x02 = last record
  const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, key, padded))
  const rs = new Uint8Array([0, 0, 16, 0]) // record size 4096
  return concat(salt, rs, new Uint8Array([asPublic.length]), asPublic, cipher)
}

/** VAPID JWT (ES256) for the push service that owns `endpoint`. */
export async function vapidAuthorization(endpoint: string, keys: VapidKeys, nowSec: number): Promise<string> {
  const pub = b64urlDecode(keys.publicKey)
  const jwk: JsonWebKey = {
    kty: 'EC',
    crv: 'P-256',
    x: b64urlEncode(pub.slice(1, 33)),
    y: b64urlEncode(pub.slice(33, 65)),
    d: keys.privateKey,
    ext: true,
  }
  const key = await crypto.subtle.importKey('jwk', jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, [
    'sign',
  ])
  const header = b64urlEncode(bytes(JSON.stringify({ typ: 'JWT', alg: 'ES256' })))
  const claims = b64urlEncode(
    bytes(JSON.stringify({ aud: new URL(endpoint).origin, exp: nowSec + 12 * 3600, sub: keys.subject })),
  )
  const signed = `${header}.${claims}`
  // WebCrypto returns the raw r||s signature, which is exactly the JWS ES256 format.
  const sig = new Uint8Array(await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, bytes(signed)))
  return `vapid t=${signed}.${b64urlEncode(sig)}, k=${keys.publicKey}`
}

export interface PushRequest {
  url: string
  init: RequestInit & { headers: Record<string, string>; body: Bytes }
}

/** Everything needed to POST one notification; kept separate from fetch so it can be tested. */
export async function buildPushRequest(
  target: PushTarget,
  payload: unknown,
  keys: VapidKeys,
  opts: { ttl: number; urgency?: 'normal' | 'high'; topic?: string; nowSec?: number },
): Promise<PushRequest> {
  const body = await encryptPayload(target, JSON.stringify(payload))
  const headers: Record<string, string> = {
    Authorization: await vapidAuthorization(
      target.endpoint,
      keys,
      opts.nowSec ?? Math.floor(Date.now() / 1000),
    ),
    'Content-Encoding': 'aes128gcm',
    'Content-Type': 'application/octet-stream',
    TTL: String(opts.ttl),
    Urgency: opts.urgency ?? 'normal',
  }
  // Topic replaces an undelivered message with the same topic (e.g. repeated "room is active").
  if (opts.topic) headers.Topic = opts.topic.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 32)
  return { url: target.endpoint, init: { method: 'POST', headers, body } }
}
