import { expect, test } from '@playwright/test'

const futureToken = 'header.eyJleHAiOjQxMDI0NDQ4MDB9.signature'

test.beforeEach(async ({ page }) => {
  await page.addInitScript(({ token }) => {
    localStorage.setItem('fstu_access_token', token)
    localStorage.setItem('fstu_user', JSON.stringify({
      id: 'researcher-1', name: 'Researcher', email: 'researcher@example.com', roles: ['RESEARCHER'],
    }))
  }, { token: futureToken })

  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url())
    const path = url.pathname
    let data = []
    if (path.endsWith('/evaluation/scopes')) data = [{ semesterId: 'semester-1', semesterName: 'Fall 2026', status: 'ACTIVE', courses: [{ courseId: 'course-1', courseCode: 'SWP391', courseName: 'Software Project', status: 'DRAFT', processedDocumentCount: 1 }] }]
    else if (path.endsWith('/evaluation/datasets')) data = [{ datasetId: 'dataset-1', datasetName: 'Snapshot', status: 'FROZEN', checksum: 'same-checksum', documentIds: ['doc-1'] }]
    else if (path.endsWith('/evaluation/experiments')) data = [
      { experimentId: 'rag-1', datasetId: 'dataset-1', experimentName: 'RAG run', experimentType: 'RAG', status: 'COMPLETED', datasetChecksum: 'same-checksum', successCount: 1 },
      { experimentId: 'fine-1', datasetId: 'dataset-1', experimentName: 'Fine run', experimentType: 'FINE_TUNED', status: 'COMPLETED', datasetChecksum: 'same-checksum', successCount: 1 },
    ]
    else if (path.includes('/evaluation/datasets/dataset-1/questions')) data = [{ evaluationQuestionId: 'q-1', questionText: 'What is RAG?', groundTruthAnswer: 'Retrieval augmented generation.' }]
    else if (path.endsWith('/evaluation/readiness')) data = { ready: true, checks: [{ code: 'model', passed: true, message: 'Strict RAG generation is ready.' }], blockers: [] }
    else if (path.endsWith('/evaluation/comparison')) data = {
      datasetId: 'dataset-1', datasetChecksum: 'same-checksum',
      dataset: { datasetId: 'dataset-1', name: 'Snapshot', questionCount: 50, documentCount: 1 },
      metricStandard: 'LOCAL_PROXY', formulaVersion: 'token-overlap-v1',
      benchmarkProfile: { version: 'full-batch-v1', batchSize: 4, maxInputTokens: 448, maxNewTokens: 64 },
      ragExperiment: { name: 'RAG run', status: 'COMPLETED', answerCorrectness: 0.41, answerRelevance: 0.41, semanticSimilarity: 0.41, latencyMs: 5100, successCount: 50, failureCount: 0, faithfulness: 0.78, contextPrecision: 0.82, contextRecall: 0.64 },
      fineTunedExperiment: { name: 'Fine run', status: 'COMPLETED', answerCorrectness: 0.56, answerRelevance: 0.56, semanticSimilarity: 0.56, latencyMs: 2900, successCount: 50, failureCount: 0 },
      perQuestion: Array.from({ length: 50 }, (_, index) => {
        const ragScore = ((index % 8) + 1) / 10
        const fineScore = ((index % 6) + 2) / 10
        return { questionId: `q-${index + 1}`, question: index === 0 ? 'What is RAG?' : `Benchmark question ${index + 1}`, groundTruth: 'Retrieval augmented generation.', ragAnswer: 'RAG answer', fineTunedAnswer: 'Fine answer', ragAnswerCorrectness: ragScore, fineTunedAnswerCorrectness: fineScore, answerCorrectnessDelta: fineScore - ragScore, ragLatencyMs: 5100, fineTunedLatencyMs: 2900, ragCitations: [{ title: 'Lecture, page 1' }] }
      }),
    }
    else if (path.endsWith('/documents')) data = [{ documentId: 'doc-1', courseId: 'course-1', documentTitle: 'Lecture', originalFilename: 'lecture.pdf', processingStatus: 'PROCESSED', totalPages: 12, chunkCount: 1 }]
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data }) })
  })
})

test('researcher can inspect readiness and compare same-checksum runs after reload', async ({ page }) => {
  await page.goto('/admin/test-set')
  await expect(page.getByRole('heading', { name: 'Test Set & Benchmark' })).toBeVisible()
  await expect(page.getByText('Strict RAG generation is ready.')).toBeVisible()

  await page.goto('/admin/research-dashboard')
  await expect(page.getByRole('heading', { name: 'Báo cáo nghiên cứu RBL' })).toBeVisible()
  await expect(page.getByText('Kết luận thực nghiệm')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'RAGAS-style benchmark' })).toBeVisible()
  await expect(page.getByText('Không áp dụng').first()).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Kết quả trực quan trên cùng dataset snapshot' })).toBeVisible()
  await expect(page.locator('.research-chart svg').first()).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true)
  await page.getByText('What is RAG?').click()
  await expect(page.getByText('Retrieval augmented generation.')).toBeVisible()
  await page.reload()
  await expect(page.getByText('same-checksum')).toBeVisible()

  await page.setViewportSize({ width: 390, height: 844 })
  await expect(page.getByRole('heading', { name: 'Kết quả trực quan trên cùng dataset snapshot' })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true)

  await page.emulateMedia({ media: 'print' })
  await expect(page.locator('.report-controls')).toBeHidden()
  await expect(page.locator('.research-chart').first()).toBeVisible()
})
