# Workflow 5 Frontend Plan

Scope: Evaluation, Benchmark & Fine-tuning frontend only.

Backend rule:

- Do not modify backend code.
- Use existing APIs exactly as currently documented or implemented.
- If a backend endpoint exists but is not fully implemented, show a clear frontend state instead of pretending the workflow is complete.

UI language rule:

- All visible UI text must be English.
- Vietnamese can appear in this planning document, but not in labels, buttons, headings, placeholders, alerts, or page copy.

## Current API Coverage

Already connected in `src/services/evaluationService.js`:

```text
GET  /api/evaluation/datasets
POST /api/evaluation/datasets
GET  /api/evaluation/datasets/{datasetId}/questions
POST /api/evaluation/questions
GET  /api/evaluation/experiments
POST /api/evaluation/experiments
GET  /api/fine-tuning/files
POST /api/fine-tuning/export-jsonl/{datasetId}
POST /api/fine-tuning/experiments
```

Partly connected or not finished:

```text
POST /api/evaluation/experiments/{experimentId}/run
GET  /api/evaluation/experiments/{experimentId}/results
```

Important backend limitation:

- `POST /api/evaluation/experiments/{experimentId}/run` exists in the workflow docs, but backend logic is described as an AI/Python integration point.
- Frontend should expose the action, call it only if we choose real integration mode, and handle `UnsupportedOperationException` / 500 / 501 gracefully.
- For demo mode, frontend can keep a labelled simulation state, but the UI must not imply that real backend benchmark execution happened.

## Target Pages

Primary page:

```text
/admin/test-sets
```

Purpose:

- Create and select evaluation datasets.
- Add ground-truth questions.
- Review questions.
- Export dataset JSONL.
- Create benchmark experiments.
- Create fine-tuning experiment records.

Secondary page:

```text
/admin/research-dashboard
```

Purpose:

- List experiments.
- Select an experiment.
- Load real result records when available.
- Fall back to clearly labelled reference/demo metrics when backend results are empty.

## Implementation Plan

### Step 1 - Clean API Service Contract

Update `src/services/evaluationService.js` so Workflow 5 has one clear API surface:

```text
getDatasets()
createDataset()
getQuestions(datasetId)
addQuestion()
getExperiments()
createExperiment()
runBenchmark(experimentId)
getExperimentResults(experimentId)
exportJsonl(datasetId)
getFineTuningFiles()
createFineTuningRecord()
```

Acceptance:

- No evaluation API calls are hardcoded inside page components unless the service does not fit.
- File download stays in `exportJsonl()`.
- `runBenchmark()` catches unsupported backend responses and returns a frontend-friendly error.

### Step 2 - Fix Dataset Creation Data

Replace hardcoded `createdBy` values with the current saved user:

```js
const user = getSavedUser()
createdBy: user?.id
```

Acceptance:

- Dataset creation uses the logged-in user.
- If no user exists, show an English error such as `Sign in before creating a dataset.`

### Step 3 - Complete Dataset And Question Flow

Improve `/admin/test-sets` around the existing dataset and question APIs:

- Load datasets, courses, and workspaces.
- Create dataset with `datasetName`, `courseId`, `workspaceId`, `createdBy`.
- Select dataset and load questions.
- Add question with `datasetId`, `questionText`, `groundTruthAnswer`.
- Show empty, loading, and error states.
- Disable actions when required IDs are missing.

Acceptance:

- User can create a dataset and immediately see it selected.
- User can add a question and see it in the list without refreshing.
- Errors from backend are displayed in page UI, not only `alert()`.

### Step 4 - Add Experiment Creation UI

Add a compact experiment creation panel/modal on `/admin/test-sets`:

Fields:

```text
Experiment name
Dataset
Experiment type: RAG or FINE_TUNING
LLM model
Config JSON
```

API mapping:

```text
POST /api/evaluation/experiments
```

Request:

```json
{
  "datasetId": "uuid",
  "experimentName": "RAG baseline",
  "experimentType": "RAG",
  "llmModel": "gpt-4o-mini",
  "configJson": "{}",
  "createdBy": "current-user-id"
}
```

Acceptance:

- Created experiment appears in the experiment list.
- Invalid JSON config is blocked on frontend before submit.
- If backend only stores `PENDING`, frontend shows `Pending`, not fake completed metrics.

### Step 5 - Handle Benchmark Run Honestly

Add a `Run benchmark` action for selected experiments.

Frontend behavior:

- Call `POST /api/evaluation/experiments/{experimentId}/run` through `runBenchmark()`.
- If backend returns success, show `Benchmark started`.
- If backend returns unsupported/500, show a clear status:

```text
Benchmark execution is not available yet. The experiment record was created successfully.
```

Optional demo mode:

- Keep simulation only as a clearly labelled `Demo run` action.
- Do not mix simulated metrics with real backend results.

Acceptance:

- No silent `setTimeout()` pretending a real benchmark finished.
- User can distinguish real backend benchmark from demo simulation.

### Step 6 - Load And Present Experiment Results

Use:

```text
GET /api/evaluation/experiments/{experimentId}/results
```

Frontend behavior:

- If results exist, compute summary metrics from real records.
- If results are empty, show an empty state.
- If using reference/demo metrics, label them as reference data.

Acceptance:

- Research dashboard does not confuse reference metrics with real experiment results.
- Result table shows generated answer, metrics, latency, cost, and error message when present.

### Step 7 - Complete Fine-tuning Flow

Add or complete UI for:

```text
POST /api/fine-tuning/export-jsonl/{datasetId}
GET  /api/fine-tuning/files
POST /api/fine-tuning/experiments
```

Frontend behavior:

- Export JSONL downloads a file.
- Fine-tuning file list shows backend-generated file names.
- Create fine-tuning record from selected dataset.

Acceptance:

- User can export a dataset as JSONL from the selected dataset.
- User can create a fine-tuning experiment record with `name`, `datasetId`, `researcherId`, `llmModel`, `configJson`.
- Fine-tuning records appear in experiments list as `Fine-tuning`.

### Step 8 - Demo Script Alignment

Make the final frontend support this presentation flow:

```text
1. Open Research / Test Sets.
2. Create or select a dataset.
3. Add ground-truth questions.
4. Export JSONL for fine-tuning.
5. Create a RAG experiment record.
6. Attempt benchmark run and show current backend limitation if unavailable.
7. Create a fine-tuning experiment record.
8. Open Research Dashboard and show experiment list/results/reference view.
```

Acceptance:

- Every button in the demo flow either calls a real backend API or is explicitly marked as demo/reference.
- No Vietnamese visible UI text is introduced.
- Page remains usable when benchmark results are empty.

## Suggested Task Order

1. Refactor `evaluationService.js` to include `runBenchmark()` and `getExperimentResults()`.
2. Replace hardcoded user IDs in Workflow 5 pages.
3. Improve `/admin/test-sets` error/loading states.
4. Add experiment creation UI.
5. Add benchmark run handling with honest unsupported-state messaging.
6. Add fine-tuning record creation and file list UI.
7. Review `/admin/research-dashboard` labels so real and reference data are clearly separated.
8. Run `npm run build` and `npm run lint`.

## Out Of Scope

- Implementing AI benchmark execution.
- Fixing backend `UnsupportedOperationException`.
- Adding database fields or changing API response shapes.
- Implementing real fine-tuning jobs with external providers.
