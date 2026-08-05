import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import {
  createAdminPlan, deleteAdminPlan, getAdminPlans, updateAdminPlan,
} from '../../services/paymentService.js'

vi.mock('../../layouts/AdminLayout.jsx', () => ({
  AdminPageHeader: ({ actions, title }) => <header><h1>{title}</h1>{actions}</header>,
}))
vi.mock('../../services/paymentService.js', () => ({
  createAdminPlan: vi.fn(), deleteAdminPlan: vi.fn(), getAdminPlans: vi.fn(), updateAdminPlan: vi.fn(),
}))

import AdminPlansPage from './AdminPlansPage.jsx'

const proPlan = {
  planId: 'plan-pro', planCode: 'PRO', displayName: 'PRO', priceVnd: 49000, durationDays: 30,
  maxFileBytes: 10 * 1024 * 1024, maxDocuments: 50, maxStorageBytes: 500 * 1024 * 1024,
  maxPersonalWorkspaces: 10, benefits: ['50 documents'], isActive: true,
}

beforeEach(() => {
  vi.clearAllMocks()
  getAdminPlans.mockResolvedValue([proPlan])
  createAdminPlan.mockResolvedValue({})
  updateAdminPlan.mockResolvedValue({})
  deleteAdminPlan.mockResolvedValue({ deleted: false, deactivated: true, message: 'Plan deactivated.' })
})

it('lists plans and opens the edit form', async () => {
  render(<AdminPlansPage />)
  expect(await screen.findByRole('button', { name: 'Edit PRO' })).toBeInTheDocument()

  fireEvent.click(screen.getByRole('button', { name: 'Edit PRO' }))

  expect(screen.getByRole('heading', { name: 'Edit PRO' })).toBeInTheDocument()
  expect(screen.getByDisplayValue('500')).toBeInTheDocument()
})

it('creates a plan and converts megabytes to bytes', async () => {
  render(<AdminPlansPage />)
  await screen.findByRole('button', { name: 'Edit PRO' })
  fireEvent.click(screen.getByRole('button', { name: 'New plan' }))

  const inputs = screen.getAllByRole('textbox')
  fireEvent.change(inputs[0], { target: { value: 'PLUS' } })
  fireEvent.change(inputs[1], { target: { value: 'Plus' } })
  fireEvent.change(screen.getByLabelText(/Price/), { target: { value: '99000' } })
  fireEvent.change(screen.getByLabelText(/Duration/), { target: { value: '60' } })
  fireEvent.click(screen.getByRole('button', { name: 'Create plan' }))

  await waitFor(() => expect(createAdminPlan).toHaveBeenCalled())
  expect(createAdminPlan.mock.calls[0][0]).toMatchObject({
    planCode: 'PLUS', priceVnd: 99000, durationDays: 60,
    maxFileBytes: 10 * 1024 * 1024, maxStorageBytes: 100 * 1024 * 1024,
  })
})

it('deactivates a referenced plan through delete', async () => {
  render(<AdminPlansPage />)
  await screen.findByRole('button', { name: 'Edit PRO' })
  fireEvent.click(screen.getByRole('button', { name: 'Delete PRO' }))
  fireEvent.click(screen.getByRole('button', { name: 'Delete plan' }))

  await waitFor(() => expect(deleteAdminPlan).toHaveBeenCalledWith('plan-pro'))
  expect(await screen.findByText('Plan deactivated.')).toBeInTheDocument()
})
