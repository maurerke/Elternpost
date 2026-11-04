import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { BackButton, TopBar, toast } from '../components'
import { db, now, saveMessage } from '../lib/db'
import { buildHtml, buildText, historyFor, mailtoUrl } from '../lib/newsletter'
import { copyRich, copyText, formatDate, isIOS, recipientEmails, useSettings } from '../lib/util'

/** Längere mailto-Links schneiden manche Windows-Mailprogramme ab. */
const MAILTO_LIMIT = 2000

export default function SendView({ id }: { id: number }) {
  const message = useLiveQuery(() => db.messages.get(id), [id])
  const children = useLiveQuery(() => db.children.toArray(), [])
  const allMessages = useLiveQuery(() => db.messages.toArray(), [])
  const settings = useSettings()
  const [opened, setOpened] = useState(false)
  const [showAddresses, setShowAddresses] = useState(false)

  if (!message || !children || !allMessages) return <TopBar small title="" left={<BackButton to="/nachrichten" />} />

  const isSent = message.status === 'versendet'
  const history = historyFor(message, allMessages, settings.historyCount)
  const html = buildHtml(message, history, settings)
  const text = buildText(message, history, settings)
  const recipients = recipientEmails(children, message.groups)
  const mailto = mailtoUrl(settings.ownEmail, recipients, message.subject)
  const tooLong = mailto.length > MAILTO_LIMIT && !isIOS()

  async function openMail() {
    await copyRich(html, text)
    setOpened(true)
    toast('Newsletter kopiert – in der Mail einsetzen')
    window.location.href = mailto
  }

  async function copyNewsletter() {
    await copyRich(html, text)
    toast('Newsletter kopiert')
  }

  async function copyAddresses() {
    await copyText(recipients.join(', '))
    toast(`${recipients.length} Adressen kopiert`)
  }

  async function markSent() {
    if (!message) return
    await saveMessage({ ...message, status: 'versendet', sentAt: now(), recipientCount: recipients.length })
    toast('Im Archiv gespeichert')
  }

  return (
    <>
      <TopBar
        small
        title={isSent ? 'Archiv' : 'Versenden'}
        left={<BackButton to="/nachrichten" />}
        right={
          <a className="link-btn" href={`#/nachricht/${message.id}`} style={{ textDecoration: 'none' }}>
            Bearbeiten
          </a>
        }
      />

      {isSent && (
        <div className="notice info">
          <span>✅</span>
          <span className="grow">
            Versendet am {formatDate(message.sentAt)} an {message.recipientCount} Adressen.
          </span>
        </div>
      )}

      {!settings.ownEmail && (
        <div className="notice">
          <span>ℹ️</span>
          <span className="grow">
            Trag in den <a href="#/einstellungen">Einstellungen</a> deine eigene Adresse ein – sie kommt dann ins „An“-Feld, die Eltern ins BCC.
          </span>
        </div>
      )}

      <div className="card">
        <div className="steps">
          <div className={`step ${opened ? 'done' : ''}`}>
            <div>
              <b>{isSent ? 'Erneut senden' : 'Mail vorbereiten'}</b>
              <p>
                Die Mail-App öffnet sich mit Betreff und <b>{recipients.length} Adressen im BCC</b> – so sieht niemand die Adressen der
                anderen. Der Newsletter liegt in der Zwischenablage: in den Mail-Text tippen und <b>Einsetzen</b> wählen.
                {message.attachmentsNote && ' Anhänge nicht vergessen!'}
              </p>
              <button className="btn primary block" onClick={openMail} disabled={recipients.length === 0}>
                ✉️ Mail-App öffnen
              </button>
              {tooLong && (
                <p className="hint" style={{ color: 'var(--warn)' }}>
                  Sehr viele Adressen: Falls die Mail-App nicht alle übernimmt, nutze unten „Adressen kopieren“ und füge sie ins BCC-Feld ein.
                </p>
              )}
            </div>
          </div>
          {!isSent && (
            <div className="step">
              <div>
                <b>Abgeschickt?</b>
                <p>Dann ins Archiv übernehmen – so erscheint die Nachricht beim nächsten Mal unter „Zur Erinnerung“.</p>
                <button className="btn ok block" onClick={markSent}>
                  Als versendet markieren
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="card">
        <h2>Andere Wege</h2>
        <p className="hint" style={{ marginTop: 0, marginBottom: 12 }}>
          Mit Anhängen ist es oft am einfachsten, die Original-Mail der Kita-Leitung in der Mail-App weiterzuleiten und nur die
          Adressen ins BCC-Feld einzufügen.
        </p>
        <div className="button-row">
          <button className="btn small" onClick={copyAddresses} disabled={recipients.length === 0}>
            Adressen kopieren
          </button>
          <button className="btn small" onClick={copyNewsletter}>
            Newsletter kopieren
          </button>
          <button className="btn small" onClick={() => setShowAddresses(!showAddresses)}>
            {showAddresses ? 'Adressen ausblenden' : 'Adressen anzeigen'}
          </button>
        </div>
        {showAddresses && <div className="recipients">{recipients.join(', ') || 'Keine Adressen'}</div>}
      </div>

      <div className="section-title">Vorschau</div>
      <iframe
        className="preview"
        title="Vorschau"
        srcDoc={`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width"><body style="margin:0">${html}</body>`}
        onLoad={(e) => {
          const frame = e.currentTarget
          frame.style.height = `${frame.contentDocument?.documentElement.scrollHeight ?? 800}px`
        }}
      />
    </>
  )
}
