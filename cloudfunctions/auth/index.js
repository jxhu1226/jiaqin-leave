const { createRuntime, handle, isMissingCollection } = require('./runtime')
const config = require('./config')
const {
  MSG,
  decideClaim,
  decideRoleChange,
  roleForNewUser,
  shouldPromote,
} = require('./logic/policy')
const { validateProfile } = require('./logic/validate')

const rt = createRuntime()

function toClientUser(user, pendingCount) {
  return {
    openid: user.openid,
    name: user.name || '',
    department: user.department || '',
    role: user.role === 'admin' ? 'admin' : 'member',
    pendingCount: pendingCount || 0,
    createdAt: user.createdAt || 0,
  }
}

async function login(openid) {
  if (!openid) rt.fail(MSG.openidRequired, 'UNAUTHENTICATED')
  await rt.ensureCollections()
  const now = Date.now()
  const ref = rt.db.collection('users').doc(openid)
  let user = await rt.getUser(openid)
  if (!user) {
    user = {
      openid: openid,
      name: '',
      department: '',
      role: roleForNewUser(openid, config.BOOTSTRAP_ADMIN_OPENIDS),
      createdAt: now,
      updatedAt: now,
    }
    await ref.set({ data: user })
  } else {
    if (!user.openid) user.openid = openid
    if (user.role !== 'admin' && user.role !== 'member') {
      await ref.update({ data: { role: 'member', updatedAt: now } })
      user.role = 'member'
    }
    if (shouldPromote(user, openid, config.BOOTSTRAP_ADMIN_OPENIDS)) {
      await ref.update({ data: { role: 'admin', updatedAt: now } })
      user.role = 'admin'
      user.updatedAt = now
    }
  }
  const count = user.role === 'admin' ? await rt.countWhere('leaves', { status: 'pending' }) : 0
  return rt.ok(toClientUser(user, count))
}

async function updateProfile(openid, event) {
  const user = await rt.assertUser(openid)
  const parsed = validateProfile(event)
  if (!parsed.ok) rt.fail(parsed.error, 'BAD_REQUEST')
  const now = Date.now()
  await rt.db.collection('users').doc(openid).update({
    data: {
      name: parsed.value.name,
      department: parsed.value.department,
      updatedAt: now,
    },
  })
  user.name = parsed.value.name
  user.department = parsed.value.department
  const count = user.role === 'admin' ? await rt.countWhere('leaves', { status: 'pending' }) : 0
  return rt.ok(toClientUser(user, count))
}

async function listMembers(openid) {
  await rt.assertAdmin(openid)
  const rows = await rt.queryAll('users', {}, 500)
  rows.sort((a, b) => {
    if (a.role !== b.role) return a.role === 'admin' ? -1 : 1
    return String(a.name || '').localeCompare(String(b.name || ''))
  })
  return rt.ok({
    members: rows.map((user) => ({
      openid: user.openid || user._id,
      name: user.name || '',
      department: user.department || '',
      role: user.role === 'admin' ? 'admin' : 'member',
      createdAt: user.createdAt || 0,
    })),
  })
}

async function setRole(openid, event) {
  const actor = await rt.assertAdmin(openid)
  const targetId = String(event.targetOpenid || '')
  const target = await rt.getUser(targetId)
  if (target && !target.openid) target.openid = targetId
  const admins = await rt.queryAll('users', { role: 'admin' }, 100)
  const decision = decideRoleChange(actor, target, event.role, admins.length, Date.now())
  if (!decision.ok) rt.fail(decision.error, decision.code)
  if (decision.patch) {
    await rt.db.collection('users').doc(targetId).update({ data: decision.patch })
  }
  return rt.ok({
    openid: targetId,
    role: decision.patch ? decision.patch.role : target.role,
  })
}

async function claimAdmin(openid, event) {
  const user = await rt.assertUser(openid)
  const admins = await rt.queryAll('users', { role: 'admin' }, 20)
  const decision = decideClaim(user, event.code, config.INIT_ADMIN_CODE, admins.length > 0, Date.now())
  if (!decision.ok) rt.fail(decision.error, decision.code)
  if (decision.patch) {
    await rt.db.collection('users').doc(openid).update({ data: decision.patch })
    user.role = 'admin'
  }
  const count = await rt.countWhere('leaves', { status: 'pending' })
  return rt.ok(toClientUser(user, count))
}

async function dispatch(action, openid, event) {
  if (action === 'login') return login(openid)
  if (action === 'updateProfile') return updateProfile(openid, event)
  if (action === 'listMembers') return listMembers(openid)
  if (action === 'setRole') return setRole(openid, event)
  if (action === 'claimAdmin') return claimAdmin(openid, event)
  rt.fail(MSG.unknownAction, 'BAD_REQUEST')
}

async function run(fn) {
  try {
    return await fn()
  } catch (err) {
    if (!isMissingCollection(err)) throw err
    await rt.ensureCollections()
    return fn()
  }
}

exports.main = async (event) => {
  const context = rt.cloud.getWXContext()
  const openid = context.OPENID || ''
  const payload = event || {}
  try {
    return await run(() => dispatch(payload.action, openid, payload))
  } catch (err) {
    return handle(err)
  }
}
