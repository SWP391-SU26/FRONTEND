import { afterEach, describe, expect, it } from 'vitest'
import {
  ADMIN_ROLE,
  STUDENT_ROLE,
  clearSession,
  getDefaultRouteForUser,
  getSavedUser,
  hasRole,
  normalizeRoles,
} from './authService.js'

afterEach(() => clearSession())

describe('frontend role canonicalization', () => {
  it('keeps administrator access when any backend role is ADMIN', () => {
    expect(normalizeRoles(['STUDENT', 'ADMIN', 'RESEARCHER'])).toEqual([ADMIN_ROLE])
    expect(getDefaultRouteForUser({ roles: ['TEACHER', 'ADMIN'] })).toBe('/admin/dashboard')
  })

  it('maps every non-admin legacy role to Student', () => {
    expect(normalizeRoles(['RESEARCHER'])).toEqual([STUDENT_ROLE])
    expect(normalizeRoles(['TEACHER'])).toEqual([STUDENT_ROLE])
    expect(normalizeRoles(['USER'])).toEqual([STUDENT_ROLE])
    expect(hasRole({ roles: ['RESEARCHER'] }, 'RESEARCHER')).toBe(false)
    expect(getDefaultRouteForUser({ roles: ['RESEARCHER'] })).toBe('/workspace')
  })

  it('normalizes a legacy saved session before route checks and display', () => {
    localStorage.setItem('fstu_user', JSON.stringify({
      id: 'legacy-user',
      name: 'Legacy researcher',
      role: 'researcher',
      roles: ['RESEARCHER'],
    }))

    expect(getSavedUser()).toMatchObject({
      id: 'legacy-user',
      role: 'student',
      roles: [STUDENT_ROLE],
    })
  })
})
