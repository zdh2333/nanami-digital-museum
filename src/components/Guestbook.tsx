import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from 'react'

import { archiveItems } from '../archive/items'
import { ENTRY_EMOJIS, type GuestbookEmoji } from '../guestbook/contracts'
import {
  GuestbookApiError,
  createGuestbookEntry,
  fetchGuestbook,
  toggleReaction,
  type GuestbookEntry,
} from '../guestbook/client'
import {
  GuestbookValidationError,
  parseEntryFields,
  validatePhotoMetadata,
} from '../guestbook/validation'
import { useLocale } from '../i18n/LocaleProvider'
import { SectionReveal } from './SectionReveal'
import { TurnstileWidget } from './TurnstileWidget'

// Turnstile site keys are public. Keep the production key available at Vite
// build time (Pages runtime vars do not rewrite an already-built asset), while
// `dev:pages` overrides it with Cloudflare's documented local test key.
const publicTurnstileSiteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY ?? '0x4AAAAAAAD34l0QAtjJvwGlX'
const chapterPhotoIds = ['nanami-photo-019', 'nanami-photo-017', 'nanami-photo-018'] as const

type GuestbookProps = {
  staticExperience: boolean
  siteKey?: string
}

type ReactionIntent = {
  entryId: string
  emoji: GuestbookEmoji
  active: boolean
}

function errorMessage(error: unknown): string {
  return error instanceof GuestbookApiError || error instanceof GuestbookValidationError
    ? error.message
    : 'Guestbook is temporarily unavailable. Please try again later.'
}

function reactionKey(entryId: string, emoji: GuestbookEmoji): string {
  return `${entryId}:${emoji}`
}

function validateDraft(input: {
  nickname: string
  message: string
  emoji: GuestbookEmoji | ''
  photo: File | null
}) {
  const fields = parseEntryFields(input)
  if (input.photo !== null) {
    validatePhotoMetadata({ declaredMime: input.photo.type, size: input.photo.size })
  }
  return fields
}

function updateReaction(
  entries: readonly GuestbookEntry[],
  entryId: string,
  emoji: GuestbookEmoji,
  total: number,
): GuestbookEntry[] {
  return entries.map((entry) => {
    if (entry.id !== entryId) return entry
    const otherReactions = entry.reactions.filter((reaction) => reaction.emoji !== emoji)
    return {
      ...entry,
      reactions: total > 0 ? [...otherReactions, { emoji, total }] : otherReactions,
    }
  })
}

export function Guestbook({ staticExperience, siteKey = publicTurnstileSiteKey }: GuestbookProps) {
  const { locale, copy } = useLocale()
  const [entries, setEntries] = useState<GuestbookEntry[]>([])
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [nickname, setNickname] = useState('')
  const [message, setMessage] = useState('')
  const [emoji, setEmoji] = useState<GuestbookEmoji | ''>('')
  const [photo, setPhoto] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [entryTurnstileToken, setEntryTurnstileToken] = useState<string | null>(null)
  const [entryResetKey, setEntryResetKey] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [formSuccess, setFormSuccess] = useState<string | null>(null)
  const [pendingPhotoIds, setPendingPhotoIds] = useState<ReadonlySet<string>>(() => new Set())
  const [activeReactionKeys, setActiveReactionKeys] = useState<ReadonlySet<string>>(() => new Set())
  const [pendingReactionKeys, setPendingReactionKeys] = useState<ReadonlySet<string>>(() => new Set())
  const [reactionIntent, setReactionIntent] = useState<ReactionIntent | null>(null)
  const [reactionTurnstileToken, setReactionTurnstileToken] = useState<string | null>(null)
  const [reactionResetKey, setReactionResetKey] = useState(0)
  const [reactionSubmitting, setReactionSubmitting] = useState(false)
  const [reactionVerificationFailed, setReactionVerificationFailed] = useState(false)
  const [reactionStatus, setReactionStatus] = useState<string | null>(null)
  const [hasRequestedVerification, setHasRequestedVerification] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const chapterPhotos = useMemo(
    () => chapterPhotoIds.flatMap((id) => {
      const item = archiveItems.find((candidate) => candidate.id === id)
      return item === undefined ? [] : [item]
    }),
    [],
  )
  const featurePhoto = chapterPhotos[0]
  const draftIsReadyForVerification = useMemo(() => {
    try {
      validateDraft({ nickname, message, emoji, photo })
      return true
    } catch {
      return false
    }
  }, [emoji, message, nickname, photo])

  useEffect(() => {
    if (draftIsReadyForVerification) setHasRequestedVerification(true)
  }, [draftIsReadyForVerification])

  const clearSelectedPhoto = useCallback(() => {
    if (photoPreview !== null) URL.revokeObjectURL(photoPreview)
    setPhoto(null)
    setPhotoPreview(null)
    if (fileInputRef.current !== null) fileInputRef.current.value = ''
  }, [photoPreview])

  useEffect(() => () => {
    if (photoPreview !== null) URL.revokeObjectURL(photoPreview)
  }, [photoPreview])

  useEffect(() => {
    const controller = new AbortController()
    let mounted = true
    setLoading(true)
    void fetchGuestbook(undefined, controller.signal)
      .then((page) => {
        if (!mounted) return
        setEntries(page.entries)
        setNextCursor(page.nextCursor)
        setLoadError(null)
      })
      .catch((error: unknown) => {
        if (!mounted || (error instanceof DOMException && error.name === 'AbortError')) return
        setLoadError(errorMessage(error))
      })
      .finally(() => {
        if (mounted) setLoading(false)
      })

    return () => {
      mounted = false
      controller.abort()
    }
  }, [])

  const onEntryTurnstileToken = useCallback((token: string | null) => {
    setEntryTurnstileToken(token)
  }, [])

  const onReactionTurnstileToken = useCallback((token: string | null) => {
    setReactionTurnstileToken(token)
    if (token === null) setReactionVerificationFailed(true)
  }, [])

  const onPhotoChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const selected = event.currentTarget.files?.[0] ?? null
    if (photoPreview !== null) URL.revokeObjectURL(photoPreview)
    setPhoto(selected)
    setPhotoPreview(selected !== null && typeof URL.createObjectURL === 'function'
      ? URL.createObjectURL(selected)
      : null)
    setFormError(null)
  }, [photoPreview])

  const submitEntry = useCallback(async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (submitting) return

    let fields: ReturnType<typeof parseEntryFields>
    try {
      fields = validateDraft({ nickname, message, emoji, photo })
    } catch (error) {
      setFormError(errorMessage(error))
      return
    }

    if (entryTurnstileToken === null) {
      setFormError(copy.guestbook.verificationRequired)
      return
    }

    setSubmitting(true)
    setFormError(null)
    setFormSuccess(null)
    try {
      const created = await createGuestbookEntry({
        nickname: fields.nickname,
        message: fields.message,
        emoji: fields.emoji,
        photo,
        turnstileToken: entryTurnstileToken,
      })
      setEntries((current) => [created.entry, ...current])
      if (created.photoStatus === 'pending') {
        setPendingPhotoIds((current) => new Set(current).add(created.entry.id))
        setFormSuccess(`${copy.guestbook.posted} ${copy.guestbook.photoPendingNotice}`)
      } else {
        setFormSuccess(copy.guestbook.posted)
      }
      setNickname('')
      setMessage('')
      setEmoji('')
      clearSelectedPhoto()
    } catch (error) {
      setFormError(errorMessage(error))
    } finally {
      setEntryTurnstileToken(null)
      setEntryResetKey((current) => current + 1)
      setSubmitting(false)
    }
  }, [clearSelectedPhoto, copy.guestbook, emoji, entryTurnstileToken, message, nickname, photo, submitting])

  const loadMore = useCallback(async () => {
    if (nextCursor === null || loadingMore) return
    setLoadingMore(true)
    setLoadError(null)
    try {
      const page = await fetchGuestbook(nextCursor)
      setEntries((current) => [...current, ...page.entries])
      setNextCursor(page.nextCursor)
    } catch (error) {
      setLoadError(errorMessage(error))
    } finally {
      setLoadingMore(false)
    }
  }, [loadingMore, nextCursor])

  const requestReaction = useCallback((entryId: string, reactionEmoji: GuestbookEmoji) => {
    const key = reactionKey(entryId, reactionEmoji)
    if (reactionIntent !== null || reactionSubmitting || pendingReactionKeys.has(key)) return

    setReactionTurnstileToken(null)
    setReactionVerificationFailed(false)
    setReactionStatus(copy.guestbook.reactionVerificationPending)
    setReactionIntent({
      entryId,
      emoji: reactionEmoji,
      active: !activeReactionKeys.has(key),
    })
  }, [activeReactionKeys, copy.guestbook.reactionVerificationPending, pendingReactionKeys, reactionIntent, reactionSubmitting])

  useEffect(() => {
    if (!reactionVerificationFailed || reactionIntent === null) return
    setReactionIntent(null)
    setReactionTurnstileToken(null)
    setReactionVerificationFailed(false)
    setReactionStatus(copy.guestbook.reactionVerificationFailed)
  }, [copy.guestbook.reactionVerificationFailed, reactionIntent, reactionVerificationFailed])

  useEffect(() => {
    if (reactionIntent === null || reactionTurnstileToken === null || reactionSubmitting) return

    const { entryId, emoji: reactionEmoji, active } = reactionIntent
    const key = reactionKey(entryId, reactionEmoji)
    setReactionSubmitting(true)
    setPendingReactionKeys((current) => new Set(current).add(key))
    setReactionStatus(null)
    void toggleReaction({ entryId, emoji: reactionEmoji, active, turnstileToken: reactionTurnstileToken })
      .then((result) => {
        setEntries((current) => updateReaction(current, result.entryId, result.emoji, result.total))
        setActiveReactionKeys((current) => {
          const next = new Set(current)
          if (result.active) next.add(key)
          else next.delete(key)
          return next
        })
      })
      .catch((error: unknown) => {
        setReactionStatus(errorMessage(error))
      })
      .finally(() => {
        setPendingReactionKeys((current) => {
          const next = new Set(current)
          next.delete(key)
          return next
        })
        setReactionTurnstileToken(null)
        setReactionIntent(null)
        setReactionResetKey((current) => current + 1)
        setReactionSubmitting(false)
      })
  }, [reactionIntent, reactionSubmitting, reactionTurnstileToken])

  return (
    <section
      id="guestbook"
      data-museum-section="guestbook"
      className="anchor-target museum-section guestbook"
      aria-labelledby="guestbook-title"
    >
      {featurePhoto ? <div className="guestbook__backdrop" aria-hidden="true">
        <img src={featurePhoto.src1600} alt="" width="1600" height="2133" loading="lazy" decoding="async" />
      </div> : null}
      <SectionReveal className="guestbook__intro" staticExperience={staticExperience}>
        <p className="museum-label">{copy.guestbook.eyebrow}</p>
        <h2 id="guestbook-title">{copy.guestbook.title}</h2>
        <p>{copy.guestbook.summary}</p>
      </SectionReveal>

      <div className="guestbook__layout">
        <form className="guestbook__desk" onSubmit={submitEntry} noValidate aria-busy={submitting}>
          <div className="guestbook__desk-heading">
            <p className="museum-label">NNM / NOTES</p>
            <h3>{copy.guestbook.formTitle}</h3>
          </div>
          <div className="guestbook__field-row">
            <label htmlFor="guestbook-nickname">{copy.guestbook.nickname}</label>
            <input
              id="guestbook-nickname"
              name="nickname"
              value={nickname}
              onChange={(event) => setNickname(event.target.value)}
              minLength={1}
              maxLength={24}
              required
              autoComplete="nickname"
            />
          </div>
          <div className="guestbook__field-row">
            <label htmlFor="guestbook-message">{copy.guestbook.message}</label>
            <textarea
              id="guestbook-message"
              name="message"
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              placeholder={copy.guestbook.messagePlaceholder}
              minLength={1}
              maxLength={500}
              required
              rows={5}
            />
          </div>
          <fieldset className="guestbook__emoji-field">
            <legend>{copy.guestbook.emojiLabel}</legend>
            <div className="guestbook__emoji-row">
              {ENTRY_EMOJIS.map((option) => <button
                key={option}
                type="button"
                className="guestbook__emoji-button"
                aria-label={option}
                aria-pressed={emoji === option}
                onClick={() => setEmoji((current) => current === option ? '' : option)}
              >{option}</button>)}
            </div>
          </fieldset>
          <div className="guestbook__photo-field">
            <input
              ref={fileInputRef}
              id="guestbook-photo"
              className="visually-hidden"
              type="file"
              aria-label={copy.guestbook.photo}
              accept="image/jpeg,image/png,image/webp"
              onChange={onPhotoChange}
            />
            <label className="guestbook__photo-picker" htmlFor="guestbook-photo">
              <span>{copy.guestbook.photo}</span>
              <small>{copy.guestbook.photoHint}</small>
            </label>
            <p className="guestbook__photo-safety">{copy.guestbook.photoSafety}</p>
            {photo !== null ? <div className="guestbook__photo-preview">
              {photoPreview !== null ? <img src={photoPreview} alt="" /> : null}
              <span>{photo.name}</span>
              <button type="button" onClick={clearSelectedPhoto}>{copy.guestbook.photoRemove}</button>
            </div> : null}
          </div>
          {draftIsReadyForVerification || hasRequestedVerification ? <TurnstileWidget
            siteKey={siteKey}
            onToken={onEntryTurnstileToken}
            resetKey={entryResetKey}
            unavailableLabel={copy.guestbook.verificationUnavailable}
          /> : null}
          <div className="guestbook__form-footer">
            <div aria-live="polite" className="guestbook__form-status">
              {formError ? <p className="guestbook__error">{formError}</p> : null}
              {formSuccess ? <p className="guestbook__success">{formSuccess}</p> : null}
            </div>
            <button className="guestbook__submit" type="submit" disabled={submitting}>
              {submitting ? copy.guestbook.submitting : copy.guestbook.submit}
            </button>
          </div>
        </form>

        <div className="guestbook__reading-desk" aria-live="polite">
          <div className="guestbook__photo-ribbon" aria-label={copy.guestbook.title}>
            {chapterPhotos.slice(1).map((item) => <img
              key={item.id}
              src={item.src640}
              alt={item.alt[locale]}
              width="640"
              height="853"
              loading="lazy"
              decoding="async"
            />)}
          </div>
          {loading ? <p className="guestbook__empty">{copy.guestbook.loading}</p> : null}
          {loadError ? <p className="guestbook__error">{loadError}</p> : null}
          {!loading && !loadError && entries.length === 0 ? <p className="guestbook__empty">{copy.guestbook.empty}</p> : null}
          <div className="guestbook__entries">
            {entries.map((entry) => {
              const pendingPhoto = pendingPhotoIds.has(entry.id)
              return <article key={entry.id} className="guestbook__entry">
                {entry.photoUrl !== null ? <img
                  data-guestbook-photo="approved"
                  className="guestbook__entry-photo"
                  src={entry.photoUrl}
                  alt=""
                  loading="lazy"
                  decoding="async"
                /> : null}
                <header>
                  <p>{entry.emoji ?? '🐈‍⬛'} <strong>{entry.nickname}</strong></p>
                  <time dateTime={new Date(entry.createdAt).toISOString()}>{copy.guestbook.formatDate(entry.createdAt)}</time>
                </header>
                <p className="guestbook__entry-message">{entry.message}</p>
                {pendingPhoto ? <p className="guestbook__pending-photo">{copy.guestbook.pendingPhoto}</p> : null}
                <div className="guestbook__reactions" aria-label={entry.nickname}>
                  {ENTRY_EMOJIS.map((reactionEmoji) => {
                    const key = reactionKey(entry.id, reactionEmoji)
                    const active = activeReactionKeys.has(key)
                    const total = entry.reactions.find((reaction) => reaction.emoji === reactionEmoji)?.total ?? 0
                    return <button
                      key={reactionEmoji}
                      type="button"
                      className="guestbook__reaction"
                      aria-label={copy.guestbook.formatReactionLabel(reactionEmoji, active)}
                      aria-pressed={active}
                      disabled={pendingReactionKeys.has(key) || reactionIntent !== null}
                      onClick={() => requestReaction(entry.id, reactionEmoji)}
                    >{reactionEmoji} {total}</button>
                  })}
                </div>
              </article>
            })}
          </div>
          {reactionIntent !== null || reactionStatus !== null ? <div className="guestbook__reaction-verification" aria-live="polite">
            {reactionIntent !== null ? <TurnstileWidget
              siteKey={siteKey}
              onToken={onReactionTurnstileToken}
              resetKey={reactionResetKey}
              unavailableLabel={copy.guestbook.verificationUnavailable}
            /> : null}
            {reactionStatus !== null ? <p
              role={reactionIntent === null ? 'alert' : 'status'}
              className={reactionIntent === null ? 'guestbook__error' : 'guestbook__verification-status'}
            >{reactionStatus}</p> : null}
          </div> : null}
          {nextCursor !== null ? <button
            type="button"
            className="guestbook__load-more"
            onClick={() => void loadMore()}
            disabled={loadingMore}
          >{loadingMore ? copy.guestbook.loadingMore : copy.guestbook.loadMore}</button> : null}
        </div>
      </div>
    </section>
  )
}
