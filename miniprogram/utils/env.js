const config = require('../config')

function isEnvConfigured() {
  const id = config.envId ? String(config.envId) : ''
  if (!id) return false
  if (id.indexOf('replace-with') === 0) return false
  if (id === 'your-env-id') return false
  return true
}

module.exports = {
  isEnvConfigured: isEnvConfigured,
}
