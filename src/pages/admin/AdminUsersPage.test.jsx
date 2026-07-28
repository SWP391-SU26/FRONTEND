import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, expect, it, vi } from 'vitest'

vi.mock('../../services/authService.js', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    deleteUser: vi.fn(),
    getSavedUser: vi.fn(),
    getUsers: vi.fn(),
    updateUserRole: vi.fn(),
  }
})

import * as authService from '../../services/authService.js'
import { AdminUsersPage } from './AdminPages.jsx'

const users = [
  { id: 'admin-1', fullName: 'System Admin', email: 'admin@fstu.edu.vn', roles: ['ADMIN'], isActive: true },
  { id: 'legacy-1', fullName: 'Legacy Teacher', email: 'teacher@fstu.edu.vn', roles: ['TEACHER'], isActive: true },
  { userId: 'student-1', fullName: 'Student One', email: 'student@fstu.edu.vn', roles: ['STUDENT'], isActive: false },
]

beforeEach(() => {
  vi.clearAllMocks()
  authService.getSavedUser.mockReturnValue({ id: 'admin-1', name: 'System Admin', roles: ['ADMIN'] })
  authService.getUsers.mockResolvedValue(users)
  authService.updateUserRole.mockResolvedValue({})
  authService.deleteUser.mockResolvedValue({})
})

function renderPage() {
  return render(<MemoryRouter><AdminUsersPage /></MemoryRouter>)
}

it('maps a legacy backend role to Student in the roster and offers explicit normalization', async () => {
  renderPage()

  const [legacyRole] = await screen.findAllByRole('button', { name: 'Role for Legacy Teacher' })
  expect(legacyRole).toHaveTextContent('Student')
  expect(screen.getAllByText('Active')).not.toHaveLength(0)
  expect(screen.getAllByText('Inactive')).not.toHaveLength(0)
  expect(screen.queryByText('Indexed')).not.toBeInTheDocument()

  fireEvent.click(screen.getByRole('button', { name: 'Normalize 1' }))
  const dialog = screen.getByRole('dialog', { name: 'Normalize legacy roles?' })
  fireEvent.click(within(dialog).getByRole('button', { name: 'Normalize roles' }))

  await waitFor(() => expect(authService.updateUserRole).toHaveBeenCalledWith('legacy-1', 'STUDENT'))
  expect(await screen.findByText('Normalized 1 legacy role to Admin or Student.')).toBeInTheDocument()
})

it('uses an id fallback for deletion and protects the signed-in administrator', async () => {
  renderPage()

  const [currentRole] = await screen.findAllByRole('button', { name: 'Role for System Admin' })
  fireEvent.click(currentRole)
  fireEvent.click(screen.getByRole('menuitemradio', { name: 'Student' }))
  expect(await screen.findByText('You cannot remove administrator access from your own account.')).toBeInTheDocument()

  fireEvent.click(screen.getAllByRole('button', { name: 'Delete user' })[0])
  const dialog = screen.getByRole('dialog', { name: 'Delete user?' })
  fireEvent.click(within(dialog).getByRole('button', { name: 'Delete user' }))

  await waitFor(() => expect(authService.deleteUser).toHaveBeenCalledWith('legacy-1'))
})

it('opens the role filter as an accessible menu and applies Student filtering', async () => {
  renderPage()

  const filter = await screen.findByRole('button', { name: 'Role filter' })
  fireEvent.click(filter)
  expect(screen.getByRole('menu')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('menuitemradio', { name: 'Student' }))

  expect(screen.queryByText('System Admin')).not.toBeInTheDocument()
  expect(screen.getAllByText('Legacy Teacher')).not.toHaveLength(0)
  expect(screen.getByRole('button', { name: 'Role filter' })).toHaveTextContent('Student')
})
