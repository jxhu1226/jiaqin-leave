const test = require('node:test')
const assert = require('node:assert/strict')
const { WEEKDAYS } = require('../shared/constants')
const { weekdayIndex, todayCST, formatDateTimeCST } = require('../shared/date')
const { formatDuration, formatRange, formatDayTitle, shortName, presentLeave, summarizeMine, avatarMeta } = require('../shared/format')

test('china civil date formatting ignores the machine timezone', () => {
  assert.equal(todayCST(Date.UTC(2026, 10, 11, 16, 0)), '2026-11-12')
  assert.equal(todayCST(Date.UTC(2026, 10, 11, 15, 59)), '2026-11-11')
  assert.equal(formatDateTimeCST(Date.UTC(2026, 10, 12, 1, 30)), '2026-11-12 09:30')
  assert.equal(formatDateTimeCST(0), '')
  assert.equal(weekdayIndex('1970-01-01'), 4)
  const weekday = weekdayIndex('2026-11-12')
  assert.equal(formatDayTitle('2026-11-12'), '11月12日 周' + WEEKDAYS[weekday])
})

test('duration and range copy', () => {
  assert.equal(formatDuration(1), '1 天')
  assert.equal(formatDuration(1.5), '1.5 天')
  assert.equal(formatDuration(0.5), '0.5 天')
  assert.equal(formatRange({
    startDate: '2026-11-12',
    startHalf: 'am',
    endDate: '2026-11-14',
    endHalf: 'pm',
  }), '2026-11-12 上午 至 2026-11-14 下午')
})

test('names, stats, and leave presentation', () => {
  assert.equal(shortName('李四'), '李四')
  assert.equal(shortName('欧阳修文'), '欧阳修…')
  assert.equal(shortName(''), '未命名')
  const presented = presentLeave({
    _id: 'abc',
    openid: 'u',
    userName: '李四',
    type: '年假',
    status: 'pending',
    startDate: '2026-11-12',
    startHalf: 'am',
    endDate: '2026-11-12',
    endHalf: 'pm',
    duration: 1,
    reason: '回家',
    createdAt: Date.UTC(2026, 10, 12, 1, 30),
  })
  assert.equal(presented.id, 'abc')
  assert.equal(presented.statusLabel, '待审批')
  assert.equal(presented.durationText, '1 天')
  assert.equal(presented.createdAtText, '2026-11-12 09:30')
  assert.equal(presented.typeClass, 'annual')

  const summary = summarizeMine([
    { status: 'pending', startDate: '2026-11-01', duration: 1 },
    { status: 'approved', startDate: '2026-01-02', duration: 2.5 },
    { status: 'approved', startDate: '2025-12-31', duration: 1 },
    { status: 'rejected', startDate: '2026-03-01', duration: 1 },
  ], '2026-11-12')
  assert.equal(summary.pending, 1)
  assert.equal(summary.approvedDaysText, '2.5')
  assert.equal(summary.year, '2026')
  assert.equal(avatarMeta({ name: '周管理', openid: 'abc' }).letter, '周')
  assert.match(avatarMeta({ name: '', openid: 'abc' }).color, /^#[0-9a-f]{6}$/)
})
