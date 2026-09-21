import React from 'react'

export default function AdminEmptyState({ title = '暂无数据', description = '当前没有可展示的内容。', action }) {
  return (
    <div
      style={{
        border: '1px dashed #cbd5e1',
        borderRadius: 20,
        padding: '40px 24px',
        textAlign: 'center',
        background: '#f8fafc',
        color: '#475569',
      }}
    >
      <div style={{ fontSize: 18, fontWeight: 600, color: '#0f172a', marginBottom: 8 }}>{title}</div>
      <div style={{ fontSize: 14, lineHeight: 1.7, maxWidth: 480, margin: '0 auto' }}>{description}</div>
      {action ? <div style={{ marginTop: 16 }}>{action}</div> : null}
    </div>
  )
}
