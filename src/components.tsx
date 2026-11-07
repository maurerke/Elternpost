import { useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

export function TopBar({
  title,
  left,
  right,
  small,
  icon,
  kicker,
}: {
  title: string
  left?: ReactNode
  right?: ReactNode
  small?: boolean
  icon?: ReactNode
  kicker?: ReactNode
}) {
  if (!small) {
    return (
      <header className="topbar">
        {icon && <div className="title-icon">{icon}</div>}
        <div className="heading">
          {kicker && <div className="kicker">{kicker}</div>}
          <h1>{title}</h1>
        </div>
        {right}
      </header>
    )
  }
  return (
    <header className="topbar">
      <div className="side">{left}</div>
      <h1 className="small">{title}</h1>
      <div className="side">{right}</div>
    </header>
  )
}

/** Freundliche Begrüßung je nach Tageszeit. */
export function greeting(date = new Date()) {
  const h = date.getHours()
  if (h < 5) return 'Noch wach? 🌙'
  if (h < 11) return 'Guten Morgen ☀️'
  if (h < 14) return 'Hallo 👋'
  if (h < 18) return 'Schönen Nachmittag 🌼'
  return 'Guten Abend 🌙'
}

/** Feste Farbe (c0–c7) für einen Namen – jedes Kind, jede Gruppe behält ihre Farbe. */
export function colorOf(text = '') {
  let hash = 0
  for (const ch of text.trim().toLowerCase()) hash = (hash * 31 + ch.charCodeAt(0)) | 0
  return `c${Math.abs(hash) % 8}`
}

/* ---------- Kurze Hinweise unten am Bildschirm ---------- */

export const toast = (message: string) => window.dispatchEvent(new CustomEvent('toast', { detail: message }))

export function Toast() {
  const [message, setMessage] = useState<{ text: string; key: number } | null>(null)
  useEffect(() => {
    let timer: number | undefined
    const onToast = (e: Event) => {
      setMessage({ text: (e as CustomEvent<string>).detail, key: Date.now() })
      clearTimeout(timer)
      timer = window.setTimeout(() => setMessage(null), 2600)
    }
    window.addEventListener('toast', onToast)
    return () => window.removeEventListener('toast', onToast)
  }, [])
  return message ? (
    <div className="toast" role="status" key={message.key}>
      {message.text}
    </div>
  ) : null
}

/* ---------- Konfetti für die schönen Momente ---------- */

export const celebrate = () => window.dispatchEvent(new CustomEvent('celebrate'))

const CONFETTI_COLORS = ['#ff6b5b', '#ffc93c', '#2ec4a6', '#5457e8', '#ff85bf', '#8650e6', '#4cc9f0', '#ff9f1c']

export function Confetti() {
  const canvas = useRef<HTMLCanvasElement>(null)
  const [active, setActive] = useState(0)

  useEffect(() => {
    const onCelebrate = () => {
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
      setActive(Date.now())
    }
    window.addEventListener('celebrate', onCelebrate)
    return () => window.removeEventListener('celebrate', onCelebrate)
  }, [])

  useEffect(() => {
    const el = canvas.current
    if (!active || !el) return
    const ctx = el.getContext('2d')
    if (!ctx) return
    const dpr = window.devicePixelRatio || 1
    const w = window.innerWidth
    const h = window.innerHeight
    el.width = w * dpr
    el.height = h * dpr
    ctx.scale(dpr, dpr)

    const pieces = Array.from({ length: 140 }, (_, i) => {
      const fromLeft = i % 2 === 0
      return {
        x: fromLeft ? -10 : w + 10,
        y: h * (0.55 + Math.random() * 0.25),
        vx: (fromLeft ? 1 : -1) * (4 + Math.random() * 7),
        vy: -(9 + Math.random() * 9),
        size: 6 + Math.random() * 7,
        rot: Math.random() * Math.PI,
        vr: (Math.random() - 0.5) * 0.3,
        color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
        round: Math.random() < 0.3,
      }
    })

    let frame = 0
    let raf = 0
    const tick = () => {
      frame++
      ctx.clearRect(0, 0, w, h)
      for (const p of pieces) {
        p.vy += 0.32
        p.vx *= 0.985
        p.x += p.vx
        p.y += p.vy
        p.rot += p.vr
        ctx.save()
        ctx.translate(p.x, p.y)
        ctx.rotate(p.rot)
        ctx.fillStyle = p.color
        ctx.globalAlpha = Math.max(0, 1 - frame / 150)
        if (p.round) {
          ctx.beginPath()
          ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2)
          ctx.fill()
        } else ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2)
        ctx.restore()
      }
      if (frame < 150) raf = requestAnimationFrame(tick)
      else setActive(0)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [active])

  return active ? <canvas ref={canvas} className="confetti" aria-hidden="true" style={{ width: '100%', height: '100%' }} /> : null
}

/* ---------- Icons ---------- */

const svg = (path: ReactNode) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {path}
  </svg>
)

export const IconPeople = () =>
  svg(
    <>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3 19c.6-3.3 3-5 6-5s5.4 1.7 6 5" />
      <circle cx="17" cy="9" r="2.5" />
      <path d="M16 14.2c2.6-.2 4.4 1.3 5 4.3" />
    </>,
  )

export const IconMail = () =>
  svg(
    <>
      <rect x="3" y="5.5" width="18" height="13" rx="2.5" />
      <path d="M4 7.5l8 6 8-6" />
    </>,
  )

export const IconSettings = () =>
  svg(
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
    </>,
  )

export const IconImport = () =>
  svg(
    <>
      <path d="M12 4v11" />
      <path d="M7.5 10.5L12 15l4.5-4.5" />
      <path d="M4.5 15.5v2A2.5 2.5 0 0 0 7 20h10a2.5 2.5 0 0 0 2.5-2.5v-2" />
    </>,
  )

export const IconPlus = () => svg(<path d="M12 5v14M5 12h14" />)

const IconBack = () => svg(<path d="M15 5l-7 7 7 7" />)

export function BackButton({ to, label = 'Zurück' }: { to: string; label?: string }) {
  return (
    <a className="link-btn back" href={`#${to}`}>
      <IconBack /> {label}
    </a>
  )
}

/* ---------- Schwebende Aktionsleiste (Speichern immer griffbereit) ---------- */

/**
 * Hält die wichtigsten Knöpfe einer Bearbeiten-Seite unten am Bildschirm fest –
 * dort, wo der Daumen ist. Auf Bearbeiten-Seiten ersetzt sie die Tab-Leiste,
 * mit `overTabbar` schwebt sie darüber. Ist die Bildschirmtastatur offen,
 * rutscht sie mit nach oben.
 */
export function ActionBar({ children, overTabbar }: { children: ReactNode; overTabbar?: boolean }) {
  const [keyboard, setKeyboard] = useState(0)

  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return
    const update = () => {
      const covered = window.innerHeight - vv.height - vv.offsetTop
      setKeyboard(covered > 80 ? covered : 0)
    }
    update()
    vv.addEventListener('resize', update)
    vv.addEventListener('scroll', update)
    return () => {
      vv.removeEventListener('resize', update)
      vv.removeEventListener('scroll', update)
    }
  }, [])

  return createPortal(
    <div
      className={`action-bar ${overTabbar ? 'over-tabbar' : ''} ${keyboard ? 'keyboard' : ''}`}
      style={keyboard ? { bottom: keyboard + 8 } : undefined}
    >
      {children}
    </div>,
    document.body,
  )
}

/* ---------- Auswahlfenster von unten ---------- */

export function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [onClose])
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" role="dialog" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <header>
          <h2>{title}</h2>
          <button className="link-btn" onClick={onClose}>
            Abbrechen
          </button>
        </header>
        <div className="sheet-body">{children}</div>
      </div>
    </div>
  )
}

/* ---------- Fortschritt ---------- */

export function Progress({ value, max }: { value: number; max: number }) {
  return (
    <div className="progress" role="progressbar" aria-valuenow={value} aria-valuemax={max}>
      <div style={{ width: `${max ? (value / max) * 100 : 0}%` }} />
    </div>
  )
}

/** Fortschritt mit Text und Prozent – kleine Etappenziele motivieren. */
export function ProgressBox({ value, max, label }: { value: number; max: number; label?: ReactNode }) {
  const pct = max ? Math.round((value / max) * 100) : 0
  const left = max - value
  const cheer =
    left === 0 ? 'Alles geschafft! 🎉' : pct >= 75 ? `Fast fertig – nur noch ${left}! 💪` : pct >= 40 ? 'Läuft super! 🚀' : 'Los geht’s! ✨'
  return (
    <div className="progress-box">
      <div className="progress-label">
        <span>{label ?? cheer}</span>
        <span className="pct">{pct} %</span>
      </div>
      <Progress value={value} max={max} />
    </div>
  )
}

/** Gemischte Glückwünsche – Abwechslung macht Erfolge spürbarer. */
const CHEERS = ['Super!', 'Klasse!', 'Prima!', 'Spitze!', 'Toll!', 'Juhu!']
export const cheer = () => CHEERS[Math.floor(Math.random() * CHEERS.length)]
