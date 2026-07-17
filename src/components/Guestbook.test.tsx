import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { LocaleProvider } from '../i18n/LocaleProvider'
import { Guestbook } from './Guestbook'
import { TurnstileWidget } from './TurnstileWidget'

const currentEntry = {
  id: 'entry-1',
  nickname: 'Momo',
  message: 'Hello Nanami',
  emoji: '🐾' as const,
  createdAt: 1_700_000_000_000,
  photoUrl: null,
  reactions: [],
}

let issueTurnstileToken: ((token: string) => void) | undefined

function renderGuestbook(locale: 'en' | 'zh-CN' = 'en') {
  localStorage.setItem('nanami-locale', locale)
  return render(<LocaleProvider><Guestbook staticExperience siteKey="test-site-key" /></LocaleProvider>)
}

beforeEach(() => {
  localStorage.clear()
  document.querySelector('#nanami-turnstile-script')?.remove()
  Object.defineProperty(window, 'turnstile', {
    configurable: true,
    value: {
      render: vi.fn((_element: HTMLElement, options: { callback: (token: string) => void }) => {
        issueTurnstileToken = options.callback
        options.callback('turnstile-token')
        return 'widget-id'
      }),
      reset: vi.fn(() => issueTurnstileToken?.('refreshed-turnstile-token')),
      remove: vi.fn(),
    },
  })
})

afterEach(() => {
  vi.unstubAllGlobals()
  document.querySelector('#nanami-turnstile-script')?.remove()
})

describe('Guestbook', () => {
  it('submits a localized text entry, keeps its photo pending, and toggles a reaction', async () => {
    const fetch = vi.fn()
      .mockResolvedValueOnce(Response.json({ entries: [], nextCursor: null }))
      .mockResolvedValueOnce(Response.json({
        entry: currentEntry,
        photoStatus: 'pending',
        photoUrl: null,
      }, { status: 201 }))
      .mockResolvedValueOnce(Response.json({
        entryId: 'entry-1', emoji: '🖤', active: true, total: 1,
      }))
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
    await act(async () => issueTurnstileToken?.('fresh-turnstile-token'))
    fireEvent.click(screen.getByRole('button', { name: 'Add 🖤 reaction' }))
    expect(await screen.findByText('🖤 1')).toBeVisible()
    expect(window.turnstile?.reset).toHaveBeenCalled()
  })

  it('keeps a draft after a safe request failure and renders visitors as text, never HTML', async () => {
    const fetch = vi.fn()
      .mockResolvedValueOnce(Response.json({
        entries: [{ ...currentEntry, message: '<b>still a pawprint</b>' }],
        nextCursor: null,
      }))
      .mockResolvedValueOnce(Response.json({ error: 'Please try again later.' }, { status: 503 }))
    vi.stubGlobal('fetch', fetch)
    const { container } = renderGuestbook()

    expect(await screen.findByText('<b>still a pawprint</b>')).toBeVisible()
    expect(container.querySelector('b')).not.toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Nickname'), { target: { value: 'Momo' } })
    fireEvent.change(screen.getByLabelText('Message'), { target: { value: 'Please say hi' } })
    fireEvent.submit(screen.getByRole('button', { name: 'Leave a pawprint' }).closest('form') as HTMLFormElement)

    expect(await screen.findByText('Please try again later.')).toBeVisible()
    expect(screen.getByLabelText('Nickname')).toHaveValue('Momo')
    expect(screen.getByLabelText('Message')).toHaveValue('Please say hi')
  })

  it('localizes the chapter, navigation target copy, and 44px control affordances', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ entries: [], nextCursor: null })))
    renderGuestbook('zh-CN')

    expect(await screen.findByRole('heading', { name: '留下一枚猫爪印。' })).toBeVisible()
    expect(screen.getByLabelText('昵称')).toBeVisible()
    expect(screen.getByRole('button', { name: '留下猫爪印' })).toHaveClass('guestbook__submit')
    expect(screen.getByRole('button', { name: '🐾' })).toHaveClass('guestbook__emoji-button')
  })

  it('loads the official Turnstile script only after its widget mounts and states unavailable configuration accessibly', async () => {
    Object.defineProperty(window, 'turnstile', { configurable: true, value: undefined })
    const onToken = vi.fn()
    render(<TurnstileWidget siteKey="" onToken={onToken} resetKey={0} unavailableLabel="Turnstile unavailable" />)

    expect(screen.getByText('Turnstile unavailable')).toHaveAttribute('role', 'status')
    expect(document.querySelector('#nanami-turnstile-script')).not.toBeInTheDocument()

    const { unmount } = render(<TurnstileWidget siteKey="test-site-key" onToken={onToken} resetKey={0} unavailableLabel="Turnstile unavailable" />)
    await waitFor(() => expect(document.querySelector('#nanami-turnstile-script')).toHaveAttribute(
      'src',
      'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit',
    ))
    unmount()
  })

  it('offers each visible reaction as a labelled, toggleable control', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ entries: [currentEntry], nextCursor: null })))
    renderGuestbook()

    const entry = await screen.findByText('Hello Nanami')
    const card = entry.closest('article') as HTMLElement
    expect(within(card).getByRole('button', { name: 'Add 🐈‍⬛ reaction' })).toHaveClass('guestbook__reaction')
  })
})
