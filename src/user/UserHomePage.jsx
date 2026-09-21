import React, { useEffect, useMemo, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import logoImg from '../public/image/logo/logo-1.png'
import promptsLibrary from '../public/prompts-library.json'
import { getAttachmentValidationError, saveLaunchAttachments } from '../workbench/attachments.js'
import { GPT_IMAGE_MODEL, GPT_IMAGE_MODELS } from '../imageModels.js'

function fetchJson(path, options = {}) {
  return fetch(path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
    credentials: 'include',
  }).then(async (response) => {
    const data = await response.json().catch(() => ({}))
    if (!response.ok) {
      throw new Error(data.detail || data.message || '请求失败')
    }
    return data
  })
}

const RECENT_PROJECTS = [
  { id: 'recent-1', title: 'Untitled', date: '更新于 Jul 1, 2026', layout: 'empty' },
  { id: 'recent-2', title: 'Untitled', date: '更新于 Jun 29, 2026', layout: 'four-split', colors: ['#0f4c81', '#1f5f8b', '#2d7296', '#3b85a1'] },
  { id: 'recent-3', title: 'Untitled', date: '更新于 Jun 28, 2026', layout: 'single-image', color: '#a71d32' },
  { id: 'recent-4', title: 'Untitled', date: '更新于 Mar 6, 2026', layout: 'four-split', colors: ['#0d1b2a', '#1b263b', '#415a77', '#778da9'] },
]

const PREFIX = '让 PandaPaint '
const TYPING_PHRASES = [
  '让 PandaPaint 设计一张极简风格的咖啡馆开业海报...',
  '让 PandaPaint 渲染一个可爱的 3D 黏土风盲盒公仔...',
  '让 PandaPaint 生成一张雨夜赛博朋克街头的电影感大片...',
  '让 PandaPaint 绘制一幅充满魔法气息的童话森林插画...',
  '让 PandaPaint 构思一款未来感智能手表的 UI 界面...',
]
const PROMPT_COLUMN_COUNT = 5
const HOME_RATIOS = [
  { label: '自适应', value: 'auto', icon: '▢' },
  { label: '1:1', value: '1:1', icon: '▢' },
  { label: '9:16', value: '9:16', icon: '▯' },
  { label: '16:9', value: '16:9', icon: '▭' },
  { label: '3:4', value: '3:4', icon: '▯' },
  { label: '4:3', value: '4:3', icon: '▭' },
  { label: '3:2', value: '3:2', icon: '▭' },
  { label: '2:3', value: '2:3', icon: '▯' },
  { label: '4:5', value: '4:5', icon: '▯' },
  { label: '5:4', value: '5:4', icon: '▭' },
  { label: '21:9', value: '21:9', icon: '▭' },
]
const HOME_COUNTS = [1, 2, 4]
const HOME_MODELS = GPT_IMAGE_MODELS

function getPromptImageUrl(value) {
  if (!value || typeof value !== 'string') return ''
  const filename = value.split('/').pop()
  if (!filename) return ''
  return new URL(`../public/prompts/${filename}`, import.meta.url).href
}

function normalizePromptText(value) {
  return typeof value === 'string' ? value.trim() : ''
}

function getPrimaryPrompt(item) {
  return normalizePromptText(item.promptZh) || normalizePromptText(item.promptEn)
}

function normalizePromptItem(item, index) {
  const promptZh = normalizePromptText(item?.prompt?.zh)
  const promptEn = normalizePromptText(item?.prompt?.en)
  const tags = Array.isArray(item?.tags) && item.tags.length
    ? item.tags.filter(Boolean)
    : Array.isArray(item?.style)
      ? item.style.filter(Boolean).slice(0, 8)
      : []

  return {
    id: String(item?.id || index),
    title: item?.title || '未命名提示词',
    subtitle: item?.subtitle || '',
    image: getPromptImageUrl(item?.coverImage || item?.images?.[0]?.url || ''),
    promptZh,
    promptEn,
    primaryPrompt: promptZh || promptEn,
    aspectRatio: item?.aspectRatio || '4:5',
    category: item?.category || '',
    summary: item?.summary || '',
    useCase: item?.useCase || '',
    tags,
    source: item?.metadata?.source || item?.source || '未知来源',
    model: item?.metadata?.model || '',
    originUrl: item?.metadata?.originUrl || '',
  }
}

function matchesPromptItem(item, query) {
  if (!query) return true
  const normalizedQuery = query.trim().toLowerCase()
  if (!normalizedQuery) return true

  return [
    item.title,
    item.subtitle,
    item.promptZh,
    item.promptEn,
    item.category,
    item.summary,
    item.useCase,
    item.source,
    item.model,
    ...item.tags,
  ].some((value) => String(value || '').toLowerCase().includes(normalizedQuery))
}

function splitIntoColumns(items, columnCount) {
  return Array.from({ length: columnCount }, (_, columnIndex) => items.filter((_, index) => index % columnCount === columnIndex))
}

function isPortraitAspectRatio(value) {
  if (typeof value !== 'string') return false
  const [width, height] = value.split(':').map(Number)
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return false
  return height > width
}

export default function UserHomePage({ onNavigate, currentUser }) {
  const [inputText, setInputText] = useState('')
  const [projects, setProjects] = useState(RECENT_PROJECTS)
  const [searchQuery, setSearchQuery] = useState('')
  const [activeModal, setActiveModal] = useState(null)
  const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false)
  const [isParamsPopoverOpen, setIsParamsPopoverOpen] = useState(false)
  const [ratio, setRatio] = useState('auto')
  const [count, setCount] = useState(1)
  const [selectedModel, setSelectedModel] = useState(GPT_IMAGE_MODEL)
  const [currentPlaceholder, setCurrentPlaceholder] = useState('')
  const [phraseIndex, setPhraseIndex] = useState(0)
  const [isDeleting, setIsDeleting] = useState(false)
  const [visiblePromptIds, setVisiblePromptIds] = useState({})
  const [attachments, setAttachments] = useState([])
  const [attachmentError, setAttachmentError] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const [pendingProject, setPendingProject] = useState(null)
  const [isDragging, setIsDragging] = useState(false)
  const textareaRef = useRef(null)
  const attachmentInputRef = useRef(null)
  const attachmentPreviewsRef = useRef([])
  const inputCardRef = useRef(null)
  const promptCardRefs = useRef(new Map())

  const promptLibraryItems = useMemo(
    () => (Array.isArray(promptsLibrary?.items) ? promptsLibrary.items.map(normalizePromptItem).filter((item) => item.image && item.primaryPrompt) : []),
    []
  )

  const filteredColumns = useMemo(() => {
    const filteredItems = promptLibraryItems.filter((item) => matchesPromptItem(item, searchQuery))
    return splitIntoColumns(filteredItems, PROMPT_COLUMN_COUNT)
  }, [promptLibraryItems, searchQuery])

  useEffect(() => {
    const textarea = textareaRef.current
    if (!textarea) return
    textarea.style.height = 'auto'
    textarea.style.height = `${textarea.scrollHeight}px`
  }, [inputText])

  useEffect(() => {
    const typingSpeed = isDeleting ? 25 : 60
    const currentPhrase = TYPING_PHRASES[phraseIndex]

    if (!isDeleting && currentPlaceholder === currentPhrase) {
      const timeout = setTimeout(() => setIsDeleting(true), 1000)
      return () => clearTimeout(timeout)
    }

    if (isDeleting && currentPlaceholder.length <= PREFIX.length) {
      setIsDeleting(false)
      setPhraseIndex((prev) => (prev + 1) % TYPING_PHRASES.length)
      return undefined
    }

    const timeout = setTimeout(() => {
      setCurrentPlaceholder(
        isDeleting
          ? currentPhrase.substring(0, currentPlaceholder.length - 1)
          : currentPhrase.substring(0, currentPlaceholder.length + 1)
      )
    }, typingSpeed)

    return () => clearTimeout(timeout)
  }, [currentPlaceholder, isDeleting, phraseIndex])

  useEffect(() => {
    if (!filteredColumns.flat().length) return undefined

    if (typeof window === 'undefined' || !('IntersectionObserver' in window)) {
      setVisiblePromptIds((current) => {
        const next = { ...current }
        let hasChange = false

        filteredColumns.flat().forEach((item) => {
          if (!next[item.id]) {
            next[item.id] = true
            hasChange = true
          }
        })

        return hasChange ? next : current
      })
      return undefined
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return
          const promptId = entry.target.getAttribute('data-prompt-id')
          if (!promptId) return

          setVisiblePromptIds((current) => {
            if (current[promptId]) return current
            return {
              ...current,
              [promptId]: true,
            }
          })

          observer.unobserve(entry.target)
        })
      },
      {
        threshold: 0.18,
        rootMargin: '0px 0px -8% 0px',
      }
    )

    promptCardRefs.current.forEach((node) => {
      if (node) observer.observe(node)
    })

    return () => observer.disconnect()
  }, [filteredColumns])

  useEffect(() => {
    return () => {
      attachmentPreviewsRef.current.forEach((preview) => URL.revokeObjectURL(preview))
    }
  }, [])

  async function createProjectFromPrompt(promptText, title = '未命名') {
    const initialPrompt = normalizePromptText(promptText)
    if (!initialPrompt) return

    const projectTitle = Array.from(title.trim() || '未命名')
    const truncatedTitle = projectTitle.length > 120
      ? `${projectTitle.slice(0, 119).join('')}…`
      : projectTitle.join('')

    const data = await fetchJson('/api/projects', {
      method: 'POST',
      body: JSON.stringify({ title: truncatedTitle, initial_prompt: initialPrompt }),
    })

    const newProject = {
      id: data.id,
      title: data.title,
      date: '更新于 刚刚',
      layout: 'single-image',
      color: '#4f46e5',
    }

    setProjects((current) => [newProject, ...current.slice(0, 3)])
    return { id: data.id, initialPrompt }
  }

  const handleAddAttachments = (fileList) => {
    const files = Array.from(fileList || [])
    const validationError = getAttachmentValidationError(files, attachments.map((attachment) => attachment.file))
    if (validationError) {
      setAttachmentError(validationError)
      return
    }
    if (!files.length) return

    const nextAttachments = files.map((file) => ({
      id: `${file.name}-${file.size}-${file.lastModified}-${Math.random().toString(36).slice(2, 7)}`,
      file,
      preview: URL.createObjectURL(file),
    }))
    attachmentPreviewsRef.current.push(...nextAttachments.map((attachment) => attachment.preview))
    setAttachments((current) => [...current, ...nextAttachments])
    setAttachmentError('')
  }

  const handleRemoveAttachment = (id) => {
    setAttachments((current) => {
      const attachment = current.find((item) => item.id === id)
      if (attachment) {
        URL.revokeObjectURL(attachment.preview)
        attachmentPreviewsRef.current = attachmentPreviewsRef.current.filter((preview) => preview !== attachment.preview)
      }
      return current.filter((item) => item.id !== id)
    })
  }

  const handleDragOver = (e) => {
    e.preventDefault()
    e.stopPropagation()
  }

  const handleDragEnter = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }

  const handleDragLeave = (e) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.currentTarget.contains(e.relatedTarget)) return
    setIsDragging(false)
  }

  const handleDrop = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
    if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
      handleAddAttachments(e.dataTransfer.files)
    }
  }

  const navigateToProject = async (project) => {
    await saveLaunchAttachments(project.id, attachments.map((attachment) => attachment.file))
    setPendingProject(null)
    const launchParams = new URLSearchParams({ projectId: project.id, launchPrompt: project.initialPrompt, launchCount: String(count), launchModel: selectedModel })
    if (ratio !== 'auto') launchParams.set('launchRatio', ratio)
    flushSync(() => setInputText(''))
    window.location.assign(`/workbench?${launchParams}`)
  }

  const handleCreateNewProject = async () => {
    if (isCreating) return
    setIsCreating(true)
    setAttachmentError('')
    try {
      let project = pendingProject
      if (!project) {
        project = await createProjectFromPrompt(inputText, inputText.trim() || '未命名')
        setPendingProject(project)
      }
      await navigateToProject(project)
    } catch (err) {
      const message = err instanceof Error ? err.message : '创建项目失败，请重试。'
      setAttachmentError(message)
    } finally {
      setIsCreating(false)
    }
  }

  // 键盘回车发送处理
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      // 正在使用中文输入法选词时按 Enter，不触发发送
      if (e.nativeEvent.isComposing) return
      
      e.preventDefault()
      if (inputText.trim() && !isCreating) {
        handleCreateNewProject()
      }
    }
  }

  const handleCopyPrompt = async (promptText) => {
    const text = normalizePromptText(promptText)
    if (!text) return

    try {
      await navigator.clipboard.writeText(text)
      alert('提示词已复制到剪贴板！')
    } catch (err) {
      console.error('Failed to copy: ', err)
    }
  }

  const handleApplyPrompt = (promptText) => {
    const text = normalizePromptText(promptText)
    if (!text) return
    setInputText(text)
    setActiveModal(null)
    window.setTimeout(() => {
      inputCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      window.setTimeout(() => {
        textareaRef.current?.focus({ preventScroll: true })
      }, 320)
    }, 220)
  }

  return (
    <main className="user-home-page" aria-label="空白个人首页">
      <style>{`
        .user-home-page {
          flex: 1;
          height: 100%;
          background-color: #ffffff;
          color: #18181b;
          overflow-y: auto;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
          position: relative;
          display: flex;
          flex-direction: column;
          padding: 0 48px;
          box-sizing: border-box;
        }

        .center-hero-section {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          margin-top: 120px;
          margin-bottom: 180px;
          width: 100%;
        }

        .brand-headline {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 8px;
        }

        .headline-logo {
          width: 68px;
          height: 68px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .headline-logo img {
          width: 100%;
          height: 100%;
          object-fit: contain;
        }

        .brand-headline h1 {
          font-size: 32px;
          font-weight: 700;
          margin: 0;
          letter-spacing: -0.5px;
        }

        .brand-subtext {
          font-size: 18px;
          color: #a1a1aa;
          margin: 0 0 48px 0;
        }

        .ai-input-card {
          width: 100%;
          max-width: 940px;
          min-height: 200px;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          background-color: #ffffff;
          border: 1px solid #e4e4e7;
          border-radius: 24px;
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.02);
          padding: 20px 24px;
          gap: 12px;
          transition: border-color 0.2s, box-shadow 0.2s, background-color 0.2s;
          position: relative;
          z-index: 10;
        }

        .ai-input-card:focus-within {
          border-color: #cbd5e1;
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.04);
        }

        .ai-input-card.is-dragging {
          border-color: #18181b;
          background-color: #fafafa;
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.06);
        }

        .ai-textarea {
          width: 100%;
          border: none;
          outline: none;
          resize: none;
          font-size: 17px;      
          line-height: 1.6;
          color: #18181b;
          padding: 0;
          background-color: transparent;
          flex: 1;
          min-height: 90px;
          max-height: 240px;
          overflow-y: auto;
        }

        .ai-textarea::placeholder {
          color: #a1a1aa;
        }

        .home-attachment-previews {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-bottom: 4px;
        }

        .home-attachment-preview {
          position: relative;
          width: 64px;
          height: 64px;
          border-radius: 12px;
          overflow: hidden;
          background: #f4f4f5;
        }

        .home-attachment-preview img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
        }

        .home-attachment-remove {
          position: absolute;
          top: 4px;
          right: 4px;
          width: 18px;
          height: 18px;
          padding: 0;
          border: 0;
          border-radius: 50%;
          color: #ffffff;
          background: rgba(24, 24, 27, 0.76);
          cursor: pointer;
          line-height: 16px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 12px;
        }

        .home-attachment-error {
          margin: 0;
          color: #dc2626;
          font-size: 12px;
        }

        .ai-card-footer {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-top: 4px;
        }

        .footer-left-tools,
        .footer-right-tools {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .tool-btn {
          background: transparent;
          border: none;
          cursor: pointer;
          color: #71717a;
          padding: 4px;
          border-radius: 6px;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: background-color 0.15s, color 0.15s;
        }

        .tool-btn:hover {
          background-color: #f4f4f5;
          color: #18181b;
        }

        .submit-btn {
          background-color: #f4f4f5;
          color: #a1a1aa;
          border: none;
          border-radius: 50%;
          width: 28px;
          height: 28px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: background-color 0.15s, color 0.15s;
        }

        .submit-btn.has-content {
          background-color: #18181b;
          color: #ffffff;
        }

        .model-selector-wrapper {
          position: relative;
        }

        .home-generation-params {
          position: relative;
        }

        .home-generation-params-trigger {
          display: flex;
          align-items: center;
          gap: 5px;
          background: transparent;
          border: none;
          border-radius: 6px;
          padding: 6px 8px;
          color: #71717a;
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
        }

        .home-generation-params-trigger:hover,
        .home-generation-params-trigger.is-active {
          background: #f4f4f5;
          color: #18181b;
        }

        .home-generation-params-popover {
          position: absolute;
          top: calc(100% + 8px);
          left: 0;
          width: 320px;
          padding: 18px;
          border: 1px solid rgba(255, 255, 255, 0.6);
          border-radius: 24px;
          background: rgba(245, 245, 247, 0.82);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          box-shadow: 0 12px 32px rgba(0, 0, 0, 0.12);
          z-index: 50;
          transform-origin: top left;
          animation: popIn 0.2s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }

        .home-generation-params-section + .home-generation-params-section {
          margin-top: 16px;
        }

        .home-generation-params-title {
          margin-bottom: 10px;
          color: #71717a;
          font-size: 13px;
          font-weight: 500;
        }

        .home-generation-ratio-grid {
          display: grid;
          grid-template-columns: repeat(5, 1fr);
          gap: 8px;
        }

        .home-generation-ratio-btn,
        .home-generation-count-btn {
          border: none;
          border-radius: 14px;
          background: rgba(0, 0, 0, 0.06);
          color: #1c1c1e;
          cursor: pointer;
          font-size: 12px;
          transition: all 0.15s ease;
        }

        .home-generation-ratio-btn {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 4px;
          padding: 8px 2px;
        }

        .home-generation-ratio-btn.is-active,
        .home-generation-count-btn.is-active {
          background: #ffffff;
          color: #000000;
          font-weight: 600;
          box-shadow: 0 3px 8px rgba(0, 0, 0, 0.12);
        }

        .home-generation-ratio-icon {
          font-size: 18px;
          line-height: 1;
        }

        .home-generation-count-row {
          display: flex;
          gap: 8px;
        }

        .home-generation-count-btn {
          flex: 1;
          padding: 10px 12px;
        }

        .home-generation-backdrop {
          position: fixed;
          inset: 0;
          z-index: 40;
        }

        .model-select-trigger {
          display: flex;
          align-items: center;
          gap: 6px;
          background-color: transparent;
          border: none;
          border-radius: 6px;
          padding: 6px 8px;
          font-size: 13px;
          font-weight: 500;
          color: #71717a;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .model-select-trigger:hover {
          background-color: #f4f4f5;
          color: #18181b;
        }

        .trigger-icon {
          display: flex;
          align-items: center;
        }

        .trigger-chevron {
          margin-left: 2px;
          opacity: 0.8;
        }

        .dropdown-backdrop {
          position: fixed;
          inset: 0;
          z-index: 40;
        }

        .model-dropdown-menu {
          position: absolute;
          top: 100%;
          left: 0;
          margin-top: 12px;
          width: 340px;
          background-color: #ffffff;
          border: 1px solid #e4e4e7;
          border-radius: 16px;
          box-shadow: 0 12px 36px rgba(0, 0, 0, 0.12);
          z-index: 50;
          padding: 8px 0;
          animation: popIn 0.2s cubic-bezier(0.16, 1, 0.3, 1) forwards;
          transform-origin: top left;
        }

        @keyframes popIn {
          from { opacity: 0; transform: scale(0.96) translateY(-4px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }

        .dropdown-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 8px 16px 12px;
          border-bottom: 1px solid #f4f4f5;
          margin-bottom: 4px;
        }

        .dropdown-header span {
          font-size: 13px;
          color: #71717a;
          font-weight: 500;
        }

        .dropdown-header a {
          font-size: 13px;
          color: #71717a;
          text-decoration: underline;
          cursor: pointer;
        }

        .dropdown-header a:hover {
          color: #18181b;
        }

        .dropdown-item {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          padding: 12px 16px;
          cursor: pointer;
          transition: background 0.2s;
        }

        .dropdown-item:hover {
          background-color: #f4f4f5;
        }

        .item-icon-wrapper {
          margin-top: 2px;
          color: #18181b;
        }

        .item-text {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .item-title {
          font-size: 14px;
          font-weight: 600;
          color: #18181b;
        }

        .item-desc {
          font-size: 12px;
          color: #71717a;
          line-height: 1.4;
        }

        .item-check {
          color: #18181b;
          margin-top: 4px;
        }

        .prompts-section-container {
          margin-top: auto;
          margin-bottom: 64px;
          width: 100%;
        }

        .prompts-header {
          display: flex;
          justify-content: flex-start;
          align-items: center;
          gap: 16px;
          margin-bottom: 24px;
          flex-wrap: wrap;
        }

        .prompts-header h2 {
          font-size: 16px;
          font-weight: 600;
          margin: 0;
          color: #18181b;
        }

        .prompts-search-bar {
          position: relative;
          display: flex;
          align-items: center;
          width: 240px;
          height: 36px;
          background-color: #ffffff;
          border: 1px solid #e4e4e7;
          border-radius: 9999px;
          padding-left: 16px;
          padding-right: 4px;
          box-sizing: border-box;
          transition: border-color 0.2s, box-shadow 0.2s;
        }

        .prompts-search-input {
          width: 100%;
          border: none;
          outline: none;
          background: transparent;
          font-size: 13px;
          color: #18181b;
          padding: 0;
        }

        .prompts-search-btn {
          width: 28px;
          height: 28px;
          border-radius: 50%;
          background-color: #f4f4f5;
          color: #71717a;
          border: none;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          flex-shrink: 0;
        }

        .prompts-result-summary {
          width: 100%;
          font-size: 12px;
          color: #71717a;
          margin-top: -8px;
        }

        .prompts-empty-state {
          border: 1px dashed #e4e4e7;
          border-radius: 16px;
          padding: 40px 24px;
          text-align: center;
          color: #71717a;
          background-color: #fafafa;
        }

        .prompts-columns-wrapper {
          display: flex;
          gap: 20px;
          width: 100%;
          align-items: flex-start;
        }

        .prompts-vertical-col {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 20px;
          min-width: 0;
        }

        .prompt-gallery-card {
          display: flex;
          flex-direction: column;
          background-color: #ffffff;
          border: 1px solid #e4e4e7;
          border-radius: 16px;
          overflow: hidden;
          width: 100%;
          opacity: 0;
          transform: translateY(32px);
          transition: opacity 0.6s ease, transform 0.6s cubic-bezier(0.22, 1, 0.36, 1), box-shadow 0.2s ease;
          will-change: opacity, transform;
        }

        .prompt-gallery-card.is-visible {
          opacity: 1;
          transform: translateY(0);
        }

        .prompt-gallery-card:hover {
          transform: translateY(-4px);
          box-shadow: 0 12px 30px rgba(0, 0, 0, 0.08);
        }

        .prompt-img-wrapper {
          width: 100%;
          background-color: #f4f4f5;
          position: relative;
          overflow: hidden;
        }

        .prompt-img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
          transition: transform 0.3s;
        }

        .prompt-gallery-card:hover .prompt-img {
          transform: scale(1.03);
        }

        .hover-overlay-mask {
          position: absolute;
          inset: 0;
          background-color: rgba(0, 0, 0, 0.35);
          display: flex;
          align-items: center;
          justify-content: center;
          opacity: 0;
          transition: opacity 0.25s ease;
          z-index: 2;
        }

        .prompt-gallery-card:hover .hover-overlay-mask {
          opacity: 1;
        }

        .view-details-btn {
          background-color: #ffffff;
          color: #18181b;
          border: none;
          border-radius: 24px;
          padding: 10px 20px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
          transform: translateY(10px);
          transition: transform 0.25s ease, background-color 0.2s;
        }

        .prompt-gallery-card:hover .view-details-btn {
          transform: translateY(0);
        }

        .view-details-btn:hover {
          background-color: #f4f4f5;
        }

        .prompt-meta-area {
          padding: 16px;
          display: flex;
          flex-direction: column;
          gap: 10px;
          border-top: 1px solid #f4f4f5;
          background-color: #ffffff;
          cursor: default;
        }

        .prompt-card-title {
          font-size: 14px;
          font-weight: 600;
          color: #18181b;
          margin: 0;
        }

        .prompt-card-summary {
          font-size: 12px;
          line-height: 1.5;
          color: #71717a;
          margin: 0;
        }

        .prompt-tag-list {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
        }

        .prompt-badge {
          font-size: 11px;
          font-weight: 500;
          color: #71717a;
          background-color: #f4f4f5;
          padding: 3px 8px;
          border-radius: 6px;
        }

        .modal-backdrop {
          position: fixed;
          inset: 0;
          background-color: rgba(0, 0, 0, 0.65);
          backdrop-filter: blur(4px);
          z-index: 1000;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 40px;
          animation: fadeIn 0.2s ease-out forwards;
        }

        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        .modal-container {
          background-color: #ffffff;
          width: 100%;
          max-width: 960px;
          height: 85vh;
          max-height: 760px;
          border-radius: 16px;
          display: flex;
          padding: 24px;
          gap: 32px;
          position: relative;
          box-shadow: 0 24px 64px rgba(0, 0, 0, 0.2);
          transform: translateY(20px);
          animation: slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards;
          box-sizing: border-box;
        }

        @keyframes slideUp {
          from { transform: translateY(20px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }

        .modal-left-img {
          flex: 1;
          border-radius: 12px;
          overflow: hidden;
          background-color: #f4f4f5;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 12px;
          box-sizing: border-box;
        }

        .modal-left-img img {
          max-width: 100%;
          max-height: 100%;
          display: block;
        }

        .modal-left-img.is-landscape img,
        .modal-left-img.is-square img {
          width: 100%;
          height: auto;
          object-fit: contain;
        }

        .modal-left-img.is-portrait img {
          width: auto;
          height: 100%;
          object-fit: contain;
        }

        .modal-right-content {
          flex: 1;
          display: flex;
          flex-direction: column;
          overflow-y: auto;
          position: relative;
          padding-right: 12px;
        }

        .modal-right-content::-webkit-scrollbar {
          width: 6px;
        }

        .modal-right-content::-webkit-scrollbar-track {
          background: transparent;
        }

        .modal-right-content::-webkit-scrollbar-thumb {
          background-color: #e4e4e7;
          border-radius: 10px;
        }

        .close-modal-btn {
          position: absolute;
          top: 0;
          right: 0;
          width: 32px;
          height: 32px;
          border-radius: 50%;
          background-color: #ffffff;
          border: 1px solid #e4e4e7;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #71717a;
          cursor: pointer;
          transition: background-color 0.2s, color 0.2s;
          z-index: 10;
        }

        .close-modal-btn:hover {
          background-color: #f4f4f5;
          color: #18181b;
        }

        .modal-title {
          font-size: 26px;
          font-weight: 700;
          color: #18181b;
          margin: 0 0 24px 0;
          padding-right: 40px;
        }

        .modal-meta-row {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 16px;
          margin-bottom: 24px;
          flex-wrap: wrap;
        }

        .modal-meta-stack {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .modal-source,
        .modal-submeta {
          font-size: 13px;
          color: #71717a;
        }

        .modal-actions {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }

        .action-pill-btn {
          display: flex;
          align-items: center;
          gap: 6px;
          background-color: #f4f4f5;
          border: none;
          padding: 6px 14px;
          border-radius: 9999px;
          font-size: 12px;
          font-weight: 500;
          color: #52525b;
          cursor: pointer;
          transition: background-color 0.2s, color 0.2s;
        }

        .action-pill-btn:hover {
          background-color: #e4e4e7;
          color: #18181b;
        }

        .action-pill-btn.is-primary {
          background-color: #18181b;
          color: #ffffff;
        }

        .action-pill-btn.is-primary:hover {
          background-color: #27272a;
          color: #ffffff;
        }

        .action-pill-btn:disabled {
          opacity: 0.6;
          cursor: wait;
        }

        .prompt-section {
          margin-bottom: 24px;
        }

        .prompt-section-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 12px;
          gap: 12px;
        }

        .prompt-section-title {
          font-size: 13px;
          font-weight: 600;
          color: #a1a1aa;
        }

        .prompt-text {
          font-size: 14px;
          line-height: 1.6;
          color: #52525b;
          white-space: pre-wrap;
          word-break: break-word;
        }

        .modal-tag-list {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-bottom: 24px;
        }

        @media (max-width: 1200px) {
          .prompts-columns-wrapper {
            gap: 16px;
          }
        }

        @media (max-width: 900px) {
          .prompts-columns-wrapper {
            flex-wrap: wrap;
            gap: 12px;
          }

          .prompts-vertical-col {
            min-width: calc(50% - 6px);
            gap: 12px;
          }

          .modal-container {
            flex-direction: column;
            padding: 16px;
            gap: 16px;
            height: 90vh;
          }

          .modal-left-img {
            flex: none;
            height: 40%;
            border-radius: 8px;
          }
        }

        @media (max-width: 640px) {
          .user-home-page {
            padding: 0 20px;
          }

          .prompts-vertical-col {
            min-width: 100%;
          }

          .prompts-search-bar {
            width: 100%;
          }
        }
      `}</style>

      <div className="center-hero-section">
        <div className="brand-headline">
          <div className="headline-logo">
            <img src={logoImg} alt="PandaPaint Logo" />
          </div>
          <h1>PandaPaint 从灵感黑白，到设计斑斓</h1>
        </div>
        <p className="brand-subtext">Do it what you want to do.</p>

        <div
          className={`ai-input-card ${isDragging ? 'is-dragging' : ''}`}
          ref={inputCardRef}
          onDragOver={handleDragOver}
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          {attachments.length ? (
            <div className="home-attachment-previews" aria-label="已添加的图片">
              {attachments.map((attachment) => (
                <div className="home-attachment-preview" key={attachment.id}>
                  <img src={attachment.preview} alt={attachment.file.name} />
                  <button
                    type="button"
                    className="home-attachment-remove"
                    aria-label={`移除 ${attachment.file.name}`}
                    onClick={() => handleRemoveAttachment(attachment.id)}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          ) : null}
          <textarea
            ref={textareaRef}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={currentPlaceholder}
            className="ai-textarea"
            rows="2"
          />
          {attachmentError ? <p className="home-attachment-error" role="alert">{attachmentError}</p> : null}
          <div className="ai-card-footer">
            <div className="footer-left-tools">
              <input
                ref={attachmentInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                hidden
                onChange={(event) => {
                  handleAddAttachments(event.target.files)
                  event.target.value = ''
                }}
              />
              <button type="button" className="tool-btn" title="上传参考图" aria-label="添加图片" onClick={() => attachmentInputRef.current?.click()}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
              </button>

              <div className="home-generation-params">
                <button
                  type="button"
                  className={`home-generation-params-trigger ${isParamsPopoverOpen ? 'is-active' : ''}`}
                  onClick={() => {
                    setIsParamsPopoverOpen((open) => !open)
                    setIsModelDropdownOpen(false)
                  }}
                >
                  {ratio} · {count}张 ▾
                </button>
                {isParamsPopoverOpen && (
                  <>
                    <div className="home-generation-backdrop" onClick={() => setIsParamsPopoverOpen(false)} />
                    <div className="home-generation-params-popover">
                      <div className="home-generation-params-section">
                        <div className="home-generation-params-title">比例</div>
                        <div className="home-generation-ratio-grid">
                          {HOME_RATIOS.map((item) => (
                            <button
                              key={item.value}
                              type="button"
                              className={`home-generation-ratio-btn ${ratio === item.value ? 'is-active' : ''}`}
                              onClick={() => setRatio(item.value)}
                            >
                              <span className="home-generation-ratio-icon">{item.icon}</span>
                              <span>{item.label}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="home-generation-params-section">
                        <div className="home-generation-params-title">生成数量</div>
                        <div className="home-generation-count-row">
                          {HOME_COUNTS.map((item) => (
                            <button
                              key={item}
                              type="button"
                              className={`home-generation-count-btn ${count === item ? 'is-active' : ''}`}
                              onClick={() => setCount(item)}
                            >
                              {item}张
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>

              <div className="model-selector-wrapper">
                <button
                  className="model-select-trigger"
                  onClick={() => {
                    setIsModelDropdownOpen((open) => !open)
                    setIsParamsPopoverOpen(false)
                  }}
                >
                  <span className="trigger-icon">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/>
                      <polyline points="14 2 14 8 20 8"/>
                    </svg>
                  </span>
                  <span>{HOME_MODELS.find((model) => model.id === selectedModel)?.name || selectedModel}</span>
                  <span className="trigger-chevron">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </span>
                </button>

                {isModelDropdownOpen && (
                  <>
                    <div className="dropdown-backdrop" onClick={() => setIsModelDropdownOpen(false)} />
                    <div className="model-dropdown-menu">
                      <div className="dropdown-header">
                        <span>配置生成模型</span>
                        <a href="#">了解更多</a>
                      </div>
                      {HOME_MODELS.map((model) => (
                        <div className="dropdown-item" key={model.id} onClick={() => {
                          setSelectedModel(model.id)
                          setIsModelDropdownOpen(false)
                        }}>
                          <div className="item-icon-wrapper">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2-2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/>
                              <polyline points="14 2 14 8 20 8"/>
                            </svg>
                          </div>
                          <div className="item-text">
                            <div className="item-title">{model.name}</div>
                            <div className="item-desc">{model.desc}</div>
                          </div>
                          {selectedModel === model.id ? (
                            <div className="item-check">
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="20 6 9 17 4 12" />
                              </svg>
                            </div>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>

            <div className="footer-right-tools">
              <button
                type="button"
                className={`submit-btn ${inputText.trim() ? 'has-content' : ''}`}
                disabled={!inputText.trim() || isCreating}
                title={isCreating ? '正在创建项目' : '生成'}
                onClick={handleCreateNewProject}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="19" x2="12" y2="5" />
                  <polyline points="5 12 12 5 19 12" />
                </svg>
              </button>
            </div>
          </div>
        </div>

      </div>

      <section className="prompts-section-container">
        <div className="prompts-header">
          <h2>AI 提示词参考</h2>
          <div className="prompts-search-bar">
            <input
              type="text"
              placeholder="搜索标题、标签、提示词、分类、来源..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="prompts-search-input"
            />
            <button type="button" className="prompts-search-btn" title="搜索">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            </button>
          </div>
        </div>

        {filteredColumns.flat().length ? (
          <div className="prompts-columns-wrapper">
            {filteredColumns.map((columnData, colIdx) => (
              <div key={`col-${colIdx}`} className="prompts-vertical-col">
                {columnData.map((item) => (
                  <article
                    key={item.id}
                    className={`prompt-gallery-card ${visiblePromptIds[item.id] ? 'is-visible' : ''}`}
                    data-prompt-id={item.id}
                    ref={(node) => {
                      if (node) {
                        promptCardRefs.current.set(item.id, node)
                      } else {
                        promptCardRefs.current.delete(item.id)
                      }
                    }}
                  >
                    <div
                      className="prompt-img-wrapper"
                      style={{ aspectRatio: item.aspectRatio }}
                    >
                      <img
                        src={item.image}
                        alt={item.title}
                        className="prompt-img"
                        loading="lazy"
                      />
                      <div className="hover-overlay-mask">
                        <button
                          className="view-details-btn"
                          onClick={(e) => {
                            e.stopPropagation()
                            setActiveModal(item)
                          }}
                        >
                          View Details
                        </button>
                      </div>
                    </div>
                    <div className="prompt-meta-area">
                      <h3 className="prompt-card-title">{item.title}</h3>
                      {item.summary ? <p className="prompt-card-summary">{item.summary}</p> : null}
                      <div className="prompt-tag-list">
                        {item.tags.slice(0, 6).map((tag, idx) => (
                          <span key={`${item.id}-tag-${idx}`} className="prompt-badge">
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            ))}
          </div>
        ) : (
          <div className="prompts-empty-state">没有搜索到匹配的提示词，试试换个关键词。</div>
        )}
      </section>

      {activeModal && (
        <div className="modal-backdrop" onClick={() => setActiveModal(null)}>
          <div className="modal-container" onClick={(e) => e.stopPropagation()}>
            <div className={`modal-left-img ${isPortraitAspectRatio(activeModal.aspectRatio) ? 'is-portrait' : activeModal.aspectRatio === '1:1' ? 'is-square' : 'is-landscape'}`}>
              <img src={activeModal.image} alt={activeModal.title} />
            </div>

            <div className="modal-right-content">
              <button className="close-modal-btn" onClick={() => setActiveModal(null)}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>

              <h2 className="modal-title">{activeModal.title}</h2>

              <div className="modal-meta-row">
                <div className="modal-meta-stack">
                  <span className="modal-source">来源：{activeModal.source}</span>
                  <span className="modal-submeta">
                    {[activeModal.category, activeModal.model, activeModal.useCase].filter(Boolean).join(' · ')}
                  </span>
                </div>
                <div className="modal-actions">
                  <button className="action-pill-btn" onClick={() => handleApplyPrompt(activeModal.primaryPrompt)}>
                    应用到输入框
                  </button>
                </div>
              </div>

              {activeModal.tags.length ? (
                <div className="modal-tag-list">
                  {activeModal.tags.map((tag, idx) => (
                    <span key={`${activeModal.id}-modal-tag-${idx}`} className="prompt-badge">
                      {tag}
                    </span>
                  ))}
                </div>
              ) : null}

              {activeModal.summary ? (
                <div className="prompt-section">
                  <div className="prompt-section-header">
                    <span className="prompt-section-title">简介</span>
                  </div>
                  <div className="prompt-text">{activeModal.summary}</div>
                </div>
              ) : null}

              {activeModal.promptEn ? (
                <div className="prompt-section">
                  <div className="prompt-section-header">
                    <span className="prompt-section-title">提示词（英文）</span>
                    <button className="action-pill-btn" onClick={() => handleCopyPrompt(activeModal.promptEn)}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                      </svg>
                      复制
                    </button>
                  </div>
                  <div className="prompt-text">{activeModal.promptEn}</div>
                </div>
              ) : null}

              {activeModal.promptZh ? (
                <div className="prompt-section">
                  <div className="prompt-section-header">
                    <span className="prompt-section-title">提示词 (中文)</span>
                    <button className="action-pill-btn" onClick={() => handleCopyPrompt(activeModal.promptZh)}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                      </svg>
                      复制
                    </button>
                  </div>
                  <div className="prompt-text">{activeModal.promptZh}</div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </main>
  )
}