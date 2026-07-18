import { fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { LocaleProvider } from '../i18n/LocaleProvider'
import { Guestbook } from './Guestbook'

const currentEntry = {
  id: 'entry-1',
  nickname: 'Momo',
  message: 'Hello Nanami',
  emoji: '🐾' as const,
  createdAt: 1_700_000_000_000,
  photoUrl: null,
  reactions: [],
}

function renderGuestbook(locale: 'en' | 'zh-CN' = 'en') {
  localStorage.setItem('nanami-locale', locale)
  return render(<LocaleProvider><Guestbook staticExperience /></LocaleProvider>)
}

afterEach(() => {
  localStorage.clear()
  vi.unstubAllGlobals()
})

describe('Guestbook', () => {
  it('submits a localized text entry, keeps its photo pending, and toggles a reaction', async () => {
    const fetch = vi.fn()
      .mockResolvedValueOnce(Response.json({ entries: [], nextCursor: null }))
      .mockResolvedValueOnce(Response.json({ entry: currentEntry, photoStatus: 'pending', photoUrl: null }, { status: 201 }))
      .mockResolvedValueOnce(Response.json({ entryId: 'entry-1', emoji: '🖤', active: true, total: 1 }))
    vi.stubGlobal('fetch', fetch)
    renderGuestbook()

    await screen.findByText('No pawprints here yet.')
    fireEvent.change(screen.getByLabelText('Nickname'), { target: { value: 'Momo' } })
    fireEvent.change(screen.getByLabelText('Message'), { target: { value: 'Hello Nanami' } })
    fireEvent.click(screen.getByRole('button', { name: '🐾' }))
    fireEvent.change(screen.getByLabelText('Cat photo'), {
      target: { files: [new File(['cat'], 'nanami.webp', { type: 'image/webp' })] },
    })
    fireEvent.submit(screen.getByRole('button', { name: 'Leave a pawprint' }).closest('form') as HTMLFormElement)

    expect(await screen.findByText('Hello Nanami')).toBeVisible()
    expect(screen.getByText('Photo pending review')).toBeVisible()
    const entry = screen.getByText('Hello Nanami').closest('article') as HTMLElement
    fireEvent.click(within(entry).getByRole('button', { name: 'Add 🖤 reaction' }))
    expect(await within(entry).findByText('🖤 1')).toBeVisible()

    const [, entryRequest] = fetch.mock.calls[1] as [string, RequestInit]
    expect((entryRequest.body as FormData).get('cf-turnstile-response')).toBeNull()
    expect(fetch.mock.calls[2]?.[1]).toMatchObject({
      body: JSON.stringify({ emoji: '🖤', active: true }),
    })
  })

  it('keeps an invalid draft client-side without posting it', async () => {
    const fetch = vi.fn(async () => Response.json({ entries: [], nextCursor: null }))
    vi.stubGlobal('fetch', fetch)
    renderGuestbook()

    await screen.findByText('No pawprints here yet.')
    fireEvent.change(screen.getByLabelText('Nickname'), { target: { value: ' Momo ' } })
    fireEvent.change(screen.getByLabelText('Message'), { target: { value: 'm'.repeat(501) } })
    fireEvent.submit(screen.getByRole('button', { name: 'Leave a pawprint' }).closest('form') as HTMLFormElement)

    expect(await screen.findByText('Message must be 500 characters or fewer')).toBeVisible()
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('renders visitor text rather than markup', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({
      entries: [{ ...currentEntry, message: '<b>still a pawprint</b>' }], nextCursor: null,
    })))
    const { container } = renderGuestbook()

    expect(await screen.findByText('<b>still a pawprint</b>')).toBeVisible()
    expect(container.querySelector('b')).not.toBeInTheDocument()
  })

  it('localizes the chapter and keeps emoji controls accessible', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ entries: [], nextCursor: null })))
    renderGuestbook('zh-CN')

    expect(await screen.findByRole('heading', { name: '留下一枚猫爪印。' })).toBeVisible()
    expect(screen.getByLabelText('昵称')).toBeVisible()
    expect(screen.getByRole('button', { name: '🐾' })).toHaveClass('guestbook__emoji-button')
  })
})
