import { useEffect, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { TopBar, toast } from '../components'
import { createBackup, db, defaultSettings, deleteAllData, now, restoreBackup, updateSettings, type Settings } from '../lib/db'
import { applyImport, parseImport } from '../lib/importer'
import { daysSince, formatDate, isIOS, isStandalone, saveFile, today } from '../lib/util'

export default function SettingsView() {
  const stored = useLiveQuery(() => db.settings.get('main'))
  const [draft, setDraft] = useState<Settings | null>(null)

  useEffect(() => {
    if (stored && !draft) setDraft({ ...defaultSettings, ...stored })
  }, [stored, draft])

  if (!draft || !stored) return <TopBar title="Einstellungen" />

  const set = (changes: Partial<Settings>) => setDraft({ ...draft, ...changes })
  const { lastBackupAt: _b, lastChangeAt: _c, ...editable } = draft
  const dirty = Object.entries(editable).some(([k, v]) => (stored as unknown as Record<string, unknown>)[k] !== v)

  async function save() {
    await updateSettings(editable)
    toast('Gespeichert')
  }

  return (
    <>
      <TopBar title="Einstellungen" />

      {!isStandalone() && <InstallHint />}

      <div className="section-title">Newsletter</div>
      <div className="card">
        <label className="field">
          <span>Absender / Überschrift</span>
          <input value={draft.title} onChange={(e) => set({ title: e.target.value })} placeholder="Elternsprecher Kita Sonnenschein" />
        </label>
        <label className="field">
          <span>Deine eigene E-Mail-Adresse („An“-Feld)</span>
          <input
            type="email"
            inputMode="email"
            autoCapitalize="off"
            value={draft.ownEmail}
            onChange={(e) => set({ ownEmail: e.target.value })}
            placeholder="elternsprecher@example.de"
          />
        </label>
        <label className="field">
          <span>Begrüßung (bei eigenen Nachrichten)</span>
          <input value={draft.greeting} onChange={(e) => set({ greeting: e.target.value })} />
        </label>
        <label className="field">
          <span>Grußformel (bei eigenen Nachrichten)</span>
          <textarea value={draft.signature} onChange={(e) => set({ signature: e.target.value })} style={{ minHeight: 70 }} />
        </label>
        <label className="field">
          <span>Hinweis in der Fußzeile</span>
          <textarea value={draft.footerNote} onChange={(e) => set({ footerNote: e.target.value })} style={{ minHeight: 90 }} />
        </label>
        <label className="field">
          <span>„Zur Erinnerung“: so viele frühere Nachrichten anhängen</span>
          <select value={draft.historyCount} onChange={(e) => set({ historyCount: Number(e.target.value) })}>
            {[0, 1, 2, 3, 4, 5, 7, 10].map((n) => (
              <option key={n} value={n}>
                {n === 0 ? 'keine' : n}
              </option>
            ))}
          </select>
        </label>
        <label className="field" style={{ marginBottom: 0 }}>
          <span>Ausgetretene Kinder zum Löschen vorschlagen nach</span>
          <select value={draft.deleteAfterMonths} onChange={(e) => set({ deleteAfterMonths: Number(e.target.value) })}>
            {[1, 3, 6, 12].map((n) => (
              <option key={n} value={n}>
                {n} {n === 1 ? 'Monat' : 'Monaten'}
              </option>
            ))}
          </select>
        </label>
        <button className="btn primary block" style={{ marginTop: 16 }} onClick={save} disabled={!dirty}>
          Speichern
        </button>
      </div>

      <Backup lastBackupAt={stored.lastBackupAt} lastChangeAt={stored.lastChangeAt} />
      <Import />
      <DangerZone />

      <p className="hint" style={{ textAlign: 'center', margin: '24px 0' }}>
        Elternpost · Alle Daten bleiben auf diesem Gerät.
      </p>
    </>
  )
}

function InstallHint() {
  return (
    <div className="notice info">
      <span>📲</span>
      <span className="grow">
        {isIOS() ? (
          <>
            Als App installieren: unten auf <b>Teilen</b> tippen und <b>„Zum Home-Bildschirm“</b> wählen. Danach nur noch über das Icon öffnen –
            Daten im Browser-Tab und in der App sind getrennt.
          </>
        ) : (
          <>Als App installieren: im Browser-Menü „App installieren“ wählen (Edge/Chrome).</>
        )}
      </span>
    </div>
  )
}

function Backup({ lastBackupAt, lastChangeAt }: { lastBackupAt?: string; lastChangeAt?: string }) {
  const fileInput = useRef<HTMLInputElement>(null)
  const [persisted, setPersisted] = useState<boolean | null>(null)

  useEffect(() => {
    navigator.storage?.persisted?.().then(setPersisted)
  }, [])

  async function exportBackup() {
    const backup = await createBackup()
    const saved = await saveFile(`elternpost-${today()}.json`, JSON.stringify(backup, null, 2), 'application/json')
    if (saved) {
      await updateSettings({ lastBackupAt: now() })
      toast('Sicherung erstellt')
    }
  }

  async function importBackup(file: File) {
    try {
      const data = JSON.parse(await file.text())
      if (!confirm('Alle aktuellen Daten durch diese Sicherung ersetzen?')) return
      await restoreBackup(data)
      toast('Sicherung wiederhergestellt')
      setTimeout(() => location.reload(), 600)
    } catch (e) {
      alert((e as Error).message || 'Die Datei konnte nicht gelesen werden.')
    }
  }

  const upToDate = lastBackupAt && (lastChangeAt ?? '') <= lastBackupAt

  return (
    <>
      <div className="section-title">Sicherung</div>
      <div className="card">
        <p style={{ marginTop: 0 }}>
          {lastBackupAt ? (
            <>
              Letzte Sicherung: <b>{formatDate(lastBackupAt)}</b>
              {daysSince(lastBackupAt) > 0 && ` (vor ${daysSince(lastBackupAt)} Tagen)`}{' '}
              {upToDate ? <span className="badge ok">aktuell</span> : <span className="badge warn">Änderungen seitdem</span>}
            </>
          ) : (
            'Noch keine Sicherung erstellt.'
          )}
        </p>
        <div className="actions" style={{ margin: 0 }}>
          <button className="btn primary block" onClick={exportBackup}>
            💾 Sicherung erstellen
          </button>
          <button className="btn block" onClick={() => fileInput.current?.click()}>
            Sicherung wiederherstellen
          </button>
        </div>
        <input
          ref={fileInput}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) importBackup(file)
            e.target.value = ''
          }}
        />
        <p className="hint">
          {isIOS()
            ? 'Im Teilen-Menü „In Dateien sichern“ → iCloud Drive wählen.'
            : 'Die Datei am besten im iCloud-Drive-Ordner ablegen.'}{' '}
          Mit der Datei kannst du die Daten auch auf ein anderes Gerät übertragen.
          {persisted === false && ' Hinweis: Dieser Browser garantiert nicht, dass die Daten dauerhaft bleiben – regelmäßig sichern!'}
        </p>
      </div>
    </>
  )
}

function Import() {
  const [text, setText] = useState('')
  const rows = parseImport(text)

  async function run() {
    const { created, updated } = await applyImport(rows)
    toast(`${created} neu angelegt, ${updated} ergänzt`)
    setText('')
  }

  return (
    <>
      <div className="section-title">Alten Verteiler importieren</div>
      <div className="card">
        <p className="hint" style={{ marginTop: 0, marginBottom: 10 }}>
          Eine Zeile pro Kontakt: <b>Kind; Elternteil; E-Mail; Telefon</b> – alles außer der Adresse ist optional. Einfach die Adressliste aus
          dem Mail-Programm hineinkopieren geht auch, die Kinder kannst du danach zuordnen.
        </p>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={'Emma Müller; Anna Müller; anna@example.de\nEmma Müller; Tom Müller; tom@example.de; 0171 1234567\nmax.mustermann@example.de'}
        />
        <button className="btn block" style={{ marginTop: 12 }} disabled={rows.length === 0} onClick={run}>
          {rows.length ? `${rows.length} Zeilen importieren` : 'Importieren'}
        </button>
      </div>
    </>
  )
}

function DangerZone() {
  async function wipe() {
    if (!confirm('Wirklich ALLE Kinder, Kontakte und Nachrichten auf diesem Gerät löschen?')) return
    if (!confirm('Sicher? Das lässt sich nur mit einer Sicherung rückgängig machen.')) return
    await deleteAllData()
    toast('Alle Daten gelöscht')
    setTimeout(() => location.reload(), 600)
  }
  return (
    <div className="actions">
      <button className="btn danger block" onClick={wipe}>
        Alle Daten löschen
      </button>
    </div>
  )
}
