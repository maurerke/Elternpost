import type { Message, Settings } from './db'
import { formatDate, formatDateLong } from './util'

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/** Absätze, Zeilenumbrüche und klickbare Links – mit Inline-Styles, weil Mail-Programme kein CSS mögen. */
function textToHtml(text: string, color = '#2b2b2b') {
  return text
    .trim()
    .split(/\n\s*\n/)
    .map((para) => {
      const html = escapeHtml(para)
        .replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" style="color:#c4532f">$1</a>')
        .replace(/(^|[\s(])([^\s@<>()]+@[^\s@<>()]+\.[a-z]{2,})/gi, '$1<a href="mailto:$2" style="color:#c4532f">$2</a>')
        .replace(/\n/g, '<br>')
      return `<p style="margin:0 0 14px;line-height:1.55;color:${color}">${html}</p>`
    })
    .join('')
}

const messageDate = (m: Message) => m.sentAt ?? m.createdAt

/** Die letzten versendeten Nachrichten vor dieser – für den „Zur Erinnerung“-Block. */
export function historyFor(message: Message, all: Message[], count: number): Message[] {
  const before = message.sentAt ?? '9999'
  return all
    .filter((m) => m.status === 'versendet' && m.id !== message.id && (m.sentAt ?? '') < before)
    .sort((a, b) => (b.sentAt ?? '').localeCompare(a.sentAt ?? ''))
    .slice(0, count)
}

function sourceLine(m: Message) {
  if (m.source !== 'kita') return ''
  return m.sourceDate
    ? `Weitergeleitet von der Kita-Leitung (Mail vom ${formatDate(m.sourceDate)})`
    : 'Weitergeleitet von der Kita-Leitung'
}

export function buildHtml(message: Message, history: Message[], s: Settings): string {
  const date = formatDateLong(message.sentAt ?? new Date().toISOString())
  const source = sourceLine(message)
  // Mails der Kita-Leitung haben schon eigene Anrede und Grüße.
  const own = message.source === 'eigen'

  const historyHtml = history.length
    ? `
<tr><td style="padding:28px 28px 8px">
  <div style="font-size:13px;font-weight:bold;letter-spacing:.06em;text-transform:uppercase;color:#8a7f72;border-top:2px solid #eee6da;padding-top:20px">
    Zur Erinnerung – letzte Mitteilungen
  </div>
</td></tr>
${history
  .map(
    (h) => `
<tr><td style="padding:12px 28px 4px">
  <div style="font-size:13px;color:#8a7f72">${formatDate(messageDate(h))}${h.source === 'kita' ? ' · von der Kita-Leitung' : ''}</div>
  <div style="font-size:16px;font-weight:bold;color:#444;margin:2px 0 8px">${escapeHtml(h.subject)}</div>
  <div style="font-size:14px">${textToHtml(h.body, '#555')}</div>
  ${h.attachmentsNote ? `<div style="font-size:13px;color:#8a7f72;margin-bottom:8px">📎 Anhang in der Mail vom ${formatDate(messageDate(h))}: ${escapeHtml(h.attachmentsNote)}</div>` : ''}
</td></tr>`,
  )
  .join('')}`
    : ''

  return `<div style="background:#f6f4ef;padding:16px 0;font-family:-apple-system,'Segoe UI',Helvetica,Arial,sans-serif">
<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:640px;margin:0 auto;background:#ffffff;border-radius:12px;border-collapse:separate">
<tr><td style="background:#e9785b;padding:18px 28px;border-radius:12px 12px 0 0">
  <div style="font-size:14px;font-weight:bold;color:#ffffff;letter-spacing:.04em">${escapeHtml(s.title)}</div>
  <div style="font-size:13px;color:#fde3da">${date}</div>
</td></tr>
<tr><td style="padding:24px 28px 4px">
  ${source ? `<div style="font-size:13px;color:#8a7f72;margin-bottom:6px">${source}</div>` : ''}
  <div style="font-size:22px;font-weight:bold;color:#2b2b2b;line-height:1.3;margin-bottom:18px">${escapeHtml(message.subject)}</div>
  ${own && s.greeting ? textToHtml(s.greeting) : ''}
  ${textToHtml(message.body)}
  ${message.attachmentsNote ? `<div style="background:#fbf3e6;border-radius:8px;padding:10px 14px;margin:4px 0 16px;font-size:14px;color:#6b5a3e">📎 Im Anhang: ${escapeHtml(message.attachmentsNote)}</div>` : ''}
  ${own && s.signature ? textToHtml(s.signature) : ''}
</td></tr>
${historyHtml}
<tr><td style="padding:20px 28px 24px">
  <div style="font-size:12px;line-height:1.5;color:#9a9087;border-top:1px solid #eee6da;padding-top:14px">${escapeHtml(s.footerNote)}</div>
</td></tr>
</table>
</div>`
}

export function buildText(message: Message, history: Message[], s: Settings): string {
  const lines: string[] = []
  const source = sourceLine(message)
  const own = message.source === 'eigen'
  lines.push(s.title, formatDateLong(message.sentAt ?? new Date().toISOString()), '')
  if (source) lines.push(source)
  lines.push(message.subject.toUpperCase(), '')
  if (own && s.greeting) lines.push(s.greeting, '')
  lines.push(message.body.trim(), '')
  if (message.attachmentsNote) lines.push(`Im Anhang: ${message.attachmentsNote}`, '')
  if (own && s.signature) lines.push(s.signature, '')
  if (history.length) {
    lines.push('————————————————', 'ZUR ERINNERUNG – LETZTE MITTEILUNGEN', '')
    for (const h of history) {
      lines.push(`${formatDate(messageDate(h))} – ${h.subject}`, h.body.trim(), '')
    }
  }
  lines.push('————————————————', s.footerNote)
  return lines.join('\n')
}

export function mailtoUrl(to: string, bcc: string[], subject: string) {
  const enc = (v: string) => encodeURIComponent(v).replace(/%40/g, '@')
  const params = [`bcc=${bcc.map(enc).join(',')}`, `subject=${encodeURIComponent(subject)}`]
  return `mailto:${enc(to)}?${params.join('&')}`
}
