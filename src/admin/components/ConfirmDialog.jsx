import React from 'react'

export default function ConfirmDialog({ open, title, description, confirmText = '确认', cancelText = '取消', onConfirm, onCancel, loading = false, confirmDisabled = false }) {
  if (!open) return null

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15, 23, 42, 0.45)',
        display: 'grid',
        placeItems: 'center',
        zIndex: 50,
        padding: 20,
      }}
    >
      <div style={{ width: 'min(520px, 100%)', background: '#fff', borderRadius: 20, padding: 24, boxShadow: '0 20px 60px rgba(15,23,42,0.18)' }}>
        <h3 style={{ margin: 0, fontSize: 20, color: '#0f172a' }}>{title}</h3>
        <div style={{ margin: '12px 0 0', color: '#475569', lineHeight: 1.7 }}>{description}</div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 24 }}>
          <button type="button" onClick={onCancel} style={{ border: '1px solid #cbd5e1', background: '#fff', borderRadius: 12, padding: '10px 16px' }}>
            {cancelText}
          </button>
          <button type="button" disabled={loading || confirmDisabled} onClick={onConfirm} style={{ border: 0, background: '#0f172a', color: '#fff', borderRadius: 12, padding: '10px 16px', opacity: loading || confirmDisabled ? 0.6 : 1 }}>
            {loading ? '处理中...' : confirmText}
          </button>
        </div>
      </div>
    </div>
  )
}
