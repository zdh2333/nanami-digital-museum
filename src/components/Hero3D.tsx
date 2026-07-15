import { lazy, Suspense } from 'react'

const NANAMI_DESCRIPTION =
  'Nanami, a black cat with yellow-green eyes and a kinked tail tip'

const NanamiExperience = lazy(() =>
  import('./NanamiModel').then((module) => ({
    default: module.NanamiExperience,
  })),
)

type Hero3DProps = {
  staticExperience: boolean
}

export function Hero3D({ staticExperience }: Hero3DProps) {
  const poster = (
    <img
      src="/posters/nanami-hero.webp"
      alt={staticExperience ? NANAMI_DESCRIPTION : ''}
      width="1080"
      height="1440"
      className="h-full w-full object-cover object-center"
    />
  )

  if (staticExperience) return poster

  return <Suspense fallback={poster}><NanamiExperience /></Suspense>
}
