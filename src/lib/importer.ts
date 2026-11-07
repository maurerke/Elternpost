import { db, newId, now, touch, type Child, type Contact } from './db'
import { isValidEmail } from './util'

const EMAIL = /[^\s<>;,()"']+@[^\s<>;,()"']+\.[a-z]{2,}/gi
const PHONE = /(\+?\d[\d /()-]{5,}\d)/g

export interface ImportRow {
  /** Leer = Kind noch unbekannt */
  childName?: string
  person?: string
  contacts: Omit<Contact, 'id'>[]
}

/** Erkennt vCard (.vcf), CSV-Export eines Mail-Programms (mit Kopfzeile) oder einfache Zeilen. */
export function parseAny(text: string): ImportRow[] {
  if (/BEGIN:VCARD/i.test(text)) return parseVCards(text)
  if (isCsvExport(text)) return parseCsv(text)
  return parseLines(text)
}

/* ---------- vCard ---------- */

const unescapeValue = (v: string) => v.replace(/\\n/gi, ' ').replace(/\\([,;\\])/g, '$1').trim()

function decodeQuotedPrintable(v: string) {
  const bytes: number[] = []
  for (let i = 0; i < v.length; i++) {
    if (v[i] === '=' && /^[0-9A-F]{2}$/i.test(v.slice(i + 1, i + 3))) {
      bytes.push(parseInt(v.slice(i + 1, i + 3), 16))
      i += 2
    } else bytes.push(v.charCodeAt(i))
  }
  return new TextDecoder().decode(new Uint8Array(bytes))
}

const localPart = (email: string) => email.split('@')[0].toLowerCase()

/** Ein Kontakt pro vCard. Der Name im Adressbuch ist ein Elternteil, nicht das Kind. */
export function parseVCards(text: string): ImportRow[] {
  const lines = text.replace(/\r\n?/g, '\n').replace(/\n[ \t]/g, '').split('\n')
  const rows: ImportRow[] = []
  let card: { fn: string; n: string; emails: string[]; phones: string[] } | null = null

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i]
    if (/^BEGIN:VCARD/i.test(line)) {
      card = { fn: '', n: '', emails: [], phones: [] }
      continue
    }
    if (!card) continue
    if (/^END:VCARD/i.test(line)) {
      const emails = [...new Set(card.emails)]
      if (emails.length || card.phones.length) {
        const [family = '', given = ''] = card.n.split(';')
        const name = card.fn || `${given} ${family}`.trim()
        const isRealName = name && !name.includes('@') && !emails.some((e) => localPart(e) === name.toLowerCase())
        const person = isRealName ? name : undefined
        rows.push({
          person,
          contacts: [
            ...emails.map((value) => ({ kind: 'email' as const, value, person })),
            ...card.phones.map((value) => ({ kind: 'phone' as const, value, person })),
          ],
        })
      }
      card = null
      continue
    }
    const colon = line.indexOf(':')
    if (colon < 0) continue
    const head = line.slice(0, colon)
    const prop = head.split(';')[0].split('.').pop()!.toUpperCase()
    if (!['FN', 'N', 'EMAIL', 'TEL'].includes(prop)) continue

    let raw = line.slice(colon + 1)
    if (/QUOTED-PRINTABLE/i.test(head)) {
      while (raw.endsWith('=') && i + 1 < lines.length) raw = raw.slice(0, -1) + lines[++i]
      raw = decodeQuotedPrintable(raw)
    }
    const value = prop === 'N' ? raw : unescapeValue(raw)

    if (prop === 'FN') card.fn = value
    else if (prop === 'N') card.n = value.split(';').map(unescapeValue).join(';')
    else if (prop === 'EMAIL' && isValidEmail(value)) card.emails.push(value.replace(/^mailto:/i, ''))
    else if (prop === 'TEL' && value) card.phones.push(value.replace(/^tel:/i, ''))
  }
  return rows
}

/* ---------- CSV aus Outlook, Gmail, Thunderbird & Co. ---------- */

const stripBom = (text: string) => text.replace(/^\uFEFF/, '')

const firstLine = (text: string) => stripBom(text).split(/\r?\n/).find((l) => l.trim()) ?? ''

/** Kopfzeile ohne Adressen, aber mit einer Spalte für E-Mails – so sehen Exporte aus Mail-Programmen aus. */
function isCsvExport(text: string) {
  const head = firstLine(text)
  return !head.match(EMAIL) && /e-?mail/i.test(head) && /[,;\t]/.test(head)
}

/** Zerlegt CSV mit Anführungszeichen (auch Zeilenumbrüche darin) in Zeilen und Felder. */
function splitCsv(text: string): string[][] {
  const head = firstLine(text)
  const sep = [',', ';', '\t'].reduce((a, b) => (head.split(b).length > head.split(a).length ? b : a))
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false
  const src = stripBom(text)
  for (let i = 0; i < src.length; i++) {
    const ch = src[i]
    if (quoted) {
      if (ch === '"' && src[i + 1] === '"') {
        field += '"'
        i++
      } else if (ch === '"') quoted = false
      else field += ch
    } else if (ch === '"') quoted = true
    else if (ch === sep) {
      row.push(field)
      field = ''
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++
      row.push(field)
      rows.push(row)
      row = []
      field = ''
    } else field += ch
  }
  row.push(field)
  rows.push(row)
  return rows.filter((r) => r.some((f) => f.trim()))
}

/** Wie bei vCards: Der Name im Adressbuch ist ein Elternteil, das Kind ist noch unbekannt. */
export function parseCsv(text: string): ImportRow[] {
  const [header = [], ...lines] = splitCsv(text)
  const cols = header.map((h) => h.trim().toLowerCase())
  const col = (re: RegExp) => cols.findIndex((h) => re.test(h))
  const nameCol = col(/^(name|display name|anzeigename|full name|vollständiger name)$/)
  const firstCol = col(/^(first name|given name|vorname)$/)
  const lastCol = col(/^(last name|family name|nachname)$/)
  const phoneCols = cols.flatMap((h, i) => (/phone|telefon|mobil|handy|^tel/.test(h) && !/type|typ/.test(h) ? [i] : []))

  const rows: ImportRow[] = []
  for (const cells of lines) {
    const cell = (i: number) => (i >= 0 ? (cells[i] ?? '').trim() : '')
    const emails = [...new Set(cells.flatMap((c) => c.match(EMAIL) ?? []))]
    const phones = [
      ...new Set(
        phoneCols
          .flatMap((i) => cell(i).split(':::'))
          .map((p) => p.trim())
          .filter((p) => p.replace(/\D/g, '').length >= 6),
      ),
    ]
    if (!emails.length && !phones.length) continue
    const name = cell(nameCol) || `${cell(firstCol)} ${cell(lastCol)}`.trim()
    const person = name && !name.includes('@') ? name : undefined
    rows.push({
      person,
      contacts: [
        ...emails.map((value) => ({ kind: 'email' as const, value, person })),
        ...phones.map((value) => ({ kind: 'phone' as const, value, person })),
      ],
    })
  }
  return rows
}

/* ---------- Zeilen ---------- */

/**
 * Liest Zeilen wie
 *   Emma Müller; Anna Müller; anna@example.de; 0171 1234567
 *   max@example.de
 * Erster Text = Kind, zweiter Text = Elternteil.
 */
export function parseLines(text: string): ImportRow[] {
  const rows: ImportRow[] = []
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim()
    if (!line) continue
    const emails = line.match(EMAIL) ?? []
    let rest = line
    for (const e of emails) rest = rest.replace(e, ' ')
    const phones = (rest.match(PHONE) ?? []).map((p) => p.trim())
    for (const p of phones) rest = rest.replace(p, ' ')
    if (!emails.length && !phones.length) continue

    const names = rest
      .split(/[;,\t|]/)
      .map((t) => t.replace(/[<>"']/g, '').trim())
      .filter(Boolean)
    const person = names[1]
    rows.push({
      childName: names[0],
      person,
      contacts: [
        ...emails.map((value) => ({ kind: 'email' as const, value, person })),
        ...phones.map((value) => ({ kind: 'phone' as const, value, person })),
      ],
    })
  }
  return rows
}

/* ---------- Übernehmen ---------- */

const key = (c: Pick<Contact, 'kind' | 'value'>) => `${c.kind}:${c.value.trim().toLowerCase()}`

export interface ImportPlan {
  /** neue Einträge */
  created: Child[]
  /** bestehende Einträge, die neue Kontakte bekommen */
  extended: Child[]
  /** Kontakte, die schon im Verteiler sind */
  known: number
}

/**
 * Gleicht mit dem bestehenden Verteiler ab: Bekannte Adressen werden übersprungen,
 * Zeilen mit bekanntem Kindnamen ergänzen dieses Kind, alles andere wird neu angelegt.
 */
export function planImport(rows: ImportRow[], existing: Child[]): ImportPlan {
  const children = existing.map((c) => ({ ...c, contacts: [...c.contacts] }))
  const byContact = new Map<string, Child>()
  const byName = new Map<string, Child>()
  const register = (c: Child) => {
    for (const k of c.contacts) byContact.set(key(k), c)
    if (c.name.trim()) byName.set(c.name.trim().toLowerCase(), c)
  }
  children.forEach(register)

  const created: Child[] = []
  const extended = new Set<Child>()
  let known = 0

  for (const row of rows) {
    const fresh = row.contacts.filter((c) => !byContact.has(key(c)))
    known += row.contacts.length - fresh.length
    if (!fresh.length) continue

    const name = row.childName?.trim() ?? ''
    const target =
      row.contacts.map((c) => byContact.get(key(c))).find(Boolean) ?? (name ? byName.get(name.toLowerCase()) : undefined)
    const contacts = fresh.map((c) => ({ ...c, id: newId() }))

    if (target) {
      target.contacts.push(...contacts)
      if (target.id !== undefined) extended.add(target)
      register(target)
    } else {
      const child: Child = { name, active: true, contacts, createdAt: now(), updatedAt: now() }
      created.push(child)
      register(child)
    }
  }
  return { created, extended: [...extended], known }
}

export async function applyImport(plan: ImportPlan) {
  await db.transaction('rw', db.children, async () => {
    await db.children.bulkPut(plan.extended.map((c) => ({ ...c, updatedAt: now() })))
    await db.children.bulkAdd(plan.created)
  })
  await touch()
}
