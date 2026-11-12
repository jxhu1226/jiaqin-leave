const { ensureUser, friendlyError, showError, call } = require('../../utils/session')
const { avatarMeta } = require('../../utils/logic/format')

Page({
  data: {
    booting: true,
    bootError: '',
    user: null,
    isAdmin: false,
    forbidden: false,
    members: [],
    listLoading: false,
    listError: '',
    loaded: false,
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
    return ensureUser(this, { force: true }).then((user) => {
      if (user.role !== 'admin') {
        this.setData({ forbidden: true, members: [] })
        return null
      }
      this.setData({ forbidden: false })
      return this.loadMembers()
    }).catch(() => {})
  },

  loadMembers() {
    this.setData({ listLoading: !this.data.loaded, listError: '' })
    return call('auth', { action: 'listMembers' }).then((data) => {
      const members = (data.members || []).map((member) => {
        return Object.assign({}, member, {
          displayName: member.name || '未命名',
          roleLabel: member.role === 'admin' ? '管理员' : '成员',
          avatar: avatarMeta(member),
        })
      })
      this.setData({ members: members, listLoading: false, loaded: true })
    }).catch((err) => {
      this.setData({ listLoading: false, listError: friendlyError(err) })
    })
  },

  onToggle(e) {
    const openid = e.currentTarget.dataset.openid
    const role = e.currentTarget.dataset.role
    const name = e.currentTarget.dataset.name || '该成员'
    const next = role === 'admin' ? 'member' : 'admin'
    const content = next === 'admin'
      ? '确定将「' + name + '」设为管理员？管理员可以审批全部请假。'
      : '确定取消「' + name + '」的管理员身份？'
    wx.showModal({
      title: '调整权限',
      content: content,
      success: (res) => {
        if (res.confirm) this.changeRole(openid, next)
      },
    })
  },

  changeRole(targetOpenid, role) {
    call('auth', { action: 'setRole', targetOpenid: targetOpenid, role: role }).then(() => {
      wx.showToast({ title: '已更新', icon: 'success' })
      return this.loadMembers()
    }).catch((err) => {
      showError(friendlyError(err))
    })
  },
})
