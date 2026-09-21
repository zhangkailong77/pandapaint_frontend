import React, { useEffect, useLayoutEffect, useState, useRef } from 'react'
import { createRoot } from 'react-dom/client'
import styled from 'styled-components'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useGoogleLogin, GoogleOAuthProvider } from '@react-oauth/google'
import './styles.css'
import AdminApp from './admin/AdminApp.jsx'
import AdminLoginPage from './admin/AdminLoginPage.jsx'
import Workbench from './workbench/Workbench.jsx'
import UserPage from './user/UserPage.jsx'
import logoImg from './public/image/logo/logo-1.png'
import { isGptImageModel } from './imageModels.js'
import singleProductImg from './public/image/web/01.png'
import quadImg1 from './public/image/web/02.png'
import quadImg2 from './public/image/web/03.png'
import quadImg3 from './public/image/web/04.png'
import quadImg4 from './public/image/web/05.png'
import headphone1 from './public/image/web/耳机01.png'     
import headphone2 from './public/image/web/耳机02.png'     
import headphone3 from './public/image/web/耳机03.png'    
import clothing1 from './public/image/web/服装01.png'     
import clothing2 from './public/image/web/服装02.png'     
import clothing3 from './public/image/web/服装03.png' 
import accordionImg1 from './public/image/web/天宫.png'
import accordionImg2 from './public/image/web/草原.png'
import accordionImg3 from './public/image/web/海洋.png'
import accordionImg4 from './public/image/web/火山.png'
import accordionImg5 from './public/image/web/室内.png'

gsap.registerPlugin(ScrollTrigger)

// 填入你在 Google Cloud Console 创建的 Client ID
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID

function navigate(path) {
  window.history.pushState({}, '', path)
  window.dispatchEvent(new PopStateEvent('popstate'))
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

function toBase64Url(value) {
  return btoa(String(value)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

function fromBase64Url(value) {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/')
  const padded = `${normalized}${'='.repeat((4 - (normalized.length % 4 || 4)) % 4)}`
  return atob(padded)
}

const USER_ROUTE_SECRET = 'vary-ocean-flow-fish:user-route:v1'

function encodeUserRoute(userId) {
  const numericId = Number(userId)
  const payload = {
    v: 1,
    uid: numericId,
    checksum: (numericId * 7919 + 17).toString(36),
    salt: toBase64Url(USER_ROUTE_SECRET).slice(0, 12),
  }
  return `/u/${toBase64Url(JSON.stringify(payload))}`
}

function decodeUserToken(token) {
  try {
    const parsed = JSON.parse(fromBase64Url(token))
    if (!parsed || parsed.v !== 1) return null
    const userId = Number(parsed.uid)
    const checksum = Number.parseInt(String(parsed.checksum), 36)
    if (!Number.isFinite(userId) || !Number.isFinite(checksum)) return null
    if (parsed.salt !== toBase64Url(USER_ROUTE_SECRET).slice(0, 12)) return null
    return checksum === userId * 7919 + 17 ? userId : null
  } catch {
    return null
  }
}

function parseUserRoute(pathname) {
  const match = pathname.match(/^\/u\/([^/]+)(?:\/([^/]+))?$/)
  if (!match) return null

  const userId = decodeUserToken(match[1])
  if (!userId) return null

  const childRoute = match[2] || 'home'
  return {
    userId,
    routeBase: `/u/${match[1]}`,
    childRoute,
  }
}

function useRoute() {
  const [path, setPath] = useState(`${window.location.pathname}${window.location.search}`)
  useEffect(() => {
    const onPop = () => setPath(`${window.location.pathname}${window.location.search}`)
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])
  return path
}

function parseWorkbenchLaunch(route) {
  const searchIndex = route.indexOf('?')
  if (searchIndex === -1) return { projectId: null, launchPrompt: '', launchRatio: null, launchCount: null, launchModel: null }

  const params = new URLSearchParams(route.slice(searchIndex + 1))
  const launchRatio = params.get('launchRatio')
  const launchCount = Number(params.get('launchCount'))
  const launchModel = params.get('launchModel')
  return {
    projectId: params.get('projectId'),
    launchPrompt: params.get('launchPrompt') || '',
    launchRatio: ['1:1', '9:16', '16:9', '3:4', '4:3', '3:2', '2:3', '4:5', '5:4', '21:9'].includes(launchRatio) ? launchRatio : null,
    launchCount: [1, 2, 4].includes(launchCount) ? launchCount : null,
    launchModel: isGptImageModel(launchModel) ? launchModel : null,
  }
}

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

// Lovart 官方同款极简高质感登录弹窗
function AuthDialog({ open, onClose, onSuccess }) {
  const [mode, setMode] = useState('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [status, setStatus] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [emailCode, setEmailCode] = useState('')
  const [codeSending, setCodeSending] = useState(false)
  const [codeCountdown, setCodeCountdown] = useState(0)

  const backdropRef = useRef(null)
  const modalCardRef = useRef(null)
  const formBodyRef = useRef(null)
  const registerFieldsRef = useRef([])
  const prevModeRef = useRef('login')
  const prevHeightRef = useRef(null)

  // 原生常显 Google OAuth 登录处理
  const triggerGoogleLogin = useGoogleLogin({
    flow: 'auth-code',

    onSuccess: async (codeResponse) => {
      setStatus('')
      setSubmitting(true)

      try {
        const data = await fetchJson('/api/auth/google', {
          method: 'POST',
          body: JSON.stringify({
            code: codeResponse.code,
          }),
        })

        onSuccess?.(data.user)
        onClose()
      } catch (error) {
        setStatus(
          error instanceof Error
            ? error.message
            : 'Google 登录失败，请重试'
        )
      } finally {
        setSubmitting(false)
      }
    },

    onError: () => {
      setStatus('Google 登录已取消或网络连接超时')
    },
  })

  // 1. 弹窗打开时 GSAP 弹入动效
  useEffect(() => {
    if (open) {
      prevModeRef.current = mode
      prevHeightRef.current = null
      if (backdropRef.current && modalCardRef.current) {
        gsap.fromTo(
          backdropRef.current,
          { opacity: 0 },
          { opacity: 1, duration: 0.3, ease: 'power2.out' }
        )
        gsap.fromTo(
          modalCardRef.current,
          { opacity: 0, scale: 0.92, y: 24, filter: 'blur(8px)' },
          { opacity: 1, scale: 1, y: 0, filter: 'blur(0px)', duration: 0.45, ease: 'back.out(1.4)' }
        )
      }
    }
  }, [open])

  // 2. 登录 ⇄ 注册模式切换
  useLayoutEffect(() => {
    if (!open || !modalCardRef.current) return

    const card = modalCardRef.current

    if (prevModeRef.current !== mode) {
      const prevH = prevHeightRef.current || (mode === 'register' ? 440 : 580)
      const targetH = card.offsetHeight

      gsap.killTweensOf(card)

      gsap.fromTo(
        card,
        { height: prevH },
        {
          height: targetH,
          duration: 0.46,
          ease: 'power3.out',
          clearProps: 'height',
          onComplete: () => {
            if (modalCardRef.current) {
              prevHeightRef.current = modalCardRef.current.offsetHeight
            }
          },
        }
      )

      if (mode === 'register') {
        const fields = registerFieldsRef.current.filter(Boolean)
        if (fields.length > 0) {
          gsap.fromTo(
            fields,
            { opacity: 0, y: -8, filter: 'blur(4px)' },
            { opacity: 1, y: 0, filter: 'blur(0px)', duration: 0.32, stagger: 0.045, ease: 'power2.out', delay: 0.06 }
          )
        }
      }

      prevModeRef.current = mode
    }

    prevHeightRef.current = card.offsetHeight
  }, [mode, open])

  useEffect(() => {
    if (!open) return undefined
    const onKeyDown = (event) => {
      if (event.key === 'Escape') handleCloseAnimated()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open])

  useEffect(() => {
    if (!open) {
      setStatus('')
      setSubmitting(false)
      setEmailCode('')
      setCodeSending(false)
      setCodeCountdown(0)
    }
  }, [open])

  useEffect(() => {
    if (codeCountdown <= 0) return undefined
    const timer = window.setInterval(() => {
      setCodeCountdown((value) => Math.max(0, value - 1))
    }, 1000)
    return () => window.clearInterval(timer)
  }, [codeCountdown])

  if (!open) return null

  function handleCloseAnimated() {
    if (backdropRef.current && modalCardRef.current) {
      gsap.to(backdropRef.current, { opacity: 0, duration: 0.25, ease: 'power2.in' })
      gsap.to(modalCardRef.current, {
        opacity: 0,
        scale: 0.94,
        y: 16,
        filter: 'blur(6px)',
        duration: 0.25,
        ease: 'power2.in',
        onComplete: onClose,
      })
    } else {
      onClose()
    }
  }

  function handleSwitchMode(targetMode) {
    if (modalCardRef.current) {
      prevHeightRef.current = modalCardRef.current.offsetHeight
    }
    setStatus('')
    setMode(targetMode)
  }

  async function handleSendCode() {
    const trimmedEmail = email.trim()
    if (!trimmedEmail) {
      setStatus('请先填写邮箱')
      return
    }

    setCodeSending(true)
    setStatus('')
    try {
      const data = await fetchJson('/api/auth/email-code', {
        method: 'POST',
        body: JSON.stringify({ email: trimmedEmail }),
      })
      if (data.next_allowed_at) {
        const remaining = Math.max(1, Math.ceil((new Date(data.next_allowed_at).getTime() - Date.now()) / 1000))
        setCodeCountdown(remaining)
      } else {
        setCodeCountdown(60)
      }
      setStatus('验证码已发送，请查收邮箱')
    } catch (error) {
      setStatus(error instanceof Error ? error.message : '验证码发送失败')
    } finally {
      setCodeSending(false)
    }
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setStatus('')

    if (mode === 'register' && password !== confirmPassword) {
      setStatus('两次输入的密码不一致')
      return
    }

    setSubmitting(true)
    try {
      const endpoint = mode === 'login' ? '/api/auth/login' : '/api/auth/register'
      const body = {
        email,
        password,
        display_name: displayName || undefined,
        ...(mode === 'register' ? { email_code: emailCode.trim() } : {}),
      }
      const data = await fetchJson(endpoint, {
        method: 'POST',
        body: JSON.stringify(body),
      })
      onSuccess?.(data.user)
      onClose()
    } catch (error) {
      setStatus(error instanceof Error ? error.message : '请求失败')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <LovartAuthModalShell>
      <div className="modal-backdrop" ref={backdropRef} onClick={handleCloseAnimated} />
      <div className="modal-card-box" ref={modalCardRef}>
        <button type="button" className="close-action-btn" aria-label="关闭" onClick={handleCloseAnimated}>
          <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" strokeWidth="2" fill="none">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>

        <div className="modal-top-brand">
          <img src={logoImg} alt="Logo" className="modal-brand-logo-img" />
          <span className="brand-title-text">PandaPaint</span>
        </div>

        <h2 className="modal-main-heading">欢迎来到 PandaPaint</h2>
        <p className="modal-sub-heading">登录或注册以继续</p>

        <div className="oauth-buttons-group">
          {/* 原生高质感 Google 登录按钮（永久稳定显示） */}
          <button
            type="button"
            className="custom-google-auth-btn"
            onClick={() => triggerGoogleLogin()}
            disabled={submitting}
          >
            <svg className="google-svg-icon" viewBox="0 0 24 24" width="18" height="18">
              <path
                fill="#4285F4"
                d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"
              />
              <path
                fill="#34A853"
                d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"
              />
              <path
                fill="#FBBC05"
                d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.98 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
              />
              <path
                fill="#EA4335"
                d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
              />
            </svg>
            <span>使用 Google 账号继续</span>
          </button>
        </div>

        <form className="lovart-form-body" ref={formBodyRef} onSubmit={handleSubmit}>
          {mode === 'register' ? (
            <div className="input-group" ref={(el) => (registerFieldsRef.current[0] = el)}>
              <input
                type="text"
                placeholder="昵称"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                autoComplete="nickname"
                required
              />
            </div>
          ) : null}

          <div className="input-group email-row">
            <input
              type="email"
              placeholder="电子邮箱"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
            />
            {mode === 'register' ? (
              <button
                type="button"
                className="send-code-link"
                onClick={handleSendCode}
                disabled={codeSending || codeCountdown > 0 || submitting}
              >
                {codeSending ? '发送中...' : codeCountdown > 0 ? `${codeCountdown}s` : '获取验证码'}
              </button>
            ) : null}
          </div>

          {mode === 'register' ? (
            <div className="input-group" ref={(el) => (registerFieldsRef.current[1] = el)}>
              <input
                type="text"
                placeholder="邮箱验证码"
                value={emailCode}
                onChange={(e) => setEmailCode(e.target.value)}
                inputMode="numeric"
                required
              />
            </div>
          ) : null}

          <div className="input-group">
            <input
              type="password"
              placeholder="密码"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              required
              minLength={8}
            />
          </div>

          {mode === 'register' ? (
            <div className="input-group" ref={(el) => (registerFieldsRef.current[2] = el)}>
              <input
                type="password"
                placeholder="确认密码"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
                required
                minLength={8}
              />
            </div>
          ) : null}

          {status ? <div className="auth-tip-error">{status}</div> : null}

          <button className="submit-black-btn" type="submit" disabled={submitting}>
            {submitting ? '处理中...' : '使用邮箱继续'}
          </button>
        </form>

        <div className="mode-toggle-footer">
          {mode === 'login' ? (
            <p>
              还没有账号？ <span onClick={() => handleSwitchMode('register')}>立即注册</span>
            </p>
          ) : (
            <p>
              已有账号？ <span onClick={() => handleSwitchMode('login')}>直接登录</span>
            </p>
          )}
        </div>

        <div className="legal-terms-text">
          继续即表示您同意 <a href="#terms">使用条款</a> 和 <a href="#privacy">隐私政策</a>
        </div>
      </div>
    </LovartAuthModalShell>
  )
}

function LucideImageIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
      <circle cx="9" cy="9" r="2" />
      <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
    </svg>
  )
}

// 轮播主题数据集
const SHOWCASE_THEMES = [
  {
    sup: '(2)',
    brandKeyword: '独立女装品牌',
    targetKeyword: '当季秋冬 Lookbook',
    projectTag: '秋冬胶囊系列发布 ▾',
    windowBg: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxNjAwIiBoZWlnaHQ9IjkwMCI+PHJlY3Qgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgZmlsbD0iI0VBREVDRSIvPjwvc3ZnPg==',
    card1: clothing1,       
    card2: clothing2,      
    card3: clothing3,       
    card3Type: 'Image',
    card3Res: '1280 x 720',
    userPrompt: '为独立设计师女装品牌策划当季秋冬 Lookbook，定位极简智性风，聚焦羊绒毛呢剪裁、巴黎街头漫步与自然光影。',
    aiResponse1: '我已为该女装品牌生成了一套完整的秋冬 Lookbook 视觉体系，色调采用低饱和燕麦与暖驼大地色系，强调面料垂坠感。',
    aiResponse2: '素材包含全身廓形模特大片、羊绒织物细节特写以及电影感街头漫步动态，在克制构图中突显高级剪裁质感与独立女性气质。',
  },
  {
    sup: '(3)',
    brandKeyword: '街角咖啡馆',
    targetKeyword: '品牌视觉系统',
    projectTag: '咖啡店品牌系统 ▾',
    windowBg: 'https://images.unsplash.com/photo-1447933601403-0c6688de566e?w=1600&auto=format&fit=crop&q=40',
    card1: 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=600&auto=format&fit=crop&q=80',
    card2: 'https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=600&auto=format&fit=crop&q=80',
    card3: 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=800&auto=format&fit=crop&q=80',
    card3Type: 'Image',
    card3Res: '540 x 720',
    userPrompt: '为一家社区咖啡店开发完整的视觉识别系统，涵盖店内、包装和数字触点。',
    aiResponse1: '我已为本地咖啡店设计了一套品牌系统，聚焦手工感、温暖和日常使用。',
    aiResponse2: '系统采用大地色系、触感细节和以人为本的字体，具有灵活的组件可在包装、标识和数字触点之间扩展。',
  },
  {
    sup: '(1)',
    brandKeyword: '新锐声学品牌',
    targetKeyword: '全案发售视觉',
    projectTag: '无线降噪耳机发布 ▾',
    windowBg: 'https://images.unsplash.com/photo-1546435770-a3e426bf472b?w=1600&auto=format&fit=crop&q=40',
    card1: headphone1,
    card2: headphone2,
    card3: headphone3,
    card3Type: 'Image',
    card3Res: '1280 x 720',
    userPrompt: '为新一代头戴式无线降噪耳机设计发售视觉，包含代言人多角度佩戴大片、哑光外壳微距特写与沉浸式动态视频。',
    aiResponse1: '已生成整套声学产品视觉资产，统一采用清冷蓝灰色调与棚拍极简光影。',
    aiResponse2: '素材涵盖多姿态模特佩戴照、耳罩与发声单元细节特写及音乐氛围感动态，全面支撑全渠道发售。',
  },
]

// 5 张风琴卡片的配置
const ACCORDION_ITEMS = [
  {
    id: 1,
    tag: 'Celestial / 天宫',
    title: 'Cloud Citadel',
    desc: '万丈白玉宫阙隐于浩瀚云海，人在天地神域间如微尘',
    linkText: 'EXPLORE',
    image: accordionImg1, 
    travelDist: 900,
  },
  {
    id: 2,
    tag: 'Steppe / 草原',
    title: 'Verdant Ridge',
    desc: '千重青翠草甸连绵天际，银练曲流映照清晨微茫',
    linkText: 'DISCOVER',
    image: accordionImg2, 
    travelDist: 1250,
  },
  {
    id: 3,
    tag: 'Ocean / 沧海',
    title: 'Solitary Sea',
    desc: '孤立神阁守望万顷深蓝汪洋，极简空灵尽显天地寂静',
    linkText: 'VIEW CASE',
    image: accordionImg3, 
    travelDist: 1600,
  },
  {
    id: 4,
    tag: 'Volcano / 炽焰',
    title: 'Molten Forge',
    desc: '万丈火山熔岩奔涌，黑曜石殿堂展现太古自然伟力',
    linkText: 'WITNESS',
    image: accordionImg4, 
    travelDist: 1950,
  },
  {
    id: 5,
    tag: 'Sanctum / 殿宇',
    title: 'Infinite Hall',
    desc: '百里汉白玉巨柱纵深延伸，透过千米天门遥望太虚仙境',
    linkText: 'ENTER',
    image: accordionImg5, 
    travelDist: 2300,
  },
]

function Home({ onOpenAuth, onStartCreating, currentUser, onLogout }) {
  const [headerProgress, setHeaderProgress] = useState(0)
  const [activeAccordionIndex, setActiveAccordionIndex] = useState(2)
  const [newsletterEmail, setNewsletterEmail] = useState('')

  const [themeIndex, setThemeIndex] = useState(0)

  const brandStageRef = useRef(null)
  const brandLineRef = useRef(null)
  const brandMeasureRef = useRef(null)
  const brandCharsRef = useRef([])

  const targetStageRef = useRef(null)
  const targetLineRef = useRef(null)
  const targetMeasureRef = useRef(null)
  const targetCharsRef = useRef([])

  const chatBubbleUserRef = useRef(null)
  const stepItem1Ref = useRef(null)
  const stepItem2Ref = useRef(null)
  const chatAiResponseRef = useRef(null)

  const card1Ref = useRef(null)
  const card2Ref = useRef(null)
  const card3Ref = useRef(null)

  const section2TrackRef = useRef(null)
  const sec2SingleWrapperRef = useRef(null)
  const sec2DialogRef = useRef(null)
  const sec2QuadCardsRef = useRef([])
  const sec2SpawnsRef = useRef([])
  const sec2ContentsRef = useRef([])

  const section3TrackRef = useRef(null)
  const produxWordmarkRef = useRef(null)
  const manifestoGridRef = useRef(null)
  const maskLine1Ref = useRef(null)
  const maskLine2Ref = useRef(null)
  const maskDescRef = useRef(null)
  const accordionStageRef = useRef(null)
  const accordionCardsRef = useRef([])
  const cursorFollowerRef = useRef(null)

  const modernFooterRef = useRef(null)
  const footerContentContainerRef = useRef(null)
  const footerColsRef = useRef([])
  const footerDesignSvgRef = useRef(null)
  const footerBottomBarRef = useRef(null)

  // 平滑滚动至目标区域函数
  const scrollToSection = (e, sectionId) => {
    e.preventDefault()
    if (sectionId === 'about') {
      window.scrollTo({
        top: document.documentElement.scrollHeight,
        behavior: 'smooth',
      })
      return
    }
    const targetElement = document.getElementById(sectionId)
    if (targetElement) {
      targetElement.scrollIntoView({ behavior: 'smooth' })
    }
  }

  // 1. 区域 1 GSAP 全局时序编排
  useEffect(() => {
    const brandStage = brandStageRef.current
    const brandLine = brandLineRef.current
    const brandMeasure = brandMeasureRef.current
    const brandChars = brandCharsRef.current.filter(Boolean)

    const targetStage = targetStageRef.current
    const targetLine = targetLineRef.current
    const targetMeasure = targetMeasureRef.current
    const targetChars = targetCharsRef.current.filter(Boolean)

    const chatBubble = chatBubbleUserRef.current
    const step1 = stepItem1Ref.current
    const step2 = stepItem2Ref.current
    const chatAi = chatAiResponseRef.current

    const card1 = card1Ref.current
    const card2 = card2Ref.current
    const card3 = card3Ref.current

    if (!brandStage || !brandLine || !brandMeasure || !targetStage || !targetLine || !targetMeasure) return

    gsap.set([brandStage, targetStage], { opacity: 1, y: 0, clearProps: 'filter,transform' })

    const brandTargetW = brandMeasure.offsetWidth || 180
    const targetTargetW = targetMeasure.offsetWidth || 180

    gsap.set([...brandChars, ...targetChars], { opacity: 0, x: -8, filter: 'blur(3px)' })

    if (chatBubble && step1 && step2 && chatAi) {
      gsap.set([chatBubble, step1, step2, chatAi], { opacity: 0, y: 14, filter: 'blur(4px)' })
    }

    if (card1 && card2 && card3) {
      gsap.set([card1, card2, card3], { opacity: 0, y: 22, scale: 0.95, filter: 'blur(6px)' })
    }

    const tl = gsap.timeline({
      onComplete: () => {
        setThemeIndex((prev) => (prev + 1) % SHOWCASE_THEMES.length)
      },
    })

    tl.to(brandLine, { width: brandTargetW, duration: 0.55, ease: 'power3.out' }, 0)
    tl.to(targetLine, { width: targetTargetW, duration: 0.55, ease: 'power3.out' }, 0)

    tl.to(brandChars, { opacity: 1, x: 0, filter: 'blur(0px)', duration: 0.28, stagger: 0.038, ease: 'power2.out' }, 0.05)
    tl.to(targetChars, { opacity: 1, x: 0, filter: 'blur(0px)', duration: 0.28, stagger: 0.038, ease: 'power2.out' }, 0.20)

    if (chatBubble) {
      tl.to(chatBubble, { opacity: 1, y: 0, filter: 'blur(0px)', duration: 0.45, ease: 'power2.out' }, 0.35)
    }
    if (step1) {
      tl.to(step1, { opacity: 1, y: 0, filter: 'blur(0px)', duration: 0.4, ease: 'power2.out' }, 0.55)
    }
    if (step2) {
      tl.to(step2, { opacity: 1, y: 0, filter: 'blur(0px)', duration: 0.4, ease: 'power2.out' }, 0.72)
    }
    if (chatAi) {
      tl.to(chatAi, { opacity: 1, y: 0, filter: 'blur(0px)', duration: 0.5, ease: 'power2.out' }, 0.90)
    }

    if (card1 && card2 && card3) {
      tl.to([card1, card2, card3], {
        opacity: 1,
        y: 0,
        scale: 1,
        filter: 'blur(0px)',
        duration: 0.65,
        stagger: 0.16,
        ease: 'power3.out',
      }, 0.70)
    }

    tl.to({}, { duration: 4.2 })

    const exitTargets = [brandStage, targetStage, chatBubble, step1, step2, chatAi, card1, card2, card3].filter(Boolean)
    tl.to(exitTargets, {
      opacity: 0,
      y: 16,
      filter: 'blur(5px)',
      duration: 0.42,
      ease: 'power2.in',
    })

    return () => {
      tl.kill()
    }
  }, [themeIndex])

  // 2. 区域 2 GSAP ScrollTrigger 物理丝滑滚动时间轴
  useEffect(() => {
    const track = section2TrackRef.current
    const singleWrap = sec2SingleWrapperRef.current
    const dialog = sec2DialogRef.current
    const quadCards = sec2QuadCardsRef.current.filter(Boolean)
    const spawns = sec2SpawnsRef.current.filter(Boolean)
    const contents = sec2ContentsRef.current.filter(Boolean)

    if (!track || !singleWrap || !dialog || quadCards.length === 0) return

    gsap.set(dialog, { y: 60, opacity: 0 })
    gsap.set(singleWrap, { opacity: 1, scale: 1 })
    gsap.set(quadCards, { opacity: 0, scale: 1.15, y: 30 })
    gsap.set(spawns, { opacity: 1 })
    gsap.set(contents, { opacity: 0, filter: 'blur(16px)', scale: 1.05 })

    const scrollTl = gsap.timeline({
      scrollTrigger: {
        trigger: track,
        start: 'top top',
        end: 'bottom bottom',
        scrub: 1.1,
      },
    })

    scrollTl.to(dialog, { y: 0, opacity: 1, ease: 'power2.out', duration: 0.15 }, 0)
    scrollTl.to(singleWrap, { opacity: 0, scale: 0.78, y: -20, filter: 'blur(8px)', ease: 'power2.inOut', duration: 0.13 }, 0.15)
    scrollTl.to(dialog, { opacity: 0, y: 20, ease: 'power2.in', duration: 0.10 }, 0.15)

    scrollTl.to(quadCards, {
      opacity: 1,
      scale: 1,
      y: 0,
      stagger: 0.05,
      ease: 'power3.out',
      duration: 0.20,
    }, 0.20)

    contents.forEach((contentEl, i) => {
      const startTime = 0.35 + i * 0.12
      const spawnEl = spawns[i]

      if (spawnEl) {
        scrollTl.to(spawnEl, { opacity: 0, ease: 'power2.inOut', duration: 0.14 }, startTime)
      }
      scrollTl.to(contentEl, {
        opacity: 1,
        filter: 'blur(0px)',
        scale: 1,
        ease: 'power2.out',
        duration: 0.16,
      }, startTime)
    })

    scrollTl.to({}, { duration: 0.15 }, 0.85)

    return () => {
      if (scrollTl.scrollTrigger) scrollTl.scrollTrigger.kill()
      scrollTl.kill()
    }
  }, [])

  // 3. 区域 3 & 区域 4 GSAP 电影级协同揭示时间轴
  useEffect(() => {
    const track3 = section3TrackRef.current
    const wordmark = produxWordmarkRef.current
    const manifestoGrid = manifestoGridRef.current
    const line1 = maskLine1Ref.current
    const line2 = maskLine2Ref.current
    const desc = maskDescRef.current
    const accordionStage = accordionStageRef.current
    const cards = accordionCardsRef.current.filter(Boolean)

    const footerContent = footerContentContainerRef.current
    const footerCols = footerColsRef.current.filter(Boolean)
    const footerDesignSvg = footerDesignSvgRef.current
    const footerBottomBar = footerBottomBarRef.current

    if (!track3 || !wordmark || !manifestoGrid || cards.length === 0) return

    gsap.set(wordmark, { scale: 1, transformOrigin: '0% 0%' })
    gsap.set(manifestoGrid, { y: 0 })
    gsap.set([line1, line2, desc], { y: 0 })
    gsap.set(accordionStage, { y: 220 })

    cards.forEach((card, i) => {
      const dist = ACCORDION_ITEMS[i]?.travelDist || 1200
      gsap.set(card, { x: dist, opacity: 0, filter: 'blur(26px)' })
    })

    if (footerContent) {
      gsap.set(footerContent, { y: '-35vh', opacity: 0.25, filter: 'blur(8px)' })
    }
    if (footerCols.length > 0) {
      gsap.set(footerCols, { y: 24, opacity: 0 })
    }
    if (footerDesignSvg) {
      gsap.set(footerDesignSvg, { scale: 0.94, opacity: 0.3 })
    }
    if (footerBottomBar) {
      gsap.set(footerBottomBar, { opacity: 0 })
    }

    const produxTl = gsap.timeline({
      scrollTrigger: {
        trigger: track3,
        start: 'top top',
        end: 'bottom bottom',
        scrub: 1.2,
      },
    })

    produxTl.to(wordmark, { scale: 0.24, ease: 'power2.out', duration: 0.35 }, 0)
    produxTl.to(manifestoGrid, { y: - window.innerHeight * 0.42, ease: 'power2.out', duration: 0.30 }, 0)
    produxTl.to(line1, { y: '-115%', ease: 'power2.in', duration: 0.16 }, 0.32)
    produxTl.to(desc, { y: '-115%', ease: 'power2.in', duration: 0.16 }, 0.34)
    produxTl.to(line2, { y: '-115%', ease: 'power2.in', duration: 0.16 }, 0.36)

    produxTl.to(accordionStage, { y: 0, ease: 'power2.out', duration: 0.45 }, 0.20)

    cards.forEach((card, i) => {
      const startTime = 0.28 + i * 0.10
      produxTl.to(card, {
        x: 0,
        opacity: 1,
        filter: 'blur(0px)',
        ease: 'power3.out',
        duration: 0.28,
      }, startTime)
    })

    produxTl.to({}, { duration: 0.15 }, 0.85)

    const footerTl = gsap.timeline({
      scrollTrigger: {
        trigger: track3,
        start: 'bottom 96%',
        end: 'bottom top',
        scrub: 1.2,
      },
    })

    if (footerContent) {
      footerTl.to(footerContent, {
        y: '0vh',
        opacity: 1,
        filter: 'blur(0px)',
        ease: 'power2.out',
        duration: 1,
      }, 0)
    }

    if (footerCols.length > 0) {
      footerTl.to(footerCols, {
        y: 0,
        opacity: 1,
        stagger: 0.08,
        ease: 'power2.out',
        duration: 0.7,
      }, 0.2)
    }

    if (footerDesignSvg) {
      footerTl.to(footerDesignSvg, {
        scale: 1,
        opacity: 1,
        ease: 'power3.out',
        duration: 0.8,
      }, 0.35)
    }

    if (footerBottomBar) {
      footerTl.to(footerBottomBar, {
        opacity: 1,
        duration: 0.5,
      }, 0.5)
    }

    return () => {
      if (produxTl.scrollTrigger) produxTl.scrollTrigger.kill()
      produxTl.kill()
      if (footerTl.scrollTrigger) footerTl.scrollTrigger.kill()
      footerTl.kill()
    }
  }, [])

  // 4. 顶部导航栏收缩滚动监听
  useEffect(() => {
    let ticking = false

    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          const currentY = window.scrollY || document.documentElement.scrollTop
          const track2 = section2TrackRef.current

          if (track2) {
            const track2Top = track2.offsetTop
            const headerStartY = Math.max(0, track2Top - 300)
            const headerEndY = track2Top - 60
            if (currentY <= headerStartY) {
              setHeaderProgress(0)
            } else if (currentY >= headerEndY) {
              setHeaderProgress(1)
            } else {
              setHeaderProgress((currentY - headerStartY) / (headerEndY - headerStartY))
            }
          }

          ticking = false
        })
        ticking = true
      }
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    window.addEventListener('resize', handleScroll, { passive: true })
    handleScroll()
    return () => {
      window.removeEventListener('scroll', handleScroll)
      window.removeEventListener('resize', handleScroll)
    }
  }, [])

  // 5. 区域 3 鼠标跟随磁吸 Lerp
  useEffect(() => {
    const track3 = section3TrackRef.current
    const cursorEl = cursorFollowerRef.current
    if (!track3 || !cursorEl) return undefined

    let targetX = 0
    let targetY = 0
    let currentX = 0
    let currentY = 0
    let rafId

    const onMouseMove = (e) => {
      targetX = e.clientX + 28
      targetY = e.clientY + 28
    }

    const onMouseEnter = () => {
      cursorEl.style.opacity = '1'
    }

    const onMouseLeave = () => {
      cursorEl.style.opacity = '0'
    }

    const renderLoop = () => {
      currentX += (targetX - currentX) * 0.18
      currentY += (targetY - currentY) * 0.18
      cursorEl.style.transform = `translate3d(${currentX}px, ${currentY}px, 0)`
      rafId = requestAnimationFrame(renderLoop)
    }
    rafId = requestAnimationFrame(renderLoop)

    track3.addEventListener('mousemove', onMouseMove)
    track3.addEventListener('mouseenter', onMouseEnter)
    track3.addEventListener('mouseleave', onMouseLeave)

    return () => {
      cancelAnimationFrame(rafId)
      track3.removeEventListener('mousemove', onMouseMove)
      track3.removeEventListener('mouseenter', onMouseEnter)
      track3.removeEventListener('mouseleave', onMouseLeave)
    }
  }, [])

  const currentTheme = SHOWCASE_THEMES[themeIndex]

  return (
    <HomeLayout>
      <div
        className="header-outer-wrapper"
        style={{
          '--scroll-p': headerProgress,
        }}
      >
        <header className="site-header">
          <div className="header-left">
            <div className="brand-logo">
              <div className="brand-logo">
                <img src={logoImg} alt="Logo" className="logo-img" />
                <span className="brand-name">PandaPaint</span>
              </div>
            </div>
          </div>
          <nav className="header-nav">
            <a href="#home" className="nav-link active" onClick={(e) => scrollToSection(e, 'home')}>首页</a>
            <a href="#solutions" className="nav-link" onClick={(e) => scrollToSection(e, 'solutions')}>解决方案</a>
            <a href="#explore" className="nav-link" onClick={(e) => scrollToSection(e, 'explore')}>探索</a>
            <a href="#about" className="nav-link" onClick={(e) => scrollToSection(e, 'about')}>关于我们</a>
          </nav>
          <div className="header-right">
            {currentUser ? (
              <div className="user-profile-menu">
                <span className="user-name">{currentUser.display_name}</span>
                <button type="button" className="btn-header-cta" onClick={onStartCreating}>进入工作台</button>
                <button type="button" className="btn-header-logout" onClick={onLogout}>退出</button>
              </div>
            ) : (
              <button type="button" className="btn-header-cta" onClick={onOpenAuth}>
                开始体验
              </button>
            )}
          </div>
        </header>
      </div>

      {/* ================= 区域 1：纯白背景区域（Hero + 画板） ================= */}
      <div className="first-viewport-section" id="home">
        <section className="hero-section">
          <p className="hero-badge">你的 AI 设计助手</p>
          <h1 className="hero-title">
            为
            <span className="gsap-underline-wrapper">
              <span className="gsap-measure-ghost" ref={brandMeasureRef}>
                {currentTheme.brandKeyword}
              </span>
              <span className="gsap-line-bar" ref={brandLineRef} />
              <span className="gsap-text-stage" ref={brandStageRef}>
                {currentTheme.brandKeyword.split('').map((char, i) => (
                  <span
                    key={`brand-${themeIndex}-${i}`}
                    ref={(el) => (brandCharsRef.current[i] = el)}
                    className="gsap-char"
                  >
                    {char}
                  </span>
                ))}
              </span>
            </span>
            <sup className="hero-sup">{currentTheme.sup}</sup>
            <br />
            设计一个
            <span className="gsap-underline-wrapper">
              <span className="gsap-measure-ghost" ref={targetMeasureRef}>
                {currentTheme.targetKeyword}
              </span>
              <span className="gsap-line-bar" ref={targetLineRef} />
              <span className="gsap-text-stage" ref={targetStageRef}>
                {currentTheme.targetKeyword.split('').map((char, i) => (
                  <span
                    key={`target-${themeIndex}-${i}`}
                    ref={(el) => (targetCharsRef.current[i] = el)}
                    className="gsap-char"
                  >
                    {char}
                  </span>
                ))}
              </span>
            </span>
          </h1>
          <div className="hero-actions">
            <button className="btn-hero-start" onClick={currentUser ? onStartCreating : onOpenAuth}>
              立即设计
            </button>
          </div>
        </section>

        <div className="showcase-container">
          <div
            className="showcase-window"
            style={{
              backgroundImage: `url(${currentTheme.windowBg})`,
            }}
          >
            <div className="showcase-inner-board">
              <div className="showcase-canvas">
                <div className="canvas-header-bar">
                  <span className="canvas-project-tag">
                    <span className="project-dot" />
                    {currentTheme.projectTag}
                  </span>
                </div>

                <div className="canvas-elements-grid">
                  <div className="canvas-card card-portrait" ref={card1Ref}>
                    <img
                      src={currentTheme.card1}
                      alt="Portrait Showcase"
                    />
                  </div>

                  <div className="canvas-card card-glasses" ref={card2Ref}>
                    <img
                      src={currentTheme.card2}
                      alt="Glasses Showcase"
                    />
                  </div>

                  <div className="canvas-card card-video selected" ref={card3Ref}>
                    <div className="card-badge">
                      <span className="video-tag">{currentTheme.card3Type}</span>
                      <span className="res">{currentTheme.card3Res}</span>
                    </div>
                    <img
                      src={currentTheme.card3}
                      alt="Media Showcase"
                    />
                    <div className="selection-handle top-left" />
                    <div className="selection-handle top-right" />
                    <div className="selection-handle bottom-left" />
                    <div className="selection-handle bottom-right" />
                  </div>
                </div>
              </div>

              <div className="showcase-sidebar">
                <div className="sidebar-header">
                  <span>新对话</span>
                </div>
                <div className="sidebar-chat">
                  <div className="chat-bubble-user" ref={chatBubbleUserRef}>
                    {currentTheme.userPrompt}
                  </div>

                  <div className="chat-steps">
                    <div className="step-item" ref={stepItem1Ref}>
                      <span className="step-icon">
                        <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" strokeWidth="2" fill="none"><rect x="3" y="3" width="18" height="18" rx="2"/></svg>
                      </span>
                      <span>已分析用户意图</span>
                    </div>
                    <div className="step-item" ref={stepItem2Ref}>
                      <span className="step-icon">
                        <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" strokeWidth="2" fill="none"><circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
                      </span>
                      <span>正在搜索高质量参考</span>
                    </div>
                  </div>

                  <div className="chat-ai-response" ref={chatAiResponseRef}>
                    <p>{currentTheme.aiResponse1}</p>
                    <p>{currentTheme.aiResponse2}</p>
                  </div>
                </div>

                <div className="sidebar-footer-input">
                  <input type="text" placeholder="你想设计什么？" readOnly />
                  <div className="footer-input-actions">
                    <span className="icon-btn">📎</span>
                    <button type="button" className="send-btn" aria-label="发送">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ================= 区域 2：吸顶多阶段生成动画轨迹 ================= */}
      <div
        className="system-section-track"
        id="solutions"
        ref={section2TrackRef}
      >
        <div className="system-section-sticky">
          <p className="system-badge">自主智能</p>
          <h2 className="system-title">以系统思维设计</h2>
          <div className="system-desc">
            <p>设计决策，并非一座孤岛。</p>
            <p>PandaPaint 将色彩、版式、语言统一为完整的品牌体系，</p>
            <p>从第一稿，到第一百稿。</p>
          </div>

          <div className="system-interactive-stage">
            <div className="stage-single-wrapper" ref={sec2SingleWrapperRef}>
              <div className="card-external-header">
                <span className="card-type-tag">
                  <LucideImageIcon />
                  Image
                </span>
                <span className="card-res-text">720 x 960</span>
              </div>

              <div className="system-image-card selected">
                <div className="image-frame">
                   <img
                      src={singleProductImg}
                      alt="Product design"
                    />
                </div>

                <div className="selection-handle top-left" />
                <div className="selection-handle top-right" />
                <div className="selection-handle bottom-left" />
                <div className="selection-handle bottom-right" />
              </div>

              <div className="interactive-slideup-dialog" ref={sec2DialogRef}>
                <div className="dialog-input-row">
                  <div className="dialog-tag-badge">
                    <span className="tag-icon">🎧</span>
                    <span className="tag-text">Headphones</span>
                  </div>
                  <div className="dialog-typing-text">
                    为该耳机品牌创建一套全渠道商业发售海报
                    <span className="blinking-cursor" />
                  </div>
                </div>

                <div className="dialog-actions-row">
                  <button type="button" className="action-btn" aria-label="添加附件">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>
                  </button>

                  <div className="action-right-group">
                    <button type="button" className="action-btn" aria-label="3D模式">
                      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>
                    </button>
                    <button type="button" className="action-submit-btn" aria-label="发送">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="stage-quad-grid">
              <div
                className="quad-card-unit card-1"
                ref={(el) => (sec2QuadCardsRef.current[0] = el)}
              >
                <div className="card-external-header">
                  <span className="card-type-tag">
                    <LucideImageIcon />
                    Image
                  </span>
                  <span className="card-res-text">720 x 960</span>
                </div>
                <div className="quad-card-box">
                  <div className="dark-base-bg" />
                  <div
                    className="light-spawn-overlay"
                    ref={(el) => (sec2SpawnsRef.current[0] = el)}
                  />
                  <div
                    className="generated-content"
                    ref={(el) => (sec2ContentsRef.current[0] = el)}
                  >
                    <img src={quadImg1} alt="Campaign Poster" />
                  </div>
                </div>
              </div>

              <div
                className="quad-card-unit card-2"
                ref={(el) => (sec2QuadCardsRef.current[1] = el)}
              >
                <div className="card-external-header">
                  <span className="card-type-tag">
                    <LucideImageIcon />
                    Image
                  </span>
                  <span className="card-res-text">720 x 960</span>
                </div>
                <div className="quad-card-box">
                  <div className="dark-base-bg" />
                  <div
                    className="light-spawn-overlay"
                    ref={(el) => (sec2SpawnsRef.current[1] = el)}
                  />
                  <div
                    className="generated-content"
                    ref={(el) => (sec2ContentsRef.current[1] = el)}
                  >
                    <img src={quadImg2} alt="Model Portrait" />
                  </div>
                </div>
              </div>

              <div
                className="quad-card-unit card-3"
                ref={(el) => (sec2QuadCardsRef.current[2] = el)}
              >
                <div className="card-external-header">
                  <span className="card-type-tag">
                    <LucideImageIcon />
                    Image
                  </span>
                  <span className="card-res-text">720 x 960</span>
                </div>
                <div className="quad-card-box">
                  <div className="dark-base-bg" />
                  <div
                    className="light-spawn-overlay"
                    ref={(el) => (sec2SpawnsRef.current[3] = el)}
                  />
                  <div
                    className="generated-content"
                    ref={(el) => (sec2ContentsRef.current[2] = el)}
                  >
                    <img src={quadImg3} alt="Product Macro Detail" />
                    <div className="poster-overlay-3">
                      <span className="macro-tag-top">Optical-grade lenses</span>
                      <div className="macro-bottom-info">
                        <h4 className="macro-title">Crafted in<br />Every Detail</h4>
                        <p className="macro-sub">Premium materials. Engineered<br />comfort.</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div
                className="quad-card-unit card-4"
                ref={(el) => (sec2QuadCardsRef.current[3] = el)}
              >
                <div className="card-external-header">
                  <span className="card-type-tag">
                    <LucideImageIcon />
                    Image
                  </span>
                  <span className="card-res-text">720 x 960</span>
                </div>
                <div className="quad-card-box">
                  <div className="dark-base-bg" />
                  <div
                    className="light-spawn-overlay"
                    ref={(el) => (sec2SpawnsRef.current[3] = el)}
                  />
                  <div
                    className="generated-content"
                    ref={(el) => (sec2ContentsRef.current[3] = el)}
                  >
                    <img src={quadImg4} alt="Car Window Model" />
                    <div className="poster-overlay-4">
                      <h3 className="poster-headline-4">An Accessory<br />That <em>Speaks</em></h3>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ================= 区域 3：Produx 缩放吸顶 + 文字遮罩截断 + 5列风琴自右向左平滑慢速滑入 ================= */}
      <div
        className="produx-section-track"
        id="explore"
        ref={section3TrackRef}
      >
        <div className="produx-section-sticky">
          <div className="mouse-cursor-follower" ref={cursorFollowerRef}>
            [SCROLL DOWN]
          </div>

          <div className="produx-top-bar">
            <div className="produx-svg-wordmark" ref={produxWordmarkRef}>
              <svg viewBox="0 0 167 201" fill="none" className="char-svg flex-d">
                <path d="M24 182.3V28.2H96.5C136.8 28.2 164.5 58.5 164.5 105.2C164.5 152 136.8 182.3 96.5 182.3H24ZM0 8.4V202.1H96.5C150.5 202.1 188.5 161.2 188.5 105.2C188.5 49.5 150.5 8.4 96.5 8.4H0Z" />
              </svg>
              <svg viewBox="0 0 148 201" fill="none" className="char-svg flex-e">
                <path d="M0 8.44H148V32.44H24V83.38H136V107.38H24V158.33H148V182.33H0V8.44Z" />
              </svg>
              <svg viewBox="0 0 152 201" fill="none" className="char-svg flex-s">
                <path d="M144 54.44H120C120 40 108 32.44 80 32.44C48 32.44 24 44 24 64C24 84 48 92 88 100C132 108 152 122 152 146C152 172 124 182.33 80 182.33C32 182.33 4 168 0 136H24C28 152 48 158.33 80 158.33C116 158.33 128 148 128 132C128 114 108 104 64 96C24 88 0 74 0 50C0 24 28 8.44 76 8.44C120 8.44 142 24 144 54.44Z" />
              </svg>
              <svg viewBox="0 0 24 201" fill="none" className="char-svg flex-i">
                <path d="M0 8.44H24V182.33H0V8.44Z" />
              </svg>
              <svg viewBox="0 0 172 201" fill="none" className="char-svg flex-g">
                <path d="M168 48H144C140 32 120 32.44 88 32.44C44 32.44 24 60 24 95.38C24 130.77 44 158.33 88 158.33C124 158.33 144 142 144 115.38H92V91.38H168V148C152 172 124 182.33 88 182.33C36 182.33 0 148 0 95.38C0 42.77 36 8.44 88 8.44C132 8.44 164 24 168 48Z" />
              </svg>
              <svg viewBox="0 0 165 201" fill="none" className="char-svg flex-n">
                <path d="M0 8.44H24V146L141 8.44H165V182.33H141V44.77L24 182.33H0V8.44Z" />
              </svg>
            </div>
          </div>

          {/* 文字遮罩层保持在风琴卡片舞台上方 (z-index: 35) */}
          <div className="manifesto-clip-mask-wrapper">
            <div className="manifesto-bottom-grid" ref={manifestoGridRef}>
              <div className="manifesto-left-headline">
                <div className="text-line-mask">
                  <span className="text-line-inner" ref={maskLine1Ref}>在灵感开口之前，</span>
                </div>
                <div className="text-line-mask">
                  <span className="text-line-inner" ref={maskLine2Ref}>视觉已然成型<sup>®</sup></span>
                </div>
              </div>

              <div className="manifesto-right-desc">
                <div className="text-line-mask">
                  <span className="text-line-inner" ref={maskDescRef}>
                    GPT-Image2 为追求极致审美的品牌团队与创作者打造专属视觉生产力体系，让散落的直觉与概念，在此沉淀为经得起时间推敲的商业级品牌大片。
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* 风琴卡片舞台保持在文字遮罩层底层 (z-index: 20) */}
          <div className="produx-accordion-stage" ref={accordionStageRef}>
            <div className="accordion-gallery-wrapper">
              {ACCORDION_ITEMS.map((item, index) => {
                const isActive = activeAccordionIndex === index
                const directionClass = index < 2 ? 'expand-from-left' : index > 2 ? 'expand-from-right' : 'expand-from-center'

                return (
                  <div
                    key={item.id}
                    ref={(el) => {
                      accordionCardsRef.current[index] = el
                    }}
                    className={`accordion-column-panel ${directionClass} ${isActive ? 'is-active' : ''}`}
                    onMouseEnter={() => setActiveAccordionIndex(index)}
                  >
                    <div
                      className="panel-background-image"
                      style={{ backgroundImage: `url(${item.image})` }}
                    />
                    <div className="panel-gradient-overlay" />

                    <div className="panel-badge-top">
                      {item.tag}
                    </div>

                    <div className="panel-content-bottom">
                      <h3 className="panel-title">{item.title}</h3>
                      <p className="panel-description">{item.desc}</p>
                      <button type="button" className="panel-link-btn">
                        {item.linkText}
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>

      {/* ================= 区域 4：现代优雅 Reveal Footer（GSAP 增强驱动） ================= */}
      <footer
        className="modern-reveal-footer"
        id="about"
        ref={modernFooterRef}
      >
        <div className="footer-content-container" ref={footerContentContainerRef}>
          <div className="footer-top-grid">
            <div className="footer-grid-col" ref={(el) => (footerColsRef.current[0] = el)}>
              <h4 className="col-header-label">导航 / MENU</h4>
              <ul className="footer-nav-list">
                <li><a href="#home" onClick={(e) => scrollToSection(e, 'home')}>[ 首页 WORK ]</a></li>
                <li><a href="#solutions" onClick={(e) => scrollToSection(e, 'solutions')}>[ 解决方案 SOLUTIONS ]</a></li>
                <li><a href="#explore" onClick={(e) => scrollToSection(e, 'explore')}>[ 探索灵感 EXPLORE ]</a></li>
                <li><a href="#about" onClick={(e) => scrollToSection(e, 'about')}>[ 关于我们 ABOUT ]</a></li>
              </ul>
            </div>

            <div className="footer-grid-col" ref={(el) => (footerColsRef.current[1] = el)}>
              <h4 className="col-header-label">关于平台 / ABOUT</h4>
              <div className="footer-address-block">
                <p>PandaPaint 智能设计工作台</p>
                <p className="address-sub">专为品牌与创意创作者打造的下一代 AI 视觉创作体系。</p>
                <p className="address-time">[ 24/7 自主智能协同 / 高清商业级渲染 ]</p>
              </div>
            </div>

            <div className="footer-grid-col col-newsletter" ref={(el) => (footerColsRef.current[2] = el)}>
              <h4 className="col-header-label">订阅资讯 / NEWSLETTER</h4>
              <form className="footer-newsletter-form" onSubmit={(e) => { e.preventDefault(); alert('感谢订阅 PandaPaint 动态！') }}>
                <div className="newsletter-input-box">
                  <input
                    type="email"
                    placeholder="输入您的电子邮箱..."
                    value={newsletterEmail}
                    onChange={(e) => setNewsletterEmail(e.target.value)}
                    required
                  />
                  <button type="submit" className="newsletter-send-btn" aria-label="Subscribe">
                    <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" strokeWidth="2" fill="none">
                      <line x1="22" y1="2" x2="11" y2="13" />
                      <polygon points="22 2 15 22 11 13 2 9 22 2" />
                    </svg>
                  </button>
                </div>
              </form>
              <p className="newsletter-desc-text">
                第一时间获取关于品牌系统、动态视觉生成与最新 AI 设计模型的精选动态与更新推送。
              </p>
            </div>
          </div>

          {/* 页脚标语：PANDAPAINT 自适应铺满巨幅字标 */}
          <div className="footer-design-svg-wordmark" ref={footerDesignSvgRef}>
            <div className="footer-brand-letters">
              {'PANDAPAINT'.split('').map((char, index) => (
                <span key={`footer-brand-char-${index}`} className="huge-brand-char">
                  {char}
                </span>
              ))}
            </div>
          </div>

          <div className="footer-bottom-bar" ref={footerBottomBarRef}>
            <div className="footer-bottom-links">
              <a href="#privacy">PRIVACY POLICY 隐私政策</a>
              <a href="#support">SUPPORT 服务支持</a>
              <a href="#terms">TERMS OF USE 使用条款</a>
            </div>
            <div className="footer-bottom-copyright">
              © {new Date().getFullYear()} PANDAPAINT DESIGN STUDIOS. ALL RIGHTS RESERVED.
            </div>
          </div>
        </div>
      </footer>
    </HomeLayout>
  )
}

function App() {
  const route = useRoute()
  const pathname = route.split('?')[0]
  const workbenchLaunch = parseWorkbenchLaunch(route)
  const userRoute = parseUserRoute(pathname)
  const isAdminRoute = pathname === '/admin' || pathname === '/admin/login' || pathname.startsWith('/admin/')
  const [authOpen, setAuthOpen] = useState(false)
  const [currentUser, setCurrentUser] = useState(null)
  const [authResolved, setAuthResolved] = useState(false)

  useEffect(() => {
    const canvases = document.querySelectorAll('canvas')
    canvases.forEach(c => {
      if (c.id === 'scene-canvas' || c.classList.contains('webgl-canvas')) {
        c.remove()
      }
    })
  }, [])

  useEffect(() => {
    const isWorkbench = pathname === '/workbench'
    const isUserPage = userRoute !== null
    document.body.classList.toggle('workbench-route', isWorkbench)
    document.body.classList.toggle('user-route', isUserPage)
    document.body.classList.toggle('admin-route', isAdminRoute)
    document.documentElement.classList.toggle('workbench-route', isWorkbench)
    document.documentElement.classList.toggle('user-route', isUserPage)
    document.documentElement.classList.toggle('admin-route', isAdminRoute)

    return () => {
      document.body.classList.remove('workbench-route')
      document.body.classList.remove('user-route')
      document.body.classList.remove('admin-route')
      document.documentElement.classList.remove('workbench-route')
      document.documentElement.classList.remove('user-route')
      document.documentElement.classList.remove('admin-route')
    }
  }, [pathname, userRoute, isAdminRoute])

  useEffect(() => {
    fetchJson('/api/auth/me')
      .then((data) => setCurrentUser(data.user))
      .catch(() => setCurrentUser(null))
      .finally(() => setAuthResolved(true))
  }, [])

  useEffect(() => {
    if (!authResolved || pathname !== '/' || !currentUser) return undefined
    const targetPath = currentUser.role === 'ADMIN'
      ? '/admin/dashboard'
      : `${encodeUserRoute(currentUser.id)}/home`
    window.history.replaceState({}, '', targetPath)
    window.dispatchEvent(new PopStateEvent('popstate'))
    return undefined
  }, [authResolved, currentUser, pathname])

  useEffect(() => {
    if (!userRoute || pathname !== userRoute.routeBase) return undefined
    window.history.replaceState({}, '', `${userRoute.routeBase}/home`)
    window.dispatchEvent(new PopStateEvent('popstate'))
    return undefined
  }, [pathname, userRoute])

  async function handleStartCreating() {
    try {
      const project = await fetchJson('/api/projects', {
        method: 'POST',
        body: JSON.stringify({ title: '未命名项目', initial_prompt: '开始创作' }),
      })
      navigate(`/workbench?projectId=${project.id}`)
    } catch (err) {
      window.alert(err instanceof Error ? err.message : '创建项目失败，请稍后重试。')
    }
  }

  async function handleLogout() {
    try {
      await fetchJson('/api/auth/logout', { method: 'POST' })
    } finally {
      setCurrentUser(null)
      setAuthOpen(false)
      if (pathname === '/workbench' || userRoute !== null || isAdminRoute) {
        navigate('/')
      }
    }
  }

  function handleAuthSuccess(user) {
    setCurrentUser(user)
    setAuthOpen(false)
    if (user.role === 'ADMIN') {
      navigate('/admin/dashboard')
      return
    }
    navigate(`${encodeUserRoute(user.id)}/home`)
  }

  function handleAdminLoginSuccess(user) {
    setCurrentUser(user)
    navigate('/admin/dashboard')
  }

  if (pathname === '/' && (!authResolved || currentUser)) {
    return null
  }

  if (pathname === '/admin') {
    navigate('/admin/dashboard')
    return null
  }

  if (pathname === '/admin/login') {
    return <AdminLoginPage onLoginSuccess={handleAdminLoginSuccess} onNavigateHome={() => navigate('/')} />
  }

  if (isAdminRoute) {
    return <AdminApp pathname={pathname} onNavigate={navigate} onLogout={handleLogout} />
  }

  if (pathname === '/workbench' && !currentUser) {
    return <Home onOpenAuth={() => setAuthOpen(true)} currentUser={currentUser} onLogout={handleLogout} />
  }

  if (userRoute !== null) {
    return (
      <UserPage
        userId={userRoute.userId}
        routeBase={userRoute.routeBase}
        childRoute={userRoute.childRoute}
        onNavigate={navigate}
        currentUser={currentUser}
        onLogout={handleLogout}
      />
    )
  }

  return (
    <>
      {pathname === '/workbench' ? (
        <Workbench
          key={workbenchLaunch.projectId || 'default'}
          projectId={workbenchLaunch.projectId}
          initialLaunchPrompt={workbenchLaunch.launchPrompt}
          initialLaunchRatio={workbenchLaunch.launchRatio}
          initialLaunchCount={workbenchLaunch.launchCount}
          initialLaunchModel={workbenchLaunch.launchModel}
        />
      ) : (
        <Home
          onOpenAuth={() => setAuthOpen(true)}
          onStartCreating={handleStartCreating}
          currentUser={currentUser}
          onLogout={handleLogout}
        />
      )}
      <AuthDialog open={authOpen} onClose={() => setAuthOpen(false)} onSuccess={handleAuthSuccess} />
    </>
  )
}

/* ================= 视觉样式 Styled-Components ================= */

const HomeLayout = styled.div`
  width: 100%;
  min-height: 100vh;
  position: relative;
  background-color: #ffffff;
  color: #111827;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif;

  .first-viewport-section {
    background-color: #ffffff;
    width: 100%;
    position: relative;
    z-index: 10;
  }

  .subsequent-sections-container {
    background-color: #f4f5f7;
    width: 100%;
    position: relative;
    z-index: 10;
  }

  /* 悬浮导航栏 */
  .header-outer-wrapper {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    width: 100%;
    z-index: 1000;
    display: flex;
    justify-content: center;
    pointer-events: none;
    
    padding-top: calc(var(--scroll-p) * 10px);
    transition: padding 0.2s ease;
  }

  .site-header {
    pointer-events: auto;
    display: flex;
    align-items: center;
    justify-content: space-between;

    width: calc(100% - (var(--scroll-p) * (100% - min(1000px, calc(100% - 36px)))));

    padding-left: calc((1 - var(--scroll-p)) * max(32px, calc((100% - 1360px) / 2)) + var(--scroll-p) * 20px);
    padding-right: calc((1 - var(--scroll-p)) * max(32px, calc((100% - 1360px) / 2)) + var(--scroll-p) * 20px);
    padding-top: calc(16px - var(--scroll-p) * 3px);
    padding-bottom: calc(16px - var(--scroll-p) * 3px);
    min-height: 54px;

    border-radius: calc(var(--scroll-p) * 999px);
    background: rgba(255, 255, 255, calc(0.92 - var(--scroll-p) * 0.06));
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    border: 1px solid rgba(15, 23, 42, calc(var(--scroll-p) * 0.08));
    box-shadow: 0 calc(var(--scroll-p) * 12px) calc(var(--scroll-p) * 36px) rgba(0, 0, 0, calc(var(--scroll-p) * 0.07)),
                0 calc(var(--scroll-p) * 2px) calc(var(--scroll-p) * 6px) rgba(0, 0, 0, calc(var(--scroll-p) * 0.02));
    transition: width 0.12s ease-out, border-radius 0.12s ease-out, padding 0.12s ease-out;
    will-change: width, padding, border-radius, box-shadow;

    @media (max-width: 768px) {
      padding: 12px 18px;
    }
  }

  .brand-logo {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .logo-img {
    width: 44px;          
    height: 44px;         
    object-fit: contain;  
    display: block;
  }

  .brand-name {
    font-weight: 500;
    font-size: 18px;
    letter-spacing: -0.5px;
    color: #0f172a;
  }

  .header-nav {
    display: flex;
    align-items: center;
    gap: 32px;

    @media (max-width: 768px) {
      display: none;
    }
  }

  .nav-link {
    color: #475569;
    text-decoration: none;
    font-size: 16px;
    font-weight: 400;
    transition: color 0.2s ease;
    cursor: pointer;

    &:hover, &.active {
      color: #0f172a;
    }
  }

  .btn-header-cta {
    background: #000000;
    color: #ffffff;
    border: none;
    padding: 12px 20px;
    border-radius: 999px;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;

    &:hover {
      background: #27272a;
      transform: translateY(-1px);
    }
  }

  .user-profile-menu {
    display: flex;
    align-items: center;
    gap: 12px;
    font-size: 13px;
  }

  .btn-header-logout {
    background: transparent;
    border: none;
    color: #64748b;
    cursor: pointer;
    font-size: 12px;
    &:hover { color: #ef4444; }
  }

  /* Hero 核心区域 */
  .hero-section {
    padding: 110px 24px 32px;
    text-align: center;
    display: flex;
    flex-direction: column;
    align-items: center;
  }

  .hero-badge {
    font-size: 13px;
    color: #64748b;
    font-weight: 500;
    letter-spacing: 0.5px;
    margin-bottom: 22px;
  }

  .hero-title {
    font-family: "Songti SC", "SimSun", "Noto Serif SC", serif, -apple-system;
    font-size: clamp(34px, 5.2vw, 62px);
    line-height: 1.45;
    font-weight: 400;
    color: #0f172a;
    letter-spacing: -0.5px;
    margin: 0 0 32px;
    min-height: 2.9em;
  }

  /* GSAP 物理阻尼与精准自适应横线舞台 */
  .gsap-underline-wrapper {
    display: inline-flex;
    align-items: baseline;
    position: relative;
    padding: 0 2px;
    margin: 0 2px;
    vertical-align: baseline;

    .gsap-measure-ghost {
      visibility: hidden;
      pointer-events: none;
      position: absolute;
      left: 0;
      top: 0;
      white-space: nowrap;
      height: 0;
      overflow: hidden;
    }

    .gsap-line-bar {
      position: absolute;
      left: 0;
      bottom: 2px;
      height: 1.5px;
      background-color: #0f172a;
      pointer-events: none;
      z-index: 1;
      will-change: width;
    }

    .gsap-text-stage {
      position: relative;
      z-index: 2;
      display: inline-flex;
      white-space: nowrap;
      will-change: transform, opacity, filter;
    }

    .gsap-char {
      display: inline-block;
      white-space: pre;
      will-change: transform, opacity, filter;
    }
  }

  .hero-sup {
    font-size: 0.4em;
    vertical-align: super;
    margin-left: 2px;
    font-family: -apple-system, sans-serif;
    color: #64748b;
  }

  .btn-hero-start {
    background: #000000;
    color: #ffffff;
    border: none;
    border-radius: 999px;
    padding: 20px 36px;
    font-size: 18px;
    font-weight: 500;
    cursor: pointer;
    box-shadow: 0 4px 18px rgba(0, 0, 0, 0.12);
    transition: all 0.25s ease;

    &:hover {
      background: #1e293b;
      transform: translateY(-2px);
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.18);
    }
  }

  /* 创意画板展示区容器 */
  .showcase-container {
    max-width: 1680px;
    margin: 30px auto 0;
    padding: 0 24px 140px;
    position: relative;
  }

  .showcase-window {
    background-color: #e2e8f0;
    background-position: center;
    background-size: cover;
    background-repeat: no-repeat;
    border-radius: 28px;
    padding: clamp(20px, 2.5vw, 36px) clamp(20px, 2.5vw, 36px) 0 clamp(20px, 2.5vw, 36px);
    box-sizing: border-box;
    position: relative;
    border: none;
    box-shadow: none;
    transition: background-image 0.6s cubic-bezier(0.16, 1, 0.3, 1);
  }

  .showcase-inner-board {
    background: #ffffff;
    border-radius: 24px 24px 0 0 !important; 
    overflow: hidden !important;
    border: none !important;
    box-shadow: none !important;
    display: grid;
    grid-template-columns: 1fr 340px;
    min-height: 860px;
    position: relative;
    z-index: 2;

    @media (max-width: 960px) {
      grid-template-columns: 1fr;
    }
  }

  .showcase-canvas {
    padding: 28px 36px 30px;
    display: flex;
    flex-direction: column;
    position: relative;
    background: #ffffff;
    border-right: 1px solid #f1f5f9;
    border-top-left-radius: 24px;
  }

  .canvas-header-bar {
    margin-bottom: 24px;
  }

  .canvas-project-tag {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    background: #ffffff;
    padding: 6px 14px;
    border-radius: 999px;
    font-size: 13px;
    font-weight: 500;
    color: #1e293b;
    border: 1px solid #e2e8f0;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.03);

    .project-dot {
      width: 10px;
      height: 10px;
      border-radius: 50%;
      background: #0f172a;
    }
  }

  .canvas-elements-grid {
    display: grid;
    grid-template-columns: repeat(12, 1fr);
    grid-gap: 24px;
    align-items: center;
    position: relative;
    height: 100%;
    min-height: 520px;
  }

  .canvas-card {
    border-radius: 14px;
    overflow: hidden;
    background: #fff;
    box-shadow: 0 16px 36px rgba(15, 23, 42, 0.08), 0 2px 6px rgba(0, 0, 0, 0.02);
    position: relative;
    transition: transform 0.2s ease, box-shadow 0.2s ease;
    will-change: transform, opacity, filter;

    &:hover {
      transform: translateY(-2px);
      box-shadow: 0 20px 40px rgba(15, 23, 42, 0.12);
    }

    img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
    }
  }

  .card-portrait {
    grid-column: 1 / 5;
    height: 380px;
  }

  .card-glasses {
    grid-column: 5 / 8;
    height: 440px;
  }

  .card-video {
    grid-column: 8 / 13;
    height: 320px;
    border: 2px solid #2563eb;

    .card-badge {
      position: absolute;
      top: 10px;
      left: 10px;
      right: 10px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 11px;
      color: #fff;
      text-shadow: 0 1px 3px rgba(0, 0, 0, 0.8);
      font-weight: 600;
      z-index: 2;
    }
  }

  .selection-handle {
    position: absolute;
    width: 8px;
    height: 8px;
    background: #fff;
    border: 1.5px solid #2563eb;
    border-radius: 1px;
    z-index: 3;

    &.top-left { top: -5px; left: -5px; }
    &.top-right { top: -5px; right: -5px; }
    &.bottom-left { bottom: -5px; left: -5px; }
    &.bottom-right { bottom: -5px; right: -5px; }
  }

  /* 右侧 AI 对话栏 */
  .showcase-sidebar {
    background: #ffffff;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    padding: 24px 24px 30px;
    border-top-right-radius: 24px;
  }

  .sidebar-header {
    font-size: 13px;
    font-weight: 600;
    color: #334155;
    margin-bottom: 20px;
  }

  .sidebar-chat {
    display: flex;
    flex-direction: column;
    gap: 16px;
    font-size: 13px;
    line-height: 1.6;
    flex: 1;
  }

  .chat-bubble-user {
    background: #f1f5f9;
    padding: 12px 14px;
    border-radius: 14px 14px 2px 14px;
    color: #334155;
    font-size: 12.5px;
    will-change: transform, opacity, filter;
  }

  .chat-steps {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 4px 0;
  }

  .step-item {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 12px;
    color: #475569;
    will-change: transform, opacity, filter;

    .step-icon {
      color: #64748b;
      display: flex;
      align-items: center;
    }
  }

  .chat-ai-response {
    color: #475569;
    font-size: 12px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    will-change: transform, opacity, filter;

    p {
      margin: 0;
    }
  }

  .sidebar-footer-input {
    margin-top: 20px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 12px;
    padding: 8px 12px;

    input {
      border: none;
      background: transparent;
      outline: none;
      font-size: 12px;
      color: #334155;
      width: 100%;
    }

    .footer-input-actions {
      display: flex;
      align-items: center;
      gap: 8px;

      .icon-btn {
        font-size: 13px;
        cursor: pointer;
        opacity: 0.6;
        &:hover { opacity: 1; }
      }

      .send-btn {
        width: 24px;
        height: 24px;
        border-radius: 50%;
        background: #0f172a;
        color: #fff;
        border: none;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
      }
    }
  }

  /* ================= 区域 2：吸顶多阶段生成动画轨迹 ================= */
  .system-section-track {
    position: relative;
    width: 100%;
    height: 480vh;
    background-color: #f4f5f7;
    border-top: 1px solid rgba(0, 0, 0, 0.04);
    z-index: 10;
  }

  .system-section-sticky {
    position: sticky;
    top: 0;
    left: 0;
    width: 100%;
    height: 100vh;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 10px 24px 24px;
    text-align: center;
    overflow: hidden;
  }

  .system-badge {
    font-size: 14px;
    color: #64748b;
    font-weight: 500;
    letter-spacing: 0.5px;
    margin-bottom: 12px;
  }

  .system-title {
    font-family: "Songti SC", "SimSun", "Noto Serif SC", serif, -apple-system;
    font-size: clamp(36px, 5vw, 58px);
    line-height: 1.35;
    font-weight: 400;
    color: #0f172a;
    letter-spacing: -0.5px;
    margin: 0 0 16px;
  }

  .system-desc {
    color: #475569;
    font-size: 15px;
    line-height: 1.85;
    margin-bottom: 48px;
    max-width: 620px;

    p {
      margin: 0;
    }
  }

  .system-interactive-stage {
    position: relative;
    width: 100%;
    max-width: 1600px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .card-external-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    margin-bottom: 6px;
    font-size: 11.5px;
    font-weight: 500;
    color: #475569;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    user-select: none;

    .card-type-tag {
      display: flex;
      align-items: center;
      gap: 5px;
      color: #334155;

      svg {
        stroke: currentColor;
        stroke-width: 2;
        flex-shrink: 0;
      }
    }

    .card-res-text {
      color: #64748b;
      font-feature-settings: "tnum";
    }
  }

  .stage-single-wrapper {
    position: absolute;
    display: flex;
    flex-direction: column;
    align-items: center;
    width: min(380px, 86vw);
    z-index: 2;
    will-change: transform, opacity, filter;
  }

  .system-image-card {
    position: relative;
    width: 100%;
    height: 506px;
    background: #111827;
    border-radius: 0px;
    overflow: hidden;
    border: 1.5px solid #2563eb;
    box-shadow: 0 24px 50px rgba(15, 23, 42, 0.08);

    .image-frame {
      width: 100%;
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      background: radial-gradient(circle at center, #1f2937 0%, #030712 100%);

      img {
        width: 88%;
        height: 88%;
        object-fit: contain;
        filter: drop-shadow(0 14px 24px rgba(0, 0, 0, 0.5));
      }
    }
  }

  .interactive-slideup-dialog {
    position: absolute;
    bottom: -48px;
    width: min(560px, 92vw);
    background: rgba(255, 255, 255, 0.95);
    backdrop-filter: blur(24px);
    -webkit-backdrop-filter: blur(24px);
    border: 1px solid rgba(0, 0, 0, 0.08);
    border-radius: 20px;
    padding: 16px 20px;
    box-shadow: 0 20px 50px rgba(15, 23, 42, 0.12), 0 2px 8px rgba(0, 0, 0, 0.04);
    z-index: 10;
    display: flex;
    flex-direction: column;
    gap: 16px;
    will-change: transform, opacity;
  }

  .dialog-input-row {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .dialog-tag-badge {
    display: flex;
    align-items: center;
    gap: 6px;
    background: #f1f5f9;
    padding: 6px 14px;
    border-radius: 999px;
    font-size: 13px;
    font-weight: 500;
    color: #1e293b;
    flex-shrink: 0;
  }

  .dialog-typing-text {
    font-size: 14px;
    color: #334155;
    display: flex;
    align-items: center;
    letter-spacing: 0.2px;
  }

  .blinking-cursor {
    display: inline-block;
    width: 1.5px;
    height: 16px;
    background: #0f172a;
    margin-left: 4px;
    animation: blinkAnim 1s infinite;
  }

  @keyframes blinkAnim {
    0%, 100% { opacity: 1; }
    50% { opacity: 0; }
  }

  .dialog-actions-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding-top: 4px;

    .action-btn {
      background: transparent;
      border: none;
      color: #64748b;
      display: flex;
      align-items: center;
      justify-content: center;
      width: 32px;
      height: 32px;
      border-radius: 50%;
      cursor: pointer;
      transition: color 0.2s ease, background-color 0.2s ease;

      &:hover {
        color: #0f172a;
        background: #f1f5f9;
      }
    }

    .action-right-group {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .action-submit-btn {
      width: 32px;
      height: 32px;
      border-radius: 50%;
      background: #0f172a;
      border: none;
      color: #ffffff;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      box-shadow: 0 2px 6px rgba(0, 0, 0, 0.15);
      transition: transform 0.2s ease, background-color 0.2s ease;

      &:hover {
        background: #000000;
        transform: scale(1.05);
      }
    }
  }

  /* 阶段 2 & 3：4 张纯直角卡片单元 */
  .stage-quad-grid {
    width: 100%;
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 16px;
    align-items: flex-start;
    justify-content: center;

    @media (max-width: 1024px) {
      grid-template-columns: repeat(2, 1fr);
      gap: 12px;
    }
  }

  .quad-card-unit {
    position: relative;
    width: 100%;
    display: flex;
    flex-direction: column;
    will-change: opacity, transform;
    transform-origin: center center;
  }

  .quad-card-box {
    position: relative;
    width: 100%;
    aspect-ratio: 3 / 4;
    border-radius: 0px;
    overflow: hidden;
    background: #38383a;
    box-shadow: 0 14px 36px rgba(0, 0, 0, 0.08);

    .dark-base-bg {
      position: absolute;
      inset: 0;
      background: #38383a;
      border-radius: 0px;
      z-index: 1;
    }

    .light-spawn-overlay {
      position: absolute;
      inset: 0;
      background: #a8a8ac;
      border-radius: 0px;
      z-index: 2;
      will-change: opacity;
    }

    .generated-content {
      position: absolute;
      inset: 0;
      border-radius: 0px;
      z-index: 3;
      overflow: hidden;
      will-change: opacity, filter, transform;

      img {
        width: 100%;
        height: 100%;
        object-fit: contain;
        display: block;
        border-radius: 0px;
      }
    }
  }

  .poster-overlay-1 {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    padding: 24px 18px 20px;
    z-index: 5;
    text-align: center;
    background: linear-gradient(180deg, rgba(0, 0, 0, 0.45) 0%, rgba(0, 0, 0, 0) 35%, rgba(0, 0, 0, 0.3) 100%);

    .poster-headline-1 {
      font-size: clamp(17px, 1.8vw, 22px);
      font-weight: 700;
      color: #ffffff;
      line-height: 1.22;
      letter-spacing: -0.4px;
      text-shadow: 0 2px 8px rgba(0, 0, 0, 0.5);
      margin: 0;
    }

    .poster-btn-1 {
      align-self: center;
      background: rgba(15, 23, 42, 0.75);
      backdrop-filter: blur(8px);
      color: #ffffff;
      border: 1px solid rgba(255, 255, 255, 0.35);
      padding: 7px 18px;
      border-radius: 999px;
      font-size: 11.5px;
      font-weight: 500;
    }
  }

  .poster-overlay-2 {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    justify-content: flex-end;
    padding: 24px 18px;
    z-index: 5;
    text-align: center;
    background: linear-gradient(180deg, rgba(0, 0, 0, 0.4) 0%, rgba(0, 0, 0, 0.65) 100%);

    .poster-headline-2 {
      font-family: "Songti SC", "SimSun", "Noto Serif SC", serif;
      font-size: clamp(18px, 2vw, 24px);
      font-weight: 400;
      color: #fbd38d;
      line-height: 1.25;
      margin: 0;
      text-shadow: 0 2px 8px rgba(0, 0, 0, 0.7);
    }
  }

  .poster-overlay-3 {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    padding: 18px;
    z-index: 5;
    text-align: right;
    color: #ffffff;

    .macro-tag-top {
      font-size: 10px;
      color: rgba(255, 255, 255, 0.7);
      letter-spacing: 0.2px;
    }

    .macro-bottom-info {
      text-align: right;
      text-shadow: 0 1px 4px rgba(0, 0, 0, 0.8);

      .macro-title {
        font-size: 14px;
        font-weight: 700;
        line-height: 1.25;
        margin: 0 0 4px;
      }

      .macro-sub {
        font-size: 9.5px;
        color: rgba(255, 255, 255, 0.75);
        margin: 0;
        line-height: 1.35;
      }
    }
  }

  .poster-overlay-4 {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    justify-content: flex-start;
    padding: 24px 18px;
    z-index: 5;
    text-align: center;
    background: linear-gradient(180deg, rgba(255, 255, 255, 0.5) 0%, rgba(255, 255, 255, 0) 40%);

    .poster-headline-4 {
      font-family: "Songti SC", "SimSun", "Noto Serif SC", serif;
      font-size: clamp(18px, 2vw, 24px);
      font-weight: 400;
      color: #1e3a8a;
      line-height: 1.25;
      margin: 0;

      em {
        font-style: italic;
      }
    }
  }

  /* ================= 区域 3：Produx 缩放吸顶 + 文字遮罩截断 + 5列风琴自右向左平滑慢速滑入 ================= */
  .produx-section-track {
    position: relative;
    width: 100%;
    height: 720vh;
    background-color: #000000;
    border-top: 1px solid rgba(255, 255, 255, 0.06);
    z-index: 20;
  }

  .produx-section-sticky {
    position: sticky;
    top: 0;
    left: 0;
    width: 100%;
    height: 100vh;
    box-sizing: border-box;
    padding: clamp(36px, 5vh, 60px) clamp(24px, 4.5vw, 64px);
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    background-color: #000000;
    color: #ffffff;
    overflow: hidden;
    z-index: 20;
  }

  .mouse-cursor-follower {
    position: fixed;
    top: 0;
    left: 0;
    pointer-events: none;
    z-index: 100;
    font-family: 'JetBrains Mono', 'SF Mono', Menlo, Monaco, Consolas, monospace;
    font-size: 18px;
    letter-spacing: 1.5px;
    color: #e4e4e7;
    opacity: 0;
    transition: opacity 0.2s ease;
    will-change: transform, opacity;
    user-select: none;
    white-space: nowrap;
    text-shadow: 0 1px 4px rgba(0, 0, 0, 0.8);
  }

  .produx-top-bar {
    position: relative;
    width: 100%;
    display: block;
    z-index: 25;
  }

  .produx-svg-wordmark {
    display: flex;
    justify-content: space-between;
    align-items: center;
    width: 100%;
    user-select: none;
    margin-top: 40px;
    will-change: transform;

    .char-svg {
      height: clamp(80px, 17.5vw, 300px);
      width: auto;
      display: block;

      path {
        fill: #f2f2f2;
        stroke: #f2f2f2;
        stroke-width: 4px;
      }
    }

    .flex-d { flex: 167; }
    .flex-e { flex: 148; }
    .flex-s { flex: 152; }
    .flex-i { flex: 42; }
    .flex-g { flex: 172; }
    .flex-n { flex: 165; }
  }

  /* 核心修复：文字遮罩容器层级设为 35，置于风琴卡片 (z-index: 20) 之上，不被飞入的卡片遮盖 */
  .manifesto-clip-mask-wrapper {
    position: absolute;
    top: clamp(40px, 6vh, 70px);
    left: 0;
    right: 0;
    bottom: 0;
    overflow: hidden; 
    padding: 0 clamp(24px, 4.5vw, 64px);
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    justify-content: flex-end;
    pointer-events: none;
    z-index: 35;
  }

  .manifesto-bottom-grid {
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    gap: 40px;
    width: 100%;
    margin: 0;
    padding-left: 30px;
    padding-right: 30px;
    margin-bottom: 190px;
    position: relative;
    z-index: 35;
    will-change: transform;

    @media (max-width: 960px) {
      flex-direction: column;
      align-items: flex-start;
      gap: 24px;
    }
  }

  .text-line-mask {
    overflow: hidden;
    display: block;
    position: relative;
    padding-bottom: 4px;
  }

  .text-line-inner {
    display: block;
    opacity: 1 !important;
    will-change: transform;
  }

  .manifesto-left-headline {
    font-size: clamp(34px, 5vw, 76px);
    font-weight: 600;
    line-height: 1.15;
    color: #ffffff;
    letter-spacing: -1px;

    sup {
      font-size: 0.42em;
      font-weight: 400;
      vertical-align: super;
      margin-left: 4px;
      color: #71717a;
    }
  }

  .manifesto-right-desc {
    font-family: 'JetBrains Mono', 'SF Mono', Menlo, Monaco, Consolas, monospace;
    font-size: clamp(14px, 1.2vw, 18px);
    line-height: 1.85;
    color: #a1a1aa;
    max-width: 520px;
    letter-spacing: -0.2px;
  }

  /* 核心修复：风琴卡片舞台置于文字底层 (z-index: 20)，卡片在文字下方滑入 */
  .produx-accordion-stage {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 20;
    padding: 0 clamp(24px, 4vw, 64px);
    box-sizing: border-box;
    pointer-events: auto;
    will-change: transform;
  }

  .accordion-gallery-wrapper {
    position: relative;
    width: 100%;
    max-width: 1680px;
    height: min(660px, 62vh);
    display: flex;
    gap: 30px;
    align-items: stretch;
    box-sizing: border-box;
    pointer-events: auto;
  }

  .accordion-column-panel {
    position: relative;
    flex: 1.5;
    border-radius: 0px;
    overflow: hidden;
    cursor: pointer;
    background-color: #000000;
    transition: flex 0.95s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.6s ease;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    padding: 26px;
    box-sizing: border-box;
    will-change: transform, opacity, filter, flex;
    pointer-events: auto;

    .panel-background-image {
      position: absolute;
      inset: 0;
      background-size: cover;
      background-repeat: no-repeat;
      z-index: 1;
      transform: scale(1.02);
      filter: brightness(0.85) contrast(0.85);
      transition: transform 1.2s cubic-bezier(0.16, 1, 0.3, 1), filter 0.8s cubic-bezier(0.16, 1, 0.3, 1);
      pointer-events: none;
    }

    .panel-gradient-overlay {
      position: absolute;
      inset: 0;
      background: rgba(0, 0, 0, 0.55);
      z-index: 2;
      pointer-events: none;
      transition: background 0.8s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.8s cubic-bezier(0.16, 1, 0.3, 1);
    }

    &.expand-from-left {
      transform-origin: left center;
      .panel-background-image {
        background-position: left center;
      }
      .panel-content-bottom {
        align-items: flex-start;
        text-align: left;
      }
    }

    &.expand-from-center {
      transform-origin: center center;
      .panel-background-image {
        background-position: center center;
      }
      .panel-content-bottom {
        align-items: flex-start;
        text-align: left;
      }
    }

    &.expand-from-right {
      transform-origin: right center;
      .panel-background-image {
        background-position: right center;
      }
      .panel-content-bottom {
        align-items: flex-start;
        text-align: left;
      }
    }

    &.is-active {
      flex: 4.8;
      box-shadow: 0 24px 70px rgba(0, 0, 0, 0.95);

      .panel-background-image {
        transform: scale(1.08);
        filter: brightness(1.0) contrast(1.0);
      }

      .panel-gradient-overlay {
        background: linear-gradient(180deg, rgba(0, 0, 0, 0) 0%, rgba(0, 0, 0, 0) 45%, rgba(0, 0, 0, 0.7) 100%);
      }

      .panel-badge-top {
        background: rgba(255, 255, 255, 0.22);
        color: #ffffff;
        border-color: rgba(255, 255, 255, 0.4);
      }

      .panel-content-bottom {
        pointer-events: auto;
      }

      .panel-title {
        opacity: 1;
        transform: translateY(0);
        transition-delay: 0.18s;
      }

      .panel-description {
        opacity: 1;
        transform: translateY(0);
        transition-delay: 0.30s;
      }

      .panel-link-btn {
        opacity: 1;
        transform: translateY(0);
        transition-delay: 0.42s;
      }
    }
  }

  .panel-badge-top {
    position: relative;
    z-index: 5;
    align-self: flex-end;
    background: rgba(20, 20, 20, 0.7);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    color: #a1a1aa;
    font-size: 11px;
    font-weight: 500;
    padding: 4px 12px;
    border-radius: 0px;
    letter-spacing: 0.4px;
    user-select: none;
    border: 1px solid rgba(255, 255, 255, 0.08);
    pointer-events: none;
    transition: background 0.5s ease, color 0.5s ease, border-color 0.5s ease;
  }

  .panel-content-bottom {
    position: relative;
    z-index: 5;
    display: flex;
    flex-direction: column;
    pointer-events: none;
    max-width: 480px;
  }

  .panel-title {
    font-size: clamp(22px, 2.2vw, 32px);
    font-weight: 700;
    color: #ffffff;
    margin: 0 0 8px;
    line-height: 1.15;
    letter-spacing: -0.5px;
    text-shadow: 0 2px 12px rgba(0, 0, 0, 0.85);

    opacity: 0;
    transform: translateY(36px);
    transition: opacity 0.85s cubic-bezier(0.16, 1, 0.3, 1), transform 0.85s cubic-bezier(0.16, 1, 0.3, 1);
    will-change: opacity, transform;
  }

  .panel-description {
    font-size: clamp(12px, 1vw, 14px);
    color: #e4e4e7;
    line-height: 1.55;
    margin: 0 0 16px;
    font-family: 'JetBrains Mono', 'SF Mono', monospace;
    text-shadow: 0 1px 8px rgba(0, 0, 0, 0.9);

    opacity: 0;
    transform: translateY(36px);
    transition: opacity 0.85s cubic-bezier(0.16, 1, 0.3, 1), transform 0.85s cubic-bezier(0.16, 1, 0.3, 1);
    will-change: opacity, transform;
  }

  .panel-link-btn {
    background: transparent;
    border: none;
    padding: 0;
    color: #ffffff;
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 1px;
    text-decoration: underline;
    text-underline-offset: 4px;
    cursor: pointer;
    font-family: 'JetBrains Mono', monospace;

    opacity: 0;
    transform: translateY(36px);
    transition: opacity 0.85s cubic-bezier(0.16, 1, 0.3, 1), transform 0.85s cubic-bezier(0.16, 1, 0.3, 1), color 0.25s ease;
    will-change: opacity, transform;

    &:hover {
      color: #93c5fd;
    }
  }

  /* ================= 区域 4：现代优雅 Reveal Footer ================= */
  .modern-reveal-footer {
    position: sticky;
    bottom: 0;
    left: 0;
    width: 100%;
    min-height: 75vh;
    background-color: #ffffff;
    color: #09090b;
    z-index: 1;
    box-sizing: border-box;
    padding: 48px clamp(24px, 4.5vw, 64px) 10px;
    display: flex;
    flex-direction: column;
    justify-content: center;
    font-family: 'JetBrains Mono', 'SF Mono', Menlo, Monaco, Consolas, -apple-system, sans-serif;
    overflow: hidden;
  }

  .footer-content-container {
    width: 100%;
    max-width: 1680px;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    gap: clamp(40px, 6vh, 60px);
    will-change: transform, opacity, filter;
  }

  .footer-top-grid {
    display: grid;
    grid-template-columns: 1.1fr 1.4fr 1.8fr;
    gap: 48px;

    @media (max-width: 1024px) {
      grid-template-columns: 1fr 1fr;
      gap: 36px;
    }

    @media (max-width: 640px) {
      grid-template-columns: 1fr;
      gap: 28px;
    }
  }

  .footer-grid-col {
    display: flex;
    flex-direction: column;
    will-change: transform, opacity;
  }

  .col-header-label {
    font-size: 13px;
    font-weight: 600;
    color: #71717a;
    letter-spacing: 1.5px;
    margin: 0 0 20px;
  }

  .footer-nav-list {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 12px;

    li a {
      color: #09090b;
      text-decoration: none;
      font-size: 14px;
      font-weight: 500;
      letter-spacing: 0.5px;
      transition: color 0.2s ease, transform 0.2s ease;
      display: inline-block;
      cursor: pointer;

      &:hover {
        color: #2563eb;
        transform: translateX(4px);
      }
    }
  }

  .footer-address-block {
    display: flex;
    flex-direction: column;
    gap: 8px;
    font-size: 14px;
    color: #09090b;
    line-height: 1.5;

    p {
      margin: 0;
    }

    .address-sub {
      color: #71717a;
      font-size: 13px;
    }

    .address-time {
      font-size: 12px;
      color: #a1a1aa;
      margin-top: 6px;
    }
  }

  .footer-newsletter-form {
    margin-bottom: 14px;
  }

  .newsletter-input-box {
    display: flex;
    align-items: center;
    background: #f4f4f5;
    border: 1px solid #e4e4e7;
    border-radius: 2px;
    padding: 4px 6px 4px 14px;
    transition: border-color 0.2s ease, background-color 0.2s ease;

    &:focus-within {
      border-color: #09090b;
      background: #ffffff;
    }

    input {
      flex: 1;
      border: none;
      background: transparent;
      outline: none;
      font-family: inherit;
      font-size: 13px;
      color: #09090b;
      letter-spacing: 0.5px;

      &::placeholder {
        color: #a1a1aa;
      }
    }

    .newsletter-send-btn {
      width: 32px;
      height: 32px;
      background: #09090b;
      color: #ffffff;
      border: none;
      border-radius: 2px;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: background-color 0.2s ease, transform 0.2s ease;

      &:hover {
        background: #27272a;
        transform: scale(1.05);
      }
    }
  }

  .newsletter-desc-text {
    font-size: 12.5px;
    color: #71717a;
    line-height: 1.6;
    margin: 0;
    max-width: 440px;
  }

  /* 页脚超大 PANDAPAINT 排版 */
  .footer-design-svg-wordmark {
    display: flex;
    justify-content: space-between;
    align-items: center;
    width: 100%;
    user-select: none;
    border-top: 1px solid #f4f4f5;
    padding-top: 24px;
    will-change: transform, opacity;
  }

  .footer-brand-letters {
    display: flex;
    justify-content: space-between;
    align-items: center;
    width: 100%;
    line-height: 0.85;

    .huge-brand-char {
      font-family: "Impact", "Arial Black", "SF Pro Display", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      font-size: clamp(40px, 12.2vw, 210px);
      font-weight: 900;
      color: #09090b;
      display: inline-block;
      letter-spacing: -0.01em;
      transform: scaleY(1.04);
      user-select: none;
    }
  }

  .footer-bottom-bar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-top: 1px solid #e4e4e7;
    padding-top: 24px;
    font-size: 12px;
    color: #71717a;
    will-change: opacity;

    @media (max-width: 768px) {
      flex-direction: column;
      align-items: flex-start;
      gap: 14px;
    }
  }

  .footer-bottom-links {
    display: flex;
    align-items: center;
    gap: 24px;

    a {
      color: #71717a;
      text-decoration: none;
      letter-spacing: 0.5px;
      transition: color 0.2s ease;

      &:hover {
        color: #09090b;
      }
    }
  }

  .footer-bottom-copyright {
    letter-spacing: 0.5px;
  }
`;

/* ================= Lovart 官方同款极简登录弹窗 Styled-Components ================= */

const LovartAuthModalShell = styled.div`
  position: fixed;
  inset: 0;
  z-index: 2000;
  display: grid;
  place-items: center;
  padding: 24px;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif;

  .modal-backdrop {
    position: absolute;
    inset: 0;
    background: rgba(10, 12, 16, 0.65);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
  }

  .modal-card-box {
    position: relative;
    z-index: 10;
    width: min(420px, calc(100vw - 32px));
    background: #f7f7f8;
    border: 1px solid rgba(255, 255, 255, 0.8);
    border-radius: 24px;
    padding: 36px 32px 28px;
    box-shadow: 0 24px 60px rgba(0, 0, 0, 0.22), 0 2px 8px rgba(0, 0, 0, 0.06);
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    will-change: transform, opacity, filter, height;
    overflow: hidden;
  }

  .close-action-btn {
    position: absolute;
    top: 18px;
    right: 18px;
    background: transparent;
    border: none;
    color: #71717a;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 6px;
    border-radius: 50%;
    transition: all 0.2s ease;

    &:hover {
      color: #09090b;
      background: rgba(0, 0, 0, 0.05);
    }
  }

  .modal-top-brand {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 24px;

    .modal-brand-logo-img {
      width: 56px;
      height: 56px;
      object-fit: contain;
      display: block;
    }

    .brand-title-text {
      font-weight: 700;
      font-size: 18px;
      letter-spacing: -0.5px;
      color: #09090b;
    }
  }

  .modal-main-heading {
    font-size: 24px;
    font-weight: 700;
    color: #09090b;
    margin: 0 0 6px;
    letter-spacing: -0.5px;
  }

  .modal-sub-heading {
    font-size: 13px;
    color: #71717a;
    margin: 0 0 24px;
  }

  .oauth-buttons-group {
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: 10px;
    margin-bottom: 16px;
  }

  /* 原生定制 Google 按钮样式（常显且质感极高） */
  .custom-google-auth-btn {
    width: 100%;
    height: 46px;
    background: #ffffff;
    border: 1px solid #e4e4e7;
    border-radius: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    font-size: 14px;
    font-weight: 500;
    color: #18181b;
    cursor: pointer;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
    transition: background-color 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease, transform 0.15s ease;

    &:hover {
      background: #fafafa;
      border-color: #d4d4d8;
      box-shadow: 0 2px 6px rgba(0, 0, 0, 0.06);
      transform: translateY(-1px);
    }

    &:active {
      transform: translateY(0);
    }

    &:disabled {
      opacity: 0.6;
      cursor: wait;
    }

    .google-svg-icon {
      flex-shrink: 0;
    }
  }

  .lovart-form-body {
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .input-group {
    width: 100%;
    position: relative;
    box-sizing: border-box;
    will-change: transform, opacity, filter;

    input {
      width: 100%;
      height: 46px;
      background: #ffffff;
      border: 1px solid #e4e4e7;
      border-radius: 10px;
      padding: 0 14px;
      font-size: 13.5px;
      color: #09090b;
      outline: none;
      box-sizing: border-box;
      transition: border-color 0.2s ease, box-shadow 0.2s ease;

      &::placeholder {
        color: #a1a1aa;
      }

      &:focus {
        border-color: #09090b;
        box-shadow: 0 0 0 2px rgba(9, 9, 11, 0.08);
      }
    }
  }

  .email-row {
    position: relative;
    .send-code-link {
      position: absolute;
      right: 12px;
      top: 50%;
      transform: translateY(-50%);
      background: transparent;
      border: none;
      color: #2563eb;
      font-size: 12px;
      font-weight: 500;
      cursor: pointer;
      padding: 4px;
      &:disabled { color: #a1a1aa; cursor: not-allowed; }
    }
  }

  .auth-tip-error {
    background: #fef2f2;
    color: #b91c1c;
    border: 1px solid #fecaca;
    padding: 8px 12px;
    border-radius: 8px;
    font-size: 12px;
    text-align: left;
  }

  .submit-black-btn {
    width: 100%;
    height: 46px;
    background: #111317;
    color: #ffffff;
    border: none;
    border-radius: 10px;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    margin-top: 4px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
    transition: all 0.2s ease;

    &:hover {
      background: #27272a;
      transform: translateY(-1px);
    }
  }

  .mode-toggle-footer {
    margin-top: 14px;
    font-size: 12px;
    color: #71717a;

    p {
      margin: 0;
    }

    span {
      color: #09090b;
      font-weight: 600;
      cursor: pointer;
      text-decoration: underline;
      text-underline-offset: 3px;
      transition: color 0.2s ease;
      &:hover { color: #2563eb; }
    }
  }

  .legal-terms-text {
    margin-top: 18px;
    font-size: 11px;
    color: #a1a1aa;
    line-height: 1.5;

    a {
      color: #71717a;
      text-decoration: underline;
      text-underline-offset: 2px;
    }
  }
`;

// 根组件包裹 GoogleOAuthProvider
createRoot(document.getElementById('root')).render(
  <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
    <App />
  </GoogleOAuthProvider>
)