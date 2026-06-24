import { request } from './httpClient.js'

export async function getCourses() {
  const result = await request('/courses')
  const list = Array.isArray(result) ? result : (result?.data ?? [])
  return list.map(toUiCourse)
}

export async function getChapters(courseId) {
  const result = await request(`/courses/${courseId}/chapters`)
  const list = Array.isArray(result) ? result : (result?.data ?? [])
  return list.map(toUiChapter)
}

export async function getWorkspaces() {
  const result = await request('/courses/workspaces')
  const list = Array.isArray(result) ? result : (result?.data ?? [])
  return list.map(toUiWorkspace)
}

export async function getWorkspacesByCourse(courseId) {
  const result = await request(`/courses/${courseId}/workspaces`)
  const list = Array.isArray(result) ? result : (result?.data ?? [])
  return list.map(toUiWorkspace)
}

export async function createCourse(payload) {
  const result = await request('/courses', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  const course = result?.data ?? result
  return toUiCourse(course)
}

export async function createChapter(courseId, payload) {
  const result = await request(`/courses/${courseId}/chapters`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  const chapter = result?.data ?? result
  return toUiChapter(chapter)
}

export async function createWorkspace(courseId, payload) {
  const result = await request(`/courses/${courseId}/workspaces`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  const workspace = result?.data ?? result
  return toUiWorkspace(workspace)
}

function toUiCourse(course) {
  return {
    id: course.courseId,
    code: course.courseCode,
    name: course.courseName,
    description: course.description,
    isActive: course.isActive,
  }
}

function toUiChapter(chapter) {
  return {
    id: chapter.chapterId,
    courseId: chapter.courseId,
    title: chapter.chapterTitle,
    description: chapter.description,
    orderIndex: chapter.orderIndex,
    isActive: chapter.isActive,
  }
}

function toUiWorkspace(workspace) {
  return {
    id: workspace.workspaceId,
    courseId: workspace.courseId,
    ownerUserId: workspace.ownerUserId,
    name: workspace.workspaceTitle,
    description: workspace.description,
    isActive: workspace.isActive,
  }
}
