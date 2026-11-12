// 纯逻辑模块。源文件在 shared/，由 scripts/sync-shared.js 同步到小程序与云函数。

const { LEAVE_TYPES } = require('./constants')
const { parseYMD } = require('./date')
const { durationOf } = require('./duration')

function collapseText(value) {
  return String(value == null ? '' : value).replace(/\s+/g, ' ').trim()
}

function trimEnds(value) {
  return String(value == null ? '' : value).replace(/^\s+|\s+$/g, '')
}

function validateProfile(input) {
  const source = input || {}
  const name = collapseText(source.name)
  const department = collapseText(source.department || '')
  if (!name) return { ok: false, error: '请填写姓名' }
  if (Array.from(name).length > 20) return { ok: false, error: '姓名不超过 20 个字' }
  if (Array.from(department).length > 20) return { ok: false, error: '部门不超过 20 个字' }
  return { ok: true, value: { name: name, department: department } }
}

function coerceRange(input) {
  const source = input || {}
  const startDate = source.startDate
  const startHalf = source.startHalf === 'pm' ? 'pm' : 'am'
  let endDate = source.endDate
  let endHalf = source.endHalf === 'am' ? 'am' : 'pm'
  if (startDate && endDate && endDate < startDate) endDate = startDate
  if (startDate && endDate && startDate === endDate && startHalf === 'pm' && endHalf === 'am') endHalf = 'pm'
  return {
    startDate: startDate,
    endDate: endDate,
    startHalf: startHalf,
    endHalf: endHalf,
  }
}

function validateLeaveInput(input, options) {
  const source = input || {}
  const partial = !!(options && options.partial)
  const type = source.type
  const startDate = source.startDate
  const endDate = source.endDate
  const startHalf = source.startHalf
  const endHalf = source.endHalf
  const reason = trimEnds(source.reason)
  if (LEAVE_TYPES.indexOf(type) === -1) return { ok: false, error: '请选择请假类型' }
  const startParts = parseYMD(startDate)
  const endParts = parseYMD(endDate)
  if (!startParts || !endParts) return { ok: false, error: '请选择有效的开始和结束日期' }
  if (startHalf !== 'am' && startHalf !== 'pm') return { ok: false, error: '请选择开始时段' }
  if (endHalf !== 'am' && endHalf !== 'pm') return { ok: false, error: '请选择结束时段' }
  if (startParts.y < 2000 || endParts.y > 2100) return { ok: false, error: '日期需在 2000 年到 2100 年之间' }
  const duration = durationOf(startDate, startHalf, endDate, endHalf)
  if (duration == null) return { ok: false, error: '结束时间不能早于开始时间' }
  if (duration > 366) return { ok: false, error: '单次请假不能超过 366 天' }
  if (!reason) {
    if (partial) {
      return {
        ok: true,
        incomplete: true,
        value: {
          type: type,
          startDate: startDate,
          startHalf: startHalf,
          endDate: endDate,
          endHalf: endHalf,
          reason: '',
          duration: duration,
        },
      }
    }
    return { ok: false, error: '请填写请假原因' }
  }
  if (Array.from(reason).length > 200) return { ok: false, error: '请假原因不超过 200 字' }
  return {
    ok: true,
    value: {
      type: type,
      startDate: startDate,
      startHalf: startHalf,
      endDate: endDate,
      endHalf: endHalf,
      reason: reason,
      duration: duration,
    },
  }
}

module.exports = {
  collapseText,
  trimEnds,
  validateProfile,
  coerceRange,
  validateLeaveInput,
}
