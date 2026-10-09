// Drains public.notify_queue (SPEC §9): parental-consent emails via Resend, and web push with VAPID
// for phase ends, stopwatch check-ins and "room is active". Called by private.dispatch_queue()
// through pg_net with the shared secret header.
import { createClient } from 'npm:@supabase/supabase-js@2.117.3'
import { consentEmail } from '../_shared/consent-email.ts'
import { PUSH_TTL, pushMessage, type PushKind } from '../_shared/push-messages.ts'
import { buildPushRequest, type VapidKeys } from '../_shared/webpush.ts'

const env = (k: string) => Deno.env.get(k) ?? ''
const PUSH_KINDS = new Set<string>(['phase_end', 'checkin', 'room_active'])
// A "break time" that arrives 10 minutes late is noise: drop stale rows instead of retrying.
const STALE_MS = 10 * 60_000

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

async function sendPush(db: Db, row: Row, keys: VapidKeys): Promise<number> {
  if (
    !row.user_id ||
    Date.now() - Date.parse(row.created_at) > STALE_MS * (row.kind === 'room_active' ? 3 : 1)
  ) {
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
    const req = await buildPushRequest(sub, message, keys, {
      ttl: PUSH_TTL[kind],
      urgency: kind === 'room_active' ? 'normal' : 'high',
      topic: message.tag,
    })
    const res = await fetch(req.url, req.init)
    if (res.status === 404 || res.status === 410) {
      // The browser unsubscribed or the subscription expired: forget this device.
      await db.from('push_subscriptions').delete().eq('id', sub.id)
    } else if (res.ok) {
      delivered += 1
    } else if (res.status === 429 || res.status >= 500) {
      retry = true
    }
    await res.body?.cancel()
  }
  if (retry && delivered === 0) await retryLater(db, row.id)
  else await markSent(db, row.id)
  return delivered
}

Deno.serve(async (req) => {
  if (
    req.method !== 'POST' ||
    !env('PUSH_SECRET') ||
    req.headers.get('x-push-secret') !== env('PUSH_SECRET')
  ) {
    return new Response('forbidden', { status: 403 })
  }
  const db = makeDb()
  const keys: VapidKeys = {
    publicKey: env('VAPID_PUBLIC_KEY'),
    privateKey: env('VAPID_PRIVATE_KEY'),
    subject: env('VAPID_SUBJECT') || 'mailto:hello@example.com',
  }

  const { data: rows, error } = await db
    .from('notify_queue')
    .select('id, user_id, kind, payload, created_at')
    .is('sent_at', null)
    .lte('send_after', new Date().toISOString())
    .order('id')
    .limit(50)
  if (error) return new Response(error.message, { status: 500 })

  let emails = 0
  let pushes = 0
  for (const row of (rows ?? []) as Row[]) {
    if (row.kind === 'consent_email') {
      if (await sendEmail(db, row)) emails += 1
    } else if (PUSH_KINDS.has(row.kind)) {
      if (!keys.publicKey || !keys.privateKey) continue // not configured yet: leave queued
      pushes += await sendPush(db, row, keys)
    }
  }
  return Response.json({ emails, pushes })
})
