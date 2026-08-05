import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, expect, it, vi } from 'vitest'
import { getMyPayments, getSubscription } from '../services/paymentService.js'

vi.mock('../components/StudentShell.jsx', () => ({ default: ({ children }) => <div>{children}</div> }))
vi.mock('../i18n/LocaleContext.jsx', () => ({ useLocale: () => ({ locale: 'en' }) }))
vi.mock('../services/paymentService.js', () => ({ getMyPayments: vi.fn(), getSubscription: vi.fn() }))

import PaymentsPage from './PaymentsPage.jsx'

beforeEach(() => {
  vi.clearAllMocks()
  getSubscription.mockResolvedValue({ status: 'PRO_ACTIVE', effectivePlanCode: 'PRO', expiresAt: '2026-09-04T19:11:00' })
  getMyPayments.mockResolvedValue({
    items: [{
      orderId: 'order-1', txnRef: 'PRO-20260805-abc', planCode: 'PRO', amountVnd: 49000,
      durationDays: 30, status: 'PAID', createdAt: '2026-08-05T19:10:00', paidAt: '2026-08-05T19:11:00',
      activatedAt: '2026-08-05T19:11:01', expiresAt: '2026-08-05T19:25:00', gatewayTransactionNo: '15647608', bankCode: 'NCB',
    }],
    page: 0, totalPages: 1, totalElements: 1,
  })
})

it('shows the current subscription and owned payment orders', async () => {
  render(<MemoryRouter><PaymentsPage /></MemoryRouter>)

  expect(await screen.findByText('PRO-20260805-abc')).toBeInTheDocument()
  expect(screen.getAllByText('PRO').length).toBeGreaterThan(0)
  expect(screen.getByText('₫49,000')).toBeInTheDocument()
  expect(screen.getAllByText('PAID').length).toBeGreaterThan(1)
})

it('requests a filtered first page when status changes', async () => {
  render(<MemoryRouter><PaymentsPage /></MemoryRouter>)
  await screen.findByText('PRO-20260805-abc')

  fireEvent.change(screen.getByRole('combobox'), { target: { value: 'PAID' } })

  await waitFor(() => expect(getMyPayments).toHaveBeenLastCalledWith({ status: 'PAID', page: 0, size: 10 }))
})

it('opens a payment detail drawer without exposing callback payloads', async () => {
  render(<MemoryRouter><PaymentsPage /></MemoryRouter>)
  await screen.findByText('PRO-20260805-abc')

  fireEvent.click(screen.getByRole('button', { name: 'Payment detail: PRO-20260805-abc' }))

  expect(screen.getByText('30 days')).toBeInTheDocument()
  expect(screen.getAllByText('15647608')).toHaveLength(2)
  expect(screen.queryByText(/SecureHash/i)).not.toBeInTheDocument()
})
