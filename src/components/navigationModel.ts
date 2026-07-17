import type { MuseumCopy } from '../i18n/copy'

export type NavigationKey = keyof Pick<MuseumCopy['nav'], 'home' | 'profile' | 'notes' | 'archive' | 'timeline' | 'guestbook'>

export const navigationItems: ReadonlyArray<{ key: NavigationKey; href: string }> = [
  { key: 'home', href: '#hero' },
  { key: 'profile', href: '#presence' },
  { key: 'notes', href: '#field-notes' },
  { key: 'archive', href: '#mood-archive' },
  { key: 'timeline', href: '#living-archive' },
  { key: 'guestbook', href: '#guestbook' },
]
