const navigationItems = [
  { label: 'Presence', href: '#presence' },
  { label: 'Field notes', href: '#field-notes' },
  { label: 'Living archive', href: '#living-archive' },
]

const linkClassName =
  'inline-flex min-h-11 items-center rounded-sm px-3 text-[0.6875rem] uppercase tracking-[0.14em] text-bone-muted transition-colors hover:text-bone focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ink'

export function Navigation() {
  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-white/10 bg-obsidian/80 backdrop-blur-md">
      <nav
        aria-label="Museum navigation"
        className="mx-auto flex min-h-16 max-w-[100rem] items-center gap-3 px-4 sm:px-8"
      >
        <a
          href="#top"
          aria-label="Nanami Cat home"
          className={`${linkClassName} mr-auto px-2 font-medium text-bone`}
        >
          Nanami Cat
        </a>

        <div className="hidden items-center md:flex">
          {navigationItems.map((item) => (
            <a key={item.href} href={item.href} className={linkClassName}>
              {item.label}
            </a>
          ))}
        </div>

        <a
          href="#mood-archive"
          className="inline-flex min-h-11 items-center rounded-full border border-ink/60 px-4 text-[0.6875rem] uppercase tracking-[0.14em] text-bone transition-colors hover:border-ink hover:bg-ink/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ink"
        >
          Mood archive
        </a>
      </nav>
    </header>
  )
}
