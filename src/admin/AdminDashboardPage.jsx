import React, { useEffect, useLayoutEffect, useState, useMemo, useRef } from 'react'
import { gsap } from 'gsap'
import AdminEmptyState from './components/AdminEmptyState.jsx'
import AdminStatusTag from './components/AdminStatusTag.jsx'
import { adminFetchJson, formatDateTime } from './adminShared.js'

function StatCard({ title, value, hint, isCurrency = false }) {
  const numRef = useRef(null)

  useEffect(() => {
    if (!numRef.current || typeof value !== 'number') return
    const obj = { val: 0 }
    const tween = gsap.to(obj, {
      val: value,
      duration: 0.85,
      ease: 'power3.out',
      onUpdate: () => {
        if (numRef.current) {
          numRef.current.textContent = isCurrency
            ? `¥${Math.round(obj.val).toLocaleString()}`
            : Math.round(obj.val).toLocaleString()
        }
      },
    })
    return () => tween.kill()
  }, [value, isCurrency])

  return (
    <div style={{ background: '#fff', borderRadius: 18, padding: 20, border: '1px solid #e2e8f0' }}>
      <div style={{ fontSize: 13, color: '#64748b' }}>{title}</div>
      <div
        ref={numRef}
        style={{ marginTop: 12, fontSize: 28, fontWeight: 700, color: '#0f172a' }}
      >
        {typeof value === 'number' ? (isCurrency ? `¥${value}` : value) : value}
      </div>
      {hint ? <div style={{ marginTop: 8, fontSize: 12, color: '#94a3b8' }}>{hint}</div> : null}
    </div>
  )
}

// 真实数据趋势图（0 闪烁、纯平滑 GSAP 曲线同步绘制）
function GrowthTrendChart({ trendList = [], timeRange, onRangeChange, loading }) {
  const [hoverIndex, setHoverIndex] = useState(null)

  const revPathRef = useRef(null)
  const userPathRef = useRef(null)
  const areaPathRef = useRef(null)
  const chartWrapperRef = useRef(null)
  const summaryContainerRef = useRef(null)

  const data = useMemo(() => {
    return (trendList || []).map((item) => ({
      date: item.date || '',
      fullDate: item.full_date || item.date || '',
      newUsers: Number(item.new_users ?? 0),
      revenue: Number(item.revenue ?? 0),
    }))
  }, [trendList])

  const totals = useMemo(() => {
    const totalUsers = data.reduce((acc, cur) => acc + cur.newUsers, 0)
    const totalRevenue = data.reduce((acc, cur) => acc + cur.revenue, 0)
    return { totalUsers, totalRevenue }
  }, [data])

  const width = 860
  const height = 240
  const padding = { top: 20, right: 30, bottom: 35, left: 50 }

  const maxUsers = Math.max(...data.map((d) => d.newUsers), 5)
  const maxRev = Math.max(...data.map((d) => d.revenue), 100)

  const innerW = width - padding.left - padding.right
  const innerH = height - padding.top - padding.bottom

  const getX = (index) => padding.left + (index / (data.length - 1 || 1)) * innerW
  const getYUser = (val) => padding.top + innerH - (val / maxUsers) * innerH
  const getYRev = (val) => padding.top + innerH - (val / maxRev) * innerH

  // 生成平滑贝塞尔曲线路径
  const createSmoothPath = (points) => {
    if (points.length === 0) return ''
    if (points.length === 1) return `M ${points[0].x},${points[0].y} L ${points[0].x},${points[0].y}`
    return points.reduce((acc, pt, i, arr) => {
      if (i === 0) return `M ${pt.x},${pt.y}`
      const prev = arr[i - 1]
      const cx1 = prev.x + (pt.x - prev.x) / 2
      const cy1 = prev.y
      const cx2 = prev.x + (pt.x - prev.x) / 2
      const cy2 = pt.y
      return `${acc} C ${cx1},${cy1} ${cx2},${cy2} ${pt.x},${pt.y}`
    }, '')
  }

  const userPoints = data.map((d, i) => ({ x: getX(i), y: getYUser(d.newUsers) }))
  const revPoints = data.map((d, i) => ({ x: getX(i), y: getYRev(d.revenue) }))

  const userLine = createSmoothPath(userPoints)
  const revLine = createSmoothPath(revPoints)

  const revArea = data.length > 0
    ? `${revLine} L ${getX(data.length - 1)},${height - padding.bottom} L ${getX(0)},${height - padding.bottom} Z`
    : ''

  // GSAP 绿色与蓝色双曲线从左往右顺滑画出动效（解决闪烁与提前暴露问题）
  useLayoutEffect(() => {
    if (data.length < 2) return

    const revEl = revPathRef.current
    const userEl = userPathRef.current
    const areaEl = areaPathRef.current

    if (!revEl || !userEl) return

    // 先终止正在执行的动画
    gsap.killTweensOf([revEl, userEl, areaEl])

    const revLen = revEl.getTotalLength() || 1000
    const userLen = userEl.getTotalLength() || 1000

    // 核心：在 0 帧瞬间设置好 dashoffset 之后，再同时开启 opacity: 1，杜绝一切提前裸露
    gsap.set(revEl, { strokeDasharray: revLen, strokeDashoffset: revLen, opacity: 1 })
    gsap.set(userEl, { strokeDasharray: userLen, strokeDashoffset: userLen, opacity: 1 })
    if (areaEl) gsap.set(areaEl, { opacity: 0, scaleY: 0, transformOrigin: 'bottom center' })

    const tl = gsap.timeline()

    // 1. 绿色收入曲线从左到右平滑画出
    tl.to(revEl, {
      strokeDashoffset: 0,
      duration: 1.15,
      ease: 'power3.out',
    }, 0)

    // 2. 蓝色用户曲线从左到右平滑画出
    tl.to(userEl, {
      strokeDashoffset: 0,
      duration: 1.15,
      ease: 'power3.out',
    }, 0)

    // 3. 面积图随之自下而上淡入展开
    if (areaEl) {
      tl.to(areaEl, { opacity: 1, scaleY: 1, duration: 0.85, ease: 'power2.out' }, 0.2)
    }

    return () => {
      tl.kill()
    }
  }, [data])

  return (
    <div style={{ background: '#fff', borderRadius: 18, padding: '22px 24px', border: '1px solid #e2e8f0' }} ref={chartWrapperRef}>
      {/* 头部标题与周期控制器 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h3 style={{ margin: 0, fontSize: 18, color: '#0f172a', fontWeight: 600 }}>增长与收益趋势</h3>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: '#64748b' }}>
            {loading ? '正在同步真实数据...' : '基于系统真实注册与订单流水生成的双轴动态走势'}
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          {/* 图例 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, fontSize: 12 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#475569' }}>
              <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#10b981' }} />
              订阅收入 (¥)
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#475569' }}>
              <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#3b82f6' }} />
              新增用户 (人)
            </span>
          </div>

          {/* 周期切换按钮 */}
          <div style={{ display: 'flex', background: '#f1f5f9', padding: 3, borderRadius: 8, gap: 2 }}>
            {[
              { label: '近 7 天', value: '7' },
              { label: '近 14 天', value: '14' },
              { label: '近 30 天', value: '30' },
            ].map((tab) => (
              <button
                key={tab.value}
                type="button"
                onClick={() => onRangeChange(tab.value)}
                style={{
                  border: 'none',
                  background: timeRange === tab.value ? '#fff' : 'transparent',
                  color: timeRange === tab.value ? '#0f172a' : '#64748b',
                  fontSize: 12,
                  fontWeight: 500,
                  padding: '5px 12px',
                  borderRadius: 6,
                  cursor: 'pointer',
                  boxShadow: timeRange === tab.value ? '0 1px 3px rgba(0,0,0,0.06)' : 'none',
                  transition: 'all 0.15s ease',
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 统计指标卡 */}
      <div ref={summaryContainerRef} style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 16 }}>
        <div style={{ background: '#f8fafc', borderRadius: 12, padding: '12px 16px', border: '1px solid #f1f5f9' }}>
          <div style={{ fontSize: 12, color: '#64748b' }}>所选周期新增用户</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#2563eb', marginTop: 2 }}>
            +{totals.totalUsers} <span style={{ fontSize: 13, fontWeight: 400 }}>人</span>
          </div>
        </div>
        <div style={{ background: '#f8fafc', borderRadius: 12, padding: '12px 16px', border: '1px solid #f1f5f9' }}>
          <div style={{ fontSize: 12, color: '#64748b' }}>所选周期总营收</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#059669', marginTop: 2 }}>
            ¥{totals.totalRevenue.toLocaleString()}
          </div>
        </div>
        <div style={{ background: '#f8fafc', borderRadius: 12, padding: '12px 16px', border: '1px solid #f1f5f9' }}>
          <div style={{ fontSize: 12, color: '#64748b' }}>日均新增用户</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#0f172a', marginTop: 2 }}>
            {(data.length ? totals.totalUsers / data.length : 0).toFixed(1)} <span style={{ fontSize: 13, fontWeight: 400 }}>人/天</span>
          </div>
        </div>
      </div>

      {/* SVG 矢量图表画布 */}
      <div style={{ position: 'relative', width: '100%', overflow: 'hidden' }}>
        <svg
          viewBox={`0 0 ${width} ${height}`}
          style={{ width: '100%', height: 'auto', display: 'block', overflow: 'visible' }}
          onMouseLeave={() => setHoverIndex(null)}
        >
          <defs>
            <linearGradient id="realRevGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10b981" stopOpacity="0.22" />
              <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* 横向背景虚线 */}
          {[0, 0.25, 0.5, 0.75, 1].map((ratio, i) => {
            const y = padding.top + innerH * ratio
            return (
              <line
                key={`grid-line-${i}`}
                x1={padding.left}
                y1={y}
                x2={width - padding.right}
                y2={y}
                stroke="#f1f5f9"
                strokeDasharray="4 4"
              />
            )
          })}

          {/* 渐变面积 */}
          {revArea ? <path ref={areaPathRef} d={revArea} fill="url(#realRevGradient)" style={{ opacity: 0 }} /> : null}

          {/* 收入平滑曲线（初始 opacity: 0 杜绝提前闪烁） */}
          {revLine ? (
            <path
              ref={revPathRef}
              d={revLine}
              fill="none"
              stroke="#10b981"
              strokeWidth="2.5"
              strokeLinecap="round"
              style={{ opacity: 0 }}
            />
          ) : null}

          {/* 用户新增平滑曲线（初始 opacity: 0 杜绝提前闪烁） */}
          {userLine ? (
            <path
              ref={userPathRef}
              d={userLine}
              fill="none"
              stroke="#3b82f6"
              strokeWidth="2.5"
              strokeLinecap="round"
              style={{ opacity: 0 }}
            />
          ) : null}

          {/* X 轴日期 */}
          {data.map((d, i) => {
            if (data.length > 14 && i % 2 !== 0 && i !== data.length - 1) return null
            const x = getX(i)
            return (
              <text
                key={`x-text-${i}`}
                x={x}
                y={height - 10}
                textAnchor="middle"
                fontSize="11"
                fill="#94a3b8"
                fontFamily="inherit"
              >
                {d.date}
              </text>
            )
          })}

          {/* 交互捕捉感应区 */}
          {data.map((d, i) => {
            const x = getX(i)
            const isHovered = hoverIndex === i
            return (
              <g key={`hit-box-${i}`} onMouseEnter={() => setHoverIndex(i)} style={{ cursor: 'pointer' }}>
                <rect
                  x={x - innerW / (data.length * 2 || 1)}
                  y={padding.top}
                  width={Math.max(12, innerW / (data.length || 1))}
                  height={innerH}
                  fill="transparent"
                />

                {isHovered ? (
                  <>
                    <line
                      x1={x}
                      y1={padding.top}
                      x2={x}
                      y2={height - padding.bottom}
                      stroke="#0f172a"
                      strokeWidth="1"
                      strokeDasharray="3 3"
                    />
                    <circle cx={x} cy={getYRev(d.revenue)} r="5.5" fill="#10b981" stroke="#fff" strokeWidth="2" />
                    <circle cx={x} cy={getYUser(d.newUsers)} r="5.5" fill="#3b82f6" stroke="#fff" strokeWidth="2" />
                  </>
                ) : null}
              </g>
            )
          })}
        </svg>

        {/* 悬浮 Tooltip 弹层：首页同款极简高质感白色半透明毛玻璃样式 */}
        {hoverIndex !== null && data[hoverIndex] ? (
          <div
            style={{
              position: 'absolute',
              left: `${(getX(hoverIndex) / width) * 100}%`,
              top: 8,
              transform: 'translateX(-50%)',
              background: 'rgba(255, 255, 255, 0.88)',
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
              border: '1px solid rgba(15, 23, 42, 0.08)',
              padding: '8px 14px',
              borderRadius: 12,
              fontSize: 12,
              pointerEvents: 'none',
              zIndex: 10,
              whiteSpace: 'nowrap',
              boxShadow: '0 8px 24px rgba(15, 23, 42, 0.08), 0 2px 6px rgba(0, 0, 0, 0.03)',
            }}
          >
            <div style={{ color: '#64748b', fontSize: 11, fontWeight: 500, marginBottom: 4 }}>
              {data[hoverIndex].fullDate}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ color: '#059669', fontWeight: 700 }}>¥{data[hoverIndex].revenue.toLocaleString()}</span>
              <span style={{ color: '#cbd5e1' }}>|</span>
              <span style={{ color: '#2563eb', fontWeight: 600 }}>+{data[hoverIndex].newUsers} 位新用户</span>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}

export default function AdminDashboardPage({ onNavigate }) {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [daysRange, setDaysRange] = useState('14')
  const [chartLoading, setChartLoading] = useState(false)

  // 统一拉取后台真实数据（支持时间周期参数）
  useEffect(() => {
    let active = true
    setChartLoading(true)
    adminFetchJson(`/api/admin/dashboard?days=${daysRange}`)
      .then((res) => {
        if (active) {
          setData(res)
          setError('')
        }
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : '加载失败')
      })
      .finally(() => {
        if (active) setChartLoading(false)
      })

    return () => {
      active = false
    }
  }, [daysRange])

  if (error) return <AdminEmptyState title="加载失败" description={error} />
  if (!data) return <div style={{ padding: 24, color: '#64748b' }}>数据加载中...</div>

  const stats = data.stats || {}

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* 1. 顶部核心指标统计卡片 */}
      <section id="dashboard-overview" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 16, scrollMarginTop: 24 }}>
        <StatCard title="总用户数" value={stats.total_users ?? 0} />
        <StatCard title="今日新增用户数" value={stats.today_new_users ?? 0} />
        <StatCard title="当前有效订阅数" value={stats.active_subscriptions ?? 0} />
        <StatCard title="即将到期订阅数" value={stats.expiring_subscriptions_7d ?? 0} hint="未来 7 天内到期" />
        <StatCard title="订单总数" value={stats.total_orders ?? 0} />
        <StatCard title="待处理异常订单数" value={stats.abnormal_orders ?? 0} />
        <StatCard
          title="总营收"
          value={`¥${Number(stats.total_paid_subscription_revenue ?? 0).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          hint="累计已支付订阅订单金额（含已退款订单）"
        />
        <StatCard title="最近后台操作数" value={stats.recent_admin_actions_24h ?? 0} hint="最近 24 小时" />
      </section>

      {/* 2. 真实数据驱动：用户增长与订阅收入 GSAP 动态趋势图 */}
      <GrowthTrendChart
        trendList={data.growth_trends || []}
        timeRange={daysRange}
        onRangeChange={setDaysRange}
        loading={chartLoading}
      />

      {/* 3. 底部详细日志与异常/到期列表 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 16 }}>
        <section id="dashboard-audit" style={{ background: '#fff', borderRadius: 18, padding: 20, border: '1px solid #e2e8f0', scrollMarginTop: 24 }}>
          <h3 style={{ margin: 0, fontSize: 18, color: '#0f172a' }}>最近管理员操作记录</h3>
          <div style={{ marginTop: 16, display: 'grid', gap: 12 }}>
            {(data.recent_audit_logs || []).length ? data.recent_audit_logs.map((item) => (
              <div key={item.id} style={{ paddingBottom: 12, borderBottom: '1px solid #f1f5f9' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                  <strong>{item.admin_user_name}</strong>
                  <span style={{ fontSize: 12, color: '#64748b' }}>{formatDateTime(item.created_at)}</span>
                </div>
                <div style={{ marginTop: 8, color: '#334155' }}>{item.summary}</div>
                <div style={{ marginTop: 6, fontSize: 12, color: '#64748b' }}>{item.reason || '未填写原因'}</div>
              </div>
            )) : <AdminEmptyState title="暂无操作日志" description="关键后台操作会展示在这里。" />}
          </div>
        </section>

        <div style={{ display: 'grid', gap: 16 }}>
          <section id="dashboard-orders" style={{ background: '#fff', borderRadius: 18, padding: 20, border: '1px solid #e2e8f0', scrollMarginTop: 24 }}>
            <h3 style={{ margin: 0, fontSize: 18, color: '#0f172a' }}>异常订单快速列表</h3>
            <div style={{ marginTop: 16, display: 'grid', gap: 12 }}>
              {(data.abnormal_orders || []).length ? data.abnormal_orders.map((item) => (
                <button key={item.id} type="button" onClick={() => onNavigate(`/admin/orders`)} style={{ border: '1px solid #e2e8f0', background: '#fff', borderRadius: 14, padding: 12, textAlign: 'left', cursor: 'pointer' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                    <strong>{item.order_no}</strong>
                    <AdminStatusTag status={item.status}>{item.status}</AdminStatusTag>
                  </div>
                  <div style={{ marginTop: 8, fontSize: 13, color: '#64748b' }}>{item.user_email || '-'} · {formatDateTime(item.created_at)}</div>
                </button>
              )) : <AdminEmptyState title="暂无异常订单" description="支付失败、退款或异常状态的订单会显示在这里。" />}
            </div>
          </section>

          <section id="dashboard-expiring" style={{ background: '#fff', borderRadius: 18, padding: 20, border: '1px solid #e2e8f0', scrollMarginTop: 24 }}>
            <h3 style={{ margin: 0, fontSize: 18, color: '#0f172a' }}>即将到期订阅列表</h3>
            <div style={{ marginTop: 16, display: 'grid', gap: 12 }}>
              {(data.expiring_subscriptions || []).length ? data.expiring_subscriptions.map((item) => (
                <button key={`${item.user_id}-${item.expires_at}`} type="button" onClick={() => onNavigate(`/admin/users/${item.user_id}`)} style={{ border: '1px solid #e2e8f0', background: '#fff', borderRadius: 14, padding: 12, textAlign: 'left', cursor: 'pointer' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                    <strong>{item.email}</strong>
                    <span style={{ fontSize: 12, color: '#b45309', fontWeight: 600 }}>剩余 {item.remaining_days} 天</span>
                  </div>
                  <div style={{ marginTop: 8, fontSize: 13, color: '#64748b' }}>{item.plan_name || '未命名套餐'} · {formatDateTime(item.expires_at)}</div>
                </button>
              )) : <AdminEmptyState title="暂无即将到期订阅" description="未来 7 天内到期的订阅会展示在这里。" />}
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}