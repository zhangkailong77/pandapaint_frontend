import React, { useMemo, useState } from 'react'
import { adminFetchJson } from './adminShared.js'

export default function AdminLoginPage({ onLoginSuccess, onNavigateHome }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const disabled = useMemo(() => submitting || !email.trim() || !password.trim(), [email, password, submitting])

  async function handleSubmit(event) {
    event.preventDefault()
    if (disabled) return
    setSubmitting(true)
    setError('')
    try {
      await adminFetchJson('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      })
      const admin = await adminFetchJson('/api/auth/admin/me')
      onLoginSuccess?.(admin.user)
    } catch (err) {
      const message = err instanceof Error ? err.message : '登录失败，请稍后重试。'
      if (message.includes('管理员权限')) {
        await adminFetchJson('/api/auth/logout', { method: 'POST' }).catch(() => {})
        setError('当前账号没有管理员权限')
      } else {
        setError(message)
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: 'linear-gradient(180deg, #e2e8f0 0%, #f8fafc 100%)', padding: 20 }}>
      <div style={{ width: 'min(460px, 100%)', background: '#fff', borderRadius: 28, padding: 32, boxShadow: '0 24px 80px rgba(15,23,42,0.12)' }}>
        <div style={{ marginBottom: 28 }}>
          <button type="button" onClick={onNavigateHome} style={{ border: 0, background: 'transparent', color: '#64748b', padding: 0, marginBottom: 18 }}>← 返回首页</button>
          <div style={{ fontSize: 28, fontWeight: 700, color: '#0f172a' }}>管理员后台</div>
          <div style={{ marginTop: 8, color: '#64748b', lineHeight: 1.7 }}>使用已有账号登录，并在登录后立即校验管理员身份。</div>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 8, color: '#334155', fontWeight: 600 }}>
            邮箱
            <input value={email} onChange={(event) => setEmail(event.target.value)} type="email" style={{ border: '1px solid #cbd5e1', borderRadius: 14, padding: '14px 16px' }} />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 8, color: '#334155', fontWeight: 600 }}>
            密码
            <input value={password} onChange={(event) => setPassword(event.target.value)} type="password" style={{ border: '1px solid #cbd5e1', borderRadius: 14, padding: '14px 16px' }} />
          </label>
          {error ? <div style={{ borderRadius: 14, background: '#fef2f2', color: '#b91c1c', padding: '12px 14px', fontSize: 14 }}>{error}</div> : null}
          <button type="submit" disabled={disabled} style={{ border: 0, borderRadius: 14, background: '#0f172a', color: '#fff', padding: '14px 16px', fontWeight: 700 }}>
            {submitting ? '登录中...' : '登录'}
          </button>
        </form>
      </div>
    </div>
  )
}
