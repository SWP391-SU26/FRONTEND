import { request } from './httpClient.js'

/** Reason codes the backend accepts; must stay in sync with FeedbackReason.java. */
export const FEEDBACK_REASONS = [
  'WRONG_INFORMATION',
  'MISSING_CITATION',
  'OFF_TOPIC',
  'TOO_SLOW',
  'OTHER',
]

/**
 * Rates one assistant answer. Sending the same message twice overwrites the
 * previous rating, so this doubles as "change my mind".
 */
export async function submitFeedback(messageId, { helpful, reasonCode = null, comment = null } = {}) {
  return request(`/chat/messages/${messageId}/feedback`, {
    method: 'POST',
    body: JSON.stringify({
      helpful,
      // The API rejects a reason on positive feedback, so never send one.
      reasonCode: helpful ? null : reasonCode,
      comment: comment?.trim() ? comment.trim() : null,
    }),
  })
}

/**
 * Every rating the current user left in a session, keyed by message id so the
 * thread can restore its thumbs after a reload.
 */
export async function getSessionFeedback(sessionId) {
  const items = await request(`/chat/sessions/${sessionId}/feedback`)
  const byMessageId = {}
  for (const item of Array.isArray(items) ? items : []) {
    if (item?.messageId) byMessageId[item.messageId] = item
  }
  return byMessageId
}

// ---------------------------------------------------------------- insights

function rangeQuery({ from, to, limit } = {}) {
  const query = new URLSearchParams()
  if (from) query.set('from', from)
  if (to) query.set('to', to)
  if (limit) query.set('limit', String(limit))
  return query.size ? `?${query}` : ''
}

export async function getFeedbackStats(range = {}) {
  return request(`/evaluation/feedback/stats${rangeQuery(range)}`)
}

export async function getNegativeFeedback(range = {}) {
  return request(`/evaluation/feedback/negative${rangeQuery(range)}`)
}

/** Turns a rejected answer into a benchmark case on an evaluation dataset. */
export async function promoteFeedback(feedbackId, { datasetId, questionText, groundTruthAnswer }) {
  return request(`/evaluation/feedback/${feedbackId}/promote`, {
    method: 'POST',
    body: JSON.stringify({ datasetId, questionText, groundTruthAnswer }),
  })
}
