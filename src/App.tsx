import { Closing } from './components/Closing'
import { FieldNotes } from './components/FieldNotes'
import { Hero3D } from './components/Hero3D'
import { LivingArchive } from './components/LivingArchive'
import { MoodArchive } from './components/MoodArchive'
import { Navigation } from './components/Navigation'
import { Presence } from './components/Presence'
import { useReducedExperience } from './hooks/useReducedExperience'

export function App() {
  const staticExperience = useReducedExperience()

  return (
    <main className="min-h-screen overflow-x-clip bg-obsidian text-bone">
      <Navigation />
      <section
        id="hero"
        className="hero-section"
        aria-labelledby="museum-title"
      >
        <div className="ambient-glow" aria-hidden="true" />
        <div className="hero-visual">
          <Hero3D staticExperience={staticExperience} />
        </div>
        <div className="hero-vignette" aria-hidden="true" />

        <div className="hero-copy">
          <p className="museum-label mb-6 text-ink">Nanami Cat · Living Archive</p>
          <h1
            id="museum-title"
            className="text-balance text-[clamp(3.5rem,11vw,9rem)] font-medium uppercase leading-[0.82] tracking-[-0.075em]"
          >
            ONE BLACK CAT.{' '}
            <span className="block text-bone-muted">MANY MOODS.</span>
          </h1>
        </div>
      </section>
      <Presence staticExperience={staticExperience} />
      <FieldNotes staticExperience={staticExperience} />
      <MoodArchive staticExperience={staticExperience} />
      <LivingArchive staticExperience={staticExperience} />
      <Closing staticExperience={staticExperience} />
    </main>
  )
}
