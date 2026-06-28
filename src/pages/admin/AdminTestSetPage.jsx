import { AnimatePresence, motion } from 'framer-motion'
import {
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
import {
  Button,
  EmptyState,
  IconButton,
  Panel,
  SelectField,
  StatusBadge,
} from '../../components/ui.jsx'
import { AdminPageHeader } from '../../layouts/AdminLayout.jsx'
import { getSavedUser } from '../../services/authService.js'
import * as courseService from '../../services/courseService.js'
import * as evalService from '../../services/evaluationService.js'

const allOption = 'All'

export function AdminTestSetPage() {
  const user = getSavedUser()
  const [datasets, setDatasets] = useState([])
  const [selectedDatasetId, setSelectedDatasetId] = useState('')
  const [questions, setQuestions] = useState([])
  const [courses, setCourses] = useState([])
  const [workspaces, setWorkspaces] = useState([])
  const [experiments, setExperiments] = useState([])
  const [fineTuningFiles, setFineTuningFiles] = useState([])

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

  const [newQuestionText, setNewQuestionText] = useState('')
  const [newGroundTruth, setNewGroundTruth] = useState('')
  const [newDatasetName, setNewDatasetName] = useState('')
  const [selectedCourseId, setSelectedCourseId] = useState('')
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState('')
  const [experimentName, setExperimentName] = useState('')
  const [experimentType, setExperimentType] = useState('RAG')
  const [experimentModel, setExperimentModel] = useState('')
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
        const [datasetList, courseList, workspaceList, experimentList, fileList] = await Promise.all([
          evalService.getDatasets(),
          courseService.getCourses(),
          courseService.getWorkspaces(),
          evalService.getExperiments(),
          evalService.getFineTuningFiles().catch(() => []),
        ])

        if (!active) return
        setDatasets(datasetList)
        setCourses(courseList)
        setWorkspaces(workspaceList)
        setExperiments(experimentList)
        setFineTuningFiles(fileList)
        setSelectedDatasetId((current) => current || datasetList[0]?.id || '')
        setSelectedCourseId((current) => current || courseList[0]?.id || '')
        setSelectedWorkspaceId((current) => current || workspaceList[0]?.id || '')
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

  const visibleQuestions = selectedDatasetId ? questions : []
  const filteredQuestions = visibleQuestions.filter((item) => (
    difficulty === allOption ||
    item.difficulty === difficulty ||
    !item.difficulty
  ))
  const selectedDatasetExperiments = experiments.filter((experiment) => experiment.datasetId === selectedDatasetId)

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
    if (!newDatasetName.trim() || !selectedCourseId) return
    if (!user?.id) {
      setError('Sign in before creating a dataset.')
      return
    }

    await submitAction(async () => {
      const created = await evalService.createDataset({
        datasetName: newDatasetName.trim(),
        courseId: selectedCourseId,
        workspaceId: selectedWorkspaceId || null,
        createdBy: user.id,
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
    if (!selectedDatasetId || !experimentName.trim() || !experimentModel.trim()) return
    if (!user?.id) {
      setError('Sign in before creating an experiment.')
      return
    }

    const configJson = normalizeJsonInput(experimentConfig)
    if (!configJson) return

    await submitAction(async () => {
      const created = await evalService.createExperiment({
        datasetId: selectedDatasetId,
        experimentName: experimentName.trim(),
        experimentType,
        llmModel: experimentModel.trim(),
        configJson,
        createdBy: user.id,
      })
      setExperiments((current) => [created, ...current])
      setExperimentName('')
      setExperimentType('RAG')
      setExperimentModel('')
      setExperimentConfig('')
      setShowExperiment(false)
      setNotice('Experiment record created from the backend API.')
    })
  }

  async function handleCreateFineTuningRecord(event) {
    event.preventDefault()
    if (!selectedDatasetId || !fineTuningName.trim() || !fineTuningModel.trim()) return
    if (!user?.id) {
      setError('Sign in before creating a fine-tuning record.')
      return
    }

    const configJson = normalizeJsonInput(fineTuningConfig)
    if (!configJson) return

    await submitAction(async () => {
      const created = await evalService.createFineTuningRecord({
        name: fineTuningName.trim(),
        datasetId: selectedDatasetId,
        researcherId: user.id,
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
    if (!experimentId) return
    setRunningExperimentId(experimentId)
    setError('')
    setNotice('')

    try {
      await evalService.runBenchmark(experimentId)
      setNotice('Benchmark run request was accepted by the backend.')
      const refreshed = await evalService.getExperiments()
      setExperiments(refreshed)
    } catch (requestError) {
      setNotice(requestError.message)
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
      {notice ? <Notice message={notice} /> : null}

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

          {loadingQuestions ? <Loading label="Loading questions" /> : filteredQuestions.length ? (
            <DataTable
              columns={['Order', 'Question', 'Difficulty', 'Type', 'Ground truth']}
              rows={filteredQuestions.map((item, index) => [
                item.questionNo || index + 1,
                item.question,
                item.difficulty || 'MEDIUM',
                item.type || 'FACTUAL',
                <span className="line-clamp-2" key="ground-truth">
                  {item.groundTruth}
                </span>,
              ])}
            />
          ) : (
            <EmptyState
              action={<Button disabled={!selectedDatasetId} onClick={() => setShowAdd(true)}><Plus size={16} />Add question</Button>}
              description="No ground-truth questions were returned for this dataset."
              title="No questions"
            />
          )}

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
                  columns={['Name', 'Type', 'Model', 'Status', 'Actions']}
                  rows={selectedDatasetExperiments.map((experiment) => [
                    experiment.name,
                    experiment.method,
                    experiment.llmModel,
                    <StatusBadge key="status" status={statusForBadge(experiment.status)} />,
                    <Button
                      disabled={runningExperimentId === experiment.id || experiment.experimentType === 'FINE_TUNING'}
                      key="run"
                      onClick={() => handleRunBenchmark(experiment.id)}
                      size="sm"
                      variant="secondary"
                    >
                      {runningExperimentId === experiment.id ? <Loader2 className="animate-spin" size={14} /> : <Play size={14} />}
                      Run benchmark
                    </Button>,
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
            <LabeledSelect label="Course" onChange={setSelectedCourseId} required value={selectedCourseId}>
              <option value="">Select course</option>
              {courses.map((course) => (
                <option key={course.id} value={course.id}>
                  {course.name} ({course.code})
                </option>
              ))}
            </LabeledSelect>
            <LabeledSelect label="Workspace" onChange={setSelectedWorkspaceId} value={selectedWorkspaceId}>
              <option value="">No workspace</option>
              {workspaces
                .filter((workspace) => !selectedCourseId || workspace.courseId === selectedCourseId)
                .map((workspace) => (
                  <option key={workspace.id} value={workspace.id}>
                    {workspace.name}
                  </option>
                ))}
            </LabeledSelect>
            <Button className="w-full" disabled={submitting} type="submit">
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
            <TextInput label="LLM model" onChange={setExperimentModel} placeholder="Model name from backend configuration" required value={experimentModel} />
            <TextArea label="Config JSON" onChange={setExperimentConfig} placeholder="{}" value={experimentConfig} />
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
    <Panel className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[920px] border-collapse text-left text-sm">
          <thead className="bg-white/62 text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
            <tr>
              {columns.map((column) => <th className="border-b border-slate-200 px-4 py-3.5" key={column}>{column}</th>)}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((row, index) => (
              <motion.tr
                animate={{ opacity: 1, y: 0 }}
                className="bg-white/58 transition-colors duration-200 hover:bg-teal-50/65"
                initial={{ opacity: 0, y: 8 }}
                key={index}
                transition={{ delay: index * 0.025, duration: 0.22 }}
              >
                {row.map((cell, cellIndex) => <td className="px-4 py-4 align-top leading-6 text-slate-700" key={cellIndex}>{cell}</td>)}
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  )
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

function Notice({ message }) {
  return <div className="mb-4 rounded-lg border border-teal-200 bg-teal-50 p-3 text-sm font-semibold text-teal-800">{message}</div>
}

function statusForBadge(status) {
  if (status === 'COMPLETED') return 'Indexed'
  if (status === 'RUNNING') return 'Processing'
  if (status === 'PENDING') return 'Pending'
  if (status === 'FAILED') return 'Failed'
  return status || 'Uploaded'
}

export default AdminTestSetPage
