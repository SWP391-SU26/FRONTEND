import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('./httpClient.js', () => ({ request: vi.fn() }))

import { request } from './httpClient.js'
import {
  createDataset,
  createExperiment,
  getExperiment,
  runBenchmark,
  runBenchmarkPair,
} from './evaluationService.js'

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

  it('sends explicit consent when Admin runs an unverified adapter', async () => {
    request.mockResolvedValue({
      experimentId: 'experiment-1',
      experimentType: 'FINE_TUNED',
      status: 'QUEUED',
    })

    await runBenchmark('experiment-1', { allowUnverifiedModel: true })

    expect(request).toHaveBeenCalledWith('/evaluation/experiments/experiment-1/run', {
      method: 'POST',
      body: JSON.stringify({ allowUnverifiedModel: true }),
    })
  })

  it('starts a paired RAG and Fine-tuned benchmark with one request', async () => {
    request.mockResolvedValue({
      rag: { experimentId: 'rag-1', experimentType: 'RAG', status: 'QUEUED' },
      fineTuned: { experimentId: 'fine-1', experimentType: 'FINE_TUNED', status: 'QUEUED' },
    })

    const pair = await runBenchmarkPair({
      ragExperimentId: 'rag-1',
      fineTunedExperimentId: 'fine-1',
      allowUnverifiedModel: true,
    })

    expect(request).toHaveBeenCalledWith('/evaluation/experiments/run-pair', {
      method: 'POST',
      body: JSON.stringify({
        ragExperimentId: 'rag-1',
        fineTunedExperimentId: 'fine-1',
        allowUnverifiedModel: true,
      }),
    })
    expect(pair.rag.id).toBe('rag-1')
    expect(pair.fineTuned.id).toBe('fine-1')
  })
})
