import Dexie, { type EntityTable } from 'dexie'

export type ContactKind = 'email' | 'phone'

/** Eine E-Mail-Adresse oder Telefonnummer, optional einem Elternteil zugeordnet. */
export interface Contact {
  id: string
  kind: ContactKind
  value: string
  person?: string
}

export interface Child {
  id?: number
  /** Leer = aus dem alten Verteiler importiert, Kind noch nicht eingetragen. */
  name: string
  group?: string
  joinedAt?: string
  note?: string
  active: boolean
  leftAt?: string
  contacts: Contact[]
  createdAt: string
  updatedAt: string
}

export type MessageSource = 'kita' | 'eigen'
export type MessageStatus = 'entwurf' | 'versendet'

export interface Message {
  id?: number
  subject: string
  body: string
  source: MessageSource
  /** Datum der Original-Mail der Kita-Leitung */
  sourceDate?: string
  attachmentsNote?: string
  /** Leer = an alle aktiven Kinder */
  groups: string[]
  status: MessageStatus
  sentAt?: string
  recipientCount?: number
  createdAt: string
  updatedAt: string
}

export interface Settings {
  id: 'main'
  title: string
  ownEmail: string
  greeting: string
  signature: string
  footerNote: string
  historyCount: number
  deleteAfterMonths: number
  lastBackupAt?: string
  lastChangeAt?: string
  /** Die Einführung beim ersten Start wurde abgeschlossen. */
  welcomeDone?: boolean
}

export const defaultSettings: Settings = {
  id: 'main',
  title: 'Elternsprecher Kita',
  ownEmail: '',
  greeting: 'Liebe Eltern,',
  signature: 'Viele Grüße\nEure Elternsprecher',
  footerNote:
    'Ihr bekommt diese Mail über den Eltern-Verteiler der Kita. Wer aufgenommen oder ausgetragen werden möchte, antwortet einfach kurz auf diese Mail.',
  historyCount: 3,
  deleteAfterMonths: 6,
}

export const db = new Dexie('elternpost') as Dexie & {
  children: EntityTable<Child, 'id'>
  messages: EntityTable<Message, 'id'>
  settings: EntityTable<Settings, 'id'>
}

db.version(1).stores({
  children: '++id, name, group',
  messages: '++id, status, sentAt, createdAt',
  settings: 'id',
})

// Früher bekamen importierte Adressen die Adresse als Kindnamen – jetzt bleibt der Name leer.
db.version(2)
  .stores({
    children: '++id, name, group',
    messages: '++id, status, sentAt, createdAt',
    settings: 'id',
  })
  .upgrade((tx) => tx.table('children').toCollection().modify((c: Child) => normalizeChild(c)))

db.on('populate', (tx) => {
  tx.table('settings').add(defaultSettings)
})

export const now = () => new Date().toISOString()

/** crypto.randomUUID gibt es nur über HTTPS – im LAN-Test braucht es einen Ersatz. */
export const newId = () =>
  typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : Date.now().toString(36) + Math.random().toString(36).slice(2)

const IMPORT_NOTE = 'Aus altem Verteiler importiert'

export function normalizeChild(c: Child): Child {
  const name = c.name?.trim().toLowerCase() ?? ''
  if (name.includes('@') && c.contacts.some((k) => k.value.trim().toLowerCase() === name)) {
    c.name = ''
    if (c.note?.startsWith(IMPORT_NOTE)) c.note = ''
  }
  return c
}

/** Noch kein Kind eingetragen – nur Adressen aus dem Import. */
export const isOpen = (c: Child) => !c.name.trim()

export const firstEmail = (c: Child) => c.contacts.find((k) => k.kind === 'email')?.value ?? c.contacts[0]?.value ?? ''

export const displayName = (c: Child) => c.name.trim() || firstEmail(c) || 'Ohne Namen'

const contactKey = (c: Pick<Contact, 'kind' | 'value'>) => `${c.kind}:${c.value.trim().toLowerCase()}`

/**
 * Führt Einträge zusammen: Alle Kontakte von `sourceIds` wandern zu `target`, die Quellen werden gelöscht.
 * `target` darf ungespeicherte Änderungen enthalten (z. B. einen neuen Namen).
 */
export async function mergeChildren(target: Child, sourceIds: number[]): Promise<number> {
  const others = sourceIds.filter((id) => id !== target.id)
  let id = target.id as number
  await db.transaction('rw', db.children, async () => {
    const sources = (await db.children.bulkGet(others)).filter((c): c is Child => !!c)
    const known = new Set(target.contacts.map(contactKey))
    const contacts = [...target.contacts]
    for (const source of sources) {
      for (const contact of source.contacts) {
        if (known.has(contactKey(contact))) continue
        known.add(contactKey(contact))
        contacts.push(contact)
      }
    }
    const notes = [...new Set([target.note, ...sources.map((s) => s.note)].map((n) => n?.trim()).filter(Boolean))]
    id = (await db.children.put({ ...target, contacts, note: notes.join('\n'), updatedAt: now() })) as number
    await db.children.bulkDelete(others)
  })
  await touch()
  return id
}

/** Merkt sich, dass sich Daten geändert haben (für die Backup-Erinnerung). */
export const touch = () => db.settings.update('main', { lastChangeAt: now() })

export async function saveChild(child: Child): Promise<number> {
  const record = { ...child, updatedAt: now() }
  const id = await db.children.put(record)
  await touch()
  return id as number
}

export async function deleteChild(id: number) {
  await db.children.delete(id)
  await touch()
}

export async function saveMessage(message: Message): Promise<number> {
  const record = { ...message, updatedAt: now() }
  const id = await db.messages.put(record)
  await touch()
  return id as number
}

export async function deleteMessage(id: number) {
  await db.messages.delete(id)
  await touch()
}

export async function updateSettings(changes: Partial<Settings>) {
  await db.settings.update('main', changes)
}

/* ---------- Backup ---------- */

export interface Backup {
  app: 'elternpost'
  version: 1
  exportedAt: string
  children: Child[]
  messages: Message[]
  settings: Settings
}

export async function createBackup(): Promise<Backup> {
  const [children, messages, settings] = await Promise.all([
    db.children.toArray(),
    db.messages.toArray(),
    db.settings.get('main'),
  ])
  return {
    app: 'elternpost',
    version: 1,
    exportedAt: now(),
    children,
    messages,
    settings: { ...defaultSettings, ...settings },
  }
}

/** Liest eine Sicherungsdatei und prüft, ob sie wirklich von Elternpost stammt. */
export async function readBackupFile(file: File): Promise<Backup> {
  let data: unknown
  try {
    data = JSON.parse(await file.text())
  } catch {
    throw new Error('Die Datei konnte nicht gelesen werden – ist das eine Sicherung von Elternpost (.json)?')
  }
  const backup = data as Backup
  if (backup?.app !== 'elternpost' || !Array.isArray(backup.children)) {
    throw new Error('Das ist keine Sicherung von Elternpost.')
  }
  return backup
}

export async function restoreBackup(backup: Backup) {
  await db.transaction('rw', db.children, db.messages, db.settings, async () => {
    await db.children.clear()
    await db.messages.clear()
    await db.children.bulkAdd(backup.children.map(normalizeChild))
    await db.messages.bulkAdd(backup.messages ?? [])
    await db.settings.put({
      ...defaultSettings,
      ...backup.settings,
      id: 'main',
      lastBackupAt: backup.exportedAt,
      lastChangeAt: backup.exportedAt,
      welcomeDone: true,
    })
  })
}

export async function deleteAllData() {
  await db.transaction('rw', db.children, db.messages, db.settings, async () => {
    await db.children.clear()
    await db.messages.clear()
    await db.settings.put(defaultSettings)
  })
}
