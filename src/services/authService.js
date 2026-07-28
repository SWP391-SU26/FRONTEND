import { request } from './httpClient.js'

export const ADMIN_ROLE = 'ADMIN'
export const STUDENT_ROLE = 'STUDENT'

export async function login({ email, password }) {
  const auth = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  })

  return toSession(auth)
}

export async function register(payload) {
  const auth = await request('/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      fullName: payload.fullName,
      email: payload.email,
      password: payload.password,
    }),
  })

  return toSession(auth)
}

export function forgotPassword(email) {
  return request('/auth/forgot-password', {
    method: 'POST',
    body: JSON.stringify({ email }),
  })
}

export function changePassword({ currentPassword, newPassword }) {
  return request('/auth/change-password', {
    method: 'PUT',
    body: JSON.stringify({ currentPassword, newPassword }),
  })
}

export async function logout() {
  const userId = getCurrentUserId()
  if (userId) {
    try {
      return await request(`/auth/logout/${userId}`, { method: 'POST' })
    } catch (error) {
      if (![404, 405].includes(error.status)) throw error
    }
  }

  return request('/auth/logout', { method: 'POST' })
}

export function getUsers() {
  return request('/auth/users')
}

export function getUserRoles(userId) {
  return request(`/auth/users/${userId}/roles`)
}

export function updateUserRole(userId, roleName) {
  return request(`/auth/users/${userId}/role`, {
    method: 'PUT',
    body: JSON.stringify({ roleName }),
  })
}

export function deleteUser(userId) {
  return request(`/auth/users/${userId}`, {
    method: 'DELETE',
  })
}

export function saveSession(session) {
  if (session.accessToken) {
    localStorage.setItem('fstu_access_token', session.accessToken)
  } else {
    localStorage.removeItem('fstu_access_token')
  }
  if (session.refreshToken) {
    localStorage.setItem('fstu_refresh_token', session.refreshToken)
  } else {
    localStorage.removeItem('fstu_refresh_token')
  }
  localStorage.setItem('fstu_user', JSON.stringify(session.user))
}

export function clearSession() {
  localStorage.removeItem('fstu_access_token')
  localStorage.removeItem('fstu_refresh_token')
  localStorage.removeItem('fstu_user')
}

export function getSavedUser() {
  try {
    const user = JSON.parse(localStorage.getItem('fstu_user') ?? 'null')
    return normalizeSavedUser(user)
  } catch {
    clearSession()
    return null
  }
}

export function isAuthenticated() {
  const token = localStorage.getItem('fstu_access_token')
  return Boolean(token && getSavedUser()?.id && !isJwtExpired(token))
}

export function isAdminSession() {
  return hasRole(getSavedUser(), ADMIN_ROLE)
}

export function hasRole(user, roleName) {
  const expected = roleName?.toUpperCase()
  if (![ADMIN_ROLE, STUDENT_ROLE].includes(expected)) return false
  return normalizeRoles(user?.roles ?? (user?.role ? [user.role] : [])).includes(expected)
}

export function getDefaultRouteForUser(user) {
  if (hasRole(user, ADMIN_ROLE)) return '/admin/dashboard'
  return '/workspace'
}

function toSession(auth) {
  const rawUser = auth?.user ?? auth
  const roles = normalizeRoles(auth?.roles ?? rawUser?.roles)
  const primaryRole = roles[0]

  return {
    accessToken: auth?.accessToken ?? auth?.token ?? '',
    refreshToken: auth?.refreshToken ?? '',
    user: {
      id: rawUser?.userId ?? rawUser?.id,
      email: rawUser?.email ?? '',
      name: rawUser?.fullName ?? rawUser?.name ?? 'FStu User',
      role: primaryRole.toLowerCase(),
      roles,
    },
  }
}

export function getCurrentUserId() {
  return getSavedUser()?.id ?? null
}

function isJwtExpired(token) {
  try {
    const [, payload] = token.split('.')
    if (!payload) return false
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/')
    const decoded = JSON.parse(atob(normalized))
    return decoded.exp ? decoded.exp * 1000 <= Date.now() : false
  } catch {
    return true
  }
}

export function normalizeRoles(roles) {
  const rawRoles = Array.isArray(roles) ? roles : (roles ? [roles] : [])
  return [rawRoles.some((role) => String(role).toUpperCase() === ADMIN_ROLE) ? ADMIN_ROLE : STUDENT_ROLE]
}

function normalizeSavedUser(user) {
  if (!user || typeof user !== 'object') return null
  const roles = normalizeRoles(user.roles ?? (user.role ? [user.role] : []))
  return {
    ...user,
    role: roles[0].toLowerCase(),
    roles,
  }
}
