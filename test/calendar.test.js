const test = require('node:test')
const assert = require('node:assert/strict')
const { weekdayIndex } = require('../shared/date')
const {
  overlapsMonth,
  selectCalendarLeaves,
  buildMonthGrid,
  groupLeavesByDate,
  clampSelected,
  assembleMonthView,
} = require('../shared/calendar')

function leave(partial) {
  return Object.assign({
    _id: 'id',
    openid: 'u',
    userName: '张三',
    type: '年假',
    status: 'approved',
    startHalf: 'am',
    endHalf: 'pm',
    department: '',
  }, partial)
}

test('month overlap uses inclusive dates', () => {
  const cross = leave({ startDate: '2026-11-30', endDate: '2026-12-02' })
  assert.equal(overlapsMonth(cross, 2026, 10), false)
  assert.equal(overlapsMonth(cross, 2026, 11), true)
  assert.equal(overlapsMonth(cross, 2026, 12), true)
  assert.equal(overlapsMonth(leave({ startDate: '2026-12-01', endDate: '2026-12-01' }), 2026, 11), false)
  assert.equal(overlapsMonth(leave({ startDate: '2026-11-30', endDate: '2026-11-30' }), 2026, 12), false)
  assert.equal(overlapsMonth({ startDate: 'bad', endDate: '2026-11-01' }, 2026, 11), false)
})

test('calendar keeps approved leaves only', () => {
  const rows = [
    leave({ _id: 'ok', status: 'approved', startDate: '2026-11-02', endDate: '2026-11-02' }),
    leave({ _id: 'wait', status: 'pending', startDate: '2026-11-03', endDate: '2026-11-03' }),
    leave({ _id: 'no', status: 'rejected', startDate: '2026-11-04', endDate: '2026-11-04' }),
    leave({ _id: 'out', status: 'approved', startDate: '2026-12-04', endDate: '2026-12-05' }),
  ]
  const picked = selectCalendarLeaves(rows, 2026, 11)
  assert.deepEqual(picked.map((item) => item._id), ['ok'])
})

test('month grid starts on Monday', () => {
  const grid = buildMonthGrid(2026, 11)
  const leading = grid.findIndex((cell) => cell.inMonth)
  assert.equal(grid[leading].date, '2026-11-01')
  assert.equal(leading, (weekdayIndex('2026-11-01') + 6) % 7)
  assert.equal(grid.filter((cell) => cell.inMonth).length, 30)
  assert.equal(grid.length % 7, 0)

  const feb = buildMonthGrid(2024, 2)
  assert.equal(feb.filter((cell) => cell.inMonth).length, 29)
  assert.equal(feb.find((cell) => cell.inMonth).date, '2024-02-01')
  assert.throws(() => buildMonthGrid(2026, 13), /无效月份/)
})

test('group leaves onto each day with half-day span', () => {
  const grouped = groupLeavesByDate(2026, 11, [
    leave({
      _id: 'a',
      userName: '李四',
      startDate: '2026-11-12',
      startHalf: 'pm',
      endDate: '2026-11-13',
      endHalf: 'am',
    }),
    leave({
      _id: 'b',
      openid: 'u2',
      userName: '王五',
      startDate: '2026-11-30',
      endDate: '2026-12-02',
    }),
  ])
  assert.equal(Object.keys(grouped).length, 30)
  assert.equal(grouped['2026-12-01'], undefined)
  assert.equal(grouped['2026-11-12'][0].span, 'pm')
  assert.equal(grouped['2026-11-13'][0].span, 'am')
  assert.equal(grouped['2026-11-30'][0].name, '王五')
  assert.equal(grouped['2026-11-30'][0].span, 'full')
  assert.deepEqual(grouped['2026-11-01'], [])
})

test('selected day stays on the same day-of-month when paging', () => {
  assert.equal(clampSelected(2026, 11, '2026-11-12', '2026-11-20'), '2026-11-12')
  assert.equal(clampSelected(2026, 11, '', '2026-11-20'), '2026-11-20')
  assert.equal(clampSelected(2026, 12, '2026-11-12', '2026-11-12'), '2026-12-12')
  assert.equal(clampSelected(2026, 2, '2026-01-31', '2026-01-15'), '2026-02-28')
  assert.equal(clampSelected(2024, 2, '2024-01-31', '2024-01-15'), '2024-02-29')
})

test('assemble month view for the public calendar', () => {
  const view = assembleMonthView(2026, 11, [
    leave({
      _id: 'p',
      status: 'pending',
      userName: '张三',
      startDate: '2026-11-12',
      endDate: '2026-11-12',
    }),
    leave({
      _id: 's',
      openid: 'u2',
      status: 'approved',
      userName: '李四',
      type: '病假',
      startDate: '2026-11-12',
      startHalf: 'am',
      endDate: '2026-11-12',
      endHalf: 'am',
    }),
    leave({
      _id: 'r',
      status: 'rejected',
      startDate: '2026-11-12',
      endDate: '2026-11-12',
    }),
  ], '2026-11-12', '2026-11-12')

  assert.equal(view.peopleCount, 1)
  assert.equal(view.personDaysText, '0.5')
  assert.equal(view.selectedItems.length, 1)
  assert.equal(view.selectedItems[0].name, '李四')
  assert.equal(view.selectedItems[0].daySpanText, '当日上午')
  assert.equal(view.selectedItems[0].shortName, '李四')
  assert.equal(view.viewingCurrentMonth, true)
  assert.equal(view.title, '2026年11月')
  const day = view.cells.find((cell) => cell.date === '2026-11-12')
  assert.equal(day.isSelected, true)
  assert.equal(day.isToday, true)
  assert.equal(day.preview.length, 1)
  assert.equal(day.more, 0)
})

test('a crowded day shows two names and a remainder', () => {
  const rows = ['甲', '乙', '丙'].map((name, index) => leave({
    _id: String(index),
    openid: 'u' + index,
    userName: name,
    startDate: '2026-11-18',
    endDate: '2026-11-18',
  }))
  const view = assembleMonthView(2026, 11, rows, '2026-11-18', '2026-12-01')
  const day = view.cells.find((cell) => cell.date === '2026-11-18')
  assert.equal(day.preview.length, 2)
  assert.equal(day.more, 1)
  assert.equal(view.peopleCount, 3)
  assert.equal(view.personDaysText, '3')
  assert.equal(view.viewingCurrentMonth, false)
})
