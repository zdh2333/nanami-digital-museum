import { Closing } from './components/Closing'
import { FieldNotes } from './components/FieldNotes'
import { Guestbook } from './components/Guestbook'
import { HeroPortrait } from './components/HeroPortrait'
import { LivingArchive } from './components/LivingArchive'
import { MoodArchive } from './components/MoodArchive'
import { Navigation } from './components/Navigation'
import { Profile } from './components/Profile'
import { SeoMetadata } from './components/SeoMetadata'
import { useReducedExperience } from './hooks/useReducedExperience'
import { useLocale } from './i18n/LocaleProvider'

export function App() {
  const staticExperience = useReducedExperience()
  const { copy } = useLocale()
  const [heroLead, heroFollow] = copy.hero.title.split('\n')
  return (
    <>
      <SeoMetadata />
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
          <div className="hero-mobile-copy">
            <h1 id="museum-title">{heroLead}<br />{' '}{heroFollow}</h1>
            <p className="hero-mobile-copy__index">
              <span>{copy.hero.archiveIndex}</span> NNM_000001
              <span className="hero-mobile-copy__disclosure">{copy.hero.disclosure}</span>
            </p>
          </div>
        </section>
        <Profile staticExperience={staticExperience} />
        <FieldNotes staticExperience={staticExperience} />
        <MoodArchive staticExperience={staticExperience} />
        <LivingArchive staticExperience={staticExperience} />
        <Guestbook staticExperience={staticExperience} />
        <Closing staticExperience={staticExperience} />
      </main>
    </>
  )
}
