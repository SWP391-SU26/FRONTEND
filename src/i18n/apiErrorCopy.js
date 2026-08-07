export function localizeApiError(message, locale = 'vi') {
  const text = String(message || '').trim()
  if (!text || locale !== 'vi') return text

  const duplicate = text.match(/^You already uploaded this file as "(.+)"\.?$/i)
  if (duplicate) return `Bạn đã tải tệp này lên với tên “${duplicate[1]}”.`
  if (/storage quota.*exceed|not enough storage|storage limit/i.test(text)) {
    return 'Không đủ dung lượng lưu trữ. Hãy xóa bớt tài liệu hoặc nâng cấp gói.'
  }
  if (/file.*(?:too large|exceed)|maximum file size/i.test(text)) {
    return 'Tệp vượt quá dung lượng tối đa cho phép của gói hiện tại.'
  }
  if (/do not have permission|forbidden/i.test(text)) {
    return 'Bạn không có quyền thực hiện thao tác này.'
  }
  return text
}
