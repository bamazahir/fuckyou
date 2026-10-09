// Generates a VAPID key pair for web push (SPEC §18: keys live in Edge secrets / Vercel env).
// Usage: node scripts/push/vapid.mjs   → prints the three values to set. Run once; keep the private key secret.
const pair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify'])
const pub = new Uint8Array(await crypto.subtle.exportKey('raw', pair.publicKey))
const jwk = await crypto.subtle.exportKey('jwk', pair.privateKey)
const b64url = (bytes) => Buffer.from(bytes).toString('base64url')
console.log(`VAPID_PUBLIC_KEY=${b64url(pub)}`)
console.log(`VAPID_PRIVATE_KEY=${jwk.d}`)
console.log('VITE_VAPID_PUBLIC_KEY= (same value as VAPID_PUBLIC_KEY)')
