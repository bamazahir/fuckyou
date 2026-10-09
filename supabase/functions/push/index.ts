// Drains public.notify_queue (SPEC §9): parental-consent emails via Resend, and web push with VAPID
// for phase ends, stopwatch check-ins and "room is active". Called by private.dispatch_queue()
// through pg_net with the shared secret header.
import { createClient } from 'npm:@supabase/supabase-js@2.117.3'
import { consentEmail } from '../_shared/consent-email.ts'
import { PUSH_TTL, pushMessage, type PushKind } from '../_shared/push-messages.ts'
import { buildPushRequest, type VapidKeys } from '../_shared/webpush.ts'

const env = (k: string) => Deno.env.get(k) ?? ''
const PUSH_KINDS = new Set<string>(['phase_end', 'checkin', 'room_active'])

const makeDb = () =>
  createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false } })
type Db = ReturnType<typeof makeDb>
interface Row {
  id: number
  user_id: string | null
  kind: string
  payload: Record<string, unknown>
  created_at: string
}

async function markSent(db: Db, id: number) {
  await db.from('notify_queue').update({ sent_at: new Date().toISOString(), payload: {} }).eq('id', id)
}

async function retryLater(db: Db, id: number) {
  await db
    .from('notify_queue')
    .update({ send_after: new Date(Date.now() + 2 * 60_000).toISOString() })
    .eq('id', id)
}

async function sendEmail(db: Db, row: Row): Promise<boolean> {
  const p = row.payload as { to?: string; token?: string; child_display_name?: string }
  if (!p.to || !p.token) {
    await markSent(db, row.id)
    return false
  }
  const mail = consentEmail({
    appName: env('APP_NAME') || 'Studyroom',
    appUrl: env('APP_URL'),
    childDisplayName: p.child_display_name ?? '',
    token: p.token,
  })
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env('RESEND_API_KEY')}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: env('EMAIL_FROM'),
      to: [p.to],
      subject: mail.subject,
      text: mail.text,
      html: mail.html,
    }),
  })
  // The raw token and address leave the queue as soon as the email is out.
  if (res.ok) await markSent(db, row.id)
  else await retryLater(db, row.id)
  return res.ok
}

/** Constant-time string comparison for the shared secret. */
function sameSecret(a: string, b: string): boolean {
  const x = new TextEncoder().encode(a)
  const y = new TextEncoder().encode(b)
  let diff = x.length ^ y.length
  for (let i = 0; i < Math.max(x.length, y.length); i++) diff |= (x[i] ?? 0) ^ (y[i] ?? 0)
  return diff === 0
}

async function sendPush(db: Db, row: Row, keys: VapidKeys): Promise<number> {
  if (!row.user_id) {
    await markSent(db, row.id)
    return 0
  }
  const { data: subs } = await db
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth')
    .eq('user_id', row.user_id)
  const kind = row.kind as PushKind
  const message = pushMessage(kind, row.payload)
  let delivered = 0
  let retry = false
  for (const sub of (subs ?? []) as { id: number; endpoint: string; p256dh: string; auth: string }[]) {
    // One broken device must never stall the queue for everyone else (audit 2026-10-10 #3).
    try {
      const req = await buildPushRequest(sub, message, keys, {
        ttl: PUSH_TTL[kind],
        urgency: kind === 'room_active' ? 'normal' : 'high',
        topic: message.tag,
      })
      const res = await fetch(req.url, {
        ...req.init,
        redirect: 'manual',
        signal: AbortSignal.timeout(8_000),
      })
      await res.body?.cancel()
      // 404/410 = the browser dropped this subscription. (A 403 usually means our VAPID setup is
      // wrong, which must not wipe everyone's devices, so it's left alone.)
      if (res.status === 404 || res.status === 410) {
        await db.from('push_subscriptions').delete().eq('id', sub.id)
      } else if (res.ok) {
        delivered += 1
      } else if (res.status === 429 || res.status >= 500) {
        retry = true
      }
    } catch (e) {
      if (e instanceof DOMException && (e.name === 'TimeoutError' || e.name === 'AbortError')) retry = true
      else if (e instanceof TypeError)
        retry = true // network failure
      else await db.from('push_subscriptions').delete().eq('id', sub.id) // keys that can't be used
    }
  }
  if (retry && delivered === 0) await retryLater(db, row.id)
  else await markSent(db, row.id)
  return delivered
}

Deno.serve(async (req) => {
  const secret = env('PUSH_SECRET')
  if (req.method !== 'POST' || !secret || !sameSecret(req.headers.get('x-push-secret') ?? '', secret)) {
    return new Response('forbidden', { status: 403 })
  }
  const db = makeDb()
  const keys: VapidKeys = {
    publicKey: env('VAPID_PUBLIC_KEY'),
    privateKey: env('VAPID_PRIVATE_KEY'),
    subject: env('VAPID_SUBJECT'),
  }
  const pushReady = Boolean(keys.publicKey && keys.privateKey && /^(mailto:|https:)/.test(keys.subject))

  // Claimed atomically (and stale pushes retired) in SQL, so overlapping calls never double-send.
  const { data: rows, error } = await db.rpc('claim_notifications', { p_limit: 50 })
  if (error) return new Response(error.message, { status: 500 })

  let emails = 0
  let pushes = 0
  let failed = 0
  for (const row of (rows ?? []) as Row[]) {
    try {
      if (row.kind === 'consent_email') {
        if (await sendEmail(db, row)) emails += 1
      } else if (PUSH_KINDS.has(row.kind)) {
        // Not configured: retire the row instead of waking this function every 10 s for nothing.
        if (!pushReady) await markSent(db, row.id)
        else pushes += await sendPush(db, row, keys)
      } else {
        await markSent(db, row.id)
      }
    } catch (e) {
      failed += 1
      console.error('push: row failed', row.id, e instanceof Error ? e.message : String(e))
      await retryLater(db, row.id).catch(() => undefined)
    }
  }
  return Response.json({ emails, pushes, failed, pushReady })
})
