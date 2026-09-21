import React, { useState, useRef, useEffect, useMemo } from 'react'
import gsap from 'gsap'
import { fetchJson } from '../lib/api.js'

function mapNotification(item) {
  return {
    ...item,
    unread: item.unread ?? !item.is_read,
    time: item.time || item.created_at,
  }
}

export default function UserNotificationsPopover({ isOpen, onClose, onUnreadChange, currentUser }) {
  const [notifications, setNotifications] = useState([])
  const [activeTab, setActiveTab] = useState('all')
  const [loading, setLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [actionLoading, setActionLoading] = useState(false)
  const [serverUnreadCount, setServerUnreadCount] = useState(0)
  
  const panelRef = useRef(null)
  const backdropRef = useRef(null)
  const timelineRef = useRef(null)

  const unreadCount = useMemo(() => notifications.filter((n) => n.unread).length, [notifications])

  useEffect(() => {
    onUnreadChange?.(serverUnreadCount)
  }, [serverUnreadCount, onUnreadChange])

  useEffect(() => {
    if (!currentUser?.id) {
      setServerUnreadCount(0)
      setNotifications([])
      return undefined
    }

    let active = true
    fetchJson('/api/user/notifications')
      .then((data) => {
        if (!active) return
        setNotifications(Array.isArray(data?.items) ? data.items.map(mapNotification) : [])
        setServerUnreadCount(Number(data?.unread_count ?? 0))
      })
      .catch(() => {
        if (!active) return
        setServerUnreadCount(0)
      })

    return () => {
      active = false
    }
  }, [currentUser?.id])

  useEffect(() => {
    if (!isOpen || !currentUser?.id) return
    setLoading(true)
    setErrorMessage('')
    fetchJson('/api/user/notifications')
      .then((data) => {
        setNotifications(Array.isArray(data?.items) ? data.items.map(mapNotification) : [])
        setServerUnreadCount(Number(data?.unread_count ?? 0))
      })
      .catch((err) => setErrorMessage(err instanceof Error ? err.message : '通知加载失败'))
      .finally(() => setLoading(false))
  }, [isOpen, currentUser?.id])

  // 初始化设置
  useEffect(() => {
    gsap.set(panelRef.current, {
      autoAlpha: 0,
      scale: 0.15,
      transformOrigin: '0% 100%', // 精确左下角
      force3D: true,
    })
    gsap.set(backdropRef.current, {
      autoAlpha: 0,
    })
  }, [])

  // 弹性抖动展开 / 快速收缩动画
  useEffect(() => {
    if (timelineRef.current) {
      timelineRef.current.kill()
    }

    const tl = gsap.timeline()
    timelineRef.current = tl

    if (isOpen) {
      // 展开：背部遮罩淡入 + 主卡片从左下角往右上回弹抖动展开
      tl.to(backdropRef.current, {
        autoAlpha: 1,
        duration: 0.28,
        ease: 'power2.out',
      }, 0)
      .fromTo(
        panelRef.current,
        {
          autoAlpha: 0,
          scale: 0.15,
        },
        {
          autoAlpha: 1,
          scale: 1,
          duration: 0.45,
          ease: 'back.out(1.3)', // 保留生动的弹性微回弹
          force3D: true,
        },
        0
      )
    } else {
      // 收起：快速利落回缩
      tl.to(backdropRef.current, {
        autoAlpha: 0,
        duration: 0.18,
        ease: 'power2.in',
      }, 0)
      .to(
        panelRef.current,
        {
          autoAlpha: 0,
          scale: 0.35,
          duration: 0.2,
          ease: 'power2.inOut',
          force3D: true,
        },
        0
      )
    }
  }, [isOpen])

  const handleMarkAllRead = async () => {
    if (actionLoading || serverUnreadCount === 0) return
    setActionLoading(true)
    try {
      const data = await fetchJson('/api/user/notifications/read-all', { method: 'POST' })
      setNotifications((prev) => prev.map((n) => ({ ...n, unread: false })))
      setServerUnreadCount(Number(data?.unread_count ?? 0))
      setErrorMessage('')
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : '全部已读失败')
    } finally {
      setActionLoading(false)
    }
  }

  const handleItemClick = async (id) => {
    const item = notifications.find((notification) => notification.id === id)
    if (!item || !item.unread || actionLoading) return
    setActionLoading(true)
    try {
      const data = await fetchJson(`/api/user/notifications/${id}/read`, { method: 'POST' })
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, unread: false } : n)))
      setServerUnreadCount(Number(data?.unread_count ?? 0))
      setErrorMessage('')
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : '标记已读失败')
    } finally {
      setActionLoading(false)
    }
  }

  const filteredList = notifications.filter((item) => {
    if (activeTab === 'unread') return item.unread
    if (activeTab === 'system') return item.type === 'system'
    return true
  })

  return (
    <>
      <style>{`
        .notice-backdrop {
          position: fixed;
          inset: 0;
          z-index: 998;
          background: rgba(0, 0, 0, 0.12);
          pointer-events: ${isOpen ? 'auto' : 'none'};
        }

        .notice-popover-card {
          position: fixed;
          left: 88px;
          bottom: 24px;
          width: 700px;
          height: 550px;
          max-height: calc(100vh - 48px);
          background: #ffffff;
          border: 1px solid #e4e4e7;
          border-radius: 24px;
          box-shadow: 0 20px 48px rgba(0, 0, 0, 0.12), 0 4px 16px rgba(0, 0, 0, 0.04);
          z-index: 999;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          pointer-events: ${isOpen ? 'auto' : 'none'};
          
          /* 核心 GPU 硬件加速属性 */
          transform: translateZ(0);
          backface-visibility: hidden;
          -webkit-backface-visibility: hidden;
          will-change: transform, opacity;
        }

        .notice-header {
          padding: 20px 24px 16px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          border-bottom: 1px solid #f4f4f5;
        }

        .notice-title-box {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .notice-title-box h3 {
          font-size: 17px;
          font-weight: 700;
          color: #18181b;
          margin: 0;
          letter-spacing: -0.3px;
        }

        .notice-count-badge {
          background: #18181b;
          color: #ffffff;
          font-size: 11px;
          font-weight: 600;
          padding: 2px 8px;
          border-radius: 9999px;
        }

        .notice-header-tools {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .notice-read-all-btn {
          background: transparent;
          border: none;
          color: #71717a;
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          padding: 4px 8px;
          border-radius: 6px;
          transition: all 0.15s;
        }

        .notice-read-all-btn:hover {
          background: #f4f4f5;
          color: #18181b;
        }

        .notice-close-btn {
          width: 28px;
          height: 28px;
          border-radius: 50%;
          border: none;
          background: #f4f4f5;
          color: #71717a;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.15s;
        }

        .notice-close-btn:hover {
          background: #e4e4e7;
          color: #18181b;
        }

        .notice-tabs-row {
          display: flex;
          gap: 8px;
          padding: 12px 24px;
          border-bottom: 1px solid #f4f4f5;
          background: #fafafa;
        }

        .notice-tab-pill {
          background: transparent;
          border: none;
          font-size: 13px;
          font-weight: 500;
          color: #71717a;
          padding: 6px 14px;
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.15s;
        }

        .notice-tab-pill:hover {
          color: #18181b;
        }

        .notice-tab-pill.is-active {
          background: #ffffff;
          color: #18181b;
          font-weight: 600;
          box-shadow: 0 2px 6px rgba(0, 0, 0, 0.05);
        }

        .notice-scroll-list {
          flex: 1;
          overflow-y: auto;
          padding: 16px 20px;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .notice-scroll-list::-webkit-scrollbar {
          width: 5px;
        }

        .notice-scroll-list::-webkit-scrollbar-thumb {
          background: #e4e4e7;
          border-radius: 4px;
        }

        .notice-card-item {
          padding: 16px;
          border-radius: 16px;
          background: #ffffff;
          border: 1px solid #f4f4f5;
          transition: border-color 0.15s, background-color 0.15s;
          cursor: pointer;
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .notice-card-item:hover {
          border-color: #e4e4e7;
          background: #fafafa;
        }

        .notice-card-item.is-unread {
          background: #ffffff;
        }

        .notice-item-meta {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .notice-item-title {
          font-size: 14px;
          font-weight: 600;
          color: #18181b;
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .notice-unread-indicator {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: #ef4444;
          flex-shrink: 0;
        }

        .notice-item-time {
          font-size: 12px;
          color: #a1a1aa;
        }

        .notice-item-body {
          font-size: 13px;
          line-height: 1.55;
          color: #52525b;
          margin: 0;
        }

        .notice-empty-state {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          color: #a1a1aa;
          gap: 12px;
          font-size: 14px;
        }
      `}</style>

      {/* 遮罩 */}
      <div ref={backdropRef} className="notice-backdrop" onClick={onClose} />

      {/* 弹窗主体 */}
      <div ref={panelRef} className="notice-popover-card">
        <div className="notice-header">
          <div className="notice-title-box">
            <h3>系统通知</h3>
            {serverUnreadCount > 0 && <span className="notice-count-badge">{serverUnreadCount}</span>}
          </div>
          <div className="notice-header-tools">
            {serverUnreadCount > 0 && (
              <button className="notice-read-all-btn" onClick={handleMarkAllRead} disabled={actionLoading}>
                全部已读
              </button>
            )}
            <button className="notice-close-btn" onClick={onClose} title="关闭">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        </div>

        <div className="notice-tabs-row">
          <button className={`notice-tab-pill ${activeTab === 'all' ? 'is-active' : ''}`} onClick={() => setActiveTab('all')}>
            全部
          </button>
          <button className={`notice-tab-pill ${activeTab === 'unread' ? 'is-active' : ''}`} onClick={() => setActiveTab('unread')}>
            未读 ({serverUnreadCount})
          </button>
          <button className={`notice-tab-pill ${activeTab === 'system' ? 'is-active' : ''}`} onClick={() => setActiveTab('system')}>
            系统公告
          </button>
        </div>

        <div className="notice-scroll-list">
          {errorMessage && <div className="notice-empty-state">{errorMessage}</div>}
          {loading ? (
            <div className="notice-empty-state">加载中...</div>
          ) : filteredList.length > 0 ? (
            filteredList.map((item) => (
              <div
                key={item.id}
                className={`notice-card-item ${item.unread ? 'is-unread' : ''}`}
                onClick={() => handleItemClick(item.id)}
              >
                <div className="notice-item-meta">
                  <span className="notice-item-title">
                    {item.unread && <span className="notice-unread-indicator" />}
                    {item.title}
                  </span>
                  <span className="notice-item-time">{item.time}</span>
                </div>
                <p className="notice-item-body">{item.content}</p>
              </div>
            ))
          ) : (
            <div className="notice-empty-state">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                <path d="M13.73 21a2 2 0 0 1-3.46 0" />
              </svg>
              <span>暂无相关通知</span>
            </div>
          )}
        </div>
      </div>
    </>
  )
}