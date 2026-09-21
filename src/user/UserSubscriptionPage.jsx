import React, { useEffect, useMemo, useState } from 'react'
import { fetchJson } from '../lib/api.js'

function getOrderIdFromLocation() {
  const value = new URLSearchParams(window.location.search).get('orderId')
  const orderId = Number(value)
  return Number.isInteger(orderId) && orderId > 0 ? orderId : null
}

export default function UserSubscriptionPage({ onNavigate }) {
  const [data, setData] = useState(null)
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const [submittingPlanId, setSubmittingPlanId] = useState(null)
  const [pollingOrderId, setPollingOrderId] = useState(() => getOrderIdFromLocation())
  const [latestOrder, setLatestOrder] = useState(null)

  // 控制当前视图：null 表示套餐选择列表页，非 null 表示选中的结算套餐对象
  const [checkoutPlan, setCheckoutPlan] = useState(null)
  const [agreeTerms, setAgreeTerms] = useState(true)

  useEffect(() => {
    const orderId = getOrderIdFromLocation()
    if (!orderId) return undefined
    const params = new URLSearchParams(window.location.search)
    params.delete('orderId')
    const query = params.toString()
    window.history.replaceState({}, '', `${window.location.pathname}${query ? `?${query}` : ''}`)
    return undefined
  }, [])

  useEffect(() => {
    let active = true
    fetchJson('/api/subscription-plans')
      .then((res) => {
        if (!active) return
        setData(res)
        setError('')
      })
      .catch((err) => {
        if (!active) return
        setError(err instanceof Error ? err.message : '加载订阅套餐失败')
      })
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    if (!pollingOrderId) return undefined
    let cancelled = false
    let timer = null
    const checkOrder = async () => {
      try {
        const detail = await fetchJson(`/api/orders/${pollingOrderId}`)
        if (cancelled) return
        setLatestOrder(detail)
        if (detail.status === 'paid' || detail.status === 'failed' || detail.status === 'cancelled') {
          setPollingOrderId(null)
          if (detail.status === 'paid') {
            setStatus(`支付成功，已到账 ${detail.related_credit_amount || 0} 积分。`)
            const refreshed = await fetchJson('/api/subscription-plans')
            if (!cancelled) setData(refreshed)
          } else {
            setStatus(`订单状态：${detail.status}`)
          }
        }
      } catch (err) {
        if (cancelled) return
        setStatus(err instanceof Error ? err.message : '查询订单状态失败')
      }
    }
    checkOrder()
    timer = window.setInterval(checkOrder, 2500)

    return () => {
      cancelled = true
      if (timer) window.clearInterval(timer)
    }
  }, [pollingOrderId])

  const currentSubscription = data?.current_subscription || null
  const planItems = useMemo(() => (Array.isArray(data?.items) ? data.items : []), [data])

  // 按稳定套餐编码匹配后端返回的对应套餐，避免名称模糊匹配拿错档位
  const plusPlan = useMemo(() => {
    return planItems.find((p) => p.code === 'monthly_pro') || planItems.find((p) => p.tier_level === 2) || planItems[0] || null
  }, [planItems])

  const proPlan = useMemo(() => {
    return planItems.find((p) => p.code === 'monthly_max') || planItems.find((p) => p.tier_level === 3) || planItems[planItems.length - 1] || null
  }, [planItems])

  async function handleCreateOrder(plan) {
    if (!plan) return
    if (!agreeTerms) {
      alert('请先阅读并勾选服务条款与隐私政策')
      return
    }
    setSubmittingPlanId(plan.id)
    setStatus('')
    try {
      const order = await fetchJson('/api/orders/subscription', {
        method: 'POST',
        body: JSON.stringify({
          plan_id: plan.id,
          return_url: `${window.location.origin}${window.location.pathname}`,
        }),
      })
      setLatestOrder(order)
      setPollingOrderId(order.order_id)
      setStatus(
        order.reused_existing_order
          ? `已恢复待支付订单 ${order.order_no}，请继续完成支付宝支付。`
          : `已创建订单 ${order.order_no}，请继续完成支付宝支付。`
      )
      const payUrl = order.pay_payload?.pay_url
      if (!payUrl) {
        setStatus('支付宝支付链接生成失败，请稍后重试。')
        return
      }
      window.location.assign(payUrl)
    } catch (err) {
      setStatus(err instanceof Error ? err.message : '创建订阅订单失败')
    } finally {
      setSubmittingPlanId(null)
    }
  }

  // 计算价格分解
  const priceBreakdown = useMemo(() => {
    if (!checkoutPlan) return { base: 0, tax: 0, total: 0 }
    const total = Number(checkoutPlan.price_amount || 0)
    const base = Number((total / 1).toFixed(2))
    return { base, tax: 0, total }
  }, [checkoutPlan])

  // 如果处于收银台界面，渲染二级支付详情页
  if (checkoutPlan) {
    const isPlus = checkoutPlan.id === plusPlan?.id
    return (
      <div style={{ width: '100%', maxWidth: 1100, margin: '0 auto', padding: '24px 0' }}>
        {/* 顶部面包屑与标题 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 32 }}>
          <button 
            type="button" 
            onClick={() => {
              setCheckoutPlan(null)
              setStatus('')
              setLatestOrder(null)
            }} 
            style={backButtonStyle}
          >
            <BackArrowIcon />
          </button>
          <h2 style={{ fontSize: 22, fontWeight: 700, color: '#0f172a', margin: 0 }}>配置套餐</h2>
        </div>

        {/* 左右分栏结构 */}
        <div style={checkoutGridStyle}>
          
          {/* 左边栏：选择支付方式与扫码盒 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            <div>
              <div style={checkoutSectionTitleStyle}>快捷支付</div>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 16, marginTop: 12 }}>
                <div
                  style={{
                    ...paymentShortcutButtonStyle,
                    borderColor: '#027aff',
                    background: '#f0f9ff',
                    cursor: 'default',
                  }}
                >
                  <AlipayIcon color="#027aff" />
                  <span style={{ color: '#1d4ed8', fontWeight: 600 }}>支付宝支付</span>
                </div>
              </div>
            </div>

            {/* 支付状态与二维码区域 */}
            <div style={checkoutCardDetailContainerStyle}>
              {status ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a' }}>正在打开支付宝收银台</div>
                  <div style={{ display: 'flex', gap: 20, alignItems: 'center', flexWrap: 'wrap' }}>
                    <div style={paymentProviderBadgeStyle}>
                      <AlipayIcon color="#027aff" />
                      <div style={{ fontSize: 10, color: '#64748b', marginTop: 4 }}>支付宝沙箱</div>
                    </div>
                    <div style={{ flex: 1, minWidth: 200, display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <span style={pillStyle}>请在新页面完成支付宝沙箱付款</span>
                      <div style={metaTextStyle}>订单号：{latestOrder?.order_no || '-'}</div>
                      <div style={metaTextStyle}>交易金额：¥{Number(latestOrder?.amount || checkoutPlan.price_amount).toFixed(2)}</div>
                    </div>
                  </div>
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '32px 0', color: '#64748b' }}>
                  <ShieldIcon />
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#334155', marginTop: 8 }}>
                    安全加密支付通道已就绪
                  </div>
                  <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>
                    请在右侧核对账单并点击“确认支付”生成交易订单。
                  </div>
                </div>
              )}
            </div>

            <label style={checkboxLabelStyle}>
              <input
                type="checkbox"
                checked={agreeTerms}
                onChange={(e) => setAgreeTerms(e.target.checked)}
                style={{ accentColor: '#0f172a', width: 16, height: 16 }}
              />
              <span style={{ fontSize: 13, color: '#475569', lineHeight: 1.5 }}>
                将支付详情保存到您的账户，并同意我们的《服务条款》与《隐私政策》，以便备将来购物时自动续订使用。
              </span>
            </label>
          </div>

          {/* 右边栏：套餐包含与账单分解 */}
          <div>
            <div style={checkoutReceiptCardStyle}>
              <div>
                <span style={eyebrowStyle}>{isPlus ? 'Plus' : 'Pro'} 套餐</span>
                <h3 style={{ fontSize: 20, fontWeight: 700, color: '#0f172a', margin: '8px 0 16px' }}>热门功能</h3>
                
                <ul style={{ ...featureListStyle, gap: 12 }}>
                  <li style={featureItemStyle}>
                    <FeatureBoltIcon color={isPlus ? '#2563eb' : '#0f172a'} />
                    <span>获得当前档位模型核心访问权限</span>
                  </li>
                  <li style={featureItemStyle}>
                    <FeatureBoltIcon color={isPlus ? '#2563eb' : '#0f172a'} />
                    <span>更快的消息发送，以及每日大容量文件上传额度</span>
                  </li>
                  <li style={featureItemStyle}>
                    <FeatureBoltIcon color={isPlus ? '#2563eb' : '#0f172a'} />
                    <span>更高级且精细化的图片和多媒体创作能力</span>
                  </li>
                  <li style={featureItemStyle}>
                    <FeatureBoltIcon color={isPlus ? '#2563eb' : '#0f172a'} />
                    <span>享受超强记忆库与上下文逻辑连贯性</span>
                  </li>
                </ul>
              </div>

              <div style={receiptPriceSectionStyle}>
                <div style={receiptPriceRowStyle}>
                  <span>按月订阅费用</span>
                  <span>¥{priceBreakdown.base.toFixed(2)}</span>
                </div>
                <div style={receiptPriceRowStyle}>
                  <span>预估税费</span>
                  <span>¥{priceBreakdown.tax.toFixed(2)}</span>
                </div>
                <div style={{ ...receiptPriceRowStyle, fontWeight: 700, fontSize: 16, color: '#0f172a', borderTop: '1px solid #f1f5f9', paddingTop: 12, marginTop: 4 }}>
                  <span>今日应付金额</span>
                  <span>¥{priceBreakdown.total.toFixed(2)}</span>
                </div>
              </div>

              <button
                type="button"
                disabled={submittingPlanId === checkoutPlan.id}
                onClick={() => handleCreateOrder(checkoutPlan)}
                style={checkoutPrimarySubmitButtonStyle}
              >
                {submittingPlanId === checkoutPlan.id ? '正在处理中...' : '确认订阅'}
              </button>
            </div>

            <p style={bottomTermsTextStyle}>
              将按每月自动续订，直至取消。您可在设置中随时取消。订阅即表示您同意我们的《使用条款》及《服务条款》。
            </p>
          </div>

        </div>
      </div>
    )
  }

  // 主页面三栏列表页
  return (
    <div style={{ display: 'grid', gap: 24, width: '100%', margin: '0 auto', boxSizing: 'border-box' }}>
      
      {/* 顶部标题栏 */}
      <section style={topSectionStyle}>
        <div style={{ flex: 1, minWidth: 280 }}>
          <div style={eyebrowStyle}>订阅中心</div>
          <h2 style={{ margin: '6px 0 4px', fontSize: 24, fontWeight: 700, color: '#1e293b' }}>管理你的会员与积分额度</h2>
          <p style={mutedStyle}>当前仅支持按月订阅；已有有效订阅时，只允许升级到更高档位。</p>
        </div>
        <button type="button" onClick={() => onNavigate?.('wallet')} style={secondaryButtonStyle}>
          查看我的积分
        </button>
      </section>

      {/* 错误提示 */}
      {error ? (
        <section style={{ ...cardStyle, borderColor: '#fecaca', background: '#fff7f7' }}>
          <div style={sectionTitleStyle}>加载失败</div>
          <div style={metaTextStyle}>{error}</div>
        </section>
      ) : null}

      {latestOrder || status ? (
        <section
          style={{
            ...cardStyle,
            borderColor: latestOrder?.status === 'paid' ? '#86efac' : '#bfdbfe',
            background: latestOrder?.status === 'paid' ? '#f0fdf4' : '#eff6ff',
          }}
        >
          <div style={sectionTitleStyle}>
            {latestOrder?.status === 'paid' ? '支付成功' : pollingOrderId ? '正在确认支付结果' : '支付宝订单状态'}
          </div>
          {status ? <div style={metaTextStyle}>{status}</div> : null}
          {latestOrder ? (
            <div style={{ ...metaTextStyle, marginTop: status ? 6 : 0 }}>
              订单号：{latestOrder.order_no || '-'} · 状态：{latestOrder.status || 'pending'}
            </div>
          ) : null}
        </section>
      ) : null}

      {/* 横向三栏分布 */}
      <section style={threeColumnContainerStyle}>
        
        {/* Card 1: 免费版 */}
        <article style={planCardStyle}>
          <div>
            <span style={eyebrowStyle}>免费版</span>
            <h3 style={cardHeaderStyle}>了解 AI 的功能</h3>
            <div style={priceContainerStyle}>
              <span style={priceBigStyle}>¥0</span>
              <span style={pricePeriodStyle}>/ 月</span>
            </div>
            <p style={mutedTextLimitedStyle}>适合对日常对话及轻度体验感兴趣的用户。</p>
          </div>
          
          <button type="button" disabled style={disabledCardButtonStyle}>
            {!currentSubscription ? '你当前的套餐' : '免费版'}
          </button>

          <div style={dividerStyle}>
            <div style={featureTitleStyle}>套餐包含：</div>
            <ul style={featureListStyle}>
              <li style={featureItemStyle}>
                <CheckIcon color="#94a3b8" />
                <span>基础核心 AI 模型</span>
              </li>
              <li style={featureItemStyle}>
                <CheckIcon color="#94a3b8" />
                <span>有限额度的消息发送和文件上传</span>
              </li>
              <li style={featureItemStyle}>
                <CheckIcon color="#94a3b8" />
                <span>有限的图片创建功能</span>
              </li>
              <li style={featureItemStyle}>
                <CheckIcon color="#94a3b8" />
                <span>基础上下文记忆</span>
              </li>
            </ul>
          </div>
        </article>

        {/* Card 2: Plus 进阶版 */}
        <article style={{ ...planCardStyle, borderColor: '#3b82f6', boxShadow: '0 20px 25px -5px rgba(59, 130, 246, 0.08), 0 8px 10px -6px rgba(59, 130, 246, 0.08)', position: 'relative' }}>
          <div style={popularBadgeStyle}>热门</div>
          <div>
            <span style={{ ...eyebrowStyle, color: '#2563eb' }}>Plus</span>
            <h3 style={cardHeaderStyle}>
              {plusPlan ? plusPlan.name : '月度进阶版'}
            </h3>
            <div style={priceContainerStyle}>
              <span style={{ ...priceBigStyle, color: '#2563eb' }}>
                ¥{plusPlan ? Number(plusPlan.price_amount || 0).toFixed(2) : '19.90'}
              </span>
              <span style={pricePeriodStyle}>/ 月</span>
            </div>
            <p style={mutedTextLimitedStyle}>
              {plusPlan?.description || '适合创作者和日常高频用户，解锁更高效的 AI 体验。'}
            </p>
          </div>

          <button
            type="button"
            disabled={!plusPlan || !plusPlan.can_purchase}
            onClick={() => setCheckoutPlan(plusPlan)}
            style={plusButtonStyle}
          >
            {currentSubscription ? '升级至 Plus' : '立即开通'}
          </button>

          {plusPlan?.disabled_reason && <div style={warningStyle}>{plusPlan.disabled_reason}</div>}

          <div style={dividerStyle}>
            <div style={featureTitleStyle}>Plus 包含免费版所有功能，以及：</div>
            <ul style={featureListStyle}>
              <li style={featureItemStyle}>
                <CheckIcon color="#2563eb" />
                <span style={{ fontWeight: 600 }}>月度获赠 {plusPlan?.credit_amount || 0} 专属积分</span>
              </li>
              <li style={featureItemStyle}>
                <CheckIcon color="#2563eb" />
                <span>优先访问最新高级模型</span>
              </li>
              <li style={featureItemStyle}>
                <CheckIcon color="#2563eb" />
                <span>使用智能绘画进行高级图像创建</span>
              </li>
              <li style={featureItemStyle}>
                <CheckIcon color="#2563eb" />
                <span>扩展上下文记忆，更流畅的跨端对话</span>
              </li>
              <li style={featureItemStyle}>
                <CheckIcon color="#2563eb" />
                <span>探索自定义 GPTs 专属功能</span>
              </li>
            </ul>
          </div>
        </article>

        {/* Card 3: Pro 旗舰版 */}
        <article style={planCardStyle}>
          <div>
            <span style={{ ...eyebrowStyle, color: '#1e293b' }}>Pro</span>
            <h3 style={cardHeaderStyle}>
              {proPlan ? proPlan.name : '月度旗舰版'}
            </h3>
            <div style={priceContainerStyle}>
              <span style={priceBigStyle}>
                ¥{proPlan ? Number(proPlan.price_amount || 0).toFixed(2) : '59.90'}
              </span>
              <span style={pricePeriodStyle}>/ 月</span>
            </div>
            <p style={mutedTextLimitedStyle}>
              {proPlan?.description || '适合专业开发者、设计工作室及重度生产力需求者。'}
            </p>
          </div>

          <button
            type="button"
            disabled={!proPlan || !proPlan.can_purchase}
            onClick={() => setCheckoutPlan(proPlan)}
            style={proButtonStyle}
          >
            {currentSubscription ? '升级至 Pro' : '立即开通'}
          </button>

          {proPlan?.disabled_reason && <div style={warningStyle}>{proPlan.disabled_reason}</div>}

          <div style={dividerStyle}>
            <div style={featureTitleStyle}>Pro 包含 Plus 所有功能，以及：</div>
            <ul style={featureListStyle}>
              <li style={featureItemStyle}>
                <CheckIcon color="#0f172a" />
                <span style={{ fontWeight: 600 }}>月度获赠 {proPlan?.credit_amount || 0} 超大额积分</span>
              </li>
              <li style={featureItemStyle}>
                <CheckIcon color="#0f172a" />
                <span>相比 Plus 享更高倍数的使用额度</span>
              </li>
              <li style={featureItemStyle}>
                <CheckIcon color="#0f172a" />
                <span>不限流、极速图像生成与导出</span>
              </li>
              <li style={featureItemStyle}>
                <CheckIcon color="#0f172a" />
                <span>最高等级深度推理与代码辅助</span>
              </li>
              <li style={featureItemStyle}>
                <CheckIcon color="#0f172a" />
                <span>抢先体验尖端实验性功能</span>
              </li>
            </ul>
          </div>
        </article>

      </section>
    </div>
  )
}

// ==================== SVG 图标组件 ====================

function CheckIcon({ color = '#10b981' }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 2 }}>
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}

function BackArrowIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1e293b" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="15 18 9 12 15 6" />
    </svg>
  )
}


function AlipayIcon({ color = '#027aff' }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill={color}>
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1.88 15.62c-.14.28-.35.53-.62.72-.51.35-1.21.53-2.1.53-.87 0-1.57-.18-2.1-.53-.5-.33-.76-.84-.76-1.52 0-.66.25-1.15.76-1.48.51-.33 1.22-.5 2.1-.5h2.12v2.78zm0-4.1h-2.12c-.88 0-1.59-.17-2.1-.51-.51-.33-.76-.82-.76-1.47 0-.63.25-1.12.76-1.45.51-.33 1.22-.49 2.1-.49h2.12v3.92z" opacity=".2"/>
      <path d="M18.8 5.6h-5.4V4.1c0-.4-.3-.7-.7-.7h-.9c-.4 0-.7.3-.7.7v1.5H5.7c-.4 0-.7.3-.7.7v.8c0 .4.3.7.7.7h2.8c-.4 1.5-1.3 3-2.5 4.1-.3.2-.3.6-.1.8.2.2.5.3.8.1 1.4-1.2 2.3-2.9 2.7-4.6h1.9v4.2H8.3c-.4 0-.7.3-.7.7v.8c0 .4.3.7.7.7h3.1v3.3c0 .4.3.7.7.7h.9c.4 0 .7-.3.7-.7v-3.3h3.1c.4 0 .7-.3.7-.7v-.8c0-.4-.3-.7-.7-.7h-3.1v-4.2h1.9c.4 1.7 1.3 3.4 2.7 4.6.2.2.6.2.8-.1.2-.2.2-.6-.1-.8-1.2-1.1-2.1-2.6-2.5-4.1h2.8c.4 0 .7-.3.7-.7v-.8c-.1-.4-.4-.7-.8-.7z"/>
    </svg>
  )
}

function FeatureBoltIcon({ color = '#2563eb' }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  )
}

function ShieldIcon() {
  return (
    <svg width="42" height="42" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ margin: '0 auto' }}>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  )
}


// ==================== 样式配置 ====================

const cardStyle = {
  background: '#fff',
  border: '1px solid #e2e8f0',
  borderRadius: 16,
  padding: 20,
  boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.02)',
}

const topSectionStyle = {
  ...cardStyle,
  display: 'flex',
  justifyContent: 'space-between',
  gap: 20,
  alignItems: 'center',
  flexWrap: 'wrap',
}

const threeColumnContainerStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(3, 1fr)',
  gap: 20,
  alignItems: 'stretch',
  width: '100%',
}

const planCardStyle = {
  ...cardStyle,
  borderRadius: 20,
  padding: '28px 24px',
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'space-between',
  gap: 16,
}

const cardHeaderStyle = {
  margin: '8px 0 4px',
  fontSize: 20,
  fontWeight: 700,
  color: '#0f172a',
}

const priceContainerStyle = {
  display: 'flex',
  alignItems: 'baseline',
  gap: 4,
  margin: '4px 0 8px',
}

const priceBigStyle = {
  fontSize: 32,
  fontWeight: 800,
  color: '#0f172a',
}

const pricePeriodStyle = {
  fontSize: 13,
  color: '#64748b',
}

const eyebrowStyle = {
  fontSize: 13,
  fontWeight: 700,
  letterSpacing: '0.05em',
  textTransform: 'uppercase',
  color: '#64748b',
}

const sectionTitleStyle = {
  fontSize: 14,
  fontWeight: 700,
  color: '#1e293b',
  marginBottom: 8,
}

const statusBadgeContainerStyle = {
  background: '#f8fafc',
  border: '1px solid #e2e8f0',
  borderRadius: 12,
  padding: '12px 16px',
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
}

const mutedStyle = {
  margin: 0,
  fontSize: 13,
  lineHeight: 1.5,
  color: '#64748b',
}

const mutedTextLimitedStyle = {
  margin: '4px 0',
  fontSize: 13,
  lineHeight: 1.5,
  color: '#64748b',
  minHeight: 40,
}

const metaTextStyle = {
  fontSize: 12,
  lineHeight: 1.6,
  color: '#475569',
}

const warningStyle = {
  borderRadius: 10,
  background: '#fff7ed',
  color: '#c2410c',
  fontSize: 12,
  padding: '8px 12px',
}

const plusButtonStyle = {
  border: 0,
  borderRadius: 12,
  padding: '12px 16px',
  background: '#2563eb',
  color: '#fff',
  fontSize: 14,
  fontWeight: 700,
  cursor: 'pointer',
  boxShadow: '0 4px 10px rgba(37, 99, 235, 0.15)',
  width: '100%',
}

const proButtonStyle = {
  border: 0,
  borderRadius: 12,
  padding: '12px 16px',
  background: '#0f172a',
  color: '#fff',
  fontSize: 14,
  fontWeight: 700,
  cursor: 'pointer',
  width: '100%',
}

const disabledCardButtonStyle = {
  border: '1px solid #e2e8f0',
  borderRadius: 12,
  padding: '12px 16px',
  background: '#f8fafc',
  color: '#94a3b8',
  fontSize: 14,
  fontWeight: 600,
  cursor: 'not-allowed',
  width: '100%',
}

const secondaryButtonStyle = {
  border: '1px solid #cbd5e1',
  borderRadius: 10,
  padding: '8px 14px',
  background: '#fff',
  color: '#334155',
  fontSize: 13,
  fontWeight: 600,
  cursor: 'pointer',
}

const radioRowStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '8px 14px',
  border: '1px solid #e2e8f0',
  borderRadius: 10,
  cursor: 'pointer',
  fontSize: 13,
}

const pillStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  padding: '4px 10px',
  borderRadius: 999,
  background: '#eff6ff',
  color: '#1d4ed8',
  fontSize: 12,
  fontWeight: 600,
}

const popularBadgeStyle = {
  position: 'absolute',
  top: 18,
  right: 18,
  background: '#e0f2fe',
  color: '#0369a1',
  fontSize: 11,
  fontWeight: 700,
  padding: '2px 10px',
  borderRadius: 999,
  textTransform: 'uppercase',
}

const dividerStyle = {
  borderTop: '1px solid #f1f5f9',
  marginTop: 4,
  paddingTop: 12,
}

const featureTitleStyle = {
  fontSize: 12,
  fontWeight: 700,
  color: '#1e293b',
  marginBottom: 10,
}

const featureListStyle = {
  listStyle: 'none',
  padding: 0,
  margin: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
}

const featureItemStyle = {
  display: 'flex',
  alignItems: 'flex-start',
  gap: 8,
  fontSize: 12,
  color: '#475569',
  lineHeight: 1.4,
}

// 结算收银台页面样式
const backButtonStyle = {
  border: '1px solid #cbd5e1',
  background: '#fff',
  borderRadius: '50%',
  width: 36,
  height: 36,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
}

const checkoutGridStyle = {
  display: 'grid',
  gridTemplateColumns: '1.2fr 0.8fr',
  gap: 40,
  alignItems: 'start',
}

const checkoutSectionTitleStyle = {
  fontSize: 16,
  fontWeight: 700,
  color: '#0f172a',
}

const paymentShortcutButtonStyle = {
  border: '1.5px solid #e2e8f0',
  borderRadius: 12,
  padding: '16px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 10,
  fontSize: 15,
  cursor: 'pointer',
  transition: 'all 0.15s ease',
}

const checkoutCardDetailContainerStyle = {
  background: '#fff',
  border: '1px solid #e2e8f0',
  borderRadius: 16,
  padding: '28px',
  minHeight: 180,
  boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'center',
}

const paymentProviderBadgeStyle = {
  background: '#f8fafc',
  border: '1px solid #e2e8f0',
  borderRadius: 12,
  padding: '12px 16px',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
}

const checkboxLabelStyle = {
  display: 'flex',
  gap: 12,
  alignItems: 'flex-start',
  cursor: 'pointer',
  userSelect: 'none',
}

const checkoutReceiptCardStyle = {
  background: '#fff',
  border: '1px solid #e2e8f0',
  borderRadius: 20,
  padding: '28px',
  display: 'flex',
  flexDirection: 'column',
  gap: 24,
  boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
}

const receiptPriceSectionStyle = {
  display: 'flex',
  flexDirection: 'column',
  gap: 10,
  borderTop: '1px solid #f1f5f9',
  paddingTop: 16,
}

const receiptPriceRowStyle = {
  display: 'flex',
  justifyContent: 'space-between',
  fontSize: 14,
  color: '#64748b',
}

const checkoutPrimarySubmitButtonStyle = {
  border: 0,
  borderRadius: 14,
  padding: '14px 18px',
  background: '#0f172a',
  color: '#fff',
  fontSize: 15,
  fontWeight: 700,
  cursor: 'pointer',
  width: '100%',
  textAlign: 'center',
}

const bottomTermsTextStyle = {
  fontSize: 12,
  lineHeight: 1.6,
  color: '#64748b',
  marginTop: 20,
  padding: '0 4px',
}