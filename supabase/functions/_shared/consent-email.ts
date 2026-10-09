// Pure template for the parental-consent email (SPEC §13.1). No Deno or Node APIs, so it is unit-tested with Vitest.

export interface ConsentEmailInput {
  appName: string
  appUrl: string
  childDisplayName: string
  token: string
}

export interface Email {
  subject: string
  text: string
  html: string
}

const esc = (s: string) =>
  s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')

export function consentLinks(appUrl: string, token: string) {
  const base = `${appUrl.replace(/\/+$/, '')}/consent/${encodeURIComponent(token)}`
  return { review: base, withdraw: `${base}?withdraw=1` }
}

export function consentEmail({ appName, appUrl, childDisplayName, token }: ConsentEmailInput): Email {
  const { review, withdraw } = consentLinks(appUrl, token)
  const name = childDisplayName.trim() || 'Your child'
  const subject = `${name} would like to use ${appName}`
  const text = [
    `Hi,`,
    ``,
    `${name} signed up for ${appName}, a study timer where friends can see each other studying in shared rooms.`,
    `Where you live, a parent or guardian needs to agree before they can use it.`,
    ``,
    `What we collect: an email address (only to sign in), a display name, a cartoon avatar, and study sessions`,
    `(start time, length, an optional note). Room members see display names, avatars and study minutes.`,
    `No ads, no tracking, no selling data. There is no chat.`,
    ``,
    `Review and decide: ${review}`,
    `If you do nothing, the account is deleted after 7 days.`,
    ``,
    `You can withdraw your consent at any time (this deletes the account): ${withdraw}`,
  ].join('\n')
  const html = `<!doctype html><html><body style="font-family:Arial,sans-serif;color:#2B2622;line-height:1.5">
<p>Hi,</p>
<p><strong>${esc(name)}</strong> signed up for ${esc(appName)}, a study timer where friends can see each other studying in shared rooms.
Where you live, a parent or guardian needs to agree before they can use it.</p>
<p><strong>What we collect:</strong> an email address (only to sign in), a display name, a cartoon avatar, and study sessions
(start time, length, an optional note). Room members see display names, avatars and study minutes. No ads, no tracking,
no selling data. There is no chat.</p>
<p><a href="${esc(review)}" style="display:inline-block;padding:10px 16px;background:#FFC86B;color:#2B2622;border:2px solid #2B2622;border-radius:10px;text-decoration:none;font-weight:bold">Review and decide</a></p>
<p>If you do nothing, the account is deleted after 7 days.</p>
<p style="font-size:13px;color:#675D53">You can withdraw your consent at any time, which deletes the account:
<a href="${esc(withdraw)}">withdraw consent</a>.</p>
</body></html>`
  return { subject, text, html }
}
