import { useEffect } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Confetti, IconMail, IconPeople, IconSettings, Toast } from './components'
import { db } from './lib/db'
import { daysSince, useRoute, useSettings } from './lib/util'
import ChildrenView from './views/ChildrenView'
import ChildEdit from './views/ChildEdit'
import ImportView from './views/ImportView'
import AssignView from './views/AssignView'
import MessagesView from './views/MessagesView'
import MessageEdit from './views/MessageEdit'
import SendView from './views/SendView'
import SettingsView from './views/SettingsView'

const BACKUP_REMINDER_DAYS = 7

export default function App() {
  const [section = 'kinder', param] = useRoute()
  const tab = ['kind', 'kinder', 'import', 'zuordnen'].includes(section) ? 'kinder' : ['einstellungen'].includes(section) ? 'einstellungen' : 'nachrichten'
  const isMainScreen = ['kinder', 'nachrichten', 'einstellungen'].includes(section)
  // Auf Bearbeiten-Seiten nimmt die Speicherleiste den Platz der Tab-Leiste ein.
  const isEditScreen = ['kind', 'nachricht'].includes(section)

  // Jeder Bereich hat seine eigene Farbe (siehe styles.css).
  useEffect(() => {
    document.documentElement.dataset.section = tab
  }, [tab])

  let view
  switch (section) {
    case 'kind':
      view = <ChildEdit key={param} id={param === 'neu' ? undefined : Number(param)} />
      break
    case 'import':
      view = <ImportView />
      break
    case 'zuordnen':
      view = <AssignView />
      break
    case 'nachrichten':
      view = <MessagesView />
      break
    case 'nachricht':
      view = <MessageEdit key={param} id={param === 'neu' ? undefined : Number(param)} />
      break
    case 'senden':
      view = <SendView key={param} id={Number(param)} />
      break
    case 'einstellungen':
      view = <SettingsView />
      break
    default:
      view = <ChildrenView />
  }

  return (
    <>
      <div className="bg-deco" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
      <main className="app">
        <div className="view" key={`${section}/${param ?? ''}`}>
          {isMainScreen && section !== 'einstellungen' && <BackupReminder />}
          {view}
        </div>
      </main>
      <div className="tabbar" hidden={isEditScreen}>
        <nav>
          <a href="#/kinder" className={`t-kinder ${tab === 'kinder' ? 'active' : ''}`}>
            <span className="pill">
              <IconPeople />
            </span>
            Verteiler
          </a>
          <a href="#/nachrichten" className={`t-nachrichten ${tab === 'nachrichten' ? 'active' : ''}`}>
            <span className="pill">
              <IconMail />
            </span>
            Nachrichten
          </a>
          <a href="#/einstellungen" className={`t-einstellungen ${tab === 'einstellungen' ? 'active' : ''}`}>
            <span className="pill">
              <IconSettings />
            </span>
            Einstellungen
          </a>
        </nav>
      </div>
      <Toast />
      <Confetti />
    </>
  )
}

/** Erinnert ans Sichern, wenn es seit der letzten Sicherung Änderungen gab. */
function BackupReminder() {
  const settings = useSettings()
  const hasData = useLiveQuery(() => db.children.count().then((n) => n > 0), [], false)
  const changedSinceBackup = (settings.lastChangeAt ?? '') > (settings.lastBackupAt ?? '')
  const days = daysSince(settings.lastBackupAt)
  if (!hasData || !changedSinceBackup || days < BACKUP_REMINDER_DAYS) return null
  return (
    <div className="notice">
      <span>💾</span>
      <span className="grow">
        {settings.lastBackupAt ? `Letzte Sicherung vor ${days} Tagen – kurz sichern?` : 'Noch keine Sicherung – 10 Sekunden, dann ist alles sicher.'}
      </span>
      <a className="btn small primary" href="#/einstellungen">
        Sichern
      </a>
    </div>
  )
}
