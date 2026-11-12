const { call } = require('./api')

function friendlyError(err) {
  const raw = err && (err.errMsg || err.message) ? (err.errMsg || err.message) : '请求失败'
  if (/FUNCTION_NOT_FOUND|FunctionName|cloud function|env not exists|INVALID_ENV|-501000|-404011|云环境未配置|不支持云开发/.test(raw)) {
    return '云开发尚未就绪。请在 miniprogram/config.js 填写环境 ID，并上传部署 auth 与 leave 云函数。完整步骤见 README。'
  }
  if (/504002|FUNCTIONS_EXECUTE_FAIL/.test(raw)) {
    return '云函数执行失败。请查看云函数日志，并确认已经开通云开发、创建环境，且数据库可用。'
  }
  if (/timeout|超时/.test(raw)) return '请求超时，请稍后重试'
  return raw
}

function showError(message) {
  const text = message || '操作失败'
  if (text.length > 14) {
    wx.showModal({ title: '提示', content: text, showCancel: false })
    return
  }
  wx.showToast({ title: text, icon: 'none' })
}

function syncTabBar(page, selected) {
  if (typeof page.getTabBar !== 'function') return
  const bar = page.getTabBar()
  if (!bar) return
  const user = getApp().globalData.user || {}
  bar.setData({
    selected: selected,
    role: user.role || 'member',
    pendingCount: user.pendingCount || 0,
  })
}

function ensureUser(page, options) {
  const force = !!(options && options.force)
  if (!page.data.user) page.setData({ booting: true, bootError: '' })
  return getApp().ensureLogin(force).then((user) => {
    page.setData({
      booting: false,
      bootError: '',
      user: user,
      isAdmin: user.role === 'admin',
    })
    return user
  }).catch((err) => {
    page.setData({
      booting: false,
      bootError: friendlyError(err),
      user: page.data.user || null,
    })
    throw err
  })
}

function rememberPending(count) {
  const user = getApp().globalData.user
  if (user && typeof count === 'number') user.pendingCount = count
}

module.exports = {
  call: call,
  friendlyError: friendlyError,
  showError: showError,
  syncTabBar: syncTabBar,
  ensureUser: ensureUser,
  rememberPending: rememberPending,
}
