import React, { useEffect, useState } from 'react'
import AdminEmptyState from './components/AdminEmptyState.jsx'
import { adminFetchJson } from './adminShared.js'

export default function AdminAuditLogsPage() {
  const [items, setItems] = useState([])
  const [selected, setSelected] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    adminFetchJson('/api/admin/audit-logs')
      .then((res) => setItems(Array.isArray(res) ? res : []))
      .catch((err) => setError(err instanceof Error ? err.message : '加载失败'))
  }, [])

  async function handleOpenDetail(logId) {
    try {
      const detail = await adminFetchJson(`/api/admin/audit-logs/${logId}`)
      setSelected(detail)
    } catch (err) {
      alert(err instanceof Error ? err.message : '加载详情失败')
    }
  }

  if (error) return <AdminEmptyState title="加载失败" description={error} />

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <section style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 18, overflow: 'hidden' }}>
        {!items.length ? (
          <div style={{ padding: 20 }}><AdminEmptyState title="暂无日志" description="管理员后台关键行为会展示在这里。" /></div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f8fafc', textAlign: 'left', color: '#475569' }}>
                  {['日志 ID', '管理员', '目标用户', '操作类型', '目标对象', '原因', '操作摘要', '操作'].map((label) => (
                    <th key={label} style={{ padding: '14px 16px', whiteSpace: 'nowrap', fontSize: 13 }}>{label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id} style={{ borderTop: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '14px 16px' }}>{item.id}</td>
                    <td style={{ padding: '14px 16px' }}>{item.admin_user_name || item.admin_user_email}</td>
                    <td style={{ padding: '14px 16px' }}>{item.target_user_email || '-'}</td>
                    <td style={{ padding: '14px 16px' }}>{item.action_type}</td>
                    <td style={{ padding: '14px 16px' }}>{item.target_type}{item.target_id ? ` #${item.target_id}` : ''}</td>
                    <td style={{ padding: '14px 16px' }}>{item.reason || '-'}</td>
                    <td style={{ padding: '14px 16px' }}>{item.summary}</td>
                    <td style={{ padding: '14px 16px' }}><button type="button" onClick={() => handleOpenDetail(item.id)} style={{ border: '1px solid #cbd5e1', background: '#fff', borderRadius: 10, padding: '8px 12px' }}>查看详情</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {selected ? (
        <section style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 18, padding: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
            <h3 style={{ margin: 0 }}>日志详情</h3>
            <button type="button" onClick={() => setSelected(null)} style={{ border: '1px solid #cbd5e1', background: '#fff', borderRadius: 10, padding: '8px 12px' }}>收起</button>
          </div>
          <div style={{ marginTop: 16, display: 'grid', gap: 12 }}>
            <div><strong>管理员：</strong>{selected.admin_user_name || selected.admin_user_email}</div>
            <div><strong>目标用户：</strong>{selected.target_user_email || '-'}</div>
            <div><strong>操作类型：</strong>{selected.action_type}</div>
            <div><strong>原因：</strong>{selected.reason || '-'}</div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 16 }}>
            <div>
              <div style={{ fontSize: 12, color: '#64748b', marginBottom: 8 }}>变更前数据</div>
              <pre style={{ margin: 0, borderRadius: 14, background: '#0f172a', color: '#e2e8f0', padding: 16, overflowX: 'auto' }}>{JSON.stringify(selected.before_json || {}, null, 2)}</pre>
            </div>
            <div>
              <div style={{ fontSize: 12, color: '#64748b', marginBottom: 8 }}>变更后数据</div>
              <pre style={{ margin: 0, borderRadius: 14, background: '#0f172a', color: '#e2e8f0', padding: 16, overflowX: 'auto' }}>{JSON.stringify(selected.after_json || {}, null, 2)}</pre>
            </div>
          </div>
        </section>
      ) : null}
    </div>
  )
}
