// 纯逻辑模块。源文件在 shared/，由 scripts/sync-shared.js 同步到小程序与云函数。

const { formatYMD, parseYMD, weekdayIndex, daysInMonth, isValidMonth } = require('./date')
const { spanOnDate } = require('./duration')
const { formatDayValue, formatDayTitle, presentCalendarItem } = require('./format')

function overlapsMonth(leave, year, month) {
  if (!leave || !isValidMonth(year, month)) return false
  if (!parseYMD(leave.startDate) || !parseYMD(leave.endDate)) return false
  const start = formatYMD(year, month, 1)
  const end = formatYMD(year, month, daysInMonth(year, month))
  return leave.startDate <= end && leave.endDate >= start
}

function selectCalendarLeaves(leaves, year, month) {
  const list = []
  const source = leaves || []
  for (let i = 0; i < source.length; i += 1) {
    const leave = source[i]
    if (leave && leave.status === 'approved' && overlapsMonth(leave, year, month)) list.push(leave)
  }
  return list
}

function buildMonthGrid(year, month) {
  if (!isValidMonth(year, month)) {
    throw new Error('无效月份')
  }
  const firstWeekday = weekdayIndex(formatYMD(year, month, 1))
  const leading = (firstWeekday + 6) % 7
  const count = daysInMonth(year, month)
  const cells = []
  for (let i = 0; i < leading; i += 1) cells.push({ inMonth: false })
  for (let day = 1; day <= count; day += 1) {
    cells.push({
      inMonth: true,
      date: formatYMD(year, month, day),
      day: day,
    })
  }
  while (cells.length % 7 !== 0) cells.push({ inMonth: false })
  return cells
}

function groupLeavesByDate(year, month, leaves) {
  if (!isValidMonth(year, month)) throw new Error('无效月份')
  const map = {}
  const count = daysInMonth(year, month)
  for (let day = 1; day <= count; day += 1) map[formatYMD(year, month, day)] = []
  const source = leaves || []
  for (let i = 0; i < source.length; i += 1) {
    const leave = source[i]
    const dates = Object.keys(map)
    for (let d = 0; d < dates.length; d += 1) {
      const date = dates[d]
      const span = spanOnDate(date, leave)
      if (!span) continue
      map[date].push({
        id: leave._id || leave.id || '',
        openid: leave.openid || '',
        name: leave.userName || leave.name || '未命名',
        department: leave.department || '',
        type: leave.type,
        span: span,
        startDate: leave.startDate,
        startHalf: leave.startHalf,
        endDate: leave.endDate,
        endHalf: leave.endHalf,
      })
    }
  }
  const dates = Object.keys(map)
  for (let i = 0; i < dates.length; i += 1) {
    map[dates[i]].sort((a, b) => a.name.localeCompare(b.name))
  }
  return map
}

function monthLoad(grouped) {
  const people = {}
  let personDays = 0
  const dates = Object.keys(grouped || {})
  for (let i = 0; i < dates.length; i += 1) {
    const items = grouped[dates[i]] || []
    for (let j = 0; j < items.length; j += 1) {
      const item = items[j]
      personDays += item.span === 'full' ? 1 : 0.5
      if (item.openid) people[item.openid] = true
    }
  }
  return { personDays: personDays, people: Object.keys(people).length }
}

function isWeekend(date) {
  const weekday = weekdayIndex(date)
  return weekday === 0 || weekday === 6
}

function clampSelected(year, month, selectedDate, today) {
  const last = daysInMonth(year, month)
  function inThisMonth(date) {
    const parts = parseYMD(date)
    return !!(parts && parts.y === year && parts.m === month)
  }
  if (inThisMonth(selectedDate)) return selectedDate
  if (inThisMonth(today)) return today
  const picked = parseYMD(selectedDate)
  if (picked) return formatYMD(year, month, Math.min(picked.d, last))
  return formatYMD(year, month, 1)
}

function assembleMonthView(year, month, leaves, selectedDate, today) {
  const cells = buildMonthGrid(year, month)
  const visible = selectCalendarLeaves(leaves, year, month)
  const grouped = groupLeavesByDate(year, month, visible)
  const load = monthLoad(grouped)
  const selected = clampSelected(year, month, selectedDate, today || '')
  const viewCells = []
  for (let i = 0; i < cells.length; i += 1) {
    const cell = cells[i]
    if (!cell.inMonth) {
      viewCells.push({ inMonth: false })
      continue
    }
    const items = (grouped[cell.date] || []).map(presentCalendarItem)
    viewCells.push({
      inMonth: true,
      date: cell.date,
      day: cell.day,
      isToday: cell.date === today,
      isSelected: cell.date === selected,
      isWeekend: isWeekend(cell.date),
      count: items.length,
      preview: items.slice(0, 2),
      more: items.length > 2 ? items.length - 2 : 0,
    })
  }
  const selectedItems = (grouped[selected] || []).map(presentCalendarItem)
  return {
    title: year + '年' + month + '月',
    weekdays: [
      { label: '一', weekend: false },
      { label: '二', weekend: false },
      { label: '三', weekend: false },
      { label: '四', weekend: false },
      { label: '五', weekend: false },
      { label: '六', weekend: true },
      { label: '日', weekend: true },
    ],
    cells: viewCells,
    personDays: load.personDays,
    personDaysText: formatDayValue(load.personDays),
    peopleCount: load.people,
    selectedDate: selected,
    selectedTitle: formatDayTitle(selected),
    selectedItems: selectedItems,
    viewingCurrentMonth: String(today || '').slice(0, 7) === formatYMD(year, month, 1).slice(0, 7),
  }
}

module.exports = {
  overlapsMonth,
  selectCalendarLeaves,
  buildMonthGrid,
  groupLeavesByDate,
  monthLoad,
  clampSelected,
  assembleMonthView,
}
