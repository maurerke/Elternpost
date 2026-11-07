import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Confetti, IconMail, IconPeople, IconSettings, Toast } from './components'
import { db } from './lib/db'
import { shouldShowInstallGuide } from './lib/install'
import { daysSince, useRoute, useSettings } from './lib/util'
import ChildrenView from './views/ChildrenView'
import ChildEdit from './views/ChildEdit'
import ImportView from './views/ImportView'
import AssignView from './views/AssignView'
import MessagesView from './views/MessagesView'
import MessageEdit from './views/MessageEdit'
import SendView from './views/SendView'
import SettingsView from './views/SettingsView'
import InstallGuide from './views/InstallGuide'
import Welcome from './views/Welcome'

const BACKUP_REMINDER_DAYS = 7

export default function App() {
  const [section = 'kinder', param] = useRoute()
  // Im Handy-Browser zuerst erklären, wie man Elternpost als App installiert.
  const [installGuide, setInstallGuide] = useState(shouldShowInstallGuide)
  const tab = ['kind', 'kinder', 'import', 'zuordnen'].includes(section) ? 'kinder' : ['einstellungen', 'installieren'].includes(section) ? 'einstellungen' : 'nachrichten'
  const isMainScreen = ['kinder', 'nachrichten', 'einstellungen'].includes(section)
  // Auf Bearbeiten-Seiten nimmt die Speicherleiste den Platz der Tab-Leiste ein.
  const isEditScreen = ['kind', 'nachricht'].includes(section)

  // Jeder Bereich hat seine eigene Farbe (siehe styles.css).
  // Allererster Start (noch gar keine Daten): kurze Einführung statt leerer App.
  const firstRun = useLiveQuery(async () => {
    const settings = await db.settings.get('main')
    if (settings?.welcomeDone) return false
    const [children, messages] = await Promise.all([db.children.count(), db.messages.count()])
    return children === 0 && messages === 0
  }, [])
  const welcome = !installGuide && firstRun === true

  useEffect(() => {
    document.documentElement.dataset.section = installGuide ? 'install' : welcome ? 'welcome' : tab
  }, [tab, installGuide, welcome])

  // Kurz warten, bis klar ist, ob die Einführung kommt – sonst blitzt die leere App auf.
  if (!installGuide && firstRun === undefined) return <BgDeco />

  if (welcome) {
    return (
      <>
        <BgDeco />
        <main className="app install-screen">
          <div className="view">
            <Welcome />
          </div>
        </main>
        <Toast />
        <Confetti />
      </>
    )
  }

  if (installGuide) {
    return (
      <>
        <BgDeco />
        <main className="app install-screen">
          <div className="view">
            <InstallGuide onSkip={() => setInstallGuide(false)} />
          </div>
        </main>
        <Toast />
        <Confetti />
      </>
    )
  }

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
    case 'installieren':
      view = <InstallGuide />
      break
    default:
      view = <ChildrenView />
  }

  return (
    <>
      <BgDeco />
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

const BgDeco = () => (
  <div className="bg-deco" aria-hidden="true">
    <span />
    <span />
    <span />
  </div>
)

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
