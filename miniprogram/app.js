const config = require('./config')
const { isEnvConfigured } = require('./utils/env')
const { call } = require('./utils/api')

App({
  globalData: {
    user: null,
    envReady: false,
  },

  onLaunch() {
    this.globalData.envReady = isEnvConfigured()
    if (wx.hideShareMenu) {
      wx.hideShareMenu({ menus: ['shareAppMessage', 'shareTimeline'] })
    }
    if (!this.globalData.envReady) {
      console.warn('假勤：尚未配置云环境，请编辑 miniprogram/config.js')
      return
    }
    if (!wx.cloud) {
      console.warn('假勤：当前基础库不支持云开发')
      return
    }
    wx.cloud.init({
      env: config.envId,
      traceUser: true,
    })
  },

  ensureLogin(force) {
    if (!force && this.globalData.user) return Promise.resolve(this.globalData.user)
    if (!force && this._loginPromise) return this._loginPromise
    const pending = call('auth', { action: 'login' }).then((user) => {
      this.globalData.user = user
      if (this._loginPromise === pending) this._loginPromise = null
      return user
    }).catch((err) => {
      if (this._loginPromise === pending) this._loginPromise = null
      throw err
    })
    this._loginPromise = pending
    return pending
  },
})
