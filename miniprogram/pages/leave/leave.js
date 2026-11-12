const { ensureUser, syncTabBar, friendlyError, call } = require('../../utils/session')
const { presentLeave, summarizeMine } = require('../../utils/logic/format')
const { todayCST } = require('../../utils/logic/date')

const TAB = 'pages/leave/leave'

Page({
  data: {
    booting: true,
    bootError: '',
    user: null,
    isAdmin: false,
    list: [],
    summary: null,
    listLoading: false,
    listError: '',
    loaded: false,
    truncated: false,
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
    return ensureUser(this, { force: true }).then(() => {
      syncTabBar(this, TAB)
      return this.loadList()
    }).catch(() => {})
  },

  loadList() {
    this.setData({ listLoading: !this.data.loaded, listError: '' })
    return call('leave', { action: 'mine' }).then((data) => {
      const list = (data.list || []).map(presentLeave)
      this.setData({
        list: list,
        summary: summarizeMine(list, todayCST()),
        truncated: !!data.truncated,
        listLoading: false,
        loaded: true,
      })
    }).catch((err) => {
      this.setData({ listLoading: false, listError: friendlyError(err) })
    })
  },

  onCreate() {
    const user = this.data.user
    if (user && !user.name) {
      wx.showModal({
        title: '需要姓名',
        content: '请先在「我的」页面填写姓名，再提交请假。',
        confirmText: '去填写',
        success: (res) => {
          if (res.confirm) wx.switchTab({ url: '/pages/profile/profile' })
        },
      })
      return
    }
    wx.navigateTo({ url: '/pages/leave-form/leave-form' })
  },

  onOpen(e) {
    const id = e.currentTarget.dataset.id
    if (!id) return
    wx.navigateTo({ url: '/pages/leave-detail/leave-detail?id=' + encodeURIComponent(id) })
  },
})
