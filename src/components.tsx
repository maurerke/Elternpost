import { useEffect, useState, type ReactNode } from 'react'

export function TopBar({ title, left, right, small }: { title: string; left?: ReactNode; right?: ReactNode; small?: boolean }) {
  if (!small) {
    return (
      <header className="topbar">
        <h1>{title}</h1>
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

/* ---------- Kurze Hinweise unten am Bildschirm ---------- */

export const toast = (message: string) => window.dispatchEvent(new CustomEvent('toast', { detail: message }))

export function Toast() {
  const [message, setMessage] = useState<string | null>(null)
  useEffect(() => {
    let timer: number | undefined
    const onToast = (e: Event) => {
      setMessage((e as CustomEvent<string>).detail)
      clearTimeout(timer)
      timer = window.setTimeout(() => setMessage(null), 2600)
    }
    window.addEventListener('toast', onToast)
    return () => window.removeEventListener('toast', onToast)
  }, [])
  return message ? (
    <div className="toast" role="status">
      {message}
    </div>
  ) : null
}

/* ---------- Icons ---------- */

const svg = (path: ReactNode) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
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

export function BackButton({ to, label = 'Zurück' }: { to: string; label?: string }) {
  return (
    <a className="link-btn" href={`#${to}`} style={{ textDecoration: 'none' }}>
      ‹ {label}
    </a>
  )
}
