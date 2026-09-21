import React, { useEffect, useMemo, useState } from 'react'
import { fetchJson } from '../lib/api.js'

export default function UserWalletPage({ onNavigate }) {
  const [wallet, setWallet] = useState(null)
  const [transactions, setTransactions] = useState([])
  const [pagination, setPagination] = useState({ page: 1, page_size: 20, total: 0 })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true

    async function loadData() {
      setLoading(true)
      try {
        const [walletRes, transactionRes] = await Promise.all([
          fetchJson('/api/user/wallet'),
          fetchJson('/api/user/wallet/transactions'),
        ])
        if (!active) return
        setWallet(walletRes)
        setTransactions(Array.isArray(transactionRes.items) ? transactionRes.items : [])
        setPagination(transactionRes.pagination || { page: 1, page_size: 20, total: 0 })
        setError('')
      } catch (err) {
        if (!active) return
        setError(err instanceof Error ? err.message : '加载积分信息失败')
      } finally {
        if (active) setLoading(false)
      }
    }

    void loadData()

    return () => {
      active = false
    }
  }, [])

  const summary = useMemo(() => {
    const grantCount = transactions.filter((item) => item.transaction_type === 'subscription_grant').length
    const consumeCount = transactions.filter((item) => item.transaction_type === 'consume').length
    return { grantCount, consumeCount }
  }, [transactions])

  if (loading) {
    return <div style={{ color: '#71717a', fontSize: 14 }}>积分信息加载中...</div>
  }

  return (
    <div style={{ display: 'grid', gap: 24 }}>
      <section style={cardStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <div>
            <div style={eyebrowStyle}>我的积分</div>
            <h2 style={{ margin: '8px 0 0', fontSize: 28 }}>当前余额 {wallet?.credit_amount ?? 0}</h2>
            <p style={mutedStyle}>积分余额以系统钱包为准；后续生成、下载等消费场景会在这里留下完整流水。</p>
          </div>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <button type="button" onClick={() => onNavigate?.('subscription')} style={secondaryButtonStyle}>前往订阅中心</button>
            <span style={pillStyle}>最近更新：{formatDateTime(wallet?.updated_at)}</span>
          </div>
        </div>
      </section>

      {error ? (
        <section style={{ ...cardStyle, borderColor: '#fecaca', background: '#fff7f7' }}>
          <div style={sectionTitleStyle}>加载失败</div>
          <div style={mutedStyle}>{error}</div>
        </section>
      ) : null}

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16 }}>
        <StatCard label="当前积分" value={String(wallet?.credit_amount ?? 0)} helper="可用于后续权益消耗" />
        <StatCard label="累计到账" value={String(summary.grantCount)} helper="订阅赠送流水条数" />
        <StatCard label="累计消费" value={String(summary.consumeCount)} helper="当前仍为预留字段" />
        <StatCard label="总流水" value={String(pagination.total || transactions.length)} helper="包含赠送、消费、退款等类型" />
      </section>

      <section style={cardStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
          <div>
            <div style={sectionTitleStyle}>积分流水</div>
            <div style={mutedTextStyle}>当前重点展示订阅赠送积分，后续消费 / 退款 / 补偿也会统一记录在这里。</div>
          </div>
          <div style={mutedTextStyle}>第 {pagination.page || 1} 页 · 每页 {pagination.page_size || transactions.length} 条</div>
        </div>

        {!transactions.length ? (
          <div style={emptyStateStyle}>暂无积分流水，完成订阅后这里会出现到账记录。</div>
        ) : (
          <div style={{ marginTop: 18, display: 'grid', gap: 12 }}>
            {transactions.map((item) => (
              <div key={item.id} style={transactionCardStyle}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: '#18181b' }}>{transactionLabelMap[item.transaction_type] || item.transaction_type}</div>
                    <div style={mutedTextStyle}>{item.note || '系统记录'} {item.related_order_id ? `· 订单 #${item.related_order_id}` : ''}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 16, fontWeight: 700, color: item.credit_delta >= 0 ? '#16a34a' : '#dc2626' }}>
                      {item.credit_delta >= 0 ? '+' : ''}{item.credit_delta}
                    </div>
                    <div style={mutedTextStyle}>余额：{item.credit_after}</div>
                  </div>
                </div>
                <div style={{ marginTop: 8, fontSize: 12, color: '#71717a' }}>{formatDateTime(item.created_at)}</div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

function StatCard({ label, value, helper }) {
  return (
    <div style={statCardStyle}>
      <div style={{ fontSize: 13, color: '#71717a' }}>{label}</div>
      <div style={{ marginTop: 10, fontSize: 30, fontWeight: 700, color: '#18181b' }}>{value}</div>
      <div style={{ marginTop: 6, fontSize: 12, color: '#a1a1aa' }}>{helper}</div>
    </div>
  )
}

function formatDateTime(value) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const transactionLabelMap = {
  subscription_grant: '订阅赠送积分',
  consume: '积分消费',
  refund: '积分退回',
  admin_adjust: '后台调整',
  recharge: '充值到账',
  system: '系统变更',
}

const cardStyle = {
  background: '#fff',
  border: '1px solid #e4e4e7',
  borderRadius: 20,
  padding: 24,
}

const statCardStyle = {
  ...cardStyle,
  padding: 20,
}

const transactionCardStyle = {
  border: '1px solid #e4e4e7',
  borderRadius: 16,
  padding: 16,
  background: '#fff',
}

const eyebrowStyle = {
  fontSize: 12,
  fontWeight: 600,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  color: '#71717a',
}

const sectionTitleStyle = {
  fontSize: 16,
  fontWeight: 600,
  color: '#18181b',
}

const mutedStyle = {
  margin: '10px 0 0',
  fontSize: 13,
  lineHeight: 1.7,
  color: '#71717a',
}

const mutedTextStyle = {
  fontSize: 12,
  lineHeight: 1.6,
  color: '#71717a',
}

const emptyStateStyle = {
  marginTop: 18,
  padding: '32px 20px',
  borderRadius: 16,
  border: '1px dashed #d4d4d8',
  background: '#fafafa',
  color: '#71717a',
  textAlign: 'center',
  fontSize: 13,
}

const secondaryButtonStyle = {
  border: '1px solid #d4d4d8',
  borderRadius: 12,
  padding: '10px 14px',
  background: '#fff',
  color: '#18181b',
  fontSize: 13,
  fontWeight: 600,
}

const pillStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  padding: '8px 12px',
  borderRadius: 999,
  background: '#eff6ff',
  color: '#1d4ed8',
  fontSize: 12,
  fontWeight: 600,
}
