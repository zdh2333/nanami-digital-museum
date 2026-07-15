import type { ArchiveItemInput } from './types'
import { validateArchive } from './validate'

const archiveSeed: readonly ArchiveItemInput[] = [
  {
    id: 'nanami-photo-001', type: 'photo', src: '/archive/photos/nanami-photo-001-1600.webp',
    caption: 'A sun-warmed pause.', alt: 'Nanami, a black cat, resting on a green chair with one eye partly open.',
    faceChecked: true, featured: true, order: 1,
  },
  {
    id: 'nanami-photo-002', type: 'photo', src: '/archive/photos/nanami-photo-002-1600.webp',
    caption: 'Edge-of-the-bed supervision.', alt: 'Nanami standing at the edge of a bed and looking directly at the camera.',
    faceChecked: true, featured: true, order: 2,
  },
  {
    id: 'nanami-photo-003', type: 'photo', src: '/archive/photos/nanami-photo-003-1600.webp',
    caption: 'Yellow-green eyes, fully online.', alt: 'Close portrait of Nanami lying against soft grey bedding.',
    faceChecked: true, featured: true, order: 3,
  },
  {
    id: 'nanami-photo-004', type: 'photo', src: '/archive/photos/nanami-photo-004-1600.webp',
    caption: 'One eye open. Almost.', alt: 'Nanami dozing sideways in a green chair with one eye slightly open.',
    faceChecked: true, featured: false, order: 4,
  },
  {
    id: 'nanami-photo-005', type: 'photo', src: '/archive/photos/nanami-photo-005-1600.webp',
    caption: 'Chair claimed.', alt: 'Nanami sleeping lengthwise in a green upholstered chair.',
    faceChecked: true, featured: false, order: 5,
  },
  {
    id: 'nanami-photo-006', type: 'photo', src: '/archive/photos/nanami-photo-006-1600.webp',
    caption: 'The look that stops a room.', alt: 'Close portrait of Nanami resting on a dark cushion with alert yellow-green eyes.',
    faceChecked: true, featured: true, order: 6,
  },
  {
    id: 'nanami-photo-007', type: 'photo', src: '/archive/photos/nanami-photo-007-1600.webp',
    caption: 'A quiet watch from above.', alt: 'Nanami resting with her head visible above a cushion in a raised bed nook.',
    faceChecked: true, featured: false, order: 7,
  },
  {
    id: 'nanami-photo-008', type: 'photo', src: '/archive/photos/nanami-photo-008-1600.webp',
    caption: 'Upstairs, still in charge.', alt: 'Nanami lying sideways in a raised bed nook.',
    faceChecked: true, featured: false, order: 8,
  },
  {
    id: 'nanami-photo-009', type: 'photo', src: '/archive/photos/nanami-photo-009-1600.webp',
    caption: 'A sideways assessment.', alt: 'Nanami lying sideways near a window and watching the camera.',
    faceChecked: true, featured: true, order: 9,
  },
  {
    id: 'nanami-photo-012', type: 'photo', src: '/archive/photos/nanami-photo-012-1600.webp',
    caption: 'A very important announcement.', alt: 'Nanami stretched across a striped bed while meowing.',
    faceChecked: true, featured: true, order: 12,
  },
  {
    id: 'nanami-photo-014', type: 'photo', src: '/archive/photos/nanami-photo-014-1600.webp',
    caption: 'Approaching the camera.', alt: 'Nanami standing on a bed and looking straight ahead.',
    faceChecked: true, featured: false, order: 14,
  },
  {
    id: 'nanami-photo-015', type: 'photo', src: '/archive/photos/nanami-photo-015-1600.webp',
    caption: 'Loaf mode, uninterrupted.', alt: 'Nanami sitting in a compact loaf pose on grey bedding.',
    faceChecked: true, featured: true, order: 15,
  },
  {
    id: 'nanami-photo-016', type: 'photo', src: '/archive/photos/nanami-photo-016-1600.webp',
    caption: 'Maximum stretch.', alt: 'Nanami stretched across a striped bed.',
    faceChecked: true, featured: false, order: 16,
  },
  {
    id: 'nanami-meme-001', type: 'meme', src: '/archive/memes/nanami-meme-001-1600.webp',
    caption: 'Nothing escapes review.', alt: 'Nanami staring intently above the words I saw that.',
    faceChecked: true, featured: true, order: 17,
  },
  {
    id: 'nanami-meme-002', type: 'meme', src: '/archive/memes/nanami-meme-002-1600.webp',
    caption: 'Closed-door policy.', alt: 'Nanami resting in a nook above the words Closed door? Unacceptable.',
    faceChecked: true, featured: false, order: 18,
  },
  {
    id: 'nanami-meme-004', type: 'meme', src: '/archive/memes/nanami-meme-004-1600.webp',
    caption: 'That concludes the agenda.', alt: 'Nanami meowing on a bed above the words Meeting adjourned.',
    faceChecked: true, featured: true, order: 20,
  },
  {
    id: 'nanami-meme-005', type: 'meme', src: '/archive/memes/nanami-meme-005-1600.webp',
    caption: 'Seating arrangements updated.', alt: 'Nanami in a loaf pose above the words Your seat? Interesting.',
    faceChecked: true, featured: false, order: 21,
  },
  {
    id: 'nanami-meme-007', type: 'meme', src: '/archive/memes/nanami-meme-007-1600.webp',
    caption: 'Management has arrived.', alt: 'Nanami standing at the bed edge above the words House manager on duty.',
    faceChecked: true, featured: true, order: 23,
  },
  {
    id: 'nanami-meme-008', type: 'meme', src: '/archive/memes/nanami-meme-008-1600.webp',
    caption: 'Office hours postponed.', alt: 'Nanami sleeping in a chair above the words Busy. Try later.',
    faceChecked: true, featured: false, order: 24,
  },
]

export const archiveItems = validateArchive(archiveSeed)
