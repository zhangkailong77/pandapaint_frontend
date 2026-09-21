import React from 'react'
import logoImg from '../../public/image/logo/logo-1.png'

const navItems = [
  {
    key: 'dashboard',
    label: '后台首页',
    path: '/admin/dashboard',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="9" rx="1.5" />
        <rect x="14" y="3" width="7" height="5" rx="1.5" />
        <rect x="14" y="12" width="7" height="9" rx="1.5" />
        <rect x="3" y="16" width="7" height="5" rx="1.5" />
      </svg>
    ),
  },
  {
    key: 'users',
    label: '用户管理',
    path: '/admin/users',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
  },
  {
    key: 'subscriptions',
    label: '订阅管理',
    path: '/admin/subscriptions',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="5" width="20" height="14" rx="2" />
        <line x1="2" y1="10" x2="22" y2="10" />
      </svg>
    ),
  },
  {
    key: 'credits',
    label: '余额 / 额度管理',
    path: '/admin/credits',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 1v22" />
        <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
      </svg>
    ),
  },
  {
    key: 'orders',
    label: '订单查看',
    path: '/admin/orders',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 2l3 7h9l3-7" />
        <path d="M3 9h18l-1.5 9a2 2 0 0 1-2 1.67H6.5a2 2 0 0 1-2-1.67L3 9Z" />
        <path d="M9 13h6" />
      </svg>
    ),
  },
  {
    key: 'notifications',
    label: '通知管理',
    path: '/admin/notifications',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
        <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
      </svg>
    ),
  },
  {
    key: 'audit-logs',
    label: '操作日志',
    path: '/admin/audit-logs',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 8v5l3 3" />
        <circle cx="12" cy="12" r="9" />
      </svg>
    ),
  },
]

export default function AdminSidebar({ pathname, adminUser, pageMeta, onNavigate, onLogout }) {
  const activeItem = navItems.find((item) => pathname === item.path || pathname.startsWith(`${item.path}/`)) || navItems[0]
  const panelItems = pageMeta?.panelItems || []

  const handlePanelClick = (targetId) => {
    if (!targetId) return
    const element = document.getElementById(targetId)
    if (!element) return
    element.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <aside className="admin-sidebar-shell">
      <div className="admin-icon-rail">
        <div className="admin-icon-rail-top">
          <button type="button" className="admin-logo-button" onClick={() => onNavigate('/admin/dashboard')} title="回到后台首页">
            <img src={logoImg} alt="PandaPaint Logo" />
          </button>

          <nav className="admin-icon-nav" aria-label="管理员主导航">
            {navItems.map((item) => {
              const active = activeItem.key === item.key
              return (
                <button
                  key={item.key}
                  type="button"
                  className={`admin-icon-button ${active ? 'is-active' : ''}`}
                  onClick={() => onNavigate(item.path)}
                  title={item.label}
                >
                  {item.icon}
                  <span className="admin-icon-text">{item.label}</span>
                </button>
              )
            })}
          </nav>
        </div>

        <div className="admin-icon-rail-bottom">
          <button type="button" className="admin-help-button" title="管理员帮助中心">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
          </button>
        </div>
      </div>

      <div className="admin-menu-panel">
        <div className="admin-menu-panel-header">
          <span className="admin-menu-eyebrow">管理员中心</span>
          <h2>{pageMeta?.panelTitle || activeItem.label}</h2>
          <p>{pageMeta?.panelDescription || '查看当前页面的关键区块与操作入口。'}</p>
        </div>

        {panelItems.length ? (
          <nav className="admin-text-nav" aria-label="当前页面板块导航">
            {panelItems.map((item) => (
              <button
                key={item.targetId}
                type="button"
                className="admin-text-nav-item"
                onClick={() => handlePanelClick(item.targetId)}
              >
                <span className="admin-text-nav-label">{item.label}</span>
                <span className="admin-text-nav-hint">{item.hint || '定位'}</span>
              </button>
            ))}
          </nav>
        ) : (
          <div className="admin-panel-placeholder">
            当前页面暂无单独板块导航，右侧区域直接展示主要内容。
          </div>
        )}

        <div className="admin-menu-panel-footer">
          <div className="admin-user-meta">
            <div className="admin-user-avatar">{(adminUser?.display_name || adminUser?.email || 'A').charAt(0).toUpperCase()}</div>
            <div className="admin-user-copy">
              <strong>{adminUser?.display_name || '管理员'}</strong>
              <span>{adminUser?.email || '-'}</span>
            </div>
          </div>
          <button type="button" className="admin-logout-button" onClick={onLogout}>
            退出登录
          </button>
        </div>
      </div>
    </aside>
  )
}