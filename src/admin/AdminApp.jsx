import React, { useEffect, useState } from 'react'
import AdminLayout from './AdminLayout.jsx'
import AdminDashboardPage from './AdminDashboardPage.jsx'
import AdminUsersPage from './AdminUsersPage.jsx'
import AdminUserDetailPage from './AdminUserDetailPage.jsx'
import AdminSubscriptionsPage from './AdminSubscriptionsPage.jsx'
import AdminCreditsPage from './AdminCreditsPage.jsx'
import AdminOrdersPage from './AdminOrdersPage.jsx'
import AdminNotificationsPage from './AdminNotificationsPage.jsx' // 👈 引入通知页面
import AdminAuditLogsPage from './AdminAuditLogsPage.jsx'
import { adminFetchJson, buildAdminPageMeta } from './adminShared.js'

export default function AdminApp({ pathname, onNavigate, onLogout }) {
  const [adminUser, setAdminUser] = useState(null)
  const [checking, setChecking] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    setChecking(true)
    setError('')
    adminFetchJson('/api/auth/admin/me')
      .then((data) => {
        if (!active) return
        setAdminUser(data.user)
      })
      .catch((err) => {
        if (!active) return
        setAdminUser(null)
        setError(err instanceof Error ? err.message : '管理员身份校验失败')
        onNavigate('/admin/login')
      })
      .finally(() => {
        if (active) setChecking(false)
      })
    return () => {
      active = false
    }
  }, [pathname, onNavigate])

  const userIdMatch = pathname.match(/^\/admin\/users\/(\d+)$/)
  const pageMeta = buildAdminPageMeta(pathname, userIdMatch?.[1])

  if (checking) {
    return <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#f8fafc', color: '#475569' }}>管理员信息校验中...</div>
  }

  if (!adminUser) {
    return <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#f8fafc', color: '#b91c1c' }}>{error || '无法进入管理员后台'}</div>
  }

  let content = <AdminDashboardPage onNavigate={onNavigate} />
  if (pathname === '/admin/users') content = <AdminUsersPage onNavigate={onNavigate} />
  else if (userIdMatch) content = <AdminUserDetailPage userId={Number(userIdMatch[1])} onNavigate={onNavigate} />
  else if (pathname === '/admin/subscriptions') content = <AdminSubscriptionsPage />
  else if (pathname === '/admin/credits') content = <AdminCreditsPage />
  else if (pathname === '/admin/orders') content = <AdminOrdersPage onNavigate={onNavigate} />
  else if (pathname === '/admin/notifications') content = <AdminNotificationsPage /> // 👈 挂载通知管理页面
  else if (pathname === '/admin/audit-logs') content = <AdminAuditLogsPage />

  return (
    <AdminLayout pathname={pathname} adminUser={adminUser} pageMeta={pageMeta} onNavigate={onNavigate} onLogout={onLogout}>
      {content}
    </AdminLayout>
  )
}