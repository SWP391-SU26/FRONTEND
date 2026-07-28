import { describe, expect, it } from 'vitest'
import {
  buildLibraryHierarchy, searchLibraryDocuments, sortLibraryDocuments,
} from './libraryModel.js'

const scope = [{
  semesterId: 'semester-1',
  semesterName: 'Fall 2026',
  status: 'ACTIVE',
  courses: [{
    courseId: 'course-1',
    courseCode: 'SWP391',
    courseName: 'Software Project',
    status: 'PUBLISHED',
    documentCount: 1,
    processedDocumentCount: 1,
  }],
}]

const personal = {
  id: 'personal-1',
  displayName: 'Ghi chú cá nhân.pdf',
  type: 'PDF',
  documentScope: 'PERSONAL',
  reviewStatus: 'NOT_SUBMITTED',
  uploadedAtTimestamp: 10,
  uploaderName: 'Nguyễn An',
}

const approved = {
  id: 'course-doc-1',
  displayName: 'Kế hoạch dự án.docx',
  type: 'DOCX',
  courseId: 'course-1',
  documentScope: 'COURSE',
  reviewStatus: 'APPROVED',
  uploadedAtTimestamp: 20,
  uploaderName: 'Trần Bình',
}

describe('Library hierarchy', () => {
  it('moves approved owned documents to their course without duplicating them', () => {
    const hierarchy = buildLibraryHierarchy(scope, [personal, approved], [approved])

    expect(hierarchy.personalDocuments.map((document) => document.id)).toEqual(['personal-1'])
    expect(hierarchy.semesters[0].courses[0].documents.map((document) => document.id)).toEqual(['course-doc-1'])
    expect(hierarchy.allDocuments).toHaveLength(2)
  })

  it('searches globally using document, uploader, course, and semester metadata', () => {
    const hierarchy = buildLibraryHierarchy(scope, [personal], [approved])

    expect(searchLibraryDocuments(
      hierarchy.allDocuments,
      hierarchy.documentLocations,
      'software project',
    ).map((document) => document.id)).toEqual(['course-doc-1'])
    expect(searchLibraryDocuments(
      hierarchy.allDocuments,
      hierarchy.documentLocations,
      'nguyen an',
    ).map((document) => document.id)).toEqual(['personal-1'])
  })

  it('sorts documents by timestamp or Vietnamese display name', () => {
    expect(sortLibraryDocuments([personal, approved], 'newest')[0].id).toBe('course-doc-1')
    expect(sortLibraryDocuments([personal, approved], 'oldest')[0].id).toBe('personal-1')
    expect(sortLibraryDocuments([personal, approved], 'name')[0].id).toBe('personal-1')
  })
})
