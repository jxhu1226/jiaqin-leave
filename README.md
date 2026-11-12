# 假勤

组织内部的请假审批小程序。成员提交请假，管理员同意或驳回，已通过的记录出现在全员都能看的公共日历上。后端用微信云开发（云函数 + 云数据库），不需要单独架服务器。

界面文字是简体中文。调试基础库请使用 **3.7.1** 或更高。

## 上线前必须手动完成的步骤

下面 6 步都要在你自己的电脑和微信开发者工具里做完，小程序才能真正审批和上日历。仓库里的 `touristappid` 和 `replace-with-your-env-id` 只是占位，不能直接使用。

先安装 [微信开发者工具](https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html) 稳定版，导入本仓库根目录（包含 `project.config.json` 的那一层），后端服务选「微信云开发」，调试基础库选 **3.7.1** 或更高。

### 1. 把 `project.config.json` 里的 `touristappid` 换成真实 AppID

打开 `project.config.json`，现在是：

```json
"appid": "touristappid"
```

改成你的小程序 AppID，例如：

```json
"appid": "wx1234567890abcdef"
```

`touristappid` 只能把项目打开，不能开通和使用云开发。在开发者工具「详情 → 基本信息」里改 AppID，和直接改这个字段是同一件事。

### 2. 开通云开发，并把环境 ID 写入 `miniprogram/config.js`

1. 开发者工具顶部打开「云开发」，按提示开通，并创建一个环境。
2. 在云开发控制台的「设置」里复制环境 ID。要填 `cloud1-` 开头的环境 ID，不是环境名称。
3. 打开 `miniprogram/config.js`。现在是：

```js
envId: 'replace-with-your-env-id',
```

改成你的环境 ID，例如：

```js
envId: 'cloud1-xxxxxxxx',
```

4. 重新编译。`envId` 仍是 `replace-with-your-env-id` 时，页面会提示云开发尚未就绪，不会调用云函数。

### 3. 上传并部署 `auth` 和 `leave`（选择「云端安装依赖」）

在开发者工具的云函数列表里，对下面两个目录分别右键，选择 **上传并部署：云端安装依赖**：

- `cloudfunctions/auth`（登录、资料、角色、初始化口令）
- `cloudfunctions/leave`（提交、撤回、列表、审批、日历）

必须选「云端安装依赖」。`wx-server-sdk` 要在云端安装，只上传源码不够。

首次登录会尝试创建数据库集合 `users` 和 `leaves`。控制台里没有这两个集合时，到「云开发 → 数据库」手动新建同名集合。

### 4. 把集合 `users` 和 `leaves` 的权限设为「所有用户不可读写」

到云开发控制台 → 数据库，分别打开集合 `users` 和 `leaves`，把权限改成 **所有用户不可读写**。

这一步只能在控制台手动改，云函数改不了集合权限。云函数使用管理端身份，改成「所有用户不可读写」之后，云函数仍然可以读写。

必须改的原因：默认权限如果是「仅创建者可读写」或「所有用户可读」，小程序客户端可以不经过云函数，直接往 `leaves` 写入一条状态为已通过的记录。审批和公共日历就会被绕过。

### 5. 设置首位管理员

改源文件 `cloud-shared/config.js`。改完后在仓库根目录执行：

```bash
npm run sync-shared
```

这会把配置覆盖写入实际生效的 `cloudfunctions/auth/config.js`。然后对 `cloudfunctions/auth` 再次选择 **上传并部署：云端安装依赖**。只改 `cloudfunctions/auth/config.js` 而不改 `cloud-shared/config.js`，下次执行 `npm run sync-shared` 会把你的修改盖掉。

两种方式任选其一。

#### 方式 A：`BOOTSTRAP_ADMIN_OPENIDS`

1. 完成第 1 到第 4 步后，用自己的微信编译打开小程序，进入「我的」，复制 OpenID。
2. 编辑 `cloud-shared/config.js`。现在是空数组：

```js
const BOOTSTRAP_ADMIN_OPENIDS = [
]
```

改成你的 OpenID，可以写多个：

```js
const BOOTSTRAP_ADMIN_OPENIDS = [
  'oXXXXXXXXXXXXXXXXXXXXXXXXXXX',
]
```

`INIT_ADMIN_CODE` 保持空字符串 `''` 即可。

3. 在仓库根目录执行 `npm run sync-shared`。
4. 重新上传并部署 `cloudfunctions/auth`，选择 **云端安装依赖**。
5. 回到小程序「我的」页下拉刷新。名单里的 openid 在登录时会变成管理员，底部出现「审批」。

从 `BOOTSTRAP_ADMIN_OPENIDS` 里删掉某个人，不会自动取消他的管理员身份。取消管理员到「成员管理」里操作。

#### 方式 B：`INIT_ADMIN_CODE`

1. 编辑 `cloud-shared/config.js`。现在是：

```js
const INIT_ADMIN_CODE = ''
```

空字符串 `''` 表示关闭。改成只有你知道的口令，例如：

```js
const INIT_ADMIN_CODE = 'your-private-code'
```

2. 在仓库根目录执行 `npm run sync-shared`。
3. 重新上传并部署 `cloudfunctions/auth`，选择 **云端安装依赖**。
4. 打开小程序，在「我的」页底部输入这串口令。此时还没有任何管理员的话，当前用户成为首位管理员。
5. 成功后把 `INIT_ADMIN_CODE` 改回 `''`，再执行一次 `npm run sync-shared`，并重新部署 `cloudfunctions/auth`，避免口令继续有效。

组织里已经有管理员之后，口令不能再把别人提升为管理员。若仓库会分享给其他人，不要把正在使用的口令留在代码里。

### 6. 把小程序限制在组织内，并用「成员管理」授权其他管理员

在微信公众平台把访问范围限定在组织内，例如只添加体验成员，或设为企业内部可见。不要公开发布，也不要让它出现在微信搜索里。能打开这个小程序的人，第一次登录就会成为成员。

首位管理员在底部「我的」进入「成员管理」，可以把同事设为管理员，也可以取消别人的管理员身份。不能取消自己的管理员身份，组织里至少要留下一名管理员。

## 本地测试

不需要微信开发者工具，也不需要云环境。在仓库根目录执行：

```bash
npm test
```

需要 Node.js 18 或更高。测试覆盖请假时长、半天重叠、日历分组、表单校验，以及同意、驳回、撤回、设置管理员这些判断。修改 `shared/` 或 `cloud-shared/config.js` 之后，先执行 `npm run sync-shared`，再执行 `npm test`。测试会核对小程序和云函数里的副本是否与源文件一致。

## 功能

- 用微信登录。身份以云函数上下文里的 openid 为准，客户端传过来的 openid 不会被当成当前用户。
- 资料里填写姓名和部门。没有姓名不能提交请假。
- 请假类型：事假、病假、年假、调休、其他。开始和结束可以精确到上午或下午，时长按半天自动计算。
- 成员查看自己的记录。状态为待审批、已通过、已驳回、已撤回。待审批的申请可以撤回。
- 与自己仍在待审批或已通过的时段重叠时，不能再提交。
- 管理员查看全部申请，可按状态、姓名、月份筛选，同意或驳回时可以留下意见。记录审批人和时间。
- 公共日历按月展示已通过的请假：谁、什么假、当天是全天还是上午/下午。点一天看明细。事由只对本人和管理员可见。
- 管理员可以把其他成员设为管理员，也可以取消。不能取消自己，组织里至少保留一名管理员。
- 「审批」标签只对管理员显示，上面有待审批数量。

## 目录

```
project.config.json          微信开发者工具项目配置（appid 目前是占位）
miniprogram/                 小程序前端
  config.js                  云环境 ID
  pages/calendar             公共日历
  pages/leave                我的请假
  pages/leave-form           提交申请
  pages/leave-detail         详情、撤回、审批
  pages/approval             管理员审批
  pages/profile              资料、OpenID、首位管理员
  pages/members              成员与角色
cloudfunctions/auth          登录、资料、角色
cloudfunctions/leave         请假、审批、日历
cloud-shared/config.js       首位管理员配置的源文件
shared/                      时长、日历、权限的纯逻辑源文件
scripts/sync-shared.js       把 shared 和 cloud-shared 同步到小程序与云函数
test/                        node:test 单元测试
```

小程序和云函数使用的是同步后的副本。改 `shared/` 或 `cloud-shared/config.js` 之后要执行 `npm run sync-shared`，否则测试不会通过，上传的云函数也不会带上新逻辑。

## 使用说明

成员在「请假」里提交申请，在详情页撤回待审批的记录。管理员在「审批」里处理，也可以从日历点进自己或任意一条已通过记录的详情再审批。

日历只展示已通过的请假。待审批、已驳回、已撤回都不会出现。请假单上的姓名是提交当时的姓名，之后改资料不会回写旧记录。今年已通过的天数按开始日期所在年份累计。

管理员可以审批自己的申请，记录里会写上审批人。

## 数据

`users` 的文档 ID 就是 openid。

| 字段 | 说明 |
| --- | --- |
| openid, name, department | 身份与资料 |
| role | `member` 或 `admin` |
| createdAt, updatedAt | 毫秒时间戳 |

`leaves`：

| 字段 | 说明 |
| --- | --- |
| openid, userName, department | 提交人快照 |
| type | 事假 / 病假 / 年假 / 调休 / 其他 |
| startDate, endDate | `YYYY-MM-DD` |
| startHalf, endHalf | `am` 上午，`pm` 下午 |
| duration | 天数，最小 0.5 |
| reason | 事由 |
| status | `pending` / `approved` / `rejected` / `withdrawn` |
| reviewComment, reviewerOpenid, reviewerName, reviewedAt | 审批信息 |
| createdAt, updatedAt | 毫秒时间戳 |

时间在界面上按北京时间显示。日期只存日历日，避免时区把跨天算错。

集合可以不建索引。列表在云函数里取出后再筛选、排序。数据量很大时，再按 `status`、`openid`、`endDate` 补索引。单次查询最多处理约 1000 条，管理列表和我的记录最多返回最近 200 条。

## 权限（云函数强制）

| 操作 | 成员 | 管理员 |
| --- | --- | --- |
| 提交、查看、撤回自己的待审批申请 | 可以 | 可以 |
| 查看全部申请，同意或驳回 | 不可以 | 可以 |
| 查看公共日历（不含事由） | 可以 | 可以 |
| 查看事由和审批意见 | 仅自己的 | 全部 |
| 修改他人角色 | 不可以 | 可以 |

直接调用 `leave` 的 `list` 或 `review`，非管理员会收到「仅管理员可以执行此操作」。

## 常见问题

**编译后提示云开发尚未就绪。**  
检查 `miniprogram/config.js` 的 `envId`，确认 `auth`、`leave` 都已「云端安装依赖」并上传成功，且当前 AppID 已经开通这个云环境。

**登录成功但没有审批入口。**  
首位管理员还没配好。按上面的方式 A 或 B 做完后，在「我的」下拉刷新。

**同意之后日历没有这条记录。**  
日历只看已通过，并且要包含这一天。换到对应月份，或下拉刷新。

**数据库报缺索引。**  
当前查询在失败时会退回全表扫描。如果日志里仍提示创建索引，点开日志里的链接建索引即可，功能不依赖预先建好的索引。

**游客模式不能用云函数。**  
把 AppID 换成自己的小程序，再开通云开发。
