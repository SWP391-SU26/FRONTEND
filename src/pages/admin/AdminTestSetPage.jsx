import { AnimatePresence, motion } from 'framer-motion'
import {
  BarChart3,
  Brain,
  ClipboardList,
  Download,
  FileText,
  FlaskConical,
  Loader2,
  Play,
  Plus,
  RefreshCcw,
  X,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Button,
  EmptyState,
  IconButton,
  Panel,
  SelectField,
  StatusBadge,
} from '../../components/ui.jsx'
import { AdminPageHeader } from '../../layouts/AdminLayout.jsx'
import * as courseService from '../../services/courseService.js'
import { getDocumentsByWorkspace } from '../../services/documentService.js'
import * as evalService from '../../services/evaluationService.js'
import { getEmbeddingModels } from '../../services/ragService.js'

const allOption = 'All'

export function AdminTestSetPage() {
  const navigate = useNavigate()
  const [datasets, setDatasets] = useState([])
  const [selectedDatasetId, setSelectedDatasetId] = useState('')
  const [questions, setQuestions] = useState([])
  const [courses, setCourses] = useState([])
  const [workspaces, setWorkspaces] = useState([])
  const [experiments, setExperiments] = useState([])
  const [fineTuningFiles, setFineTuningFiles] = useState([])
  const [embeddingModels, setEmbeddingModels] = useState([])
  const [corpusDocuments, setCorpusDocuments] = useState([])

  const [difficulty, setDifficulty] = useState(allOption)
  const [showAdd, setShowAdd] = useState(false)
  const [showCreateDataset, setShowCreateDataset] = useState(false)
  const [showExperiment, setShowExperiment] = useState(false)
  const [showFineTuning, setShowFineTuning] = useState(false)
  const [loading, setLoading] = useState(true)
  const [loadingQuestions, setLoadingQuestions] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [runningExperimentId, setRunningExperimentId] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [completedExperimentId, setCompletedExperimentId] = useState('')

  const [newQuestionText, setNewQuestionText] = useState('')
  const [newGroundTruth, setNewGroundTruth] = useState('')
  const [newDatasetName, setNewDatasetName] = useState('')
  const [selectedCourseId, setSelectedCourseId] = useState('')
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState('')
  const [experimentName, setExperimentName] = useState('')
  const [experimentType, setExperimentType] = useState('RAG')
  const [experimentLlmModel, setExperimentLlmModel] = useState('java-rag')
  const [experimentEmbeddingModelId, setExperimentEmbeddingModelId] = useState('')
  const [chunkingStrategy, setChunkingStrategy] = useState('PARAGRAPH_700_120')
  const [generationMode, setGenerationMode] = useState('RAG_BASE')
  const [topK, setTopK] = useState('5')
  const [temperature, setTemperature] = useState('0.2')
  const [seed, setSeed] = useState('42')
  const [experimentConfig, setExperimentConfig] = useState('')
  const [fineTuningName, setFineTuningName] = useState('')
  const [fineTuningModel, setFineTuningModel] = useState('')
  const [fineTuningConfig, setFineTuningConfig] = useState('')

  useEffect(() => {
    let active = true

    async function loadInitialData() {
      setLoading(true)
      setError('')
      try {
        const [datasetList, courseList, workspaceList, experimentList, fileList, modelList] = await Promise.all([
          evalService.getDatasets(),
          courseService.getCourses(),
          courseService.getWorkspaces(),
          evalService.getExperiments(),
          evalService.getFineTuningFiles().catch(() => []),
          getEmbeddingModels(),
        ])

        if (!active) return
        setDatasets(datasetList)
        setCourses(courseList)
        setWorkspaces(workspaceList)
        setExperiments(experimentList)
        setFineTuningFiles(fileList)
        setEmbeddingModels(modelList)
        setExperimentEmbeddingModelId((current) => current || modelList.find((model) => model.isActive)?.id || '')
        setSelectedDatasetId((current) => current || datasetList[0]?.id || '')
        setSelectedCourseId((current) => current || courseList[0]?.id || '')
        setSelectedWorkspaceId((current) => {
          if (current) return current
          const firstCourseId = courseList[0]?.id
          return workspaceList.find((workspace) => workspace.courseId === firstCourseId)?.id || workspaceList[0]?.id || ''
        })
      } catch (requestError) {
        if (active) setError(requestError.message)
      } finally {
        if (active) setLoading(false)
      }
    }

    loadInitialData()
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    if (!selectedWorkspaceId) {
      queueMicrotask(() => setCorpusDocuments([]))
      return undefined
    }
    let active = true
    getDocumentsByWorkspace(selectedWorkspaceId)
      .then((documents) => active && setCorpusDocuments(documents.filter((document) => document.status === 'Indexed')))
      .catch((requestError) => active && setError(requestError.message))
    return () => { active = false }
  }, [selectedWorkspaceId])

  useEffect(() => {
    if (!selectedDatasetId) {
      queueMicrotask(() => setQuestions([]))
      return undefined
    }

    let active = true
    queueMicrotask(() => {
      setLoadingQuestions(true)
      setError('')
    })
    evalService.getQuestions(selectedDatasetId)
      .then((questionList) => active && setQuestions(questionList))
      .catch((requestError) => active && setError(requestError.message))
      .finally(() => active && setLoadingQuestions(false))

    return () => {
      active = false
    }
  }, [selectedDatasetId])

  const selectedDataset = useMemo(
    () => datasets.find((dataset) => dataset.id === selectedDatasetId) || null,
    [datasets, selectedDatasetId],
  )
  const workspaceOptions = useMemo(
    () => workspaces.filter((workspace) => !selectedCourseId || workspace.courseId === selectedCourseId),
    [selectedCourseId, workspaces],
  )

  const visibleQuestions = selectedDatasetId ? questions : []
  const filteredQuestions = visibleQuestions.filter((item) => (
    difficulty === allOption ||
    item.difficulty === difficulty ||
    !item.difficulty
  ))
  const selectedDatasetExperiments = experiments.filter((experiment) => experiment.datasetId === selectedDatasetId)
  const selectedDatasetHasWorkspace = Boolean(selectedDataset?.workspaceId)
  const canRunSelectedDatasetBenchmark = Boolean(selectedDatasetId && selectedDatasetHasWorkspace && questions.length > 0)

  async function handleAddQuestion(event) {
    event.preventDefault()
    if (!selectedDatasetId || !newQuestionText.trim() || !newGroundTruth.trim()) return

    await submitAction(async () => {
      const question = await evalService.addQuestion({
        datasetId: selectedDatasetId,
        questionText: newQuestionText.trim(),
        groundTruthAnswer: newGroundTruth.trim(),
      })
      setQuestions((current) => [question, ...current])
      setNewQuestionText('')
      setNewGroundTruth('')
      setShowAdd(false)
      setNotice('Question created from the backend API.')
    })
  }

  async function handleCreateDataset(event) {
    event.preventDefault()
    if (!newDatasetName.trim() || !selectedCourseId || !selectedWorkspaceId) {
      setError(!selectedWorkspaceId ? 'Select a workspace before creating a dataset.' : 'Complete the required dataset fields.')
      return
    }
    await submitAction(async () => {
      const created = await evalService.createDataset({
        datasetName: newDatasetName.trim(),
        courseId: selectedCourseId,
        workspaceId: selectedWorkspaceId,
        documentIds: corpusDocuments.map((document) => document.id),
      })
      setDatasets((current) => [created, ...current])
      setSelectedDatasetId(created.id)
      setNewDatasetName('')
      setShowCreateDataset(false)
      setNotice('Dataset created from the backend API.')
    })
  }

  async function handleCreateExperiment(event) {
    event.preventDefault()
    if (!selectedDatasetId || !experimentName.trim() || !experimentLlmModel.trim()) return

    const configJson = buildExperimentConfigJson()
    if (!configJson) return

    await submitAction(async () => {
      const created = await evalService.createExperiment({
        datasetId: selectedDatasetId,
        experimentName: experimentName.trim(),
        experimentType,
        llmModel: experimentLlmModel.trim(),
        configJson,
      })
      setExperiments((current) => [created, ...current])
      setExperimentName('')
      setExperimentType('RAG')
      setExperimentLlmModel('java-rag')
      setExperimentConfig('')
      setShowExperiment(false)
      setNotice('Experiment record created from the backend API.')
    })
  }

  async function handleCreateFineTuningRecord(event) {
    event.preventDefault()
    if (!selectedDatasetId || !fineTuningName.trim() || !fineTuningModel.trim()) return
    const configJson = normalizeJsonInput(fineTuningConfig)
    if (!configJson) return

    await submitAction(async () => {
      const created = await evalService.createFineTuningRecord({
        name: fineTuningName.trim(),
        datasetId: selectedDatasetId,
        llmModel: fineTuningModel.trim(),
        configJson,
      })
      setExperiments((current) => [created, ...current])
      setFineTuningName('')
      setFineTuningModel('')
      setFineTuningConfig('')
      setShowFineTuning(false)
      setNotice('Fine-tuning experiment record created from the backend API.')
    })
  }

  async function handleRunBenchmark(experimentId) {
    if (!experimentId || !canRunSelectedDatasetBenchmark) {
      setError(runDisabledReason())
      return
    }
    setRunningExperimentId(experimentId)
    setCompletedExperimentId('')
    setError('')
    setNotice('')
    setExperiments((current) => current.map((item) => (
      item.id === experimentId ? { ...item, status: 'RUNNING' } : item
    )))

    try {
      const updated = await evalService.runBenchmark(experimentId)
      if (updated) {
        setExperiments((current) => current.map((item) => (
          item.id === updated.id ? updated : item
        )))
      }
      setNotice('Benchmark completed and results are ready for the Research Dashboard.')
      setCompletedExperimentId(updated?.id || experimentId)
      const refreshed = await evalService.getExperiments()
      setExperiments(refreshed)
    } catch (requestError) {
      setError(requestError.message)
      const refreshed = await evalService.getExperiments().catch(() => null)
      if (refreshed) setExperiments(refreshed)
    } finally {
      setRunningExperimentId('')
    }
  }

  async function handleExportJsonl() {
    if (!selectedDatasetId) return

    await submitAction(async () => {
      const blob = await evalService.exportJsonl(selectedDatasetId)
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `dataset_${selectedDatasetId}_train.jsonl`
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
      setNotice('JSONL export downloaded from the backend API.')
      const fileList = await evalService.getFineTuningFiles().catch(() => fineTuningFiles)
      setFineTuningFiles(fileList)
    })
  }

  async function refreshFineTuningFiles() {
    await submitAction(async () => {
      const fileList = await evalService.getFineTuningFiles()
      setFineTuningFiles(fileList)
      setNotice('Fine-tuning file list refreshed from the backend API.')
    })
  }

  async function handleImportCsv(event) {
    const file = event.target.files?.[0]
    if (!file || !selectedDatasetId) return
    await submitAction(async () => {
      const summary = await evalService.importQuestions(selectedDatasetId, file)
      const refreshed = await evalService.getQuestions(selectedDatasetId)
      setQuestions(refreshed)
      setNotice(`Imported ${summary.importedCount ?? refreshed.length} valid questions. Dataset checksum: ${summary.checksum ?? 'pending'}.`)
    })
    event.target.value = ''
  }

  async function submitAction(action) {
    setSubmitting(true)
    setError('')
    setNotice('')
    try {
      await action()
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setSubmitting(false)
    }
  }

  function normalizeJsonInput(value) {
    const nextValue = value.trim() || '{}'
    try {
      JSON.parse(nextValue)
      return nextValue
    } catch {
      setError('Config JSON must be valid JSON.')
      return ''
    }
  }

  function handleCourseChange(courseId) {
    setSelectedCourseId(courseId)
    const nextWorkspaces = workspaces.filter((workspace) => !courseId || workspace.courseId === courseId)
    setSelectedWorkspaceId((current) => (
      nextWorkspaces.some((workspace) => workspace.id === current) ? current : nextWorkspaces[0]?.id || ''
    ))
  }

  function buildExperimentConfigJson() {
    const baseValue = experimentConfig.trim() || '{}'
    try {
      const config = JSON.parse(baseValue)
      if (experimentEmbeddingModelId) config.embeddingModelId = experimentEmbeddingModelId
      if (chunkingStrategy) config.chunkingStrategy = chunkingStrategy
      if (generationMode) config.generationMode = generationMode
      if (topK !== '') config.topK = Number(topK)
      if (temperature !== '') config.temperature = Number(temperature)
      if (seed !== '') config.seed = Number(seed)
      return JSON.stringify(config)
    } catch {
      setError('Config JSON must be valid JSON.')
      return ''
    }
  }

  function runDisabledReason() {
    if (!selectedDatasetId) return 'Select a dataset before running a benchmark.'
    if (!selectedDatasetHasWorkspace) return 'Cannot run benchmark because the selected dataset has no workspace.'
    if (questions.length === 0) return 'Cannot run benchmark because dataset has no questions.'
    return 'Benchmark cannot be started for this experiment.'
  }

  function openResearchDashboard(experimentId) {
    navigate(`/admin/research-dashboard?experimentId=${encodeURIComponent(experimentId)}`)
  }

  function renderQuestionSection() {
    if (loadingQuestions) return <Loading label="Loading questions" />

    if (!filteredQuestions.length) {
      return (
        <EmptyState
          action={<Button disabled={!selectedDatasetId} onClick={() => setShowAdd(true)}><Plus size={16} />Add question</Button>}
          description="No ground-truth questions were returned for this dataset."
          title="No questions"
        />
      )
    }

    return (
      <DataTable
        columns={['Order', 'Question', 'Difficulty', 'Type', 'Expected page', 'Ground truth']}
        rows={filteredQuestions.map((item, index) => [
          item.questionNo || index + 1,
          <span className="block max-w-xl whitespace-pre-wrap" key="question">{item.question}</span>,
          item.difficulty || 'MEDIUM',
          item.type || 'FACTUAL',
          item.expectedPage ?? 'Not set',
          <span className="block max-w-xl whitespace-pre-wrap" key="ground-truth">
            {item.groundTruth}
          </span>,
        ])}
      />
    )
  }

  return (
    <CrudPage
      actions={
        <>
          <Button onClick={() => setShowCreateDataset(true)} variant="secondary">
            <Plus size={16} />
            Create dataset
          </Button>
          <Button disabled={!selectedDatasetId} onClick={() => setShowAdd(true)}>
            <Plus size={16} />
            Add question
          </Button>
          <label className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-black text-slate-700 transition hover:border-teal-300 hover:text-teal-700">
            <FileText size={16} />
            Import CSV
            <input accept=".csv,text/csv" className="hidden" disabled={!selectedDatasetId || submitting} onChange={handleImportCsv} type="file" />
          </label>
          <Button disabled={!selectedDatasetId} onClick={() => setShowExperiment(true)} variant="accent">
            <FlaskConical size={16} />
            Create experiment
          </Button>
          <Button disabled={!selectedDatasetId} onClick={() => setShowFineTuning(true)} variant="secondary">
            <Brain size={16} />
            Fine-tuning record
          </Button>
          <Button disabled={!selectedDatasetId || submitting} onClick={handleExportJsonl} variant="secondary">
            <Download size={16} />
            Export JSONL
          </Button>
        </>
      }
      description="Create datasets, manage ground truth, export JSONL, and create experiment records from live backend APIs."
      icon={ClipboardList}
      title="Test Set / Ground Truth"
    >
      {error ? <Alert message={error} /> : null}
      {notice ? (
        <Notice
          action={completedExperimentId ? (
            <Button onClick={() => openResearchDashboard(completedExperimentId)} size="sm">
              <BarChart3 size={14} />
              Open Research Dashboard
            </Button>
          ) : null}
          message={notice}
        />
      ) : null}

      {loading ? <Loading label="Loading Workflow 5 data" /> : (
        <div className="space-y-5">
          <Toolbar>
            <SelectField
              label="Select dataset"
              onChange={(event) => setSelectedDatasetId(event.target.value)}
              value={selectedDatasetId}
            >
              <option value="">Select dataset</option>
              {datasets.map((dataset) => (
                <option key={dataset.id} value={dataset.id}>
                  {dataset.name} {dataset.version ? `(${dataset.version})` : ''}
                </option>
              ))}
            </SelectField>

            <SelectField
              label="Difficulty"
              onChange={(event) => setDifficulty(event.target.value)}
              value={difficulty}
            >
              {[allOption, 'EASY', 'MEDIUM', 'HARD'].map((item) => (
                <option key={item}>{item}</option>
              ))}
            </SelectField>
          </Toolbar>

          {renderQuestionSection()}

          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
            <Panel className="overflow-hidden p-5">
              <div className="pointer-events-none absolute inset-x-0 top-0 z-0 h-24 bg-gradient-to-r from-teal-100/45 via-white/20 to-transparent" />
              <div className="relative z-10">
                <SectionTitle
                  icon={FileText}
                  subtitle={selectedDataset ? `Dataset ID: ${selectedDataset.id}` : 'Select or create a dataset first.'}
                  title={selectedDataset?.name || 'No dataset selected'}
                />
                <div className="mt-5 grid gap-3 md:grid-cols-3">
                  <MiniStat label="Questions" value={questions.length} />
                  <MiniStat label="Experiments" value={selectedDatasetExperiments.length} />
                  <MiniStat label="Files" value={fineTuningFiles.length} />
                </div>
              </div>
            </Panel>

            <Panel className="p-5">
              <div className="flex items-center justify-between gap-3">
                <SectionTitle
                  icon={Download}
                  subtitle="Backend generated files only."
                  title="Fine-tuning Files"
                />
                <IconButton label="Refresh files" onClick={refreshFineTuningFiles}>
                  <RefreshCcw size={16} />
                </IconButton>
              </div>
              <div className="mt-4 max-h-40 space-y-2 overflow-y-auto pr-1">
                {fineTuningFiles.length ? fineTuningFiles.map((file) => (
                  <p className="truncate rounded-lg border border-slate-100 bg-white/72 px-3 py-2 text-xs font-medium text-slate-700 shadow-sm" key={file}>
                    {file}
                  </p>
                )) : (
                  <p className="rounded-lg border border-dashed border-slate-200 bg-white/50 px-3 py-4 text-sm font-medium leading-6 text-slate-500">The backend returned no fine-tuning files.</p>
                )}
              </div>
            </Panel>
          </div>

          <Panel className="p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <SectionTitle
                icon={FlaskConical}
                subtitle="Records loaded from the evaluation and fine-tuning experiment APIs."
                title="Experiment Records"
              />
              <Button disabled={!selectedDatasetId} onClick={() => setShowExperiment(true)} size="sm" variant="secondary">
                <Plus size={14} />
                New record
              </Button>
            </div>
            <div className="mt-4">
              {selectedDatasetExperiments.length ? (
                <DataTable
                  columns={['Name', 'Type', 'LLM model', 'Status', 'Actions']}
                  rows={selectedDatasetExperiments.map((experiment) => [
                    experiment.name,
                    experiment.method,
                    experiment.llmModel || experiment.fineTunedModelName || 'No model name',
                    <StatusBadge key="status" status={statusForBadge(experiment.status)} />,
                    <RowActions key="actions">
                      <Button
                        disabled={runningExperimentId === experiment.id || !canRunSelectedDatasetBenchmark || experiment.status === 'RUNNING'}
                        onClick={() => handleRunBenchmark(experiment.id)}
                        size="sm"
                        variant="secondary"
                      >
                        {runningExperimentId === experiment.id ? <Loader2 className="animate-spin" size={14} /> : <Play size={14} />}
                        Run benchmark
                      </Button>
                      {experiment.status === 'COMPLETED' || completedExperimentId === experiment.id ? (
                        <Button
                          onClick={() => openResearchDashboard(experiment.id)}
                          size="sm"
                          variant="accent"
                        >
                          <BarChart3 size={14} />
                          View research
                        </Button>
                      ) : null}
                    </RowActions>,
                  ])}
                />
              ) : (
                <p className="rounded-lg border border-dashed border-slate-200 bg-white/50 px-3 py-4 text-sm font-medium leading-6 text-slate-500">No experiment records were returned for this dataset.</p>
              )}
            </div>
          </Panel>
        </div>
      )}

      {showAdd ? (
        <DrawerModal onClose={() => setShowAdd(false)} title="Add question">
          <form className="space-y-4" onSubmit={handleAddQuestion}>
            <TextArea
              label="Question text"
              onChange={setNewQuestionText}
              placeholder="What is the definition of retrieval augmented generation?"
              required
              value={newQuestionText}
            />
            <TextArea
              label="Ground truth answer"
              onChange={setNewGroundTruth}
              placeholder="The expected correct answer based on course material..."
              required
              value={newGroundTruth}
            />
            <Button className="w-full" disabled={submitting} type="submit">
              {submitting ? <Loader2 className="animate-spin" size={16} /> : <Plus size={16} />}
              Create question
            </Button>
          </form>
        </DrawerModal>
      ) : null}

      {showCreateDataset ? (
        <DrawerModal onClose={() => setShowCreateDataset(false)} title="Create dataset">
          <form className="space-y-4" onSubmit={handleCreateDataset}>
            <TextInput
              label="Dataset name"
              onChange={setNewDatasetName}
              placeholder="AI101 benchmark set"
              required
              value={newDatasetName}
            />
            <LabeledSelect label="Course" onChange={handleCourseChange} required value={selectedCourseId}>
              <option value="">Select course</option>
              {courses.map((course) => (
                <option key={course.id} value={course.id}>
                  {course.name} ({course.code})
                </option>
              ))}
            </LabeledSelect>
            <LabeledSelect label="Workspace" onChange={setSelectedWorkspaceId} value={selectedWorkspaceId}>
              <option value="">Select workspace</option>
              {workspaceOptions.map((workspace) => (
                <option key={workspace.id} value={workspace.id}>
                  {workspace.name}
                </option>
              ))}
            </LabeledSelect>
            {!workspaceOptions.length ? (
              <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-800">
                No workspace exists for the selected course. Create a workspace before creating a dataset.
              </p>
            ) : null}
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm font-semibold text-slate-600">
              {corpusDocuments.length} indexed document{corpusDocuments.length === 1 ? '' : 's'} will be linked as this dataset's benchmark corpus.
            </div>
            <Button className="w-full" disabled={submitting || !workspaceOptions.length} type="submit">
              {submitting ? <Loader2 className="animate-spin" size={16} /> : <Plus size={16} />}
              Create dataset
            </Button>
          </form>
        </DrawerModal>
      ) : null}

      {showExperiment ? (
        <DrawerModal onClose={() => setShowExperiment(false)} title="Create experiment">
          <form className="space-y-4" onSubmit={handleCreateExperiment}>
            <TextInput label="Experiment name" onChange={setExperimentName} placeholder="RAG baseline" required value={experimentName} />
            <LabeledSelect label="Experiment type" onChange={setExperimentType} required value={experimentType}>
              <option value="RAG">RAG</option>
              <option value="FINE_TUNING">Fine-tuning</option>
            </LabeledSelect>
            <TextInput label="LLM model" onChange={setExperimentLlmModel} placeholder="java-rag" required value={experimentLlmModel} />
            <TextArea label="Config JSON" onChange={setExperimentConfig} placeholder="{}" value={experimentConfig} />
            <LabeledSelect label="Embedding model helper" onChange={setExperimentEmbeddingModelId} value={experimentEmbeddingModelId}>
              <option value="">Select an available model</option>
              {embeddingModels.map((model) => (
                <option disabled={model.status !== 'AVAILABLE'} key={model.id} value={model.id}>
                  {model.name} ({model.status})
                </option>
              ))}
            </LabeledSelect>
            <LabeledSelect label="Chunking strategy" onChange={setChunkingStrategy} required value={chunkingStrategy}>
              <option value="FIXED_500_50">Fixed 500 / overlap 50</option>
              <option value="PARAGRAPH_700_120">Paragraph 700 / overlap 120</option>
              <option value="HEADING_PAGE_900_120">Heading/page 900 / overlap 120</option>
            </LabeledSelect>
            <LabeledSelect label="Generation mode" onChange={setGenerationMode} required value={generationMode}>
              <option value="RAG_EXTRACTIVE">RAG extractive</option>
              <option value="RAG_BASE">RAG base model</option>
              <option value="RAG_LORA">RAG + LoRA</option>
              <option value="FINETUNED_ONLY">Fine-tuned only</option>
            </LabeledSelect>
            <div className="grid grid-cols-3 gap-3">
              <TextInput label="Top K" onChange={setTopK} required value={topK} />
              <TextInput label="Temperature" onChange={setTemperature} required value={temperature} />
              <TextInput label="Seed" onChange={setSeed} required value={seed} />
            </div>
            <p className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm font-semibold text-slate-600">
              Helper values are saved inside Config JSON before the request is sent.
            </p>
            <Button className="w-full" disabled={submitting} type="submit">
              {submitting ? <Loader2 className="animate-spin" size={16} /> : <FlaskConical size={16} />}
              Create experiment
            </Button>
          </form>
        </DrawerModal>
      ) : null}

      {showFineTuning ? (
        <DrawerModal onClose={() => setShowFineTuning(false)} title="Create fine-tuning record">
          <form className="space-y-4" onSubmit={handleCreateFineTuningRecord}>
            <TextInput label="Record name" onChange={setFineTuningName} placeholder="Fine-tuning run" required value={fineTuningName} />
            <TextInput label="LLM model" onChange={setFineTuningModel} placeholder="Fine-tuning model name" required value={fineTuningModel} />
            <TextArea label="Config JSON" onChange={setFineTuningConfig} placeholder="{}" value={fineTuningConfig} />
            <Button className="w-full" disabled={submitting} type="submit">
              {submitting ? <Loader2 className="animate-spin" size={16} /> : <Brain size={16} />}
              Create fine-tuning record
            </Button>
          </form>
        </DrawerModal>
      ) : null}
    </CrudPage>
  )
}

function CrudPage({ actions, children, description, icon, title }) {
  return (
    <div>
      <AdminPageHeader actions={actions} description={description} icon={icon} title={title} />
      {children}
    </div>
  )
}

function Toolbar({ children }) {
  return (
    <Panel className="mb-5 overflow-visible p-4">
      <div className="grid gap-3 md:grid-cols-2">{children}</div>
    </Panel>
  )
}

function DataTable({ columns, rows }) {
  return (
    <div className="os-panel overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[920px] border-collapse text-left text-sm">
          <thead className="bg-white/62 text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
            <tr>
              {columns.map((column) => <th className="border-b border-slate-200 px-4 py-3.5" key={column}>{column}</th>)}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((row, index) => (
              <tr className="bg-white/58 transition-colors duration-200 hover:bg-teal-50/65" key={index}>
                {row.map((cell, cellIndex) => <td className="px-4 py-4 align-top leading-6 text-slate-700" key={cellIndex}>{cell}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function RowActions({ children }) {
  return <div className="flex flex-wrap items-center gap-2">{children}</div>
}

function DrawerModal({ children, onClose, title }) {
  return (
    <AnimatePresence>
      <motion.div className="fixed inset-0 z-50 flex justify-end bg-slate-950/30 p-3 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
        <motion.aside className="os-panel h-full w-full max-w-xl overflow-y-auto p-5" initial={{ x: 40, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 30, opacity: 0 }}>
          <div className="mb-5 flex items-start justify-between gap-3">
            <h2 className="text-xl font-black tracking-tight">{title}</h2>
            <IconButton label="Close" onClick={onClose}>
              <X size={16} />
            </IconButton>
          </div>
          {children}
        </motion.aside>
      </motion.div>
    </AnimatePresence>
  )
}

function TextInput({ label, onChange, value, ...props }) {
  return (
    <label className="block text-sm font-semibold text-slate-700">
      {label}
      <input
        className="mt-1 h-11 w-full rounded-xl border border-border bg-white/90 px-3 text-sm font-medium text-slate-900 outline-none transition focus:border-teal-400 focus:ring-4 focus:ring-teal-100"
        onChange={(event) => onChange(event.target.value)}
        type="text"
        value={value}
        {...props}
      />
    </label>
  )
}

function TextArea({ label, onChange, value, ...props }) {
  return (
    <label className="block text-sm font-semibold text-slate-700">
      {label}
      <textarea
        className="mt-1 min-h-24 w-full rounded-xl border border-border bg-white/90 p-3 text-sm font-medium leading-6 text-slate-900 outline-none transition focus:border-teal-400 focus:ring-4 focus:ring-teal-100"
        onChange={(event) => onChange(event.target.value)}
        value={value}
        {...props}
      />
    </label>
  )
}

function LabeledSelect({ children, label, onChange, value, ...props }) {
  return (
    <label className="block text-sm font-semibold text-slate-700">
      {label}
      <select
        className="mt-1 h-11 w-full rounded-xl border border-border bg-white/90 px-3 text-sm font-medium text-slate-900 outline-none transition focus:border-teal-400 focus:ring-4 focus:ring-teal-100"
        onChange={(event) => onChange(event.target.value)}
        value={value}
        {...props}
      >
        {children}
      </select>
    </label>
  )
}

function SectionTitle({ icon: Icon, subtitle, title }) {
  return (
    <div className="flex items-start gap-3">
      <div className="grid size-10 shrink-0 place-items-center rounded-xl border border-teal-100 bg-teal-50 text-primary shadow-sm">
        <Icon size={18} />
      </div>
      <div className="min-w-0">
        <h2 className="truncate text-lg font-black tracking-tight">{title}</h2>
        <p className="text-sm font-medium leading-6 text-slate-500">{subtitle}</p>
      </div>
    </div>
  )
}

function MiniStat({ label, value }) {
  return (
    <div className="rounded-xl border border-white/80 bg-white/72 p-4 shadow-[0_12px_28px_rgba(15,118,110,.06)]">
      <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-400">{label}</p>
      <p className="mt-1 text-2xl font-black text-slate-950">{value}</p>
    </div>
  )
}

function Loading({ label }) {
  return <Panel className="flex min-h-40 items-center justify-center gap-3 p-5 text-sm font-semibold text-slate-600"><Loader2 className="animate-spin text-primary" size={20} />{label}</Panel>
}

function Alert({ message }) {
  return <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">{message}</div>
}

function Notice({ action, message }) {
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-teal-200 bg-teal-50 p-3 text-sm font-semibold text-teal-800">
      <span>{message}</span>
      {action}
    </div>
  )
}

function statusForBadge(status) {
  if (status === 'COMPLETED') return 'Indexed'
  if (status === 'RUNNING') return 'Processing'
  if (status === 'PENDING') return 'Pending'
  if (status === 'FAILED') return 'Failed'
  return status || 'Uploaded'
}

export default AdminTestSetPage
