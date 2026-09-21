import React, { useEffect, useMemo, useState } from 'react'
import AdminEmptyState from './components/AdminEmptyState.jsx'
import AdminStatusTag from './components/AdminStatusTag.jsx'
import ConfirmDialog from './components/ConfirmDialog.jsx'
import { adminFetchJson, formatDateTime, formatMoney } from './adminShared.js'

export default function AdminUserDetailPage({ userId, onNavigate }) {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [plans, setPlans] = useState([])
  const [dialogOpen, setDialogOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ plan_id: '', started_at: '', expires_at: '', source_type: 'admin_grant', reason: '', note: '' })

  useEffect(() => {
    let active = true
    Promise.all([
      adminFetchJson(`/api/admin/users/${userId}`),
      adminFetchJson('/api/admin/subscriptions'),
    ])
      .then(([detail, subscriptions]) => {
        if (!active) return
        setData(detail)
        setPlans(subscriptions.available_plans || [])
      })
      .catch((err) => {
        if (!active) return
        setError(err instanceof Error ? err.message : '加载失败')
      })
    return () => {
      active = false
    }
  }, [userId])

  const currentSubscription = data?.current_subscription
  const usage = data?.usage_summary || {}
  const canSubmit = useMemo(() => form.plan_id && form.expires_at && form.reason.trim(), [form])

  async function handleSubmitSubscription() {
    if (!canSubmit) return
    setSaving(true)
    try {
      await adminFetchJson(`/api/admin/users/${userId}/subscriptions`, {
        method: 'POST',
        body: JSON.stringify({
          ...form,
          plan_id: Number(form.plan_id),
          started_at: form.started_at || undefined,
        }),
      })
      const refreshed = await adminFetchJson(`/api/admin/users/${userId}`)
      setData(refreshed)
      setDialogOpen(false)
      setForm({ plan_id: '', started_at: '', expires_at: '', source_type: 'admin_grant', reason: '', note: '' })
    } catch (err) {
      alert(err instanceof Error ? err.message : '订阅保存失败')
    } finally {
      setSaving(false)
    }
  }

  if (error) return <AdminEmptyState title="加载失败" description={error} />
  if (!data) return <div>数据加载中...</div>

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <section style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 18, padding: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16 }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 22 }}>{data.user.display_name || data.user.email}</h3>
            <div style={{ marginTop: 8, color: '#64748b' }}>{data.user.email}</div>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button type="button" onClick={() => onNavigate('/admin/users')} style={{ border: '1px solid #cbd5e1', background: '#fff', borderRadius: 12, padding: '10px 14px' }}>返回用户列表</button>
            <button type="button" onClick={() => setDialogOpen(true)} style={{ border: 0, background: '#0f172a', color: '#fff', borderRadius: 12, padding: '10px 14px' }}>调整订阅</button>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 16, marginTop: 20 }}>
          <InfoCard label="用户 ID" value={String(data.user.id)} />
          <InfoCard label="角色" value={data.user.role} />
          <InfoCard label="注册时间" value={formatDateTime(data.user.created_at)} />
        </div>
      </section>

      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 16 }}>
        <section style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 18, padding: 20 }}>
          <SectionTitle title="订阅信息" />
          {currentSubscription ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 14 }}>
              <InfoCard label="当前套餐" value={currentSubscription.plan_name || '-'} />
              <InfoCard label="订阅状态" value={<AdminStatusTag status={currentSubscription.status}>{currentSubscription.status}</AdminStatusTag>} />
              <InfoCard label="生效时间" value={formatDateTime(currentSubscription.started_at)} />
              <InfoCard label="到期时间" value={formatDateTime(currentSubscription.expires_at)} />
              <InfoCard label="来源类型" value={currentSubscription.source_type || '-'} />
              <InfoCard label="最近变更原因" value={currentSubscription.note || '-'} />
            </div>
          ) : <AdminEmptyState title="未订阅" description="当前用户暂无有效订阅记录。" />}
        </section>

        <section style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 18, padding: 20 }}>
          <SectionTitle title="余额 / 额度信息" />
          <div style={{ display: 'grid', gap: 14 }}>
            <InfoCard label="当前余额" value={formatMoney(data.wallet?.balance_amount)} />
            <InfoCard label="当前额度" value={String(data.wallet?.credit_amount ?? 0)} />
            <InfoCard label="说明" value={data.wallet?.message || '当前已接入真实积分统计。'} />
            <button type="button" disabled style={{ border: '1px solid #cbd5e1', background: '#f8fafc', color: '#94a3b8', borderRadius: 12, padding: '10px 14px' }}>调整余额 / 额度（待开放）</button>
          </div>
        </section>
      </div>

      <section style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 18, padding: 20 }}>
        <SectionTitle title="最近积分流水" />
        {(data.recent_wallet_transactions || []).length ? (
          <div style={{ display: 'grid', gap: 12 }}>
            {data.recent_wallet_transactions.map((item) => (
              <div key={item.id} style={{ border: '1px solid #e2e8f0', borderRadius: 14, padding: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                  <div>
                    <strong>{walletTypeMap[item.transaction_type] || item.transaction_type}</strong>
                    <div style={{ marginTop: 8, fontSize: 13, color: '#64748b' }}>{item.note || '系统记录'} {item.related_order_id ? `· 订单 #${item.related_order_id}` : ''}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 16, fontWeight: 700, color: item.credit_delta >= 0 ? '#16a34a' : '#dc2626' }}>
                      {item.credit_delta >= 0 ? '+' : ''}{item.credit_delta}
                    </div>
                    <div style={{ marginTop: 8, fontSize: 12, color: '#64748b' }}>余额 {item.credit_after}</div>
                  </div>
                </div>
                <div style={{ marginTop: 8, fontSize: 12, color: '#94a3b8' }}>{formatDateTime(item.created_at)}</div>
              </div>
            ))}
          </div>
        ) : <AdminEmptyState title="暂无积分流水" description="订阅到账或人工补偿后，这里会展示最近积分流水摘要。" />}
      </section>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <section style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 18, padding: 20 }}>
          <SectionTitle title="最近订单摘要" />
          {(data.recent_orders || []).length ? (
            <div style={{ display: 'grid', gap: 12 }}>
              {data.recent_orders.map((item) => (
                <button key={item.id} type="button" onClick={() => onNavigate('/admin/orders')} style={{ border: '1px solid #e2e8f0', background: '#fff', borderRadius: 14, padding: 12, textAlign: 'left' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                    <strong>{item.order_no}</strong>
                    <AdminStatusTag status={item.status}>{item.status}</AdminStatusTag>
                  </div>
                  <div style={{ marginTop: 8, fontSize: 13, color: '#64748b' }}>{formatMoney(item.amount)} · {formatDateTime(item.created_at)}</div>
                </button>
              ))}
            </div>
          ) : <AdminEmptyState title="暂无订单" description="该用户最近没有订单记录。" />}
        </section>

        <section style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 18, padding: 20 }}>
          <SectionTitle title="使用情况摘要" />
          <div style={{ display: 'grid', gap: 14 }}>
            <InfoCard label="项目总数" value={String(usage.project_count ?? 0)} />
            <InfoCard label="生图总次数" value={String(usage.generation_count ?? 0)} />
            <InfoCard label="最近生图时间" value={formatDateTime(usage.last_generation_at)} />
            <InfoCard label="最近项目更新时间" value={formatDateTime(usage.last_project_updated_at)} />
          </div>
        </section>
      </div>

      <section style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 18, padding: 20 }}>
        <SectionTitle title="最近操作日志摘要" />
        {(data.recent_audit_logs || []).length ? (
          <div style={{ display: 'grid', gap: 12 }}>
            {data.recent_audit_logs.map((item) => (
              <div key={item.id} style={{ border: '1px solid #e2e8f0', borderRadius: 14, padding: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                  <strong>{item.summary}</strong>
                  <span style={{ fontSize: 12, color: '#64748b' }}>{formatDateTime(item.created_at)}</span>
                </div>
                <div style={{ marginTop: 8, fontSize: 13, color: '#64748b' }}>{item.reason || '未填写原因'}</div>
              </div>
            ))}
          </div>
        ) : <AdminEmptyState title="暂无操作日志" description="管理员操作摘要会展示在这里。" />}
      </section>

      <ConfirmDialog
        open={dialogOpen}
        title="调整订阅"
        description={
          <div style={{ display: 'grid', gap: 12, marginTop: 12 }}>
            <select value={form.plan_id} onChange={(e) => setForm((current) => ({ ...current, plan_id: e.target.value }))} style={{ border: '1px solid #cbd5e1', borderRadius: 12, padding: '12px 14px' }}>
              <option value="">选择套餐</option>
              {plans.map((plan) => <option key={plan.id} value={plan.id}>{plan.name}</option>)}
            </select>
            <input type="datetime-local" value={form.started_at} onChange={(e) => setForm((current) => ({ ...current, started_at: e.target.value }))} style={{ border: '1px solid #cbd5e1', borderRadius: 12, padding: '12px 14px' }} />
            <input type="datetime-local" value={form.expires_at} onChange={(e) => setForm((current) => ({ ...current, expires_at: e.target.value }))} style={{ border: '1px solid #cbd5e1', borderRadius: 12, padding: '12px 14px' }} />
            <select value={form.source_type} onChange={(e) => setForm((current) => ({ ...current, source_type: e.target.value }))} style={{ border: '1px solid #cbd5e1', borderRadius: 12, padding: '12px 14px' }}>
              <option value="admin_grant">admin_grant</option>
              <option value="compensation">compensation</option>
              <option value="system">system</option>
            </select>
            <textarea value={form.reason} onChange={(e) => setForm((current) => ({ ...current, reason: e.target.value }))} placeholder="填写原因" rows={3} style={{ border: '1px solid #cbd5e1', borderRadius: 12, padding: '12px 14px', resize: 'vertical' }} />
            <input value={form.note} onChange={(e) => setForm((current) => ({ ...current, note: e.target.value }))} placeholder="备注（可选）" style={{ border: '1px solid #cbd5e1', borderRadius: 12, padding: '12px 14px' }} />
          </div>
        }
        confirmText="确认保存"
        onCancel={() => !saving && setDialogOpen(false)}
        onConfirm={handleSubmitSubscription}
        loading={saving}
        confirmDisabled={!canSubmit}
      />
    </div>
  )
}

function SectionTitle({ title }) {
  return <h3 style={{ margin: '0 0 16px', fontSize: 18 }}>{title}</h3>
}

const walletTypeMap = {
  subscription_grant: '订阅赠送积分',
  consume: '积分消费',
  refund: '积分退款',
  admin_adjust: '后台调整',
  recharge: '充值到账',
  system: '系统变更',
}

function InfoCard({ label, value }) {
  return (
    <div style={{ border: '1px solid #e2e8f0', borderRadius: 14, padding: 14, background: '#fff' }}>
      <div style={{ fontSize: 12, color: '#64748b', marginBottom: 8 }}>{label}</div>
      <div style={{ color: '#0f172a', fontWeight: 600, lineHeight: 1.7 }}>{value}</div>
    </div>
  )
}
