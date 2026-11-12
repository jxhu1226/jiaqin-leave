// 纯逻辑模块。源文件在 shared/，由 scripts/sync-shared.js 同步到小程序与云函数。
// 云函数里的同意、驳回、撤回、设管理员都先过这里，再写数据库。

const MSG = {
  loginRequired: '请先登录',
  openidRequired: '请在小程序内登录后操作',
  adminOnly: '仅管理员可以执行此操作',
  notFound: '申请不存在',
  alreadyHandled: '该申请已处理，无法重复审批',
  badDecision: '无效的审批结果',
  commentTooLong: '审批意见不超过 100 字',
  withdrawOwn: '只能撤回自己的申请',
  withdrawPending: '仅待审批的申请可以撤回',
  cannotView: '无权查看该申请',
  initDisabled: '未开启初始化口令。请让现有管理员授权，或按说明配置首批管理员。',
  badCode: '口令不正确',
  adminExists: '已有管理员，请联系对方为你开通权限',
  memberMissing: '成员不存在。对方需要先打开一次小程序。',
  badRole: '无效的身份',
  cannotDemoteSelf: '不能取消自己的管理员身份',
  lastAdmin: '需要至少保留一名管理员',
  needName: '请先在「我的」页面填写姓名',
  overlap: '与已有的待审批或已通过记录时间重叠',
  missingId: '缺少申请编号',
  badMonth: '无效的月份',
  badStatus: '无效的状态筛选',
  unknownAction: '未知操作',
}

const EXPOSED_MESSAGES = Object.keys(MSG).map((key) => MSG[key])

function fail(error, code) {
  return { ok: false, error: error, code: code }
}

function trimEnds(value) {
  return String(value == null ? '' : value).replace(/^\s+|\s+$/g, '')
}

function normalizeBootstrap(list) {
  if (!Array.isArray(list)) return []
  const out = []
  for (let i = 0; i < list.length; i += 1) {
    const item = String(list[i] || '').trim()
    if (item) out.push(item)
  }
  return out
}

function roleForNewUser(openid, bootstrapList) {
  const list = normalizeBootstrap(bootstrapList)
  if (openid && list.indexOf(openid) >= 0) return 'admin'
  return 'member'
}

function shouldPromote(user, openid, bootstrapList) {
  if (!user || user.role === 'admin') return false
  return roleForNewUser(openid, bootstrapList) === 'admin'
}

function decideClaim(actor, code, expectedCode, adminExists, now) {
  if (!actor || !actor.openid) return fail(MSG.loginRequired, 'UNAUTHENTICATED')
  const expected = String(expectedCode || '').trim()
  if (!expected) return fail(MSG.initDisabled, 'BAD_REQUEST')
  const given = String(code || '').trim()
  if (Array.from(given).length > 64 || given !== expected) return fail(MSG.badCode, 'BAD_REQUEST')
  if (actor.role === 'admin') return { ok: true, already: true }
  if (adminExists) return fail(MSG.adminExists, 'FORBIDDEN')
  return { ok: true, patch: { role: 'admin', updatedAt: now } }
}

function decideRoleChange(actor, target, nextRole, adminCount, now) {
  if (!actor || actor.role !== 'admin') return fail(MSG.adminOnly, 'FORBIDDEN')
  if (!target || !target.openid) return fail(MSG.memberMissing, 'NOT_FOUND')
  if (nextRole !== 'admin' && nextRole !== 'member') return fail(MSG.badRole, 'BAD_REQUEST')
  if (actor.openid === target.openid && nextRole !== 'admin') return fail(MSG.cannotDemoteSelf, 'FORBIDDEN')
  if (target.role === 'admin' && nextRole === 'member' && adminCount <= 1) return fail(MSG.lastAdmin, 'CONFLICT')
  if (target.role === nextRole) return { ok: true, unchanged: true }
  return { ok: true, patch: { role: nextRole, updatedAt: now } }
}

function decideReview(leave, actor, decision, comment, now) {
  if (!actor || actor.role !== 'admin') return fail(MSG.adminOnly, 'FORBIDDEN')
  if (!leave) return fail(MSG.notFound, 'NOT_FOUND')
  if (leave.status !== 'pending') return fail(MSG.alreadyHandled, 'CONFLICT')
  if (decision !== 'approved' && decision !== 'rejected') return fail(MSG.badDecision, 'BAD_REQUEST')
  const text = trimEnds(comment)
  if (Array.from(text).length > 100) return fail(MSG.commentTooLong, 'BAD_REQUEST')
  return {
    ok: true,
    patch: {
      status: decision,
      reviewComment: text,
      reviewerOpenid: actor.openid,
      reviewerName: actor.name ? actor.name : '管理员',
      reviewedAt: now,
      updatedAt: now,
    },
  }
}

function decideWithdraw(leave, actor, now) {
  if (!actor || !actor.openid) return fail(MSG.loginRequired, 'UNAUTHENTICATED')
  if (!leave) return fail(MSG.notFound, 'NOT_FOUND')
  if (leave.openid !== actor.openid) return fail(MSG.withdrawOwn, 'FORBIDDEN')
  if (leave.status !== 'pending') return fail(MSG.withdrawPending, 'CONFLICT')
  return { ok: true, patch: { status: 'withdrawn', updatedAt: now } }
}

function viewAccess(leave, actor) {
  if (!leave || !actor) return 'deny'
  if (leave.openid === actor.openid || actor.role === 'admin') return 'private'
  if (leave.status === 'approved') return 'public'
  return 'deny'
}

function matchExposed(message) {
  const text = String(message || '')
  if (!text) return ''
  const all = EXPOSED_MESSAGES.slice().sort((a, b) => b.length - a.length)
  for (let i = 0; i < all.length; i += 1) {
    if (text.indexOf(all[i]) !== -1) return all[i]
  }
  return ''
}

module.exports = {
  MSG,
  EXPOSED_MESSAGES,
  normalizeBootstrap,
  roleForNewUser,
  shouldPromote,
  decideClaim,
  decideRoleChange,
  decideReview,
  decideWithdraw,
  viewAccess,
  matchExposed,
}
