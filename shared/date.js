// 纯逻辑模块。源文件在 shared/，由 scripts/sync-shared.js 同步到小程序与云函数。

function pad2(n) {
  return n < 10 ? '0' + n : String(n)
}

function formatYMD(year, month, day) {
  return year + '-' + pad2(month) + '-' + pad2(day)
}

function parseYMD(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ''))
  if (!match) return null
  const y = Number(match[1])
  const m = Number(match[2])
  const d = Number(match[3])
  const dt = new Date(Date.UTC(y, m - 1, d))
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null
  return { y: y, m: m, d: d }
}

function dayNumber(value) {
  const parts = parseYMD(value)
  if (!parts) return null
  return Math.floor(Date.UTC(parts.y, parts.m - 1, parts.d) / 86400000)
}

function weekdayIndex(value) {
  const n = dayNumber(value)
  if (n == null) return null
  return new Date(n * 86400000).getUTCDay()
}

function todayCST(now) {
  const ts = typeof now === 'number' ? now : Date.now()
  const shifted = new Date(ts + 8 * 60 * 60 * 1000)
  return formatYMD(shifted.getUTCFullYear(), shifted.getUTCMonth() + 1, shifted.getUTCDate())
}

function formatDateTimeCST(ts) {
  if (typeof ts !== 'number' || !isFinite(ts) || ts <= 0) return ''
  const shifted = new Date(ts + 8 * 60 * 60 * 1000)
  return formatYMD(shifted.getUTCFullYear(), shifted.getUTCMonth() + 1, shifted.getUTCDate())
    + ' ' + pad2(shifted.getUTCHours()) + ':' + pad2(shifted.getUTCMinutes())
}

function shiftMonth(year, month, delta) {
  const dt = new Date(Date.UTC(year, month - 1 + delta, 1))
  return { year: dt.getUTCFullYear(), month: dt.getUTCMonth() + 1 }
}

function daysInMonth(year, month) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate()
}

function isValidMonth(year, month) {
  return Number.isInteger(year) && Number.isInteger(month) && year >= 2000 && year <= 2100 && month >= 1 && month <= 12
}

module.exports = {
  pad2,
  formatYMD,
  parseYMD,
  dayNumber,
  weekdayIndex,
  todayCST,
  formatDateTimeCST,
  shiftMonth,
  daysInMonth,
  isValidMonth,
}
