import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, expect, it, vi } from 'vitest'

vi.mock('../services/authService.js', () => ({
  clearSession: vi.fn(),
  getCurrentUserId: vi.fn(() => 'user-1'),
  getSavedUser: vi.fn(() => ({ id: 'user-1', fullName: 'Nguyễn An', roles: ['STUDENT'] })),
  isAdminSession: vi.fn(() => false),
  logout: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('../services/chatService.js', () => ({
  deleteSession: vi.fn(),
  getSessions: vi.fn().mockResolvedValue([]),
  pinSession: vi.fn(),
  renameSession: vi.fn(),
}))

vi.mock('../services/courseService.js', () => ({
  getLearningScope: vi.fn().mockResolvedValue([{
    semesterId: 'semester-1',
    semesterName: 'Fall 2026',
    status: 'ACTIVE',
    courses: [{
      courseId: 'course-1',
      courseCode: 'SWP391',
      courseName: 'Software Project',
      status: 'PUBLISHED',
      documentCount: 1,
      processedDocumentCount: 1,
    }],
  }]),
}))

vi.mock('../services/workspaceService.js', () => ({
  createPersonalWorkspace: vi.fn(),
  deletePersonalWorkspace: vi.fn(),
  getPersonalWorkspaces: vi.fn().mockResolvedValue([
    { id: 'workspace-1', title: 'Tài liệu cá nhân', description: 'Ghi chú riêng' },
    { id: 'workspace-2', title: 'Toán', description: 'Bài tập Toán' },
  ]),
  getStorageUsage: vi.fn().mockResolvedValue({
    usedBytes: 1024,
    maxStorageBytes: 100 * 1024 * 1024,
    documentCount: 1,
    maxDocuments: 10,
    maxFileBytes: 10 * 1024 * 1024,
    workspaceCount: 2,
    maxPersonalWorkspaces: 5,
  }),
  moveDocumentToWorkspace: vi.fn(),
  renamePersonalWorkspace: vi.fn(),
}))

vi.mock('../services/documentService.js', () => ({
  getMyDocuments: vi.fn().mockResolvedValue([{
    id: 'personal-1',
    displayName: 'Ghi chú cá nhân.pdf',
    type: 'PDF',
    status: 'Processed',
    documentScope: 'PERSONAL',
    workspaceId: 'workspace-1',
    reviewStatus: 'NOT_SUBMITTED',
    uploadedBy: 'user-1',
    uploaderName: 'Nguyễn An',
    uploadedAt: '27/07/2026',
    uploadedAtTimestamp: 10,
    fileSizeBytes: 1024,
    pages: 2,
    canDelete: true,
  }]),
  getDocuments: vi.fn().mockResolvedValue([{
    id: 'course-doc-1',
    displayName: 'Kế hoạch dự án.docx',
    type: 'DOCX',
    status: 'Processed',
    documentScope: 'COURSE',
    reviewStatus: 'APPROVED',
    courseId: 'course-1',
    uploadedBy: 'teacher-1',
    uploaderName: 'Trần Bình',
    uploadedAt: '26/07/2026',
    uploadedAtTimestamp: 20,
    fileSizeBytes: 2048,
    pages: 4,
    canDelete: false,
  }]),
  uploadPersonalDocument: vi.fn(),
  submitDocument: vi.fn(),
  cancelDocumentSubmission: vi.fn(),
  deleteDocument: vi.fn(),
}))

import LibraryPage from './LibraryPage.jsx'

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
})

function renderPage(initialEntry = '/library') {
  return render(<MemoryRouter initialEntries={[initialEntry]}><LibraryPage /></MemoryRouter>)
}

it('navigates through Semester and Course folders and shows uploader metadata', async () => {
  renderPage()

  expect((await screen.findByRole('button', { name: /Fall 2026/i })).textContent).toContain('FStu')
  fireEvent.click(await screen.findByRole('button', { name: /Fall 2026/i }))
  expect((await screen.findByRole('button', { name: /SWP391 · Software Project/i })).textContent).toContain('FStu')
  fireEvent.click(await screen.findByRole('button', { name: /SWP391 · Software Project/i }))

  expect(await screen.findByText('Kế hoạch dự án.docx')).toBeInTheDocument()
  expect(screen.getByText('Trần Bình')).toBeInTheDocument()
  expect(screen.getByText('26/07/2026')).toBeInTheDocument()
  expect(screen.getByText('DOCX')).toHaveClass('text-blue-700')
})

it('keeps unapproved owned documents in the personal folder and labels the owner as Bạn', async () => {
  renderPage('/library?folder=personal&workspace=workspace-1')

  expect(await screen.findByText('Ghi chú cá nhân.pdf')).toBeInTheDocument()
  expect(screen.getByText('Bạn')).toBeInTheDocument()
  expect(screen.getByText('PDF')).toHaveClass('text-red-700')
  expect(screen.getByLabelText('Thao tác với Ghi chú cá nhân.pdf')).toBeInTheDocument()
})

it('searches across folders and displays the document breadcrumb', async () => {
  renderPage()
  await screen.findByRole('button', { name: /Fall 2026/i })

  fireEvent.change(screen.getByPlaceholderText(/Tìm theo tên/i), {
    target: { value: 'software project' },
  })

  expect(await screen.findByText('Kế hoạch dự án.docx')).toBeInTheDocument()
  expect(screen.getByText('Fall 2026 / SWP391 · Software Project')).toBeInTheDocument()
})

it('persists the selected list view', async () => {
  renderPage('/library?folder=personal&workspace=workspace-1')
  await screen.findByText('Ghi chú cá nhân.pdf')

  fireEvent.click(screen.getByRole('button', { name: 'Dạng danh sách' }))

  await waitFor(() => expect(localStorage.getItem('fstu.library.view')).toBe('list'))
  expect(screen.getByRole('columnheader', { name: 'Ngày đăng' })).toBeInTheDocument()
})

it('shows each personal workspace as a folder and reveals only its documents when opened', async () => {
  renderPage('/library?folder=personal')

  const personalFolder = await screen.findByRole('button', { name: /workspace Tài liệu cá nhân/i })
  expect(screen.getByRole('button', { name: /workspace Toán/i })).toBeInTheDocument()
  expect(screen.queryByText('Ghi chú cá nhân.pdf')).not.toBeInTheDocument()

  fireEvent.click(personalFolder)

  expect(await screen.findByText('Ghi chú cá nhân.pdf')).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: 'Tài liệu cá nhân' })).toBeInTheDocument()
})
