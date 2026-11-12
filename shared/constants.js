// 纯逻辑模块。源文件在 shared/，由 scripts/sync-shared.js 同步到小程序与云函数。

const LEAVE_TYPES = ['事假', '病假', '年假', '调休', '其他']

const HALF_LABEL = {
  am: '上午',
  pm: '下午',
}

const SPAN_LABEL = {
  full: '全天',
  am: '上午',
  pm: '下午',
}

const STATUS_LABEL = {
  pending: '待审批',
  approved: '已通过',
  rejected: '已驳回',
  withdrawn: '已撤回',
}

const TYPE_CLASS = {
  事假: 'personal',
  病假: 'sick',
  年假: 'annual',
  调休: 'lieu',
  其他: 'other',
}

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六']

const LEGEND = [
  { type: '事假', className: 'personal' },
  { type: '病假', className: 'sick' },
  { type: '年假', className: 'annual' },
  { type: '调休', className: 'lieu' },
  { type: '其他', className: 'other' },
]

module.exports = {
  LEAVE_TYPES,
  HALF_LABEL,
  SPAN_LABEL,
  STATUS_LABEL,
  TYPE_CLASS,
  WEEKDAYS,
  LEGEND,
}
