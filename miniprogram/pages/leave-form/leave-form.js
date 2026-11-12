const { ensureUser, friendlyError, showError, call } = require('../../utils/session')
const { LEAVE_TYPES } = require('../../utils/logic/constants')
const { todayCST } = require('../../utils/logic/date')
const { validateLeaveInput, coerceRange } = require('../../utils/logic/validate')
const { formatDuration } = require('../../utils/logic/format')

Page({
  data: {
    booting: true,
    bootError: '',
    user: null,
    types: LEAVE_TYPES,
    type: '事假',
    startDate: '',
    endDate: '',
    startHalf: 'am',
    endHalf: 'pm',
    reason: '',
    reasonCount: 0,
    durationText: '1 天',
    formError: '',
    submitting: false,
  },

  onLoad() {
    const today = todayCST()
    this._type = '事假'
    this._startDate = today
    this._endDate = today
    this._startHalf = 'am'
    this._endHalf = 'pm'
    this._reason = ''
    this.setData({
      startDate: today,
      endDate: today,
    })
    this.patch()
  },

  onShow() {
    ensureUser(this, { force: true }).catch(() => {})
  },

  onRetry() {
    ensureUser(this, { force: true }).catch(() => {})
  },

  formValue() {
    return coerceRange({
      startDate: this._startDate || this.data.startDate,
      endDate: this._endDate || this.data.endDate,
      startHalf: this._startHalf || this.data.startHalf,
      endHalf: this._endHalf || this.data.endHalf,
    })
  },

  patch() {
    const form = this.formValue()
    this._startDate = form.startDate
    this._endDate = form.endDate
    this._startHalf = form.startHalf
    this._endHalf = form.endHalf
    const result = validateLeaveInput(Object.assign({
      type: this._type || this.data.type,
      reason: this._reason != null ? this._reason : this.data.reason,
    }, form), { partial: true })
    this.setData({
      startDate: form.startDate,
      endDate: form.endDate,
      startHalf: form.startHalf,
      endHalf: form.endHalf,
      durationText: result.ok ? formatDuration(result.value.duration) : '—',
      formError: result.ok ? '' : result.error,
    })
  },

  onType(e) {
    this._type = e.currentTarget.dataset.type
    this.setData({ type: this._type })
  },

  onStartDate(e) {
    this._startDate = e.detail.value
    this.patch()
  },

  onEndDate(e) {
    this._endDate = e.detail.value
    this.patch()
  },

  onHalf(e) {
    const field = e.currentTarget.dataset.field
    const half = e.currentTarget.dataset.half
    if (field === 'startHalf') this._startHalf = half
    if (field === 'endHalf') this._endHalf = half
    this.patch()
  },

  onReason(e) {
    this._reason = e.detail.value
    this.setData({
      reason: this._reason,
      reasonCount: Array.from(this._reason).length,
    })
  },

  onSubmit() {
    if (this.data.submitting) return
    const user = this.data.user || getApp().globalData.user
    if (!user || !user.name) {
      wx.showModal({
        title: '需要姓名',
        content: '请先在「我的」页面填写姓名，再提交请假。',
        confirmText: '去填写',
        success: (res) => {
          if (res.confirm) wx.switchTab({ url: '/pages/profile/profile' })
        },
      })
      return
    }
    const form = this.formValue()
    const result = validateLeaveInput(Object.assign({
      type: this._type || this.data.type,
      reason: this._reason != null ? this._reason : this.data.reason,
    }, form))
    if (!result.ok) {
      this.setData({ formError: result.error })
      showError(result.error)
      return
    }
    this.setData({ submitting: true, formError: '' })
    call('leave', Object.assign({ action: 'submit' }, result.value)).then(() => {
      wx.showToast({ title: '已提交', icon: 'success' })
      setTimeout(() => {
        wx.navigateBack()
      }, 500)
    }).catch((err) => {
      this.setData({ submitting: false })
      showError(friendlyError(err))
    })
  },
})
