import React from 'react'
import AdminSidebar from './components/AdminSidebar.jsx'
import AdminTopbar from './components/AdminTopbar.jsx'

export default function AdminLayout({ pathname, adminUser, pageMeta, onNavigate, onLogout, children }) {
  return (
    <main className="admin-page">
      <AdminSidebar pathname={pathname} adminUser={adminUser} pageMeta={pageMeta} onNavigate={onNavigate} onLogout={onLogout} />
      <section className="admin-content-shell">
        <div className="admin-content-inner">
          <AdminTopbar
            title={pageMeta?.title || '后台首页'}
            description={pageMeta?.description || ''}
            breadcrumbs={pageMeta?.breadcrumbs || []}
            adminUser={adminUser}
          />
          <div className="admin-content-body">{children}</div>
        </div>
      </section>
    </main>
  )
}
