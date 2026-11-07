import { useRef, useState, type ReactNode } from 'react'
import { celebrate, toast } from '../components'
import { db, readBackupFile, restoreBackup, updateSettings } from '../lib/db'
import { go, isIOS } from '../lib/util'

/**
 * Mini-Einführung beim allerersten Start (noch keine Daten):
 * erst kurz zeigen, was Elternpost kann, dann fragen, womit man loslegt.
 */
export default function Welcome() {
  const [step, setStep] = useState<'intro' | 'start'>('intro')
  const icon = `${import.meta.env.BASE_URL}icon-192.png`
  const done = () => updateSettings({ welcomeDone: true })

  if (step === 'intro') {
    return (
      <div className="install welcome">
        <img className="install-icon" src={icon} alt="" />
        <h1>Willkommen bei Elternpost 👋</h1>
        <p className="lead">Der Eltern-Verteiler für Elternsprecher – ohne Adress-Chaos.</p>

        <ul className="features card">
          <Feature emoji="📇" title="Alle Eltern an einem Ort">
            Adressen nach Kind und Gruppe sortiert – Ausgetretene bekommen keine Post mehr.
          </Feature>
          <Feature emoji="✉️" title="Infos in Sekunden verschickt">
            Mails der Kita-Leitung weiterleiten oder eigene schreiben – fertig für deine Mail-App.
          </Feature>
          <Feature emoji="🔒" title="Bleibt auf deinem Handy">
            Keine Cloud, kein Konto. Eine Sicherung kannst du z. B. in iCloud Drive ablegen.
          </Feature>
        </ul>

        <button className="btn primary block big" onClick={() => setStep('start')}>
          Los geht’s
        </button>
        <Dots active={0} />
      </div>
    )
  }

  return (
    <div className="install welcome">
      <h1>Wie möchtest du starten?</h1>
      <p className="lead">Keine Sorge – alles lässt sich später auch noch in den Einstellungen machen.</p>
      <StartOptions
        onChoose={done}
        fresh={{
          emoji: '✨',
          title: 'Neu starten',
          hint: 'Mit leerem Verteiler beginnen und die Kinder selbst eintragen.',
          onClick: async () => {
            await done()
            go('/kinder')
          },
        }}
      />
      <button className="link-btn install-skip" onClick={() => setStep('intro')}>
        Zurück
      </button>
      <Dots active={1} />
    </div>
  )
}

function Feature({ emoji, title, children }: { emoji: string; title: string; children: ReactNode }) {
  return (
    <li>
      <span className="feature-icon" aria-hidden="true">
        {emoji}
      </span>
      <div>
        <b>{title}</b>
        <p>{children}</p>
      </div>
    </li>
  )
}

const Dots = ({ active }: { active: number }) => (
  <div className="welcome-dots" aria-hidden="true">
    {[0, 1].map((i) => (
      <span key={i} className={i === active ? 'on' : ''} />
    ))}
  </div>
)

interface FreshOption {
  emoji: string
  title: string
  hint: string
  onClick: () => void
}

/**
 * Die drei Wege zum ersten Verteiler: aus dem Mail-Programm importieren,
 * eine Sicherung wiederherstellen (z. B. die gemeinsame aus iCloud Drive)
 * oder bei null anfangen. Auch auf dem leeren Verteiler zu sehen.
 */
export function StartOptions({ fresh, onChoose }: { fresh: FreshOption; onChoose?: () => Promise<unknown> }) {
  const fileInput = useRef<HTMLInputElement>(null)

  async function restore(file: File) {
    try {
      const backup = await readBackupFile(file)
      const [children, messages] = await Promise.all([db.children.count(), db.messages.count()])
      if ((children || messages) && !confirm('Alle aktuellen Daten durch diese Sicherung ersetzen?')) return
      await restoreBackup(backup)
      const n = backup.children.length
      toast(`Sicherung wiederhergestellt – ${n} ${n === 1 ? 'Eintrag' : 'Einträge'} 🎉`)
      celebrate()
      go('/kinder')
    } catch (e) {
      alert((e as Error).message)
    }
  }

  return (
    <div className="choices">
      <button
        className="choice"
        onClick={async () => {
          await onChoose?.()
          go('/import')
        }}
      >
        <span className="choice-icon c0">📇</span>
        <span className="main">
          <b>Verteiler importieren</b>
          <span>Kontakte aus Outlook, Gmail, Thunderbird oder dem iPhone – als .vcf- oder .csv-Datei.</span>
        </span>
        <span className="chev">›</span>
      </button>

      <button className="choice" onClick={() => fileInput.current?.click()}>
        <span className="choice-icon c2">💾</span>
        <span className="main">
          <b>Sicherung wiederherstellen</b>
          <span>
            Eine Elternpost-Sicherung (.json) – z. B. die, die ihr euch {isIOS() ? 'in iCloud Drive' : 'in einem gemeinsamen Ordner'} teilt.
          </span>
        </span>
        <span className="chev">›</span>
      </button>
      <input
        ref={fileInput}
        type="file"
        accept="application/json,.json"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) restore(file)
          e.target.value = ''
        }}
      />

      <button className="choice" onClick={fresh.onClick}>
        <span className="choice-icon c1">{fresh.emoji}</span>
        <span className="main">
          <b>{fresh.title}</b>
          <span>{fresh.hint}</span>
        </span>
        <span className="chev">›</span>
      </button>
    </div>
  )
}
