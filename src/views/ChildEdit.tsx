import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { BackButton, TopBar, toast } from '../components'
import { db, deleteChild, newId, now, saveChild, type Child, type Contact, type ContactKind } from '../lib/db'
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

  useEffect(() => {
    if (id !== undefined) db.children.get(id).then((c) => setChild(c ?? null))
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
  const canSave = child.name.trim().length > 0 && invalidEmails.length === 0

  async function save() {
    if (!child || !canSave) return
    await saveChild({
      ...child,
      name: child.name.trim(),
      group: child.group?.trim(),
      contacts: child.contacts
        .filter((c) => c.value.trim())
        .map((c) => ({ ...c, value: c.value.trim(), person: c.person?.trim() || undefined })),
    })
    toast(id === undefined ? 'Kind hinzugefügt' : 'Gespeichert')
    go('/kinder')
  }

  async function setActive(active: boolean) {
    if (!child) return
    set({ active, leftAt: active ? undefined : today() })
  }

  async function remove() {
    if (!child?.id) return
    if (!confirm(`${child.name} mit allen Kontaktdaten endgültig löschen?`)) return
    await deleteChild(child.id)
    toast('Gelöscht')
    go('/kinder')
  }

  return (
    <>
      <TopBar
        small
        title={id === undefined ? 'Neues Kind' : 'Bearbeiten'}
        left={<BackButton to="/kinder" />}
        right={
          <button className="link-btn bold" onClick={save} disabled={!canSave}>
            Fertig
          </button>
        }
      />

      <div className="card">
        <label className="field">
          <span>Name des Kindes</span>
          <input value={child.name} onChange={(e) => set({ name: e.target.value })} placeholder="z. B. Emma Müller" autoFocus={id === undefined} />
        </label>
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
          <label className="field">
            <span>In der Kita seit</span>
            <input type="date" value={child.joinedAt ?? ''} onChange={(e) => set({ joinedAt: e.target.value })} />
          </label>
        </div>
      </div>

      <div className="section-title">Kontakte</div>
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
                  placeholder="Elternteil (optional), z. B. Mama Anna"
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
        <div className="button-row" style={{ marginTop: 12 }}>
          <button className="btn small" onClick={() => addContact('email')}>
            + E-Mail
          </button>
          <button className="btn small" onClick={() => addContact('phone')}>
            + Telefon
          </button>
        </div>
        {invalidEmails.length > 0 && <p className="hint" style={{ color: 'var(--danger)' }}>Bitte E-Mail-Adresse prüfen.</p>}
      </div>

      <div className="section-title">Notiz</div>
      <div className="card">
        <textarea
          value={child.note ?? ''}
          onChange={(e) => set({ note: e.target.value })}
          placeholder="z. B. „Aufnahme per Mail gewünscht am 12.10.“"
          style={{ minHeight: 80 }}
        />
        <p className="hint">Tipp: Notiere, wann und wie die Eltern in den Verteiler wollten – so ist die Einwilligung dokumentiert.</p>
      </div>

      {id !== undefined && (
        <>
          <div className="section-title">Status</div>
          <div className="card">
            {child.active ? (
              <>
                <p style={{ marginTop: 0 }}>
                  <span className="badge ok">Aktiv</span> bekommt alle Nachrichten.
                </p>
                <button className="btn block" onClick={() => setActive(false)}>
                  Kind hat die Kita verlassen
                </button>
                <p className="hint">Es bekommt dann keine Mails mehr. Die Daten bleiben noch eine Weile, falls es ein Versehen war.</p>
              </>
            ) : (
              <>
                <p style={{ marginTop: 0 }}>
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

      <div className="actions">
        <button className="btn primary block" onClick={save} disabled={!canSave}>
          Speichern
        </button>
      </div>
    </>
  )
}
