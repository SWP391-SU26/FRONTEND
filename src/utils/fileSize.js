export function formatFileSize(bytes, fallback = 'Chưa có dữ liệu') {
  const value = Number(bytes)
  if (!Number.isFinite(value) || value <= 0) return fallback
  if (value >= 1024 * 1024) return `${(value / (1024 * 1024)).toFixed(1)} MB`
  return `${Math.ceil(value / 1024)} KB`
}
