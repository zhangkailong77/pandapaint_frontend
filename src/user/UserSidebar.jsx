import React, { useState } from 'react'
import logoImg from '../public/image/logo/logo-1.png'
import UserNotificationsPopover from './UserNotificationsPopover'

export default function UserSidebar({ routeBase, childRoute, onNavigate, currentUser }) {
  const [isNoticeOpen, setIsNoticeOpen] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0) // 接收自 Popover 的未读数

  const navigateTo = (nextChildRoute) => onNavigate(`${routeBase}/${nextChildRoute}`)
  const isProjects = childRoute === 'projects'
  const isProfile = childRoute === 'profile'
  const isSubscription = childRoute === 'subscription'
  const isWallet = childRoute === 'wallet'

  return (
    <aside className="sidebar-container">
      <style>{`
        .sidebar-container {
          width: 72px;
          min-width: 72px;
          height: 100%;
          padding: 24px 0;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: space-between;
          background: #fff;
          border-right: 1px solid #f4f4f5;
          flex-shrink: 0;
          position: relative;
        }

        .sidebar-top {
          width: 100%;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 32px;
        }

        .logo-wrapper {
          width: 70px;
          height: 70px;
          border: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          background: transparent;
          cursor: pointer;
          transition: transform 0.15s ease, opacity 0.15s ease;
        }

        .logo-wrapper:hover { opacity: 0.8; }
        .logo-wrapper:active { transform: scale(0.95); }

        .logo-wrapper img {
          width: 100%;
          height: 100%;
          object-fit: contain;
        }

        .nav-group {
          width: 100%;
          display: flex;
          flex-direction: column;
          gap: 16px;
          padding: 0 8px;
        }

        .nav-button-item {
          width: 100%;
          aspect-ratio: 1;
          border: 0;
          border-radius: 10px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 4px;
          color: #71717a;
          background: transparent;
          cursor: pointer;
          transition: all 0.2s ease;
          padding: 6px 0;
        }

        .nav-button-item:hover,
        .nav-button-item.is-active {
          background: #f4f4f5;
          color: #18181b;
        }

        .nav-text { font-size: 10px; font-weight: 500; }

        .sidebar-bottom {
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .notification-icon-button {
          width: 40px;
          height: 40px;
          border: 0;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #71717a;
          background: transparent;
          cursor: pointer;
          position: relative;
          transition: background-color 0.2s, color 0.2s, transform 0.15s ease;
        }

        .notification-icon-button:hover,
        .notification-icon-button.is-active {
          background: #f4f4f5;
          color: #18181b;
        }

        .notification-icon-button:active {
          transform: scale(0.92);
        }

        /* 🔴 醒目的红色未读气泡/数字徽标 */
        .sidebar-unread-badge {
          position: absolute;
          top: 2px;
          right: 2px;
          min-width: 16px;
          height: 16px;
          padding: 0 4px;
          background-color: #ef4444;
          color: #ffffff;
          border-radius: 10px;
          font-size: 10px;
          font-weight: 700;
          line-height: 16px;
          text-align: center;
          border: 2px solid #ffffff;
          box-shadow: 0 2px 5px rgba(239, 68, 68, 0.4);
          pointer-events: none;
          box-sizing: border-box;
          display: flex;
          align-items: center;
          justify-content: center;
          animation: badgePop 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
        }

        @keyframes badgePop {
          0% { transform: scale(0); }
          100% { transform: scale(1); }
        }
      `}</style>

      <div className="sidebar-top">
        <button type="button" className="logo-wrapper" onClick={() => navigateTo('home')} title="回到首页">
          <img src={logoImg} alt="PandaPaint Logo" />
        </button>

        <nav className="nav-group">
          <button className={`nav-button-item ${isProjects ? 'is-active' : ''}`} onClick={() => navigateTo('projects')} title="项目">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z" />
            </svg>
            <span className="nav-text">项目</span>
          </button>

          <button className={`nav-button-item ${isSubscription ? 'is-active' : ''}`} onClick={() => navigateTo('subscription')} title="订阅中心">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 6h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1Z" />
              <path d="M3 10h18" />
              <path d="M8 14h.01" />
              <path d="M12 14h4" />
            </svg>
            <span className="nav-text">订阅</span>
          </button>

          <button className={`nav-button-item ${isWallet ? 'is-active' : ''}`} onClick={() => navigateTo('wallet')} title="我的积分">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2v20" />
              <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7H14.5a3.5 3.5 0 0 1 0 7H6" />
            </svg>
            <span className="nav-text">积分</span>
          </button>

          <button className={`nav-button-item ${isProfile ? 'is-active' : ''}`} onClick={() => navigateTo('profile')} title="个人主页">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
            <span className="nav-text">个人主页</span>
          </button>
        </nav>
      </div>

      <div className="sidebar-bottom">
        <button
          className={`notification-icon-button ${isNoticeOpen ? 'is-active' : ''}`}
          onClick={() => setIsNoticeOpen((prev) => !prev)}
          title="系统通知"
        >
          {/* Lucide 铃铛图标 */}
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
            <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
          </svg>

          {/* 🔴 当未读数 > 0 时显示红色提示气泡 */}
          {unreadCount > 0 && (
            <span className="sidebar-unread-badge">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>
      </div>

      {/* 挂载独立的通知弹窗 */}
      <UserNotificationsPopover
        isOpen={isNoticeOpen}
        onClose={() => setIsNoticeOpen(false)}
        onUnreadChange={setUnreadCount}
        currentUser={currentUser}
      />
    </aside>
  )
}