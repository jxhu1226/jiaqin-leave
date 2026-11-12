// 云函数运行时。本文件由 scripts/sync-shared.js 复制到每个云函数目录，
// 与 logic/ 放在一起后才能 require('./logic/policy')。

const cloud = require('wx-server-sdk')
const { MSG, matchExposed } = require('./logic/policy')

function createRuntime() {
  cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
  const db = cloud.database()

  function fail(message, code) {
    const err = new Error(message)
    err.expose = true
    err.code = code || 'BAD_REQUEST'
    throw err
  }

  function ok(data) {
    return { ok: true, data: data === undefined ? null : data }
  }

  async function ensureCollections() {
    const names = ['users', 'leaves']
    for (let i = 0; i < names.length; i += 1) {
      try {
        await db.createCollection(names[i])
      } catch (err) {
        // 集合已存在时创建会失败，忽略即可。
      }
    }
  }

  async function getUser(openid) {
    if (!openid) return null
    try {
      const res = await db.collection('users').doc(openid).get()
      return res.data || null
    } catch (err) {
      return null
    }
  }

  async function assertUser(openid) {
    if (!openid) fail(MSG.openidRequired, 'UNAUTHENTICATED')
    const user = await getUser(openid)
    if (!user) fail(MSG.loginRequired, 'UNAUTHENTICATED')
    if (!user.openid) user.openid = openid
    return user
  }

  async function assertAdmin(openid) {
    const user = await assertUser(openid)
    if (user.role !== 'admin') fail(MSG.adminOnly, 'FORBIDDEN')
    return user
  }

  async function fetchAll(makeQuery, cap) {
    const max = cap || 1000
    const rows = []
    let skip = 0
    while (rows.length < max) {
      const size = Math.min(100, max - rows.length)
      const res = await makeQuery().skip(skip).limit(size).get()
      const batch = res.data || []
      rows.push.apply(rows, batch)
      if (batch.length < size) break
      skip += batch.length
    }
    return rows
  }

  function matches(row, filter) {
    const keys = Object.keys(filter)
    for (let i = 0; i < keys.length; i += 1) {
      if (row[keys[i]] !== filter[keys[i]]) return false
    }
    return true
  }

  async function queryAll(collectionName, filter, cap) {
    const safeFilter = filter || {}
    const keys = Object.keys(safeFilter)
    if (!keys.length) return fetchAll(() => db.collection(collectionName), cap)
    try {
      return await fetchAll(() => db.collection(collectionName).where(safeFilter), cap)
    } catch (err) {
      console.error('query fallback', collectionName, err)
      const all = await fetchAll(() => db.collection(collectionName), cap)
      return all.filter((row) => matches(row, safeFilter))
    }
  }

  async function countWhere(collectionName, filter) {
    try {
      const res = await db.collection(collectionName).where(filter).count()
      return res.total || 0
    } catch (err) {
      console.error('count fallback', collectionName, err)
      const rows = await queryAll(collectionName, filter, 1000)
      return rows.length
    }
  }

  return {
    cloud,
    db,
    fail,
    ok,
    ensureCollections,
    getUser,
    assertUser,
    assertAdmin,
    fetchAll,
    queryAll,
    countWhere,
  }
}

function handle(err) {
  console.error(err)
  if (err && err.expose && err.message) {
    return { ok: false, error: err.message, code: err.code || 'BAD_REQUEST' }
  }
  const text = err && (err.message || err.errMsg) ? (err.message || err.errMsg) : ''
  const known = matchExposed(text)
  if (known) return { ok: false, error: known, code: 'CONFLICT' }
  return { ok: false, error: '服务异常，请稍后重试', code: 'INTERNAL' }
}

function isMissingCollection(err) {
  const text = String(err && (err.message || err.errMsg) ? (err.message || err.errMsg) : '') + JSON.stringify(err && err.errCode ? err.errCode : '')
  return text.indexOf('502005') !== -1
    || text.indexOf('DATABASE_COLLECTION_NOT_EXIST') !== -1
    || text.indexOf('Db or Table not exist') !== -1
    || text.indexOf('collection not exists') !== -1
}

module.exports = {
  createRuntime,
  handle,
  isMissingCollection,
}
