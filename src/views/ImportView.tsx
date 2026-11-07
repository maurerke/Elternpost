import { useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { BackButton, IconImport, TopBar, celebrate, toast } from '../components'
import { db, displayName } from '../lib/db'
import { applyImport, parseAny, planImport, type ImportRow } from '../lib/importer'
import { go } from '../lib/util'

const PREVIEW = 6

export default function ImportView() {
  const children = useLiveQuery(() => db.children.toArray(), [])
  const fileInput = useRef<HTMLInputElement>(null)
  const [rows, setRows] = useState<ImportRow[] | null>(null)
  const [fileName, setFileName] = useState('')
  const [text, setText] = useState('')
  const [dragging, setDragging] = useState(false)

  async function readFile(file: File) {
    setFileName(file.name)
    setRows(parseAny(await file.text()))
  }

  const current = rows ?? (text.trim() ? parseAny(text) : null)
  const plan = current && children ? planImport(current, children) : null
  const newCount = plan ? plan.created.length + plan.extended.length : 0

  async function run() {
    if (!plan) return
    await applyImport(plan)
    toast(plan.created.length ? `${plan.created.length} Adressen importiert 🎉` : 'Verteiler ergänzt ✨')
    celebrate()
    go('/kinder')
  }

  function reset() {
    setRows(null)
    setFileName('')
    setText('')
  }

  return (
    <>
      <TopBar small title="Importieren" left={<BackButton to="/kinder" />} />

      {!current ? (
        <>
          <button
            className={`dropzone ${dragging ? 'over' : ''}`}
            onClick={() => fileInput.current?.click()}
            onDragOver={(e) => {
              e.preventDefault()
              setDragging(true)
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault()
              setDragging(false)
              const file = e.dataTransfer.files[0]
              if (file) readFile(file)
            }}
          >
            <span className="drop-icon">
              <IconImport />
            </span>
            <b>Kontakte-Datei wählen</b>
            <span>.vcf- oder .csv-Datei antippen oder hierher ziehen</span>
          </button>
          <input
            ref={fileInput}
            type="file"
            accept=".vcf,.vcard,text/vcard,text/x-vcard,.csv,.txt,text/plain"
            hidden
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) readFile(file)
              e.target.value = ''
            }}
          />

          <details className="card">
            <summary>Wo bekomme ich die Datei her?</summary>
            <ul className="import-help">
              <li>
                <b>iPhone-Kontakte:</b> In der Kontakte-App die Liste (z. B. „Kita“) gedrückt halten → <b>Exportieren</b> → in Dateien sichern.
              </li>
              <li>
                <b>Gmail / Google Kontakte:</b> Auf contacts.google.com die Kontakte oder das Label auswählen → <b>Exportieren</b> → vCard oder
                Google-CSV.
              </li>
              <li>
                <b>Outlook:</b> Unter <b>Personen</b> → <b>Kontakte verwalten</b> → <b>Kontakte exportieren</b> (CSV).
              </li>
              <li>
                <b>Thunderbird:</b> Im Adressbuch das Buch mit rechts anklicken → <b>Exportieren</b> → CSV oder vCard.
              </li>
              <li>
                Oder einfach die Adressen aus einer alten Rundmail kopieren und unten einfügen.
              </li>
            </ul>
          </details>

          <details className="card">
            <summary>oder Adressen einfügen</summary>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={'anna@example.de\nmax@example.de\nEmma Müller; Anna Müller; anna@example.de'}
            />
          </details>
        </>
      ) : !plan ? null : newCount === 0 ? (
        <div className="empty">
          <div className="big">{plan.known ? '✅' : '🤷'}</div>
          <h2>{plan.known ? 'Schon alles da!' : 'Hmm …'}</h2>
          <p>{plan.known ? 'Alle Adressen sind schon im Verteiler.' : 'Keine E-Mail-Adressen gefunden.'}</p>
          <button className="btn" onClick={reset}>
            Andere Datei
          </button>
        </div>
      ) : (
        <>
          <div className="card import-summary">
            {fileName && <div className="hint field-gap">📇 {fileName}</div>}
            <div className="big-number">{plan.created.length}</div>
            <div>
              <b>neue Adressen</b> 🎉
            </div>
            {(plan.known > 0 || plan.extended.length > 0) && (
              <div className="hint">
                {[plan.known > 0 && `${plan.known} schon da`, plan.extended.length > 0 && `${plan.extended.length} ergänzt`]
                  .filter(Boolean)
                  .join(' · ')}
              </div>
            )}
          </div>

          <div className="list">
            {[...plan.created, ...plan.extended].slice(0, PREVIEW).map((c, i) => (
              <div className="row" key={i}>
                <div className="avatar open">?</div>
                <div className="main">
                  <div className="title">{displayName(c)}</div>
                  {c.contacts[0]?.person && <div className="sub">{c.contacts[0].person}</div>}
                </div>
              </div>
            ))}
            {newCount > PREVIEW && <div className="row sub-row">… und {newCount - PREVIEW} weitere</div>}
          </div>

          <div className="actions">
            <button className="btn primary block" onClick={run}>
              Jetzt importieren
            </button>
            <button className="btn block" onClick={reset}>
              Andere Datei
            </button>
          </div>
        </>
      )}
    </>
  )
}
