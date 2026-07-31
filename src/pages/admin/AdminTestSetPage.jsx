import { AlertCircle, CheckCircle2, ClipboardList, Loader2 } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { AdminPageHeader } from '../../layouts/AdminLayout.jsx'
import { Panel } from '../../components/ui.jsx'
import { getDocuments } from '../../services/documentService.js'
import * as evaluationService from '../../services/evaluationService.js'
import {
  BenchmarkConfigurationStep,
  BenchmarkRunsStep,
  BenchmarkStepper,
  DatasetSnapshotStep,
  GroundTruthStep,
  PreflightLaunchStep,
  WorkflowSummary,
} from '../../components/admin/test-set/TestSetWorkflow.jsx'

export function AdminTestSetPage() {
  const questionImportRef = useRef(null)
  const [scopes, setScopes] = useState([])
  const [datasets, setDatasets] = useState([])
  const [documents, setDocuments] = useState([])
  const [experiments, setExperiments] = useState([])
  const [questions, setQuestions] = useState([])
  const [selectedSemesterId, setSelectedSemesterId] = useState('')
  const [selectedCourseId, setSelectedCourseId] = useState('')
  const [selectedDatasetId, setSelectedDatasetId] = useState('')
  const [selectedDocumentIds, setSelectedDocumentIds] = useState([])
  const [selectedExperimentId, setSelectedExperimentId] = useState('')
  const [selectedRagExperimentId, setSelectedRagExperimentId] = useState('')
  const [selectedFineTunedExperimentId, setSelectedFineTunedExperimentId] = useState('')
  const [datasetName, setDatasetName] = useState('')
  const [lastCreatedSnapshot, setLastCreatedSnapshot] = useState(null)
  const [experimentName, setExperimentName] = useState('')
  const [experimentType, setExperimentType] = useState('RAG')
  const [llmModel, setLlmModel] = useState('Qwen/Qwen2.5-1.5B-Instruct')
  const [questionText, setQuestionText] = useState('')
  const [groundTruth, setGroundTruth] = useState('')
  const [readiness, setReadiness] = useState(null)
  const [activeStep, setActiveStep] = useState(1)
  const [loading, setLoading] = useState(true)
  const [loadingReadiness, setLoadingReadiness] = useState(false)
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
    ]).then(([scopeItems, datasetItems, experimentItems, documentItems]) => {
      if (!active) return
      const firstSemesterId = scopeItems[0]?.id ?? ''
      const firstCourseId = scopeItems[0]?.courses?.[0]?.id ?? ''
      setScopes(scopeItems)
      setDatasets(datasetItems)
      setExperiments(experimentItems)
      setDocuments(documentItems)
      setSelectedSemesterId(firstSemesterId)
      setSelectedCourseId(firstCourseId)
      setSelectedDocumentIds(processedDocumentIds(documentItems, firstCourseId))
      setSelectedDatasetId(datasetItems[0]?.id ?? '')
      setLoadingReadiness(Boolean(datasetItems[0]?.id))
      const initialRuns = experimentItems.filter((item) => item.datasetId === datasetItems[0]?.id)
      const firstExperiment = preferredExperiment(initialRuns)
      setSelectedExperimentId(firstExperiment?.id ?? '')
      setSelectedRagExperimentId(preferredExperiment(initialRuns, 'RAG')?.id ?? '')
      setSelectedFineTunedExperimentId(preferredExperiment(initialRuns, 'FINE_TUNED')?.id ?? '')
    }).catch((requestError) => active && setError(requestError.message))
      .finally(() => active && setLoading(false))
    return () => { active = false }
  }, [])

  const selectedSemester = useMemo(() => scopes.find((semester) => semester.id === selectedSemesterId) ?? null, [scopes, selectedSemesterId])
  const selectedDataset = useMemo(() => datasets.find((dataset) => dataset.id === selectedDatasetId) ?? null, [datasets, selectedDatasetId])
  const courseDocuments = useMemo(() => documents.filter((document) => document.courseId === selectedCourseId && isProcessedDocument(document)), [documents, selectedCourseId])
  const datasetExperiments = useMemo(() => experiments.filter((experiment) => experiment.datasetId === selectedDatasetId), [experiments, selectedDatasetId])
  const selectedExperiment = useMemo(() => datasetExperiments.find((experiment) => experiment.id === selectedExperimentId) ?? null, [datasetExperiments, selectedExperimentId])
  const effectiveRagExperimentId = datasetExperiments.some((item) => item.id === selectedRagExperimentId && item.experimentType === 'RAG')
    ? selectedRagExperimentId
    : (preferredExperiment(datasetExperiments, 'RAG')?.id ?? '')
  const effectiveFineTunedExperimentId = datasetExperiments.some((item) => item.id === selectedFineTunedExperimentId && item.experimentType === 'FINE_TUNED')
    ? selectedFineTunedExperimentId
    : (preferredExperiment(datasetExperiments, 'FINE_TUNED')?.id ?? '')
  const snapshotSignature = `${selectedCourseId}|${datasetName.trim()}|${[...selectedDocumentIds].sort().join(',')}`
  const snapshotJustCreated = Boolean(lastCreatedSnapshot && lastCreatedSnapshot.signature === snapshotSignature)
  const readinessType = selectedExperiment?.experimentType ?? experimentType

  useEffect(() => {
    if (!selectedDatasetId) {
      return undefined
    }

    let active = true
    Promise.all([
      evaluationService.getQuestions(selectedDatasetId),
      evaluationService.getReadiness(selectedDatasetId, readinessType),
    ]).then(([questionItems, readinessResult]) => {
      if (!active) return
      setQuestions(questionItems)
      setReadiness(readinessResult)
    }).catch((requestError) => active && setError(requestError.message))
      .finally(() => active && setLoadingReadiness(false))
    return () => { active = false }
  }, [selectedDatasetId, readinessType])

  const runningExperimentIds = useMemo(() => experiments.filter((experiment) => (
    ['QUEUED', 'RUNNING'].includes(experiment.status)
    || (experiment.status === 'COMPLETED' && ['PENDING', 'RUNNING'].includes(experiment.ragasStatus))
  )).map((experiment) => experiment.id).join('|'), [experiments])

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
  }, [runningExperimentIds])

  const stepState = useMemo(() => {
    const hasConfiguration = datasetExperiments.length > 0
    const hasLaunchedRun = datasetExperiments.some((experiment) => experiment.status !== 'PENDING')
    return {
      1: selectedDataset ? 'complete' : 'pending',
      2: questions.length > 0 ? 'complete' : 'pending',
      3: hasConfiguration ? 'complete' : 'pending',
      4: hasLaunchedRun ? 'complete' : 'pending',
      5: hasLaunchedRun ? 'complete' : 'pending',
    }
  }, [datasetExperiments, questions.length, selectedDataset])

  const availableStep = !selectedDataset
    ? 1
    : questions.length === 0
      ? 2
      : datasetExperiments.length === 0
        ? 3
        : 5

  function updateExperiment(updated) {
    setExperiments((current) => current.map((item) => item.id === updated.id ? updated : item))
  }

  function selectDataset(datasetId) {
    setSelectedDatasetId(datasetId)
    setLoadingReadiness(Boolean(datasetId))
    const nextRuns = experiments.filter((item) => item.datasetId === datasetId)
    const nextExperiment = preferredExperiment(nextRuns)
    setSelectedExperimentId(nextExperiment?.id ?? '')
    setSelectedRagExperimentId(preferredExperiment(nextRuns, 'RAG')?.id ?? '')
    setSelectedFineTunedExperimentId(preferredExperiment(nextRuns, 'FINE_TUNED')?.id ?? '')
    if (!datasetId) {
      setQuestions([])
      setReadiness(null)
    }
    setLastCreatedSnapshot(null)
  }

  function selectSemester(semesterId) {
    const semester = scopes.find((item) => item.id === semesterId)
    const courseId = semester?.courses?.[0]?.id ?? ''
    setSelectedSemesterId(semesterId)
    selectCourse(courseId)
  }

  function selectCourse(courseId) {
    setSelectedCourseId(courseId)
    setSelectedDocumentIds(processedDocumentIds(documents, courseId))
    setLastCreatedSnapshot(null)
  }

  function toggleDocument(documentId) {
    setSelectedDocumentIds((current) => current.includes(documentId) ? current.filter((id) => id !== documentId) : [...current, documentId])
    setLastCreatedSnapshot(null)
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
      const created = await evaluationService.createDataset({ datasetName: datasetName.trim(), courseId: selectedCourseId, documentIds: selectedDocumentIds })
      setDatasets((current) => [created, ...current])
      setSelectedDatasetId(created.id)
      setSelectedExperimentId('')
      setLastCreatedSnapshot({ id: created.id, name: created.name, signature: snapshotSignature })
      setNotice(`Dataset snapshot "${created.name}" created successfully.`)
      setActiveStep(2)
    })
  }

  async function addQuestion(event) {
    event.preventDefault()
    if (!selectedDatasetId || !questionText.trim() || !groundTruth.trim()) return
    await submit(async () => {
      const created = await evaluationService.addQuestion({ datasetId: selectedDatasetId, questionText: questionText.trim(), groundTruthAnswer: groundTruth.trim() })
      setQuestions((current) => [...current, created])
      setQuestionText('')
      setGroundTruth('')
      setReadiness(await evaluationService.getReadiness(selectedDatasetId, readinessType))
    })
  }

  async function importQuestions(event) {
    const file = event.target.files?.[0]
    if (!file || !selectedDatasetId) return
    await submit(async () => {
      const result = await evaluationService.importQuestions(selectedDatasetId, file)
      setQuestions(await evaluationService.getQuestions(selectedDatasetId))
      setReadiness(await evaluationService.getReadiness(selectedDatasetId, readinessType))
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
    if (!selectedDatasetId || !experimentName.trim() || !llmModel.trim()) return
    await submit(async () => {
      const created = await evaluationService.createExperiment({
        datasetId: selectedDatasetId,
        experimentName: experimentName.trim(),
        experimentType,
        llmModel: llmModel.trim(),
        configJson: JSON.stringify({ metrics: 'local-proxy', strict: true }),
      })
      setExperiments((current) => [created, ...current])
      setSelectedExperimentId(created.id)
      setExperimentName('')
      setNotice(`${created.method} configuration saved. Review readiness before launching it.`)
      setActiveStep(4)
    })
  }

  function selectExperiment(experiment) {
    setSelectedExperimentId(experiment.id)
    setExperimentType(experiment.experimentType)
    setLoadingReadiness(Boolean(selectedDatasetId))
  }

  async function runExperiment(experiment) {
    await submit(async () => {
      const currentReadiness = await evaluationService.getReadiness(selectedDatasetId, experiment.experimentType)
      setReadiness(currentReadiness)
      const needsAcknowledgement = Boolean(currentReadiness.requiresUnverifiedAcknowledgement)
      if (!currentReadiness.ready && !currentReadiness.benchmarkReady) {
        throw new Error(currentReadiness.blockers.map((item) => item.message).join(' '))
      }
      const running = await evaluationService.runBenchmark(experiment.id, {
        allowUnverifiedModel: needsAcknowledgement,
      })
      updateExperiment(running)
      setSelectedExperimentId(running.id)
      setNotice(running.status === 'QUEUED'
        ? `Benchmark queued${needsAcknowledgement ? ' as RESEARCH ONLY / UNVERIFIED' : ''}. It will start automatically when the GPU is available.`
        : 'Benchmark started in the backend. You can safely leave this page while it runs.')
      setActiveStep(5)
    })
  }

  async function runExperimentPair() {
    if (!effectiveRagExperimentId || !effectiveFineTunedExperimentId) return
    await submit(async () => {
      const fineReadiness = await evaluationService.getReadiness(selectedDatasetId, 'FINE_TUNED')
      const running = await evaluationService.runBenchmarkPair({
        ragExperimentId: effectiveRagExperimentId,
        fineTunedExperimentId: effectiveFineTunedExperimentId,
        allowUnverifiedModel: Boolean(fineReadiness.requiresUnverifiedAcknowledgement),
      })
      updateExperiment(running.rag)
      updateExperiment(running.fineTuned)
      setNotice('Đã xếp hàng chạy song song RAG và Fine-tuned. GPU sẽ xử lý các batch xen kẽ, RAGAS chấm nền sau khi local hoàn tất.')
      setActiveStep(5)
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
    return <Panel className="flex min-h-52 items-center justify-center gap-3 p-6"><Loader2 className="animate-spin text-primary" />Loading benchmark workflow...</Panel>
  }

  const activeStepContent = {
    1: <DatasetSnapshotStep courseDocuments={courseDocuments} datasetName={datasetName} datasets={datasets} onCourseChange={selectCourse} onDatasetNameChange={(value) => { setDatasetName(value); setLastCreatedSnapshot(null) }} onDatasetSelect={selectDataset} onDocumentToggle={toggleDocument} onSemesterChange={selectSemester} onSubmit={createDataset} scopes={scopes} selectedCourseId={selectedCourseId} selectedDataset={selectedDataset} selectedDatasetId={selectedDatasetId} selectedDocumentIds={selectedDocumentIds} selectedSemester={selectedSemester} selectedSemesterId={selectedSemesterId} snapshotJustCreated={snapshotJustCreated} submitting={submitting} />,
    2: <GroundTruthStep importInputRef={questionImportRef} onAddQuestion={addQuestion} onExport={exportQuestions} onGroundTruthChange={setGroundTruth} onImport={importQuestions} onPrevious={() => setActiveStep(1)} onQuestionTextChange={setQuestionText} groundTruth={groundTruth} questionText={questionText} questions={questions} selectedDataset={selectedDataset} submitting={submitting} />,
    3: <BenchmarkConfigurationStep datasetExperiments={datasetExperiments} experimentName={experimentName} experimentType={experimentType} llmModel={llmModel} onExperimentNameChange={setExperimentName} onExperimentTypeChange={(type) => { setExperimentType(type); if (selectedDatasetId) setLoadingReadiness(true) }} onModelChange={setLlmModel} onPrevious={() => setActiveStep(2)} onSelectExperiment={selectExperiment} onSubmit={createExperiment} questions={questions} selectedDataset={selectedDataset} selectedExperimentId={selectedExperimentId} submitting={submitting} />,
    4: <PreflightLaunchStep loadingReadiness={loadingReadiness} onPrevious={() => setActiveStep(3)} onRun={() => runExperiment(selectedExperiment)} onViewRuns={() => setActiveStep(5)} questions={questions} readiness={readiness} selectedDataset={selectedDataset} selectedExperiment={selectedExperiment} submitting={submitting} />,
    5: <BenchmarkRunsStep datasetExperiments={datasetExperiments} onCancel={cancelExperiment} onCreateAnother={() => setActiveStep(3)} onFineTunedExperimentChange={setSelectedFineTunedExperimentId} onRagExperimentChange={setSelectedRagExperimentId} onRerun={runExperiment} onRunPair={runExperimentPair} questions={questions} selectedExperimentId={selectedExperimentId} selectedFineTunedExperimentId={effectiveFineTunedExperimentId} selectedRagExperimentId={effectiveRagExperimentId} submitting={submitting} />,
  }

  return (
    <div>
      <AdminPageHeader description="Build an immutable document snapshot, define ground truth, and compare RAG with Fine-tuned runs through one guided benchmark workflow." icon={ClipboardList} title="Test Set and Benchmark" />
      {error ? <PageMessage tone="error">{error}</PageMessage> : null}
      {notice ? <PageMessage tone="success">{notice}</PageMessage> : null}
      <BenchmarkStepper activeStep={activeStep} availableStep={availableStep} onStepChange={setActiveStep} stepState={stepState} />
      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-w-0">{activeStepContent[activeStep]}</div>
        <WorkflowSummary dataset={selectedDataset} experiment={selectedExperiment} questions={questions} stepState={stepState} />
      </div>
    </div>
  )
}

function PageMessage({ children, tone }) {
  const error = tone === 'error'
  return <div aria-live="polite" className={`mb-4 flex items-start gap-3 rounded-xl border p-4 text-sm font-semibold leading-6 ${error ? 'border-red-200 bg-red-50 text-red-800' : 'border-emerald-200 bg-emerald-50 text-emerald-800'}`} role={error ? 'alert' : 'status'}>{error ? <AlertCircle className="mt-0.5 shrink-0" size={17} /> : <CheckCircle2 className="mt-0.5 shrink-0" size={17} />}<div>{children}</div></div>
}

function isProcessedDocument(document) {
  return ['Indexed', 'Processed'].includes(document.status)
}

function processedDocumentIds(documents, courseId) {
  return documents.filter((document) => document.courseId === courseId && isProcessedDocument(document)).map((document) => document.id)
}

function preferredExperiment(experiments, type) {
  const candidates = type
    ? experiments.filter((experiment) => experiment.experimentType === type)
    : experiments
  const priority = (experiment) => {
    if (['RUNNING', 'QUEUED'].includes(experiment.status)) return 0
    if (experiment.status === 'COMPLETED' && ['RUNNING', 'PENDING'].includes(experiment.ragasStatus)) return 1
    if (experiment.status === 'PENDING') return 2
    return 3
  }
  return [...candidates].sort((left, right) => {
    const statusDifference = priority(left) - priority(right)
    if (statusDifference) return statusDifference
    return new Date(right.updatedAt ?? right.createdAt ?? 0) - new Date(left.updatedAt ?? left.createdAt ?? 0)
  })[0] ?? null
}
