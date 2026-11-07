import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { ActionBar, BackButton, TopBar, toast } from '../components'
import { db, deleteMessage, now, saveMessage, type Message } from '../lib/db'
import { go, groupsOf, recipientEmails, today } from '../lib/util'

const emptyMessage = (): Message => ({
  subject: '',
  body: '',
  source: 'kita',
  sourceDate: today(),
  attachmentsNote: '',
  groups: [],
  status: 'entwurf',
  createdAt: now(),
  updatedAt: now(),
})

const HEADER = /^\s*(von|from|an|to|cc|gesendet|datum|date|sent|betreff|subject|antwort an|reply-to)\s*:/i

/** Holt aus einer weitergeleiteten Mail den Betreff und entfernt die Kopfzeilen (Von:, An:, …). */
export function parseForwarded(text: string): { subject?: string; body: string } {
  const lines = text.replace(/\r\n/g, '\n').split('\n')
  let subject: string | undefined
  const body: string[] = []
  let inHeader = true
  for (const line of lines) {
    if (/^-{2,}.*(original|weitergeleitet|forwarded).*-{2,}$/i.test(line.trim())) continue
    if (inHeader && HEADER.test(line)) {
      const m = line.match(/^\s*(betreff|subject)\s*:\s*(.*)$/i)
      if (m) subject = m[2].replace(/^(aw|wg|fw|fwd|re)\s*:\s*/i, '').trim()
      continue
    }
    if (inHeader && line.trim() === '' && body.length === 0) continue
    inHeader = false
    body.push(line)
  }
  return { subject, body: body.join('\n').trim() }
}

export default function MessageEdit({ id }: { id?: number }) {
  const children = useLiveQuery(() => db.children.toArray(), [])
  const [message, setMessage] = useState<Message | null>(id === undefined ? emptyMessage() : null)

  useEffect(() => {
    if (id !== undefined) db.messages.get(id).then((m) => setMessage(m ?? null))
  }, [id])

  if (!message || !children) return <TopBar small title="" left={<BackButton to="/nachrichten" />} />

  const groups = groupsOf(children)
  const set = (changes: Partial<Message>) => setMessage({ ...message, ...changes })
  const count = recipientEmails(children, message.groups).length
  const canContinue = message.subject.trim() !== '' && message.body.trim() !== ''

  async function persist() {
    if (!message) return undefined
    const savedId = await saveMessage(message)
    setMessage({ ...message, id: savedId })
    return savedId
  }

  async function saveDraft() {
    await persist()
    toast('Entwurf gesichert ✏️')
    go('/nachrichten')
  }

  async function next() {
    const savedId = await persist()
    go(`/senden/${savedId}`)
  }

  async function pasteFromClipboard() {
    try {
      const text = await navigator.clipboard.readText()
      if (!text.trim()) return toast('Zwischenablage ist leer')
      applyPaste(text)
    } catch {
      toast('Bitte Text lange antippen und „Einsetzen“ wählen')
    }
  }

  function applyPaste(text: string) {
    const parsed = parseForwarded(text)
    set({ body: parsed.body, subject: message!.subject || parsed.subject || '' })
    toast(parsed.subject ? 'Text und Betreff übernommen ✨' : 'Text übernommen ✨')
  }

  async function remove() {
    if (!message?.id) return go('/nachrichten')
    if (!confirm('Nachricht löschen?')) return
    await deleteMessage(message.id)
    toast('Gelöscht')
    go('/nachrichten')
  }

  const toggleGroup = (g: string) =>
    set({ groups: message.groups.includes(g) ? message.groups.filter((x) => x !== g) : [...message.groups, g] })

  return (
    <>
      <TopBar
        small
        title={id === undefined ? 'Neue Nachricht' : 'Nachricht'}
        left={<BackButton to="/nachrichten" />}
      />

      <div className="segmented">
        <button className={message.source === 'kita' ? 'on' : ''} onClick={() => set({ source: 'kita' })}>
          Von der Kita-Leitung
        </button>
        <button className={message.source === 'eigen' ? 'on' : ''} onClick={() => set({ source: 'eigen' })}>
          Eigene Nachricht
        </button>
      </div>

      <div className="card">
        {message.source === 'kita' && (
          <>
            <button className="btn block" onClick={pasteFromClipboard}>
              📋 Kopierte Mail einfügen
            </button>
            <p className="hint field-gap">
              Mail der Kita-Leitung öffnen, Text markieren und kopieren – dann hier tippen. Betreff und Kopfzeilen werden automatisch erkannt.
            </p>
          </>
        )}

        <label className="field">
          <span>Betreff</span>
          <input value={message.subject} onChange={(e) => set({ subject: e.target.value })} placeholder="z. B. Laternenfest am 11.11." />
        </label>

        {message.source === 'kita' && (
          <label className="field">
            <span>Mail der Kita-Leitung vom</span>
            <input type="date" value={message.sourceDate ?? ''} onChange={(e) => set({ sourceDate: e.target.value })} />
          </label>
        )}

        <label className="field">
          <span>Text</span>
          <textarea
            className="body"
            value={message.body}
            onChange={(e) => set({ body: e.target.value })}
            onPaste={(e) => {
              const text = e.clipboardData.getData('text/plain')
              if (message.body.trim() === '' && HEADER.test(text.split('\n')[0] ?? '')) {
                e.preventDefault()
                applyPaste(text)
              }
            }}
            placeholder={
              message.source === 'kita'
                ? 'Text der Kita-Leitung'
                : 'Text der Nachricht. Begrüßung und Grußformel kommen automatisch dazu (siehe Einstellungen).'
            }
          />
        </label>

        <label className="field">
          <span>Anhänge (optional)</span>
          <input
            value={message.attachmentsNote ?? ''}
            onChange={(e) => set({ attachmentsNote: e.target.value })}
            placeholder="z. B. Speiseplan November.pdf"
          />
        </label>
        <p className="hint">Anhänge fügst du beim Versand in der Mail-App hinzu. Hier steht nur, was dabei ist.</p>
      </div>

      {groups.length > 0 && (
        <>
          <div className="section-title">👥 Empfänger</div>
          <div className="chips wrap">
            <button className={`chip ${message.groups.length === 0 ? 'on' : ''}`} onClick={() => set({ groups: [] })}>
              Alle
            </button>
            {groups.map((g) => (
              <button key={g} className={`chip ${message.groups.includes(g) ? 'on' : ''}`} onClick={() => toggleGroup(g)}>
                {g}
              </button>
            ))}
          </div>
        </>
      )}
      <p className="stats">💌 Geht an {count} E-Mail-Adressen.</p>

      <ActionBar>
        <button className="btn" onClick={saveDraft}>
          Entwurf sichern
        </button>
        <button className="btn primary" onClick={next} disabled={!canContinue}>
          Vorschau →
        </button>
      </ActionBar>

      <div className="actions">
        <button className="btn danger block" onClick={remove}>
          {message.id ? 'Nachricht löschen' : 'Verwerfen'}
        </button>
      </div>
    </>
  )
}
