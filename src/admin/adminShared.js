export function adminFetchJson(path, options = {}) {
  return fetch(path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
    credentials: 'include',
  }).then(async (response) => {
    const data = await response.json().catch(() => ({}))
    if (!response.ok) {
      throw new Error(data.detail || data.message || '请求失败')
    }
    return data
  })
}

export function formatDateTime(value) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function formatMoney(value) {
  const amount = Number(value || 0)
  if (Number.isNaN(amount)) return '¥0.00'
  return `¥${amount.toFixed(2)}`
}

export function buildAdminPageMeta(pathname, userId) {
  const items = [
    {
      key: 'dashboard',
      path: '/admin/dashboard',
      title: '后台首页',
      label: '后台首页',
      description: '查看当前用户、订阅、订单和后台操作概况',
      panelTitle: '首页板块',
      panelDescription: '聚焦后台首页里的关键监控区块。',
      panelItems: [
        { label: '核心概览', hint: '总览', targetId: 'dashboard-overview' },
        { label: '管理员操作', hint: '日志', targetId: 'dashboard-audit' },
        { label: '异常订单', hint: '订单', targetId: 'dashboard-orders' },
        { label: '到期订阅', hint: '订阅', targetId: 'dashboard-expiring' },
      ],
    },
    {
      key: 'users',
      path: '/admin/users',
      title: '用户管理',
      label: '用户管理',
      description: '搜索、筛选并查看用户详情',
      panelTitle: '用户管理',
      panelDescription: '按筛选条件查看用户列表与详情入口。',
    },
    {
      key: 'user-detail',
      path: `/admin/users/${userId || ':id'}`,
      title: '用户详情',
      label: '用户详情',
      description: '查看单个用户的完整后台信息',
      panelTitle: '用户详情',
      panelDescription: '查看当前用户的资料、订阅、订单与操作记录。',
    },
    {
      key: 'subscriptions',
      path: '/admin/subscriptions',
      title: '订阅管理',
      label: '订阅管理',
      description: '查看订阅状态并执行人工订阅调整',
      panelTitle: '订阅管理',
      panelDescription: '查看订阅状态并执行人工调整。',
    },
    {
      key: 'credits',
      path: '/admin/credits',
      title: '余额 / 额度管理',
      label: '余额 / 额度管理',
      description: '第一版保留页面结构与占位信息',
      panelTitle: '余额 / 额度管理',
      panelDescription: '当前为占位页，后续接入真实账务逻辑。',
    },
    {
      key: 'orders',
      path: '/admin/orders',
      title: '订单查看',
      label: '订单查看',
      description: '查看订单记录与第三方支付字段',
      panelTitle: '订单查看',
      panelDescription: '查看订单列表、状态与详情信息。',
    },
    {
      key: 'notifications',
      path: '/admin/notifications',
      title: '通知管理',
      label: '通知管理',
      description: '发布与管理全站或定向系统通知',
      panelTitle: '通知管理',
      panelDescription: '发布系统更新、活动通知并管理历史推送记录。',
    },
    {
      key: 'audit-logs',
      path: '/admin/audit-logs',
      title: '操作日志',
      label: '操作日志',
      description: '审计管理员后台关键行为',
      panelTitle: '操作日志',
      panelDescription: '审计管理员后台关键行为与变更原因。',
    },
  ]

  if (pathname.startsWith('/admin/users/') && userId) {
    return {
      title: '用户详情',
      description: '查看单个用户的完整后台信息',
      panelTitle: '用户详情',
      panelDescription: '查看当前用户的资料、订阅、订单与操作记录。',
      breadcrumbs: [
        { label: '用户管理', path: '/admin/users' },
        { label: `用户 #${userId}` },
      ],
    }
  }

  return items.find((item) => item.path === pathname) || items[0]
}