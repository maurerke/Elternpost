import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { TopBar, toast } from '../components'
import { db, touch, type Child } from '../lib/db'
import { daysSince, go, groupsOf, recipientEmails, useSettings } from '../lib/util'

type Filter = 'aktiv' | 'ausgetreten'

export default function ChildrenView() {
  const children = useLiveQuery(() => db.children.toArray(), [])
  const settings = useSettings()
  const [query, setQuery] = useState('')
  const [group, setGroup] = useState<string | null>(null)
  const [filter, setFilter] = useState<Filter>('aktiv')

  if (!children) return null

  const groups = groupsOf(children)
  const active = children.filter((c) => c.active)
  const left = children.filter((c) => !c.active)
  const q = query.trim().toLowerCase()

  const visible = (filter === 'aktiv' ? active : left)
    .filter((c) => !group || c.group === group)
    .filter(
      (c) =>
        !q ||
        c.name.toLowerCase().includes(q) ||
        c.contacts.some((k) => k.value.toLowerCase().includes(q) || k.person?.toLowerCase().includes(q)),
    )
    .sort((a, b) => a.name.localeCompare(b.name, 'de'))

  const expired = left.filter((c) => daysSince(c.leftAt) > settings.deleteAfterMonths * 30)

  async function deleteExpired() {
    if (!confirm(`${expired.length} ausgetretene Kinder mit allen Kontaktdaten endgültig löschen?`)) return
    await db.children.bulkDelete(expired.map((c) => c.id!))
    await touch()
    toast('Gelöscht')
  }

  return (
    <>
      <TopBar title="Verteiler" />

      {expired.length > 0 && (
        <div className="notice">
          <span>🧹</span>
          <span className="grow">
            {expired.length} {expired.length === 1 ? 'Kind ist' : 'Kinder sind'} seit über {settings.deleteAfterMonths} Monaten
            ausgetreten. Daten löschen?
          </span>
          <button className="btn small" onClick={deleteExpired}>
            Löschen
          </button>
        </div>
      )}

      {children.length === 0 ? (
        <div className="empty">
          <div className="big">👋</div>
          <p>
            Noch keine Kinder im Verteiler.
            <br />
            Leg das erste Kind mit <b>+</b> an
            <br />
            oder importiere deinen alten Verteiler in den <a href="#/einstellungen">Einstellungen</a>.
          </p>
        </div>
      ) : (
        <>
          <input
            className="search"
            type="search"
            placeholder="Kind, Elternteil oder Adresse suchen"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />

          <div className="segmented">
            <button className={filter === 'aktiv' ? 'on' : ''} onClick={() => setFilter('aktiv')}>
              Aktiv ({active.length})
            </button>
            <button className={filter === 'ausgetreten' ? 'on' : ''} onClick={() => setFilter('ausgetreten')}>
              Ausgetreten ({left.length})
            </button>
          </div>

          {groups.length > 0 && (
            <div className="chips">
              <button className={`chip ${group === null ? 'on' : ''}`} onClick={() => setGroup(null)}>
                Alle Gruppen
              </button>
              {groups.map((g) => (
                <button key={g} className={`chip ${group === g ? 'on' : ''}`} onClick={() => setGroup(group === g ? null : g)}>
                  {g}
                </button>
              ))}
            </div>
          )}

          {filter === 'aktiv' && (
            <p className="stats">
              {active.length} Kinder · {recipientEmails(children, group ? [group] : []).length} E-Mail-Adressen
              {group ? ` in „${group}“` : ' im Verteiler'}
            </p>
          )}

          {visible.length === 0 ? (
            <div className="empty">Nichts gefunden.</div>
          ) : (
            <div className="list">
              {visible.map((child) => (
                <ChildRow key={child.id} child={child} />
              ))}
            </div>
          )}
        </>
      )}

      <button className="fab" aria-label="Kind hinzufügen" onClick={() => go('/kind/neu')}>
        +
      </button>
    </>
  )
}

function ChildRow({ child }: { child: Child }) {
  const emails = child.contacts.filter((c) => c.kind === 'email').length
  const phones = child.contacts.filter((c) => c.kind === 'phone').length
  const persons = [...new Set(child.contacts.map((c) => c.person?.trim()).filter(Boolean))]
  const parts = [
    persons.join(', '),
    emails ? `${emails} ✉︎` : '',
    phones ? `${phones} ☎︎` : '',
  ].filter(Boolean)

  return (
    <a className="row" href={`#/kind/${child.id}`}>
      <div className={`avatar ${child.active ? '' : 'off'}`}>{child.name.trim().charAt(0).toUpperCase()}</div>
      <div className="main">
        <div className="title">{child.name}</div>
        <div className="sub">{parts.join(' · ') || 'Keine Kontaktdaten'}</div>
      </div>
      {child.group && <span className="badge">{child.group}</span>}
      {emails === 0 && child.active && <span className="badge warn">keine Mail</span>}
      <span className="chev">›</span>
    </a>
  )
}
