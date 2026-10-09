// Drains public.notify_queue (SPEC §9). M2: parental-consent emails via Resend. M3 adds web push.
// Called by private.dispatch_queue() through pg_net with the shared secret header.
import { createClient } from 'npm:@supabase/supabase-js@2.117.3'
import { consentEmail } from '../_shared/consent-email.ts'

const env = (k: string) => Deno.env.get(k) ?? ''

Deno.serve(async (req) => {
  if (
    req.method !== 'POST' ||
    !env('PUSH_SECRET') ||
    req.headers.get('x-push-secret') !== env('PUSH_SECRET')
  ) {
    return new Response('forbidden', { status: 403 })
  }
  const db = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { persistSession: false },
  })

  const { data: rows, error } = await db
    .from('notify_queue')
    .select('id, kind, payload')
    .is('sent_at', null)
    .lte('send_after', new Date().toISOString())
    .eq('kind', 'consent_email')
    .order('id')
    .limit(20)
  if (error) return new Response(error.message, { status: 500 })

  let sent = 0
  for (const row of rows ?? []) {
    const p = row.payload as { to?: string; token?: string; child_display_name?: string }
    if (!p.to || !p.token) {
      await db
        .from('notify_queue')
        .update({ sent_at: new Date().toISOString(), payload: {} })
        .eq('id', row.id)
      continue
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
    if (res.ok) {
      // The raw token and address leave the queue as soon as the email is out.
      await db
        .from('notify_queue')
        .update({ sent_at: new Date().toISOString(), payload: {} })
        .eq('id', row.id)
      sent += 1
    } else {
      // Retry later; permanent failures stop after the queue's 7-day cleanup.
      await db
        .from('notify_queue')
        .update({ send_after: new Date(Date.now() + 5 * 60_000).toISOString() })
        .eq('id', row.id)
    }
  }
  return Response.json({ sent })
})
