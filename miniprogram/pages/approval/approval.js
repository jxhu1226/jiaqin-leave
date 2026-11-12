const { ensureUser, syncTabBar, friendlyError, showError, call, rememberPending } = require('../../utils/session')
const { presentLeave } = require('../../utils/logic/format')
const { todayCST } = require('../../utils/logic/date')

const TAB = 'pages/approval/approval'

Page({
  data: {
    booting: true,
    bootError: '',
    user: null,
    isAdmin: false,
    statusOptions: [
      { value: 'all', label: '全部' },
      { value: 'pending', label: '待审批' },
      { value: 'approved', label: '已通过' },
      { value: 'rejected', label: '已驳回' },
      { value: 'withdrawn', label: '已撤回' },
    ],
    status: 'pending',
    keyword: '',
    month: '',
    monthLabel: '全部月份',
    currentMonth: '',
    list: [],
    listLoading: false,
    listError: '',
    loaded: false,
    truncated: false,
    reviewShow: false,
    reviewTitle: '',
    reviewConfirm: '',
    reviewDanger: false,
    reviewing: false,
  },

  onLoad() {
    this._status = 'pending'
    this._keyword = ''
    this._month = ''
    this.setData({ currentMonth: todayCST().slice(0, 7) })
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

  reload() {
    return ensureUser(this, { force: true }).then((user) => {
      syncTabBar(this, TAB)
      if (user.role !== 'admin') return null
      return this.loadList()
    }).catch(() => {})
  },

  loadList() {
    this.setData({ listLoading: !this.data.loaded, listError: '' })
    return call('leave', {
      action: 'list',
      status: this._status || 'all',
      keyword: this._keyword || '',
      month: this._month || '',
    }).then((data) => {
      rememberPending(data.pendingCount || 0)
      syncTabBar(this, TAB)
      this.setData({
        list: (data.list || []).map(presentLeave),
        truncated: !!data.truncated,
        listLoading: false,
        loaded: true,
      })
    }).catch((err) => {
      this.setData({ listLoading: false, listError: friendlyError(err) })
    })
  },

  onStatus(e) {
    this._status = e.currentTarget.dataset.value || 'all'
    this.setData({ status: this._status })
    this.loadList()
  },

  onKeyword(e) {
    this._keyword = e.detail.value || ''
    this.setData({ keyword: this._keyword })
  },

  onMonth(e) {
    this._month = e.detail.value || ''
    this.setData({ month: this._month, monthLabel: this.monthText(this._month) })
    this.loadList()
  },

  onClearMonth() {
    this._month = ''
    this.setData({ month: '', monthLabel: '全部月份' })
    this.loadList()
  },

  monthText(month) {
    if (!month) return '全部月份'
    const parts = month.split('-')
    return Number(parts[0]) + '年' + Number(parts[1]) + '月'
  },

  noop() {},

  onOpen(e) {
    const id = e.currentTarget.dataset.id
    if (!id) return
    wx.navigateTo({ url: '/pages/leave-detail/leave-detail?id=' + encodeURIComponent(id) })
  },

  openReview(e) {
    const id = e.currentTarget.dataset.id
    const decision = e.currentTarget.dataset.decision
    this._reviewId = id
    this._decision = decision
    this.setData({
      reviewShow: true,
      reviewDanger: decision !== 'approved',
      reviewTitle: decision === 'approved' ? '同意该申请' : '驳回该申请',
      reviewConfirm: decision === 'approved' ? '同意' : '驳回',
    })
  },

  onCancelReview() {
    if (this.data.reviewing) return
    this.setData({ reviewShow: false })
  },

  onConfirmReview(e) {
    if (this.data.reviewing) return
    this.setData({ reviewing: true })
    call('leave', {
      action: 'review',
      id: this._reviewId,
      decision: this._decision,
      comment: e.detail.comment || '',
    }).then(() => {
      this.setData({ reviewing: false, reviewShow: false })
      wx.showToast({ title: this._decision === 'approved' ? '已通过' : '已驳回', icon: 'success' })
      return this.loadList()
    }).catch((err) => {
      this.setData({ reviewing: false })
      showError(friendlyError(err))
    })
  },
})
