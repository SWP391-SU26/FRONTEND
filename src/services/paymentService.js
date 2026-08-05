import { request } from './httpClient.js'

export function getPlans() {
  return request('/plans')
}

export function getSubscription() {
  return request('/me/subscription')
}

export function getSubscriptionHistory() {
  return request('/me/subscription-history')
}

export function createVnpayOrder(planCode = 'PRO') {
  return request('/payments/vnpay/orders', {
    method: 'POST',
    body: JSON.stringify({ planCode }),
  })
}

export function getPaymentOrder(orderId) {
  return request(`/payments/orders/${encodeURIComponent(orderId)}`)
}

export function getMyPayments(filters = {}) {
  const query = new URLSearchParams()
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== '' && value !== null && value !== undefined) query.set(key, value)
  })
  const suffix = query.toString()
  return request(`/payments/orders${suffix ? `?${suffix}` : ''}`)
}

export function getAdminPayments(filters = {}) {
  const query = new URLSearchParams()
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== '' && value !== null && value !== undefined) query.set(key, value)
  })
  const suffix = query.toString()
  return request(`/admin/payments${suffix ? `?${suffix}` : ''}`)
}

export function getAdminPayment(orderId) {
  return request(`/admin/payments/${encodeURIComponent(orderId)}`)
}

export function getAdminPlans() {
  return request('/admin/plans')
}

export function createAdminPlan(payload) {
  return request('/admin/plans', { method: 'POST', body: JSON.stringify(payload) })
}

export function updateAdminPlan(planId, payload) {
  return request(`/admin/plans/${encodeURIComponent(planId)}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  })
}

export function deleteAdminPlan(planId) {
  return request(`/admin/plans/${encodeURIComponent(planId)}`, { method: 'DELETE' })
}
