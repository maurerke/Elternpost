import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, defaultSettings, type Child, type Settings } from './db'

/* ---------- Routing über den URL-Hash (#/kinder, #/kind/3, …) ---------- */

export function useRoute(): string[] {
  const [hash, setHash] = useState(location.hash)
  useEffect(() => {
    const onChange = () => {
      setHash(location.hash)
      window.scrollTo(0, 0)
    }
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])
  return hash.replace(/^#\/?/, '').split('/').filter(Boolean)
}

export const go = (path: string) => {
  location.hash = path
}

/* ---------- Einstellungen ---------- */

export function useSettings(): Settings {
  const stored = useLiveQuery(() => db.settings.get('main'))
  return { ...defaultSettings, ...stored }
}

/* ---------- Datum ---------- */

export const formatDate = (iso?: string) =>
  iso ? new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' }) : ''

export const formatDateLong = (iso?: string) =>
  iso ? new Date(iso).toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : ''

export const today = () => new Date().toISOString().slice(0, 10)

export const daysSince = (iso?: string) =>
  iso ? Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000) : Infinity

/* ---------- Empfänger ---------- */

export const isValidEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())

/** Alle eindeutigen E-Mail-Adressen aktiver Kinder, optional nur aus bestimmten Gruppen. */
export function recipientEmails(children: Child[], groups: string[] = []): string[] {
  const seen = new Map<string, string>()
  for (const child of children) {
    if (!child.active) continue
    if (groups.length && !groups.includes(child.group ?? '')) continue
    for (const contact of child.contacts) {
      if (contact.kind !== 'email' || !isValidEmail(contact.value)) continue
      const email = contact.value.trim()
      seen.set(email.toLowerCase(), email)
    }
  }
  return [...seen.values()]
}

export const groupsOf = (children: Child[]) =>
  [...new Set(children.map((c) => c.group?.trim()).filter((g): g is string => !!g))].sort((a, b) =>
    a.localeCompare(b, 'de'),
  )

/* ---------- Zwischenablage ---------- */

export async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text)
  } catch {
    fallbackCopy(text, false)
  }
}

/** Kopiert formatierten Text, damit er in der Mail-App mit Formatierung eingefügt werden kann. */
export async function copyRich(html: string, text: string) {
  try {
    await navigator.clipboard.write([
      new ClipboardItem({
        'text/html': new Blob([html], { type: 'text/html' }),
        'text/plain': new Blob([text], { type: 'text/plain' }),
      }),
    ])
  } catch {
    fallbackCopy(html, true)
  }
}

function fallbackCopy(content: string, isHtml: boolean) {
  const el = document.createElement('div')
  el.contentEditable = 'true'
  el.style.position = 'fixed'
  el.style.left = '-9999px'
  if (isHtml) el.innerHTML = content
  else el.textContent = content
  document.body.appendChild(el)
  const range = document.createRange()
  range.selectNodeContents(el)
  const selection = window.getSelection()
  selection?.removeAllRanges()
  selection?.addRange(range)
  document.execCommand('copy')
  selection?.removeAllRanges()
  el.remove()
}

/* ---------- Dateien ---------- */

/** Auf dem iPhone über das Teilen-Menü („In Dateien sichern“ → iCloud Drive), sonst als Download. */
export async function saveFile(filename: string, content: string, type: string) {
  const file = new File([content], filename, { type })
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: filename })
      return true
    } catch (e) {
      if ((e as Error).name === 'AbortError') return false
    }
  }
  const url = URL.createObjectURL(file)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
  return true
}

export const isStandalone = () =>
  window.matchMedia('(display-mode: standalone)').matches ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true

export const isIOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
