import { useEffect, useState } from 'react'
import { isIOS, isStandalone } from './util'

/* ---------- Als App installieren ----------
   Chrome/Edge/Samsung auf Android bieten ein eigenes Installationsfenster an
   („beforeinstallprompt“). Das Ereignis kommt oft schon vor dem ersten Rendern,
   darum horchen wir sofort beim Laden dieses Moduls darauf. iPhone/iPad kennen
   das nicht – dort geht es nur von Hand über „Zum Home-Bildschirm“. */

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

let deferred: InstallPromptEvent | null = null
let installed = false
const listeners = new Set<() => void>()
const notify = () => listeners.forEach((l) => l())

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault() // eigenes, freundlicheres Fenster statt der Mini-Leiste
  deferred = e as InstallPromptEvent
  notify()
})

window.addEventListener('appinstalled', () => {
  installed = true
  deferred = null
  notify()
})

/** Liefert, ob der Browser ein eigenes Installationsfenster anbietet, und ob gerade installiert wurde. */
export function useInstallPrompt() {
  const [, rerender] = useState(0)
  useEffect(() => {
    const l = () => rerender((n) => n + 1)
    listeners.add(l)
    return () => {
      listeners.delete(l)
    }
  }, [])

  async function install() {
    if (!deferred) return false
    const event = deferred
    await event.prompt()
    const { outcome } = await event.userChoice
    deferred = null
    notify()
    return outcome === 'accepted'
  }

  return { canPrompt: !!deferred, installed, install }
}

/* ---------- Welcher Browser? ---------- */

export type Platform =
  | 'ios-safari'
  | 'ios-other' // Chrome, Firefox, Edge … auf dem iPhone
  | 'android-chrome'
  | 'android-samsung'
  | 'android-firefox'
  | 'android-other'
  | 'in-app' // Browser in WhatsApp, Instagram, Facebook … – dort geht das Installieren nicht
  | 'desktop'

export function detectPlatform(): Platform {
  const ua = navigator.userAgent
  if (/FBAN|FBAV|FB_IAB|Instagram|Line\/|Snapchat|WhatsApp|GSA\/|; wv\)/.test(ua)) return 'in-app'
  if (isIOS()) return /CriOS|FxiOS|EdgiOS|OPiOS/.test(ua) ? 'ios-other' : 'ios-safari'
  if (/Android/.test(ua)) {
    if (/SamsungBrowser/.test(ua)) return 'android-samsung'
    if (/Firefox/.test(ua)) return 'android-firefox'
    if (/Chrome/.test(ua) && !/OPR|EdgA/.test(ua)) return 'android-chrome'
    return 'android-other'
  }
  return 'desktop'
}

export const isMobile = () => detectPlatform() !== 'desktop'

/* ---------- „Erst mal im Browser ansehen“ ----------
   Gilt nur für diesen Besuch – beim nächsten Öffnen im Browser erklären wir es wieder. */

const SKIP_KEY = 'elternpost.installSkipped'

export function installSkipped() {
  try {
    return sessionStorage.getItem(SKIP_KEY) === '1'
  } catch {
    return false
  }
}

export function skipInstall() {
  try {
    sessionStorage.setItem(SKIP_KEY, '1')
  } catch {
    /* privater Modus – dann eben nicht merken */
  }
}

/** Soll die Installationsanleitung statt der App erscheinen? */
export const shouldShowInstallGuide = () => !isStandalone() && isMobile() && !installSkipped()
