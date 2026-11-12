const { isEnvConfigured } = require('./env')

function call(name, data) {
  if (!isEnvConfigured()) {
    return Promise.reject(new Error('云环境未配置。请在 miniprogram/config.js 填写 envId。'))
  }
  if (!wx.cloud) {
    return Promise.reject(new Error('当前基础库不支持云开发，请把调试基础库调到 3.7.1 或更高。'))
  }
  return wx.cloud.callFunction({
    name: name,
    data: data || {},
  }).then((res) => {
    const result = res && res.result
    if (!result || typeof result !== 'object') {
      throw new Error('云函数没有返回结果，请确认 auth 与 leave 已部署成功')
    }
    if (!result.ok) {
      const error = new Error(result.error || '请求失败')
      error.code = result.code || ''
      throw error
    }
    return result.data
  })
}

module.exports = {
  call: call,
}
