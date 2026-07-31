export function buildLibraryHierarchy(scope, mine, shared) {
  const semesters = normalizeSemesters(scope)
  const courses = semesters.flatMap((semester) => semester.courses)
  const courseById = new Map(courses.map((course) => [course.id, course]))
  const semesterById = new Map(semesters.map((semester) => [semester.id, semester]))

  const owned = dedupeDocuments(mine)
  const approvedOwned = owned.filter(isApprovedCourseDocument)
  const courseDocuments = dedupeDocuments([
    ...shared.filter(isApprovedCourseDocument),
    ...approvedOwned,
  ])
  const personalDocuments = owned.filter((document) => !isApprovedCourseDocument(document))
  const documentLocations = new Map()

  personalDocuments.forEach((document) => {
    documentLocations.set(document.id, {
      kind: 'personal',
      label: 'Tài liệu của tôi',
      breadcrumb: ['Tài liệu của tôi'],
    })
  })

  courseDocuments.forEach((document) => {
    const course = courseById.get(document.courseId)
    const semester = course ? semesterById.get(course.semesterId) : null
    documentLocations.set(document.id, {
      kind: 'course',
      courseId: document.courseId,
      semesterId: semester?.id ?? null,
      label: course?.name ?? 'Môn học',
      breadcrumb: [semester?.name, course?.label].filter(Boolean),
    })
  })

  const semestersWithCounts = semesters.map((semester) => ({
    ...semester,
    documentCount: semester.courses.reduce(
      (total, course) => total + courseDocuments.filter((document) => document.courseId === course.id).length,
      0,
    ),
    courses: semester.courses.map((course) => ({
      ...course,
      documents: courseDocuments.filter((document) => document.courseId === course.id),
    })),
  }))

  return {
    semesters: semestersWithCounts,
    personalDocuments,
    courseDocuments,
    allDocuments: dedupeDocuments([...personalDocuments, ...courseDocuments]),
    documentLocations,
  }
}

export function searchLibraryDocuments(documents, locations, query) {
  const needle = normalize(query)
  if (!needle) return []
  return documents.filter((document) => {
    const location = locations.get(document.id)
    return normalize([
      document.displayName,
      document.name,
      document.type,
      document.uploaderName,
      ...(location?.breadcrumb ?? []),
    ].filter(Boolean).join(' ')).includes(needle)
  })
}

export function sortLibraryDocuments(documents, sortBy = 'newest') {
  return [...documents].sort((left, right) => {
    if (sortBy === 'oldest') {
      return Number(left.uploadedAtTimestamp ?? 0) - Number(right.uploadedAtTimestamp ?? 0)
    }
    if (sortBy === 'name') {
      return String(left.displayName ?? '').localeCompare(String(right.displayName ?? ''), 'vi')
    }
    return Number(right.uploadedAtTimestamp ?? 0) - Number(left.uploadedAtTimestamp ?? 0)
  })
}

export function isApprovedCourseDocument(document) {
  return document?.documentScope === 'COURSE'
    && document?.reviewStatus === 'APPROVED'
    && Boolean(document?.courseId)
}

function normalizeSemesters(scope) {
  return (Array.isArray(scope) ? scope : [])
    .map((semester) => ({
      id: semester.semesterId,
      code: semester.semesterCode,
      name: semester.semesterName,
      status: semester.status ?? 'ACTIVE',
      createdBy: semester.createdBy,
      creatorName: semester.creatorName,
      createdAt: formatDate(semester.createdAt),
      createdAtTimestamp: timestamp(semester.createdAt),
      courses: (semester.courses ?? [])
        .map((course) => ({
          id: course.courseId,
          code: course.courseCode,
          name: course.courseName,
          label: [course.courseCode, course.courseName].filter(Boolean).join(' · '),
          status: course.status ?? 'ACTIVE',
          workspaceId: course.workspaceId,
          createdBy: course.createdBy,
          creatorName: course.creatorName,
          createdAt: formatDate(course.createdAt),
          createdAtTimestamp: timestamp(course.createdAt),
          documentCount: Number(course.documentCount ?? 0),
          processedDocumentCount: Number(course.processedDocumentCount ?? 0),
          semesterId: semester.semesterId,
        }))
        .sort((left, right) => String(left.code ?? '').localeCompare(String(right.code ?? ''), 'vi')),
    }))
    .sort((left, right) => {
      const activeDifference = Number(isActive(right.status)) - Number(isActive(left.status))
      return activeDifference || String(right.name ?? '').localeCompare(String(left.name ?? ''), 'vi')
    })
}

function timestamp(value) {
  const parsed = value ? Date.parse(value) : Number.NaN
  return Number.isFinite(parsed) ? parsed : 0
}

function formatDate(value) {
  const parsed = timestamp(value)
  if (!parsed) return 'Chưa có thông tin'
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(parsed)
}

function dedupeDocuments(documents) {
  const byId = new Map()
  documents.filter(Boolean).forEach((document) => {
    if (!document.id) return
    byId.set(document.id, { ...byId.get(document.id), ...document })
  })
  return [...byId.values()]
}

function isActive(status) {
  return ['ACTIVE', 'PUBLISHED'].includes(String(status ?? '').toUpperCase())
}

function normalize(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .toLowerCase()
}
