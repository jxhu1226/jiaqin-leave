const fs = require('fs')
const path = require('path')

const root = path.join(__dirname, '..')
const sharedDir = path.join(root, 'shared')
const files = fs.readdirSync(sharedDir).filter((name) => name.endsWith('.js'))
const targets = [
  path.join(root, 'miniprogram', 'utils', 'logic'),
  path.join(root, 'cloudfunctions', 'auth', 'logic'),
  path.join(root, 'cloudfunctions', 'leave', 'logic'),
]

for (let i = 0; i < targets.length; i += 1) {
  fs.mkdirSync(targets[i], { recursive: true })
  for (let j = 0; j < files.length; j += 1) {
    fs.copyFileSync(path.join(sharedDir, files[j]), path.join(targets[i], files[j]))
  }
}

fs.copyFileSync(
  path.join(root, 'cloud-shared', 'config.js'),
  path.join(root, 'cloudfunctions', 'auth', 'config.js'),
)
fs.copyFileSync(
  path.join(root, 'cloud-shared', 'runtime.js'),
  path.join(root, 'cloudfunctions', 'auth', 'runtime.js'),
)
fs.copyFileSync(
  path.join(root, 'cloud-shared', 'runtime.js'),
  path.join(root, 'cloudfunctions', 'leave', 'runtime.js'),
)

console.log('synced ' + files.length + ' shared modules into miniprogram, auth, and leave')
