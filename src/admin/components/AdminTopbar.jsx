import React from 'react'

export default function AdminTopbar({ title, description, breadcrumbs = [], adminUser }) {
  return (
    <header className="admin-topbar">
      <div className="admin-topbar-copy">
        {breadcrumbs.length ? (
          <div className="admin-topbar-breadcrumbs">
            {breadcrumbs.map((item, index) => (
              <span key={`${item.label}-${index}`}>
                {index > 0 ? ' / ' : ''}
                {item.label}
              </span>
            ))}
          </div>
        ) : null}
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      <div className="admin-topbar-user-card">
        <span className="admin-topbar-user-label">当前管理员</span>
        <strong>{adminUser?.display_name || '-'}</strong>
        <span>{adminUser?.email || '-'}</span>
      </div>
    </header>
  )
}
