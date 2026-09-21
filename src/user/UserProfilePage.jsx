import React, { useEffect, useMemo, useState } from 'react'
import gsap from 'gsap'
import { fetchJson } from '../lib/api.js'

export default function UserProfilePage({ userId, currentUser, onLogout, onNavigate }) {
  const [activeTab, setActiveTab] = useState('profile')
  const [subscriptionData, setSubscriptionData] = useState(null)
  const [walletData, setWalletData] = useState(null)

  const emailPrefix = currentUser?.email?.split('@')[0]?.trim() || ''
  const resolvedName = currentUser?.display_name?.trim() || emailPrefix || '未命名用户'
  const avatarSource = resolvedName || emailPrefix || 'U'

  useEffect(() => {
    let active = true
    Promise.all([
      fetchJson('/api/subscription-plans'),
      fetchJson('/api/user/wallet'),
    ])
      .then(([subscriptionRes, walletRes]) => {
        if (!active) return
        setSubscriptionData(subscriptionRes?.current_subscription || null)
        setWalletData(walletRes || null)
      })
      .catch(() => {
        if (!active) return
        setSubscriptionData(null)
        setWalletData(null)
      })

    return () => {
      active = false
    }
  }, [])

  const userData = useMemo(() => ({
    id: currentUser?.id ?? userId ?? '2632',
    name: resolvedName,
    email: currentUser?.email || '-',
    avatar: avatarSource.charAt(0).toUpperCase(),
    handle: emailPrefix ? `@${emailPrefix}` : '@user',
    credits: {
      remaining: walletData ? `${walletData.credit_amount || 0}` : '加载中',
      total: walletData ? `余额 ${walletData.balance_amount || '0.00'}` : '后续开放统计',
    },
    apiRequests: subscriptionData?.status === 'active' ? '订阅已生效' : '未开通订阅',
    plan: subscriptionData?.plan_name || '月度订阅待开通',
    joinDate: '2026年7月1日',
  }), [avatarSource, currentUser, emailPrefix, resolvedName, subscriptionData, userId, walletData])

  // 寻找真实产生滚动的父级容器
  const getScrollContainer = (node) => {
    if (!node) return window
    let parent = node.parentElement
    while (parent) {
      const { overflowY } = window.getComputedStyle(parent)
      if ((overflowY === 'auto' || overflowY === 'scroll') && parent.scrollHeight > parent.clientHeight) {
        return parent
      }
      parent = parent.parentElement
    }
    return window
  }

  // GSAP 阻尼滑动到顶部
  const handleScrollToSection = (sectionId) => {
    setActiveTab(sectionId)
    const element = document.getElementById(sectionId)
    const sidebar = document.querySelector('.profile-sidebar') // 获取左侧侧边栏
    if (!element) return

    // 获取左侧侧边栏顶部距离视口的绝对位置，保持两者完全齐平
    const sidebarTop = sidebar ? sidebar.getBoundingClientRect().top : 24
    const container = getScrollContainer(element)

    if (container === window || container === document.documentElement || container === document.body) {
      const currentScroll = window.scrollY || document.documentElement.scrollTop || document.body.scrollTop
      // 计算差值：让 element 的顶部对齐 sidebar 的顶部
      const targetScroll = currentScroll + (element.getBoundingClientRect().top - sidebarTop)

      const scrollProxy = { y: currentScroll }
      gsap.killTweensOf(scrollProxy)
      gsap.to(scrollProxy, {
        y: targetScroll,
        duration: 0.85,
        ease: 'power3.out',
        onUpdate: () => {
          window.scrollTo(0, scrollProxy.y)
          document.documentElement.scrollTop = scrollProxy.y
          document.body.scrollTop = scrollProxy.y
        },
      })
    } else {
      const currentScroll = container.scrollTop
      const targetScroll = currentScroll + (element.getBoundingClientRect().top - sidebarTop)

      const scrollProxy = { y: currentScroll }
      gsap.killTweensOf(scrollProxy)
      gsap.to(scrollProxy, {
        y: targetScroll,
        duration: 0.85,
        ease: 'power3.out',
        onUpdate: () => {
          container.scrollTop = scrollProxy.y
        },
      })
    }
  }

  return (
    <>
      <style>{`
        .profile-layout {
          display: flex;
          gap: 48px;
          width: 100%;
          box-sizing: border-box;
          padding: 24px 0;
        }

        .profile-sidebar {
          width: 240px;
          flex-shrink: 0;
          display: flex;
          flex-direction: column;
          gap: 6px;
          position: sticky;
          top: 24px;
          height: fit-content;
        }

        .sidebar-title {
          font-size: 12px;
          font-weight: 600;
          color: #a1a1aa;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          padding: 0 12px 8px 12px;
        }

        .nav-tab-btn {
          display: flex;
          align-items: center;
          gap: 12px;
          width: 100%;
          padding: 10px 12px;
          border: none;
          background: transparent;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 500;
          color: #71717a;
          cursor: pointer;
          text-align: left;
          transition: all 0.2s ease;
        }

        .nav-tab-btn:hover {
          background: #f4f4f5;
          color: #18181b;
        }

        .nav-tab-btn.active {
          background: #f4f4f5;
          color: #18181b;
          font-weight: 600;
        }

        .profile-main-content {
          flex-grow: 1;
          display: flex;
          flex-direction: column;
          gap: 48px;
          padding-bottom: 60vh;
        }

        .profile-section-group {
          display: flex;
          flex-direction: column;
          gap: 24px;
          scroll-margin-top: 24px;
        }

        .content-card {
          background: #ffffff;
          border: 1px solid #e4e4e7;
          border-radius: 12px;
          padding: 24px;
        }

        .profile-merged-card {
          padding: 0;
          background: #ffffff;
          border: 1px solid #e4e4e7;
          border-radius: 16px;
          overflow: hidden;
        }

        .profile-top-row {
          display: flex;
          align-items: center;
          gap: 24px;
          padding: 32px 32px 28px 32px;
        }

        .profile-large-avatar {
          width: 72px;
          height: 72px;
          border-radius: 50%;
          background: #8b5cf6;
          color: #ffffff;
          font-size: 26px;
          font-weight: 600;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .profile-main-info {
          display: flex;
          flex-direction: column;
          gap: 10px;
          flex: 1;
          min-width: 0;
        }

        .profile-name-line {
          display: flex;
          align-items: center;
          gap: 12px;
          flex-wrap: wrap;
        }

        .profile-username {
          font-size: 24px;
          font-weight: 700;
          color: #18181b;
          letter-spacing: -0.5px;
        }

        .profile-role-tag {
          font-size: 12px;
          color: #71717a;
          font-weight: 500;
        }

        .profile-id-link {
          font-size: 12px;
          font-weight: 600;
          color: #0066cc;
        }

        .profile-sub-meta {
          display: flex;
          align-items: center;
          gap: 10px;
          font-size: 13px;
          color: #71717a;
          flex-wrap: wrap;
        }

        .profile-account-actions {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: 10px;
        }

        .logout-button,
        .ghost-button {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 10px 16px;
          border: 1px solid #e4e4e7;
          border-radius: 999px;
          background: #ffffff;
          color: #18181b;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition: background 0.2s ease, border-color 0.2s ease, color 0.2s ease;
        }

        .logout-button:hover,
        .ghost-button:hover {
          background: #f4f4f5;
          border-color: #d4d4d8;
        }

        .divider-dot {
          color: #d4d4d8;
        }

        .vip-tag {
          font-weight: 500;
          color: #71717a;
        }

        .profile-stats-grid {
          display: grid;
          grid-template-columns: 1fr 1fr 1fr;
          border-top: 1px solid #f4f4f5;
        }

        .stat-col {
          padding: 24px 32px;
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .stat-col:not(:last-child) {
          border-right: 1px solid #f4f4f5;
        }

        .stat-label {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 13px;
          font-weight: 500;
          color: #71717a;
        }

        .stat-value {
          font-size: 28px;
          font-weight: 700;
          color: #18181b;
          line-height: 1.1;
          margin-top: 4px;
        }

        .stat-sub {
          font-size: 12px;
          color: #a1a1aa;
        }

        .plan-badge {
          display: inline-flex;
          align-items: center;
          padding: 4px 10px;
          background: #f4f4f5;
          border: 1px solid #e4e4e7;
          border-radius: 9999px;
          font-size: 12px;
          font-weight: 500;
          color: #18181b;
        }

        .status-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: #10b981;
          margin-right: 6px;
        }

        .cta-button {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 10px 16px;
          background: #18181b;
          color: #ffffff;
          border: none;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: background 0.2s ease;
        }

        .cta-button:hover {
          background: #27272a;
        }

        .setting-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 12px 0;
          border-bottom: 1px solid #f4f4f5;
        }

        .setting-row:last-child {
          border-bottom: none;
        }

        .setting-info h4 {
          margin: 0 0 2px 0;
          font-size: 14px;
          font-weight: 500;
          color: #18181b;
        }

        .setting-info p {
          margin: 0;
          font-size: 12px;
          color: #71717a;
        }

        .select-input {
          padding: 6px 12px;
          border: 1px solid #e4e4e7;
          border-radius: 6px;
          font-size: 13px;
          color: #18181b;
          background: #ffffff;
          cursor: pointer;
        }

        .select-input:focus {
          outline: none;
          border-color: #18181b;
        }

        @media (max-width: 768px) {
          .profile-layout {
            flex-direction: column;
            gap: 24px;
          }

          .profile-sidebar {
            width: 100%;
            flex-direction: row;
            overflow-x: auto;
            position: static;
          }

          .sidebar-title {
            display: none;
          }

          .profile-top-row {
            flex-direction: column;
            align-items: flex-start;
          }

          .profile-stats-grid {
            grid-template-columns: 1fr;
          }

          .stat-col:not(:last-child) {
            border-right: none;
            border-bottom: 1px solid #f4f4f5;
          }
        }
      `}</style>

      <div className="profile-layout">
        <aside className="profile-sidebar">
          <span className="sidebar-title">设置中心</span>
          <button type="button" className={`nav-tab-btn ${activeTab === 'profile' ? 'active' : ''}`} onClick={() => handleScrollToSection('profile')}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
            个人资料与配额
          </button>
          <button type="button" className={`nav-tab-btn ${activeTab === 'subscription' ? 'active' : ''}`} onClick={() => handleScrollToSection('subscription')}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="5" width="20" height="14" rx="2" ry="2" />
              <line x1="2" y1="10" x2="22" y2="10" />
            </svg>
            订阅与计划
          </button>
          <button type="button" className={`nav-tab-btn ${activeTab === 'settings' ? 'active' : ''}`} onClick={() => handleScrollToSection('settings')}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
            系统偏好设置
          </button>
        </aside>

        <main className="profile-main-content">
          <section id="profile" className="profile-section-group">
            <div className="profile-merged-card">
              <div className="profile-top-row">
                <div className="profile-large-avatar">{userData.avatar}</div>
                <div className="profile-main-info">
                  <div className="profile-name-line">
                    <span className="profile-username">{userData.name}</span>
                    <span className="profile-role-tag">用户</span>
                    <span className="profile-id-link">用户 ID {userData.id}</span>
                  </div>
                  <div className="profile-sub-meta">
                    <span>{userData.handle}</span>
                    <span className="divider-dot">•</span>
                    <span>{userData.email}</span>
                    <span className="divider-dot">•</span>
                    <span className="vip-tag">{subscriptionData?.status === 'active' ? '订阅已生效' : '订阅能力已开放'}</span>
                  </div>
                </div>
                <div className="profile-account-actions">
                  <button type="button" className="ghost-button" onClick={() => onNavigate?.('wallet')}>查看积分</button>
                  <button type="button" className="logout-button" onClick={onLogout}>退出登录</button>
                </div>
              </div>

              <div className="profile-stats-grid">
                <div className="stat-col">
                  <div className="stat-label">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="2" y="4" width="20" height="16" rx="2" />
                      <line x1="12" y1="4" x2="12" y2="20" />
                    </svg>
                    当前余额
                  </div>
                  <div className="stat-value">{userData.credits.remaining}</div>
                  <div className="stat-sub">{userData.credits.total}</div>
                </div>

                <div className="stat-col">
                  <div className="stat-label">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="18" y1="20" x2="18" y2="10" />
                      <line x1="12" y1="20" x2="12" y2="4" />
                      <line x1="6" y1="20" x2="6" y2="14" />
                    </svg>
                    当前订阅
                  </div>
                  <div className="stat-value">{userData.plan}</div>
                  <div className="stat-sub">{subscriptionData?.expires_at ? `到期时间 ${new Date(subscriptionData.expires_at).toLocaleDateString('zh-CN')}` : '支持升级到更高档位套餐'}</div>
                </div>

                <div className="stat-col">
                  <div className="stat-label">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
                    </svg>
                    使用状态
                  </div>
                  <div className="stat-value">{userData.apiRequests}</div>
                  <div className="stat-sub">更多统计后续逐步开放</div>
                </div>
              </div>
            </div>
          </section>

          <section id="subscription" className="profile-section-group">
            <div className="content-card" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <h3 className="card-title">当前订阅方案</h3>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                <div>
                  <div className="plan-badge" style={{ marginBottom: '10px' }}>
                    <span className="status-dot" />
                    {userData.plan}
                  </div>
                  <p style={{ margin: 0, fontSize: '13px', color: '#71717a' }}>
                    当前系统支持按月订阅，一次性发放积分，若已有订阅仅允许升级到更高档位。
                  </p>
                </div>
                <button type="button" className="cta-button" onClick={() => onNavigate?.('subscription')}>
                  打开订阅中心
                </button>
              </div>
            </div>
          </section>

          <section id="settings" className="profile-section-group">
            <div className="content-card">
              <h3 className="card-title">工作偏好设置</h3>

              <div className="setting-row">
                <div className="setting-info">
                  <h4>界面主题外观</h4>
                  <p>切换工作室控制台明暗色风格</p>
                </div>
                <select className="select-input" defaultValue="light">
                  <option value="light">浅色模式 (Light)</option>
                  <option value="dark">深色模式 (Dark)</option>
                  <option value="system">跟随系统</option>
                </select>
              </div>

              <div className="setting-row">
                <div className="setting-info">
                  <h4>默认图片导出格式</h4>
                  <p>设置画板中导出图片时的默认编码</p>
                </div>
                <select className="select-input" defaultValue="png">
                  <option value="png">PNG (无损压缩)</option>
                  <option value="jpg">JPEG (高兼容性)</option>
                  <option value="webp">WebP (高压缩比)</option>
                </select>
              </div>

              <div className="setting-row">
                <div className="setting-info">
                  <h4>开发者 API Key 凭证</h4>
                  <p>第三方软件及集成脚本调用接口时使用</p>
                </div>
                <button type="button" className="select-input" style={{ background: '#fafafa' }}>
                  生成新凭证密钥
                </button>
              </div>
            </div>
          </section>
        </main>
      </div>
    </>
  )
}