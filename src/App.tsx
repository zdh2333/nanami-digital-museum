import { Hero3D } from './components/Hero3D'
import { useReducedExperience } from './hooks/useReducedExperience'

export function App() {
  const staticExperience = useReducedExperience()

  return (
    <main className="min-h-screen overflow-hidden bg-obsidian text-bone">
      <section
        id="top"
        className="relative isolate flex min-h-screen items-end overflow-hidden px-6 py-12 sm:px-10 sm:py-16 lg:px-16"
        aria-labelledby="museum-title"
      >
        <div className="ambient-glow" aria-hidden="true" />
        <div className="hero-visual">
          <Hero3D staticExperience={staticExperience} />
        </div>
        <div className="hero-vignette" aria-hidden="true" />

        <div className="relative z-10 max-w-5xl pointer-events-none">
          <p className="museum-label mb-6 text-ink">Nanami Cat · Living Archive</p>
          <h1
            id="museum-title"
            className="text-balance text-[clamp(3.5rem,11vw,9rem)] font-medium uppercase leading-[0.82] tracking-[-0.075em]"
          >
            ONE BLACK CAT.
            <span className="block text-bone-muted">MANY MOODS.</span>
          </h1>
        </div>
      </section>
    </main>
  )
}
