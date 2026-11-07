import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { ActionBar, BackButton, Sheet, TopBar, colorOf, toast } from '../components'
import {
  db,
  deleteChild,
  displayName,
  firstEmail,
  isOpen,
  mergeChildren,
  newId,
  now,
  saveChild,
  type Child,
  type Contact,
  type ContactKind,
} from '../lib/db'
import { guessPerson, related } from '../lib/guess'
import { formatDate, go, groupsOf, isValidEmail, today } from '../lib/util'

const emptyChild = (): Child => ({
  name: '',
  group: '',
  joinedAt: '',
  note: '',
  active: true,
  contacts: [{ id: newId(), kind: 'email', value: '', person: '' }],
  createdAt: now(),
  updatedAt: now(),
})

export default function ChildEdit({ id }: { id?: number }) {
  const allChildren = useLiveQuery(() => db.children.toArray(), [])
  const [child, setChild] = useState<Child | null>(id === undefined ? emptyChild() : null)
  const [wasOpen, setWasOpen] = useState(false)
  /** Einträge „ohne Kind“, deren Adressen beim Speichern hierher wandern */
  const [absorb, setAbsorb] = useState<number[]>([])
  const [picker, setPicker] = useState<'adressen' | 'kind' | null>(null)

  useEffect(() => {
    if (id !== undefined)
      db.children.get(id).then((c) => {
        setChild(c ?? null)
        setWasOpen(!!c && isOpen(c))
      })
  }, [id])

  if (!child) return <TopBar small title="" left={<BackButton to="/kinder" />} />

  const groups = groupsOf(allChildren ?? [])
  const persons = [...new Set(child.contacts.map((c) => c.person?.trim()).filter((p): p is string => !!p))]
  const set = (changes: Partial<Child>) => setChild({ ...child, ...changes })

  const updateContact = (contactId: string, changes: Partial<Contact>) =>
    set({ contacts: child.contacts.map((c) => (c.id === contactId ? { ...c, ...changes } : c)) })
  const addContact = (kind: ContactKind) =>
    set({ contacts: [...child.contacts, { id: newId(), kind, value: '', person: persons.length === 1 ? persons[0] : '' }] })
  const removeContact = (contactId: string) => set({ contacts: child.contacts.filter((c) => c.id !== contactId) })

  const invalidEmails = child.contacts.filter((c) => c.kind === 'email' && c.value.trim() && !isValidEmail(c.value))
  const hasContact = child.contacts.some((c) => c.value.trim())
  const canSave = (child.name.trim().length > 0 || hasContact) && invalidEmails.length === 0

  const others = (allChildren ?? []).filter((c) => c.id !== child.id)
  const namedOthers = others.filter((c) => !isOpen(c))
  const sameName = child.name.trim()
    ? namedOthers.find((c) => c.name.trim().toLowerCase() === child.name.trim().toLowerCase())
    : undefined
  const openEntries = others.filter((c) => isOpen(c) && c.active && !absorb.includes(c.id!))
  const personGuesses = [
    ...new Set(
      child.contacts
        .filter((c) => c.kind === 'email' && !c.person?.trim())
        .map((c) => guessPerson(c.value))
        .filter((p): p is string => !!p),
    ),
  ]

  const cleaned = (): Child => ({
    ...child,
    name: child.name.trim(),
    group: child.group?.trim(),
    contacts: child.contacts
      .filter((c) => c.value.trim())
      .map((c) => ({ ...c, value: c.value.trim(), person: c.person?.trim() || undefined })),
  })

  async function save() {
    if (!child || !canSave) return
    if (absorb.length) await mergeChildren(cleaned(), absorb)
    else await saveChild(cleaned())
    const name = child.name.trim()
    toast(id === undefined || wasOpen ? `${name || 'Neuer Eintrag'} ist dabei! 🎈` : 'Gespeichert ✨')
    go('/kinder')
  }

  /** Alles von hier zu einem bestehenden Kind verschieben. */
  async function moveTo(target: Child) {
    if (!child) return
    const sources = [...(child.id !== undefined ? [child.id] : []), ...absorb]
    await mergeChildren({ ...target, contacts: [...target.contacts, ...cleaned().contacts] }, sources)
    toast(`Zu ${target.name} hinzugefügt 🤝`)
    go('/kinder')
  }

  /** Adressen eines Eintrags „ohne Kind“ hierher holen (wird beim Speichern übernommen). */
  function takeOver(source: Child) {
    if (!child) return
    const known = new Set(child.contacts.map((c) => c.value.trim().toLowerCase()))
    const contacts = child.contacts.filter((c) => c.value.trim())
    set({ contacts: [...contacts, ...source.contacts.filter((c) => !known.has(c.value.trim().toLowerCase()))] })
    setAbsorb([...absorb, source.id!])
    setPicker(null)
  }

  function applyPersonGuess(person: string) {
    set({
      contacts: child!.contacts.map((c) =>
        !c.person?.trim() && c.kind === 'email' && guessPerson(c.value) === person ? { ...c, person } : c,
      ),
    })
  }

  async function setActive(active: boolean) {
    if (!child) return
    set({ active, leftAt: active ? undefined : today() })
  }

  async function remove() {
    if (!child?.id) return
    if (!confirm(`${displayName(child)} mit allen Kontaktdaten endgültig löschen?`)) return
    await deleteChild(child.id)
    toast('Gelöscht')
    go('/kinder')
  }

  return (
    <>
      <TopBar
        small
        title={id === undefined ? 'Neues Kind' : wasOpen ? 'Kind eintragen' : 'Bearbeiten'}
        left={<BackButton to="/kinder" />}
      />

      <div className="card">
        <label className="field">
          <span>Name des Kindes</span>
          <input
            value={child.name}
            onChange={(e) => set({ name: e.target.value })}
            placeholder="z. B. Emma Müller"
            autoFocus={id === undefined || wasOpen}
          />
        </label>
        {sameName && (
          <div className="notice info compact">
            <span className="grow">„{sameName.name}“ gibt es schon.</span>
            <button className="btn small primary" onClick={() => moveTo(sameName)}>
              Zusammenführen
            </button>
          </div>
        )}
        {wasOpen && !child.name.trim() && namedOthers.length > 0 && (
          <button className="btn block small field-gap" onClick={() => setPicker('kind')}>
            ↪ Gehört zu einem anderen Kind
          </button>
        )}
        <div className="two">
          <label className="field">
            <span>Gruppe</span>
            <input value={child.group ?? ''} onChange={(e) => set({ group: e.target.value })} list="groups" placeholder="optional" />
            <datalist id="groups">
              {groups.map((g) => (
                <option key={g} value={g} />
              ))}
            </datalist>
          </label>
          <div className="field">
            <label className="field-label top" htmlFor="joined-at">
              In der Kita seit
            </label>
            <div className="date-input">
              <input
                id="joined-at"
                type="date"
                value={child.joinedAt ?? ''}
                className={child.joinedAt ? 'has-value' : ''}
                onChange={(e) => set({ joinedAt: e.target.value })}
                onClick={(e) => {
                  try {
                    e.currentTarget.showPicker?.()
                  } catch {
                    /* manche Browser erlauben das nicht – dann eben tippen */
                  }
                }}
              />
              {child.joinedAt && (
                <button type="button" className="clear-btn" aria-label="Datum entfernen" onClick={() => set({ joinedAt: '' })}>
                  ✕
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="section-title">👪 Kontakte</div>
      <div className="card">
        {child.contacts.length === 0 && <p className="hint">Noch keine Kontakte.</p>}
        {child.contacts.map((contact) => {
          const invalid = contact.kind === 'email' && contact.value.trim() !== '' && !isValidEmail(contact.value)
          return (
            <div className="contact" key={contact.id}>
              <div className="icon">{contact.kind === 'email' ? '✉️' : '📞'}</div>
              <div className="fields">
                <input
                  type={contact.kind === 'email' ? 'email' : 'tel'}
                  inputMode={contact.kind === 'email' ? 'email' : 'tel'}
                  autoCapitalize="off"
                  autoCorrect="off"
                  placeholder={contact.kind === 'email' ? 'E-Mail-Adresse' : 'Telefonnummer'}
                  value={contact.value}
                  className={invalid ? 'invalid' : ''}
                  onChange={(e) => updateContact(contact.id, { value: e.target.value })}
                />
                <input
                  className="person"
                  placeholder="Elternteil (optional)"
                  value={contact.person ?? ''}
                  list={`persons-${child.id ?? 'neu'}`}
                  onChange={(e) => updateContact(contact.id, { person: e.target.value })}
                />
              </div>
              <button className="icon-btn" aria-label="Kontakt entfernen" onClick={() => removeContact(contact.id)}>
                ✕
              </button>
            </div>
          )
        })}
        <datalist id={`persons-${child.id ?? 'neu'}`}>
          {persons.map((p) => (
            <option key={p} value={p} />
          ))}
        </datalist>
        {personGuesses.length > 0 && (
          <div className="suggest">
            {personGuesses.map((p) => (
              <button key={p} className="chip suggest" onClick={() => applyPersonGuess(p)}>
                {p}?
              </button>
            ))}
          </div>
        )}
        <div className="button-row">
          <button className="btn small" onClick={() => addContact('email')}>
            + E-Mail
          </button>
          <button className="btn small" onClick={() => addContact('phone')}>
            + Telefon
          </button>
          {openEntries.length > 0 && (
            <button className="btn small" onClick={() => setPicker('adressen')}>
              + Aus Verteiler
            </button>
          )}
        </div>
        {invalidEmails.length > 0 && <p className="hint danger">Hoppla – bitte die E-Mail-Adresse prüfen.</p>}
      </div>

      <div className="section-title">📝 Notiz</div>
      <div className="card">
        <textarea
          value={child.note ?? ''}
          onChange={(e) => set({ note: e.target.value })}
          className="short"
          placeholder="z. B. „Aufnahme per Mail gewünscht am 12.10.“"
        />
      </div>

      {id !== undefined && (
        <>
          <div className="section-title">🚦 Status</div>
          <div className="card">
            {child.active ? (
              <>
                <p>
                  <span className="badge ok">Aktiv</span> bekommt alle Nachrichten.
                </p>
                <button className="btn block" onClick={() => setActive(false)}>
                  Hat die Kita verlassen
                </button>
              </>
            ) : (
              <>
                <p>
                  <span className="badge">Ausgetreten</span> {child.leftAt ? `seit ${formatDate(child.leftAt)}` : ''} – bekommt keine Mails.
                </p>
                <button className="btn block" onClick={() => setActive(true)}>
                  Wieder aufnehmen
                </button>
              </>
            )}
          </div>
          <div className="actions">
            <button className="btn danger block" onClick={remove}>
              Endgültig löschen
            </button>
          </div>
        </>
      )}

      <ActionBar>
        <a className="btn" href="#/kinder">
          Abbrechen
        </a>
        <button className="btn primary" onClick={save} disabled={!canSave}>
          {id === undefined || wasOpen ? 'Hinzufügen' : 'Speichern'}
        </button>
      </ActionBar>

      {picker && (
        <Picker
          title={picker === 'kind' ? 'Zu welchem Kind?' : 'Adresse dazuholen'}
          entries={picker === 'kind' ? namedOthers : openEntries}
          suggested={related(child, others)}
          onPick={picker === 'kind' ? moveTo : takeOver}
          onClose={() => setPicker(null)}
        />
      )}
    </>
  )
}

/** Liste zum Antippen, passende Vorschläge zuerst. */
function Picker({
  title,
  entries,
  suggested,
  onPick,
  onClose,
}: {
  title: string
  entries: Child[]
  suggested: Child[]
  onPick: (c: Child) => void
  onClose: () => void
}) {
  const [query, setQuery] = useState('')
  const q = query.trim().toLowerCase()
  const hint = new Set(suggested.map((c) => c.id))
  const sorted = entries
    .filter(
      (c) =>
        !q || c.name.toLowerCase().includes(q) || c.contacts.some((k) => `${k.value} ${k.person ?? ''}`.toLowerCase().includes(q)),
    )
    .sort((a, b) => Number(hint.has(b.id)) - Number(hint.has(a.id)) || displayName(a).localeCompare(displayName(b), 'de'))

  return (
    <Sheet title={title} onClose={onClose}>
      <input className="search" type="search" placeholder="Suchen" value={query} onChange={(e) => setQuery(e.target.value)} />
      <div className="list">
        {sorted.length === 0 && <div className="empty small">Nichts gefunden.</div>}
        {sorted.map((c) => {
          const persons = [...new Set(c.contacts.map((k) => k.person).filter(Boolean))].join(', ')
          const open = isOpen(c)
          return (
            <button key={c.id} className="row" onClick={() => onPick(c)}>
              <div className={`avatar ${open ? 'open' : colorOf(c.name)}`}>{open ? '?' : c.name.trim().charAt(0).toUpperCase()}</div>
              <div className="main">
                <div className={`title ${open ? 'light' : ''}`}>{displayName(c)}</div>
                {(persons || !open) && <div className="sub">{persons || firstEmail(c)}</div>}
              </div>
              {hint.has(c.id) && <span className="badge ok">passt?</span>}
            </button>
          )
        })}
      </div>
    </Sheet>
  )
}
