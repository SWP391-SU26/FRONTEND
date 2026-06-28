import { request } from './httpClient.js'

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
      roleName: payload.roleName ?? 'STUDENT',
    }),
  })

  return toSession(auth)
}

export function logout(userId) {
  return request(`/auth/logout/${userId}`, {
    method: 'POST',
  })
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
  const requesterId = getSavedUser()?.id
  const query = requesterId ? `?requesterId=${encodeURIComponent(requesterId)}` : ''
  return request(`/auth/users/${userId}${query}`, {
    method: 'DELETE',
  })
}

export function saveSession(session) {
  if (session.accessToken) {
    localStorage.setItem('fstu_access_token', session.accessToken)
  } else {
    localStorage.removeItem('fstu_access_token')
  }
  localStorage.setItem('fstu_user', JSON.stringify(session.user))
}

export function clearSession() {
  localStorage.removeItem('fstu_access_token')
  localStorage.removeItem('fstu_user')
}

export function getSavedUser() {
  try {
    return JSON.parse(localStorage.getItem('fstu_user') ?? 'null')
  } catch {
    clearSession()
    return null
  }
}

export function isAuthenticated() {
  return Boolean(getSavedUser()?.id)
}

export function isAdminSession() {
  return hasRole(getSavedUser(), 'ADMIN')
}

export function hasRole(user, roleName) {
  const expected = roleName?.toUpperCase()
  return Boolean(user?.roles?.some((role) => role?.toUpperCase() === expected))
}

export function getDefaultRouteForUser(user) {
  return hasRole(user, 'ADMIN') ? '/admin/dashboard' : '/workspace'
}

function toSession(auth) {
  const rawUser = auth?.user ?? auth
  const roles = normalizeRoles(rawUser?.roles)
  const primaryRole = roles[0] ?? 'STUDENT'

  return {
    accessToken: auth?.token ?? auth?.accessToken ?? '',
    user: {
      id: rawUser?.userId ?? rawUser?.id,
      email: rawUser?.email ?? '',
      name: rawUser?.fullName ?? rawUser?.name ?? 'FStu User',
      role: primaryRole.toLowerCase(),
      roles,
    },
  }
}

function normalizeRoles(roles) {
  if (!Array.isArray(roles) || roles.length === 0) return ['STUDENT']
  return roles.map((role) => String(role).toUpperCase())
}
