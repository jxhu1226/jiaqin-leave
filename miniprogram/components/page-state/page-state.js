Component({
  properties: {
    booting: { type: Boolean, value: false },
    error: { type: String, value: '' },
    loadingText: { type: String, value: '正在登录…' },
  },
  methods: {
    onRetry() {
      this.triggerEvent('retry')
    },
  },
})
