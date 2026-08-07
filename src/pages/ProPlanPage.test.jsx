import { render, screen } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import {
  createVnpayOrder, getPlans, getSubscription, getSubscriptionHistory,
} from '../services/paymentService.js'

vi.mock('../components/StudentShell.jsx', () => ({ default: ({ children }) => <div>{children}</div> }))
vi.mock('../i18n/LocaleContext.jsx', () => ({ useLocale: () => ({ locale: 'en' }) }))
vi.mock('../services/paymentService.js', () => ({
  createVnpayOrder: vi.fn(), getPlans: vi.fn(), getSubscription: vi.fn(), getSubscriptionHistory: vi.fn(),
}))

import ProPlanPage from './ProPlanPage.jsx'

const plans = [
  { planId: 'free', planCode: 'FREE', displayName: 'FREE', priceVnd: 0, durationDays: null, maxFileBytes: 10e6, maxDocuments: 10, maxStorageBytes: 100e6, maxPersonalWorkspaces: 1 },
  { planId: 'pro', planCode: 'PRO', displayName: 'PRO', priceVnd: 49000, durationDays: 30, maxFileBytes: 10e6, maxDocuments: 50, maxStorageBytes: 500e6, maxPersonalWorkspaces: 10 },
  { planId: 'promax', planCode: 'PROMAX', displayName: 'PROMAX', priceVnd: 99000, durationDays: 30, maxFileBytes: 20e6, maxDocuments: 100, maxStorageBytes: 1e9, maxPersonalWorkspaces: 20 },
]

beforeEach(() => {
  vi.clearAllMocks()
  getPlans.mockResolvedValue(plans)
  getSubscriptionHistory.mockResolvedValue([])
  createVnpayOrder.mockResolvedValue({ paymentUrl: 'https://sandbox.vnpayment.vn/test' })
})

it('disables every paid plan while the current paid plan is active', async () => {
  getSubscription.mockResolvedValue({
    status: 'PRO_ACTIVE', effectivePlanCode: 'PRO', expiresAt: '2099-09-04T19:11:00',
  })

  render(<ProPlanPage />)

  expect(await screen.findByText('A paid plan is still active')).toBeInTheDocument()
  const lockedButtons = screen.getAllByRole('button', { name: /Available after/i })
  expect(lockedButtons).toHaveLength(2)
  lockedButtons.forEach((button) => expect(button).toBeDisabled())
  expect(createVnpayOrder).not.toHaveBeenCalled()
})

it('enables all paid plans after the previous plan has expired', async () => {
  getSubscription.mockResolvedValue({
    status: 'PRO_EXPIRED', effectivePlanCode: 'FREE', expiresAt: '2020-09-04T19:11:00',
  })

  render(<ProPlanPage />)

  expect(await screen.findByRole('button', { name: 'Choose PRO' })).toBeEnabled()
  expect(screen.getByRole('button', { name: 'Choose PROMAX' })).toBeEnabled()
  expect(screen.queryByText('A paid plan is still active')).not.toBeInTheDocument()
})
