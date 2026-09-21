import React, { useEffect, useState } from 'react'
import AdminEmptyState from './components/AdminEmptyState.jsx'
import AdminStatusTag from './components/AdminStatusTag.jsx'
import ConfirmDialog from './components/ConfirmDialog.jsx'
import { adminFetchJson, formatDateTime } from './adminShared.js'

export default function AdminSubscriptionsPage() {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [form, setForm] = useState({ subscriptionId: '', plan_id: '', started_at: '', expires_at: '', source_type: 'admin_grant', reason: '', note: '' })
  const [cancelForm, setCancelForm] = useState({ subscriptionId: '', reason: '' })
  const [editingOpen, setEditingOpen] = useState(false)
  const [cancelOpen, setCancelOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  function load() {
    adminFetchJson('/api/admin/subscriptions')
      .then((res) => setData(res))
      .catch((err) => setError(err instanceof Error ? err.message : '加载失败'))
  }

  useEffect(() => {
    load()
  }, [])

  async function handleUpdate() {
    if (!form.subscriptionId || !form.plan_id || !form.expires_at || !form.reason.trim()) return
    setSaving(true)
    try {
      await adminFetchJson(`/api/admin/subscriptions/${form.subscriptionId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          plan_id: Number(form.plan_id),
          started_at: form.started_at || undefined,
          expires_at: form.expires_at,
          source_type: form.source_type,
          reason: form.reason,
          note: form.note || undefined,
        }),
      })
      setEditingOpen(false)
      setForm({ subscriptionId: '', plan_id: '', started_at: '', expires_at: '', source_type: 'admin_grant', reason: '', note: '' })
      load()
    } catch (err) {
      alert(err instanceof Error ? err.message : '更新失败')
    } finally {
      setSaving(false)
    }
  }

  async function handleCancel() {
    if (!cancelForm.subscriptionId || !cancelForm.reason.trim()) return
    setSaving(true)
    try {
      await adminFetchJson(`/api/admin/subscriptions/${cancelForm.subscriptionId}/cancel`, {
        method: 'POST',
        body: JSON.stringify({ reason: cancelForm.reason }),
      })
      setCancelOpen(false)
      setCancelForm({ subscriptionId: '', reason: '' })
      load()
    } catch (err) {
      alert(err instanceof Error ? err.message : '取消失败')
    } finally {
      setSaving(false)
    }
  }

  if (error) return <AdminEmptyState title="加载失败" description={error} />
  if (!data) return <div>数据加载中...</div>

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <section style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 18, padding: 20 }}>
        <div style={{ color: '#64748b', fontSize: 14, lineHeight: 1.7 }}>第一版支持查看订阅全局情况，并对单个用户执行手动调整或取消。所有写操作都必须填写原因，并自动写入管理员日志。</div>
      </section>

      <section style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 18, overflow: 'hidden' }}>
        {!(data.items || []).length ? (
          <div style={{ padding: 20 }}><AdminEmptyState title="暂无订阅" description="当前还没有订阅记录。" /></div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f8fafc', textAlign: 'left', color: '#475569' }}>
                  {['订阅 ID', '用户 ID', '邮箱', '套餐名', '来源', '状态', '生效时间', '到期时间', '操作人', '原因备注', '操作'].map((label) => (
                    <th key={label} style={{ padding: '14px 16px', whiteSpace: 'nowrap', fontSize: 13 }}>{label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.items.map((item) => (
                  <tr key={item.id} style={{ borderTop: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '14px 16px' }}>{item.id}</td>
                    <td style={{ padding: '14px 16px' }}>{item.user_id || '-'}</td>
                    <td style={{ padding: '14px 16px' }}>{item.user_email || '-'}</td>
                    <td style={{ padding: '14px 16px' }}>{item.plan_name || '-'}</td>
                    <td style={{ padding: '14px 16px' }}>{item.source_type || '-'}</td>
                    <td style={{ padding: '14px 16px' }}><AdminStatusTag status={item.status}>{item.status || '-'}</AdminStatusTag></td>
                    <td style={{ padding: '14px 16px', whiteSpace: 'nowrap' }}>{formatDateTime(item.started_at)}</td>
                    <td style={{ padding: '14px 16px', whiteSpace: 'nowrap' }}>{formatDateTime(item.expires_at)}</td>
                    <td style={{ padding: '14px 16px' }}>{item.granted_by_admin_name || '-'}</td>
                    <td style={{ padding: '14px 16px' }}>{item.note || '-'}</td>
                    <td style={{ padding: '14px 16px' }}>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button
                          type="button"
                          onClick={() => {
                            setForm({
                              subscriptionId: String(item.id),
                              plan_id: String(item.plan_id || ''),
                              started_at: item.started_at ? item.started_at.slice(0, 16) : '',
                              expires_at: item.expires_at ? item.expires_at.slice(0, 16) : '',
                              source_type: item.source_type || 'admin_grant',
                              reason: '',
                              note: item.note || '',
                            })
                            setEditingOpen(true)
                          }}
                          style={{ border: '1px solid #cbd5e1', background: '#fff', borderRadius: 10, padding: '8px 12px' }}
                        >
                          调整
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setCancelForm({ subscriptionId: String(item.id), reason: '' })
                            setCancelOpen(true)
                          }}
                          style={{ border: '1px solid #fecaca', background: '#fff5f5', color: '#b91c1c', borderRadius: 10, padding: '8px 12px' }}
                        >
                          取消
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <ConfirmDialog
        open={editingOpen}
        title="调整订阅"
        description={
          <div style={{ display: 'grid', gap: 12, marginTop: 12 }}>
            <select value={form.plan_id} onChange={(e) => setForm((current) => ({ ...current, plan_id: e.target.value }))} style={{ border: '1px solid #cbd5e1', borderRadius: 12, padding: '12px 14px' }}>
              <option value="">选择套餐</option>
              {(data.available_plans || []).map((plan) => <option key={plan.id} value={plan.id}>{plan.name}</option>)}
            </select>
            <input type="datetime-local" value={form.started_at} onChange={(e) => setForm((current) => ({ ...current, started_at: e.target.value }))} style={{ border: '1px solid #cbd5e1', borderRadius: 12, padding: '12px 14px' }} />
            <input type="datetime-local" value={form.expires_at} onChange={(e) => setForm((current) => ({ ...current, expires_at: e.target.value }))} style={{ border: '1px solid #cbd5e1', borderRadius: 12, padding: '12px 14px' }} />
            <select value={form.source_type} onChange={(e) => setForm((current) => ({ ...current, source_type: e.target.value }))} style={{ border: '1px solid #cbd5e1', borderRadius: 12, padding: '12px 14px' }}>
              <option value="admin_grant">admin_grant</option>
              <option value="compensation">compensation</option>
              <option value="system">system</option>
            </select>
            <textarea value={form.reason} onChange={(e) => setForm((current) => ({ ...current, reason: e.target.value }))} placeholder="填写变更原因" rows={3} style={{ border: '1px solid #cbd5e1', borderRadius: 12, padding: '12px 14px' }} />
            <input value={form.note} onChange={(e) => setForm((current) => ({ ...current, note: e.target.value }))} placeholder="原因备注（可选）" style={{ border: '1px solid #cbd5e1', borderRadius: 12, padding: '12px 14px' }} />
          </div>
        }
        confirmText="确认更新"
        onCancel={() => !saving && setEditingOpen(false)}
        onConfirm={handleUpdate}
        loading={saving}
        confirmDisabled={!form.subscriptionId || !form.plan_id || !form.expires_at || !form.reason.trim()}
      />

      <ConfirmDialog
        open={cancelOpen}
        title="取消订阅"
        description={<textarea value={cancelForm.reason} onChange={(e) => setCancelForm((current) => ({ ...current, reason: e.target.value }))} placeholder="填写取消原因" rows={4} style={{ width: '100%', border: '1px solid #cbd5e1', borderRadius: 12, padding: '12px 14px', marginTop: 12 }} />}
        confirmText="确认取消"
        onCancel={() => !saving && setCancelOpen(false)}
        onConfirm={handleCancel}
        loading={saving}
        confirmDisabled={!cancelForm.reason.trim()}
      />
    </div>
  )
}
