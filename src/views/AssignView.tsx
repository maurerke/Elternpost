import { useEffect, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { BackButton, Progress, TopBar, toast } from '../components'
import { db, deleteChild, firstEmail, isOpen, mergeChildren, type Child } from '../lib/db'
import { guessPerson, relatedNamed, relatedOpen } from '../lib/guess'

/** Geht die importierten Adressen nacheinander durch und ordnet sie Kindern zu. */
export default function AssignView() {
  const children = useLiveQuery(() => db.children.toArray(), [])
  const [skipped, setSkipped] = useState<Set<number>>(new Set())
  const [kid, setKid] = useState('')
  const [person, setPerson] = useState('')
  const [extra, setExtra] = useState<Set<number>>(new Set())
  const kidInput = useRef<HTMLInputElement>(null)

  const active = (children ?? []).filter((c) => c.active)
  const open = active.filter(isOpen).sort((a, b) => firstEmail(a).localeCompare(firstEmail(b)))
  const current = open.find((c) => !skipped.has(c.id!))
  const named = active.filter((c) => !isOpen(c)).sort((a, b) => a.name.localeCompare(b.name, 'de'))

  useEffect(() => {
    setKid('')
    setPerson(current?.contacts.find((c) => c.person)?.person ?? '')
    setExtra(new Set())
    kidInput.current?.focus()
  }, [current?.id])

  if (!children) return null

  const header = (
    <TopBar
      small
      title="Zuordnen"
      left={<BackButton to="/kinder" label="Verteiler" />}
      right={<span className="badge">{open.length} offen</span>}
    />
  )
  const progress = <Progress value={active.length - open.length} max={active.length} />

  if (!current) {
    return (
      <>
        {header}
        {progress}
        <div className="empty">
          <div className="big">{open.length ? '☕' : '🎉'}</div>
          <p>{open.length ? `${open.length} übersprungen` : 'Alle Adressen sind zugeordnet.'}</p>
          <div className="button-row" style={{ justifyContent: 'center' }}>
            {open.length > 0 && (
              <button className="btn" onClick={() => setSkipped(new Set())}>
                Nochmal ansehen
              </button>
            )}
            <a className="btn primary" href="#/kinder">
              Zum Verteiler
            </a>
          </div>
        </div>
      </>
    )
  }

  const email = firstEmail(current)
  const match = named.find((c) => c.name.trim().toLowerCase() === kid.trim().toLowerCase())
  const kidSuggestions = relatedNamed(current, named).slice(0, 4)
  const family = relatedOpen(current, open).slice(0, 4)
  const personGuess = guessPerson(email)

  async function next() {
    if (!current || !kid.trim()) return
    const who = person.trim() || undefined
    const contacts = current.contacts.map((c) => ({ ...c, person: who ?? c.person }))
    const target: Child = match ?? { ...current, name: kid.trim() }
    await mergeChildren(
      { ...target, contacts: match ? [...match.contacts, ...contacts] : contacts },
      [current.id!, ...extra],
    )
    toast(match ? `Zu ${match.name} hinzugefügt` : `✓ ${kid.trim()}`)
  }

  async function remove() {
    if (!current || !confirm(`${email} aus dem Verteiler löschen?`)) return
    await deleteChild(current.id!)
  }

  const toggleExtra = (id: number) => {
    const set = new Set(extra)
    if (set.has(id)) set.delete(id)
    else set.add(id)
    setExtra(set)
  }

  return (
    <>
      {header}
      {progress}

      <div className="card assign">
        <div className="assign-email">
          {current.contacts.map((c) => (
            <div key={c.id}>{c.kind === 'email' ? '✉️' : '📞'} {c.value}</div>
          ))}
        </div>

        <label className="field">
          <span>Kind</span>
          <input
            ref={kidInput}
            value={kid}
            onChange={(e) => setKid(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && next()}
            list="kids"
            placeholder="Name des Kindes"
            autoComplete="off"
          />
          <datalist id="kids">
            {named.map((c) => (
              <option key={c.id} value={c.name} />
            ))}
          </datalist>
        </label>
        {match ? (
          <p className="merge-hint">↪ kommt zu {match.name} dazu</p>
        ) : (
          kidSuggestions.length > 0 && (
            <div className="suggest">
              {kidSuggestions.map((c) => (
                <button key={c.id} className="chip suggest" onClick={() => setKid(c.name)}>
                  {c.name}?
                </button>
              ))}
            </div>
          )
        )}

        <label className="field" style={{ marginBottom: 0 }}>
          <span>Elternteil</span>
          <input
            value={person}
            onChange={(e) => setPerson(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && next()}
            placeholder="optional"
            autoComplete="off"
          />
        </label>
        {!person && personGuess && (
          <div className="suggest">
            <button className="chip suggest" onClick={() => setPerson(personGuess)}>
              {personGuess}?
            </button>
          </div>
        )}

        {family.length > 0 && (
          <>
            <div className="field-label">Auch dazu?</div>
            <div className="suggest">
              {family.map((c) => (
                <button key={c.id} className={`chip suggest ${extra.has(c.id!) ? 'on' : ''}`} onClick={() => toggleExtra(c.id!)}>
                  {extra.has(c.id!) ? '✓ ' : '+ '}
                  {firstEmail(c)}
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      <div className="assign-actions">
        <button className="btn" onClick={() => setSkipped(new Set(skipped).add(current.id!))}>
          Später
        </button>
        <button className="btn primary" onClick={next} disabled={!kid.trim()}>
          Weiter
        </button>
      </div>
      <div className="actions">
        <button className="btn danger block small" onClick={remove}>
          Adresse löschen
        </button>
      </div>
    </>
  )
}
