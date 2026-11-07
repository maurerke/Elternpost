import { useEffect, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { ActionBar, IconImport, IconSettings, TopBar, celebrate, cheer, greeting, toast } from '../components'
import { createBackup, db, defaultSettings, deleteAllData, now, restoreBackup, updateSettings, type Settings } from '../lib/db'
import { daysSince, formatDate, isIOS, isStandalone, saveFile, today } from '../lib/util'

export default function SettingsView() {
  const stored = useLiveQuery(() => db.settings.get('main'))
  const [draft, setDraft] = useState<Settings | null>(null)

  useEffect(() => {
    if (stored && !draft) setDraft({ ...defaultSettings, ...stored })
  }, [stored, draft])

  const header = <TopBar title="Einstellungen" kicker={greeting()} icon={<IconSettings />} />

  if (!draft || !stored) return header

  const set = (changes: Partial<Settings>) => setDraft({ ...draft, ...changes })
  const { lastBackupAt: _b, lastChangeAt: _c, ...editable } = draft
  const dirty = Object.entries(editable).some(([k, v]) => (stored as unknown as Record<string, unknown>)[k] !== v)

  async function save() {
    await updateSettings(editable)
    toast(`${cheer()} Gespeichert ✨`)
  }

  return (
    <>
      {header}

      {!isStandalone() && <InstallHint />}

      <div className="section-title">📰 Newsletter</div>
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
          <textarea className="short" value={draft.signature} onChange={(e) => set({ signature: e.target.value })} />
        </label>
        <label className="field">
          <span>Hinweis in der Fußzeile</span>
          <textarea className="short" value={draft.footerNote} onChange={(e) => set({ footerNote: e.target.value })} />
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
        <label className="field">
          <span>Ausgetretene Kinder zum Löschen vorschlagen nach</span>
          <select value={draft.deleteAfterMonths} onChange={(e) => set({ deleteAfterMonths: Number(e.target.value) })}>
            {[1, 3, 6, 12].map((n) => (
              <option key={n} value={n}>
                {n} {n === 1 ? 'Monat' : 'Monaten'}
              </option>
            ))}
          </select>
        </label>
      </div>

      {dirty && (
        <ActionBar overTabbar>
          <button className="btn" onClick={() => setDraft({ ...defaultSettings, ...stored })}>
            Verwerfen
          </button>
          <button className="btn primary" onClick={save}>
            Speichern
          </button>
        </ActionBar>
      )}

      <Backup lastBackupAt={stored.lastBackupAt} lastChangeAt={stored.lastChangeAt} />
      <Import />
      <DangerZone />

      <p className="hint center">
        💛 Elternpost · Alle Daten bleiben auf diesem Gerät.
      </p>
    </>
  )
}

function InstallHint() {
  return (
    <div className="notice info">
      <span>📲</span>
      <span className="grow">
        Elternpost als App auf den Home-Bildschirm holen – mit eigenem Icon und auch offline.
      </span>
      <a className="btn small primary" href="#/installieren">
        So geht’s
      </a>
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
      toast('Gesichert – alles gut verstaut 🔒')
      celebrate()
    }
  }

  async function importBackup(file: File) {
    try {
      const data = JSON.parse(await file.text())
      if (!confirm('Alle aktuellen Daten durch diese Sicherung ersetzen?')) return
      await restoreBackup(data)
      toast('Sicherung wiederhergestellt 🎉')
      setTimeout(() => location.reload(), 600)
    } catch (e) {
      alert((e as Error).message || 'Die Datei konnte nicht gelesen werden.')
    }
  }

  const upToDate = lastBackupAt && (lastChangeAt ?? '') <= lastBackupAt

  return (
    <>
      <div className="section-title">💾 Sicherung</div>
      <div className="card">
        <p>
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
        <div className="actions flush">
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
  return (
    <>
      <div className="section-title">📇 Verteiler</div>
      <a className="btn block" href="#/import">
        <IconImport /> Kontakte importieren
      </a>
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
