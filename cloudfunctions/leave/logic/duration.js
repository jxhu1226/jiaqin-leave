// 纯逻辑模块。源文件在 shared/，由 scripts/sync-shared.js 同步到小程序与云函数。
// 时段按半天编号：每个日期占两个序号，上午在前、下午在后。时长 = 覆盖的半天数 / 2。

const { dayNumber } = require('./date')

function halfIndex(dateStr, half) {
  const day = dayNumber(dateStr)
  if (day == null) return null
  if (half !== 'am' && half !== 'pm') return null
  return day * 2 + (half === 'am' ? 0 : 1)
}

function rangeBounds(leave) {
  if (!leave) return null
  const start = halfIndex(leave.startDate, leave.startHalf)
  const end = halfIndex(leave.endDate, leave.endHalf)
  if (start == null || end == null || end < start) return null
  return [start, end]
}

function durationOf(startDate, startHalf, endDate, endHalf) {
  const bounds = rangeBounds({
    startDate: startDate,
    startHalf: startHalf,
    endDate: endDate,
    endHalf: endHalf,
  })
  if (!bounds) return null
  return (bounds[1] - bounds[0] + 1) / 2
}

function rangesOverlap(a, b) {
  const left = rangeBounds(a)
  const right = rangeBounds(b)
  if (!left || !right) return false
  return left[0] <= right[1] && right[0] <= left[1]
}

function spanOnDate(date, leave) {
  const bounds = rangeBounds(leave)
  const morning = halfIndex(date, 'am')
  if (!bounds || morning == null) return null
  const evening = morning + 1
  const hasMorning = bounds[0] <= morning && morning <= bounds[1]
  const hasEvening = bounds[0] <= evening && evening <= bounds[1]
  if (hasMorning && hasEvening) return 'full'
  if (hasMorning) return 'am'
  if (hasEvening) return 'pm'
  return null
}

module.exports = {
  halfIndex,
  rangeBounds,
  durationOf,
  rangesOverlap,
  spanOnDate,
}
