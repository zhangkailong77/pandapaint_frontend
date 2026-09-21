import React from 'react'

export default function AdminStatusTag({ status, children }) {
  const value = status || children || 'unknown'
  const tone = String(value).toLowerCase()
  const colorMap = {
    active: '#15803d',
    paid: '#15803d',
    success: '#15803d',
    pending: '#b45309',
    expired: '#6b7280',
    cancelled: '#6b7280',
    failed: '#b91c1c',
    refunded: '#b91c1c',
    abnormal: '#b91c1c',
    placeholder: '#64748b',
    todo: '#64748b',
  }

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '4px 10px',
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 600,
        color: colorMap[tone] || '#334155',
        background: `${colorMap[tone] || '#cbd5e1'}20`,
        whiteSpace: 'nowrap',
      }}
    >
      {children || status}
    </span>
  )
}
