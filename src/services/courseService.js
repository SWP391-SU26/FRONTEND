import { request } from './httpClient.js'
import { isAdminSession } from './authService.js'

const unwrap = (value) => value?.data ?? value
const list = (value) => Array.isArray(unwrap(value)) ? unwrap(value) : []

export async function getCourses() { return list(await request(isAdminSession() ? '/courses' : '/courses/my')).map(toUiCourse) }
export async function getChapters(courseId) { return list(await request(`/courses/${courseId}/chapters`)).map(toUiChapter) }
export async function getWorkspaces() {
  if (isAdminSession()) return list(await request('/courses/workspaces')).map(toUiWorkspace)
  const courses = await getCourses()
  const groups = await Promise.all(courses.map((course) => getWorkspacesByCourse(course.id)))
  return groups.flat()
}
export async function getWorkspacesByCourse(courseId) { return list(await request(`/courses/${courseId}/workspaces`)).map(toUiWorkspace) }
export async function getLearningScope() { return unwrap(await request('/learning-scope')) ?? [] }
export async function getCourseMaterials(courseId) { return unwrap(await request(`/courses/${courseId}/materials`)) }

export async function createCourse(payload) {
  return toUiCourse(unwrap(await request(`/courses/semester/${payload.semesterWorkspaceId}`, {
    method: 'POST', body: JSON.stringify(payload),
  })))
}

export async function updateCourse(courseId, payload) {
  return toUiCourse(unwrap(await request(`/courses/${courseId}`, { method: 'PATCH', body: JSON.stringify(payload) })))
}

export async function setCourseStatus(courseId, status) {
  return toUiCourse(unwrap(await request(`/courses/${courseId}/status`, { method: 'PATCH', body: JSON.stringify({ status }) })))
}

export function deleteCourse(courseId) { return request(`/courses/${courseId}`, { method: 'DELETE' }) }
export function getPublishChecklist(courseId) { return request(`/courses/${courseId}/publish-checklist`) }

export async function getSemesterWorkspaces() { return list(await request('/semester-workspaces')).map(toUiSemester) }
export async function createSemesterWorkspace(payload) { return toUiSemester(unwrap(await request('/semester-workspaces', { method: 'POST', body: JSON.stringify(payload) }))) }
export async function updateSemesterWorkspace(id, payload) { return toUiSemester(unwrap(await request(`/semester-workspaces/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }))) }
export async function setSemesterStatus(id, status) { return toUiSemester(unwrap(await request(`/semester-workspaces/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }))) }
export function deleteSemesterWorkspace(id) { return request(`/semester-workspaces/${id}`, { method: 'DELETE' }) }
export async function getSemesterCourses(id) { return list(await request(`/semester-workspaces/${id}/courses`)).map(toUiCourse) }

export function getCourseMembers(courseId) { return request(`/courses/${courseId}/members`) }
export function addCourseMember(courseId, userId, membershipRole = 'STUDENT') { return request(`/courses/${courseId}/members`, { method: 'POST', body: JSON.stringify({ userId, membershipRole }) }) }
export function removeCourseMember(courseId, userId) { return request(`/courses/${courseId}/members/${userId}`, { method: 'DELETE' }) }

export function getChapterSuggestions(documentId) { return request(`/documents/${documentId}/chapter-suggestions`) }
export function confirmChapterSuggestions(documentId, chapters) { return request(`/documents/${documentId}/chapter-suggestions`, { method: 'PUT', body: JSON.stringify({ chapters }) }) }

export async function createChapter(courseId, payload) { return toUiChapter(unwrap(await request(`/courses/${courseId}/chapters`, { method: 'POST', body: JSON.stringify(payload) }))) }
export async function createWorkspace(courseId, payload) { return toUiWorkspace(unwrap(await request(`/courses/${courseId}/workspaces`, { method: 'POST', body: JSON.stringify(payload) }))) }

function toUiSemester(item) { return { id: item.semesterWorkspaceId, code: item.semesterCode, name: item.semesterName, status: item.status } }
function toUiCourse(course) { return { id: course.courseId, code: course.courseCode, name: course.courseName, description: course.description, semesterWorkspaceId: course.semesterWorkspaceId, status: course.status ?? 'DRAFT', isActive: course.isActive } }
function toUiChapter(chapter) { return { id: chapter.chapterId, courseId: chapter.courseId, title: chapter.chapterTitle, description: chapter.description, orderIndex: chapter.orderIndex, isActive: chapter.isActive } }
function toUiWorkspace(workspace) { return { id: workspace.workspaceId, courseId: workspace.courseId, ownerUserId: workspace.ownerUserId, name: workspace.workspaceTitle, description: workspace.description, visibility: workspace.visibility, isActive: workspace.isActive } }
