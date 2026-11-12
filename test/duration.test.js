const test = require('node:test')
const assert = require('node:assert/strict')
const { durationOf, rangesOverlap, spanOnDate } = require('../shared/duration')

test('half-day duration', () => {
  assert.equal(durationOf('2026-11-12', 'am', '2026-11-12', 'pm'), 1)
  assert.equal(durationOf('2026-11-12', 'am', '2026-11-12', 'am'), 0.5)
  assert.equal(durationOf('2026-11-12', 'pm', '2026-11-12', 'pm'), 0.5)
  assert.equal(durationOf('2026-11-12', 'pm', '2026-11-12', 'am'), null)
  assert.equal(durationOf('2026-11-12', 'am', '2026-11-13', 'am'), 1.5)
  assert.equal(durationOf('2026-11-12', 'pm', '2026-11-13', 'am'), 1)
  assert.equal(durationOf('2026-11-12', 'am', '2026-11-14', 'pm'), 3)
  assert.equal(durationOf('2026-11-12', 'pm', '2026-11-14', 'am'), 2)
  assert.equal(durationOf('2026-02-28', 'pm', '2026-03-01', 'am'), 1)
  assert.equal(durationOf('2024-02-28', 'pm', '2024-03-01', 'am'), 2)
  assert.equal(durationOf('2024-02-29', 'am', '2024-02-29', 'pm'), 1)
  assert.equal(durationOf('2026-02-29', 'am', '2026-02-29', 'pm'), null)
  assert.equal(durationOf('2026-01-01', 'am', '2027-01-01', 'pm'), 366)
  assert.equal(durationOf('2026-11-13', 'am', '2026-11-12', 'pm'), null)
})

test('ranges overlap on half-day boundaries', () => {
  const morning = { startDate: '2026-11-12', startHalf: 'am', endDate: '2026-11-12', endHalf: 'am' }
  const afternoon = { startDate: '2026-11-12', startHalf: 'pm', endDate: '2026-11-12', endHalf: 'pm' }
  const full = { startDate: '2026-11-12', startHalf: 'am', endDate: '2026-11-12', endHalf: 'pm' }
  const nextDay = { startDate: '2026-11-13', startHalf: 'am', endDate: '2026-11-13', endHalf: 'pm' }
  assert.equal(rangesOverlap(morning, afternoon), false)
  assert.equal(rangesOverlap(full, afternoon), true)
  assert.equal(rangesOverlap(full, morning), true)
  assert.equal(rangesOverlap(full, nextDay), false)
  assert.equal(rangesOverlap(afternoon, {
    startDate: '2026-11-13',
    startHalf: 'am',
    endDate: '2026-11-13',
    endHalf: 'am',
  }), false)
  assert.equal(rangesOverlap(morning, null), false)
})

test('span on a single date', () => {
  const leave = {
    startDate: '2026-11-12',
    startHalf: 'pm',
    endDate: '2026-11-14',
    endHalf: 'am',
  }
  assert.equal(spanOnDate('2026-11-12', leave), 'pm')
  assert.equal(spanOnDate('2026-11-13', leave), 'full')
  assert.equal(spanOnDate('2026-11-14', leave), 'am')
  assert.equal(spanOnDate('2026-11-15', leave), null)
  assert.equal(spanOnDate('2026-11-12', {
    startDate: '2026-11-12',
    startHalf: 'am',
    endDate: '2026-11-12',
    endHalf: 'am',
  }), 'am')
  assert.equal(spanOnDate('2026-11-12', {
    startDate: '2026-11-12',
    startHalf: 'am',
    endDate: '2026-11-12',
    endHalf: 'pm',
  }), 'full')
})
