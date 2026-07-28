import { request } from './httpClient.js'

export async function getAdminDashboardSummary() {
  return request('/admin/dashboard/summary')
}

export async function getAdminDashboardTimeseries(days = 14) {
  return request(`/admin/dashboard/timeseries?days=${encodeURIComponent(days)}`)
}

export async function getAdminDashboardHealth() {
  return request('/admin/dashboard/health')
}
