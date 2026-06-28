# Workflow 3 Frontend Plan

Scope: Document Upload & Processing frontend only.

Backend rule:

- Do not modify backend code.
- Use existing document APIs exactly as documented or currently implemented.
- If a backend endpoint returns an error or does not provide a field, show a clear frontend state instead of fabricating document data.

UI language rule:

- All visible UI text must be English.
- Vietnamese can appear in this planning document, but not in labels, buttons, headings, placeholders, alerts, or page copy.

## Current API Coverage

Already connected in `src/services/documentService.js`:

```text
GET    /api/documents?requesterId={userId}
GET    /api/documents/workspace/{workspaceId}?requesterId={userId}
GET    /api/documents/{documentId}?requesterId={userId}
GET    /api/documents/{documentId}/pages?requesterId={userId}
GET    /api/documents/{documentId}/chunks?requesterId={userId}
GET    /api/documents/{documentId}/file?requesterId={userId}
GET    /api/documents/{documentId}/preview?requesterId={userId}
POST   /api/documents/upload
DELETE /api/documents/{documentId}?requesterId={userId}
```

Related supporting APIs already used:

```text
GET /api/courses
GET /api/courses/workspaces
GET /api/courses/{courseId}/chapters
GET /api/courses/{courseId}/workspaces
GET /api/rag/embedding-models
POST /api/rag/embeddings/prepare
```

Important distinction:

- Workflow 3 covers document upload, storage, extraction, pages, chunks, preview, and deletion.
- `POST /api/rag/embeddings/prepare` belongs to Workflow 4/RAG preparation. It can stay as a convenience action, but the UI must label it as embedding/index preparation, not normal document upload processing.

## Target Pages

Primary page:

```text
/library
```

Purpose:

- Select a workspace.
- Upload course documents with `workspaceId`, `courseId`, `chapterId`, and `uploadedBy`.
- List documents in the selected workspace.
- Filter/search by course, file type, and status.
- Delete documents.
- Trigger embedding preparation when available.

Secondary page:

```text
/library/documents/:id
```

Purpose:

- Show document metadata.
- Show preview/file iframe when backend preview is available.
- Show extracted chunks.
- Add extracted pages view because the backend already exposes `/pages`.
- Delete document.

Admin page:

```text
/admin/documents
```

Purpose:

- Show all accessible backend documents for the current requester.
- Show status, pages, chunks, and delete/re-index actions.

## Implementation Plan

### Step 1 - Clean Document Service Contract

Update `src/services/documentService.js` so all document APIs have one clear frontend surface:

```text
getDocuments()
getDocumentsByWorkspace(workspaceId)
getDocument(documentId)
getDocumentPages(documentId)
getDocumentChunks(documentId)
deleteDocument(documentId)
getDocumentFileUrl(documentId)
getDocumentPreviewUrl(documentId)
uploadDocument(payload)
```

Acceptance:

- No document API URLs are manually duplicated inside page components.
- Upload uses `FormData`.
- `Content-Type` is not manually set for upload.
- Missing `requesterId` produces a clear frontend error before calling protected document APIs.

### Step 2 - Normalize Document Status Honestly

Review mapping in `toUiStatus()`:

```text
PROCESSED -> Processed
PROCESSING -> Processing
FAILED -> Failed
NO_TEXT -> Uploaded
INDEXED -> Indexed
```

Decision:

- If backend only returns `PROCESSED` after extraction/chunking, frontend should not imply embeddings exist.
- Document list can show both:

```text
Processing status: Processed
Embedding status: Not prepared / Prepared
```

Acceptance:

- Uploaded documents do not automatically show as `Indexed` unless backend explicitly returns `INDEXED` or embedding preparation succeeds.
- The chat/workspace can still consider `Processed` documents usable for reading, but RAG readiness should be visually separate.

### Step 3 - Complete Upload Flow

Improve `/library` upload modal:

- Require workspace.
- Auto-derive `courseId` from selected workspace when possible.
- Allow optional `chapterId`.
- Send `uploadedBy` from `getSavedUser()?.id`.
- Validate accepted file types against backend-supported types:

```text
PDF, DOCX, PPTX, TXT
```

Acceptance:

- User cannot submit upload without a workspace.
- If backend requires `courseId`, frontend always sends it from the selected workspace or selected course.
- Failed upload shows backend message inline, not only console output.
- Successful upload inserts returned backend document into the list and refreshes chunks count.

### Step 4 - Improve Workspace Document List

Keep `/library` as the main Workflow 3 demo screen.

Must show:

- Workspace selector.
- Course/file type/status filters.
- Search by filename/title.
- Document cards/table.
- File type.
- Processing status.
- Page count.
- Chunk count.
- Uploaded date.
- Delete action.
- View detail action.

Acceptance:

- Empty state distinguishes `No workspace found` from `No documents in this workspace`.
- Refresh reloads real backend data.
- No mock upload rows remain after page refresh.

### Step 5 - Add Extracted Pages View

The backend exposes:

```text
GET /api/documents/{documentId}/pages?requesterId={userId}
```

Add a page/text tab or panel to `/library/documents/:id`.

Suggested tabs:

```text
Preview
Pages
Chunks
Metadata
```

Acceptance:

- Pages panel lists `pageNumber`, `wordCount`, `charCount`, and extracted text.
- If no pages are returned, show an empty state.
- Chunk panel remains available and searchable.

### Step 6 - Fix Preview States And UI Language

Current detail page has some visible Vietnamese strings. Replace them with English.

Preview behavior:

- PDF uses `/file`.
- DOCX/PPTX uses `/preview`.
- If preview request fails, show an English message explaining that preview is unavailable.

Acceptance:

- No Vietnamese visible text remains in `/library` or `/library/documents/:id`.
- Preview loading, success, and unavailable states are clear.
- The browser iframe is only rendered when preview/file endpoint is reachable.

### Step 7 - Clarify Re-index / Prepare Embeddings

Current UI has `Re-index`, which calls:

```text
POST /api/rag/embeddings/prepare
```

Frontend behavior:

- Rename action to `Prepare embeddings` or `Prepare RAG index`.
- Keep it clearly separate from document extraction.
- If no embedding model exists, show a clear error.

Acceptance:

- User understands upload processing and RAG embedding preparation are different steps.
- Status update after this action only changes embedding readiness, not the original document processing status.

### Step 8 - Admin Document Management Polish

Improve `/admin/documents`:

- Load all documents visible to requester.
- Show chunks count from `/chunks`.
- Show pages count from document metadata.
- Delete document using backend API.
- Offer `Prepare embeddings` when embedding model exists.

Acceptance:

- Admin can inspect document records from backend only.
- Delete removes the row from UI after backend success.
- Errors stay inline.

### Step 9 - Demo Script Alignment

Make the final frontend support this presentation flow:

```text
1. Open Library.
2. Select a workspace.
3. Upload a PDF/DOCX/PPTX/TXT document.
4. Show returned document status, page count, and chunk count.
5. Open document detail.
6. Show preview if available.
7. Show extracted pages.
8. Show chunks.
9. Prepare embeddings for RAG if needed.
10. Delete a document and show the list updates.
```

Acceptance:

- Every button in the demo flow either calls a real backend API or is disabled with an honest explanation.
- No Vietnamese visible UI text is introduced.
- Page remains usable when preview, pages, or chunks are empty.

## Suggested Task Order

1. Refactor `documentService.js` to validate requester ID and normalize document/pages/chunks shapes.
2. Replace visible Vietnamese text in `DocumentDetailPage.jsx`.
3. Add extracted pages state and UI to `DocumentDetailPage.jsx`.
4. Adjust status mapping so `PROCESSED` does not automatically mean `Indexed`.
5. Improve `/library` upload validation and post-upload refresh.
6. Rename `Re-index` actions to `Prepare embeddings`.
7. Polish `/admin/documents` statuses and action labels.
8. Run `npm run build` and `npm run lint`.

## Out Of Scope

- Changing backend document processing.
- Changing Cloudinary or file storage behavior.
- Implementing real asynchronous processing jobs.
- Changing RAG retrieval/chat behavior.
- Adding new backend APIs.
