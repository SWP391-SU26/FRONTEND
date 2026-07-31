import fs from 'node:fs'
import path from 'node:path'
import { expect, test } from '@playwright/test'

const futureToken = 'header.eyJleHAiOjQxMDI0NDQ4MDB9.signature'
const personalDocument = {
  documentId: 'personal-1',
  documentTitle: 'Ghi chú cá nhân',
  originalFilename: 'ghi-chu-ca-nhan.pdf',
  fileType: 'PDF',
  processingStatus: 'PROCESSED',
  totalPages: 2,
  fileSizeBytes: 1024,
  documentScope: 'PERSONAL',
  reviewStatus: 'NOT_SUBMITTED',
  uploadedBy: 'student-1',
  uploaderName: 'Nguyễn An',
  uploadedAt: '2026-07-27T10:30:00',
  canDelete: true,
  chunkCount: 3,
}
const courseDocument = {
  documentId: 'course-1-doc',
  courseId: 'course-1',
  documentTitle: 'Kế hoạch dự án',
  originalFilename: 'ke-hoach-du-an.docx',
  fileType: 'DOCX',
  processingStatus: 'PROCESSED',
  totalPages: 4,
  fileSizeBytes: 2048,
  documentScope: 'COURSE',
  reviewStatus: 'APPROVED',
  uploadedBy: 'teacher-1',
  uploaderName: 'Trần Bình',
  uploadedAt: '2026-07-26T09:00:00',
  canDelete: false,
  chunkCount: 5,
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(({ token }) => {
    localStorage.setItem('fstu_access_token', token)
    localStorage.setItem('fstu_user', JSON.stringify({
      id: 'student-1',
      name: 'Nguyễn An',
      email: 'student@example.com',
      roles: ['STUDENT'],
    }))
  }, { token: futureToken })

  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url())
    let data = []
    if (url.pathname.endsWith('/learning-scope')) {
      data = [{
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
      }]
    } else if (url.pathname.endsWith('/documents/mine')) {
      data = [personalDocument]
    } else if (url.pathname.endsWith('/documents')) {
      data = [courseDocument]
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data }),
    })
  })
})

test('Library folder navigation and responsive document views stay usable', async ({ page }) => {
  const consoleErrors = []
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text())
  })

  await page.goto('/library')
  await expect(page.getByRole('heading', { name: 'Kho tài liệu' })).toBeVisible()
  await expect(page.getByRole('button', { name: /Tài liệu của tôi/i })).toBeVisible()
  await expect(page.getByRole('button', { name: /Fall 2026/i })).toBeVisible()
  fs.mkdirSync(path.resolve('output/playwright'), { recursive: true })
  await page.screenshot({ path: 'output/playwright/library-folders.png', fullPage: true })

  await page.getByRole('button', { name: /Fall 2026/i }).click()
  await page.getByRole('button', { name: /SWP391 · Software Project/i }).click()
  await expect(page.getByText('Kế hoạch dự án')).toBeVisible()
  await expect(page.getByText('Trần Bình')).toBeVisible()
  await expect(page.getByText('DOCX')).toHaveClass(/text-blue-700/)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true)

  await page.screenshot({ path: 'output/playwright/library-desktop.png', fullPage: true })

  await page.getByPlaceholder(/Tìm theo tên/).fill('ghi chú cá nhân')
  await expect(page.locator('article').getByText('Ghi chú cá nhân')).toBeVisible()
  await expect(page.getByText('Tài liệu của tôi').last()).toBeVisible()

  await page.setViewportSize({ width: 390, height: 844 })
  await expect(page.getByRole('heading', { name: /Kết quả cho/i })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true)
  await page.screenshot({ path: 'output/playwright/library-mobile.png', fullPage: true })

  expect(consoleErrors).toEqual([])
})
