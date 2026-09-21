import React, { useEffect, useMemo, useRef, useState } from 'react'
import AdminEmptyState from './components/AdminEmptyState.jsx'
import AdminStatusTag from './components/AdminStatusTag.jsx'
import ConfirmDialog from './components/ConfirmDialog.jsx'
import { adminFetchJson, formatDateTime } from './adminShared.js'

const transactionTypeMap = { subscription_grant: '订阅赠送积分', consume: '积分消费', admin_adjust: '后台调整', recharge: '充值到账', refund: '积分退款', system: '系统变更' }
const inputStyle = { border: '1px solid #cbd5e1', borderRadius: 12, padding: '10px 12px', minWidth: 0 }
const buttonStyle = { border: '1px solid #cbd5e1', background: '#fff', borderRadius: 10, padding: '8px 12px' }

function pick(source, keys, fallback = 0) {
  for (const key of keys) if (source?.[key] !== undefined && source?.[key] !== null) return source[key]
  return fallback
}

export default function AdminCreditsPage() {
  const [data, setData] = useState(null)
  const [pagination, setPagination] = useState({ page: 1, page_size: 20, total: 0 })
  const [filters, setFilters] = useState({ keyword: '', transaction_type: 'all', date_from: '', date_to: '' })
  const [appliedFilters, setAppliedFilters] = useState(filters)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [detail, setDetail] = useState(null)
  const [detailPage, setDetailPage] = useState(1)
  const [detailLoading, setDetailLoading] = useState(false)
  const [adjustOpen, setAdjustOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ user_id: '', amount: '', operation: 'add', transaction_type: 'admin_adjust', reason: '', note: '' })
  const [targetMode, setTargetMode] = useState('user')
  const [batchConfirmed, setBatchConfirmed] = useState(false)
  const idempotencyKeyRef = useRef('')

  const queryString = useMemo(() => {
    const params = new URLSearchParams()
    Object.entries(appliedFilters).forEach(([key, value]) => { if (value && value !== 'all') params.set(key, value) })
    params.set('page', String(pagination.page || 1)); params.set('page_size', String(pagination.page_size || 20))
    return params.toString()
  }, [appliedFilters, pagination.page, pagination.page_size])

  function load() {
    setLoading(true); setError('')
    adminFetchJson(`/api/admin/credits?${queryString}`).then((res) => { setData(res); setPagination(res.pagination || { page: 1, page_size: 20, total: 0 }) }).catch((err) => setError(err instanceof Error ? err.message : '加载失败')).finally(() => setLoading(false))
  }
  useEffect(() => { load() }, [queryString])

  function openDetail(userId, page = detailPage) {
    setDetailLoading(true)
    adminFetchJson(`/api/admin/credits/users/${userId}?page=${page}&page_size=20`).then((res) => { setDetail(res); setDetailPage(res.pagination?.page || page) }).catch((err) => alert(err instanceof Error ? err.message : '用户详情加载失败')).finally(() => setDetailLoading(false))
  }
  async function submitAdjustment() {
    if ((targetMode === 'user' && !form.user_id) || !Number(form.amount) || !form.reason.trim() || (targetMode === 'all' && !batchConfirmed)) return
    setSaving(true)
    try {
      if (!idempotencyKeyRef.current) idempotencyKeyRef.current = `${Date.now()}-${Math.random().toString(36).slice(2)}`
      const endpoint = targetMode === 'all' ? '/api/admin/credits/adjust-all' : '/api/admin/credits/adjust'
      const body = targetMode === 'all'
        ? { amount: Number(form.amount), operation: 'add', transaction_type: form.transaction_type, reason: form.reason, note: form.note, idempotency_key: idempotencyKeyRef.current }
        : { ...form, user_id: Number(form.user_id), amount: Number(form.amount), idempotency_key: idempotencyKeyRef.current }
      const result = await adminFetchJson(endpoint, { method: 'POST', body: JSON.stringify(body) })
      idempotencyKeyRef.current = ''
      if (targetMode === 'all') alert(`已向 ${result.processed_count} 位普通用户发放 ${result.total_credits} 积分。`)
      setAdjustOpen(false); setBatchConfirmed(false); setForm({ user_id: '', amount: '', operation: 'add', transaction_type: 'admin_adjust', reason: '', note: '' }); load()
      if (detail?.user?.id && Number(form.user_id) === Number(detail.user.id)) openDetail(detail.user.id)
    } catch (err) { alert(err instanceof Error ? err.message : '积分调整失败') } finally { setSaving(false) }
  }

  const summary = data?.summary || data?.kpis || {}
  const items = Array.isArray(data?.items) ? data.items : (data?.transactions || [])
  const kpis = [['总积分', pick(summary, ['total_credits', 'total_credit_amount', 'total_balance'])], ['钱包数', pick(summary, ['wallet_count', 'total_wallets'])], ['今日发放', pick(summary, ['today_granted', 'today_recharge', 'today_issued'])], ['今日消费', pick(summary, ['today_consumed', 'today_consume', 'today_spent'])]]

  return <div style={{ display: 'grid', gap: 16 }}>
    <div style={{ display: 'flex', justifyContent: 'flex-end' }}><button type="button" onClick={() => setAdjustOpen(true)} style={{ ...buttonStyle, background: '#0f172a', color: '#fff', border: 0 }}>人工调整积分</button></div>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 16 }}>{kpis.map(([title, value]) => <div key={title} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 18, padding: 20 }}><div style={{ color: '#64748b', fontSize: 13 }}>{title}</div><div style={{ marginTop: 10, fontSize: 28, fontWeight: 700 }}>{Number(value || 0).toLocaleString()}</div></div>)}</div>
    <section style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 18, padding: 20 }}><div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr auto', gap: 10 }}><input value={filters.keyword} onChange={(e) => setFilters({ ...filters, keyword: e.target.value })} placeholder="用户 ID / 邮箱" style={inputStyle} /><select value={filters.transaction_type} onChange={(e) => setFilters({ ...filters, transaction_type: e.target.value })} style={inputStyle}><option value="all">全部类型</option>{Object.entries(transactionTypeMap).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select><input type="date" value={filters.date_from} onChange={(e) => setFilters({ ...filters, date_from: e.target.value })} style={inputStyle} /><input type="date" value={filters.date_to} onChange={(e) => setFilters({ ...filters, date_to: e.target.value })} style={inputStyle} /><button type="button" onClick={() => { const next = { keyword: '', transaction_type: 'all', date_from: '', date_to: '' }; setFilters(next); setAppliedFilters(next); setPagination((p) => ({ ...p, page: 1 })) }} style={buttonStyle}>重置</button><button type="button" onClick={() => { setPagination((p) => ({ ...p, page: 1 })); setAppliedFilters(filters) }} style={{ ...buttonStyle, background: '#0f172a', color: '#fff' }}>查询</button></div></section>
    <section style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 18, overflow: 'hidden' }}>{loading ? <div style={{ padding: 20 }}>数据加载中...</div> : error ? <div style={{ padding: 20 }}><AdminEmptyState title="加载失败" description={error} /></div> : !items.length ? <div style={{ padding: 20 }}><AdminEmptyState title="暂无积分流水" description="当前筛选条件下没有匹配记录。" /></div> : <div style={{ overflowX: 'auto' }}><table style={{ width: '100%', borderCollapse: 'collapse' }}><thead><tr style={{ background: '#f8fafc', textAlign: 'left', color: '#475569' }}>{['流水 ID', '用户', '类型', '变动', '余额', '原因 / 备注', '时间', '操作'].map((label) => <th key={label} style={{ padding: '14px 16px', whiteSpace: 'nowrap', fontSize: 13 }}>{label}</th>)}</tr></thead><tbody>{items.map((item) => { const delta = Number(pick(item, ['credit_delta', 'amount'])); const userId = item.user_id || item.user?.id; return <tr key={item.id} style={{ borderTop: '1px solid #f1f5f9' }}><td style={{ padding: '14px 16px' }}>{item.id || '-'}</td><td style={{ padding: '14px 16px' }}><button type="button" onClick={() => userId && openDetail(userId)} style={{ border: 0, background: 'transparent', color: '#2563eb', padding: 0 }}>{item.user_email || item.user?.email || `用户 #${userId || '-'}`}</button></td><td style={{ padding: '14px 16px' }}><AdminStatusTag status={item.transaction_type}>{transactionTypeMap[item.transaction_type] || item.transaction_type || '-'}</AdminStatusTag></td><td style={{ padding: '14px 16px', color: delta >= 0 ? '#16a34a' : '#dc2626', fontWeight: 700 }}>{delta >= 0 ? '+' : ''}{delta}</td><td style={{ padding: '14px 16px' }}>{pick(item, ['credit_after', 'balance_after'])}</td><td style={{ padding: '14px 16px' }}>{item.reason || item.note || '-'}</td><td style={{ padding: '14px 16px', whiteSpace: 'nowrap' }}>{formatDateTime(item.created_at)}</td><td style={{ padding: '14px 16px' }}>{userId ? <button type="button" onClick={() => { setForm({ ...form, user_id: String(userId) }); setAdjustOpen(true); openDetail(userId) }} style={buttonStyle}>详情 / 调整</button> : '-'}</td></tr> })}</tbody></table></div>}</section>
    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748b', fontSize: 14 }}><span>共 {pagination.total || 0} 条</span><div style={{ display: 'flex', gap: 12, alignItems: 'center' }}><button type="button" disabled={(pagination.page || 1) <= 1} onClick={() => setPagination((p) => ({ ...p, page: p.page - 1 }))} style={buttonStyle}>上一页</button><span>第 {pagination.page || 1} 页</span><button type="button" disabled={(pagination.page || 1) * (pagination.page_size || 20) >= (pagination.total || 0)} onClick={() => setPagination((p) => ({ ...p, page: p.page + 1 }))} style={buttonStyle}>下一页</button></div></div>
    {detail ? <section style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 18, padding: 20 }}><div style={{ display: 'flex', justifyContent: 'space-between' }}><h3 style={{ margin: 0 }}>用户积分详情</h3><button type="button" onClick={() => setDetail(null)} style={buttonStyle}>关闭</button></div>{detailLoading ? <div style={{ padding: 20 }}>加载中...</div> : <><div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', margin: '16px 0', color: '#475569' }}><span>用户 #{detail.user?.id || detail.user_id}</span><span>{detail.user?.email || detail.email || '-'}</span><b>余额：{detail.wallet?.credit_amount ?? 0}</b><span>今日发放：{detail.today_granted ?? 0}</span><span>今日消费：{detail.today_consumed ?? 0}</span><button type="button" onClick={() => { setForm({ ...form, user_id: String(detail.user?.id || detail.user_id) }); setAdjustOpen(true) }} style={buttonStyle}>调整此用户</button></div><div style={{ overflowX: 'auto' }}><table style={{ width: '100%', borderCollapse: 'collapse' }}><tbody>{(detail.items || detail.transactions || []).map((item) => <tr key={item.id} style={{ borderTop: '1px solid #f1f5f9' }}><td style={{ padding: 10 }}>{transactionTypeMap[item.transaction_type] || item.transaction_type}</td><td style={{ padding: 10 }}>{item.credit_delta ?? item.amount}</td><td style={{ padding: 10 }}>{item.note || item.reason || '-'}</td><td style={{ padding: 10 }}>{formatDateTime(item.created_at)}</td></tr>)}</tbody></table><button type="button" disabled={detailPage <= 1} onClick={() => openDetail(detail.user?.id || detail.user_id, detailPage - 1)} style={buttonStyle}>上一页</button><span>第 {detailPage} 页</span><button type="button" disabled={detailPage * (detail.pagination?.page_size || 20) >= (detail.pagination?.total || 0)} onClick={() => openDetail(detail.user?.id || detail.user_id, detailPage + 1)} style={buttonStyle}>下一页</button></div></>}</section> : null}
    <ConfirmDialog open={adjustOpen} title="人工调整积分" description={<div style={{ display: 'grid', gap: 12, marginTop: 12 }}><select value={targetMode} onChange={(e) => { setTargetMode(e.target.value); if (e.target.value === 'all') setForm({ ...form, operation: 'add' }) }} style={inputStyle}><option value="user">指定用户</option><option value="all">全部普通用户</option></select>{targetMode === 'user' ? <input value={form.user_id} onChange={(e) => setForm({ ...form, user_id: e.target.value })} placeholder="用户 ID" style={inputStyle} /> : <label style={{ color: '#b45309', fontSize: 13 }}><input type="checkbox" checked={batchConfirmed} onChange={(e) => setBatchConfirmed(e.target.checked)} /> 我确认向所有普通用户发放积分</label>}<input type="number" min="1" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder="积分数量" style={inputStyle} />{targetMode === 'user' && <select value={form.operation} onChange={(e) => setForm({ ...form, operation: e.target.value })} style={inputStyle}><option value="add">增加</option><option value="deduct">扣除</option></select>}<select value={form.transaction_type} onChange={(e) => setForm({ ...form, transaction_type: e.target.value })} style={inputStyle}><option value="admin_adjust">admin_adjust</option><option value="recharge">recharge</option><option value="refund">refund</option></select><textarea value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} placeholder="调整原因（必填）" rows={3} style={inputStyle} /><input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="备注（可选）" style={inputStyle} /></div>} confirmText="确认提交" onCancel={() => !saving && setAdjustOpen(false)} onConfirm={submitAdjustment} loading={saving} confirmDisabled={(targetMode === 'user' && !form.user_id) || !Number(form.amount) || !form.reason.trim() || (targetMode === 'all' && !batchConfirmed)} />
  </div>
}
