import {
  AlertCircle,
  CheckCircle2,
  ClipboardList,
  Download,
  FileText,
  FlaskConical,
  Loader2,
  Play,
  Plus,
  Square,
  Upload,
  XCircle,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { AdminPageHeader } from '../../layouts/AdminLayout.jsx'
import { Button, EmptyState, Panel, SelectField, StatusBadge } from '../../components/ui.jsx'
import { getDocuments } from '../../services/documentService.js'
import * as evaluationService from '../../services/evaluationService.js'
import { getEmbeddingModels } from '../../services/ragService.js'

export function AdminTestSetPage() {
  const [scopes, setScopes] = useState([])
  const [datasets, setDatasets] = useState([])
  const [documents, setDocuments] = useState([])
  const [experiments, setExperiments] = useState([])
  const [embeddingModels, setEmbeddingModels] = useState([])
  const [questions, setQuestions] = useState([])
  const [selectedSemesterId, setSelectedSemesterId] = useState('')
  const [selectedCourseId, setSelectedCourseId] = useState('')
  const [selectedDatasetId, setSelectedDatasetId] = useState('')
  const [selectedDocumentIds, setSelectedDocumentIds] = useState([])
  const [datasetName, setDatasetName] = useState('')
  const [lastCreatedSnapshot, setLastCreatedSnapshot] = useState(null)
  const [experimentName, setExperimentName] = useState('')
  const [experimentType, setExperimentType] = useState('RAG')
  const [llmModel, setLlmModel] = useState('qwen-rag-lora')
  const [questionText, setQuestionText] = useState('')
  const [groundTruth, setGroundTruth] = useState('')
  const [readiness, setReadiness] = useState(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  useEffect(() => {
    let active = true
    Promise.all([
      evaluationService.getEvaluationScopes(),
      evaluationService.getDatasets(),
      evaluationService.getExperiments(),
      getDocuments(),
      getEmbeddingModels(),
    ]).then(([scopeItems, datasetItems, experimentItems, documentItems, embeddingModelItems]) => {
      if (!active) return
      setScopes(scopeItems)
      setDatasets(datasetItems)
      setExperiments(experimentItems)
      setDocuments(documentItems)
      setEmbeddingModels(embeddingModelItems)
      setSelectedSemesterId(scopeItems[0]?.id ?? '')
      const firstCourseId = scopeItems[0]?.courses?.[0]?.id ?? ''
      setSelectedCourseId(firstCourseId)
      setSelectedDocumentIds(documentItems.filter((document) => document.courseId === firstCourseId
        && ['Indexed', 'Processed'].includes(document.status)).map((document) => document.id))
      setSelectedDatasetId(datasetItems[0]?.id ?? '')
    }).catch((requestError) => active && setError(requestError.message))
      .finally(() => active && setLoading(false))
    return () => { active = false }
  }, [])

  const selectedSemester = useMemo(
    () => scopes.find((semester) => semester.id === selectedSemesterId) ?? null,
    [scopes, selectedSemesterId],
  )
  const courseDocuments = useMemo(
    () => documents.filter((document) => document.courseId === selectedCourseId
      && ['Indexed', 'Processed'].includes(document.status)),
    [documents, selectedCourseId],
  )
  const selectedDataset = datasets.find((dataset) => dataset.id === selectedDatasetId) ?? null
  const bgeModel = embeddingModels.find((model) => model.name?.toLowerCase() === 'baai/bge-m3' && model.isActive)
    ?? embeddingModels.find((model) => model.name?.toLowerCase().includes('bge-m3'))
  const datasetExperiments = experiments.filter((experiment) => experiment.datasetId === selectedDatasetId)
  const snapshotSignature = `${selectedCourseId}|${datasetName.trim()}|${[...selectedDocumentIds].sort().join(',')}`
  const snapshotJustCreated = Boolean(
    lastCreatedSnapshot && lastCreatedSnapshot.signature === snapshotSignature,
  )

  useEffect(() => {
    if (!selectedDatasetId) return undefined
    let active = true
    Promise.all([
      evaluationService.getQuestions(selectedDatasetId),
      evaluationService.getReadiness(selectedDatasetId, experimentType),
    ]).then(([questionItems, readinessResult]) => {
      if (!active) return
      setQuestions(questionItems)
      setReadiness(readinessResult)
    }).catch((requestError) => active && setError(requestError.message))
    return () => { active = false }
  }, [selectedDatasetId, experimentType])

  const runningExperimentIds = useMemo(
    () => experiments.filter((experiment) => ['QUEUED', 'RUNNING'].includes(experiment.status)).map((experiment) => experiment.id).join('|'),
    [experiments],
  )

  useEffect(() => {
    if (!runningExperimentIds) return undefined
    let active = true
    runningExperimentIds.split('|').forEach((experimentId) => {
      evaluationService.waitForExperiment(experimentId, {
        onProgress: (updated) => active && updateExperiment(updated),
      }).then((updated) => {
        if (!active) return
        updateExperiment(updated)
        setNotice(updated.status === 'CANCELLED'
          ? `${updated.name} was cancelled. Completed partial results remain available.`
          : `${updated.name} completed. Results remain available after reload.`)
      }).catch((requestError) => {
        if (!active) return
        if (requestError.experiment) updateExperiment(requestError.experiment)
        setError(requestError.message)
      })
    })
    return () => { active = false }
  // Start one polling chain when the set of queued/running IDs changes.
  }, [runningExperimentIds])

  function updateExperiment(updated) {
    setExperiments((current) => current.map((item) => item.id === updated.id ? updated : item))
  }

  async function submit(action) {
    setSubmitting(true)
    setError('')
    setNotice('')
    try { await action() } catch (requestError) { setError(requestError.message) } finally { setSubmitting(false) }
  }

  async function createDataset(event) {
    event.preventDefault()
    if (!datasetName.trim() || !selectedCourseId || selectedDocumentIds.length === 0) return
    await submit(async () => {
      const created = await evaluationService.createDataset({
        datasetName: datasetName.trim(),
        courseId: selectedCourseId,
        documentIds: selectedDocumentIds,
      })
      setDatasets((current) => [created, ...current])
      setSelectedDatasetId(created.id)
      setLastCreatedSnapshot({ id: created.id, name: created.name, signature: snapshotSignature })
      setNotice(`Dataset snapshot "${created.name}" created successfully.`)
    })
  }

  async function addQuestion(event) {
    event.preventDefault()
    if (!selectedDatasetId || !questionText.trim() || !groundTruth.trim()) return
    await submit(async () => {
      const created = await evaluationService.addQuestion({
        datasetId: selectedDatasetId,
        questionText: questionText.trim(),
        groundTruthAnswer: groundTruth.trim(),
      })
      setQuestions((current) => [...current, created])
      setQuestionText('')
      setGroundTruth('')
      setReadiness(await evaluationService.getReadiness(selectedDatasetId, experimentType))
    })
  }

  async function importQuestions(event) {
    const file = event.target.files?.[0]
    if (!file || !selectedDatasetId) return
    await submit(async () => {
      const result = await evaluationService.importQuestions(selectedDatasetId, file)
      setQuestions(await evaluationService.getQuestions(selectedDatasetId))
      setReadiness(await evaluationService.getReadiness(selectedDatasetId, experimentType))
      setNotice(`${result.importedCount} question(s) imported; ${result.skippedCount} skipped.`)
    })
    event.target.value = ''
  }

  function exportQuestions() {
    if (!selectedDataset || questions.length === 0) return

    const payload = {
      schemaVersion: 1,
      exportedAt: new Date().toISOString(),
      dataset: {
        datasetId: selectedDataset.id,
        datasetName: selectedDataset.name,
        datasetVersion: selectedDataset.version ?? null,
        status: selectedDataset.status,
        courseId: selectedDataset.courseId ?? null,
        documentIds: selectedDataset.documentIds ?? [],
        questionCount: questions.length,
      },
      questions: questions.map((question, index) => ({
        questionNo: question.questionNo ?? index + 1,
        questionText: question.questionText,
        groundTruthAnswer: question.groundTruthAnswer,
        expectedDocumentId: question.expectedDocumentId ?? null,
        expectedPage: question.expectedPage ?? null,
        questionType: question.type ?? null,
        difficulty: question.difficulty ?? null,
      })),
    }
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    const safeName = selectedDataset.name.trim().replace(/[^a-z0-9_-]+/gi, '-').replace(/^-+|-+$/g, '') || 'test-set'
    link.href = url
    link.download = `${safeName}.json`
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
  }

  async function createExperiment(event) {
    event.preventDefault()
    if (!selectedDatasetId || !experimentName.trim() || !llmModel.trim() || !bgeModel) return
    await submit(async () => {
      const created = await evaluationService.createExperiment({
        datasetId: selectedDatasetId,
        experimentName: experimentName.trim(),
        experimentType,
        llmModel: llmModel.trim(),
        embeddingModelId: bgeModel.id,
        chunkingStrategy: 'PARAGRAPH_700_120',
        topK: 5,
        similarityThreshold: 0.25,
        randomSeed: 42,
        configJson: JSON.stringify({ metricStandard: 'OFFICIAL_RAGAS', strict: true }),
      })
      setExperiments((current) => [created, ...current])
      setExperimentName('')
      setNotice(`${created.method} experiment created. Click Run in the Runs panel to start the benchmark.`)
    })
  }

  async function runExperiment(experiment) {
    await submit(async () => {
      const currentReadiness = await evaluationService.getReadiness(selectedDatasetId, experiment.experimentType)
      setExperimentType(experiment.experimentType)
      setReadiness(currentReadiness)
      if (!currentReadiness.ready) throw new Error(currentReadiness.blockers.map((item) => item.message).join(' '))
      const running = await evaluationService.runBenchmark(experiment.id)
      updateExperiment(running)
      setNotice(running.status === 'QUEUED'
        ? 'Benchmark queued. It will start automatically when the GPU is available.'
        : 'Benchmark started in the backend. You can safely leave this page while it runs.')
    })
  }

  async function cancelExperiment(experiment) {
    await submit(async () => {
      const cancelled = await evaluationService.cancelBenchmark(experiment.id)
      updateExperiment(cancelled)
      setNotice(`${cancelled.name} was cancelled. Completed partial results remain available.`)
    })
  }

  if (loading) {
    return <Panel className="flex min-h-52 items-center justify-center gap-3 p-6"><Loader2 className="animate-spin text-primary" />Loading Flow 5…</Panel>
  }

  return (
    <div>
      <AdminPageHeader
        description="Create one immutable Semester → Course → Documents snapshot, then run RAG and Fine-tuned benchmarks separately."
        icon={ClipboardList}
        title="Test Set & Benchmark"
      />
      {error ? <Message tone="error">{error}</Message> : null}
      {notice ? <Message tone="success">{notice}</Message> : null}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(420px,.9fr)]">
        <div className="space-y-4">
          <Panel className="p-5">
            <SectionHeading icon={FileText} title="1. Dataset snapshot" subtitle="Knowledge Base stays internal; select only Semester, Course and processed documents." />
            <form className="mt-5 space-y-4" onSubmit={createDataset}>
              <div className="grid gap-3 md:grid-cols-2">
                <Labeled label="Semester">
                  <SelectField
                    label="Semester"
                    onChange={(event) => {
                      const semesterId = event.target.value
                      const semester = scopes.find((item) => item.id === semesterId)
                      const courseId = semester?.courses?.[0]?.id ?? ''
                      setSelectedSemesterId(semesterId)
                      setSelectedCourseId(courseId)
                      setSelectedDocumentIds(documents.filter((document) => document.courseId === courseId
                        && ['Indexed', 'Processed'].includes(document.status)).map((document) => document.id))
                    }}
                    value={selectedSemesterId}
                  >
                    {scopes.map((semester) => <option key={semester.id} value={semester.id}>{semester.name}</option>)}
                  </SelectField>
                </Labeled>
                <Labeled label="Course">
                  <SelectField label="Course" onChange={(event) => {
                    const courseId = event.target.value
                    setSelectedCourseId(courseId)
                    setSelectedDocumentIds(documents.filter((document) => document.courseId === courseId
                      && ['Indexed', 'Processed'].includes(document.status)).map((document) => document.id))
                  }} value={selectedCourseId}>
                    {(selectedSemester?.courses ?? []).map((course) => (
                      <option key={course.id} value={course.id}>{course.code} · {course.name}</option>
                    ))}
                  </SelectField>
                </Labeled>
              </div>
              <Labeled label="Dataset name">
                <input className="control" onChange={(event) => setDatasetName(event.target.value)} placeholder="Example: SU2026 MLN123 benchmark" value={datasetName} />
              </Labeled>
              <div>
                <p className="mb-2 text-sm font-semibold text-slate-700">Processed documents</p>
                {courseDocuments.length ? (
                  <div className="grid gap-2 sm:grid-cols-2">
                    {courseDocuments.map((document) => (
                      <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-200 bg-white/70 p-3" key={document.id}>
                        <input
                          checked={selectedDocumentIds.includes(document.id)}
                          className="mt-1 accent-teal-700"
                          onChange={() => setSelectedDocumentIds((current) => current.includes(document.id)
                            ? current.filter((id) => id !== document.id)
                            : [...current, document.id])}
                          type="checkbox"
                        />
                        <span className="min-w-0"><span className="block truncate text-sm font-semibold">{document.displayName}</span><span className="text-xs text-slate-500">{document.pages} pages</span></span>
                      </label>
                    ))}
                  </div>
                ) : <p className="rounded-lg border border-dashed border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">This course has no processed documents.</p>}
              </div>
              {snapshotJustCreated ? (
                <div className="flex items-start gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800" role="status">
                  <CheckCircle2 className="mt-0.5 shrink-0" size={17} />
                  <div>
                    <p className="font-black">Snapshot created successfully</p>
                    <p className="mt-1 leading-5">“{lastCreatedSnapshot.name}” is selected below. Continue to Ground truth to add benchmark questions.</p>
                  </div>
                </div>
              ) : null}
              <Button disabled={submitting || !datasetName.trim() || !selectedDocumentIds.length || snapshotJustCreated} type="submit">
                {snapshotJustCreated ? <CheckCircle2 size={16} /> : <Plus size={16} />}
                {snapshotJustCreated ? 'Snapshot created' : 'Create snapshot'}
              </Button>
            </form>
          </Panel>

          <Panel className="p-5">
            <SectionHeading icon={ClipboardList} title="2. Ground truth" subtitle="Questions become read-only after the dataset's first benchmark starts." />
            <div className="mt-4">
              <SelectField label="Dataset" onChange={(event) => setSelectedDatasetId(event.target.value)} value={selectedDatasetId}>
                <option value="">Select dataset</option>
                {datasets.map((dataset) => <option key={dataset.id} value={dataset.id}>{dataset.name} · {dataset.status}</option>)}
              </SelectField>
            </div>
            {selectedDataset?.validationError ? <Message tone="error">{selectedDataset.validationError}</Message> : null}
            <form className="mt-4 grid gap-3" onSubmit={addQuestion}>
              <textarea className="control min-h-20" disabled={selectedDataset?.status === 'FROZEN'} onChange={(event) => setQuestionText(event.target.value)} placeholder="Benchmark question" value={questionText} />
              <textarea className="control min-h-24" disabled={selectedDataset?.status === 'FROZEN'} onChange={(event) => setGroundTruth(event.target.value)} placeholder="Expected answer / ground truth" value={groundTruth} />
              <div className="flex flex-wrap gap-2">
                <Button disabled={submitting || selectedDataset?.status === 'FROZEN'} type="submit"><Plus size={16} />Add question</Button>
                <label className="inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-xl border border-border bg-white/90 px-4 text-sm font-black text-slate-700 hover:text-primary">
                  <Upload size={16} />Import CSV
                  <input accept=".csv,text/csv" className="sr-only" disabled={selectedDataset?.status === 'FROZEN'} onChange={importQuestions} type="file" />
                </label>
                <Button disabled={!selectedDataset || questions.length === 0} onClick={exportQuestions} type="button" variant="secondary">
                  <Download size={16} />Export JSON
                </Button>
              </div>
            </form>
            <div className="mt-4 flex items-center justify-between gap-3 text-xs font-semibold text-slate-500">
              <span>{questions.length} benchmark question{questions.length === 1 ? '' : 's'}</span>
              {questions.length > 4 ? <span>Scroll to view all</span> : null}
            </div>
            <div
              aria-label="Benchmark questions"
              className="mt-2 max-h-[420px] divide-y divide-slate-100 overflow-y-auto overscroll-contain rounded-lg border border-slate-200 bg-white/60"
              data-testid="benchmark-question-list"
              tabIndex={questions.length ? 0 : undefined}
            >
              {questions.map((question, index) => (
                <div className="p-3" key={question.id}><p className="text-sm font-semibold">Q{index + 1}. {question.questionText}</p><p className="mt-1 text-xs leading-5 text-slate-500">{question.groundTruthAnswer}</p></div>
              ))}
              {!questions.length ? <p className="p-4 text-sm text-slate-500">No questions yet.</p> : null}
            </div>
          </Panel>
        </div>

        <div className="space-y-4">
          <Panel className="p-5">
            <SectionHeading icon={CheckCircle2} title="Readiness" subtitle={`Checks for ${experimentType === 'RAG' ? 'strict RAG' : 'Fine-tuned'} benchmark.`} />
            <div className="mt-4 space-y-2">
              {(readiness?.checks ?? []).map((check) => (
                <div className={`flex gap-3 rounded-lg border p-3 text-sm ${check.passed ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-amber-200 bg-amber-50 text-amber-900'}`} key={check.code}>
                  {check.passed ? <CheckCircle2 className="mt-0.5 shrink-0" size={17} /> : <XCircle className="mt-0.5 shrink-0" size={17} />}
                  <span>{check.message}</span>
                </div>
              ))}
              {!selectedDatasetId ? <p className="text-sm text-slate-500">Select a dataset to see blockers.</p> : null}
            </div>
            <p className="mt-3 text-xs leading-5 text-slate-500">Official RAGAS uses gpt-4o-mini as judge and text-embedding-3-small for evaluator embeddings. Context metrics are not applicable to Fine-tuned runs.</p>
          </Panel>

          <Panel className="p-5">
            <SectionHeading icon={FlaskConical} title="3. Create experiment" subtitle="Create saves the configuration. Use Run below to start each benchmark on the same checksum." />
            <form className="mt-4 space-y-3" onSubmit={createExperiment}>
              <div className="grid grid-cols-2 gap-2">
                {['RAG', 'FINE_TUNED'].map((type) => (
                  <button className={`rounded-lg border px-3 py-3 text-sm font-black ${experimentType === type ? 'border-teal-500 bg-teal-50 text-primary' : 'border-slate-200 bg-white/60 text-slate-600'}`} key={type} onClick={() => setExperimentType(type)} type="button">{type === 'RAG' ? 'RAG' : 'Fine-tuned'}</button>
                ))}
              </div>
              <input className="control" onChange={(event) => setExperimentName(event.target.value)} placeholder="Experiment name" value={experimentName} />
              <input className="control" onChange={(event) => setLlmModel(event.target.value)} placeholder="Model name" value={llmModel} />
              <div className="grid grid-cols-2 gap-2 text-xs font-semibold text-slate-600">
                <span className="rounded-lg border border-slate-200 bg-white px-3 py-2">BGE-M3 · Paragraph 700/120</span>
                <span className="rounded-lg border border-slate-200 bg-white px-3 py-2">topK 5 · threshold 0.25 · seed 42</span>
              </div>
              {!bgeModel ? <p className="text-xs font-semibold text-red-700">Không tìm thấy embedding model BAAI/bge-m3 đang hoạt động.</p> : null}
              <Button disabled={submitting || !selectedDatasetId || !experimentName.trim() || !bgeModel} type="submit"><Plus size={16} />Create experiment</Button>
            </form>
          </Panel>

          <Panel className="overflow-hidden">
            <div className="border-b border-slate-200 p-5"><SectionHeading icon={Play} title="Runs" subtitle="Ready to run means the job has not started. Running jobs continue when you navigate away." /></div>
            {datasetExperiments.length ? datasetExperiments.map((experiment) => (
              <div className="border-b border-slate-100 p-4 last:border-0" key={experiment.id}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div><p className="font-black text-slate-950">{experiment.name}</p><p className="text-xs font-semibold text-slate-500">{experiment.method} · {experiment.llmModel}</p></div>
                  <StatusBadge status={statusForBadge(experiment.status)} />
                </div>
                {['QUEUED', 'RUNNING'].includes(experiment.status) ? (
                  <Progress experiment={experiment} fallbackTotal={questions.length} />
                ) : null}
                {experiment.status === 'PENDING' ? <p className="mt-2 text-xs font-semibold text-sky-700">Ready. Click Run to start this benchmark.</p> : null}
                {experiment.status === 'QUEUED' ? <p className="mt-2 text-xs font-semibold text-violet-700">Waiting for the current GPU job to finish.</p> : null}
                {experiment.status === 'CANCELLED' ? <p className="mt-2 text-xs font-semibold text-slate-600">Cancelled at {experiment.progress}%. Create a new experiment to run again.</p> : null}
                {experiment.errorMessage ? <p className="mt-2 text-xs leading-5 text-red-700">{experiment.errorMessage}</p> : null}
                <div className="mt-3 flex items-center justify-between gap-3">
                  <p className="text-xs text-slate-500">{experiment.successCount} succeeded · {experiment.failureCount} failed</p>
                  {['QUEUED', 'RUNNING'].includes(experiment.status) ? (
                    <Button disabled={submitting} onClick={() => cancelExperiment(experiment)} size="sm" variant="danger">
                      <Square size={13} />Cancel run
                    </Button>
                  ) : experiment.status === 'PENDING' ? (
                    <Button
                      disabled={submitting}
                      onClick={() => runExperiment(experiment)}
                      size="sm"
                      variant="primary"
                    >
                      <Play size={14} />Run benchmark
                    </Button>
                  ) : <span className="text-xs font-semibold text-slate-400">Immutable run</span>}
                </div>
              </div>
            )) : <EmptyState title="No experiment" description="Create a RAG or Fine-tuned experiment for the selected dataset." />}
          </Panel>
        </div>
      </div>
    </div>
  )
}

function Labeled({ children, label }) {
  return <label className="block"><span className="mb-1.5 block text-sm font-semibold text-slate-700">{label}</span>{children}</label>
}

function SectionHeading({ icon: Icon, subtitle, title }) {
  return <div className="flex gap-3"><div className="grid size-10 shrink-0 place-items-center rounded-xl bg-teal-50 text-primary"><Icon size={18} /></div><div><h2 className="text-lg font-black">{title}</h2><p className="text-sm leading-6 text-slate-500">{subtitle}</p></div></div>
}

function Message({ children, tone }) {
  const error = tone === 'error'
  return <div className={`my-4 flex items-start gap-2 rounded-lg border p-3 text-sm font-semibold ${error ? 'border-red-200 bg-red-50 text-red-700' : 'border-emerald-200 bg-emerald-50 text-emerald-800'}`}>{error ? <AlertCircle className="mt-0.5 shrink-0" size={17} /> : <CheckCircle2 className="mt-0.5 shrink-0" size={17} />}{children}</div>
}

function Progress({ experiment, fallbackTotal }) {
  const value = experiment.progress
  const processed = experiment.successCount + experiment.failureCount
  const total = Number(experiment.benchmarkProfile?.questionCount ?? fallbackTotal ?? 0)
  const eta = estimateRemainingSeconds(experiment, processed, total)
  const profile = experiment.benchmarkProfile
  return <div className="mt-3">
    <div className="mb-1 flex flex-wrap justify-between gap-2 text-xs font-semibold text-slate-500">
      <span>{experiment.status === 'QUEUED' ? 'Queued for GPU' : `Processed ${processed}/${total || '?'}`}</span>
      <span>{experiment.status === 'RUNNING' && eta != null ? `${value}% · ETA ${formatDuration(eta)}` : `${value}%`}</span>
    </div>
    <div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full bg-primary transition-[width]" style={{ width: `${value}%` }} /></div>
    <p className="mt-2 text-[11px] font-semibold text-slate-500">
      {profile ? `Full ${profile.questionCount} · Batch ${profile.batchSize} · ${profile.maxNewTokens} tokens` : 'Full benchmark · Batch 4 · 64 tokens'}
    </p>
  </div>
}

function statusForBadge(status) {
  if (status === 'COMPLETED') return 'Processed'
  if (status === 'RUNNING') return 'Processing'
  if (status === 'QUEUED') return 'Queued'
  if (status === 'FAILED') return 'Failed'
  if (status === 'CANCELLED') return 'Cancelled'
  return 'Ready to run'
}

function estimateRemainingSeconds(experiment, processed, total) {
  if (experiment.status !== 'RUNNING' || !experiment.startedAt || processed <= 0 || total <= processed) return null
  const elapsedSeconds = Math.max(1, (Date.now() - new Date(experiment.startedAt).getTime()) / 1000)
  return Math.max(0, Math.round((elapsedSeconds / processed) * (total - processed)))
}

function formatDuration(seconds) {
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  const remainder = seconds % 60
  return `${minutes}m ${remainder}s`
}
