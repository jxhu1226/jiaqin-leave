const { ensureUser, syncTabBar, friendlyError, showError, call } = require('../../utils/session')
const { avatarMeta, summarizeMine } = require('../../utils/logic/format')
const { validateProfile } = require('../../utils/logic/validate')
const { todayCST } = require('../../utils/logic/date')

const TAB = 'pages/profile/profile'

Page({
  data: {
    booting: true,
    bootError: '',
    user: null,
    isAdmin: false,
    name: '',
    department: '',
    avatar: { letter: '人', color: '#0f6e56' },
    dirty: false,
    saving: false,
    initCode: '',
    claiming: false,
    summary: null,
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
      const patch = {}
      const shownName = this.data.dirty ? (this._name || '') : (user.name || '')
      patch.avatar = avatarMeta({ name: shownName, openid: user.openid })
      if (!this.data.dirty) {
        this._name = user.name || ''
        this._department = user.department || ''
        patch.name = this._name
        patch.department = this._department
      }
      this.setData(patch)
      return this.loadSummary()
    }).catch(() => {})
  },

  loadSummary() {
    return call('leave', { action: 'mine' }).then((data) => {
      this.setData({ summary: summarizeMine(data.list || [], todayCST()) })
    }).catch(() => {})
  },

  onName(e) {
    this._name = e.detail.value
    this.setData({
      name: this._name,
      dirty: true,
      avatar: avatarMeta({
        name: this._name,
        openid: this.data.user ? this.data.user.openid : '',
      }),
    })
  },

  onDepartment(e) {
    this._department = e.detail.value
    this.setData({ department: this._department, dirty: true })
  },

  onCode(e) {
    this._code = e.detail.value
    this.setData({ initCode: this._code })
  },

  onSave() {
    if (this.data.saving) return
    const name = this._name != null ? this._name : this.data.name
    const department = this._department != null ? this._department : this.data.department
    const parsed = validateProfile({ name: name, department: department })
    if (!parsed.ok) {
      showError(parsed.error)
      return
    }
    this.setData({ saving: true })
    call('auth', {
      action: 'updateProfile',
      name: parsed.value.name,
      department: parsed.value.department,
    }).then((user) => {
      getApp().globalData.user = user
      this._name = user.name
      this._department = user.department
      this.setData({
        saving: false,
        dirty: false,
        user: user,
        isAdmin: user.role === 'admin',
        name: user.name,
        department: user.department,
        avatar: avatarMeta(user),
      })
      syncTabBar(this, TAB)
      wx.showToast({ title: '已保存', icon: 'success' })
    }).catch((err) => {
      this.setData({ saving: false })
      showError(friendlyError(err))
    })
  },

  onCopy() {
    const openid = this.data.user && this.data.user.openid
    if (!openid) return
    wx.setClipboardData({ data: openid })
  },

  onClaim() {
    if (this.data.claiming) return
    const code = this._code != null ? this._code : this.data.initCode
    if (!String(code || '').trim()) {
      showError('请输入初始化口令')
      return
    }
    this.setData({ claiming: true })
    call('auth', { action: 'claimAdmin', code: code }).then((user) => {
      getApp().globalData.user = user
      this._code = ''
      this.setData({
        claiming: false,
        initCode: '',
        user: user,
        isAdmin: user.role === 'admin',
      })
      syncTabBar(this, TAB)
      wx.showToast({ title: '你已成为管理员', icon: 'success' })
    }).catch((err) => {
      this.setData({ claiming: false })
      showError(friendlyError(err))
    })
  },

  onMembers() {
    wx.navigateTo({ url: '/pages/members/members' })
  },
})
