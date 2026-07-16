import { Closing } from './components/Closing'
import { FieldNotes } from './components/FieldNotes'
import { HeroPortrait } from './components/HeroPortrait'
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
        data-museum-section="hero"
        className="anchor-target hero-section"
        aria-labelledby="museum-title"
      >
        <div className="hero-visual">
          <HeroPortrait />
        </div>
        <h1 id="museum-title" className="sr-only">
          ONE BLACK CAT. MANY MOODS.
        </h1>
      </section>
      <Presence staticExperience={staticExperience} />
      <FieldNotes staticExperience={staticExperience} />
      <MoodArchive staticExperience={staticExperience} />
      <LivingArchive staticExperience={staticExperience} />
      <Closing staticExperience={staticExperience} />
    </main>
  )
}
