import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

const html = readFileSync(join(process.cwd(), 'index.html'), 'utf8')

function occurrences(fragment: string) {
  return html.split(fragment).length - 1
}

describe('static sharing metadata', () => {
  it('contains one exact English fallback and canonical sharing tag set', () => {
    expect(occurrences('<title>Nanami Cat — A Living Archive</title>')).toBe(1)
    expect(occurrences('name="description"')).toBe(1)
    const description = 'The living digital archive of Nanami, a black cat born in Utsunomiya, Tochigi.'
    expect(html).toContain(`name="description"\n      content="${description}"`)
    expect(html).toContain(`<meta property="og:description" content="${description}" />`)
    expect(html).toContain(`<meta name="twitter:description" content="${description}" />`)
    expect(occurrences('rel="canonical"')).toBe(1)
    expect(html).toContain('<link rel="canonical" href="https://nanamicat.com/" />')
    expect(html).toContain('<link rel="icon" type="image/png" href="/favicon.png" />')

    const exactTags = [
      '<meta property="og:type" content="website" />',
      '<meta property="og:url" content="https://nanamicat.com/" />',
      '<meta property="og:locale" content="en_US" />',
      '<meta property="og:image" content="https://nanamicat.com/social/nanami-social-card.webp" />',
      '<meta name="twitter:card" content="summary_large_image" />',
      '<meta name="twitter:image" content="https://nanamicat.com/social/nanami-social-card.webp" />',
    ]
    for (const tag of exactTags) expect(occurrences(tag)).toBe(1)
  })

  it('contains no external scripts or untruthful memorial/female language', () => {
    expect(html).not.toMatch(/<script[^>]+src=["']https?:\/\//i)
    expect(html.toLowerCase()).not.toMatch(/memorial|deceased|\bshe\b|\bher\b/)
  })
})
