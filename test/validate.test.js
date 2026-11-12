const test = require('node:test')
const assert = require('node:assert/strict')
const { validateLeaveInput, validateProfile, coerceRange } = require('../shared/validate')

function input(partial) {
  return Object.assign({
    type: '事假',
    startDate: '2026-11-12',
    startHalf: 'am',
    endDate: '2026-11-12',
    endHalf: 'pm',
    reason: '回家处理事务',
  }, partial)
}

test('leave input computes duration and trims reason', () => {
  const result = validateLeaveInput(input({ reason: '  就医  ' }))
  assert.equal(result.ok, true)
  assert.equal(result.value.duration, 1)
  assert.equal(result.value.reason, '就医')
  assert.equal(validateLeaveInput(input({ endHalf: 'am' })).value.duration, 0.5)
})

test('leave input rejects bad ranges and empty reasons', () => {
  assert.equal(validateLeaveInput(input({ type: '婚假' })).error, '请选择请假类型')
  assert.equal(validateLeaveInput(input({ startDate: '2026-02-29' })).error, '请选择有效的开始和结束日期')
  assert.equal(validateLeaveInput(input({ startHalf: 'pm', endHalf: 'am' })).error, '结束时间不能早于开始时间')
  assert.equal(validateLeaveInput(input({ endDate: '2026-11-11' })).error, '结束时间不能早于开始时间')
  assert.equal(validateLeaveInput(input({ reason: '   ' })).error, '请填写请假原因')
  assert.equal(validateLeaveInput(input({ reason: '事'.repeat(201) })).error, '请假原因不超过 200 字')
  assert.equal(validateLeaveInput(input({
    startDate: '2026-01-01',
    endDate: '2027-01-02',
  })).error, '单次请假不能超过 366 天')
  assert.equal(validateLeaveInput(input({
    startDate: '2026-01-01',
    endDate: '2027-01-01',
  })).ok, true)
})

test('partial validation allows a missing reason for the live preview', () => {
  const result = validateLeaveInput(input({ reason: '' }), { partial: true })
  assert.equal(result.ok, true)
  assert.equal(result.incomplete, true)
  assert.equal(result.value.duration, 1)
  assert.equal(validateLeaveInput(input({ startHalf: 'pm', endHalf: 'am', reason: '' }), { partial: true }).ok, false)
})

test('coerce range snaps an impossible same-day order', () => {
  assert.deepEqual(coerceRange({
    startDate: '2026-11-14',
    endDate: '2026-11-12',
    startHalf: 'pm',
    endHalf: 'am',
  }), {
    startDate: '2026-11-14',
    endDate: '2026-11-14',
    startHalf: 'pm',
    endHalf: 'pm',
  })
})

test('profile name and department', () => {
  assert.deepEqual(validateProfile({ name: '  张  三 ', department: '研发' }).value, {
    name: '张 三',
    department: '研发',
  })
  assert.equal(validateProfile({ name: '   ' }).error, '请填写姓名')
  assert.equal(validateProfile({ name: '名'.repeat(21) }).error, '姓名不超过 20 个字')
  assert.equal(validateProfile({ name: '张三', department: '部'.repeat(21) }).error, '部门不超过 20 个字')
  assert.equal(validateProfile({ name: '名'.repeat(20) }).ok, true)
})
