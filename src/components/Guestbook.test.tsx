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
let failTurnstileVerification: (() => void) | undefined
const defaultViewportWidth = window.innerWidth

function renderGuestbook(locale: 'en' | 'zh-CN' = 'en') {
  localStorage.setItem('nanami-locale', locale)
  return render(<LocaleProvider><Guestbook staticExperience siteKey="test-site-key" /></LocaleProvider>)
}

beforeEach(() => {
  localStorage.clear()
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: defaultViewportWidth, writable: true })
  document.querySelector('#nanami-turnstile-script')?.remove()
  Object.defineProperty(window, 'turnstile', {
    configurable: true,
    value: {
      render: vi.fn((_element: HTMLElement, options: { callback: (token: string) => void }) => {
        issueTurnstileToken = options.callback
        failTurnstileVerification = undefined
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
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: defaultViewportWidth, writable: true })
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
    await waitFor(() => expect(window.turnstile?.render).toHaveBeenCalledTimes(1))
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
    await waitFor(() => expect(window.turnstile?.render).toHaveBeenCalledTimes(1))
    fireEvent.submit(screen.getByRole('button', { name: 'Leave a pawprint' }).closest('form') as HTMLFormElement)

    expect(await screen.findByText('Please try again later.')).toBeVisible()
    expect(screen.getByLabelText('Nickname')).toHaveValue('Momo')
    expect(screen.getByLabelText('Message')).toHaveValue('Please say hi')
  })

  it('keeps an overlong message client-side without posting or resetting Turnstile', async () => {
    const fetch = vi.fn(async () => Response.json({ entries: [], nextCursor: null }))
    vi.stubGlobal('fetch', fetch)
    renderGuestbook()

    await screen.findByText('No pawprints here yet.')
    const message = 'm'.repeat(501)
    fireEvent.change(screen.getByLabelText('Nickname'), { target: { value: ' Momo ' } })
    fireEvent.change(screen.getByLabelText('Message'), { target: { value: message } })
    fireEvent.submit(screen.getByRole('button', { name: 'Leave a pawprint' }).closest('form') as HTMLFormElement)

    expect(await screen.findByText('Message must be 500 characters or fewer')).toBeVisible()
    expect(screen.getByLabelText('Nickname')).toHaveValue(' Momo ')
    expect(screen.getByLabelText('Message')).toHaveValue(message)
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(window.turnstile?.reset).not.toHaveBeenCalled()
  })

  it('keeps an unsupported photo client-side without posting or resetting Turnstile', async () => {
    const fetch = vi.fn(async () => Response.json({ entries: [], nextCursor: null }))
    vi.stubGlobal('fetch', fetch)
    renderGuestbook()

    await screen.findByText('No pawprints here yet.')
    fireEvent.change(screen.getByLabelText('Nickname'), { target: { value: 'Momo' } })
    fireEvent.change(screen.getByLabelText('Message'), { target: { value: 'Hello Nanami' } })
    fireEvent.change(screen.getByLabelText('Cat photo'), {
      target: { files: [new File(['cat'], 'nanami.gif', { type: 'image/gif' })] },
    })
    fireEvent.submit(screen.getByRole('button', { name: 'Leave a pawprint' }).closest('form') as HTMLFormElement)

    expect(await screen.findByText('Photo MIME type is not allowed')).toBeVisible()
    expect(screen.getByText('nanami.gif')).toBeVisible()
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(window.turnstile?.reset).not.toHaveBeenCalled()
  })

  it('does not request Turnstile until the draft passes client prevalidation', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ entries: [], nextCursor: null })))
    renderGuestbook()

    await screen.findByText('No pawprints here yet.')
    expect(window.turnstile?.render).not.toHaveBeenCalled()

    fireEvent.change(screen.getByLabelText('Nickname'), { target: { value: 'Momo' } })
    fireEvent.change(screen.getByLabelText('Message'), { target: { value: 'm'.repeat(501) } })
    expect(window.turnstile?.render).not.toHaveBeenCalled()

    fireEvent.change(screen.getByLabelText('Message'), { target: { value: 'Hello Nanami' } })
    await waitFor(() => expect(window.turnstile?.render).toHaveBeenCalledTimes(1))
  })

  it('verifies a fresh reader reaction before posting it without a compose draft', async () => {
    const fetch = vi.fn()
      .mockResolvedValueOnce(Response.json({ entries: [currentEntry], nextCursor: null }))
      .mockResolvedValueOnce(Response.json({
        entryId: 'entry-1', emoji: '🖤', active: true, total: 1,
      }))
    vi.stubGlobal('fetch', fetch)
    Object.defineProperty(window, 'turnstile', {
      configurable: true,
      value: {
        render: vi.fn((_element: HTMLElement, options: {
          callback: (token: string) => void
          'expired-callback': () => void
        }) => {
          issueTurnstileToken = options.callback
          failTurnstileVerification = options['expired-callback']
          return 'reaction-widget-id'
        }),
        reset: vi.fn(),
        remove: vi.fn(),
      },
    })
    renderGuestbook()

    const entry = await screen.findByText('Hello Nanami')
    const card = entry.closest('article') as HTMLElement
    fireEvent.click(within(card).getByRole('button', { name: 'Add 🖤 reaction' }))

    expect(fetch).toHaveBeenCalledTimes(1)
    expect(await screen.findByText('Complete verification to add this reaction.')).toHaveAttribute('role', 'status')
    await waitFor(() => expect(window.turnstile?.render).toHaveBeenCalledTimes(1))

    await act(async () => issueTurnstileToken?.('reaction-token'))

    expect(await within(card).findByText('🖤 1')).toBeVisible()
    expect(fetch).toHaveBeenLastCalledWith('/api/guestbook/entry-1/reactions', expect.objectContaining({
      body: JSON.stringify({ emoji: '🖤', active: true, 'cf-turnstile-response': 'reaction-token' }),
    }))
  })

  it('keeps a fresh reader reaction client-side when its dedicated verification fails', async () => {
    const fetch = vi.fn(async () => Response.json({ entries: [currentEntry], nextCursor: null }))
    vi.stubGlobal('fetch', fetch)
    Object.defineProperty(window, 'turnstile', {
      configurable: true,
      value: {
        render: vi.fn((_element: HTMLElement, options: {
          callback: (token: string) => void
          'expired-callback': () => void
        }) => {
          issueTurnstileToken = options.callback
          failTurnstileVerification = options['expired-callback']
          return 'reaction-widget-id'
        }),
        reset: vi.fn(),
        remove: vi.fn(),
      },
    })
    renderGuestbook()

    const entry = await screen.findByText('Hello Nanami')
    const card = entry.closest('article') as HTMLElement
    fireEvent.click(within(card).getByRole('button', { name: 'Add 🖤 reaction' }))
    await waitFor(() => expect(window.turnstile?.render).toHaveBeenCalledTimes(1))
    await act(async () => failTurnstileVerification?.())

    expect(await screen.findByText('Reaction verification was not completed. Try again.')).toHaveAttribute('role', 'alert')
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(within(card).getByRole('button', { name: 'Add 🖤 reaction' })).not.toBeDisabled()
  })

  it('localizes the chapter, navigation target copy, and 44px control affordances', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ entries: [], nextCursor: null })))
    renderGuestbook('zh-CN')

    expect(await screen.findByRole('heading', { name: '留下一枚猫爪印。' })).toBeVisible()
    expect(screen.getByLabelText('昵称')).toBeVisible()
    expect(screen.getByRole('button', { name: '留下猫爪印' })).toHaveClass('guestbook__submit')
    expect(screen.getByRole('button', { name: '🐾' })).toHaveClass('guestbook__emoji-button')
  })

  it('loads the official Turnstile script only after its widget mounts and stays unavailable after a failed script remount', async () => {
    Object.defineProperty(window, 'turnstile', { configurable: true, value: undefined })
    const onToken = vi.fn()
    const unavailable = render(<TurnstileWidget siteKey="" onToken={onToken} resetKey={0} unavailableLabel="Turnstile unavailable" />)

    expect(screen.getByText('Turnstile unavailable')).toHaveAttribute('role', 'status')
    expect(document.querySelector('#nanami-turnstile-script')).not.toBeInTheDocument()
    unavailable.unmount()

    const firstMount = render(<TurnstileWidget siteKey="test-site-key" onToken={onToken} resetKey={0} unavailableLabel="Turnstile unavailable" />)
    const script = await waitFor(() => {
      const element = document.querySelector<HTMLScriptElement>('#nanami-turnstile-script')
      expect(element).not.toBeNull()
      expect(element).toHaveAttribute(
      'src',
      'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit',
      )
      return element
    })
    if (script === null) throw new Error('Turnstile script was not appended')
    fireEvent.error(script)
    expect(await firstMount.findByText('Turnstile unavailable')).toHaveAttribute('role', 'status')
    firstMount.unmount()

    const remount = render(<TurnstileWidget siteKey="test-site-key" onToken={onToken} resetKey={0} unavailableLabel="Turnstile unavailable" />)
    expect(await remount.findByText('Turnstile unavailable')).toHaveAttribute('role', 'status')
    expect(document.querySelectorAll('#nanami-turnstile-script')).toHaveLength(1)
  })

  it('keeps Cloudflare Turnstile compact through the 375px guestbook boundary and clears the old token when resizing back to normal', async () => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 375, writable: true })
    const onToken = vi.fn()
    render(<TurnstileWidget siteKey="test-site-key" onToken={onToken} resetKey={0} unavailableLabel="Turnstile unavailable" />)

    await waitFor(() => expect(window.turnstile?.render).toHaveBeenCalledTimes(1))
    expect(window.turnstile?.render).toHaveBeenLastCalledWith(expect.anything(), expect.objectContaining({
      size: 'compact',
    }))

    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 393, writable: true })
    await act(async () => window.dispatchEvent(new Event('resize')))

    await waitFor(() => expect(window.turnstile?.render).toHaveBeenCalledTimes(2))
    expect(window.turnstile?.remove).toHaveBeenCalledWith('widget-id')
    expect(onToken).toHaveBeenCalledWith(null)
    expect(window.turnstile?.render).toHaveBeenLastCalledWith(expect.anything(), expect.objectContaining({
      size: 'normal',
    }))
  })

  it('gives entry and reaction verification the compact size at a 320px viewport', async () => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 320, writable: true })
    const fetch = vi.fn()
      .mockResolvedValueOnce(Response.json({ entries: [currentEntry], nextCursor: null }))
      .mockResolvedValueOnce(Response.json({
        entryId: 'entry-1', emoji: '🖤', active: true, total: 1,
      }))
    vi.stubGlobal('fetch', fetch)
    renderGuestbook()

    const entry = await screen.findByText('Hello Nanami')
    fireEvent.change(screen.getByLabelText('Nickname'), { target: { value: 'Momo' } })
    fireEvent.change(screen.getByLabelText('Message'), { target: { value: 'Hello Nanami' } })
    await waitFor(() => expect(window.turnstile?.render).toHaveBeenCalledTimes(1))

    const card = entry.closest('article') as HTMLElement
    fireEvent.click(within(card).getByRole('button', { name: 'Add 🖤 reaction' }))
    await waitFor(() => expect(window.turnstile?.render).toHaveBeenCalledTimes(2))

    const calls = (window.turnstile?.render as unknown as { mock: { calls: unknown[][] } }).mock.calls
    expect(calls).toHaveLength(2)
    expect(calls.every(([, options]) => (options as { size?: string }).size === 'compact')).toBe(true)
  })

  it('offers each visible reaction as a labelled, toggleable control', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ entries: [currentEntry], nextCursor: null })))
    renderGuestbook()

    const entry = await screen.findByText('Hello Nanami')
    const card = entry.closest('article') as HTMLElement
    expect(within(card).getByRole('button', { name: 'Add 🐈‍⬛ reaction' })).toHaveClass('guestbook__reaction')
  })
})
