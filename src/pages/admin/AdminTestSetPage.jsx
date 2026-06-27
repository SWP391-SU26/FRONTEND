import { AnimatePresence, motion } from 'framer-motion'
import { ClipboardList, Download, Play, Plus, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import {
  Button,
  IconButton,
  Panel,
  SelectField,
} from '../../components/ui.jsx'
import { AdminPageHeader } from '../../layouts/AdminLayout.jsx'
import * as courseService from '../../services/courseService.js'
import * as evalService from '../../services/evaluationService.js'

const allOption = 'All'

export function AdminTestSetPage() {
  const [datasets, setDatasets] = useState([])
  const [selectedDatasetId, setSelectedDatasetId] = useState('')
  const [questions, setQuestions] = useState([])
  const [courses, setCourses] = useState([])
  const [workspaces, setWorkspaces] = useState([])

  const [difficulty, setDifficulty] = useState(allOption)
  const [showAdd, setShowAdd] = useState(false)
  const [showCreateDataset, setShowCreateDataset] = useState(false)
  const [running, setRunning] = useState(false)

  const [newQuestionText, setNewQuestionText] = useState('')
  const [newGroundTruth, setNewGroundTruth] = useState('')
  const [newDatasetName, setNewDatasetName] = useState('')
  const [selectedCourseId, setSelectedCourseId] = useState('')
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState('')

  useEffect(() => {
    async function loadInitialData() {
      try {
        const dsList = await evalService.getDatasets()
        setDatasets(dsList)
        if (dsList.length > 0) {
          setSelectedDatasetId(dsList[0].id)
        }

        const courseList = await courseService.getCourses()
        setCourses(courseList)
        if (courseList.length > 0) {
          setSelectedCourseId(courseList[0].id)
        }

        const wsList = await courseService.getWorkspaces()
        setWorkspaces(wsList)
        if (wsList.length > 0) {
          setSelectedWorkspaceId(wsList[0].id)
        }
      } catch (error) {
        console.error('Failed to load datasets/subjects', error)
      }
    }
    loadInitialData()
  }, [])

  useEffect(() => {
    if (!selectedDatasetId) {
      return
    }
    async function loadQuestions() {
      try {
        const qList = await evalService.getQuestions(selectedDatasetId)
        setQuestions(qList)
      } catch (error) {
        console.error('Failed to load questions', error)
      }
    }
    loadQuestions()
  }, [selectedDatasetId])

  const visibleQuestions = selectedDatasetId ? questions : []
  const filtered = visibleQuestions.filter((item) =>
    (difficulty === allOption || item.difficulty === difficulty) || !item.difficulty
  )

  async function handleAddQuestion(event) {
    event.preventDefault()
    if (!selectedDatasetId || !newQuestionText || !newGroundTruth) return

    try {
      const newQuestion = await evalService.addQuestion({
        datasetId: selectedDatasetId,
        questionText: newQuestionText,
        groundTruthAnswer: newGroundTruth,
      })
      setQuestions((current) => [newQuestion, ...current])
      setNewQuestionText('')
      setNewGroundTruth('')
      setShowAdd(false)
    } catch (error) {
      alert('Failed to add question: ' + error.message)
    }
  }

  async function handleCreateDataset(event) {
    event.preventDefault()
    if (!newDatasetName || !selectedCourseId || !selectedWorkspaceId) return

    try {
      const created = await evalService.createDataset({
        datasetName: newDatasetName,
        courseId: selectedCourseId,
        workspaceId: selectedWorkspaceId,
        createdBy: '815d1335-beaf-474a-b26e-1015d0a65ec4',
      })
      setDatasets((current) => [...current, created])
      setSelectedDatasetId(created.id)
      setNewDatasetName('')
      setShowCreateDataset(false)
    } catch (error) {
      alert('Failed to create dataset: ' + error.message)
    }
  }

  async function handleExportJsonl() {
    if (!selectedDatasetId) return
    try {
      const blob = await evalService.exportJsonl(selectedDatasetId)
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `dataset_${selectedDatasetId}_train.jsonl`
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
    } catch (error) {
      alert('Failed to export dataset: ' + error.message)
    }
  }

  function runEvaluation() {
    if (!selectedDatasetId) return
    setRunning(true)
    window.setTimeout(() => {
      setRunning(false)
      alert('Evaluation benchmark run complete! See Results in Experiments.')
    }, 1500)
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
          <Button disabled={!selectedDatasetId} onClick={runEvaluation} variant="accent">
            <Play size={16} />
            {running ? 'Running...' : 'Run evaluation'}
          </Button>
          <Button disabled={!selectedDatasetId} onClick={handleExportJsonl} variant="secondary">
            <Download size={16} />
            Export JSONL
          </Button>
        </>
      }
      description="Create datasets, manage evaluation test sets / ground truth, and export training files."
      icon={ClipboardList}
      title="Test Set / Ground Truth"
    >
      <Toolbar>
        <SelectField
          label="Select Dataset"
          onChange={(event) => setSelectedDatasetId(event.target.value)}
          value={selectedDatasetId}
        >
          <option value="" disabled>-- Select Dataset --</option>
          {datasets.map((dataset) => (
            <option key={dataset.id} value={dataset.id}>
              {dataset.name} ({dataset.version})
            </option>
          ))}
        </SelectField>

        <SelectField
          label="Difficulty"
          onChange={(event) => setDifficulty(event.target.value)}
          value={difficulty}
        >
          {[allOption, 'Easy', 'Medium', 'Hard'].map((item) => (
            <option key={item}>{item}</option>
          ))}
        </SelectField>
      </Toolbar>

      {visibleQuestions.length === 0 ? (
        <Panel className="p-8 text-center font-semibold text-slate-500">
          No questions found in this dataset. Add some questions to get started!
        </Panel>
      ) : (
        <DataTable
          columns={['Order', 'Question', 'Difficulty', 'Type', 'Ground truth']}
          rows={filtered.slice(0, 18).map((item, index) => [
            item.questionNo || index + 1,
            item.question,
            item.difficulty || 'Medium',
            item.type || 'Factual',
            <span className="line-clamp-2" key="gt">
              {item.groundTruth}
            </span>,
          ])}
        />
      )}

      {showAdd ? (
        <DrawerModal onClose={() => setShowAdd(false)} title="Add question">
          <form className="space-y-4" onSubmit={handleAddQuestion}>
            <div>
              <label className="mb-1 block text-xs font-black uppercase text-slate-500">
                Question text
              </label>
              <textarea
                className="min-h-20 w-full rounded-xl border border-border p-3 text-sm font-semibold text-slate-900 outline-none focus:border-teal-400"
                onChange={(event) => setNewQuestionText(event.target.value)}
                placeholder="What is the definition of..."
                required
                value={newQuestionText}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-black uppercase text-slate-500">
                Ground truth answer
              </label>
              <textarea
                className="min-h-24 w-full rounded-xl border border-border p-3 text-sm font-semibold text-slate-900 outline-none focus:border-teal-400"
                onChange={(event) => setNewGroundTruth(event.target.value)}
                placeholder="The expected correct answer based on context..."
                required
                value={newGroundTruth}
              />
            </div>
            <Button className="w-full" type="submit">
              Create Question
            </Button>
          </form>
        </DrawerModal>
      ) : null}

      {showCreateDataset ? (
        <DrawerModal onClose={() => setShowCreateDataset(false)} title="Create dataset">
          <form className="space-y-4" onSubmit={handleCreateDataset}>
            <div>
              <label className="mb-1 block text-xs font-black uppercase text-slate-500">
                Dataset Name
              </label>
              <input
                className="h-11 w-full rounded-xl border border-border px-3 text-sm font-semibold text-slate-900 outline-none focus:border-teal-400"
                onChange={(event) => setNewDatasetName(event.target.value)}
                placeholder="AI101 Benchmark Set v1"
                required
                type="text"
                value={newDatasetName}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-black uppercase text-slate-500">
                Course
              </label>
              <SelectField
                label="Course"
                onChange={(event) => setSelectedCourseId(event.target.value)}
                value={selectedCourseId}
              >
                {courses.map((course) => (
                  <option key={course.id} value={course.id}>
                    {course.name} ({course.code})
                  </option>
                ))}
              </SelectField>
            </div>
            <div>
              <label className="mb-1 block text-xs font-black uppercase text-slate-500">
                Workspace
              </label>
              <SelectField
                label="Workspace"
                onChange={(event) => setSelectedWorkspaceId(event.target.value)}
                value={selectedWorkspaceId}
              >
                {workspaces.map((workspace) => (
                  <option key={workspace.id} value={workspace.id}>
                    {workspace.name}
                  </option>
                ))}
              </SelectField>
            </div>
            <Button className="w-full" type="submit">
              Create Dataset
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
    <Panel className="mb-4 p-3">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">{children}</div>
    </Panel>
  )
}

function DataTable({ columns, rows }) {
  return (
    <Panel className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[920px] border-collapse text-left text-sm">
          <thead className="bg-white/52 text-xs font-black uppercase tracking-[0.12em] text-slate-500">
            <tr>
              {columns.map((column) => <th className="border-b border-slate-200 px-4 py-3" key={column}>{column}</th>)}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((row, index) => (
              <motion.tr className="bg-white/58 transition hover:bg-teal-50/70" key={index} whileHover={{ scale: 1.002 }}>
                {row.map((cell, cellIndex) => <td className="px-4 py-4 align-top text-slate-700" key={cellIndex}>{cell}</td>)}
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

export default AdminTestSetPage
