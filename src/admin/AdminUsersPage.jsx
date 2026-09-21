import React, { useEffect, useMemo, useState } from 'react'
import AdminEmptyState from './components/AdminEmptyState.jsx'
import AdminStatusTag from './components/AdminStatusTag.jsx'
import { adminFetchJson, formatDateTime, formatMoney } from './adminShared.js'

export default function AdminUsersPage({ onNavigate }) {
  const [items, setItems] = useState([])
  const [pagination, setPagination] = useState({ page: 1, page_size: 20, total: 0 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [keyword, setKeyword] = useState('')
  const [role, setRole] = useState('all')
  const [subscriptionStatus, setSubscriptionStatus] = useState('all')

  const queryString = useMemo(() => {
    const params = new URLSearchParams()
    if (keyword.trim()) params.set('keyword', keyword.trim())
    if (role !== 'all') params.set('role', role)
    if (subscriptionStatus !== 'all') params.set('subscription_status', subscriptionStatus)
    params.set('page', String(pagination.page || 1))
    params.set('page_size', String(pagination.page_size || 20))
    return params.toString()
  }, [keyword, role, subscriptionStatus, pagination.page, pagination.page_size])

  useEffect(() => {
    let active = true
    setLoading(true)
    setError('')
    adminFetchJson(`/api/admin/users?${queryString}`)
      .then((data) => {
        if (!active) return
        setItems(Array.isArray(data.items) ? data.items : [])
        setPagination(data.pagination || { page: 1, page_size: 20, total: 0 })
      })
      .catch((err) => {
        if (!active) return
        setError(err instanceof Error ? err.message : '加载失败')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [queryString])

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <section style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 18, padding: 20 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr auto', gap: 12 }}>
          <input value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="搜索用户 ID / 邮箱 / 昵称" style={{ border: '1px solid #cbd5e1', borderRadius: 12, padding: '12px 14px' }} />
          <select value={role} onChange={(e) => setRole(e.target.value)} style={{ border: '1px solid #cbd5e1', borderRadius: 12, padding: '12px 14px' }}>
            <option value="all">全部角色</option>
            <option value="user">user</option>
            <option value="admin">admin</option>
          </select>
          <select value={subscriptionStatus} onChange={(e) => setSubscriptionStatus(e.target.value)} style={{ border: '1px solid #cbd5e1', borderRadius: 12, padding: '12px 14px' }}>
            <option value="all">全部订阅状态</option>
            <option value="active">active</option>
            <option value="expired">expired</option>
            <option value="cancelled">cancelled</option>
            <option value="none">none</option>
          </select>
          <button type="button" onClick={() => setPagination((current) => ({ ...current, page: 1 }))} style={{ border: 0, borderRadius: 12, background: '#0f172a', color: '#fff', padding: '0 18px', fontWeight: 700 }}>查询</button>
        </div>
      </section>

      <section style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 18, overflow: 'hidden' }}>
        {loading ? <div style={{ padding: 20 }}>数据加载中...</div> : null}
        {!loading && error ? <div style={{ padding: 20 }}><AdminEmptyState title="加载失败" description={error} /></div> : null}
        {!loading && !error && !items.length ? <div style={{ padding: 20 }}><AdminEmptyState title="暂无用户" description="当前筛选条件下没有匹配到用户。" /></div> : null}
        {!loading && !error && items.length ? (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f8fafc', color: '#475569', textAlign: 'left' }}>
                  {['用户 ID', '邮箱', '昵称', '角色', '注册时间', '当前订阅', '订阅状态', '当前余额', '当前额度', '项目数', '生图次数', '操作'].map((label) => (
                    <th key={label} style={{ padding: '14px 16px', fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap' }}>{label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id} style={{ borderTop: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '14px 16px' }}>{item.id}</td>
                    <td style={{ padding: '14px 16px' }}>
                      <button type="button" onClick={() => onNavigate(`/admin/users/${item.id}`)} style={{ border: 0, background: 'transparent', color: '#2563eb', padding: 0 }}>{item.email}</button>
                    </td>
                    <td style={{ padding: '14px 16px' }}>{item.display_name || '-'}</td>
                    <td style={{ padding: '14px 16px' }}>{item.role}</td>
                    <td style={{ padding: '14px 16px', whiteSpace: 'nowrap' }}>{formatDateTime(item.created_at)}</td>
                    <td style={{ padding: '14px 16px' }}>{item.current_subscription?.plan_name || '未订阅'}</td>
                    <td style={{ padding: '14px 16px' }}><AdminStatusTag status={item.current_subscription?.status || 'placeholder'}>{item.current_subscription?.status || 'none'}</AdminStatusTag></td>
                    <td style={{ padding: '14px 16px' }}>{formatMoney(item.wallet?.balance_amount)}</td>
                    <td style={{ padding: '14px 16px' }}>{item.wallet?.credit_amount ?? 0}</td>
                    <td style={{ padding: '14px 16px' }}>{item.project_count ?? 0}</td>
                    <td style={{ padding: '14px 16px' }}>{item.generation_count ?? 0}</td>
                    <td style={{ padding: '14px 16px' }}>
                      <button type="button" onClick={() => onNavigate(`/admin/users/${item.id}`)} style={{ border: '1px solid #cbd5e1', background: '#fff', borderRadius: 10, padding: '8px 12px' }}>查看详情</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#64748b', fontSize: 14 }}>
        <span>共 {pagination.total || 0} 条</span>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <button type="button" disabled={(pagination.page || 1) <= 1} onClick={() => setPagination((current) => ({ ...current, page: Math.max(1, (current.page || 1) - 1) }))} style={{ border: '1px solid #cbd5e1', background: '#fff', borderRadius: 10, padding: '8px 12px' }}>上一页</button>
          <span>第 {pagination.page || 1} 页</span>
          <button type="button" disabled={(pagination.page || 1) * (pagination.page_size || 20) >= (pagination.total || 0)} onClick={() => setPagination((current) => ({ ...current, page: (current.page || 1) + 1 }))} style={{ border: '1px solid #cbd5e1', background: '#fff', borderRadius: 10, padding: '8px 12px' }}>下一页</button>
        </div>
      </div>
    </div>
  )
}
