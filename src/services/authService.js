const MOCK_DELAY = 700

const accounts = {
  'student@fpt.edu.vn': {
    name: 'FPT Student',
    password: 'Student123',
    role: 'student',
    status: 'active',
  },
  'admin@fpt.edu.vn': {
    name: 'System Admin',
    password: 'Admin123',
    role: 'admin',
    status: 'active',
  },
  'locked@fpt.edu.vn': {
    name: 'Locked Account',
    password: 'Locked123',
    role: 'student',
    status: 'locked',
  },
}

const existingEmails = new Set([
  'student@fpt.edu.vn',
  'admin@fpt.edu.vn',
  'locked@fpt.edu.vn',
  'existing@fpt.edu.vn',
])

function wait(ms = MOCK_DELAY) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms)
  })
}

export async function login({ email, password }) {
  await wait()

  const normalizedEmail = email.trim().toLowerCase()
  const account = accounts[normalizedEmail]

  if (!account) {
    const error = new Error('No account was found for this email.')
    error.code = 'EMAIL_NOT_FOUND'
    throw error
  }

  if (account.status === 'locked') {
    const error = new Error('This account is locked. Please contact support.')
    error.code = 'ACCOUNT_LOCKED'
    throw error
  }

  if (account.password !== password) {
    const error = new Error('Incorrect password. Please try again.')
    error.code = 'INVALID_PASSWORD'
    throw error
  }

  return {
    accessToken: `mock-token-${account.role}-${Date.now()}`,
    user: {
      email: normalizedEmail,
      name: account.name,
      role: account.role,
    },
  }
}

export async function register(payload) {
  await wait()

  const normalizedEmail = payload.email.trim().toLowerCase()

  if (existingEmails.has(normalizedEmail)) {
    const error = new Error('This email is already registered.')
    error.code = 'EMAIL_EXISTS'
    throw error
  }

  return {
    accessToken: `mock-token-student-${Date.now()}`,
    user: {
      email: normalizedEmail,
      name: payload.fullName.trim(),
      role: 'student',
    },
  }
}

export function saveSession(session) {
  localStorage.setItem('fstu_access_token', session.accessToken)
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
  return Boolean(localStorage.getItem('fstu_access_token') && getSavedUser()?.id)
}

