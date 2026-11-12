const test = require('node:test')
const assert = require('node:assert/strict')
const {
  MSG,
  roleForNewUser,
  shouldPromote,
  decideClaim,
  decideRoleChange,
  decideReview,
  decideWithdraw,
  viewAccess,
  matchExposed,
} = require('../shared/policy')

const admin = { openid: 'admin', role: 'admin', name: '周管理' }
const member = { openid: 'member', role: 'member', name: '陈同事' }
const pending = { _id: 'l1', openid: 'member', status: 'pending' }

test('bootstrap openids become admins on login', () => {
  assert.equal(roleForNewUser('o1', [' o1 ', '']), 'admin')
  assert.equal(roleForNewUser('o2', ['o1']), 'member')
  assert.equal(roleForNewUser('o2', null), 'member')
  assert.equal(shouldPromote({ role: 'member' }, 'o1', ['o1']), true)
  assert.equal(shouldPromote({ role: 'admin' }, 'o1', ['o1']), false)
  assert.equal(shouldPromote({ role: 'member' }, 'o2', ['o1']), false)
})

test('first admin claim', () => {
  assert.equal(decideClaim(member, 'nope', '', false, 10).error, MSG.initDisabled)
  assert.equal(decideClaim(member, 'nope', 'secret', false, 10).error, MSG.badCode)
  assert.equal(decideClaim(admin, 'secret', 'secret', true, 10).already, true)
  assert.equal(decideClaim(member, ' secret ', 'secret', true, 10).error, MSG.adminExists)
  const claimed = decideClaim(member, 'secret', 'secret', false, 10)
  assert.equal(claimed.ok, true)
  assert.deepEqual(claimed.patch, { role: 'admin', updatedAt: 10 })
  assert.equal(decideClaim(null, 'secret', 'secret', false, 10).error, MSG.loginRequired)
})

test('role changes keep at least one admin', () => {
  assert.equal(decideRoleChange(member, admin, 'member', 1, 5).error, MSG.adminOnly)
  assert.equal(decideRoleChange(admin, null, 'member', 1, 5).error, MSG.memberMissing)
  assert.equal(decideRoleChange(admin, admin, 'member', 2, 5).error, MSG.cannotDemoteSelf)
  assert.equal(decideRoleChange(admin, { openid: 'other', role: 'admin' }, 'member', 1, 5).error, MSG.lastAdmin)
  assert.equal(decideRoleChange(admin, member, 'member', 1, 5).unchanged, true)
  const promoted = decideRoleChange(admin, member, 'admin', 1, 8)
  assert.deepEqual(promoted.patch, { role: 'admin', updatedAt: 8 })
  const demoted = decideRoleChange(admin, { openid: 'other', role: 'admin' }, 'member', 2, 9)
  assert.equal(demoted.patch.role, 'member')
  assert.equal(decideRoleChange(admin, member, 'owner', 1, 5).error, MSG.badRole)
})

test('review and withdraw', () => {
  assert.equal(decideReview(pending, member, 'approved', '', 1).error, MSG.adminOnly)
  assert.equal(decideReview(null, admin, 'approved', '', 1).error, MSG.notFound)
  assert.equal(decideReview({ status: 'approved' }, admin, 'rejected', '', 1).error, MSG.alreadyHandled)
  assert.equal(decideReview(pending, admin, 'maybe', '', 1).error, MSG.badDecision)
  assert.equal(decideReview(pending, admin, 'approved', '意'.repeat(101), 1).error, MSG.commentTooLong)
  const approved = decideReview(pending, admin, 'approved', '  早点休息 ', 20)
  assert.deepEqual(approved.patch, {
    status: 'approved',
    reviewComment: '早点休息',
    reviewerOpenid: 'admin',
    reviewerName: '周管理',
    reviewedAt: 20,
    updatedAt: 20,
  })
  const unnamed = decideReview(pending, { openid: 'admin', role: 'admin', name: '' }, 'rejected', '', 3)
  assert.equal(unnamed.patch.reviewerName, '管理员')
  assert.equal(unnamed.patch.status, 'rejected')

  assert.equal(decideWithdraw(pending, { openid: 'other', role: 'member' }, 1).error, MSG.withdrawOwn)
  assert.equal(decideWithdraw({ openid: 'member', status: 'approved' }, member, 1).error, MSG.withdrawPending)
  assert.equal(decideWithdraw(null, member, 1).error, MSG.notFound)
  assert.deepEqual(decideWithdraw(pending, member, 6).patch, { status: 'withdrawn', updatedAt: 6 })
  assert.equal(decideReview(pending, admin, 'approved', '', 1).ok, true)
})

test('detail visibility', () => {
  const approved = { openid: 'member', status: 'approved' }
  const waiting = { openid: 'member', status: 'pending' }
  assert.equal(viewAccess(approved, member), 'private')
  assert.equal(viewAccess(approved, admin), 'private')
  assert.equal(viewAccess(approved, { openid: 'other', role: 'member' }), 'public')
  assert.equal(viewAccess(waiting, { openid: 'other', role: 'member' }), 'deny')
  assert.equal(viewAccess(null, member), 'deny')
})

test('known errors can be recovered from wrapped cloud messages', () => {
  const values = Object.keys(MSG).map((key) => MSG[key])
  assert.equal(new Set(values).size, values.length)
  assert.equal(matchExposed('transaction rollback: ' + MSG.notFound), MSG.notFound)
  assert.equal(matchExposed('database blew up'), '')
  assert.equal(matchExposed(decideReview(null, admin, 'approved', '', 1).error), MSG.notFound)
})
