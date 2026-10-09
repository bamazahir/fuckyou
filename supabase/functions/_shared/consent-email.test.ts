import { describe, expect, it } from 'vitest'
import { consentEmail, consentLinks } from './consent-email'

describe('consentLinks', () => {
  it('builds review and withdraw links without double slashes', () => {
    expect(consentLinks('https://app.example/', 'abc')).toEqual({
      review: 'https://app.example/consent/abc',
      withdraw: 'https://app.example/consent/abc?withdraw=1',
    })
  })
})

describe('consentEmail', () => {
  const mail = consentEmail({
    appName: 'Studyroom',
    appUrl: 'https://app.example',
    childDisplayName: '<b>Kid</b>',
    token: 't0k',
  })

  it('names the child in the subject', () => {
    expect(mail.subject).toBe('<b>Kid</b> would like to use Studyroom')
  })

  it('escapes the child name in HTML', () => {
    expect(mail.html).toContain('&lt;b&gt;Kid&lt;/b&gt;')
    expect(mail.html).not.toContain('<b>Kid</b>')
  })

  it('explains the data, the 7-day expiry and how to withdraw', () => {
    for (const part of ['What we collect', 'deleted after 7 days', 'withdraw', 'No ads']) {
      expect(mail.text).toContain(part)
    }
    expect(mail.text).toContain('https://app.example/consent/t0k?withdraw=1')
  })
})
