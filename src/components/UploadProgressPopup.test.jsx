import { render, screen } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import { LocaleProvider } from '../i18n/LocaleContext.jsx'

const uploadMocks = vi.hoisted(() => ({
  clearFinishedUploads: vi.fn(),
  removeUpload: vi.fn(),
  subscribe: vi.fn(),
}))

vi.mock('../services/uploadService.js', () => uploadMocks)

import { UploadProgressPopup } from './UploadProgressPopup.jsx'

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
  uploadMocks.subscribe.mockImplementation((listener) => {
    listener([{
      id: 'delete-1',
      action: 'DELETE',
      name: 'notes.pdf',
      status: 'Deleted',
      stage: 'Completed',
      progress: 100,
      previewKey: 'uploadProgress.documentDeleted',
      isUploading: false,
      createdAt: Date.now(),
    }])
    return () => {}
  })
})

it('shows completed document deletion in Vietnamese', async () => {
  render(<LocaleProvider><UploadProgressPopup /></LocaleProvider>)

  expect(await screen.findByText('Hoạt động tệp đã hoàn tất')).toBeInTheDocument()
  expect(screen.getByText('Đã xóa tài liệu.')).toBeInTheDocument()
  expect(screen.getByText('100%')).toBeInTheDocument()
})

it('uses English copy when the saved locale is English', async () => {
  localStorage.setItem('fstu_locale', 'en')
  render(<LocaleProvider><UploadProgressPopup /></LocaleProvider>)

  expect(await screen.findByText('File activity finished')).toBeInTheDocument()
  expect(screen.getByText('Document deleted.')).toBeInTheDocument()
})
