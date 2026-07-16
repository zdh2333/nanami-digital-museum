const navigationItems = [
  { label: 'About', href: '#presence' },
  { label: 'Field notes', href: '#field-notes' },
  { label: 'Photos', href: '#mood-archive' },
  { label: 'Memes', href: '#mood-archive' },
]

const linkClassName =
  'inline-flex min-h-11 items-center px-4 font-mono text-sm text-bone-muted transition-colors hover:text-bone focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ink'

export function Navigation() {
  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-white/10 bg-obsidian">
      <nav
        aria-label="Museum navigation"
        className="mx-auto flex min-h-20 max-w-[104.5rem] items-center gap-3 px-4 sm:px-11"
      >
        <a
          href="#hero"
          aria-label="Nanami home"
          className={`${linkClassName} mr-auto px-0 text-xl text-bone`}
        >
          Nanami
        </a>

        <div className="hidden items-center md:flex">
          {navigationItems.map((item) => (
            <a key={item.label} href={item.href} className={linkClassName}>
              {item.label}
            </a>
          ))}
        </div>

        <a
          href="#mood-archive"
          className={linkClassName}
        >
          Explore
        </a>
      </nav>
    </header>
  )
}
