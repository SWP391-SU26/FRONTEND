import { Loader2, ThumbsDown, ThumbsUp, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

import { FEEDBACK_REASONS } from '../services/feedbackService.js'

const REASON_LABEL_KEYS = {
  WRONG_INFORMATION: 'chat.feedbackReasonWrong',
  MISSING_CITATION: 'chat.feedbackReasonMissingCitation',
  OFF_TOPIC: 'chat.feedbackReasonOffTopic',
  TOO_SLOW: 'chat.feedbackReasonTooSlow',
  OTHER: 'chat.feedbackReasonOther',
}

const MAX_COMMENT_LENGTH = 1000

/**
 * Thumbs up / down on one assistant answer (FR-09).
 *
 * A thumbs up posts straight away; a thumbs down opens the reason picker first,
 * because the API rejects negative feedback that carries no reason code.
 */
export function MessageFeedback({ feedback, messageId, onSubmit, t }) {
  const [reasonOpen, setReasonOpen] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState(false)

  const helpful = feedback?.helpful === true
  const notHelpful = feedback?.helpful === false

  async function send(payload) {
    setPending(true)
    setError(false)
    try {
      await onSubmit(messageId, payload)
      setReasonOpen(false)
    } catch {
      setError(true)
    } finally {
      setPending(false)
    }
  }

  return (
    <>
      <div className="inline-flex items-center gap-1">
        <FeedbackButton
          active={helpful}
          activeClassName="bg-emerald-50 text-emerald-700"
          disabled={pending}
          label={t('chat.feedbackHelpful')}
          onClick={() => send({ helpful: true })}
        >
          <ThumbsUp size={15} />
        </FeedbackButton>
        <FeedbackButton
          active={notHelpful}
          activeClassName="bg-rose-50 text-rose-700"
          disabled={pending}
          label={t('chat.feedbackNotHelpful')}
          onClick={() => { setError(false); setReasonOpen(true) }}
        >
          <ThumbsDown size={15} />
        </FeedbackButton>
        {pending ? <Loader2 aria-hidden="true" className="size-3.5 animate-spin text-slate-400" /> : null}
        {feedback && !pending && !error ? (
          <span className="ml-1 text-xs text-slate-500">{t('chat.feedbackThanks')}</span>
        ) : null}
        {error ? (
          <span className="ml-1 text-xs text-rose-600" role="alert">{t('chat.feedbackFailed')}</span>
        ) : null}
      </div>

      {reasonOpen ? (
        <ReasonDialog
          busy={pending}
          initialReason={feedback?.helpful === false ? feedback.reasonCode : null}
          initialComment={feedback?.helpful === false ? (feedback.comment ?? '') : ''}
          onCancel={() => setReasonOpen(false)}
          onConfirm={(reasonCode, comment) => send({ helpful: false, reasonCode, comment })}
          t={t}
        />
      ) : null}
    </>
  )
}

function FeedbackButton({ active, activeClassName, children, disabled, label, onClick }) {
  return (
    <button
      aria-label={label}
      aria-pressed={active}
      className={[
        'grid size-9 shrink-0 place-items-center rounded-lg transition',
        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-600',
        'disabled:cursor-not-allowed disabled:opacity-50',
        active ? activeClassName : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900',
      ].join(' ')}
      disabled={disabled}
      onClick={onClick}
      title={label}
      type="button"
    >
      {children}
    </button>
  )
}

function ReasonDialog({ busy, initialComment, initialReason, onCancel, onConfirm, t }) {
  const [reason, setReason] = useState(initialReason ?? FEEDBACK_REASONS[0])
  const [comment, setComment] = useState(initialComment)
  const dialogRef = useRef(null)

  useEffect(() => {
    dialogRef.current?.focus()
    function onKeyDown(event) {
      if (event.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onCancel])

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/40 px-4">
      <div
        aria-labelledby="feedback-reason-title"
        aria-modal="true"
        className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl outline-none"
        ref={dialogRef}
        role="dialog"
        tabIndex={-1}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-slate-900" id="feedback-reason-title">
              {t('chat.feedbackReasonTitle')}
            </h2>
            <p className="mt-1 text-sm text-slate-500">{t('chat.feedbackReasonHint')}</p>
          </div>
          <button
            aria-label={t('chat.feedbackCancel')}
            className="grid size-8 place-items-center rounded-lg text-slate-400 hover:bg-slate-100"
            onClick={onCancel}
            type="button"
          >
            <X size={16} />
          </button>
        </div>

        <fieldset className="mt-4 space-y-1.5">
          {FEEDBACK_REASONS.map((code) => (
            <label
              className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-slate-700 hover:bg-slate-50"
              key={code}
            >
              <input
                checked={reason === code}
                className="size-4 accent-teal-700"
                name="feedback-reason"
                onChange={() => setReason(code)}
                type="radio"
                value={code}
              />
              {t(REASON_LABEL_KEYS[code])}
            </label>
          ))}
        </fieldset>

        <label className="mt-4 block text-sm font-medium text-slate-700" htmlFor="feedback-comment">
          {t('chat.feedbackCommentLabel')}
        </label>
        <textarea
          className="mt-1.5 w-full resize-none rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-teal-500"
          id="feedback-comment"
          maxLength={MAX_COMMENT_LENGTH}
          onChange={(event) => setComment(event.target.value)}
          placeholder={t('chat.feedbackCommentPlaceholder')}
          rows={3}
          value={comment}
        />

        <div className="mt-5 flex justify-end gap-2">
          <button
            className="rounded-lg px-3.5 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
            onClick={onCancel}
            type="button"
          >
            {t('chat.feedbackCancel')}
          </button>
          <button
            className="inline-flex items-center gap-2 rounded-lg bg-teal-700 px-3.5 py-2 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-60"
            disabled={busy}
            onClick={() => onConfirm(reason, comment)}
            type="button"
          >
            {busy ? <Loader2 aria-hidden="true" className="size-4 animate-spin" /> : null}
            {t('chat.feedbackSubmit')}
          </button>
        </div>
      </div>
    </div>
  )
}

export default MessageFeedback
