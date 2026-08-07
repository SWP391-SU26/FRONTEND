import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'

vi.mock('../services/workspaceService.js', () => ({
  createPersonalWorkspace: vi.fn().mockResolvedValue({ id: 'workspace-2' }),
  deletePersonalWorkspace: vi.fn(),
  getPersonalWorkspaces: vi.fn().mockResolvedValue([{
    id: 'workspace-1',
    title: 'Tài liệu cá nhân',
    description: '',
  }]),
  getStorageUsage: vi.fn().mockResolvedValue({
    usedBytes: 3 * 1024 * 1024,
    maxStorageBytes: 100 * 1024 * 1024,
    documentCount: 1,
    maxDocuments: 10,
    maxFileBytes: 10 * 1024 * 1024,
    workspaceCount: 1,
    maxPersonalWorkspaces: 5,
  }),
  renamePersonalWorkspace: vi.fn(),
}))

import { createPersonalWorkspace } from '../services/workspaceService.js'
import { PersonalWorkspacePanel } from './PersonalWorkspacePanel.jsx'

beforeEach(() => vi.clearAllMocks())

it('shows the FREE workspace allowance and lets the student create a topic workspace', async () => {
  const onOpenWorkspace = vi.fn()
  render(<PersonalWorkspacePanel documentCounts={{ 'workspace-1': 1 }} onOpenWorkspace={onOpenWorkspace} />)

  expect((await screen.findAllByText('1 / 5 workspace')).length).toBeGreaterThan(0)
  fireEvent.click(screen.getByRole('button', { name: /workspace Tài liệu cá nhân/i }))
  expect(onOpenWorkspace).toHaveBeenCalledWith(expect.objectContaining({ id: 'workspace-1' }))
  const createButton = screen.getByRole('button', { name: /^Tạo workspace/ })
  expect(createButton).toBeEnabled()

  fireEvent.click(createButton)
  fireEvent.change(screen.getByLabelText('Tên workspace'), { target: { value: 'Triết học' } })
  fireEvent.change(screen.getByLabelText('Mô tả chủ đề (không bắt buộc)'), { target: { value: 'Tài liệu học kỳ' } })
  fireEvent.click(screen.getByRole('button', { name: 'Lưu' }))

  await waitFor(() => expect(createPersonalWorkspace).toHaveBeenCalledWith({
    workspaceTitle: 'Triết học',
    description: 'Tài liệu học kỳ',
  }))
})
