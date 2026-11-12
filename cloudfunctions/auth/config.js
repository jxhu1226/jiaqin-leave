/**
 * 首位管理员配置。
 * 修改本文件后运行 npm run sync-shared，再上传部署 auth 云函数。
 * 实际生效的是 cloudfunctions/auth/config.js（同步脚本会覆盖它）。
 */

/** 这些 openid 在登录时会被设为管理员，可填多个。 */
const BOOTSTRAP_ADMIN_OPENIDS = [
]

/**
 * 一次性初始化口令。留空表示关闭。
 * 开启后，还没有任何管理员时，成员可在「我的」页输入口令成为首位管理员。
 * 成功后请清空此口令并重新部署 auth，避免口令继续有效。
 * 若仓库会分享给他人，不要把正在使用的口令留在代码里。
 */
const INIT_ADMIN_CODE = ''

module.exports = {
  BOOTSTRAP_ADMIN_OPENIDS,
  INIT_ADMIN_CODE,
}
