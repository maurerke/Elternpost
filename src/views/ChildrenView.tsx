import { useState, type ReactNode } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Fab, IconImport, IconPeople, ProgressBox, TopBar, colorOf, greeting, toast } from '../components'
import { db, firstEmail, isOpen, touch, type Child } from '../lib/db'
import { daysSince, go, groupsOf, recipientEmails, useSettings } from '../lib/util'
import { StartOptions } from './Welcome'

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
    toast('Aufgeräumt 🧹')
  }

  const importButton = (
    <a className="icon-btn top" href="#/import" aria-label="Importieren" title="Importieren">
      <IconImport />
    </a>
  )

  const header = (right?: ReactNode) => <TopBar title="Verteiler" kicker={greeting()} icon={<IconPeople />} right={right} />

  if (children.length === 0) {
    return (
      <>
        {header()}
        <div className="empty start">
          <div className="big">🎒</div>
          <h2>Noch niemand im Verteiler</h2>
          <p>Hol dir die Eltern-Adressen rein – danach erreichst du alle mit einem Fingertipp.</p>
          <StartOptions
            fresh={{
              emoji: '🧸',
              title: 'Erstes Kind anlegen',
              hint: 'Name, Gruppe und die Adressen der Eltern selbst eintragen.',
              onClick: () => go('/kind/neu'),
            }}
          />
        </div>
      </>
    )
  }

  return (
    <>
      {header(importButton)}

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
            <ProgressBox
              value={active.length - openCount}
              max={active.length}
              label={
                <>
                  🧩 <b>{openCount}</b> {openCount === 1 ? 'Adresse' : 'Adressen'} ohne Kind
                </>
              }
            />
          </div>
          <span className="btn primary small">Zuordnen</span>
        </a>
      )}

      {filter === 'aktiv' && (
        <div className="tiles">
          <div className="tile c1">
            <div className="num">{active.length - openCount}</div>
            <div className="label">Kinder</div>
            <span className="deco">🧸</span>
          </div>
          <div className="tile c0">
            <div className="num">{recipientEmails(children).length}</div>
            <div className="label">E-Mails</div>
            <span className="deco">💌</span>
          </div>
          <div className="tile c2">
            <div className="num">{groups.length}</div>
            <div className="label">{groups.length === 1 ? 'Gruppe' : 'Gruppen'}</div>
            <span className="deco">🎨</span>
          </div>
        </div>
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

      {filter === 'aktiv' && group && (
        <p className="stats">
          {named.length} Kinder · {recipientEmails(children, [group]).length} E-Mails in „{group}“
        </p>
      )}

      {named.length === 0 && open.length === 0 && (
        <div className="empty small">
          <div className="big">🔍</div>
          <p>Hier ist nichts – versuch’s mit einem anderen Suchwort.</p>
        </div>
      )}

      {named.length > 0 && (
        <div className="list">
          {named.map((child) => (
            <ChildRow key={child.id} child={child} />
          ))}
        </div>
      )}

      {open.length > 0 && (
        <>
          <div className="section-title">
            🧩 Ohne Kind <span className="count">{open.length}</span>
          </div>
          <div className="list">
            {open.map((child) => (
              <ChildRow key={child.id} child={child} />
            ))}
          </div>
        </>
      )}

      <Fab label="Kind hinzufügen" onClick={() => go('/kind/neu')} />
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

  const parts = [persons.join(', '), emails ? `${emails} ✉️` : '', phones ? `${phones} 📞` : ''].filter(Boolean)
  return (
    <a className="row" href={`#/kind/${child.id}`}>
      <div className={`avatar ${colorOf(child.name)} ${child.active ? '' : 'off'}`}>{child.name.trim().charAt(0).toUpperCase()}</div>
      <div className="main">
        <div className="title">{child.name}</div>
        <div className="sub">{parts.join(' · ') || 'Keine Kontaktdaten'}</div>
      </div>
      {child.group && <span className={`badge ${colorOf(child.group)}`}>{child.group}</span>}
      {emails === 0 && child.active && <span className="badge warn">keine Mail</span>}
      <span className="chev">›</span>
    </a>
  )
}
