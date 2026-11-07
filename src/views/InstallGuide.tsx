import { useState, type ReactNode } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { celebrate, toast } from '../components'
import { db } from '../lib/db'
import { detectPlatform, skipInstall, useInstallPrompt, type Platform } from '../lib/install'
import { copyText, isIOS, isStandalone } from '../lib/util'

/* Kleine Symbole, so wie sie im Browser aussehen – damit man sie wiedererkennt. */
const sym = (path: ReactNode, label: string) => (
  <span className="sym" role="img" aria-label={label}>
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {path}
    </svg>
  </span>
)

const Share = () =>
  sym(
    <>
      <path d="M12 3v12" />
      <path d="M8 7l4-4 4 4" />
      <path d="M7 11H6a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-6a2 2 0 0 0-2-2h-1" />
    </>,
    'Teilen-Symbol',
  )

const AddHome = () =>
  sym(
    <>
      <rect x="4" y="4" width="16" height="16" rx="3.5" />
      <path d="M12 8.5v7M8.5 12h7" />
    </>,
    'Plus-Symbol',
  )

const Dots = () =>
  sym(
    <>
      <circle cx="5" cy="12" r="1.3" fill="currentColor" />
      <circle cx="12" cy="12" r="1.3" fill="currentColor" />
      <circle cx="19" cy="12" r="1.3" fill="currentColor" />
    </>,
    'Drei-Punkte-Menü',
  )

const DotsVertical = () =>
  sym(
    <>
      <circle cx="12" cy="5" r="1.3" fill="currentColor" />
      <circle cx="12" cy="12" r="1.3" fill="currentColor" />
      <circle cx="12" cy="19" r="1.3" fill="currentColor" />
    </>,
    'Menü-Symbol',
  )

const Burger = () => sym(<path d="M5 7h14M5 12h14M5 17h14" />, 'Menü-Symbol')

function Step({ title, children }: { title: ReactNode; children?: ReactNode }) {
  return (
    <li className="step">
      <div>
        <b>{title}</b>
        {children && <p>{children}</p>}
      </div>
    </li>
  )
}

const OpenFromHome = ({ where = 'Home-Bildschirm' }: { where?: string }) => (
  <Step title={`Fertig! Ab jetzt über das Icon öffnen`}>
    Auf dem {where} wartet jetzt <b>Elternpost</b> 💛 – diese Browser-Seite kannst du schließen.
  </Step>
)

function Steps({ platform }: { platform: Platform }) {
  switch (platform) {
    case 'ios-safari':
      return (
        <ol className="steps">
          <Step
            title={
              <>
                Auf <Share /> Teilen tippen
              </>
            }
          >
            Das Symbol ist in Safari unten in der Leiste. Siehst du es nicht, tippe zuerst auf <Dots /> und dann auf <b>Teilen</b>.
          </Step>
          <Step
            title={
              <>
                <AddHome /> „Zum Home-Bildschirm“ wählen
              </>
            }
          >
            Steht etwas weiter unten in der Liste – evtl. nach unten wischen oder auf <b>Mehr</b> tippen.
          </Step>
          <Step title="Oben rechts auf „Hinzufügen“ tippen">„Als Web-App öffnen“ bleibt dabei eingeschaltet.</Step>
          <OpenFromHome />
        </ol>
      )
    case 'ios-other':
      return (
        <ol className="steps">
          <Step
            title={
              <>
                Auf <Share /> Teilen tippen
              </>
            }
          >
            In Chrome oben rechts in der Adresszeile, in anderen Browsern im Menü. Klappt es nicht, öffne die Seite in <b>Safari</b>.
          </Step>
          <Step
            title={
              <>
                <AddHome /> „Zum Home-Bildschirm“ wählen
              </>
            }
          >
            Evtl. nach unten wischen oder auf <b>Mehr</b> tippen.
          </Step>
          <Step title="Auf „Hinzufügen“ tippen" />
          <OpenFromHome />
        </ol>
      )
    case 'android-samsung':
      return (
        <ol className="steps">
          <Step
            title={
              <>
                Unten rechts auf <Burger /> tippen
              </>
            }
          />
          <Step title="„Seite hinzufügen zu“ → „Startbildschirm“" />
          <Step title="Auf „Hinzufügen“ tippen" />
          <OpenFromHome where="Startbildschirm" />
        </ol>
      )
    case 'android-firefox':
      return (
        <ol className="steps">
          <Step
            title={
              <>
                Auf <DotsVertical /> tippen
              </>
            }
          >
            Oben oder unten rechts neben der Adresszeile.
          </Step>
          <Step title="„Installieren“ oder „Zum Startbildschirm hinzufügen“" />
          <Step title="Mit „Hinzufügen“ bestätigen" />
          <OpenFromHome where="Startbildschirm" />
        </ol>
      )
    case 'desktop':
      return (
        <ol className="steps">
          <Step title="Chrome oder Edge: Installieren-Symbol in der Adresszeile">
            Rechts in der Adresszeile ist ein kleiner Bildschirm mit Pfeil – oder im Menü <DotsVertical /> → <b>„App installieren“</b>.
          </Step>
          <Step title="Safari auf dem Mac: Ablage → „Zum Dock hinzufügen“" />
          <Step title="Am besten aber aufs Handy">Elternpost ist fürs Handy gemacht – öffne diese Seite dort und folge der Anleitung.</Step>
        </ol>
      )
    default:
      // Chrome & andere Android-Browser
      return (
        <ol className="steps">
          <Step
            title={
              <>
                Oben rechts auf <DotsVertical /> tippen
              </>
            }
          />
          <Step title="„App installieren“ oder „Zum Startbildschirm hinzufügen“" />
          <Step title="Mit „Installieren“ bestätigen" />
          <OpenFromHome where="Startbildschirm" />
        </ol>
      )
  }
}

/**
 * Begrüßt Besucher im Handy-Browser und erklärt, wie man Elternpost als App
 * auf den Home-Bildschirm holt. Erst als App ist sie wirklich praktisch:
 * eigenes Icon, Vollbild, funktioniert offline.
 */
export default function InstallGuide({ onSkip }: { onSkip?: () => void }) {
  const platform = detectPlatform()
  const { canPrompt, installed, install } = useInstallPrompt()
  const [manual, setManual] = useState(false)
  const hasData = useLiveQuery(() => db.children.count().then((n) => n > 0), [], false)
  const icon = `${import.meta.env.BASE_URL}icon-192.png`

  if (isStandalone()) {
    return (
      <div className="install">
        <img className="install-icon" src={icon} alt="" />
        <h1>Schon installiert ✓</h1>
        <p className="lead">Du benutzt Elternpost bereits als App. Alles bestens!</p>
        <a className="btn primary block" href="#/kinder">
          Zur App
        </a>
      </div>
    )
  }

  async function installNow() {
    const ok = await install()
    if (ok) celebrate()
  }

  function skip() {
    skipInstall()
    onSkip?.()
  }

  return (
    <div className="install">
      <img className="install-icon" src={icon} alt="" />
      <h1>Hol dir Elternpost aufs Handy</h1>
      <p className="lead">
        Als App hast du alles mit einem Tipp zur Hand – mit eigenem Icon, im Vollbild und auch ohne Internet. Dauert nur 20 Sekunden.
      </p>

      {platform === 'in-app' ? (
        <InAppBrowser />
      ) : installed ? (
        <div className="card install-card">
          <ol className="steps">
            <OpenFromHome where="Startbildschirm" />
          </ol>
        </div>
      ) : canPrompt && !manual ? (
        <div className="install-card">
          <button className="btn primary block big" onClick={installNow}>
            📲 Jetzt als App installieren
          </button>
          <button className="link-btn install-alt" onClick={() => setManual(true)}>
            Kein Fenster erschienen? So geht’s von Hand
          </button>
        </div>
      ) : (
        <div className="card install-card">
          <h2>So geht’s:</h2>
          <Steps platform={platform} />
        </div>
      )}

      {isIOS() && platform !== 'in-app' && (
        <div className="notice info">
          <span>💡</span>
          <span className="grow">
            {hasData ? (
              <>
                Du hast hier im Browser schon Daten eingegeben? Die App auf dem Home-Bildschirm hat ihren <b>eigenen Speicher</b>. Sichere sie
                vorher unter <b>Einstellungen → Sicherung</b> und stelle sie in der App wieder her.
              </>
            ) : (
              <>
                Bitte erst in der App loslegen – was du hier im Browser eingibst, ist dort <b>nicht</b> zu sehen.
              </>
            )}
          </span>
          {hasData && (
            <a
              className="btn small"
              href="#/einstellungen"
              onClick={() => {
                skipInstall()
                onSkip?.()
              }}
            >
              Sichern
            </a>
          )}
        </div>
      )}

      {onSkip && (
        <button className="link-btn install-skip" onClick={skip}>
          Erst mal im Browser ansehen
        </button>
      )}
    </div>
  )
}

function InAppBrowser() {
  async function copy() {
    await copyText(location.href.split('#')[0])
    toast('Link kopiert 📋')
  }
  return (
    <div className="card install-card">
      <h2>Erst im richtigen Browser öffnen</h2>
      <p>Du bist gerade im Browser einer anderen App (z. B. WhatsApp oder Instagram). Von hier aus lässt sich Elternpost nicht installieren.</p>
      <ol className="steps">
        <Step
          title={
            <>
              Auf <Dots /> oder <DotsVertical /> tippen
            </>
          }
        >
          Meist oben oder unten rechts.
        </Step>
        <Step title={isIOS() ? '„In Safari öffnen“ wählen' : '„Im Browser öffnen“ wählen'}>
          Danach erscheint diese Anleitung dort noch einmal.
        </Step>
      </ol>
      <button className="btn block install-copy" onClick={copy}>
        Oder Link kopieren und im Browser einfügen
      </button>
    </div>
  )
}
