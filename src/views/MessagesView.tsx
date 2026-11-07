import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Fab, IconMail, IconPlus, TopBar, greeting } from '../components'
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
  const sentTotal = messages.filter((m) => m.status === 'versendet').length
  const draftTotal = messages.length - sentTotal
  const reached = messages.reduce((sum, m) => sum + (m.status === 'versendet' ? (m.recipientCount ?? 0) : 0), 0)
  const sent = messages
    .filter((m) => m.status === 'versendet' && matches(m))
    .sort((a, b) => (b.sentAt ?? '').localeCompare(a.sentAt ?? ''))

  return (
    <>
      <TopBar title="Nachrichten" kicker={greeting()} icon={<IconMail />} />

      {messages.length === 0 ? (
        <div className="empty">
          <div className="big">💌</div>
          <h2>Dein erster Newsletter</h2>
          <p>Leite eine Mail der Kita-Leitung weiter oder schreib eine eigene – tippe dazu auf das Plus.</p>
          <button className="btn primary" onClick={() => go('/nachricht/neu')}>
            <IconPlus /> Neue Nachricht
          </button>
        </div>
      ) : (
        <>
          <div className="tiles">
            <div className="tile c0">
              <div className="num">{sentTotal}</div>
              <div className="label">Versendet</div>
              <span className="deco">📬</span>
            </div>
            <div className="tile c3">
              <div className="num">{draftTotal}</div>
              <div className="label">{draftTotal === 1 ? 'Entwurf' : 'Entwürfe'}</div>
              <span className="deco">✏️</span>
            </div>
            <div className="tile c4">
              <div className="num">{reached}</div>
              <div className="label">Mails an Eltern</div>
              <span className="deco">🎈</span>
            </div>
          </div>

          <input className="search" type="search" placeholder="Im Archiv suchen" value={query} onChange={(e) => setQuery(e.target.value)} />

          {drafts.length > 0 && (
            <>
              <div className="section-title">
                ✏️ Entwürfe <span className="count">{drafts.length}</span>
              </div>
              <div className="list">
                {drafts.map((m) => (
                  <MessageRow key={m.id} message={m} />
                ))}
              </div>
            </>
          )}

          <div className="section-title">📬 Versendet</div>
          {sent.length === 0 ? (
            <p className="hint">{q ? 'Nichts gefunden – versuch’s mit einem anderen Suchwort.' : 'Noch nichts versendet – dein erster Newsletter wartet! 🚀'}</p>
          ) : (
            <div className="list">
              {sent.map((m) => (
                <MessageRow key={m.id} message={m} />
              ))}
            </div>
          )}
        </>
      )}

      <Fab label="Neue Nachricht" onClick={() => go('/nachricht/neu')} />
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
      <div className={`avatar emoji ${!isSent ? 'c3' : message.source === 'kita' ? 'c6' : 'c4'}`}>
        {!isSent ? '✏️' : message.source === 'kita' ? '🏫' : '💌'}
      </div>
      <div className="main">
        <div className="title">{message.subject || '(ohne Betreff)'}</div>
        <div className="sub">
          {meta}
          {message.groups.length > 0 && ` · ${message.groups.join(', ')}`}
        </div>
      </div>
      {message.source === 'kita' && <span className="badge c6">Kita-Leitung</span>}
      <span className="chev">›</span>
    </a>
  )
}
