Component({
  properties: {
    show: { type: Boolean, value: false },
    title: { type: String, value: '' },
    confirmText: { type: String, value: '确定' },
    danger: { type: Boolean, value: false },
    loading: { type: Boolean, value: false },
  },
  data: {
    comment: '',
  },
  observers: {
    show(show) {
      if (show) {
        this._comment = ''
        this.setData({ comment: '' })
      }
    },
  },
  methods: {
    noop() {},
    onInput(e) {
      this._comment = e.detail.value
      this.setData({ comment: this._comment })
    },
    onCancel() {
      if (this.data.loading) return
      this.triggerEvent('cancel')
    },
    onConfirm() {
      if (this.data.loading) return
      const comment = this._comment != null ? this._comment : this.data.comment
      this.triggerEvent('confirm', { comment: comment })
    },
  },
})
