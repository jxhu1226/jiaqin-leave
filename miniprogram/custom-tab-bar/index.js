const ALL_TABS = [
  {
    pagePath: 'pages/calendar/calendar',
    text: '日历',
    icon: '/assets/tab/calendar.png',
    selectedIcon: '/assets/tab/calendar-on.png',
  },
  {
    pagePath: 'pages/leave/leave',
    text: '请假',
    icon: '/assets/tab/leave.png',
    selectedIcon: '/assets/tab/leave-on.png',
  },
  {
    pagePath: 'pages/approval/approval',
    text: '审批',
    icon: '/assets/tab/approval.png',
    selectedIcon: '/assets/tab/approval-on.png',
    admin: true,
  },
  {
    pagePath: 'pages/profile/profile',
    text: '我的',
    icon: '/assets/tab/profile.png',
    selectedIcon: '/assets/tab/profile-on.png',
  },
]

Component({
  data: {
    selected: 'pages/calendar/calendar',
    role: 'member',
    pendingCount: 0,
    visibleTabs: ALL_TABS.filter((tab) => !tab.admin),
  },

  lifetimes: {
    attached() {
      this.refreshTabs()
      const app = getApp()
      const user = app && app.globalData && app.globalData.user
      if (user) {
        this.setData({
          role: user.role || 'member',
          pendingCount: user.pendingCount || 0,
        })
      }
    },
  },

  observers: {
    role() {
      this.refreshTabs()
    },
  },

  methods: {
    refreshTabs() {
      const role = this.data.role
      const visibleTabs = []
      for (let i = 0; i < ALL_TABS.length; i += 1) {
        if (ALL_TABS[i].admin && role !== 'admin') continue
        visibleTabs.push(ALL_TABS[i])
      }
      this.setData({ visibleTabs: visibleTabs })
    },

    onSwitch(e) {
      const path = e.currentTarget.dataset.path
      if (!path || path === this.data.selected) return
      wx.switchTab({ url: '/' + path })
    },
  },
})
