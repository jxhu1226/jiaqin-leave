// 纯逻辑模块。源文件在 shared/，由 scripts/sync-shared.js 同步到小程序与云函数。

const { HALF_LABEL, SPAN_LABEL, STATUS_LABEL, TYPE_CLASS, WEEKDAYS } = require('./constants')
const { parseYMD, weekdayIndex, formatDateTimeCST } = require('./date')

function formatDayValue(n) {
  if (typeof n !== 'number' || !isFinite(n)) return '0'
  const rounded = Math.round(n * 2) / 2
  if (Object.is(rounded, -0)) return '0'
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1)
}

function formatDuration(n) {
  return formatDayValue(n) + ' 天'
}

function formatRange(leave) {
  const item = leave || {}
  const startHalf = HALF_LABEL[item.startHalf] || ''
  const endHalf = HALF_LABEL[item.endHalf] || ''
  return (item.startDate || '') + (startHalf ? ' ' + startHalf : '') + ' 至 ' + (item.endDate || '') + (endHalf ? ' ' + endHalf : '')
}

function formatDayTitle(dateStr) {
  const parts = parseYMD(dateStr)
  const weekday = weekdayIndex(dateStr)
  if (!parts || weekday == null) return ''
  return parts.m + '月' + parts.d + '日 周' + WEEKDAYS[weekday]
}

function shortName(name) {
  const chars = Array.from(name || '')
  if (!chars.length) return '未命名'
  if (chars.length <= 3) return chars.join('')
  return chars.slice(0, 3).join('') + '…'
}

function presentLeave(doc) {
  const item = doc || {}
  const id = item._id || item.id || ''
  return {
    id: id,
    _id: id,
    openid: item.openid || '',
    userName: item.userName || '',
    department: item.department || '',
    type: item.type,
    typeClass: TYPE_CLASS[item.type] || 'other',
    startDate: item.startDate,
    startHalf: item.startHalf,
    endDate: item.endDate,
    endHalf: item.endHalf,
    duration: item.duration,
    durationText: formatDuration(item.duration),
    rangeText: formatRange(item),
    reason: item.reason || '',
    status: item.status,
    statusLabel: STATUS_LABEL[item.status] || '',
    access: item.access || '',
    reviewComment: item.reviewComment || '',
    reviewerName: item.reviewerName || '',
    reviewerOpenid: item.reviewerOpenid || '',
    reviewedAt: item.reviewedAt || 0,
    reviewedAtText: item.reviewedAt ? formatDateTimeCST(item.reviewedAt) : '',
    createdAt: item.createdAt || 0,
    createdAtText: item.createdAt ? formatDateTimeCST(item.createdAt) : '',
    updatedAt: item.updatedAt || 0,
    updatedAtText: item.updatedAt ? formatDateTimeCST(item.updatedAt) : '',
  }
}

function presentCalendarItem(item) {
  const source = item || {}
  const span = source.span
  const name = source.name || source.userName || '未命名'
  let daySpanText = '当日下午'
  if (span === 'full') daySpanText = '当日全天'
  if (span === 'am') daySpanText = '当日上午'
  return {
    id: source.id || source._id || '',
    openid: source.openid || '',
    name: name,
    shortName: shortName(name),
    department: source.department || '',
    type: source.type,
    typeClass: TYPE_CLASS[source.type] || 'other',
    span: span,
    spanLabel: SPAN_LABEL[span] || '',
    daySpanText: daySpanText,
    rangeText: formatRange(source),
  }
}

function summarizeMine(leaves, today) {
  const year = String(today || '').slice(0, 4)
  let approvedDays = 0
  let pending = 0
  const list = leaves || []
  for (let i = 0; i < list.length; i += 1) {
    const item = list[i]
    if (item.status === 'pending') pending += 1
    if (item.status === 'approved' && String(item.startDate || '').slice(0, 4) === year) {
      approvedDays += Number(item.duration) || 0
    }
  }
  return {
    pending: pending,
    approvedDays: approvedDays,
    approvedDaysText: formatDayValue(approvedDays),
    year: year,
  }
}

function avatarMeta(user) {
  const person = user || {}
  const chars = Array.from(person.name || '')
  const palette = ['#0f6e56', '#1f6f8b', '#8a5a2b', '#3d4f7c', '#6d4c7d']
  const openid = person.openid || ''
  let hash = 0
  for (let i = 0; i < openid.length; i += 1) {
    hash = (hash * 31 + openid.charCodeAt(i)) >>> 0
  }
  return {
    letter: chars.length ? chars[0] : '人',
    color: palette[hash % palette.length],
  }
}

module.exports = {
  formatDayValue,
  formatDuration,
  formatRange,
  formatDayTitle,
  shortName,
  presentLeave,
  presentCalendarItem,
  summarizeMine,
  avatarMeta,
}
