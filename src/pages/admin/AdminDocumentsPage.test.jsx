import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, expect, it, vi } from 'vitest'

vi.mock('../../services/documentService.js', () => ({
  getDocumentPreviewUrl: vi.fn((document) => `https://files.example/${document.id}`),
  getDocuments: vi.fn(),
  reindexDocument: vi.fn(),
  waitForIndexingJob: vi.fn(),
}))

vi.mock('../../services/courseService.js', () => ({
  getChapters: vi.fn(),
  getCourses: vi.fn(),
  getSemesterWorkspaces: vi.fn(),
}))

vi.mock('../../services/ragService.js', () => ({
  getActiveEmbeddingModel: vi.fn(),
}))

vi.mock('../../services/uploadService.js', () => ({
  deleteFile: vi.fn(),
  uploadFiles: vi.fn(),
}))

import * as courseService from '../../services/courseService.js'
import * as documentService from '../../services/documentService.js'
import * as ragService from '../../services/ragService.js'
import { AdminDocumentsPage } from './AdminPages.jsx'

const documents = [
  {
    id: 'doc-ready',
    name: 'rag-architecture.pdf',
    displayName: 'RAG architecture',
    type: 'PDF',
    fileSizeBytes: 1024 * 512,
    courseId: 'course-1',
    chapterId: 'chapter-1',
    status: 'Indexed',
    embeddingStatus: 'Prepared',
    embeddingModel: 'bge-m3',
    chunks: 24,
    embeddedChunks: 24,
    pages: 12,
    uploadedAt: 'Jul 28, 2026',
    uploaderName: 'System Admin',
    canDelete: true,
  },
  {
    id: 'doc-pending',
    name: 'chunking-notes.pdf',
    displayName: 'Chunking notes',
    type: 'PDF',
    fileSizeBytes: 1024,
    courseId: 'course-1',
    status: 'Processed',
    embeddingStatus: 'Processed',
    embeddingModel: 'Not indexed',
    chunks: 4,
    pages: 3,
    uploadedAt: 'Jul 27, 2026',
    canDelete: true,
  },
]

beforeEach(() => {
  vi.clearAllMocks()
  documentService.getDocuments.mockResolvedValue(documents)
  courseService.getCourses.mockResolvedValue([
    { id: 'course-1', code: 'SWP391', name: 'Software Project', semesterWorkspaceId: 'semester-1' },
  ])
  courseService.getSemesterWorkspaces.mockResolvedValue([{ id: 'semester-1', name: 'Fall 2026' }])
  courseService.getChapters.mockResolvedValue([{ id: 'chapter-1', courseId: 'course-1', orderIndex: 1, title: 'RAG foundations' }])
  ragService.getActiveEmbeddingModel.mockResolvedValue({ embeddingModelId: 'model-1', name: 'bge-m3' })
})

function renderPage() {
  return render(<MemoryRouter><AdminDocumentsPage /></MemoryRouter>)
}

it('shows processing state and learning context without duplicate retrieval columns', async () => {
  renderPage()

  expect(await screen.findByText('RAG architecture')).toBeInTheDocument()
  expect(screen.getByText('Chapter 1: RAG foundations')).toBeInTheDocument()
  expect(screen.getAllByText('Indexed')).not.toHaveLength(0)
  expect(screen.queryByText('Not prepared')).not.toBeInTheDocument()
  expect(screen.queryByText('Text extracted and chunks created')).not.toBeInTheDocument()
  expect(screen.getByText('Active model: bge-m3')).toBeInTheDocument()
})

it('searches materials by chapter and can clear active filters', async () => {
  renderPage()

  const search = await screen.findByRole('textbox', { name: 'Search document' })
  fireEvent.change(search, { target: { value: 'foundations' } })

  expect(screen.getByText('RAG architecture')).toBeInTheDocument()
  expect(screen.queryByText('Chunking notes')).not.toBeInTheDocument()

  fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }))
  await waitFor(() => expect(search).toHaveValue(''))
  expect(screen.getByText('Chunking notes')).toBeInTheDocument()
})

it('opens a course-and-chapter upload flow without changing the API contract', async () => {
  renderPage()

  fireEvent.click(await screen.findByRole('button', { name: 'Upload material' }))

  expect(screen.getByRole('heading', { name: 'Upload materials' })).toBeInTheDocument()
  const course = screen.getByLabelText('Destination course')
  fireEvent.change(course, { target: { value: 'course-1' } })

  expect(screen.getByLabelText('Chapter')).toBeEnabled()
  expect(screen.getByRole('button', { name: 'Upload' })).toBeDisabled()
})
