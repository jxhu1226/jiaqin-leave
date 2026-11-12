const { readdirSync } = require('fs')
const { spawnSync } = require('child_process')
const path = require('path')

const dir = path.join(__dirname, '..', 'test')
const files = readdirSync(dir)
  .filter((name) => name.endsWith('.test.js'))
  .map((name) => path.join(dir, name))

const result = spawnSync(process.execPath, ['--test'].concat(files), { stdio: 'inherit' })
process.exit(result.status === null ? 1 : result.status)
