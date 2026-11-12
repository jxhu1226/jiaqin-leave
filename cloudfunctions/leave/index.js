const { createRuntime, handle, isMissingCollection } = require('./runtime')
const { MSG, decideReview, decideWithdraw, viewAccess, matchExposed } = require('./logic/policy')
const { validateLeaveInput } = require('./logic/validate')
const { rangesOverlap } = require('./logic/duration')
const { STATUS_LABEL } = require('./logic/constants')
const { isValidMonth, formatYMD, daysInMonth } = require('./logic/date')
const { overlapsMonth } = require('./logic/calendar')

const rt = createRuntime()

function toPublicLeave(doc) {
  return {
    _id: doc._id,
    openid: doc.openid,
    userName: doc.userName || '',
    department: doc.department || '',
    type: doc.type,
    startDate: doc.startDate,
    startHalf: doc.startHalf,
    endDate: doc.endDate,
    endHalf: doc.endHalf,
    duration: doc.duration,
    status: doc.status,
    access: 'public',
  }
}

function toPrivateLeave(doc) {
  return Object.assign(toPublicLeave(doc), {
    access: 'private',
    reason: doc.reason || '',
    reviewComment: doc.reviewComment || '',
    reviewerOpenid: doc.reviewerOpenid || '',
    reviewerName: doc.reviewerName || '',
    reviewedAt: doc.reviewedAt || 0,
    createdAt: doc.createdAt || 0,
    updatedAt: doc.updatedAt || 0,
  })
}

async function getLeave(id) {
  try {
    const res = await rt.db.collection('leaves').doc(id).get()
    return res.data || null
  } catch (err) {
    return null
  }
}

async function mutateLeave(id, decide) {
  let updated = null
  let failure = ''
  try {
    await rt.db.runTransaction(async (transaction) => {
      let current = null
      try {
        const snap = await transaction.collection('leaves').doc(id).get()
        current = snap.data || null
      } catch (err) {
        current = null
      }
      const decision = decide(current)
      if (!decision.ok) {
        failure = decision.error
        await transaction.rollback(decision.error)
        return
      }
      await transaction.collection('leaves').doc(id).update({ data: decision.patch })
      updated = Object.assign({}, current, decision.patch)
    })
  } catch (err) {
    const text = typeof err === 'string' ? err : ((err && (err.message || err.errMsg)) || '')
    const known = matchExposed(text) || failure
    if (known) rt.fail(known, 'CONFLICT')
    throw err
  }
  if (failure) rt.fail(failure, 'CONFLICT')
  if (!updated) rt.fail(MSG.notFound, 'NOT_FOUND')
  return updated
}

async function submit(openid, event) {
  const user = await rt.assertUser(openid)
  if (!user.name) rt.fail(MSG.needName, 'BAD_REQUEST')
  const parsed = validateLeaveInput(event)
  if (!parsed.ok) rt.fail(parsed.error, 'BAD_REQUEST')
  const value = parsed.value
  const existing = await rt.queryAll('leaves', { openid: openid }, 300)
  for (let i = 0; i < existing.length; i += 1) {
    const item = existing[i]
    if (item.status !== 'pending' && item.status !== 'approved') continue
    if (rangesOverlap(item, value)) rt.fail(MSG.overlap, 'CONFLICT')
  }
  const now = Date.now()
  const record = {
    openid: openid,
    userName: user.name,
    department: user.department || '',
    type: value.type,
    startDate: value.startDate,
    startHalf: value.startHalf,
    endDate: value.endDate,
    endHalf: value.endHalf,
    duration: value.duration,
    reason: value.reason,
    status: 'pending',
    reviewComment: '',
    reviewerOpenid: '',
    reviewerName: '',
    reviewedAt: 0,
    createdAt: now,
    updatedAt: now,
  }
  const added = await rt.db.collection('leaves').add({ data: record })
  return rt.ok(toPrivateLeave(Object.assign({ _id: added._id }, record)))
}

async function withdraw(openid, event) {
  const actor = await rt.assertUser(openid)
  const id = String(event.id || '')
  if (!id) rt.fail(MSG.missingId, 'BAD_REQUEST')
  const updated = await mutateLeave(id, (current) => decideWithdraw(current, actor, Date.now()))
  return rt.ok(toPrivateLeave(updated))
}

async function mine(openid) {
  await rt.assertUser(openid)
  const rows = await rt.queryAll('leaves', { openid: openid }, 500)
  rows.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
  return rt.ok({
    list: rows.slice(0, 200).map(toPrivateLeave),
    truncated: rows.length > 200,
  })
}

function parseMonth(value) {
  const month = String(value || '')
  if (!month) return null
  if (!/^\d{4}-\d{2}$/.test(month)) return false
  const year = Number(month.slice(0, 4))
  const mon = Number(month.slice(5, 7))
  if (!isValidMonth(year, mon)) return false
  return { year: year, month: mon }
}

async function list(openid, event) {
  await rt.assertAdmin(openid)
  const status = event.status && event.status !== 'all' ? String(event.status) : ''
  if (status && !STATUS_LABEL[status]) rt.fail(MSG.badStatus, 'BAD_REQUEST')
  const month = parseMonth(event.month)
  if (month === false) rt.fail(MSG.badMonth, 'BAD_REQUEST')
  const keyword = Array.from(String(event.keyword || '').trim()).slice(0, 20).join('').toLowerCase()
  const cap = 1000
  const rows = status
    ? await rt.queryAll('leaves', { status: status }, cap)
    : await rt.queryAll('leaves', {}, cap)
  const hitCap = rows.length >= cap
  const filtered = rows.filter((row) => {
    if (keyword && String(row.userName || '').toLowerCase().indexOf(keyword) === -1) return false
    if (month && !overlapsMonth(row, month.year, month.month)) return false
    return true
  })
  filtered.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
  const pendingCount = await rt.countWhere('leaves', { status: 'pending' })
  return rt.ok({
    list: filtered.slice(0, 200).map(toPrivateLeave),
    pendingCount: pendingCount,
    truncated: hitCap || filtered.length > 200,
  })
}

async function review(openid, event) {
  const actor = await rt.assertAdmin(openid)
  const id = String(event.id || '')
  if (!id) rt.fail(MSG.missingId, 'BAD_REQUEST')
  const updated = await mutateLeave(id, (current) => {
    return decideReview(current, actor, event.decision, event.comment, Date.now())
  })
  return rt.ok(toPrivateLeave(updated))
}

async function detail(openid, event) {
  const actor = await rt.assertUser(openid)
  const id = String(event.id || '')
  if (!id) rt.fail(MSG.missingId, 'BAD_REQUEST')
  const leave = await getLeave(id)
  const access = viewAccess(leave, actor)
  if (access === 'deny') {
    rt.fail(leave ? MSG.cannotView : MSG.notFound, leave ? 'FORBIDDEN' : 'NOT_FOUND')
  }
  return rt.ok(access === 'private' ? toPrivateLeave(leave) : toPublicLeave(leave))
}

async function calendar(openid, event) {
  await rt.assertUser(openid)
  const year = Number(event.year)
  const month = Number(event.month)
  if (!isValidMonth(year, month)) rt.fail(MSG.badMonth, 'BAD_REQUEST')
  const end = formatYMD(year, month, daysInMonth(year, month))
  const start = formatYMD(year, month, 1)
  const rows = await rt.queryAll('leaves', { status: 'approved' }, 1000)
  const leaves = []
  for (let i = 0; i < rows.length; i += 1) {
    if (rows[i].startDate <= end && rows[i].endDate >= start) leaves.push(toPublicLeave(rows[i]))
  }
  return rt.ok({ year: year, month: month, leaves: leaves })
}

async function dispatch(action, openid, event) {
  if (action === 'submit') return submit(openid, event)
  if (action === 'withdraw') return withdraw(openid, event)
  if (action === 'mine') return mine(openid)
  if (action === 'list') return list(openid, event)
  if (action === 'review') return review(openid, event)
  if (action === 'detail') return detail(openid, event)
  if (action === 'calendar') return calendar(openid, event)
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
