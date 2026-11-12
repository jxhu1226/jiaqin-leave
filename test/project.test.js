const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('fs')
const path = require('path')

const root = path.join(__dirname, '..')

test('synced copies match the source modules', () => {
  const shared = fs.readdirSync(path.join(root, 'shared')).filter((name) => name.endsWith('.js'))
  const dests = [
    'miniprogram/utils/logic',
    'cloudfunctions/auth/logic',
    'cloudfunctions/leave/logic',
  ]
  assert.ok(shared.length >= 7)
  for (let i = 0; i < dests.length; i += 1) {
    for (let j = 0; j < shared.length; j += 1) {
      const source = fs.readFileSync(path.join(root, 'shared', shared[j]), 'utf8')
      const copy = fs.readFileSync(path.join(root, dests[i], shared[j]), 'utf8')
      assert.equal(copy, source, dests[i] + '/' + shared[j])
    }
  }
  assert.equal(
    fs.readFileSync(path.join(root, 'cloud-shared/config.js'), 'utf8'),
    fs.readFileSync(path.join(root, 'cloudfunctions/auth/config.js'), 'utf8'),
  )
  assert.equal(
    fs.readFileSync(path.join(root, 'cloud-shared/runtime.js'), 'utf8'),
    fs.readFileSync(path.join(root, 'cloudfunctions/auth/runtime.js'), 'utf8'),
  )
  assert.equal(
    fs.readFileSync(path.join(root, 'cloud-shared/runtime.js'), 'utf8'),
    fs.readFileSync(path.join(root, 'cloudfunctions/leave/runtime.js'), 'utf8'),
  )
})

test('cloud functions expose the required actions', () => {
  const auth = fs.readFileSync(path.join(root, 'cloudfunctions/auth/index.js'), 'utf8')
  const leave = fs.readFileSync(path.join(root, 'cloudfunctions/leave/index.js'), 'utf8')
  ;['login', 'updateProfile', 'listMembers', 'setRole', 'claimAdmin'].forEach((name) => {
    assert.match(auth, new RegExp("action === '" + name + "'"))
  })
  ;['submit', 'withdraw', 'mine', 'list', 'review', 'detail', 'calendar'].forEach((name) => {
    assert.match(leave, new RegExp("action === '" + name + "'"))
  })
  assert.match(auth, /getWXContext/)
  assert.match(leave, /getWXContext/)
  assert.doesNotMatch(leave, /event\.openid/)
})

test('tab icons are 81px pngs', () => {
  ;['calendar', 'leave', 'approval', 'profile'].forEach((name) => {
    ;['', '-on'].forEach((suffix) => {
      const buf = fs.readFileSync(path.join(root, 'miniprogram/assets/tab', name + suffix + '.png'))
      assert.equal(buf.readUInt32BE(0), 0x89504e47)
      assert.equal(buf.readUInt32BE(16), 81)
      assert.equal(buf.readUInt32BE(20), 81)
    })
  })
})
