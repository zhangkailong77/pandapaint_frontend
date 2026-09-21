const STORAGE_KEY = 'gpt-image2-workbench-scene:v1'
const MAX_SCENE_ITEMS = 60

export const WORKBENCH_EXAMPLES = [
  '一个半透明海蓝色香水瓶漂浮在发光粒子之间，电影级产品摄影，高级杂志光线',
  '一个未来感 AI 生图工作台倒映在深海水面中，玻璃面板，蓝色发光控件，细节丰富',
  '创始人在展示新的创意工具，发光的图像草稿像深海鱼群一样环绕桌面',
]

export const WORKBENCH_PRESET_RATIOS = ['16:9', '1:1', '4:5', '9:16']

export function createId(prefix = 'item') {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-4)}`
}

export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}

export function formatHistoryTime(value) {
  if (!value) return '刚刚生成'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '刚刚生成'
  return date.toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
}

export function downloadImage(src, filename) {
  const link = document.createElement('a')
  link.href = src
  link.download = filename
  link.rel = 'noopener'
  document.body.appendChild(link)
  link.click()
  link.remove()
}

export function downloadAllImages(images) {
  images.forEach((image, index) => {
    setTimeout(() => downloadImage(image.src, `gpt-image2-${index + 1}.png`), index * 120)
  })
}

export function normalizeGeneratedImage(image) {
  if (image?.url) return image.url
  if (image?.b64_json) return `data:image/png;base64,${image.b64_json}`
  return null
}

export function extractGeneratedImages(result) {
  const data = result?.provider_response?.data || []
  return data
    .map((image) => {
      const src = normalizeGeneratedImage(image)
      return src ? { src } : null
    })
    .filter(Boolean)
}

export function ratioToFrame(ratio, fallbackWidth = 320) {
  const map = {
    '16:9': [16, 9],
    '1:1': [1, 1],
    '4:5': [4, 5],
    '9:16': [9, 16],
  }
  const [w, h] = map[ratio] || map['16:9']
  return {
    width: fallbackWidth,
    height: Math.round((fallbackWidth * h) / w),
  }
}

export function screenToWorld(point, viewport) {
  return {
    x: (point.x - viewport.x) / viewport.zoom,
    y: (point.y - viewport.y) / viewport.zoom,
  }
}

export function worldToScreen(point, viewport) {
  return {
    x: point.x * viewport.zoom + viewport.x,
    y: point.y * viewport.zoom + viewport.y,
  }
}

export function getViewportCenter(rect, viewport) {
  if (!rect?.width || !rect?.height) {
    return screenToWorld({ x: window.innerWidth / 2, y: window.innerHeight / 2 }, viewport)
  }

  return screenToWorld({
    x: rect.left + rect.width / 2,
    y: rect.top + rect.height / 2,
  }, viewport)
}

export function createSceneSnapshot(viewport, items) {
  return {
    version: 1,
    updatedAt: new Date().toISOString(),
    viewport,
    items: items.slice(-MAX_SCENE_ITEMS),
  }
}

export function sanitizeSceneSnapshot(raw) {
  if (!raw || typeof raw !== 'object') {
    return null
  }

  const viewport = raw.viewport && Number.isFinite(raw.viewport.x) && Number.isFinite(raw.viewport.y) && Number.isFinite(raw.viewport.zoom)
    ? {
        x: raw.viewport.x,
        y: raw.viewport.y,
        zoom: clamp(raw.viewport.zoom, 0.2, 3),
      }
    : { x: 0, y: 0, zoom: 1 }

  const items = Array.isArray(raw.items)
    ? raw.items
        .filter((item) => item && typeof item === 'object' && typeof item.id === 'string' && typeof item.src === 'string')
        .map((item) => ({
          id: item.id,
          type: item.type === 'image' ? 'image' : 'image',
          src: item.src,
          x: Number.isFinite(item.x) ? item.x : 0,
          y: Number.isFinite(item.y) ? item.y : 0,
          width: Number.isFinite(item.width) ? item.width : 320,
          height: Number.isFinite(item.height) ? item.height : 180,
          prompt: typeof item.prompt === 'string' ? item.prompt : '',
          style: typeof item.style === 'string' ? item.style : '',
          ratio: typeof item.ratio === 'string' ? item.ratio : '16:9',
          quality: typeof item.quality === 'string' ? item.quality : 'High',
          createdAt: typeof item.createdAt === 'string' ? item.createdAt : '',
          meta: item.meta && typeof item.meta === 'object' ? item.meta : { source: 'generation' },
        }))
    : []

  return {
    viewport,
    items: items.slice(-MAX_SCENE_ITEMS),
  }
}

export function loadSceneSnapshot() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    return sanitizeSceneSnapshot(JSON.parse(raw))
  } catch {
    return null
  }
}

export function saveSceneSnapshot(viewport, items) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(createSceneSnapshot(viewport, items)))
  } catch {
    // Ignore storage quota and privacy errors in the first pass.
  }
}

export function createGeneratedItem({ src, prompt, style, ratio, quality }, position, index = 0) {
  const size = ratioToFrame(ratio, 320)
  return {
    id: createId('image'),
    type: 'image',
    src,
    x: position.x + index * 40,
    y: position.y + index * 36,
    width: size.width,
    height: size.height,
    prompt,
    style,
    ratio,
    quality,
    createdAt: new Date().toISOString(),
    meta: { source: 'generation' },
  }
}

export function addItemsAroundCenter(items, nextItems, center) {
  const spacing = 28
  const count = Math.max(nextItems.length, 1)
  const layoutWidth = nextItems.reduce((sum, item) => sum + item.width, 0) + spacing * (count - 1)
  let cursorX = center.x - layoutWidth / 2

  return [
    ...items,
    ...nextItems.map((item) => {
      const nextItem = {
        ...item,
        x: cursorX,
        y: center.y - item.height / 2,
      }
      cursorX += item.width + spacing
      return nextItem
    }),
  ]
}

export function createSelectionSet(selection) {
  return new Set(Array.isArray(selection) ? selection : [])
}
