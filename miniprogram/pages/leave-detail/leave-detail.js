const { ensureUser, friendlyError, showError, call, rememberPending } = require('../../utils/session')
const { presentLeave } = require('../../utils/logic/format')

Page({
  data: {
    booting: true,
    bootError: '',
    user: null,
    isAdmin: false,
    id: '',
    leave: null,
    isOwner: false,
    showActions: false,
    reviewShow: false,
    reviewTitle: '',
    reviewConfirm: '',
    reviewDanger: false,
    reviewing: false,
    withdrawing: false,
  },

  onLoad(query) {
    this.setData({ id: decodeURIComponent(query.id || '') })
  },

  onShow() {
    this.reload()
  },

  onPullDownRefresh() {
    this.reload().then(() => wx.stopPullDownRefresh(), () => wx.stopPullDownRefresh())
  },

  onRetry() {
    this.reload()
  },

  reload() {
    if (!this.data.id) {
      this.setData({ booting: false, bootError: '缺少申请编号' })
      return Promise.resolve()
    }
    return ensureUser(this, { force: true }).then(() => this.loadDetail()).catch(() => {})
  },

  loadDetail() {
    return call('leave', { action: 'detail', id: this.data.id }).then((data) => {
      this.applyLeave(data)
    }).catch((err) => {
      this.setData({ bootError: this.data.leave ? '' : friendlyError(err), leave: this.data.leave })
      if (this.data.leave) showError(friendlyError(err))
      else this.setData({ booting: false, bootError: friendlyError(err) })
    })
  },

  applyLeave(raw) {
    const leave = presentLeave(raw)
    const user = this.data.user
    const isOwner = !!(user && user.openid === leave.openid)
    const isAdmin = !!(user && user.role === 'admin')
    this.setData({
      leave: leave,
      isOwner: isOwner,
      isAdmin: isAdmin,
      showActions: leave.status === 'pending' && (isOwner || isAdmin),
      booting: false,
      bootError: '',
    })
  },

  onWithdraw() {
    if (this.data.withdrawing) return
    wx.showModal({
      title: '撤回申请',
      content: '撤回后需要重新提交。确定撤回吗？',
      confirmColor: '#9d3b32',
      success: (res) => {
        if (res.confirm) this.doWithdraw()
      },
    })
  },

  doWithdraw() {
    this.setData({ withdrawing: true })
    call('leave', { action: 'withdraw', id: this.data.id }).then((data) => {
      this.setData({ withdrawing: false })
      this.applyLeave(data)
      wx.showToast({ title: '已撤回', icon: 'success' })
    }).catch((err) => {
      this.setData({ withdrawing: false })
      showError(friendlyError(err))
    })
  },

  onApprove() {
    this.openReview('approved')
  },

  onReject() {
    this.openReview('rejected')
  },

  openReview(decision) {
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
      id: this.data.id,
      decision: this._decision,
      comment: e.detail.comment || '',
    }).then((data) => {
      const user = getApp().globalData.user
      if (user) rememberPending(Math.max(0, (user.pendingCount || 1) - 1))
      this.setData({ reviewing: false, reviewShow: false })
      this.applyLeave(data)
      wx.showToast({ title: this._decision === 'approved' ? '已通过' : '已驳回', icon: 'success' })
    }).catch((err) => {
      this.setData({ reviewing: false })
      showError(friendlyError(err))
    })
  },
})
