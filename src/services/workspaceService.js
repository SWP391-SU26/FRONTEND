import { request } from './httpClient.js'

function toUiWorkspace(workspace) {
  return {
    id: workspace.workspaceId,
    title: workspace.workspaceTitle,
    description: workspace.description ?? '',
    createdAt: workspace.createdAt,
  }
}

function toUiStorageUsage(usage) {
  return {
    usedBytes: Number(usage.usedBytes ?? 0),
    maxStorageBytes: Number(usage.maxStorageBytes ?? 0),
    documentCount: Number(usage.documentCount ?? 0),
    maxDocuments: Number(usage.maxDocuments ?? 0),
    maxFileBytes: Number(usage.maxFileBytes ?? 0),
    workspaceCount: Number(usage.workspaceCount ?? 0),
    maxPersonalWorkspaces: Number(usage.maxPersonalWorkspaces ?? 0),
  }
}

/** REQ-02 WS-US-02: quota visibility before an upload gets rejected. */
export async function getStorageUsage() {
  return toUiStorageUsage(await request('/me/storage-usage'))
}

export async function getPersonalWorkspaces() {
  const workspaces = await request('/me/personal-workspaces')
  return (Array.isArray(workspaces) ? workspaces : []).map(toUiWorkspace)
}

export async function createPersonalWorkspace({ workspaceTitle, description }) {
  return toUiWorkspace(await request('/me/personal-workspaces', {
    method: 'POST',
    body: JSON.stringify({ workspaceTitle, description }),
  }))
}

export async function renamePersonalWorkspace(workspaceId, { workspaceTitle, description }) {
  return toUiWorkspace(await request(`/me/personal-workspaces/${workspaceId}`, {
    method: 'PATCH',
    body: JSON.stringify({ workspaceTitle, description }),
  }))
}

export async function deletePersonalWorkspace(workspaceId) {
  await request(`/me/personal-workspaces/${workspaceId}`, { method: 'DELETE' })
}

/** REQ-02 WS-US-03: cross-workspace document transfer without re-uploading. */
export async function moveDocumentToWorkspace(documentId, workspaceId) {
  return request(`/documents/${documentId}/workspace`, {
    method: 'PATCH',
    body: JSON.stringify({ workspaceId }),
  })
}
