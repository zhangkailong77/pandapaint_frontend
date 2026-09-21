import React, { useEffect, useState } from 'react'
import { fetchJson } from '../lib/api.js'
import UserHomePage from './UserHomePage.jsx'
import UserProjectsPage from './UserProjectsPage.jsx'
import UserProfilePage from './UserProfilePage.jsx'
import UserSidebar from './UserSidebar.jsx'
import UserSubscriptionPage from './UserSubscriptionPage.jsx'
import UserWalletPage from './UserWalletPage.jsx'

function adaptProject(row) {
  const images = Array.isArray(row.cover_images) ? row.cover_images.filter(Boolean).slice(0, 4) : []
  return {
    id: row.id,
    title: row.title || '未命名',
    date: row.updated_at ? `更新于 ${new Date(row.updated_at).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric', year: 'numeric' })}` : '更新于 刚刚',
    images,
    layout: ['empty', 'single-image', 'two-split', 'three-split', 'four-split'][Math.min(images.length, 4)],
    initial_prompt: row.initial_prompt,
  }
}

export default function UserPage({ userId, routeBase, childRoute, onNavigate, currentUser, onLogout }) {
  const [projects, setProjects] = useState([])
  const [deletingProjectId, setDeletingProjectId] = useState(null)

  useEffect(() => {
    if (childRoute !== 'projects') return undefined
    let active = true
    fetchJson('/api/projects')
      .then((data) => {
        if (!active) return
        setProjects(Array.isArray(data) ? data.map(adaptProject) : [])
      })
      .catch(() => {
        if (!active) return
        setProjects([])
      })
    return () => {
      active = false
    }
  }, [childRoute])

  const handleCreateNewProject = async () => {
    const data = await fetchJson('/api/projects', {
      method: 'POST',
      body: JSON.stringify({ title: '未命名', initial_prompt: '新的项目' }),
    })
    setProjects((current) => [adaptProject(data), ...current])
    onNavigate(`/workbench?projectId=${data.id}`)
  }

  const handleOpenProject = (project) => {
    onNavigate(`/workbench?projectId=${project.id}`)
  }

  const handleRenameProject = async (project, title) => {
    const data = await fetchJson(`/api/projects/${project.id}`, {
      method: 'PUT',
      body: JSON.stringify({ title }),
    })
    const renamedProject = adaptProject(data)
    setProjects((current) => current.map((item) => (item.id === project.id ? renamedProject : item)))
  }

  const handleDeleteProject = async (project) => {
    if (!project?.id) return
    if (!window.confirm(`确定删除项目“${project.title}”吗？删除后无法恢复。`)) return

    setDeletingProjectId(project.id)
    try {
      await fetchJson(`/api/projects/${project.id}`, {
        method: 'DELETE',
      })
      setProjects((current) => current.filter((item) => item.id !== project.id))
    } catch (error) {
      alert(error instanceof Error ? error.message : '删除项目失败，请稍后重试。')
    } finally {
      setDeletingProjectId(null)
    }
  }

  return (
    <main className="user-page" aria-label="个人用户页面" data-user-id={userId}>
      <style>{`
        .user-page {
          display: flex;
          width: 100vw;
          height: 100vh;
          overflow: hidden;
          background: #fff;
          color: #18181b;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
        }

        .content-viewport {
          flex: 1;
          min-width: 0;
          height: 100%;
          padding: 40px 48px;
          overflow-y: auto;
          display: flex;
          flex-direction: column;
          gap: 32px;
          background: linear-gradient(180deg, #ffffff 0%, #fafafa 100%);
        }
      `}</style>

      <UserSidebar routeBase={routeBase} childRoute={childRoute} onNavigate={onNavigate} currentUser={currentUser} />

      <section className="content-viewport">
        {childRoute === 'home' && <UserHomePage onNavigate={(nextChildRoute) => onNavigate(`${routeBase}/${nextChildRoute}`)} currentUser={currentUser} />}

        {childRoute === 'projects' && (
          <UserProjectsPage
            projects={projects}
            onCreateNewProject={handleCreateNewProject}
            onOpenProject={handleOpenProject}
            onDeleteProject={handleDeleteProject}
            onRenameProject={handleRenameProject}
            deletingProjectId={deletingProjectId}
          />
        )}

        {childRoute === 'subscription' && <UserSubscriptionPage onNavigate={(nextChildRoute) => onNavigate(`${routeBase}/${nextChildRoute}`)} />}

        {childRoute === 'wallet' && <UserWalletPage onNavigate={(nextChildRoute) => onNavigate(`${routeBase}/${nextChildRoute}`)} />}

        {childRoute === 'profile' && (
          <UserProfilePage
            userId={userId}
            currentUser={currentUser}
            onLogout={onLogout}
            onNavigate={(nextChildRoute) => onNavigate(`${routeBase}/${nextChildRoute}`)}
          />
        )}
      </section>
    </main>
  )
}
