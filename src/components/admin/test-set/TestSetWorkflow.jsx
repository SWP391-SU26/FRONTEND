import {
  Check,
  CheckCircle2,
  ChevronRight,
  Circle,
  ClipboardList,
  Download,
  FileText,
  FlaskConical,
  LockKeyhole,
  Play,
  Plus,
  Square,
  Upload,
  XCircle,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { Button, EmptyState, Panel, SelectField, StatusBadge } from '../../../components/ui.jsx'
import { cn } from '../../../utils/cn.js'

const benchmarkSteps = [
  { id: 1, label: 'Dataset snapshot', description: 'Freeze the source material.', icon: FileText },
  { id: 2, label: 'Ground truth', description: 'Add expected answers.', icon: ClipboardList },
  { id: 3, label: 'Configuration', description: 'Define a benchmark.', icon: FlaskConical },
  { id: 4, label: 'Review and launch', description: 'Check readiness first.', icon: CheckCircle2 },
  { id: 5, label: 'Monitor runs', description: 'Track progress and results.', icon: Play },
]

export function BenchmarkStepper({ activeStep, availableStep, onStepChange, stepState }) {
  return (
    <nav aria-label="Benchmark workflow" className="notebook-panel mb-4 overflow-hidden p-2">
      <ol className="grid min-w-[760px] grid-cols-5 gap-1 overflow-x-auto sm:min-w-0">
        {benchmarkSteps.map((step) => {
          const Icon = step.icon
          const locked = step.id > availableStep
          const complete = stepState[step.id] === 'complete'
          const current = activeStep === step.id

          return (
            <li key={step.id}>
              <button
                aria-current={current ? 'step' : undefined}
                className={cn(
                  'group flex min-h-20 w-full items-start gap-3 rounded-xl p-3 text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-500',
                  current ? 'bg-primary text-white shadow-[0_12px_24px_rgba(15,118,110,.2)]' : 'text-slate-600 hover:bg-teal-50 hover:text-primary',
                  locked && 'cursor-not-allowed opacity-50 hover:bg-transparent hover:text-slate-600',
                )}
                disabled={locked}
                onClick={() => onStepChange(step.id)}
                type="button"
              >
                <span className={cn(
                  'grid size-7 shrink-0 place-items-center rounded-lg border text-xs font-black',
                  current ? 'border-white/35 bg-white/15 text-white' : complete ? 'border-teal-200 bg-teal-50 text-primary' : 'border-slate-200 bg-white text-slate-500',
                )}>
                  {complete ? <Check size={15} /> : locked ? <LockKeyhole size={13} /> : <span>{step.id}</span>}
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-black leading-5">{step.label}</span>
                  <span className={cn('mt-0.5 block text-xs font-medium leading-4', current ? 'text-white/75' : 'text-slate-500')}>{step.description}</span>
                </span>
                {!locked && !complete && !current ? <ChevronRight className="ml-auto mt-1 shrink-0 opacity-0 transition group-hover:translate-x-0.5 group-hover:opacity-100" size={15} /> : null}
                <Icon className="sr-only" />
              </button>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}

export function DatasetSnapshotStep({
  courseDocuments,
  datasetName,
  datasets,
  onCourseChange,
  onDatasetNameChange,
  onDatasetSelect,
  onDocumentToggle,
  onSemesterChange,
  onSubmit,
  scopes,
  selectedCourseId,
  selectedDataset,
  selectedDatasetId,
  selectedDocumentIds,
  selectedSemester,
  selectedSemesterId,
  snapshotJustCreated,
  submitting,
}) {
  return (
    <StepPanel
      eyebrow="Step 1 of 5"
      icon={FileText}
      subtitle="Select processed material for one course, then save an immutable snapshot for fair benchmark comparisons."
      title="Dataset snapshot"
    >
      <form className="mt-6 space-y-5" onSubmit={onSubmit}>
        <div className="grid gap-4 md:grid-cols-2">
          <FieldGroup label="Semester">
            <SelectField label="Semester" onChange={(event) => onSemesterChange(event.target.value)} value={selectedSemesterId}>
              {!scopes.length ? <option value="">No semesters available</option> : null}
              {scopes.map((semester) => <option key={semester.id} value={semester.id}>{semester.name}</option>)}
            </SelectField>
          </FieldGroup>
          <FieldGroup label="Course">
            <SelectField label="Course" onChange={(event) => onCourseChange(event.target.value)} value={selectedCourseId}>
              {!selectedSemester?.courses?.length ? <option value="">No courses available</option> : null}
              {(selectedSemester?.courses ?? []).map((course) => <option key={course.id} value={course.id}>{course.code} / {course.name}</option>)}
            </SelectField>
          </FieldGroup>
        </div>

        <FieldGroup hint="Use a meaningful name so the same snapshot can be found when comparing RAG and Fine-tuned runs." label="Snapshot name">
          <input aria-label="Snapshot name" className="control" onChange={(event) => onDatasetNameChange(event.target.value)} placeholder="Example: SU2026 MLN123 benchmark" value={datasetName} />
        </FieldGroup>

        <section aria-labelledby="processed-documents-heading">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <h3 className="text-sm font-semibold text-slate-800" id="processed-documents-heading">Processed documents</h3>
              <p className="mt-1 text-xs font-medium leading-5 text-slate-500">Only indexed or processed documents can be included.</p>
            </div>
            <span aria-live="polite" className="rounded-lg bg-teal-50 px-2.5 py-1 text-xs font-semibold text-primary">{selectedDocumentIds.length} selected</span>
          </div>

          {courseDocuments.length ? (
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {courseDocuments.map((document) => {
                const selected = selectedDocumentIds.includes(document.id)
                return (
                  <label className={cn('flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition', selected ? 'border-teal-300 bg-teal-50/70' : 'border-slate-200 bg-white/70 hover:border-teal-200')} key={document.id}>
                    <input checked={selected} className="mt-1 accent-teal-700" onChange={() => onDocumentToggle(document.id)} type="checkbox" />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold text-slate-900">{document.displayName}</span>
                      <span className="mt-1 block text-xs font-medium text-slate-500">{document.pages ?? 'Page count unavailable'} pages</span>
                    </span>
                  </label>
                )
              })}
            </div>
          ) : <InlineNotice tone="warning">This course has no processed documents. Upload and index material before creating a snapshot.</InlineNotice>}
        </section>

        {snapshotJustCreated ? (
          <InlineNotice tone="success">
            <strong>Snapshot created.</strong> The new snapshot is selected below. Continue to Step 2 to add benchmark questions.
          </InlineNotice>
        ) : null}

        <Button disabled={submitting || !datasetName.trim() || !selectedCourseId || !selectedDocumentIds.length || snapshotJustCreated} type="submit">
          {snapshotJustCreated ? <CheckCircle2 size={16} /> : <Plus size={16} />}
          {snapshotJustCreated ? 'Snapshot created' : 'Create snapshot'}
        </Button>
      </form>

      <div className="mt-7 border-t border-slate-100 pt-5">
        <FieldGroup hint="Choose an existing snapshot to resume its ground truth, configuration, or benchmark run." label="Current snapshot">
          <SelectField label="Current snapshot" onChange={(event) => onDatasetSelect(event.target.value)} value={selectedDatasetId}>
            <option value="">Select a snapshot</option>
            {datasets.map((dataset) => <option key={dataset.id} value={dataset.id}>{dataset.name} / {dataset.status}</option>)}
          </SelectField>
        </FieldGroup>
        {selectedDataset ? <SnapshotSummary dataset={selectedDataset} documentCount={selectedDataset.documentIds?.length} /> : null}
      </div>
    </StepPanel>
  )
}

export function GroundTruthStep({
  importInputRef,
  onAddQuestion,
  onExport,
  onImport,
  onPrevious,
  onQuestionTextChange,
  onGroundTruthChange,
  groundTruth,
  questionText,
  questions,
  selectedDataset,
  submitting,
}) {
  if (!selectedDataset) {
    return <BlockedStep description="Create or select a dataset snapshot in Step 1 before adding evaluation questions." onPrevious={onPrevious} title="Select a dataset snapshot first" />
  }

  const frozen = selectedDataset.status === 'FROZEN'
  return (
    <StepPanel
      eyebrow="Step 2 of 5"
      icon={ClipboardList}
      subtitle="Add representative course questions and their expected answers. They become read-only after the first benchmark starts."
      title="Ground truth"
    >
      <SnapshotSummary compact dataset={selectedDataset} documentCount={selectedDataset.documentIds?.length} />
      {selectedDataset.validationError ? <InlineNotice tone="error">{selectedDataset.validationError}</InlineNotice> : null}
      {frozen ? <InlineNotice tone="warning"><strong>This snapshot is frozen.</strong> Question content is read-only because a benchmark has started.</InlineNotice> : null}

      <form className="mt-5 grid gap-4" onSubmit={onAddQuestion}>
        <FieldGroup label="Benchmark question">
          <textarea aria-label="Benchmark question" className="control min-h-24" disabled={frozen} onChange={(event) => onQuestionTextChange(event.target.value)} placeholder="Enter a question answerable from the selected documents" value={questionText} />
        </FieldGroup>
        <FieldGroup hint="Describe the answer that should be considered correct for this benchmark." label="Expected answer">
          <textarea aria-label="Expected answer" className="control min-h-28" disabled={frozen} onChange={(event) => onGroundTruthChange(event.target.value)} placeholder="Enter the ground truth answer" value={groundTruth} />
        </FieldGroup>
        <div className="flex flex-wrap gap-2">
          <Button disabled={submitting || frozen || !questionText.trim() || !groundTruth.trim()} type="submit"><Plus size={16} />Add question</Button>
          <Button disabled={submitting || frozen} onClick={() => importInputRef.current?.click()} type="button" variant="secondary"><Upload size={16} />Import CSV</Button>
          <input accept=".csv,text/csv" className="sr-only" disabled={frozen} onChange={onImport} ref={importInputRef} type="file" />
          <Button disabled={questions.length === 0} onClick={onExport} type="button" variant="secondary"><Download size={16} />Export JSON</Button>
        </div>
      </form>

      <section aria-labelledby="benchmark-questions-heading" className="mt-7 border-t border-slate-100 pt-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-800" id="benchmark-questions-heading">Benchmark questions</h3>
            <p className="mt-1 text-xs font-medium text-slate-500">{questions.length} question{questions.length === 1 ? '' : 's'} ready for this snapshot.</p>
          </div>
          {questions.length > 4 ? <span className="text-xs font-medium text-slate-500">Scroll to view all</span> : null}
        </div>
        <div aria-label="Benchmark questions" className="mt-3 max-h-[420px] divide-y divide-slate-100 overflow-y-auto overscroll-contain rounded-xl border border-slate-200 bg-white/60" data-testid="benchmark-question-list" tabIndex={questions.length ? 0 : undefined}>
          {questions.map((question, index) => (
            <article className="p-4" key={question.id}>
              <p className="text-sm font-semibold leading-6 text-slate-900">Q{index + 1}. {question.questionText}</p>
              <p className="mt-2 text-sm leading-6 text-slate-600">{question.groundTruthAnswer}</p>
            </article>
          ))}
          {!questions.length ? <p className="p-5 text-sm font-medium text-slate-500">No questions yet. Add one above or import a CSV file.</p> : null}
        </div>
      </section>
    </StepPanel>
  )
}

export function BenchmarkConfigurationStep({
  datasetExperiments,
  experimentName,
  experimentType,
  llmModel,
  onExperimentNameChange,
  onExperimentTypeChange,
  onModelChange,
  onSelectExperiment,
  onSubmit,
  onPrevious,
  questions,
  selectedDataset,
  selectedExperimentId,
  submitting,
}) {
  if (!selectedDataset || questions.length === 0) {
    return <BlockedStep description="Add at least one ground-truth question in Step 2 before defining a benchmark." onPrevious={onPrevious} title="Ground truth is required" />
  }

  return (
    <StepPanel
      eyebrow="Step 3 of 5"
      icon={FlaskConical}
      subtitle="Save one RAG or Fine-tuned configuration. You can create several configurations against the same immutable snapshot."
      title="Benchmark configuration"
    >
      <div className="grid gap-3 sm:grid-cols-3">
        <SummaryTile label="Snapshot" value={selectedDataset.name} />
        <SummaryTile label="Questions" value={questions.length} />
        <SummaryTile label="Source checksum" value={selectedDataset.checksum ? 'Verified' : 'Not returned'} />
      </div>

      <form className="mt-6 space-y-5" onSubmit={onSubmit}>
        <fieldset>
          <legend className="mb-2 text-sm font-semibold text-slate-800">Benchmark method</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {['RAG', 'FINE_TUNED'].map((type) => {
              const selected = experimentType === type
              return <button aria-pressed={selected} className={cn('rounded-xl border px-4 py-3 text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-500', selected ? 'border-teal-400 bg-teal-50 text-primary' : 'border-slate-200 bg-white/65 text-slate-600 hover:border-teal-200')} key={type} onClick={() => onExperimentTypeChange(type)} type="button">
                <span className="block text-sm font-black">{type === 'RAG' ? 'RAG' : 'Fine-tuned'}</span>
                <span className="mt-1 block text-xs font-medium leading-5">{type === 'RAG' ? 'Answer with retrieval from the frozen documents.' : 'Evaluate the configured Fine-tuned model.'}</span>
              </button>
            })}
          </div>
        </fieldset>
        <div className="grid gap-4 md:grid-cols-2">
          <FieldGroup label="Experiment name"><input aria-label="Experiment name" className="control" onChange={(event) => onExperimentNameChange(event.target.value)} placeholder="Example: RAG baseline / bge-m3" value={experimentName} /></FieldGroup>
          <FieldGroup hint="This value is sent unchanged to the current backend contract." label="Model name"><input aria-label="Model name" className="control" onChange={(event) => onModelChange(event.target.value)} placeholder="Example: qwen-rag-lora" value={llmModel} /></FieldGroup>
        </div>
        <Button disabled={submitting || !experimentName.trim() || !llmModel.trim()} type="submit"><Plus size={16} />Save configuration</Button>
      </form>

      <section aria-labelledby="saved-configurations-heading" className="mt-7 border-t border-slate-100 pt-5">
        <div>
          <h3 className="text-sm font-semibold text-slate-800" id="saved-configurations-heading">Saved configurations</h3>
          <p className="mt-1 text-xs font-medium text-slate-500">Select a configuration to review its readiness and launch it in Step 4.</p>
        </div>
        {datasetExperiments.length ? <div className="mt-3 grid gap-2">
          {datasetExperiments.map((experiment) => {
            const selected = selectedExperimentId === experiment.id
            return <button aria-pressed={selected} className={cn('flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3 text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-500', selected ? 'border-teal-400 bg-teal-50/80' : 'border-slate-200 bg-white/60 hover:border-teal-200')} key={experiment.id} onClick={() => onSelectExperiment(experiment)} type="button">
              <span><span className="block text-sm font-semibold text-slate-900">{experiment.name}</span><span className="mt-1 block text-xs font-medium text-slate-500">{experiment.method} / {experiment.llmModel}</span></span>
              <StatusBadge status={statusForBadge(experiment.status)} />
            </button>
          })}
        </div> : <p className="mt-3 rounded-xl border border-dashed border-slate-200 bg-white/45 p-4 text-sm font-medium text-slate-500">No configuration saved for this snapshot yet.</p>}
      </section>
    </StepPanel>
  )
}

export function PreflightLaunchStep({
  loadingReadiness,
  onPrevious,
  onRun,
  onViewRuns,
  questions,
  readiness,
  selectedDataset,
  selectedExperiment,
  submitting,
}) {
  if (!selectedDataset || !selectedExperiment) {
    return <BlockedStep description="Save and select a benchmark configuration in Step 3 before running the backend benchmark." onPrevious={onPrevious} title="Select a benchmark configuration" />
  }

  const isPending = selectedExperiment.status === 'PENDING'
  const isActive = ['QUEUED', 'RUNNING'].includes(selectedExperiment.status)
  const launchReady = Boolean(readiness?.ready || readiness?.benchmarkReady) && isPending

  return (
    <StepPanel
      eyebrow="Step 4 of 5"
      icon={CheckCircle2}
      subtitle="Review the immutable snapshot, chosen model, and backend readiness before starting a run."
      title="Review and launch"
    >
      <div className="grid gap-3 md:grid-cols-2">
        <SummaryTile label="Dataset snapshot" value={selectedDataset.name} />
        <SummaryTile label="Benchmark method" value={selectedExperiment.method} />
        <SummaryTile label="Model" value={selectedExperiment.llmModel} />
        <SummaryTile label="Question count" value={questions.length} />
      </div>

      <section aria-labelledby="readiness-heading" className="mt-7 border-t border-slate-100 pt-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-800" id="readiness-heading">Backend readiness</h3>
            <p className="mt-1 text-xs font-medium leading-5 text-slate-500">Checks apply to this {selectedExperiment.method} configuration, not to a global page setting.</p>
          </div>
          {readiness ? <span className={cn('rounded-lg px-2.5 py-1 text-xs font-semibold', readiness.ready ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-900')}>{readiness.ready ? 'Ready to launch' : 'Action required'}</span> : null}
        </div>
        <div aria-live="polite" className="mt-3 space-y-2">
          {loadingReadiness ? <div className="rounded-xl border border-slate-200 bg-white/60 p-4 text-sm font-medium text-slate-500">Checking backend readiness...</div> : null}
          {!loadingReadiness && (readiness?.checks ?? []).map((check) => <ReadinessCheck check={check} key={check.code} />)}
          {!loadingReadiness && !readiness ? <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm font-medium text-amber-900">Readiness is unavailable. Refresh this step before launching a benchmark.</div> : null}
        </div>
        {readiness?.requiresUnverifiedAcknowledgement ? <InlineNotice tone="warning"><strong className="block">RESEARCH ONLY / UNVERIFIED</strong>The adapter has not passed its quality gate. This run is allowed for research comparison and all results will retain the UNVERIFIED label.</InlineNotice> : null}
        <p className="mt-4 text-xs leading-5 text-slate-500">Faithfulness, answer relevancy, context precision, and context recall use official RAGAS evaluation. Token overlap remains an internal proxy; context metrics do not apply to Fine-tuned-only runs.</p>
      </section>

      <div className="mt-6 flex flex-wrap gap-2">
        {isPending ? <Button disabled={submitting || !launchReady} onClick={onRun} type="button"><Play size={16} />Run benchmark</Button> : null}
        {isActive ? <Button onClick={onViewRuns} type="button"><Play size={16} />View active run</Button> : null}
        {['COMPLETED', 'FAILED', 'CANCELLED'].includes(selectedExperiment.status) ? <Button onClick={onViewRuns} type="button" variant="secondary">View run status</Button> : null}
        {!isPending && !isActive && !['COMPLETED', 'FAILED', 'CANCELLED'].includes(selectedExperiment.status) ? <Button onClick={onViewRuns} type="button" variant="secondary">View run status</Button> : null}
      </div>
    </StepPanel>
  )
}

export function BenchmarkRunsStep({ datasetExperiments, onCancel, onCreateAnother, onRerun, questions, selectedExperimentId, submitting }) {
  return (
    <StepPanel
      eyebrow="Step 5 of 5"
      icon={Play}
      subtitle="Benchmark jobs continue in the backend when you navigate away. Monitor their status here and open the research report after completion."
      title="Monitor runs"
      actions={<Button onClick={onCreateAnother} size="sm" type="button" variant="secondary"><Plus size={14} />Add configuration</Button>}
    >
      {datasetExperiments.length ? <div className="mt-6 divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-white/60">
        {datasetExperiments.map((experiment) => <RunCard experiment={experiment} fallbackTotal={questions.length} key={experiment.id} onCancel={onCancel} onRerun={onRerun} selected={selectedExperimentId === experiment.id} submitting={submitting} />)}
      </div> : <EmptyState title="No benchmark configuration" description="Return to Step 3 to save a RAG or Fine-tuned configuration for this snapshot." action={<Button onClick={onCreateAnother} type="button"><Plus size={16} />Create configuration</Button>} />}
    </StepPanel>
  )
}

export function WorkflowSummary({ dataset, experiment, questions, stepState }) {
  const statusRows = [
    { label: 'Snapshot', value: dataset ? dataset.name : 'Not selected', complete: stepState[1] === 'complete' },
    { label: 'Ground truth', value: `${questions.length} question${questions.length === 1 ? '' : 's'}`, complete: stepState[2] === 'complete' },
    { label: 'Configuration', value: experiment ? experiment.name : 'Not saved', complete: stepState[3] === 'complete' },
    { label: 'Launch status', value: experiment ? statusForBadge(experiment.status) : 'Not started', complete: stepState[4] === 'complete' },
  ]

  return (
    <Panel className="p-5 xl:sticky xl:top-4">
      <p className="text-xs font-semibold uppercase tracking-[0.08em] text-teal-700">Workflow status</p>
      <h2 className="mt-1 text-xl font-black tracking-tight text-slate-950">Benchmark at a glance</h2>
      <dl className="mt-5 space-y-4">
        {statusRows.map((row) => <div className="flex items-start gap-3" key={row.label}>
          <span className={cn('mt-0.5 grid size-5 shrink-0 place-items-center rounded-full', row.complete ? 'bg-teal-100 text-primary' : 'bg-slate-100 text-slate-500')}>{row.complete ? <Check size={13} /> : <Circle size={11} />}</span>
          <div className="min-w-0"><dt className="text-xs font-semibold text-slate-500">{row.label}</dt><dd className="mt-0.5 truncate text-sm font-semibold text-slate-800" title={String(row.value)}>{row.value}</dd></div>
        </div>)}
      </dl>
      <p className="mt-6 border-t border-slate-100 pt-4 text-xs font-medium leading-5 text-slate-500">A run uses the selected snapshot and its frozen document set. Create another configuration to compare the same source fairly.</p>
    </Panel>
  )
}

function StepPanel({ actions, children, eyebrow, icon: Icon, subtitle, title }) {
  return <Panel className="overflow-hidden p-5 sm:p-6"><div className="pointer-events-none absolute inset-x-0 top-0 z-0 h-24 bg-gradient-to-r from-teal-100/50 via-white/10 to-transparent" /><div className="relative z-10"><div className="flex flex-wrap items-start justify-between gap-4"><div className="flex min-w-0 gap-3"><div className="grid size-11 shrink-0 place-items-center rounded-xl border border-teal-100 bg-teal-50 text-primary shadow-sm"><Icon size={20} /></div><div><p className="text-xs font-semibold uppercase tracking-[0.08em] text-teal-700">{eyebrow}</p><h1 className="mt-1 text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">{title}</h1><p className="mt-2 max-w-2xl text-sm font-medium leading-6 text-slate-600">{subtitle}</p></div></div>{actions ? <div className="shrink-0">{actions}</div> : null}</div>{children}</div></Panel>
}

function FieldGroup({ children, hint, label }) {
  return <div><label className="mb-1.5 block text-sm font-semibold text-slate-800">{label}</label>{children}{hint ? <p className="mt-1.5 text-xs font-medium leading-5 text-slate-500">{hint}</p> : null}</div>
}

function SnapshotSummary({ compact = false, dataset, documentCount }) {
  return <div className={cn('mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-teal-100 bg-teal-50/55', compact ? 'p-3' : 'p-4')}><div className="min-w-0"><p className="text-xs font-semibold uppercase tracking-[0.08em] text-teal-700">Selected snapshot</p><p className="mt-1 truncate text-sm font-black text-slate-900" title={dataset.name}>{dataset.name}</p><p className="mt-1 text-xs font-medium text-slate-600">{documentCount ?? 0} document{documentCount === 1 ? '' : 's'} / {dataset.status}</p></div><StatusBadge status={dataset.status} /></div>
}

function SummaryTile({ label, value }) {
  return <div className="rounded-xl border border-slate-200 bg-white/65 p-3"><p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">{label}</p><p className="mt-1 truncate text-sm font-black text-slate-900" title={String(value)}>{value}</p></div>
}

function InlineNotice({ children, tone }) {
  const tones = {
    error: 'border-red-200 bg-red-50 text-red-800',
    success: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    warning: 'border-amber-200 bg-amber-50 text-amber-900',
  }
  const Icon = tone === 'success' ? CheckCircle2 : tone === 'error' ? XCircle : LockKeyhole
  return <div className={cn('mt-4 flex items-start gap-3 rounded-xl border p-4 text-sm font-medium leading-6', tones[tone])} role={tone === 'error' ? 'alert' : 'status'}><Icon className="mt-0.5 shrink-0" size={17} /><div>{children}</div></div>
}

function BlockedStep({ description, onPrevious, title }) {
  return <EmptyState action={<Button onClick={onPrevious} type="button" variant="secondary">Return to previous step</Button>} description={description} title={title} />
}

function ReadinessCheck({ check }) {
  return <div className={cn('flex gap-3 rounded-xl border p-3 text-sm font-medium leading-6', check.passed ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-amber-200 bg-amber-50 text-amber-900')}>
    {check.passed ? <CheckCircle2 className="mt-0.5 shrink-0" size={17} /> : <XCircle className="mt-0.5 shrink-0" size={17} />}
    <span>{check.message}</span>
  </div>
}

function RunCard({ experiment, fallbackTotal, onCancel, onRerun, selected, submitting }) {
  const active = ['QUEUED', 'RUNNING'].includes(experiment.status)
  const completed = experiment.status === 'COMPLETED'
  const processed = experiment.successCount + experiment.failureCount
  const total = Number(experiment.benchmarkProfile?.questionCount ?? fallbackTotal ?? 0)
  const eta = estimateRemainingSeconds(experiment, processed, total)
  const profile = experiment.benchmarkProfile

  return <article className={cn('p-4 sm:p-5', selected && 'bg-teal-50/45')}>
    <div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><p className="truncate text-base font-black text-slate-950" title={experiment.name}>{experiment.name}</p><p className="mt-1 text-xs font-semibold text-slate-500">{experiment.method} / {experiment.llmModel}</p>{experiment.modelVerificationStatus === 'UNVERIFIED' ? <p className="mt-1 text-[11px] font-black text-amber-700">RESEARCH ONLY / UNVERIFIED</p> : null}</div><StatusBadge status={statusForBadge(experiment.status)} /></div>
    {active ? <div className="mt-4"><div className="mb-2 flex flex-wrap justify-between gap-2 text-xs font-semibold text-slate-600"><span>{experiment.status === 'QUEUED' ? 'Queued for GPU' : `Processed ${processed}/${total || '?'}`}</span><span>{experiment.status === 'RUNNING' && eta != null ? `${experiment.progress}% / ETA ${formatDuration(eta)}` : `${experiment.progress}%`}</span></div><div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-primary transition-[width] duration-500" style={{ width: `${Math.min(100, Math.max(0, experiment.progress))}%` }} /></div><p className="mt-2 text-xs font-medium text-slate-500">{profile ? `Full ${profile.questionCount} / Batch ${profile.batchSize} / ${profile.maxNewTokens} tokens` : 'Full benchmark / Batch 1 / 192 tokens'}</p></div> : null}
    {experiment.status === 'PENDING' ? <p className="mt-3 text-sm font-medium text-sky-800">Ready to launch from Step 4.</p> : null}
    {experiment.status === 'QUEUED' ? <p className="mt-3 text-sm font-medium text-slate-700">Waiting for the current GPU job to finish.</p> : null}
    {experiment.status === 'CANCELLED' ? <p className="mt-3 text-sm font-medium text-slate-700">Cancelled at {experiment.progress}%. You can rerun it from the beginning.</p> : null}
    {experiment.errorMessage ? <p className="mt-3 text-sm font-medium leading-6 text-red-700">{experiment.errorMessage}</p> : null}
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3"><p className="text-xs font-medium text-slate-500">{experiment.successCount} succeeded / {experiment.failureCount} failed</p><div className="flex flex-wrap gap-2">{active ? <Button disabled={submitting} onClick={() => onCancel(experiment)} size="sm" type="button" variant="danger"><Square size={13} />Cancel run</Button> : null}{['FAILED', 'CANCELLED'].includes(experiment.status) ? <Button disabled={submitting} onClick={() => onRerun(experiment)} size="sm" type="button" variant="secondary"><Play size={13} />Rerun</Button> : null}{completed ? <Link className="inline-flex min-h-8 items-center justify-center rounded-xl border border-border bg-white/90 px-3 text-xs font-black text-primary shadow-sm transition hover:border-teal-200 hover:bg-teal-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-500" to="/admin/research-dashboard">Open research report</Link> : null}</div></div>
  </article>
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
  return `${minutes}m ${seconds % 60}s`
}
