import { db, newId, now, touch, type Child, type Contact } from './db'

const EMAIL = /[^\s<>;,()"']+@[^\s<>;,()"']+\.[a-z]{2,}/gi
const PHONE = /(\+?\d[\d /()-]{5,}\d)/g

export interface ImportRow {
  childName: string
  person?: string
  contacts: Omit<Contact, 'id'>[]
}

/**
 * Liest Zeilen wie
 *   Emma Müller; Anna Müller; anna@example.de; 0171 1234567
 *   max@example.de
 * Erster Text = Kind, zweiter Text = Elternteil. Zeilen ohne Kindnamen bekommen die Adresse als Platzhalter.
 */
export function parseImport(text: string): ImportRow[] {
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
    const contacts: Omit<Contact, 'id'>[] = [
      ...emails.map((value) => ({ kind: 'email' as const, value, person })),
      ...phones.map((value) => ({ kind: 'phone' as const, value, person })),
    ]
    rows.push({ childName: names[0] ?? emails[0] ?? phones[0], person, contacts })
  }
  return rows
}

/** Legt neue Kinder an oder ergänzt bestehende (gleicher Name) um fehlende Kontakte. */
export async function applyImport(rows: ImportRow[]) {
  let created = 0
  let updated = 0
  await db.transaction('rw', db.children, async () => {
    const existing = await db.children.toArray()
    const byName = new Map(existing.map((c) => [c.name.trim().toLowerCase(), c]))
    for (const row of rows) {
      const key = row.childName.trim().toLowerCase()
      let child = byName.get(key)
      const isNew = !child
      if (!child) {
        child = {
          name: row.childName,
          active: true,
          contacts: [],
          note: row.childName.includes('@') ? 'Aus altem Verteiler importiert – bitte Kind eintragen.' : undefined,
          createdAt: now(),
          updatedAt: now(),
        } satisfies Child
        byName.set(key, child)
      }
      const known = new Set(child.contacts.map((c) => c.value.trim().toLowerCase()))
      const additions = row.contacts.filter((c) => !known.has(c.value.trim().toLowerCase()))
      if (!additions.length && !isNew) continue
      child.contacts.push(...additions.map((c) => ({ ...c, id: newId() })))
      child.updatedAt = now()
      child.id = (await db.children.put(child)) as number
      if (isNew) created++
      else updated++
    }
  })
  await touch()
  return { created, updated }
}
