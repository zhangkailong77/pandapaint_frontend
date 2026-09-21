import React, { useEffect, useRef, useState } from 'react'

function ProjectCover({ project }) {
  const images = Array.isArray(project.images) ? project.images.slice(0, 4) : []

  if (!images.length) {
    return <div className="empty-inner-block" />
  }

  if (images.length === 1) {
    return <img className="cover-image single-cover-image" src={images[0]} alt={`${project.title} 预览图`} loading="lazy" />
  }

  if (images.length === 2) {
    return (
      <div className="split-two-wrapper">
        {images.map((src, index) => (
          <img key={`${project.id}-cover-${index}`} className="cover-image split-block" src={src} alt={`${project.title} 预览图 ${index + 1}`} loading="lazy" />
        ))}
      </div>
    )
  }

  if (images.length === 3) {
    return (
      <div className="split-three-wrapper">
        <img className="cover-image split-left-main" src={images[0]} alt={`${project.title} 预览图 1`} loading="lazy" />
        <div className="split-right-subs">
          <img className="cover-image sub-block" src={images[1]} alt={`${project.title} 预览图 2`} loading="lazy" />
          <img className="cover-image sub-block" src={images[2]} alt={`${project.title} 预览图 3`} loading="lazy" />
        </div>
      </div>
    )
  }

  return (
    <div className="split-four-wrapper">
      {images.map((src, index) => (
        <img key={`${project.id}-cover-${index}`} className="cover-image grid-cell" src={src} alt={`${project.title} 预览图 ${index + 1}`} loading="lazy" />
      ))}
    </div>
  )
}

export default function UserProjectsPage({
  projects,
  onCreateNewProject,
  onOpenProject,
  onDeleteProject,
  onRenameProject,
  deletingProjectId,
}) {
  const [activeMenuProjectId, setActiveMenuProjectId] = useState(null)
  const [editingProjectId, setEditingProjectId] = useState(null)
  const [editingTitle, setEditingTitle] = useState('')
  const menuRef = useRef(null)
  const clickTimerRef = useRef(null)
  const renameSessionIdRef = useRef(0)
  const renameSubmissionRef = useRef(null)

  useEffect(() => {
    if (!activeMenuProjectId) return undefined

    const handlePointerDown = (event) => {
      if (menuRef.current?.contains(event.target)) return
      setActiveMenuProjectId(null)
    }

    window.addEventListener('pointerdown', handlePointerDown)
    return () => window.removeEventListener('pointerdown', handlePointerDown)
  }, [activeMenuProjectId])

  // 开始重命名
  const handleStartRename = (project, event) => {
    event?.stopPropagation()
    if (clickTimerRef.current) {
      clearTimeout(clickTimerRef.current)
      clickTimerRef.current = null
    }
    setEditingProjectId(project.id)
    setEditingTitle(project.title || '')
    renameSessionIdRef.current += 1
    renameSubmissionRef.current = null
    setActiveMenuProjectId(null)
  }

  // 标题单击处理（等待 240ms 判断是否为双击）
  const handleTitleClick = (project, event) => {
    event.stopPropagation()
    if (clickTimerRef.current) {
      clearTimeout(clickTimerRef.current)
    }
    clickTimerRef.current = setTimeout(() => {
      onOpenProject?.(project)
      clickTimerRef.current = null
    }, 240)
  }

  // 标题双击处理（取消单击跳转，直接进入重命名）
  const handleTitleDoubleClick = (project, event) => {
    event.stopPropagation()
    if (clickTimerRef.current) {
      clearTimeout(clickTimerRef.current)
      clickTimerRef.current = null
    }
    handleStartRename(project, event)
  }

  // 保存重命名
  const handleSaveRename = async (project) => {
    const trimmedTitle = editingTitle.trim()
    if (!trimmedTitle || trimmedTitle === project.title) {
      setEditingProjectId(null)
      renameSubmissionRef.current = null
      return
    }

    const sessionId = renameSessionIdRef.current
    if (renameSubmissionRef.current === sessionId) return
    renameSubmissionRef.current = sessionId

    try {
      if (onRenameProject) {
        await onRenameProject(project, trimmedTitle)
      } else {
        project.title = trimmedTitle
      }
      if (renameSessionIdRef.current === sessionId) {
        setEditingProjectId(null)
        renameSubmissionRef.current = null
      }
    } catch (error) {
      if (renameSessionIdRef.current === sessionId) {
        renameSubmissionRef.current = null
      }
      alert(error instanceof Error ? error.message : '重命名项目失败，请稍后重试。')
    }
  }

  return (
    <>
      <style>{`
        .projects-page {
          display: flex;
          flex-direction: column;
          gap: 32px;
        }

        .viewport-header {
          display: flex;
          flex-direction: column;
        }

        .title-wrapper {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .title-wrapper h1 {
          margin: 0;
          font-size: 24px;
          font-weight: 600;
          letter-spacing: -0.5px;
        }

        .layout-switcher-btn {
          border: 0;
          border-radius: 6px;
          padding: 4px;
          color: #71717a;
          background: transparent;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .layout-switcher-btn:hover {
          background: #f4f4f5;
          color: #18181b;
        }

        .projects-grid-container {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
          gap: 24px;
          align-items: start;
        }

        .card-item {
          display: flex;
          flex-direction: column;
          gap: 10px;
          background: transparent;
          border: none;
          padding: 0;
          text-align: left;
          font-family: inherit;
        }

        .thumbnail-area {
          width: 100%;
          aspect-ratio: 1.6;
          overflow: hidden;
          position: relative;
          border-radius: 12px;
          cursor: pointer;
          transition: transform 0.2s ease, box-shadow 0.2s ease;
        }

        .thumbnail-area:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.06);
        }

        .card-actions {
          position: absolute;
          top: 10px;
          right: 10px;
          z-index: 4;
          opacity: 0;
          pointer-events: none;
          transition: opacity 0.2s ease;
        }

        .card-item:hover .card-actions,
        .card-item:focus-within .card-actions,
        .card-actions.is-open {
          opacity: 1;
          pointer-events: auto;
        }

        .card-menu-trigger {
          width: 30px;
          height: 30px;
          border: none;
          border-radius: 9999px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(255, 255, 255, 0.92);
          color: #18181b;
          cursor: pointer;
          box-shadow: 0 6px 16px rgba(0, 0, 0, 0.12);
          transition: background-color 0.2s ease, transform 0.2s ease;
        }

        .card-menu-trigger:hover {
          background: #ffffff;
          transform: translateY(-1px);
        }

        .card-menu-panel {
          position: absolute;
          top: calc(100% + 8px);
          right: 0;
          min-width: 116px;
          padding: 6px;
          border-radius: 12px;
          border: 1px solid #e4e4e7;
          background: rgba(255, 255, 255, 0.98);
          box-shadow: 0 14px 30px rgba(0, 0, 0, 0.12);
          backdrop-filter: blur(12px);
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .card-menu-item {
          width: 100%;
          border: none;
          border-radius: 8px;
          background: transparent;
          color: #18181b;
          font-size: 12px;
          font-weight: 500;
          text-align: left;
          padding: 8px 12px;
          cursor: pointer;
          transition: background-color 0.15s ease;
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .card-menu-item:hover {
          background: #f4f4f5;
        }

        .card-menu-item.is-danger {
          color: #dc2626;
        }

        .card-menu-item.is-danger:hover {
          background: #fef2f2;
        }

        .card-menu-item:disabled {
          opacity: 0.6;
          cursor: wait;
        }

        .create-project-placeholder .dashed-border {
          display: flex;
          align-items: center;
          justify-content: center;
          border: 1.5px dashed #e4e4e7;
          background: #fafafa;
          height: 100%;
          box-sizing: border-box;
        }

        .create-project-placeholder:hover .dashed-border {
          border-color: #18181b;
          background: #f4f4f5;
        }

        .plus-symbol { color: #a1a1aa; }

        .solid-background {
          border: 1px solid #f1f1f4;
          background: #f4f4f5;
        }

        .empty-inner-block {
          width: 100%;
          height: 100%;
          background: linear-gradient(135deg, #f4f4f5 0%, #e4e4e7 100%);
        }

        .cover-image,
        .split-two-wrapper,
        .split-three-wrapper,
        .split-four-wrapper,
        .split-right-subs {
          width: 100%;
          height: 100%;
        }

        .cover-image {
          display: block;
          object-fit: cover;
          background: #e4e4e7;
        }

        .single-cover-image {
          width: 100%;
          height: 100%;
        }

        .split-two-wrapper,
        .split-three-wrapper {
          display: flex;
          gap: 2px;
        }

        .split-block,
        .sub-block,
        .grid-cell {
          width: 100%;
          height: 100%;
        }

        .split-block { flex: 1; }
        .split-left-main {
          height: 100%;
          width: auto;
          aspect-ratio: 1;
        }

        .split-right-subs {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 2px;
          height: 100%;
        }

        .sub-block {
          flex: 1;
          height: 0;
        }

        .split-four-wrapper {
          display: grid;
          grid-template-columns: 1fr 1fr;
          grid-template-rows: 1fr 1fr;
          gap: 2px;
        }

        .info-area {
          display: flex;
          flex-direction: column;
          gap: 3px;
          padding: 0 2px;
        }

        .title-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 6px;
        }

        .info-area h3 {
          margin: 0;
          font-size: 13px;
          font-weight: 600;
          color: #18181b;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          cursor: pointer;
          flex: 1;
        }

        .info-area h3:hover {
          color: #000000;
          text-decoration: underline;
        }

        .rename-pencil-btn {
          border: none;
          background: transparent;
          padding: 2px 4px;
          border-radius: 4px;
          color: #a1a1aa;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          opacity: 0;
          transition: all 0.15s ease;
        }

        .card-item:hover .rename-pencil-btn {
          opacity: 1;
        }

        .rename-pencil-btn:hover {
          background: #f4f4f5;
          color: #18181b;
        }

        .title-edit-input {
          font-size: 13px;
          font-weight: 600;
          color: #18181b;
          font-family: inherit;
          padding: 3px 8px;
          border: 1.5px solid #18181b;
          border-radius: 6px;
          outline: none;
          width: 100%;
          box-sizing: border-box;
          background: #ffffff;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
        }

        .info-area p {
          margin: 0;
          font-size: 11px;
          color: #71717a;
        }
      `}</style>

      <div className="projects-page">
        <header className="viewport-header">
          <div className="title-wrapper">
            <h1>项目</h1>
            <button className="layout-switcher-btn" type="button" title="切换视图">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            </button>
          </div>
        </header>

        <div className="projects-grid-container">
          <button type="button" className="card-item create-project-placeholder" onClick={onCreateNewProject}>
            <div className="thumbnail-area dashed-border">
              <div className="plus-symbol">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
              </div>
            </div>
            <div className="info-area">
              <div className="title-row">
                <h3>新建项目</h3>
              </div>
              <p>点击开启新的设计</p>
            </div>
          </button>

          {projects.map((project) => {
            const isMenuOpen = activeMenuProjectId === project.id
            const isDeleting = deletingProjectId === project.id
            const isEditing = editingProjectId === project.id

            return (
              <article key={project.id} className="card-item">
                {/* 1. 封面图区域：点击立刻进入工作台 */}
                <div
                  className="thumbnail-area solid-background"
                  onClick={() => onOpenProject?.(project)}
                >
                  <div className={`card-actions ${isMenuOpen ? 'is-open' : ''}`} ref={isMenuOpen ? menuRef : null}>
                    <button
                      type="button"
                      className="card-menu-trigger"
                      aria-label="项目操作"
                      aria-haspopup="menu"
                      aria-expanded={isMenuOpen}
                      onClick={(event) => {
                        event.stopPropagation()
                        setActiveMenuProjectId((current) => (current === project.id ? null : project.id))
                      }}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="5" r="1.5" />
                        <circle cx="12" cy="12" r="1.5" />
                        <circle cx="12" cy="19" r="1.5" />
                      </svg>
                    </button>

                    {isMenuOpen && (
                      <div className="card-menu-panel" role="menu" onClick={(event) => event.stopPropagation()}>
                        <button
                          type="button"
                          className="card-menu-item"
                          onClick={(event) => handleStartRename(project, event)}
                        >
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                          </svg>
                          重命名
                        </button>

                        <button
                          type="button"
                          className="card-menu-item is-danger"
                          disabled={isDeleting}
                          onClick={async (event) => {
                            event.stopPropagation()
                            await onDeleteProject?.(project)
                            setActiveMenuProjectId(null)
                          }}
                        >
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M3 6h18" />
                            <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                            <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                          </svg>
                          {isDeleting ? '删除中...' : '删除项目'}
                        </button>
                      </div>
                    )}
                  </div>
                  <ProjectCover project={project} />
                </div>
                {/* 2. 标题区域：支持双击编辑、悬停铅笔编辑 */}
                <div className="info-area" onClick={(e) => e.stopPropagation()}>
                  {isEditing ? (
                    <input
                      type="text"
                      className="title-edit-input"
                      value={editingTitle}
                      autoFocus
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => setEditingTitle(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          handleSaveRename(project)
                        } else if (e.key === 'Escape') {
                          setEditingProjectId(null)
                        }
                      }}
                      onBlur={() => handleSaveRename(project)}
                    />
                  ) : (
                    <div className="title-row">
                      <h3
                        title="单击打开，双击重命名"
                        onClick={(event) => handleTitleClick(project, event)}
                        onDoubleClick={(event) => handleTitleDoubleClick(project, event)}
                      >
                        {project.title}
                      </h3>
                      <button
                        type="button"
                        className="rename-pencil-btn"
                        title="重命名项目"
                        onClick={(event) => handleStartRename(project, event)}
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                        </svg>
                      </button>
                    </div>
                  )}
                  <p>{project.date}</p>
                </div>
              </article>
            )
          })}
        </div>
      </div>
    </>
  )
}