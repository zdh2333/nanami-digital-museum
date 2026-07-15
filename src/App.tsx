export function App() {
  return (
    <main className="min-h-screen overflow-hidden bg-obsidian text-bone">
      <section
        className="relative isolate flex min-h-screen items-end px-6 py-12 sm:px-10 sm:py-16 lg:px-16"
        aria-labelledby="museum-title"
      >
        <div className="ambient-glow" aria-hidden="true" />

        <div className="relative z-10 max-w-5xl">
          <p className="museum-label mb-6 text-ink">Nanami Cat · Living Archive</p>
          <h1
            id="museum-title"
            className="text-balance text-[clamp(3.5rem,11vw,9rem)] font-medium uppercase leading-[0.82] tracking-[-0.075em]"
          >
            One black cat.
            <span className="block text-bone-muted">Many moods.</span>
          </h1>
        </div>
      </section>
    </main>
  )
}
