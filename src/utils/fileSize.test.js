import { describe, expect, it } from 'vitest'
import { formatFileSize } from './fileSize.js'

describe('formatFileSize', () => {
  it('formats the persisted document size in megabytes', () => {
    expect(formatFileSize(3_029_950)).toBe('2.9 MB')
  })

  it('uses a clear fallback when the backend has no size', () => {
    expect(formatFileSize(null)).toBe('Chưa có dữ liệu')
    expect(formatFileSize(0)).toBe('Chưa có dữ liệu')
  })
})
