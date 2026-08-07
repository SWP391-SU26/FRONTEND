# Workflow 5 Frontend Plan

Scope: Evaluation, benchmark, result review, and fine-tuning frontend only.

Backend rule:

- Do not modify backend code.
- Use existing APIs exactly as currently implemented in the Spring controllers.
- If a backend endpoint fails because the required data is missing, show the backend reason clearly in the frontend.

UI language rule:

- All visible UI text must be English.
- Vietnamese can appear in this planning document, but not in labels, buttons, headings, placeholders, alerts, or page copy.

## Current Backend Contract

All JSON APIs are under:

```text
/api
```

Evaluation APIs:

```text
GET  /api/evaluation/datasets
POST /api/evaluation/datasets
GET  /api/evaluation/datasets/{datasetId}/questions
POST /api/evaluation/questions
POST /api/evaluation/datasets/{datasetId}/questions/import
GET  /api/evaluation/experiments
POST /api/evaluation/experiments
POST /api/evaluation/experiments/{experimentId}/run
GET  /api/evaluation/experiments/{experimentId}/results
```

Fine-tuning APIs:

```text
POST /api/fine-tuning/export-jsonl/{datasetId}
GET  /api/fine-tuning/files
POST /api/fine-tuning/experiments
```

Supporting APIs used by this workflow:

```text
GET /api/courses
GET /api/courses/workspaces
GET /api/rag/embedding-models
GET /api/documents/workspace/{workspaceId}?requesterId={userId}
```

## Important Contract Changes From The Code

`POST /api/evaluation/datasets` now requires `workspaceId`.

Request:

```json
{
  "datasetName": "AI101 benchmark set",
  "courseId": "uuid",
  "workspaceId": "uuid",
  "createdBy": "uuid"
}
```

Response fields:

```text
datasetId, courseId, workspaceId, datasetName, datasetVersion, description,
createdBy, createdAt, updatedAt
```

`POST /api/evaluation/questions` only accepts the core manual question fields.

Request:

```json
{
  "datasetId": "uuid",
  "questionText": "Question text",
  "groundTruthAnswer": "Expected answer"
}
```

Response fields include backend defaults:

```text
evaluationQuestionId, datasetId, courseId, chapterId, questionNo, questionText,
groundTruthAnswer, expectedDocumentId, expectedPage, questionType, difficulty,
createdAt
```

`POST /api/evaluation/experiments` does not accept separate frontend-only RAG fields such as `embeddingModelId`, `chunkingStrategy`, `generationMode`, `topK`, `temperature`, or `seed`.

Request:

```json
{
  "datasetId": "uuid",
  "experimentName": "RAG baseline",
  "experimentType": "RAG",
  "llmModel": "java-rag",
  "configJson": "{\"embeddingModelId\":\"uuid\",\"chunkingStrategy\":\"PARAGRAPH_700_120\",\"topK\":5,\"temperature\":0.2}",
  "createdBy": "uuid"
}
```

Response fields:

```text
experimentId, datasetId, courseId, workspaceId, experimentName, experimentType,
llmModel, embeddingModelId, chunkingStrategy, topK, temperature,
fineTunedModelName, configJson, status, createdBy, startedAt, completedAt,
createdAt, updatedAt
```

Note: current backend service stores `llmModel`, `configJson`, `topK=5`, and `temperature=0.2`. The separate entity fields for embedding and chunking exist, but this controller/service path does not populate them from the request.

`POST /api/evaluation/experiments/{experimentId}/run` is implemented.

Behavior:

- Fails if the dataset has no questions.
- Fails if the experiment has no `workspaceId`.
- Fails if the experiment has no `createdBy`.
- Runs Java RAG or fine-tuned answer mode through `ChatService`.
- Deletes old result rows for the experiment before running.
- Sets experiment status to `RUNNING`, then `COMPLETED` or `FAILED`.
- Writes rows into `experiment_results`.

`GET /api/evaluation/experiments/{experimentId}/results` returns result rows and enriches them with transient `questionText` and `groundTruthAnswer`.

Result fields:

```text
experimentResultId, experimentId, evaluationQuestionId, generatedAnswer,
retrievedContextJson, citationsJson, faithfulness, answerRelevance,
contextPrecision, contextRecall, answerCorrectness, semanticSimilarity,
latencyMs, inputTokens, outputTokens, totalTokens, cost, errorMessage,
createdAt, questionText, groundTruthAnswer
```

`POST /api/fine-tuning/experiments` creates an experiment row with `experimentType = FINE_TUNING`.

Request:

```json
{
  "name": "Fine-tuning run",
  "datasetId": "uuid",
  "researcherId": "uuid",
  "llmModel": "fine-tuned-model-name",
  "configJson": "{}"
}
```

## Current Frontend Gaps Found In Code

In `src/services/evaluationService.js`:

- `createDataset()` already sends `createdBy` from `getCurrentUserId()`, but does not guard against missing user ID before submitting.
- `runBenchmark()` assumes a generic job response, while backend returns an `Experiment` object.
- `waitForExperiment()` polls `/evaluation/experiments`, but `runBenchmark()` is synchronous in the current backend. Polling can stay as a refresh helper, but should not be presented as an async job queue.
- `toUiExperiment()` does not expose `llmModel`, so the Research Dashboard can display `No model name` even when backend returns one.
- `toUiExperimentResult()` does not expose `questionText`, `groundTruthAnswer`, token fields, or raw JSON fields, even though backend returns them.

In `src/pages/admin/AdminTestSetPage.jsx`:

- Dataset creation allows `workspaceId` to be empty, but backend now requires it.
- The experiment modal asks for `Embedding model`, `Chunking strategy`, `Generation mode`, `Top K`, `Temperature`, and `Seed`; backend only accepts `llmModel` and `configJson` for this endpoint. These inputs must either be removed from the direct contract or written into `configJson`.
- Experiment creation currently requires `experimentEmbeddingModelId`, even though backend does not require or store it through this API.
- The experiment table shows `generationMode`, `embeddingModelName`, and `chunkingStrategy`, which are often blank because backend does not populate them.
- `Run benchmark` should be allowed only when the selected dataset has questions and a workspace.

In `src/pages/admin/AdminPages.jsx` Research Dashboard:

- Metrics are computed from real result rows, which matches the backend.
- Empty result copy still says the backend execution endpoint may be unavailable; this is outdated.
- Result table shows only question IDs, not `questionText` or `groundTruthAnswer`, even though backend now returns them.
- `Configuration comparison` depends on `getEvaluationDashboard()`, which is a frontend stub and returns empty data. Keep it hidden unless a real backend endpoint is added.

## Target Pages

Primary page:

```text
/admin/test-sets
```

Purpose:

- Create and select evaluation datasets.
- Add or import ground-truth questions.
- Review questions.
- Export dataset JSONL.
- Create RAG experiment records.
- Run backend benchmark execution.
- Create fine-tuning experiment records.

Secondary page:

```text
/admin/research-dashboard
```

Purpose:

- List backend experiment records.
- Select an experiment.
- Load real result rows.
- Compute summary metrics from real rows only.
- Show empty/failed/pending states when results are not available.

## Post-run Experiment Evaluation Swimlane

Sơ đồ gồm 3 cột actor và 14 bước, bắt đầu sau khi người dùng xác nhận
`Run Experiment`. Phạm vi chỉ gồm chạy experiment trên dataset đã chuẩn bị, đánh
giá từng kết quả, rồi so sánh một RAG run với một Fine-tuned run trên cùng dataset
snapshot và benchmark profile. Các nhãn trong sơ đồ giữ bằng tiếng Anh theo UI
language rule của dự án.

PlantUML source: [`WORKFLOW_5_SWIMLANE.puml`](WORKFLOW_5_SWIMLANE.puml).

Render the source directly with a PlantUML extension, or include it from this
document:

```plantuml
!include WORKFLOW_5_SWIMLANE.puml
```

### What Is Evaluated And How It Is Summarized

| Evaluation target | Evidence used | Per-question evaluation | Dashboard summary |
|---|---|---|---|
| Answer quality | Question, generated answer, ground truth | Answer relevance; token-overlap proxy stored as answer correctness and semantic similarity | Average quality by run and per-question RAG/Fine-tuned delta |
| RAG grounding | Retrieved contexts and citations | Faithfulness, context precision, context recall, source hit, page hit | Average RAG grounding and hit rates; not treated as applicable to Fine-tuned-only output |
| Out-of-scope behavior | Question marked out of scope and generated answer | Refusal correctness | Refusal accuracy |
| Reliability | Successful or failed result for every question | Error message and result availability | Success rate, success count, failure count, partial-result warning |
| Performance | Timings and runtime telemetry | Effective latency, batch latency, throughput, peak VRAM | Average latency and throughput plus run metadata |
| Reproducibility | Dataset checksum, benchmark profile, model/adapter/embedding/prompt versions | Verification status and quality-gate evidence | Comparison is allowed only for the same dataset snapshot and benchmark profile |

Tổng kết không tạo một điểm số duy nhất. Dashboard giữ riêng các nhóm chất lượng,
grounding, độ tin cậy và hiệu năng; sau đó so sánh RAG với Fine-tuned theo cả trung
bình toàn bộ run lẫn từng câu hỏi. Kết luận phải kèm giới hạn của dataset và không
diễn giải `token-overlap proxy` như một metric RAGAS.

## Updated Implementation Plan

### Step 1 - Align `evaluationService.js` With Backend Shapes

Keep this service surface:

```text
getDatasets()
createDataset()
importQuestions()
getQuestions(datasetId)
addQuestion()
getExperiments()
getExperiment(experimentId)
createExperiment()
runBenchmark(experimentId)
getExperimentResults(experimentId)
exportJsonl(datasetId)
getFineTuningFiles()
createFineTuningRecord()
```

Changes:

- Add frontend validation for missing `createdBy` before create dataset / experiment / fine-tuning record.
- Make `runBenchmark()` return `toUiExperiment()` from the backend `Experiment` response.
- Keep `waitForExperiment()` optional, but do not rely on fake job fields.
- Add `llmModel`, `courseId`, `workspaceId`, `createdBy`, `updatedAt`, and `fineTunedModelName` to `toUiExperiment()`.
- Add `questionText`, `groundTruthAnswer`, `retrievedContextJson`, `citationsJson`, `inputTokens`, `outputTokens`, and `totalTokens` to `toUiExperimentResult()`.

Acceptance:

- No page component needs to know raw backend field names except through service results.
- Research Dashboard can show model name and actual question text.
- Benchmark completion refreshes from real backend data.

### Step 2 - Fix Dataset Creation Requirements

Update `/admin/test-sets` dataset creation:

- Require `datasetName`, `courseId`, `workspaceId`, and current user ID.
- Filter workspace options by selected course.
- Clear or update selected workspace when course changes and the current workspace does not belong to that course.
- Remove the "No workspace" option for dataset creation because backend rejects null `workspaceId`.

Acceptance:

- Dataset creation request always matches backend validation.
- If no signed-in user exists, show `Sign in before creating a dataset.`
- If no workspace exists for the selected course, show a clear state and disable submit.

### Step 3 - Keep Question Flow Contract-Accurate

Manual add:

```json
{
  "datasetId": "uuid",
  "questionText": "Question text",
  "groundTruthAnswer": "Expected answer"
}
```

CSV import:

```text
POST /api/evaluation/datasets/{datasetId}/questions/import
```

Supported CSV headers from backend:

```text
question or question_text
expected_answer or ground_truth_answer or answer
expected_page or page
category or question_type or type
difficulty
```

Acceptance:

- Manual question creation updates the local list immediately.
- CSV import refreshes questions from backend.
- Question table shows `questionNo`, `questionText`, `difficulty`, `questionType`, `expectedPage`, and `groundTruthAnswer` when available.

### Step 4 - Redesign Experiment Creation Around `llmModel` + `configJson`

Update experiment creation UI to match the backend request.

Required visible fields:

```text
Experiment name
Experiment type
LLM model
Config JSON
```

Optional helper controls:

```text
Embedding model
Chunking strategy
Top K
Temperature
Seed
Generation mode
```

If helper controls remain, they must be merged into `configJson` before submit instead of being sent as top-level fields.

Final API request:

```json
{
  "datasetId": "uuid",
  "experimentName": "RAG baseline",
  "experimentType": "RAG",
  "llmModel": "java-rag",
  "configJson": "{\"embeddingModelId\":\"uuid\",\"topK\":5}",
  "createdBy": "uuid"
}
```

Acceptance:

- Frontend blocks invalid JSON before submit.
- Created experiment appears in the experiment list with `PENDING`.
- UI labels do not imply backend stored fields that it does not store.

### Step 5 - Run Benchmark As A Real Synchronous Backend Action

Update run behavior:

- Disable `Run benchmark` when there is no selected dataset, no workspace, no questions, or the experiment is already running.
- Call `POST /api/evaluation/experiments/{experimentId}/run`.
- Treat success response as the updated experiment.
- Refresh experiments and results after success.
- Show backend failure reasons directly, especially:
  - `Cannot run benchmark because dataset has no questions.`
  - `Cannot run RAG benchmark because experiment has no workspaceId.`
  - `Cannot run RAG benchmark because experiment has no createdBy user.`

Acceptance:

- No copy says benchmark execution is unavailable.
- No fake/demo metrics are mixed with real benchmark output.
- Failed experiments remain visible with `FAILED` status after refresh.

### Step 6 - Upgrade Research Dashboard Results

Use:

```text
GET /api/evaluation/experiments/{experimentId}/results
```

Display:

- Experiment name, type, status, `llmModel`, dataset ID, workspace ID.
- Real result row count.
- Average metrics from result rows only.
- Question text and ground truth answer.
- Generated answer.
- Faithfulness, answer relevance, context precision, context recall, answer correctness, semantic similarity.
- Latency, cost, token counts, and error message.

Acceptance:

- If status is `PENDING`, show `Run this experiment from Test Set / Ground Truth to generate result rows.`
- If status is `FAILED`, show the failed state and ask the user to check the benchmark error.
- If status is `COMPLETED` but no rows exist, show `The experiment completed, but no result rows were returned.`
- Remove or hide frontend-only dashboard comparison unless real backend data is available.

### Step 7 - Keep Fine-tuning Flow As Record + Export

Use:

```text
POST /api/fine-tuning/export-jsonl/{datasetId}
GET  /api/fine-tuning/files
POST /api/fine-tuning/experiments
```

Frontend behavior:

- Export JSONL downloads backend file content.
- Fine-tuning file list shows backend-generated file names.
- Create fine-tuning experiment record with `name`, `datasetId`, `researcherId`, `llmModel`, and `configJson`.
- Label this as a record, not a real provider fine-tuning job.

Acceptance:

- User can export a selected dataset as JSONL.
- User can create a fine-tuning experiment record.
- Fine-tuning records appear in the same experiment list with `FINE_TUNING`.

### Step 8 - Demo Flow Alignment

Final frontend should support this flow:

```text
1. Open Research / Test Sets.
2. Select a course and workspace.
3. Create or select a dataset.
4. Add manual questions or import CSV.
5. Export JSONL for fine-tuning.
6. Create a RAG experiment record with llmModel and configJson.
7. Run benchmark against the backend Java RAG path.
8. Create a fine-tuning experiment record.
9. Open Research Dashboard.
10. Select the experiment and review real result rows.
```

Acceptance:

- Every button in the demo flow calls a real backend API.
- No Vietnamese visible UI text is introduced.
- Page remains usable for empty, pending, running, failed, and completed states.

## Suggested Task Order

1. Refactor `evaluationService.js` mappers for experiment and result fields.
2. Fix dataset creation to require workspace and signed-in user.
3. Simplify or remap experiment creation UI to `llmModel` plus `configJson`.
4. Update benchmark run handling to use the returned `Experiment` object.
5. Update experiment table columns to show backend-populated fields.
6. Upgrade Research Dashboard result rows and empty-state copy.
7. Keep fine-tuning record/export flow, but label it as record/export only.
8. Run `npm run build` and `npm run lint`.

## Out Of Scope

- Changing backend request/response shapes.
- Adding database fields or custom DTOs.
- Implementing external provider fine-tuning jobs.
- Implementing official RAGAS evaluation.
- Adding a real `/api/evaluation/dashboard` endpoint.
