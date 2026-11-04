import { useLiveQuery } from 'dexie-react-hooks'
import { IconMail, IconPeople, IconSettings, Toast } from './components'
import { db } from './lib/db'
import { daysSince, useRoute, useSettings } from './lib/util'
import ChildrenView from './views/ChildrenView'
import ChildEdit from './views/ChildEdit'
import MessagesView from './views/MessagesView'
import MessageEdit from './views/MessageEdit'
import SendView from './views/SendView'
import SettingsView from './views/SettingsView'

const BACKUP_REMINDER_DAYS = 7

export default function App() {
  const [section = 'kinder', param] = useRoute()
  const tab = ['kind', 'kinder'].includes(section) ? 'kinder' : ['einstellungen'].includes(section) ? 'einstellungen' : 'nachrichten'
  const isMainScreen = ['kinder', 'nachrichten', 'einstellungen'].includes(section)

  let view
  switch (section) {
    case 'kind':
      view = <ChildEdit key={param} id={param === 'neu' ? undefined : Number(param)} />
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
      <main className="app">
        {isMainScreen && section !== 'einstellungen' && <BackupReminder />}
        {view}
      </main>
      <div className="tabbar">
        <nav>
          <a href="#/kinder" className={tab === 'kinder' ? 'active' : ''}>
            <IconPeople />
            Verteiler
          </a>
          <a href="#/nachrichten" className={tab === 'nachrichten' ? 'active' : ''}>
            <IconMail />
            Nachrichten
          </a>
          <a href="#/einstellungen" className={tab === 'einstellungen' ? 'active' : ''}>
            <IconSettings />
            Einstellungen
          </a>
        </nav>
      </div>
      <Toast />
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
        {settings.lastBackupAt ? `Letzte Sicherung vor ${days} Tagen.` : 'Noch keine Sicherung erstellt.'}
      </span>
      <a className="btn small" href="#/einstellungen">
        Sichern
      </a>
    </div>
  )
}
