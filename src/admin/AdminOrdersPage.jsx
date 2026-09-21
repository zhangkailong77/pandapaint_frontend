import React, { useEffect, useState } from 'react'
import AdminEmptyState from './components/AdminEmptyState.jsx'
import AdminStatusTag from './components/AdminStatusTag.jsx'
import { adminFetchJson, formatDateTime, formatMoney } from './adminShared.js'

export default function AdminOrdersPage() {
  const [items, setItems] = useState([])
  const [error, setError] = useState('')
  const [selected, setSelected] = useState(null)

  useEffect(() => {
    adminFetchJson('/api/admin/orders')
      .then((res) => setItems(Array.isArray(res) ? res : []))
      .catch((err) => setError(err instanceof Error ? err.message : '加载失败'))
  }, [])

  async function handleOpenDetail(orderId) {
    try {
      const detail = await adminFetchJson(`/api/admin/orders/${orderId}`)
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
          <div style={{ padding: 20 }}><AdminEmptyState title="暂无订单" description="当前还没有订单记录。" /></div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f8fafc', textAlign: 'left', color: '#475569' }}>
                  {['订单号', '用户', '订单类型', '支付渠道', '订单金额', '币种', '支付状态', '第三方交易号', '创建时间', '支付时间', '操作'].map((label) => (
                    <th key={label} style={{ padding: '14px 16px', whiteSpace: 'nowrap', fontSize: 13 }}>{label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id} style={{ borderTop: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '14px 16px' }}>{item.order_no}</td>
                    <td style={{ padding: '14px 16px' }}>{item.user_email || '-'}</td>
                    <td style={{ padding: '14px 16px' }}>{item.order_type}</td>
                    <td style={{ padding: '14px 16px' }}>{item.payment_channel || '-'}</td>
                    <td style={{ padding: '14px 16px' }}>{formatMoney(item.amount)}</td>
                    <td style={{ padding: '14px 16px' }}>{item.currency}</td>
                    <td style={{ padding: '14px 16px' }}><AdminStatusTag status={item.status}>{item.status}</AdminStatusTag></td>
                    <td style={{ padding: '14px 16px' }}>{item.provider_transaction_id || '-'}</td>
                    <td style={{ padding: '14px 16px', whiteSpace: 'nowrap' }}>{formatDateTime(item.created_at)}</td>
                    <td style={{ padding: '14px 16px', whiteSpace: 'nowrap' }}>{formatDateTime(item.paid_at)}</td>
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
            <h3 style={{ margin: 0 }}>订单详情</h3>
            <button type="button" onClick={() => setSelected(null)} style={{ border: '1px solid #cbd5e1', background: '#fff', borderRadius: 10, padding: '8px 12px' }}>收起</button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 14, marginTop: 16 }}>
            <InfoCard label="订单号" value={selected.order_no} />
            <InfoCard label="订单类型" value={selected.order_type} />
            <InfoCard label="用户邮箱" value={selected.user_email || '-'} />
            <InfoCard label="支付状态" value={<AdminStatusTag status={selected.status}>{selected.status}</AdminStatusTag>} />
            <InfoCard label="支付渠道" value={selected.payment_channel || '-'} />
            <InfoCard label="订单金额" value={formatMoney(selected.amount)} />
            <InfoCard label="第三方交易号" value={selected.provider_transaction_id || '-'} />
            <InfoCard label="第三方订单号" value={selected.provider_order_id || '-'} />
            <InfoCard label="第三方客户 ID" value={selected.provider_customer_id || '-'} />
            <InfoCard label="第三方状态" value={selected.provider_status || '-'} />
            <InfoCard label="回调时间" value={formatDateTime(selected.provider_notified_at)} />
            <InfoCard label="退款时间" value={formatDateTime(selected.refunded_at)} />
            <InfoCard label="失败原因" value={selected.failure_reason || '-'} />
            <InfoCard label="积分是否到账" value={selected.credits_granted ? '已到账' : '未到账'} />
          </div>

          {(selected.related_subscription || selected.wallet_transaction_summary) ? (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 16 }}>
              <section style={{ border: '1px solid #e2e8f0', borderRadius: 14, padding: 16 }}>
                <div style={{ fontSize: 13, color: '#64748b', marginBottom: 10 }}>关联订阅</div>
                {selected.related_subscription ? (
                  <div style={{ display: 'grid', gap: 8 }}>
                    <div><strong>{selected.related_subscription.plan_name || '-'}</strong></div>
                    <div style={{ fontSize: 13, color: '#64748b' }}>状态：{selected.related_subscription.status || '-'}</div>
                    <div style={{ fontSize: 13, color: '#64748b' }}>生效：{formatDateTime(selected.related_subscription.started_at)}</div>
                    <div style={{ fontSize: 13, color: '#64748b' }}>到期：{formatDateTime(selected.related_subscription.expires_at)}</div>
                  </div>
                ) : <div style={{ fontSize: 13, color: '#94a3b8' }}>暂无关联订阅</div>}
              </section>

              <section style={{ border: '1px solid #e2e8f0', borderRadius: 14, padding: 16 }}>
                <div style={{ fontSize: 13, color: '#64748b', marginBottom: 10 }}>积分流水摘要</div>
                {selected.wallet_transaction_summary ? (
                  <div style={{ display: 'grid', gap: 8 }}>
                    <div><strong>{walletTypeMap[selected.wallet_transaction_summary.transaction_type] || selected.wallet_transaction_summary.transaction_type}</strong></div>
                    <div style={{ fontSize: 13, color: '#64748b' }}>变动：{selected.wallet_transaction_summary.credit_delta >= 0 ? '+' : ''}{selected.wallet_transaction_summary.credit_delta}</div>
                    <div style={{ fontSize: 13, color: '#64748b' }}>余额：{selected.wallet_transaction_summary.credit_after}</div>
                    <div style={{ fontSize: 13, color: '#64748b' }}>时间：{formatDateTime(selected.wallet_transaction_summary.created_at)}</div>
                  </div>
                ) : <div style={{ fontSize: 13, color: '#94a3b8' }}>暂无积分流水</div>}
              </section>
            </div>
          ) : null}

          <div style={{ marginTop: 16 }}>
            <div style={{ fontSize: 12, color: '#64748b', marginBottom: 8 }}>原始回调信息</div>
            <pre style={{ margin: 0, borderRadius: 14, background: '#0f172a', color: '#e2e8f0', padding: 16, overflowX: 'auto' }}>{JSON.stringify(selected.provider_payload_json || {}, null, 2)}</pre>
          </div>
        </section>
      ) : null}
    </div>
  )
}

function InfoCard({ label, value }) {
  return (
    <div style={{ border: '1px solid #e2e8f0', borderRadius: 14, padding: 14, background: '#fff' }}>
      <div style={{ fontSize: 12, color: '#64748b', marginBottom: 8 }}>{label}</div>
      <div style={{ color: '#0f172a', fontWeight: 600, lineHeight: 1.7 }}>{value}</div>
    </div>
  )
}

const walletTypeMap = {
  subscription_grant: '订阅赠送积分',
  consume: '积分消费',
  refund: '积分退款',
  admin_adjust: '后台调整',
  recharge: '充值到账',
  system: '系统变更',
}
