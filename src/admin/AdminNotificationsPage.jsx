import React, { useState, useEffect } from 'react'
import { adminFetchJson, formatDateTime } from './adminShared.js'

function mapNotice(item) {
  return {
    ...item,
    target: item.target || (item.target_type === 'user' ? 'specific' : item.target_type),
    targetUserId: item.targetUserId ?? item.target_user_id,
    sender: item.sender || item.target_user_email || '-',
    createdAt: item.createdAt || item.created_at,
  }
}

export default function AdminNotificationsPage() {
  const [notices, setNotices] = useState([])
  const [searchQuery, setSearchQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [revokingId, setRevokingId] = useState(null)
  const [actionMessage, setActionMessage] = useState('')
  const [loadError, setLoadError] = useState('')

  // 新建通知表单状态
  const [formData, setFormData] = useState({
    title: '',
    type: 'system',
    target: 'all',
    targetUserId: '',
    content: '',
  })

  useEffect(() => {
    adminFetchJson('/api/admin/notifications')
      .then((data) => setNotices(Array.isArray(data?.items) ? data.items.map(mapNotice) : []))
      .catch((err) => setLoadError(err instanceof Error ? err.message : '通知列表加载失败'))
  }, [])

  // 发布通知
  const handleCreateSubmit = async (e) => {
    e.preventDefault()
    if (!formData.title.trim() || !formData.content.trim()) {
      alert('请填写完整的标题和通知内容！')
      return
    }
    if (formData.target === 'specific' && !/^\d+$/.test(formData.targetUserId.trim())) {
      alert('请输入有效的目标用户 ID！')
      return
    }

    setSubmitting(true)
    try {
      const newNotice = await adminFetchJson('/api/admin/notifications', {
        method: 'POST',
        body: JSON.stringify({
          title: formData.title.trim(),
          type: formData.type,
          target: formData.target,
          target_user_id: formData.target === 'specific' ? Number(formData.targetUserId) : null,
          content: formData.content.trim(),
        }),
      })
      setNotices((prev) => [mapNotice(newNotice), ...prev])
      setIsCreateModalOpen(false)
      setFormData({ title: '', type: 'system', target: 'all', targetUserId: '', content: '' })
      setActionMessage('通知发布成功！')
      setTimeout(() => setActionMessage(''), 3000)
    } catch (err) {
      alert(err instanceof Error ? err.message : '发布失败')
    } finally {
      setSubmitting(false)
    }
  }

  // 撤回通知
  const handleDeleteNotice = async (id) => {
    if (!window.confirm('确定要撤回这条通知吗？')) return
    setRevokingId(id)
    try {
      const updatedNotice = await adminFetchJson(`/api/admin/notifications/${id}/revoke`, {
        method: 'POST',
      })
      const mappedNotice = mapNotice(updatedNotice)
      setNotices((prev) => prev.map((item) => (item.id === id ? { ...item, ...mappedNotice } : item)))
      setActionMessage('通知已撤回')
      setTimeout(() => setActionMessage(''), 3000)
    } catch (err) {
      alert(err instanceof Error ? err.message : '撤回失败')
    } finally {
      setRevokingId(null)
    }
  }

  // 筛选过滤
  const filteredNotices = notices.filter((item) => {
    const matchesSearch =
      item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.content.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesType = typeFilter === 'all' || item.type === typeFilter
    return matchesSearch && matchesType
  })
  const weekStart = new Date()
  weekStart.setHours(0, 0, 0, 0)
  weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1)
  const weeklyCount = notices.filter((item) => item.createdAt && new Date(item.createdAt) >= weekStart).length

  return (
    <div className="admin-notifications-page">
      <style>{`
        .admin-notifications-page {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        /* 顶部操作与概览 */
        .notice-stats-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 16px;
        }

        .notice-stat-card {
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          padding: 16px 20px;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .stat-card-label {
          font-size: 13px;
          color: #64748b;
          font-weight: 500;
        }

        .stat-card-value {
          font-size: 24px;
          font-weight: 700;
          color: #0f172a;
        }

        /* 主体操作栏 */
        .notice-toolbar {
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          padding: 16px 20px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          flex-wrap: wrap;
        }

        .toolbar-left {
          display: flex;
          align-items: center;
          gap: 12px;
          flex: 1;
        }

        .notice-search-input {
          padding: 8px 14px;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          font-size: 13px;
          width: 260px;
          outline: none;
          transition: border-color 0.15s;
        }

        .notice-search-input:focus {
          border-color: #0f172a;
        }

        .notice-type-select {
          padding: 8px 12px;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          font-size: 13px;
          background: #ffffff;
          color: #334155;
          outline: none;
          cursor: pointer;
        }

        .publish-btn {
          background: #0f172a;
          color: #ffffff;
          border: none;
          border-radius: 8px;
          padding: 9px 18px;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 6px;
          transition: background 0.15s;
        }

        .publish-btn:hover {
          background: #1e293b;
        }

        /* 表格区域 */
        .notice-table-container {
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          overflow: hidden;
        }

        .admin-table {
          width: 100%;
          border-collapse: collapse;
          text-align: left;
          font-size: 13px;
        }

        .admin-table th {
          background: #f8fafc;
          padding: 12px 16px;
          font-weight: 600;
          color: #475569;
          border-bottom: 1px solid #e2e8f0;
        }

        .admin-table td {
          padding: 14px 16px;
          border-bottom: 1px solid #f1f5f9;
          color: #334155;
          vertical-align: top;
        }

        .admin-table tr:last-child td {
          border-bottom: none;
        }

        .admin-table tr:hover td {
          background: #f8fafc;
        }

        .notice-title-cell {
          display: flex;
          flex-direction: column;
          gap: 4px;
          max-width: 320px;
        }

        .notice-title-text {
          font-weight: 600;
          color: #0f172a;
        }

        .notice-desc-text {
          font-size: 12px;
          color: #64748b;
          line-height: 1.4;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .type-pill {
          display: inline-block;
          padding: 3px 8px;
          border-radius: 6px;
          font-size: 11px;
          font-weight: 600;
        }

        .type-pill.system { background: #eff6ff; color: #2563eb; }
        .type-pill.reward { background: #fef3c7; color: #d97706; }
        .type-pill.maintenance { background: #fee2e2; color: #dc2626; }

        .target-tag {
          font-size: 12px;
          color: #475569;
          background: #f1f5f9;
          padding: 2px 6px;
          border-radius: 4px;
        }

        .table-action-btn {
          background: transparent;
          border: none;
          color: #ef4444;
          font-size: 12px;
          cursor: pointer;
          padding: 4px 8px;
          border-radius: 4px;
        }

        .table-action-btn:hover {
          background: #fee2e2;
        }

        /* 弹窗样式 */
        .modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(15, 23, 42, 0.4);
          backdrop-filter: blur(2px);
          z-index: 1000;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
        }

        .modal-card {
          background: #ffffff;
          width: 100%;
          max-width: 540px;
          border-radius: 16px;
          box-shadow: 0 20px 40px rgba(0, 0, 0, 0.12);
          overflow: hidden;
          display: flex;
          flex-direction: column;
        }

        .modal-header {
          padding: 18px 24px;
          border-bottom: 1px solid #f1f5f9;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .modal-header h3 {
          margin: 0;
          font-size: 16px;
          font-weight: 700;
          color: #0f172a;
        }

        .modal-close-btn {
          border: none;
          background: transparent;
          font-size: 18px;
          cursor: pointer;
          color: #94a3b8;
        }

        .modal-form {
          padding: 24px;
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .form-item {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .form-item label {
          font-size: 13px;
          font-weight: 600;
          color: #334155;
        }

        .form-input, .form-textarea, .form-select {
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          padding: 10px 12px;
          font-size: 13px;
          color: #0f172a;
          outline: none;
        }

        .form-input:focus, .form-textarea:focus, .form-select:focus {
          border-color: #0f172a;
        }

        .form-textarea {
          resize: vertical;
          min-height: 100px;
          line-height: 1.5;
        }

        .modal-footer {
          padding: 16px 24px;
          border-top: 1px solid #f1f5f9;
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: 12px;
          background: #f8fafc;
        }

        .cancel-btn {
          background: #ffffff;
          border: 1px solid #e2e8f0;
          padding: 8px 16px;
          border-radius: 8px;
          font-size: 13px;
          cursor: pointer;
          color: #475569;
        }

        .toast-msg {
          background: #10b981;
          color: #ffffff;
          padding: 8px 16px;
          border-radius: 8px;
          font-size: 13px;
          font-weight: 500;
          margin-bottom: 12px;
        }
      `}</style>

      {/* 提示消息 */}
      {actionMessage && <div className="toast-msg">{actionMessage}</div>}
      {loadError && <div className="toast-msg" style={{ background: '#ef4444' }}>{loadError}</div>}

      {/* 统计指标 */}
      <div className="notice-stats-grid">
        <div className="notice-stat-card">
          <span className="stat-card-label">已发布通知</span>
          <span className="stat-card-value">{notices.length}</span>
        </div>
        <div className="notice-stat-card">
          <span className="stat-card-label">全员系统公告</span>
          <span className="stat-card-value">{notices.filter((n) => n.type === 'system').length}</span>
        </div>
        <div className="notice-stat-card">
          <span className="stat-card-label">活动与奖励通知</span>
          <span className="stat-card-value">{notices.filter((n) => n.type === 'reward').length}</span>
        </div>
        <div className="notice-stat-card">
          <span className="stat-card-label">本周新增</span>
          <span className="stat-card-value">{weeklyCount}</span>
        </div>
      </div>

      {/* 工具栏 */}
      <div className="notice-toolbar">
        <div className="toolbar-left">
          <input
            type="text"
            className="notice-search-input"
            placeholder="搜索通知标题或正文内容..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <select
            className="notice-type-select"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
          >
            <option value="all">全部分类</option>
            <option value="system">系统升级 / 公告</option>
            <option value="reward">积分 / 活动提醒</option>
            <option value="maintenance">维护停机</option>
          </select>
        </div>

        <button className="publish-btn" onClick={() => setIsCreateModalOpen(true)}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          发布新通知
        </button>
      </div>

      {/* 通知列表表格 */}
      <div className="notice-table-container">
        <table className="admin-table">
          <thead>
            <tr>
              <th>通知标题与内容</th>
              <th>类型</th>
              <th>推送对象</th>
              <th>发布人</th>
              <th>发布时间</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {filteredNotices.length > 0 ? (
              filteredNotices.map((item) => (
                <tr key={item.id}>
                  <td>
                    <div className="notice-title-cell">
                      <span className="notice-title-text">{item.title}</span>
                      <span className="notice-desc-text">{item.content}</span>
                    </div>
                  </td>
                  <td>
                    <span className={`type-pill ${item.type}`}>
                      {item.type === 'system' ? '系统公告' : item.type === 'reward' ? '活动奖励' : '维护通知'}
                    </span>
                  </td>
                  <td>
                    <span className="target-tag">
                      {item.target === 'all' ? '全体用户' : `用户 #${item.targetUserId}`}
                    </span>
                  </td>
                  <td>{item.sender}</td>
                  <td>{formatDateTime(item.createdAt)}</td>
                  <td>
                      <button className="table-action-btn" disabled={revokingId === item.id || item.status === 'revoked'} onClick={() => handleDeleteNotice(item.id)}>
                        {item.status === 'revoked' ? '已撤回' : revokingId === item.id ? '撤回中...' : '撤回'}
                      </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="6" style={{ textAlign: 'center', padding: '32px', color: '#94a3b8' }}>
                  未搜索到相关通知
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* 发布通知弹窗 */}
      {isCreateModalOpen && (
        <div className="modal-overlay" onClick={() => setIsCreateModalOpen(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>发布新系统通知</h3>
              <button className="modal-close-btn" onClick={() => setIsCreateModalOpen(false)}>×</button>
            </div>
            <form onSubmit={handleCreateSubmit} className="modal-form">
              <div className="form-item">
                <label>通知标题 *</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="例如：系统版本升级公告 (v2.5.0)"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="form-item">
                  <label>通知类型</label>
                  <select
                    className="form-select"
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                  >
                    <option value="system">系统公告</option>
                    <option value="reward">积分 / 活动奖励</option>
                    <option value="maintenance">维护停机</option>
                  </select>
                </div>

                <div className="form-item">
                  <label>推送受众</label>
                  <select
                    className="form-select"
                    value={formData.target}
                    onChange={(e) => setFormData({ ...formData, target: e.target.value })}
                  >
                    <option value="all">全站所有用户</option>
                    <option value="specific">指定用户</option>
                  </select>
                </div>
              </div>

              {formData.target === 'specific' && (
                <div className="form-item">
                  <label>目标用户 ID</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="输入用户 ID（如 1002）"
                    value={formData.targetUserId}
                    onChange={(e) => setFormData({ ...formData, targetUserId: e.target.value })}
                    required
                  />
                </div>
              )}

              <div className="form-item">
                <label>通知详情正文 *</label>
                <textarea
                  className="form-textarea"
                  placeholder="请输入通知详细说明内容..."
                  value={formData.content}
                  onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                  required
                />
              </div>

              <div className="modal-footer">
                <button type="button" className="cancel-btn" onClick={() => setIsCreateModalOpen(false)}>
                  取消
                </button>
                <button type="submit" className="publish-btn" disabled={submitting}>
                  {submitting ? '发布中...' : '确认发布'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}