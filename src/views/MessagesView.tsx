import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { TopBar } from '../components'
import { db, type Message } from '../lib/db'
import { formatDate, go } from '../lib/util'

export default function MessagesView() {
  const messages = useLiveQuery(() => db.messages.toArray(), [])
  const [query, setQuery] = useState('')
  if (!messages) return null

  const q = query.trim().toLowerCase()
  const matches = (m: Message) => !q || m.subject.toLowerCase().includes(q) || m.body.toLowerCase().includes(q)
  const drafts = messages
    .filter((m) => m.status === 'entwurf' && matches(m))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  const sent = messages
    .filter((m) => m.status === 'versendet' && matches(m))
    .sort((a, b) => (b.sentAt ?? '').localeCompare(a.sentAt ?? ''))

  return (
    <>
      <TopBar title="Nachrichten" />

      {messages.length === 0 ? (
        <div className="empty">
          <div className="big">✉️</div>
          <p>
            Noch keine Nachrichten.
            <br />
            Leite eine Mail der Kita-Leitung weiter oder schreib eine eigene – mit <b>+</b>.
          </p>
        </div>
      ) : (
        <>
          <input className="search" type="search" placeholder="Im Archiv suchen" value={query} onChange={(e) => setQuery(e.target.value)} />

          {drafts.length > 0 && (
            <>
              <div className="section-title">Entwürfe</div>
              <div className="list">
                {drafts.map((m) => (
                  <MessageRow key={m.id} message={m} />
                ))}
              </div>
            </>
          )}

          <div className="section-title">Versendet</div>
          {sent.length === 0 ? (
            <p className="hint" style={{ margin: '0 4px' }}>
              {q ? 'Nichts gefunden.' : 'Noch nichts versendet.'}
            </p>
          ) : (
            <div className="list">
              {sent.map((m) => (
                <MessageRow key={m.id} message={m} />
              ))}
            </div>
          )}
        </>
      )}

      <button className="fab" aria-label="Neue Nachricht" onClick={() => go('/nachricht/neu')}>
        +
      </button>
    </>
  )
}

function MessageRow({ message }: { message: Message }) {
  const isSent = message.status === 'versendet'
  const href = isSent ? `#/senden/${message.id}` : `#/nachricht/${message.id}`
  const meta = isSent
    ? `${formatDate(message.sentAt)} · an ${message.recipientCount ?? '?'} Adressen`
    : `Entwurf vom ${formatDate(message.updatedAt)}`
  return (
    <a className="row" href={href}>
      <div className="main">
        <div className="title">{message.subject || '(ohne Betreff)'}</div>
        <div className="sub">
          {meta}
          {message.groups.length > 0 && ` · ${message.groups.join(', ')}`}
        </div>
      </div>
      {message.source === 'kita' && <span className="badge">Kita-Leitung</span>}
      <span className="chev">›</span>
    </a>
  )
}
