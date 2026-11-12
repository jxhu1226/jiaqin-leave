const { ensureUser, syncTabBar, friendlyError, call } = require('../../utils/session')
const { assembleMonthView } = require('../../utils/logic/calendar')
const { todayCST, shiftMonth, parseYMD } = require('../../utils/logic/date')
const { LEGEND } = require('../../utils/logic/constants')

const TAB = 'pages/calendar/calendar'

Page({
  data: {
    booting: true,
    bootError: '',
    user: null,
    isAdmin: false,
    legend: LEGEND,
    year: 2026,
    month: 1,
    selectedDate: '',
    title: '',
    weekdays: [],
    cells: [],
    personDaysText: '0',
    peopleCount: 0,
    selectedTitle: '',
    selectedItems: [],
    viewingCurrentMonth: true,
    monthLoading: false,
    monthError: '',
    loaded: false,
  },

  onLoad() {
    const today = todayCST()
    const parts = parseYMD(today)
    this._selected = today
    this._year = parts.y
    this._month = parts.m
    this.setData({
      year: parts.y,
      month: parts.m,
      selectedDate: today,
    })
  },

  onShow() {
    syncTabBar(this, TAB)
    this.reload()
  },

  onPullDownRefresh() {
    this.reload().then(() => wx.stopPullDownRefresh(), () => wx.stopPullDownRefresh())
  },

  onRetry() {
    this.reload()
  },

  onRetryMonth() {
    this.loadMonth(this._year, this._month)
  },

  reload() {
    return ensureUser(this, { force: true }).then(() => {
      syncTabBar(this, TAB)
      return this.loadMonth(this._year, this._month)
    }).catch(() => {})
  },

  loadMonth(year, month) {
    const y = typeof year === 'number' ? year : this._year
    const m = typeof month === 'number' ? month : this._month
    this._year = y
    this._month = m
    const req = (this._req || 0) + 1
    this._req = req
    this.setData({
      year: y,
      month: m,
      title: y + '年' + m + '月',
      monthLoading: !this.data.loaded,
      monthError: '',
    })
    return call('leave', { action: 'calendar', year: y, month: m }).then((data) => {
      if (this._req !== req) return
      this._leaves = data.leaves || []
      this.applyView(y, m)
      this.setData({ monthLoading: false, loaded: true, monthError: '' })
    }).catch((err) => {
      if (this._req !== req) return
      this.setData({ monthLoading: false, monthError: friendlyError(err) })
    })
  },

  applyView(year, month) {
    const y = typeof year === 'number' ? year : this.data.year
    const m = typeof month === 'number' ? month : this.data.month
    const view = assembleMonthView(y, m, this._leaves || [], this._selected || this.data.selectedDate, todayCST())
    const user = this.data.user || getApp().globalData.user
    const selectedItems = []
    for (let i = 0; i < view.selectedItems.length; i += 1) {
      const item = view.selectedItems[i]
      selectedItems.push(Object.assign({}, item, {
        canOpen: !!(user && (user.role === 'admin' || user.openid === item.openid)),
      }))
    }
    this._selected = view.selectedDate
    const cells = []
    for (let i = 0; i < view.cells.length; i += 1) {
      cells.push(Object.assign({ key: String(i) }, view.cells[i]))
    }
    this.setData({
      year: y,
      month: m,
      title: view.title,
      weekdays: view.weekdays,
      cells: cells,
      personDaysText: view.personDaysText,
      peopleCount: view.peopleCount,
      selectedDate: view.selectedDate,
      selectedTitle: view.selectedTitle,
      selectedItems: selectedItems,
      viewingCurrentMonth: view.viewingCurrentMonth,
    })
  },

  onPrev() {
    const next = shiftMonth(this._year, this._month, -1)
    this.loadMonth(next.year, next.month)
  },

  onNext() {
    const next = shiftMonth(this._year, this._month, 1)
    this.loadMonth(next.year, next.month)
  },

  onToday() {
    const today = todayCST()
    const parts = parseYMD(today)
    this._selected = today
    this.loadMonth(parts.y, parts.m)
  },

  onSelectDay(e) {
    const date = e.currentTarget.dataset.date
    if (!date) return
    this._selected = date
    this.applyView(this._year, this._month)
  },

  onOpenLeave(e) {
    if (String(e.currentTarget.dataset.open) !== '1') return
    const id = e.currentTarget.dataset.id
    if (!id) return
    wx.navigateTo({ url: '/pages/leave-detail/leave-detail?id=' + encodeURIComponent(id) })
  },
})
