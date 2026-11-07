import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { IconImport, Progress, TopBar, toast } from '../components'
import { db, firstEmail, isOpen, touch, type Child } from '../lib/db'
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
  const openCount = active.filter(isOpen).length
  const q = query.trim().toLowerCase()

  const visible = (filter === 'aktiv' || left.length === 0 ? active : left)
    .filter((c) => !group || c.group === group)
    .filter(
      (c) =>
        !q ||
        c.name.toLowerCase().includes(q) ||
        c.contacts.some((k) => k.value.toLowerCase().includes(q) || k.person?.toLowerCase().includes(q)),
    )
  const named = visible.filter((c) => !isOpen(c)).sort((a, b) => a.name.localeCompare(b.name, 'de'))
  const open = visible.filter(isOpen).sort((a, b) => firstEmail(a).localeCompare(firstEmail(b)))

  const expired = left.filter((c) => daysSince(c.leftAt) > settings.deleteAfterMonths * 30)

  async function deleteExpired() {
    if (!confirm(`${expired.length} ausgetretene Kinder mit allen Kontaktdaten endgültig löschen?`)) return
    await db.children.bulkDelete(expired.map((c) => c.id!))
    await touch()
    toast('Gelöscht')
  }

  const importButton = (
    <a className="icon-btn top" href="#/import" aria-label="Importieren" title="Importieren">
      <IconImport />
    </a>
  )

  if (children.length === 0) {
    return (
      <>
        <TopBar title="Verteiler" />
        <div className="empty start">
          <div className="big">📇</div>
          <div className="actions">
            <a className="btn primary block" href="#/import">
              <IconImport /> Verteiler importieren
            </a>
            <button className="btn block" onClick={() => go('/kind/neu')}>
              + Kind anlegen
            </button>
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      <TopBar title="Verteiler" right={importButton} />

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

      {openCount > 0 && (
        <a className="card todo" href="#/zuordnen">
          <div className="grow">
            <div className="todo-title">
              <b>{openCount}</b> {openCount === 1 ? 'Adresse' : 'Adressen'} ohne Kind
            </div>
            <Progress value={active.length - openCount} max={active.length} />
          </div>
          <span className="btn primary small">Zuordnen</span>
        </a>
      )}

      <input
        className="search"
        type="search"
        placeholder="Suchen"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      {left.length > 0 && (
        <div className="segmented">
          <button className={filter === 'aktiv' ? 'on' : ''} onClick={() => setFilter('aktiv')}>
            Aktiv ({active.length})
          </button>
          <button className={filter === 'ausgetreten' ? 'on' : ''} onClick={() => setFilter('ausgetreten')}>
            Ausgetreten ({left.length})
          </button>
        </div>
      )}

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
          {active.length - openCount} Kinder · {recipientEmails(children, group ? [group] : []).length} ✉︎
          {group ? ` in „${group}“` : ''}
        </p>
      )}

      {named.length === 0 && open.length === 0 && <div className="empty">Nichts gefunden.</div>}

      {named.length > 0 && (
        <div className="list">
          {named.map((child) => (
            <ChildRow key={child.id} child={child} />
          ))}
        </div>
      )}

      {open.length > 0 && (
        <>
          <div className="section-title">Ohne Kind ({open.length})</div>
          <div className="list">
            {open.map((child) => (
              <ChildRow key={child.id} child={child} />
            ))}
          </div>
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

  if (isOpen(child)) {
    const extra = child.contacts.length - 1
    return (
      <a className="row" href={`#/kind/${child.id}`}>
        <div className={`avatar open ${child.active ? '' : 'off'}`}>?</div>
        <div className="main">
          <div className="title light">{firstEmail(child)}</div>
          {(persons.length > 0 || extra > 0) && (
            <div className="sub">{[persons.join(', '), extra > 0 ? `+${extra}` : ''].filter(Boolean).join(' · ')}</div>
          )}
        </div>
        <span className="chev">›</span>
      </a>
    )
  }

  const parts = [persons.join(', '), emails ? `${emails} ✉︎` : '', phones ? `${phones} ☎︎` : ''].filter(Boolean)
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
