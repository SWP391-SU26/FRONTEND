import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('./httpClient.js', () => ({ request: vi.fn() }))

import { request } from './httpClient.js'
import { createDataset, createExperiment, getExperiment } from './evaluationService.js'

describe('Flow 5 evaluation API contract', () => {
  beforeEach(() => request.mockReset())

  it('creates a dataset without workspace or client user identifiers', async () => {
    request.mockResolvedValue({ datasetId: 'dataset-1', datasetName: 'Snapshot' })

    await createDataset({
      datasetName: 'Snapshot',
      courseId: 'course-1',
      documentIds: ['document-1', 'document-2'],
      workspaceId: 'must-not-be-sent',
      createdBy: 'must-not-be-sent',
    })

    const [, options] = request.mock.calls[0]
    expect(JSON.parse(options.body)).toEqual({
      datasetName: 'Snapshot',
      courseId: 'course-1',
      documentIds: ['document-1', 'document-2'],
    })
  })

  it('creates an experiment without trusting createdBy', async () => {
    request.mockResolvedValue({ experimentId: 'experiment-1', experimentType: 'FINE_TUNED' })

    await createExperiment({
      datasetId: 'dataset-1',
      experimentName: 'Fine run',
      experimentType: 'FINE_TUNED',
      llmModel: 'qwen-rag-lora',
      configJson: '{}',
      createdBy: 'must-not-be-sent',
    })

    expect(JSON.parse(request.mock.calls[0][1].body)).not.toHaveProperty('createdBy')
  })

  it('polls one experiment through the dedicated endpoint', async () => {
    request.mockResolvedValue({
      experimentId: 'experiment-1',
      status: 'RUNNING',
      progress: 40,
      configJson: JSON.stringify({
        benchmarkProfile: { questionCount: 50, batchSize: 4, maxInputTokens: 448, maxNewTokens: 64 },
      }),
    })

    const experiment = await getExperiment('experiment-1')

    expect(request).toHaveBeenCalledWith('/evaluation/experiments/experiment-1')
    expect(experiment.progress).toBe(40)
    expect(experiment.benchmarkProfile).toEqual({
      questionCount: 50, batchSize: 4, maxInputTokens: 448, maxNewTokens: 64,
    })
  })
})
