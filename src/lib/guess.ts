import { isOpen, type Child } from './db'

/** Wortteile vor dem @, ohne Ziffern: "max.forster84@…" → ["max", "forster"] */
export function tokens(email: string): string[] {
  return email
    .split('@')[0]
    .toLowerCase()
    .split(/[._\-+]+/)
    .map((t) => t.replace(/\d+/g, ''))
    .filter((t) => t.length >= 2)
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

/** "julia.cirocco@web.de" → "Julia Cirocco". Nur wenn es klar nach Vor- und Nachname aussieht. */
export function guessPerson(email: string): string | undefined {
  const parts = tokens(email)
  if (parts.length !== 2 || parts[0].length < 3 || parts[1].length < 4) return undefined
  return parts.map(cap).join(' ')
}

const words = (child: Child) => {
  const text = [child.name, ...child.contacts.map((c) => c.person ?? '')].join(' ').toLowerCase()
  const fromEmails = child.contacts.filter((c) => c.kind === 'email').flatMap((c) => tokens(c.value))
  return { text, fromEmails, local: child.contacts.map((c) => c.value.split('@')[0].toLowerCase()) }
}

/** Längere Wortteile (eher Nachnamen), z. B. "forster" oder "templin". */
const strong = (child: Child) => words(child).fromEmails.filter((t) => t.length >= 5)

/**
 * Einträge, die vermutlich zur selben Familie gehören:
 * gleicher Wortteil in Adresse, Kind- oder Elternname (z. B. ol.templin ↔ templinjozek).
 */
export function related(child: Child, all: Child[], filter: (c: Child) => boolean = () => true): Child[] {
  const mine = strong(child)
  const myWords = words(child)
  return all
    .filter((other) => other.id !== child.id && filter(other))
    .map((other) => {
      const theirs = words(other)
      const theirStrong = strong(other)
      const hit =
        mine.some((t) => theirs.text.includes(t) || theirs.local.some((l) => l.includes(t))) ||
        theirStrong.some((t) => myWords.text.includes(t) || myWords.local.some((l) => l.includes(t)))
      return hit ? other : null
    })
    .filter((c): c is Child => !!c)
}

export const relatedNamed = (child: Child, all: Child[]) => related(child, all, (c) => !isOpen(c))
export const relatedOpen = (child: Child, all: Child[]) => related(child, all, (c) => isOpen(c) && c.active)
