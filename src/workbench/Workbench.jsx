import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import 'tldraw/tldraw.css'
import {
  AssetRecordType,
  Box,
  DefaultImageToolbarContent,
  DefaultStylePanel,
  DefaultStylePanelContent,
  Tldraw,
  TldrawUiButton,
  TldrawUiButtonIcon,
  TldrawUiContextualToolbar,
  TldrawUiInput,
  TldrawUiToolbarButton,
  useTranslation,
  createShapeId,
  createTLStore,
  getSnapshot,
  loadSnapshot,
  useEditor,
  useValue,
} from 'tldraw'
import { downloadImage, extractGeneratedImages, formatHistoryTime } from './workbenchState.js'
import {
  getAttachmentValidationError,
  clearLaunchAttachments,
  loadLaunchAttachments,
} from './attachments.js'
import './lovart.css'
import openAiColorLogo from '../public/image/logo/openai.png'
import { GPT_IMAGE_MODEL, GPT_IMAGE_MODELS } from '../imageModels.js'

const STORAGE_KEY = 'vary-ocean-flow-fish:workbench-snapshot:v3'
const VIEW_KEY = 'vary-ocean-flow-fish:workbench-view:v3'
const HOLDER_LABEL = 'AI Image Holder'
const PROMPT_EXAMPLES = [
  '一个半透明海蓝色香水瓶漂浮在发光粒子之间，电影级产品摄影，高级杂志光线',
  '一个未来感 AI 生图工作台倒映在深海水面中，玻璃面板，蓝色发光控件，细节丰富',
  '创始人在展示新的创意工具，发光的图像草稿像深海鱼群一样环绕桌面',
]
const TOOL_ID = 'workbench-ai-image'
const GENERATED_IMAGE_MAX_EDGE = 560
const GENERATED_IMAGE_HORIZONTAL_GAP = 48
const imageInsertionInFlight = new WeakMap()
const AI_IMAGE_SIZE_MIN = 160
const AI_IMAGE_SIZE_MAX = 2048
const AI_IMAGE_ASPECT_PRESETS = [
  { id: 'landscape', label: '16:9', w: 1024, h: 576 },
  { id: 'square', label: '1:1', w: 960, h: 960 },
  { id: 'portrait', label: '4:5', w: 864, h: 1080 },
  { id: 'story', label: '9:16', w: 576, h: 1024 },
]
const RATIO_SIZES = {
  '1:1': { w: 960, h: 960 },
  '9:16': { w: 576, h: 1024 },
  '16:9': { w: 1024, h: 576 },
  '3:4': { w: 768, h: 1024 },
  '4:3': { w: 1024, h: 768 },
  '3:2': { w: 1024, h: 682 },
  '2:3': { w: 682, h: 1024 },
  '4:5': { w: 864, h: 1080 },
  '5:4': { w: 1080, h: 864 },
  '21:9': { w: 1024, h: 438 },
}

// 具备实体命中区域的浅灰圆角 SVG 占位图，确保用户在画布上可随时点击拖拽移动
const PLACEHOLDER_BG_SVG =
  'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100%" height="100%" rx="16" fill="%23eff1f4"/></svg>'

// 确保所有图片地址都是完整的绝对 URL
function normalizeAssetSrc(src) {
  if (!src || typeof src !== 'string') return ''
  if (src.startsWith('http://') || src.startsWith('https://') || src.startsWith('data:')) {
    return src
  }
  const origin = typeof window !== 'undefined' && window.location.origin ? window.location.origin : ''
  return `${origin}${src.startsWith('/') ? '' : '/'}${src}`
}

function getFileDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = () => reject(new Error('图片读取失败，请重新选择。'))
    reader.readAsDataURL(file)
  })
}

function getNormalizedSnapshot(value) {
  if (!value || typeof value !== 'object') return null
  if (value.store) return value
  if (value.document?.store) return value.document
  return null
}

function isValidSnapshot(value) {
  const snapshot = getNormalizedSnapshot(value)
  return Boolean(snapshot && typeof snapshot.store === 'object')
}

function snapshotHasShapes(snapshot) {
  const document = getNormalizedSnapshot(snapshot)
  return Object.values(document?.store ?? {}).some((record) => record?.typeName === 'shape')
}

function getWorkbenchStorageKey(key, projectId) {
  return `${key}:${projectId || 'default'}`
}

function loadWorkbenchStore(projectId) {
  const store = createTLStore()
  try {
    const raw = window.localStorage.getItem(getWorkbenchStorageKey(STORAGE_KEY, projectId))
    if (!raw) return store
    const parsed = JSON.parse(raw)
    const snapshot = getNormalizedSnapshot(parsed)
    if (snapshot) {
      loadSnapshot(store, snapshot)
    }
  } catch {
    // 忽略异常数据
  }
  return store
}

function saveWorkbenchStore(editor, projectId = editor.__workbenchProjectId) {
  try {
    const snapshot = getSnapshot(editor.store)
    window.localStorage.setItem(getWorkbenchStorageKey(STORAGE_KEY, projectId), JSON.stringify(snapshot))
    window.localStorage.setItem(
      getWorkbenchStorageKey(VIEW_KEY, projectId),
      JSON.stringify({
        camera: editor.getCamera(),
        currentPageId: editor.getCurrentPageId(),
        updatedAt: new Date().toISOString(),
      })
    )
  } catch {
    // 忽略持久化失败
  }
}

function restoreWorkbenchView(editor, projectId) {
  try {
    const raw = window.localStorage.getItem(getWorkbenchStorageKey(VIEW_KEY, projectId))
    if (!raw) return
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object' || !parsed.camera) return
    editor.setCamera(parsed.camera, { immediate: true, force: true })
  } catch {
    // 忽略视图还原失败
  }
}

function clampAiImageSize(value) {
  if (!Number.isFinite(value)) return null
  return Math.round(Math.min(Math.max(value, AI_IMAGE_SIZE_MIN), AI_IMAGE_SIZE_MAX))
}

function isAiImageHolderShape(shape) {
  return shape?.type === 'frame' && shape.meta?.cowartAiImageHolder === true
}

function isAiImageAspectLocked(shape) {
  return isAiImageHolderShape(shape) && shape.meta?.cowartAiAspectLocked === true
}

function getAiImageAspectRatio(shape) {
  const metaRatio = Number(shape?.meta?.cowartAiAspectRatio)
  if (Number.isFinite(metaRatio) && metaRatio > 0) return metaRatio

  const width = Number(shape?.props?.w)
  const height = Number(shape?.props?.h)
  if (!Number.isFinite(width) || !Number.isFinite(height) || height === 0) return null
  return width / height
}

function getAiImageAspectPreset(shape) {
  if (!shape?.props) return null
  const width = Number(shape.props.w)
  const height = Number(shape.props.h)
  if (!Number.isFinite(width) || !Number.isFinite(height) || height === 0) return null

  const shapeRatio = width / height
  return (
    AI_IMAGE_ASPECT_PRESETS.find((preset) => {
      const presetRatio = preset.w / preset.h
      return Math.abs(shapeRatio - presetRatio) < 0.01
    }) ?? null
  )
}

function formatAiImageSize(value) {
  return String(Math.round(Number.isFinite(value) ? value : 0))
}

function getAspectIconStyle(preset) {
  const maxSize = 22
  const scale = Math.min(maxSize / preset.w, maxSize / preset.h)
  return {
    width: `${Math.max(8, Math.round(preset.w * scale))}px`,
    height: `${Math.max(8, Math.round(preset.h * scale))}px`,
  }
}

function getWorkbenchSelection(editor) {
  return editor.getSelectedShapeIds().map((id) => {
    const shape = editor.getShape(id)
    const asset = shape?.props?.assetId ? editor.getAsset(shape.props.assetId) : null
    return {
      id,
      type: shape?.type ?? null,
      x: shape?.x ?? null,
      y: shape?.y ?? null,
      rotation: shape?.rotation ?? null,
      meta: shape?.meta ?? null,
      isAiImageHolder: shape?.meta?.cowartAiImageHolder === true,
      props: shape?.props ?? null,
      asset: asset
        ? {
            id: asset.id,
            type: asset.type,
            name: asset.props?.name ?? null,
            src: asset.props?.src ?? null,
            w: asset.props?.w ?? null,
            h: asset.props?.h ?? null,
            mimeType: asset.props?.mimeType ?? null,
          }
        : null,
    }
  })
}

function getWorkbenchViewState(editor) {
  const camera = editor.getCamera()
  return {
    version: 1,
    currentPageId: editor.getCurrentPageId(),
    camera: {
      x: camera.x,
      y: camera.y,
      z: camera.z,
    },
  }
}

function getFittedImageSize(width, height) {
  const safeWidth = Number.isFinite(width) && width > 0 ? width : 1024
  const safeHeight = Number.isFinite(height) && height > 0 ? height : 1024
  const scale = Math.min(1, GENERATED_IMAGE_MAX_EDGE / Math.max(safeWidth, safeHeight))

  return {
    w: Math.max(1, Math.round(safeWidth * scale)),
    h: Math.max(1, Math.round(safeHeight * scale)),
  }
}

function getRatioFittedSize(ratioStr = '1:1') {
  const base = RATIO_SIZES[ratioStr] || RATIO_SIZES['1:1']
  return getFittedImageSize(base.w, base.h)
}

function getGeneratedImageRightEdge(editor) {
  return editor.getCurrentPageShapes().reduce((rightEdge, shape) => {
    if (shape.type !== 'image') return rightEdge
    return Math.max(rightEdge, shape.x + Number(shape.props.w || 0))
  }, null)
}

function getImageShapeIdBySrc(editor, rawSrc) {
  const targetSrc = normalizeAssetSrc(rawSrc)
  if (!targetSrc) return null
  return editor.getCurrentPageShapes().find((shape) => {
    if (shape.type !== 'image') return false
    if (shape.meta?.projectAssetSrc === targetSrc) return true
    if (!shape.props.assetId) return false
    const asset = editor.getAsset(shape.props.assetId)
    return asset?.props?.src === targetSrc
  })?.id ?? null
}

function getImageShapeIdByAssetId(editor, assetId) {
  if (!assetId) return null
  return editor.getCurrentPageShapes().find((shape) => shape.type === 'image' && String(shape.meta?.projectAssetId) === String(assetId))?.id ?? null
}

function getImageShapeIdBySeparationLayer(editor, separationId, layerIndex) {
  return editor.getCurrentPageShapes().find((shape) => (
    shape.type === 'image'
    && String(shape.meta?.separationId) === String(separationId)
    && Number(shape.meta?.layerIndex) === Number(layerIndex)
  ))?.id ?? null
}

function removeImageSeparationPreviews(editor, separationId) {
  const shapes = editor.getCurrentPageShapes().filter((shape) => (
    shape.type === 'image' && String(shape.meta?.separationId) === String(separationId) && shape.meta?.isSeparationPreview === true
  ))
  if (shapes.length) {
    const assetIds = shapes.map((shape) => shape.props?.assetId).filter(Boolean)
    editor.deleteShapes(shapes.map((shape) => shape.id))
    if (assetIds.length) editor.deleteAssets(assetIds)
  }
}

function hasReferenceArrow(editor, referenceShapeId, imageShapeId) {
  return editor.getCurrentPageShapes().some((shape) => {
    if (shape.type !== 'arrow') return false
    const bindings = editor.getBindingsFromShape(shape, 'arrow')
    return bindings.some((binding) => binding.toId === referenceShapeId && binding.props.terminal === 'start')
      && bindings.some((binding) => binding.toId === imageShapeId && binding.props.terminal === 'end')
  })
}

function createReferenceArrow(editor, referenceShapeId, imageShapeId) {
  if (!referenceShapeId || !imageShapeId || hasReferenceArrow(editor, referenceShapeId, imageShapeId)) return
  const referenceShape = editor.getShape(referenceShapeId)
  const imageShape = editor.getShape(imageShapeId)
  if (!referenceShape || !imageShape) return

  const arrowId = createShapeId()
  editor.createShape({
    id: arrowId,
    type: 'arrow',
    isLocked: true,
    x: referenceShape.x,
    y: referenceShape.y,
    props: {
      kind: 'arc',
      bend: 0,
      start: { x: 0, y: 0 },
      end: { x: 1, y: 1 },
    },
  })

  editor.createBinding({
    type: 'arrow',
    fromId: arrowId,
    toId: referenceShapeId,
    props: { terminal: 'start', normalizedAnchor: { x: 1, y: 0.5 }, isPrecise: true },
  })

  editor.createBinding({
    type: 'arrow',
    fromId: arrowId,
    toId: imageShapeId,
    props: { terminal: 'end', normalizedAnchor: { x: 0, y: 0.5 }, isPrecise: true },
  })
}

function getComfyLinePath(x1, y1, x2, y2) {
  const dx = x2 - x1
  const dy = y2 - y1

  let hOffset = Math.max(Math.abs(dx) * 0.5, 40)
  if (dx < 0) {
    hOffset = Math.max(Math.abs(dx) * 0.6, Math.abs(dy) * 0.3, 100)
  }

  const cp1x = x1 + hOffset
  const cp1y = y1
  const cp2x = x2 - hOffset
  const cp2y = y2

  return `M ${x1} ${y1} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${x2} ${y2}`
}

function ComfyLinesOverlay({ editor }) {
  const camera = useValue('camera', () => editor?.getCamera() ?? { x: 0, y: 0, z: 1 }, [editor])
  const shapes = useValue('shapes', () => editor?.getCurrentPageShapes() ?? [], [editor])
  const selectedShapeIds = useValue('selectedShapeIds', () => editor?.getSelectedShapeIds() ?? [], [editor])

  if (!editor) return null

  const hasSelection = selectedShapeIds.length > 0
  const lines = []

  shapes.forEach((shape) => {
    if (shape.type !== 'arrow') return
    const bindings = editor.getBindingsFromShape(shape, 'arrow')
    const startBinding = bindings.find((b) => b.props.terminal === 'start')
    const endBinding = bindings.find((b) => b.props.terminal === 'end')

    if (!startBinding || !endBinding) return
    const fromShape = editor.getShape(startBinding.toId)
    const toShape = editor.getShape(endBinding.toId)
    if (!fromShape || !toShape) return

    const fromBounds = editor.getShapePageBounds(fromShape)
    const toBounds = editor.getShapePageBounds(toShape)
    if (!fromBounds || !toBounds) return

    const x1 = fromBounds.maxX
    const y1 = fromBounds.midY
    const x2 = toBounds.minX
    const y2 = toBounds.midY

    const isHighlighted = selectedShapeIds.includes(fromShape.id) || selectedShapeIds.includes(toShape.id)

    lines.push({
      id: shape.id,
      pathD: getComfyLinePath(x1, y1, x2, y2),
      x1, y1, x2, y2,
      isHighlighted,
    })
  })

  lines.sort((a, b) => Number(a.isHighlighted) - Number(b.isHighlighted))

  return (
    <svg
      className="comfy-lines-layer"
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 0,
      }}
    >
      <g transform={`scale(${camera.z}) translate(${camera.x}, ${camera.y})`}>
        {lines.map((line) => {
          const opacity = hasSelection ? (line.isHighlighted ? 1 : 0.2) : 1
          const strokeWidth = line.isHighlighted ? 4.2 : 3.5
          const circleRadius = line.isHighlighted ? 5 : 4.5

          return (
            <g key={line.id} opacity={opacity}>
              <path
                d={line.pathD}
                fill="none"
                stroke={line.isHighlighted ? '#737579' : '#bec0c5'}
                strokeWidth={line.isHighlighted ? 12 : 8}
                strokeOpacity={line.isHighlighted ? 0.45 : 0.12}
              />
              <path
                d={line.pathD}
                fill="none"
                stroke={line.isHighlighted ? '#68696c' : '#bec0c5'}
                strokeWidth={strokeWidth}
                strokeLinecap="round"
              />
              <circle cx={line.x1} cy={line.y1} r={circleRadius} fill={line.isHighlighted ? '#6d6f72' : '#bec0c5'} />
              <circle cx={line.x2} cy={line.y2} r={circleRadius} fill={line.isHighlighted ? '#6d6f72' : '#bec0c5'} />
            </g>
          )
        })}
      </g>
    </svg>
  )
}

/* 🌟 无任何外部边框的圆角灰白卡片 + 精准位于左上角的 3 点跳动动画，且实时跟随被拖动的占位 Shape 坐标 */
function PlaceholderLoadingOverlay({ editor }) {
  const camera = useValue('camera', () => editor?.getCamera() ?? { x: 0, y: 0, z: 1 }, [editor])
  const shapes = useValue('shapes', () => editor?.getCurrentPageShapes() ?? [], [editor])

  if (!editor) return null

  const placeholders = shapes.filter((s) => s.meta?.isGeneratingPlaceholder === true)
  if (!placeholders.length) return null

  return (
    <div
      className="placeholder-overlay-container"
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 50,
        overflow: 'hidden',
      }}
    >
      {placeholders.map((shape) => {
        const bounds = editor.getShapePageBounds(shape)
        if (!bounds) return null

        const screenX = (bounds.minX + camera.x) * camera.z
        const screenY = (bounds.minY + camera.y) * camera.z
        const screenW = bounds.width * camera.z
        const screenH = bounds.height * camera.z

        return (
          <div
            key={shape.id}
            style={{
              position: 'absolute',
              left: `${screenX}px`,
              top: `${screenY}px`,
              width: `${screenW}px`,
              height: `${screenH}px`,
              borderRadius: '24px',
              backgroundColor: '#eff1f4',
              boxSizing: 'border-box',
              overflow: 'hidden',
            }}
          >
            {/* 骨架平滑流光呼吸效果 */}
            <div
              style={{
                position: 'absolute',
                inset: 0,
                background: 'linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.45) 50%, rgba(255,255,255,0) 100%)',
                animation: 'lovart-shimmer 2s infinite ease-in-out',
              }}
            />

            {/* 精准锚定在图片内部左上角的三颗跳动小点 */}
            <div
              style={{
                position: 'absolute',
                left: '16px',
                top: '16px',
                zIndex: 2,
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
              }}
            >
              <div
                style={{
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  backgroundColor: '#9ca3af',
                  animation: 'lovart-pulse-dot 1.4s infinite ease-in-out 0s',
                }}
              />
              <div
                style={{
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  backgroundColor: '#9ca3af',
                  animation: 'lovart-pulse-dot 1.4s infinite ease-in-out 0.2s',
                }}
              />
              <div
                style={{
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  backgroundColor: '#9ca3af',
                  animation: 'lovart-pulse-dot 1.4s infinite ease-in-out 0.4s',
                }}
              />
            </div>
          </div>
        )
      })}
      <style>{`
        @keyframes lovart-shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        @keyframes lovart-pulse-dot {
          0%, 80%, 100% { transform: scale(0.65); opacity: 0.35; }
          40% { transform: scale(1.15); opacity: 1; }
        }
      `}</style>
    </div>
  )
}

function IconOpenAI() {
  return (
    <img
      src={openAiColorLogo}
      alt="OpenAI Logo"
      width="16"
      height="16"
      style={{ display: 'inline-block', verticalAlign: 'middle', objectFit: 'contain' }}
    />
  )
}

function ImageSelectionHeader({ editor }) {
  const camera = useValue('camera', () => editor?.getCamera() ?? { x: 0, y: 0, z: 1 }, [editor])
  const selectedShapeIds = useValue('selectedShapeIds', () => editor?.getSelectedShapeIds() ?? [], [editor])

  const selectedShape = useValue('selectedShape', () => {
    if (!editor || selectedShapeIds.length !== 1) return null
    const shape = editor.getShape(selectedShapeIds[0])
    return shape?.type === 'image' ? shape : null
  }, [editor, selectedShapeIds])

  if (!editor || !selectedShape || selectedShape.meta?.isGeneratingPlaceholder) return null

  const bounds = editor.getShapePageBounds(selectedShape)
  if (!bounds) return null

  const screenX = (bounds.minX + camera.x) * camera.z
  const screenY = (bounds.minY + camera.y) * camera.z
  const screenWidth = bounds.width * camera.z

  const asset = selectedShape.props?.assetId ? editor.getAsset(selectedShape.props.assetId) : null
  const displayW = Math.round(asset?.props?.w || selectedShape.props?.w || 0)
  const displayH = Math.round(asset?.props?.h || selectedShape.props?.h || 0)

  return (
    <div
      className="lovart-image-selection-header"
      style={{
        position: 'absolute',
        left: `${screenX}px`,
        top: `${screenY - 26}px`,
        width: `${screenWidth}px`,
        pointerEvents: 'none',
        zIndex: 150,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 2px 4px 2px',
        userSelect: 'none',
        boxSizing: 'border-box',
      }}
    >
      <div 
        style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '6px', 
          color: 'rgba(0, 0, 0, 0.45)',
          fontSize: '13px', 
          fontWeight: 500 
        }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect width="18" height="18" x="3" y="3" rx="2" ry="2"/>
          <circle cx="9" cy="9" r="2"/>
          <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>
        </svg>
        <span>Image</span>
      </div>
      {displayW > 0 && displayH > 0 && (
        <span 
          style={{ 
            color: 'rgba(0, 0, 0, 0.45)',
            fontSize: '12px', 
            fontWeight: 400 
          }}
        >
          {displayW} x {displayH}
        </span>
      )}
    </div>
  )
}

function ImageToolbarWithSeparateEdit({ onSeparateImage }) {
  const editor = useEditor()
  const msg = useTranslation()
  const imageShapeId = useValue(
    'imageShape',
    () => {
      const selectedShape = editor.getOnlySelectedShape()
      return selectedShape?.type === 'image' ? selectedShape.id : null
    },
    [editor]
  )
  const showToolbar = useValue(
    'showToolbar',
    () => editor.isInAny('select.idle', 'select.pointing_shape', 'select.crop'),
    [editor]
  )
  const isLocked = useValue(
    'locked',
    () => (imageShapeId ? editor.getShape(imageShapeId)?.isLocked : false),
    [editor, imageShapeId]
  )
  const isManipulating = useValue('editor path', () => editor.isIn('select.crop.'), [editor])
  const isChangingCrop = useValue(
    'editor path',
    () => editor.isInAny('select.crop.cropping', 'select.crop.pointing_crop_handle', 'select.crop.translating_crop'),
    [editor]
  )
  const camera = useValue('camera', () => editor.getCamera(), [editor])
  const previousSelectionBounds = useRef(undefined)
  const [isEditingAltText, setIsEditingAltText] = useState(false)
  const [altText, setAltText] = useState('')
  const [separationStatus, setSeparationStatus] = useState('idle')

  useEffect(() => {
    previousSelectionBounds.current = undefined
  }, [camera])

  useEffect(() => {
    if (!isEditingAltText || !imageShapeId) return
    const shape = editor.getShape(imageShapeId)
    setAltText(shape?.props?.altText || '')
  }, [editor, imageShapeId, isEditingAltText])

  const handleManipulatingEnd = useCallback(() => {
    editor.setCroppingShape(null)
    editor.setCurrentTool('select.idle')
  }, [editor])
  const handleManipulatingStart = useCallback(() => editor.setCurrentTool('select.crop.idle'), [editor])
  const handleAltTextClose = useCallback(() => setIsEditingAltText(false), [])
  const handleAltTextComplete = useCallback(() => {
    const shape = editor.getShape(imageShapeId)
    if (shape && 'altText' in shape.props) {
      editor.updateShape({ id: shape.id, type: shape.type, props: { altText } })
    }
    setIsEditingAltText(false)
  }, [altText, editor, imageShapeId])
  const handleSeparateImage = useCallback(async () => {
    if (!imageShapeId || separationStatus === 'processing') return
    const separateImage = onSeparateImage || editor.__workbenchSeparateImage
    if (!separateImage) return
    setSeparationStatus('processing')
    try {
      await separateImage(imageShapeId, (status) => {
        if (status === 'completed') setSeparationStatus('completed')
      })
      setSeparationStatus('completed')
    } catch (error) {
      setSeparationStatus('failed')
      window.alert(error instanceof Error ? error.message : '图片分离失败，请保留原图继续编辑。')
    }
  }, [imageShapeId, onSeparateImage, separationStatus])
  const getSelectionBounds = useCallback(() => {
    if (isManipulating && previousSelectionBounds.current) return previousSelectionBounds.current
    const fullBounds = editor.getSelectionScreenBounds()
    if (!fullBounds) return undefined
    const bounds = new Box(fullBounds.x, fullBounds.y, fullBounds.width, 0)
    previousSelectionBounds.current = bounds
    return bounds
  }, [editor, isManipulating])

  if (!imageShapeId || !showToolbar || isLocked || isChangingCrop) return null

  return (
    <TldrawUiContextualToolbar
      className="tlui-media__toolbar tlui-image__toolbar"
      getSelectionBounds={getSelectionBounds}
      label={msg('tool.image-toolbar-title')}
    >
      {isEditingAltText ? (
        <>
          <TldrawUiInput
            className="tlui-media__toolbar-alt-text-input"
            data-testid="media-toolbar.alt-text-input"
            value={altText}
            placeholder={msg('tool.media-alt-text-desc')}
            aria-label={msg('tool.media-alt-text-desc')}
            onValueChange={setAltText}
            onComplete={handleAltTextComplete}
            onCancel={handleAltTextClose}
          />
          <TldrawUiButton
            title={msg('tool.media-alt-text-confirm')}
            data-testid="tool.media-alt-text-confirm"
            type="icon"
            onPointerDown={(event) => event.preventDefault()}
            onClick={handleAltTextComplete}
          >
            <TldrawUiButtonIcon small icon="check" />
          </TldrawUiButton>
        </>
      ) : (
        <>
          <DefaultImageToolbarContent
            imageShapeId={imageShapeId}
            isManipulating={isManipulating}
            onEditAltTextStart={() => setIsEditingAltText(true)}
            onManipulatingStart={handleManipulatingStart}
            onManipulatingEnd={handleManipulatingEnd}
          />
          <TldrawUiToolbarButton
            type="icon"
            title={separationStatus === 'processing' ? '正在分离…' : separationStatus === 'completed' ? '重新分离' : '分离编辑'}
            aria-label={separationStatus === 'processing' ? '正在分离…' : separationStatus === 'completed' ? '重新分离' : '分离编辑'}
            disabled={separationStatus === 'processing'}
            onClick={handleSeparateImage}
          >
            <span aria-hidden="true" style={{ fontSize: 15, lineHeight: 1 }}>✂</span>
          </TldrawUiToolbarButton>
        </>
      )}
    </TldrawUiContextualToolbar>
  )
}

const IMAGE_MODELS = GPT_IMAGE_MODELS

function ImagePromptInspector({ editor, onGenerateWithRef, initialLaunchModel = null }) {
  const camera = useValue('camera', () => editor?.getCamera() ?? { x: 0, y: 0, z: 1 }, [editor])
  const selectedShapeIds = useValue('selectedShapeIds', () => editor?.getSelectedShapeIds() ?? [], [editor])

  const selectedShape = useValue('selectedShape', () => {
    if (!editor || selectedShapeIds.length !== 1) return null
    const shape = editor.getShape(selectedShapeIds[0])
    return shape?.type === 'image' && !shape.meta?.isGeneratingPlaceholder ? shape : null
  }, [editor, selectedShapeIds])

  const [promptText, setPromptText] = useState('')
  const [showSettings, setShowSettings] = useState(false)
  const [showModelMenu, setShowModelMenu] = useState(false)
  const [selectedModel, setSelectedModel] = useState(() => initialLaunchModel && IMAGE_MODELS.some((model) => model.id === initialLaunchModel) ? initialLaunchModel : GPT_IMAGE_MODEL)
  const [resolution, setResolution] = useState('2K')
  const [ratio, setRatio] = useState('9:16')
  const [hasRatioOverride, setHasRatioOverride] = useState(false)
  const [count, setCount] = useState(1)
  const textareaRef = useRef(null)

  const MODELS = IMAGE_MODELS.map((model) => ({ ...model, icon: <IconOpenAI /> }))

  const RESOLUTIONS = ['1K', '2K', '4K']
  const RATIOS = [
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
  const COUNTS = [1, 2, 4]

  useEffect(() => {
    if (selectedShape) {
      const savedPrompt = selectedShape.meta?.prompt || ''
      setPromptText(savedPrompt)
      setRatio(selectedShape.meta?.ratio || '9:16')
      setHasRatioOverride(false)
    }
  }, [selectedShape?.id])

  useEffect(() => {
    const textarea = textareaRef.current
    if (!textarea) return
    textarea.style.height = 'auto'
    textarea.style.height = `${Math.min(textarea.scrollHeight, 150)}px`
  }, [promptText])

  if (!editor || !selectedShape) return null

  const bounds = editor.getShapePageBounds(selectedShape)
  if (!bounds) return null

  const screenX = (bounds.midX + camera.x) * camera.z
  const screenY = (bounds.maxY + camera.y) * camera.z + 20

  const asset = selectedShape.props?.assetId ? editor.getAsset(selectedShape.props.assetId) : null
  const imageSrc = asset?.props?.src || selectedShape.meta?.projectAssetSrc
  const referenceImage = imageSrc
    ? {
        src: imageSrc,
        shapeId: selectedShape.id,
        assetId: selectedShape.meta?.projectAssetId ?? null,
        ratio: selectedShape.meta?.ratio ?? null,
      }
    : null

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!promptText.trim() || !referenceImage) return
    setShowSettings(false)
    setShowModelMenu(false)
    onGenerateWithRef?.({
      prompt: promptText,
      referenceImage,
      ratio: hasRatioOverride || !referenceImage.ratio ? ratio : undefined,
      resolution,
      count,
      model: selectedModel,
    })
  }

  return (
    <div
      className="lovart-prompt-inspector"
      style={{
        position: 'absolute',
        left: `${screenX}px`,
        top: `${screenY}px`,
        transform: 'translateX(-50%)',
        zIndex: 200,
      }}
    >
      <div className="inspector-top-bar">
        <button type="button" className="inspector-chip-btn">＋参考</button>
      </div>

      <form onSubmit={handleSubmit} className="inspector-form">
        <textarea
          ref={textareaRef}
          className="inspector-textarea"
          value={promptText}
          onChange={(e) => setPromptText(e.target.value)}
          placeholder="输入提示词，开始你的创作"
          rows={2}
        />

        <div className="inspector-bottom-bar">
          <div className="inspector-params">
            <div style={{ position: 'relative', display: 'inline-flex' }}>
              <button
                type="button"
                className={`param-tag-btn ${showModelMenu ? 'is-active' : ''}`}
                onClick={() => {
                  setShowModelMenu(!showModelMenu)
                  setShowSettings(false)
                }}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}
              >
                <IconOpenAI />
                <span>{IMAGE_MODELS.find((model) => model.id === selectedModel)?.name || selectedModel}</span>
                <span>▾</span>
              </button>

              {showModelMenu && (
                <div className="inspector-model-popover">
                  <div className="model-popover-header">
                    <span className="popover-title">配置生成模型</span>
                    <span className="popover-link">了解更多</span>
                  </div>
                  <div className="model-list">
                    {MODELS.map((model) => {
                      const isSelected = selectedModel === model.id
                      return (
                        <div
                          key={model.id}
                          className={`model-item ${isSelected ? 'is-selected' : ''}`}
                          onClick={() => {
                            setSelectedModel(model.id)
                            setShowModelMenu(false)
                          }}
                        >
                          <span className="model-icon">{model.icon}</span>
                          <div className="model-info">
                            <div className="model-name-row">
                              <span className="model-name">{model.name}</span>
                              {isSelected && <span className="model-check">✓</span>}
                            </div>
                            <p className="model-desc">{model.desc}</p>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>

            <div style={{ position: 'relative', display: 'inline-flex' }}>
              <button
                type="button"
                className={`param-tag-btn ${showSettings ? 'is-active' : ''}`}
                onClick={() => {
                  setShowSettings(!showSettings)
                  setShowModelMenu(false)
                }}
              >
                {ratio} · {resolution} · {count}张 ▾
              </button>

              {showSettings && (
                <div className="inspector-settings-popover">
                  <div className="popover-section">
                    <div className="popover-title">分辨率</div>
                    <div className="popover-row">
                      {RESOLUTIONS.map((res) => (
                        <button
                          key={res}
                          type="button"
                          className={`popover-btn ${resolution === res ? 'is-active' : ''}`}
                          onClick={() => setResolution(res)}
                        >
                          {res}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="popover-section">
                    <div className="popover-title">比例</div>
                    <div className="popover-ratio-grid">
                      {RATIOS.map((item) => (
                        <button
                          key={item.value}
                          type="button"
                          className={`popover-ratio-btn ${ratio === item.value ? 'is-active' : ''}`}
                          onClick={() => {
                            setRatio(item.value)
                            setHasRatioOverride(true)
                          }}
                        >
                          <span className="ratio-icon">{item.icon}</span>
                          <span className="ratio-label">{item.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="popover-section">
                    <div className="popover-title">生成数量</div>
                    <div className="popover-row">
                      {COUNTS.map((cnt) => (
                        <button
                          key={cnt}
                          type="button"
                          className={`popover-btn ${count === cnt ? 'is-active' : ''}`}
                          onClick={() => setCount(cnt)}
                        >
                          {cnt}张
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          <button type="submit" className="inspector-send-btn" title="基于此图生图">
            <IconSend />
          </button>
        </div>
      </form>
    </div>
  )
}

function loadImageSize(src) {
  return new Promise((resolve) => {
    const fullSrc = normalizeAssetSrc(src)
    const image = new Image()
    image.onload = () => resolve(getFittedImageSize(image.naturalWidth, image.naturalHeight))
    image.onerror = () => resolve(getFittedImageSize())
    image.src = fullSrc
  })
}

// 🌟 创建实体可响应拖拽的占位 Shape
function createPlaceholderShapes(editor, count = 1, ratio = '1:1', referenceImage = null) {
  if (!editor) return []
  const size = getRatioFittedSize(ratio)
  const center = editor.getViewportPageBounds().center
  let rightEdge = getGeneratedImageRightEdge(editor)
  const createdIds = []

  // 创建一个具有实体命中区域的浅灰底色 asset
  const placeholderAssetId = AssetRecordType.createId()
  editor.createAssets([
    {
      id: placeholderAssetId,
      typeName: 'asset',
      type: 'image',
      props: {
        src: PLACEHOLDER_BG_SVG,
        w: size.w,
        h: size.h,
        mimeType: 'image/svg+xml',
        name: 'placeholder.svg',
        isAnimated: false,
      },
      meta: {},
    },
  ])

  for (let i = 0; i < count; i++) {
    const shapeId = createShapeId()
    const x = rightEdge === null ? center.x - size.w / 2 : rightEdge + GENERATED_IMAGE_HORIZONTAL_GAP
    const y = center.y - size.h / 2

    editor.createShape({
      id: shapeId,
      type: 'image',
      x,
      y,
      isLocked: false,
      meta: {
        isGeneratingPlaceholder: true,
      },
      props: {
        assetId: placeholderAssetId,
        w: size.w,
        h: size.h,
        url: '',
        crop: null,
        flipX: false,
        flipY: false,
        playing: true,
      },
    })

    createdIds.push(shapeId)
    rightEdge = x + size.w
  }

  if (referenceImage?.shapeId && createdIds[0]) {
    createReferenceArrow(editor, referenceImage.shapeId, createdIds[0])
  }

  // 立即选中占位 Shape，使之随手即可拖拽移动
  if (createdIds.length > 0) {
    editor.setSelectedShapes(createdIds)
    editor.setCurrentTool('select')
  }

  return createdIds
}

// 创建完整绝对路径 Asset，并把 projectAssetSrc 写进 meta 双重保险
async function createImageShape(editor, rawSrc, meta, size, x, y, createdAssetIds = null) {
  const fullSrc = normalizeAssetSrc(rawSrc)
  const assetId = AssetRecordType.createId()
  const asset = {
    id: assetId,
    typeName: 'asset',
    type: 'image',
    props: {
      src: fullSrc,
      w: size.w,
      h: size.h,
      mimeType: 'image/png',
      name: 'generated-image.png',
      isAnimated: false,
    },
    meta: {},
  }

  editor.createAssets([asset])
  createdAssetIds?.push(assetId)
  const shapeId = createShapeId()
  editor.createShape({
    id: shapeId,
    type: 'image',
    x,
    y,
    meta: {
      ...(meta.assetId ? { projectAssetId: meta.assetId } : {}),
      projectAssetSrc: fullSrc,
      prompt: meta.prompt || '',
      ratio: meta.ratio || '1:1',
      style: meta.style || '柔和电影感',
      quality: meta.quality || 'High',
      ...(meta.separationId ? { separationId: meta.separationId } : {}),
      ...(meta.sourceAssetId ? { sourceAssetId: meta.sourceAssetId } : {}),
      ...(meta.layerKind ? { layerKind: meta.layerKind } : {}),
      ...(meta.layerName ? { layerName: meta.layerName } : {}),
      ...(Number.isFinite(meta.layerIndex) ? { layerIndex: meta.layerIndex } : {}),
      ...(meta.preview ? { isSeparationPreview: true } : {}),
      ...(meta.bbox ? { bbox: meta.bbox } : {}),
    },
    props: {
      assetId: asset.id,
      w: size.w,
      h: size.h,
      url: '',
      crop: null,
      flipX: false,
      flipY: false,
      playing: true,
    },
  })
  return shapeId
}

async function insertImageSeparationResult(editor, separation, sourceShape, { preview = false } = {}) {
  if (!sourceShape || sourceShape.type !== 'image') throw new Error('源图片已不存在，请保留原图继续编辑。')

  const sourceWidth = Number(separation.source_width)
  const sourceHeight = Number(separation.source_height)
  const sourceShapeWidth = Number(sourceShape.props?.w)
  const sourceShapeHeight = Number(sourceShape.props?.h)
  if (!(sourceWidth > 0) || !(sourceHeight > 0) || !(sourceShapeWidth > 0) || !(sourceShapeHeight > 0)) {
    throw new Error('分层结果尺寸无效，请保留原图继续编辑。')
  }

  const scaleX = sourceShapeWidth / sourceWidth
  const scaleY = sourceShapeHeight / sourceHeight
  const separationId = separation.separation_id
  const sourceAssetId = separation.source_asset_id
  const layers = [...(separation.layers || [])].sort((a, b) => a.z_index - b.z_index)
  if (!layers.length) throw new Error('分层结果没有可用图层，请保留原图继续编辑。')

  const createdShapeIds = []
  const createdAssetIds = []
  try {
    for (let index = 0; index < layers.length; index += 1) {
      const layer = layers[index]
      if (!layer?.src) throw new Error('分层结果包含无效图层，请保留原图继续编辑。')
      const bbox = layer.bbox
      const x = bbox ? sourceShape.x + bbox.x * scaleX : sourceShape.x
      const y = bbox ? sourceShape.y + bbox.y * scaleY : sourceShape.y
      const size = bbox
        ? { w: bbox.width * scaleX, h: bbox.height * scaleY }
        : { w: sourceShapeWidth, h: sourceShapeHeight }
      const existingShapeId = getImageShapeIdBySeparationLayer(editor, separationId, index)
      if (existingShapeId) {
        const existingShape = editor.getShape(existingShapeId)
        const assetId = existingShape?.props?.assetId
        if (assetId) editor.deleteAssets([assetId])
        editor.deleteShape(existingShapeId)
      }
      const shapeId = await createImageShape(editor, layer.src, {
        assetId: layer.asset_id,
        separationId,
        sourceAssetId,
        layerKind: layer.type,
        layerName: layer.name,
        layerIndex: index,
        bbox,
        preview,
      }, size, x, y, createdAssetIds)
      createdShapeIds.push(shapeId)
    }

    if (!preview) {
      editor.updateShape({
        id: sourceShape.id,
        type: 'image',
        opacity: 0,
        meta: {
          ...sourceShape.meta,
          isSourceImage: true,
          isHiddenBySeparation: true,
          separationId,
        },
      })
      editor.select(createdShapeIds[createdShapeIds.length - 1])
      editor.setCurrentTool('select')
    }
    return { createdShapeIds, createdAssetIds, sourceShape }
  } catch (error) {
    if (createdShapeIds.length) editor.deleteShapes(createdShapeIds)
    if (createdAssetIds.length) editor.deleteAssets(createdAssetIds)
    throw error
  }
}

function getGenerationImages(generation) {
  const assets = Array.isArray(generation?.output_assets) ? generation.output_assets : []
  if (assets.length) {
    return assets
      .filter((asset) => asset?.src)
      .map((asset) => ({ src: asset.src, assetId: asset.id, referenceAssetId: asset.metadata?.reference_asset_id ?? null }))
  }
  const images = extractGeneratedImages({ provider_response: generation?.provider_response })
  if (images.length) return images
  const src = typeof generation?.src === 'string' ? generation.src.trim() : ''
  return src ? [{ src }] : []
}

function getLatestHistoricalGeneratedImage(history) {
  for (const generation of history) {
    const image = getGenerationImages(generation).find((item) => item.src)
    if (image) return image
  }
  return null
}

async function addImagesToCanvas(editor, images, meta, referenceImage, placeholderIds = []) {
  const center = editor.getViewportPageBounds().center
  let rightEdge = getGeneratedImageRightEdge(editor)
  let firstShapeId = null
  let lastShapeId = null

  // 🌟 读取占位 Shape 被用户拖动后的最新实际坐标与尺寸，并清理占位
  const placeholderPositions = []
  if (placeholderIds && placeholderIds.length) {
    placeholderIds.forEach((id) => {
      const ph = editor.getShape(id)
      if (ph) {
        placeholderPositions.push({ x: ph.x, y: ph.y, w: ph.props?.w, h: ph.props?.h })
        editor.deleteShape(id)
      }
    })
  }

  for (let i = 0; i < images.length; i++) {
    const image = images[i]
    const fullSrc = normalizeAssetSrc(image.src)
    const imageKeys = [
      ...(image.assetId ? [`asset:${image.assetId}`] : []),
      ...(fullSrc ? [`src:${fullSrc}`] : []),
    ]
    const existingShapeId = getImageShapeIdByAssetId(editor, image.assetId) || getImageShapeIdBySrc(editor, fullSrc)
    const inFlight = imageInsertionInFlight.get(editor)

    if (imageKeys.some((key) => inFlight?.has(key))) {
      continue
    }

    if (existingShapeId) {
      const existingShape = editor.getShape(existingShapeId)
      const existingAsset = existingShape?.props?.assetId ? editor.getAsset(existingShape.props.assetId) : null
      
      if (!existingAsset || !existingAsset.props?.src) {
        const size = await loadImageSize(fullSrc)
        const repairedAssetId = AssetRecordType.createId()
        const repairedAsset = {
          id: repairedAssetId,
          typeName: 'asset',
          type: 'image',
          props: {
            src: fullSrc,
            w: size.w,
            h: size.h,
            mimeType: 'image/png',
            name: 'generated-image.png',
            isAnimated: false,
          },
          meta: {},
        }
        editor.createAssets([repairedAsset])
        editor.updateShape({
          id: existingShapeId,
          type: 'image',
          meta: {
            ...existingShape?.meta,
            projectAssetSrc: fullSrc,
            ...(image.assetId ? { projectAssetId: image.assetId } : {}),
          },
          props: {
            ...existingShape?.props,
            assetId: repairedAssetId,
            w: existingShape?.props?.w || size.w,
            h: existingShape?.props?.h || size.h,
          },
        })
      }
      lastShapeId = existingShapeId
      if (!firstShapeId) firstShapeId = lastShapeId
      continue
    }

    const insertionKeys = inFlight || new Set()
    if (!inFlight) imageInsertionInFlight.set(editor, insertionKeys)
    imageKeys.forEach((key) => insertionKeys.add(key))

    try {
      const size = await loadImageSize(fullSrc)
      let x, y
      let targetSize = size

      // 若存在被用户移动过的占位位置，直接继承该位置
      if (placeholderPositions[i]) {
        x = placeholderPositions[i].x
        y = placeholderPositions[i].y
        if (placeholderPositions[i].w && placeholderPositions[i].h) {
          targetSize = { w: placeholderPositions[i].w, h: placeholderPositions[i].h }
        }
      } else {
        x = rightEdge === null ? center.x - size.w / 2 : rightEdge + GENERATED_IMAGE_HORIZONTAL_GAP
        y = center.y - size.h / 2
        rightEdge = x + size.w
      }

      lastShapeId = await createImageShape(editor, fullSrc, { ...meta, assetId: image.assetId }, targetSize, x, y)
      if (!firstShapeId) firstShapeId = lastShapeId
    } finally {
      imageKeys.forEach((key) => insertionKeys.delete(key))
    }
  }

  if (referenceImage?.shapeId && firstShapeId) {
    createReferenceArrow(editor, referenceImage.shapeId, firstShapeId)
  } else if (images[0]?.referenceAssetId && firstShapeId) {
    createReferenceArrow(editor, getImageShapeIdByAssetId(editor, images[0].referenceAssetId), firstShapeId)
  }
  if (lastShapeId) editor.select(lastShapeId)
  editor.setCurrentTool('select')
  saveWorkbenchStore(editor)
}

function createHolderAtCenter(editor) {
  const size = { w: 560, h: 360 }
  const center = editor.getViewportPageBounds().center
  const shapeId = createShapeId()
  editor.createShape({
    id: shapeId,
    type: 'frame',
    x: center.x - size.w / 2,
    y: center.y - size.h / 2,
    meta: {
      cowartAiImageHolder: true,
      cowartAiImageHolderVersion: 1,
    },
    props: {
      w: size.w,
      h: size.h,
      name: HOLDER_LABEL,
      color: 'blue',
    },
  })
  editor.select(shapeId)
  editor.setCurrentTool('select')
  saveWorkbenchStore(editor)
}

function WorkbenchToolbar() {
  const editor = useEditor()
  const currentTool = useValue('workbench current tool', () => editor.getCurrentToolId(), [editor])

  const toolButtons = [
    { id: 'select', label: '选择', icon: '⚡' },
    { id: 'hand', label: '抓手', icon: '✋' },
    { id: 'draw', label: '绘制', icon: '✏️' },
    { id: 'text', label: '文字', icon: 'T' },
    { id: 'arrow', label: '箭头', icon: '↗' },
    { id: TOOL_ID, label: 'AI', icon: '✨' },
  ]

  return (
    <div className="lovart-floating-toolbar">
      {toolButtons.map((tool) => {
        const active = currentTool === tool.id
        return (
          <button
            key={tool.id}
            className={`lovart-toolbar-item ${active ? 'is-active' : ''}`}
            type="button"
            onClick={() => {
              if (tool.id === TOOL_ID) {
                createHolderAtCenter(editor)
                return
              }
              editor.setCurrentTool(tool.id)
            }}
            title={tool.label}
          >
            <span className="tool-icon">{tool.icon}</span>
          </button>
        )
      })}
    </div>
  )
}

function HiddenStylePanel(props) {
  return (
    <DefaultStylePanel {...props}>
      <DefaultStylePanelContent />
      <WorkbenchAiImageStyleControls />
    </DefaultStylePanel>
  )
}

function WorkbenchAiImageStyleControls() {
  const editor = useEditor()
  const selectedAiImageShape = useValue(
    'selected ai image holder shape',
    () => {
      const selectedShapeIds = editor.getSelectedShapeIds()
      if (selectedShapeIds.length !== 1) return null

      const shape = editor.getShape(selectedShapeIds[0])
      return isAiImageHolderShape(shape) ? shape : null
    },
    [editor]
  )
  const [widthValue, setWidthValue] = useState('')
  const [heightValue, setHeightValue] = useState('')

  useEffect(() => {
    if (!selectedAiImageShape) {
      setWidthValue('')
      setHeightValue('')
      return
    }

    setWidthValue(formatAiImageSize(selectedAiImageShape.props.w))
    setHeightValue(formatAiImageSize(selectedAiImageShape.props.h))
  }, [selectedAiImageShape?.id, selectedAiImageShape?.props.w, selectedAiImageShape?.props.h])

  if (!selectedAiImageShape) return null

  const activePreset = getAiImageAspectPreset(selectedAiImageShape)
  const currentWidth = Number(selectedAiImageShape.props.w)
  const currentHeight = Number(selectedAiImageShape.props.h)
  const currentRatio = currentHeight ? currentWidth / currentHeight : 1
  const aspectLocked = isAiImageAspectLocked(selectedAiImageShape)

  function updateAiImageSize(nextWidth, nextHeight) {
    const width = clampAiImageSize(nextWidth)
    const height = clampAiImageSize(nextHeight)
    if (!width || !height) return

    editor.updateShapes([
      {
        id: selectedAiImageShape.id,
        type: 'frame',
        meta: {
          ...selectedAiImageShape.meta,
          cowartAiAspectRatio: width / height,
        },
        props: { w: width, h: height },
      },
    ])
  }

  function toggleAspectLock() {
    editor.updateShapes([
      {
        id: selectedAiImageShape.id,
        type: 'frame',
        meta: {
          ...selectedAiImageShape.meta,
          cowartAiAspectLocked: !aspectLocked,
          cowartAiAspectRatio: currentRatio,
        },
      },
    ])
  }

  function commitWidth(value) {
    const width = clampAiImageSize(Number(value))
    if (!width) {
      setWidthValue(formatAiImageSize(currentWidth))
      return
    }
    const height = aspectLocked ? Math.round(width / currentRatio) : currentHeight
    updateAiImageSize(width, height)
  }

  function commitHeight(value) {
    const height = clampAiImageSize(Number(value))
    if (!height) {
      setHeightValue(formatAiImageSize(currentHeight))
      return
    }
    const width = aspectLocked ? Math.round(height * currentRatio) : currentWidth
    updateAiImageSize(width, height)
  }

  function handleNumberKeyDown(event) {
    if (event.key === 'Enter') {
      event.currentTarget.blur()
    }
    if (event.key === 'Escape') {
      setWidthValue(formatAiImageSize(currentWidth))
      setHeightValue(formatAiImageSize(currentHeight))
      event.currentTarget.blur()
    }
  }

  return (
    <div className="cowart-ai-image-style-panel" aria-label="AI 图片尺寸设置">
      <section className="cowart-ai-style-section">
        <div className="cowart-ai-style-heading">
          <span>尺寸</span>
        </div>
        <div className="cowart-ai-size-row">
          <label className="cowart-ai-size-field">
            <span>W</span>
            <input
              aria-label="AI 图片宽度"
              inputMode="numeric"
              min={AI_IMAGE_SIZE_MIN}
              max={AI_IMAGE_SIZE_MAX}
              value={widthValue}
              onChange={(event) => setWidthValue(event.target.value)}
              onBlur={(event) => commitWidth(event.target.value)}
              onKeyDown={handleNumberKeyDown}
            />
          </label>
          <button
            aria-label={aspectLocked ? '解除宽高比例锁定' : '锁定宽高比例'}
            aria-pressed={aspectLocked}
            className="cowart-ai-aspect-lock"
            onClick={toggleAspectLock}
            type="button"
          >
            <IconLock locked={aspectLocked} />
          </button>
          <label className="cowart-ai-size-field">
            <span>H</span>
            <input
              aria-label="AI 图片高度"
              inputMode="numeric"
              min={AI_IMAGE_SIZE_MIN}
              max={AI_IMAGE_SIZE_MAX}
              value={heightValue}
              onChange={(event) => setHeightValue(event.target.value)}
              onBlur={(event) => commitHeight(event.target.value)}
              onKeyDown={handleNumberKeyDown}
            />
          </label>
        </div>
      </section>

      <section className="cowart-ai-style-section">
        <div className="cowart-ai-style-heading">
          <span>比例</span>
        </div>
        <div className="cowart-ai-aspect-grid">
          {AI_IMAGE_ASPECT_PRESETS.map((preset) => (
            <button
              key={preset.id}
              aria-pressed={activePreset?.id === preset.id}
              className="cowart-ai-aspect-preset"
              onClick={() => updateAiImageSize(preset.w, preset.h)}
              type="button"
            >
              <span className="cowart-ai-aspect-icon" style={getAspectIconStyle(preset)} />
              <span>{preset.label}</span>
            </button>
          ))}
        </div>
      </section>
    </div>
  )
}

function IconLock({ locked }) {
  if (locked) {
    return (
      <svg aria-hidden="true" className="cowart-ai-lock-icon" viewBox="0 0 20 20">
        <rect x="4.5" y="8.5" width="11" height="8" rx="2" />
        <path d="M7 8.5V6a3 3 0 0 1 6 0v2.5" />
      </svg>
    )
  }

  return (
    <svg aria-hidden="true" className="cowart-ai-lock-icon" viewBox="0 0 20 20">
      <rect x="4.5" y="8.5" width="11" height="8" rx="2" />
      <path d="M7 8.5V6.5a3 3 0 0 1 5.8-1.1" />
    </svg>
  )
}

function IconPlus() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </svg>
  )
}

function IconBook() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5V4.5A2.5 2.5 0 0 1 6.5 2Z" />
    </svg>
  )
}

function IconSmile() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M8 14s1.5 2 4 2 4-2 4-2" />
      <path d="M9 9h.01" />
      <path d="M15 9h.01" />
    </svg>
  )
}

function IconSparkles() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="m12 3 1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9Z" />
      <path d="M5 3v4" />
      <path d="M3 5h4" />
      <path d="M19 17v4" />
      <path d="M17 19h4" />
    </svg>
  )
}

function IconPackage() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="m7.5 4.3 9 5.2" />
      <path d="m7.5 19.7 9-5.2" />
      <path d="M3.5 9.5 12 14l8.5-4.5" />
      <path d="M12 14v7.5" />
      <path d="m4.5 7.5 7.5-4 7.5 4v9l-7.5 4-7.5-4Z" />
    </svg>
  )
}

function IconSend() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M22 2 11 13" />
      <path d="m22 2-7 20-4-9-9-4Z" />
    </svg>
  )
}

function IconThumbsUp() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M7 10v11" />
      <path d="M14 5.9 11 10v11h8.4a2 2 0 0 0 2-1.7l1.1-7A2 2 0 0 0 20.5 10H15V6.5a2.5 2.5 0 0 0-1-2Z" />
      <path d="M7 21H4a1 1 0 0 1-1-1v-8a1 1 0 0 1 1-1h3" />
    </svg>
  )
}

function IconThumbsDown() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M17 14V3" />
      <path d="m10 18.1 3-4.1V3H4.6a2 2 0 0 0-2 1.7l-1.1 7A2 2 0 0 0 3.5 14H9v3.5a2.5 2.5 0 0 0 1 2Z" />
      <path d="M17 3h3a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1h-3" />
    </svg>
  )
}

function IconRotate() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M3 2v6h6" />
      <path d="M3 8a9 9 0 1 1 2.6 9.4" />
    </svg>
  )
}

function IconCopy() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <rect x="9" y="9" width="10" height="10" rx="2" />
      <path d="M6 15H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v1" />
    </svg>
  )
}
function createIdempotencyKey() {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID()
  }
  return `client-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
}

function createChatMessage(role, type, payload = {}) {
  return {
    id: `${role}-${type}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    role,
    type,
    text: '',
    imageSrc: '',
    imageAlt: '',
    ...payload,
  }
}

function projectMessageToChatMessage(message) {
  const type = message.message_type === 'image' ? 'image' : 'text'
  const metadata = message.metadata && typeof message.metadata === 'object' ? message.metadata : {}
  return {
    id: `project-message-${message.id}`,
    role: message.role,
    type,
    text: message.text || '',
    imageSrc: type === 'image' ? normalizeAssetSrc(message.image_url || '') : '',
    imageAlt: type === 'image' ? message.text || '生成结果' : '',
    runId: type === 'image' ? '' : message.agent_run_id || '',
    generationRatio: metadata.generation_ratio || undefined,
    generationQuality: metadata.generation_quality || undefined,
    generationCount: metadata.generation_count || undefined,
  }
}

function LoadingDots() {
  return (
    <span className="chat-loading-dots" aria-label="正在生成" role="status">
      <span />
      <span />
      <span />
    </span>
  )
}

function isSafeMarkdownUrl(value) {
  try {
    const url = new URL(value, window.location.href)
    return ['http:', 'https:', 'mailto:'].includes(url.protocol)
  } catch {
    return false
  }
}

function renderInlineMarkdown(text, keyPrefix) {
  const pattern = /(\[([^\]]+)\]\(([^)\s]+)(?:\s+["']([^"']*)["'])?\)|(`[^`\n]+`)|(__[^_\n]+__|\*\*[^*\n]+\*\*)|(~~[^~\n]+~~)|(_[^_\n]+_|\*[^*\n]+\*))/g
  const tokens = []
  let lastIndex = 0
  let match
  while ((match = pattern.exec(text))) {
    if (match.index > lastIndex) tokens.push({ type: 'text', value: text.slice(lastIndex, match.index) })
    if (match[1]) tokens.push({ type: 'link', label: match[2], href: match[3], title: match[4] })
    else if (match[5]) tokens.push({ type: 'code', value: match[5].slice(1, -1) })
    else if (match[6]) tokens.push({ type: 'bold', value: match[6].slice(2, -2) })
    else if (match[7]) tokens.push({ type: 'strike', value: match[7].slice(2, -2) })
    else tokens.push({ type: 'italic', value: match[8].slice(1, -1) })
    lastIndex = pattern.lastIndex
  }
  if (lastIndex < text.length) tokens.push({ type: 'text', value: text.slice(lastIndex) })

  return tokens.map((token, index) => {
    const key = `${keyPrefix}-${token.type}-${index}`
    if (token.type === 'link') {
      return isSafeMarkdownUrl(token.href) ? <a key={key} href={token.href} title={token.title} target="_blank" rel="noreferrer">{token.label}</a> : <React.Fragment key={key}>{token.label}</React.Fragment>
    }
    if (token.type === 'code') return <code key={key}>{token.value}</code>
    if (token.type === 'bold') return <strong key={key}>{renderInlineMarkdown(token.value, key)}</strong>
    if (token.type === 'italic') return <em key={key}>{renderInlineMarkdown(token.value, key)}</em>
    if (token.type === 'strike') return <del key={key}>{renderInlineMarkdown(token.value, key)}</del>
    return <React.Fragment key={key}>{token.value}</React.Fragment>
  })
}

function renderMarkdownList(lines, blockIndex, ordered) {
  const Tag = ordered ? 'ol' : 'ul'
  return (
    <Tag key={`list-${blockIndex}`}>
      {lines.map((line, lineIndex) => {
        const content = line.replace(/^\s*(?:[-*+]\s+|\d+[.)]\s+)/, '')
        const task = content.match(/^\[([ xX])\]\s+(.*)$/)
        return (
          <li key={`item-${blockIndex}-${lineIndex}`}>
            {task ? <label><input type="checkbox" checked={task[1].toLowerCase() === 'x'} readOnly /> {renderInlineMarkdown(task[2], `task-${blockIndex}-${lineIndex}`)}</label> : renderInlineMarkdown(content, `li-${blockIndex}-${lineIndex}`)}
          </li>
        )
      })}
    </Tag>
  )
}

function MarkdownMessage({ text }) {
  const lines = text.replace(/\r\n?/g, '\n').split('\n')
  const blocks = []
  let paragraph = []
  let code = null
  const flushParagraph = () => {
    if (paragraph.length) {
      blocks.push({ type: 'paragraph', lines: paragraph })
      paragraph = []
    }
  }

  lines.forEach((line) => {
    const fence = line.match(/^\s*```(.*)$/)
    if (fence) {
      if (code) blocks.push({ type: 'code', language: code.language, lines: code.lines })
      else {
        flushParagraph()
        code = { language: fence[1].trim(), lines: [] }
      }
    } else if (code) code.lines.push(line)
    else if (!line.trim()) flushParagraph()
    else paragraph.push(line)
  })
  if (code) blocks.push({ type: 'code', language: code.language, lines: code.lines })
  flushParagraph()

  return (
    <div className="message-markdown">
      {blocks.map((block, blockIndex) => {
        if (block.type === 'code') return <pre key={`block-${blockIndex}`}><code className={block.language ? `language-${block.language}` : undefined}>{block.lines.join('\n')}</code></pre>
        const content = block.lines
        const heading = content.length === 1 && content[0].match(/^\s*(#{1,6})\s+(.+?)\s*#*$/)
        if (heading) {
          const Tag = `h${Math.min(6, heading[1].length)}`
          return <Tag key={`block-${blockIndex}`}>{renderInlineMarkdown(heading[2], `heading-${blockIndex}`)}</Tag>
        }
        if (content.every((line) => /^\s*(?:[-*+]\s+|\d+[.)]\s+)/.test(line))) {
          return renderMarkdownList(content, blockIndex, /^\s*\d+[.)]\s+/.test(content[0]))
        }
        if (content.every((line) => /^\s*>\s?/.test(line))) {
          return <blockquote key={`block-${blockIndex}`}>{content.map((line, index) => <React.Fragment key={`quote-${index}`}>{index ? <br /> : null}{renderInlineMarkdown(line.replace(/^\s*>\s?/, ''), `quote-${blockIndex}-${index}`)}</React.Fragment>)}</blockquote>
        }
        const tableRows = content.filter((line) => line.includes('|')).map((line) => line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((cell) => cell.trim()))
        if (tableRows.length >= 2 && tableRows[1].every((cell) => /^:?-{3,}:?$/.test(cell))) {
          return <table key={`block-${blockIndex}`}><thead><tr>{tableRows[0].map((cell, index) => <th key={`th-${index}`}>{renderInlineMarkdown(cell, `th-${blockIndex}-${index}`)}</th>)}</tr></thead><tbody>{tableRows.slice(2).map((row, rowIndex) => <tr key={`tr-${rowIndex}`}>{tableRows[0].map((_, cellIndex) => <td key={`td-${rowIndex}-${cellIndex}`}>{renderInlineMarkdown(row[cellIndex] || '', `td-${blockIndex}-${rowIndex}-${cellIndex}`)}</td>)}</tr>)}</tbody></table>
        }
        return <p key={`block-${blockIndex}`}>{content.map((line, lineIndex) => <React.Fragment key={`line-${blockIndex}-${lineIndex}`}>{lineIndex ? <br /> : null}{renderInlineMarkdown(line, `p-${blockIndex}-${lineIndex}`)}</React.Fragment>)}</p>
      })}
    </div>
  )
}

function PromptComposer({
  status,
  prompt,
  referencePreview,
  attachments,
  onPromptChange,
  onSubmit,
  onAddAttachments,
  onRemoveAttachment,
  onClearReference,
}) {
  const textareaRef = useRef(null)
  const fileInputRef = useRef(null)
  const [isDraggingAttachments, setIsDraggingAttachments] = useState(false)

  useEffect(() => {
    const textarea = textareaRef.current
    if (!textarea) return
    textarea.style.height = 'auto'
    textarea.style.height = `${textarea.scrollHeight}px`
  }, [prompt])

  return (
    <form
      className="lovart-chat-composer"
      onDragEnter={(event) => {
        event.preventDefault()
        if (Array.from(event.dataTransfer?.types || []).includes('Files')) {
          setIsDraggingAttachments(true)
        }
      }}
      onDragOver={(event) => event.preventDefault()}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          setIsDraggingAttachments(false)
        }
      }}
      onDrop={(event) => {
        event.preventDefault()
        setIsDraggingAttachments(false)
        onAddAttachments(event.dataTransfer.files)
      }}
      onSubmit={onSubmit}
    >
      <div className={`chat-input-wrapper${isDraggingAttachments ? ' is-dragging-attachments' : ''}`}>
        {attachments.length ? (
          <div className="chat-attachment-previews" aria-label="已添加的图片">
            {attachments.map((attachment) => (
              <div className="chat-attachment-preview" key={attachment.id}>
                <img src={attachment.preview} alt={attachment.file.name} />
                <button
                  type="button"
                  className="chat-attachment-remove"
                  aria-label={`移除 ${attachment.file.name}`}
                  onClick={() => onRemoveAttachment(attachment.id)}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        ) : null}
        {referencePreview ? (
          <div className="chat-reference-preview">
            <img src={referencePreview} alt="参考图预览" />
            <div>
              <strong>当前参考图</strong>
              <span>下一次会同时传给理解和编辑接口</span>
            </div>
            <button type="button" className="meta-btn" onClick={onClearReference}>移除</button>
          </div>
        ) : null}
        <textarea
          ref={textareaRef}
          value={prompt}
          onChange={(event) => onPromptChange(event.target.value)}
          onKeyDown={(event) => {
            if (
              event.key === 'Enter' &&
              !event.shiftKey &&
              !event.nativeEvent.isComposing &&
              status !== '生成中'
            ) {
              event.preventDefault()
              event.currentTarget.form?.requestSubmit()
            }
          }}
          placeholder="输入提示词，开始你的创作"
          rows="2"
          className="chat-textarea"
        />
        <div className="chat-toolbar-bottom">
          <div className="chat-tools-left">
            <input
              ref={fileInputRef}
              className="chat-attachment-input"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              onChange={(event) => {
                onAddAttachments(event.target.files)
                event.target.value = ''
              }}
            />
            <button
              type="button"
              className="action-tool-btn"
              title="添加媒体"
              aria-label="添加图片"
              onClick={() => fileInputRef.current?.click()}
            >
              <IconPlus />
            </button>
            <button type="button" className="action-tool-btn" title="知识库"><IconBook /></button>
            <button type="button" className="action-tool-btn" title="表情"><IconSmile /></button>
            <div className="agent-selector">
              <span className="agent-indicator"></span>
              <span>Agent</span>
              <span className="arrow">▼</span>
            </div>
          </div>
          <div className="chat-tools-right">
            <button type="button" className="action-tool-btn" title="灵感"><IconSparkles /></button>
            <button type="button" className="action-tool-btn" title="预设"><IconPackage /></button>
            <button type="submit" className="send-prompt-btn" disabled={status === '生成中'}>
              <IconSend />
            </button>
          </div>
        </div>
      </div>
    </form>
  )
}

function ChatDrawer({
  messages,
  status,
  error,
  prompt,
  referencePreview,
  attachments,
  onPromptChange,
  onSubmit,
  onAddAttachments,
  onRemoveAttachment,
  onClearReference,
  onUseReference,
  onRetryRun,
}) {
  const [copyFeedback, setCopyFeedback] = useState({ messageId: '', text: '' })
  const copyFeedbackTimerRef = useRef(null)
  const chatHistoryRef = useRef(null)

  function scrollChatToBottom() {
    const chatHistory = chatHistoryRef.current
    if (!chatHistory) return
    chatHistory.scrollTop = chatHistory.scrollHeight
  }

  async function copyMessageText(messageId, text) {
    let copied = false
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text)
        copied = true
      }
    } catch {
      copied = false
    }

    if (!copied) {
      const textarea = document.createElement('textarea')
      textarea.value = text
      textarea.setAttribute('readonly', '')
      textarea.style.position = 'fixed'
      textarea.style.opacity = '0'
      document.body.appendChild(textarea)
      textarea.select()
      try {
        copied = document.execCommand('copy')
      } catch {
        copied = false
      } finally {
        document.body.removeChild(textarea)
      }
    }

    if (copyFeedbackTimerRef.current) window.clearTimeout(copyFeedbackTimerRef.current)
    setCopyFeedback({ messageId, text: copied ? '已复制' : '复制失败' })
    copyFeedbackTimerRef.current = window.setTimeout(() => {
      setCopyFeedback({ messageId: '', text: '' })
      copyFeedbackTimerRef.current = null
    }, 1800)
  }

  function handleMessageKeyDown(event, message) {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'c') {
      const selection = window.getSelection?.()
      if (selection && !selection.isCollapsed) return
      event.preventDefault()
      void copyMessageText(message.id, message.text)
    }
  }

  useEffect(() => () => {
    if (copyFeedbackTimerRef.current) window.clearTimeout(copyFeedbackTimerRef.current)
  }, [])

  useLayoutEffect(() => {
    scrollChatToBottom()
  }, [messages, status, error])

  return (
    <aside className="lovart-right-sidebar">
      <div className="lovart-chat-history" ref={chatHistoryRef}>
        {error ? <p className="chat-history-error" role="alert">{error}</p> : null}
        {messages.map((message) => (
          <article
            key={message.id}
            className={`chat-bubble-item ${message.role}`}
            tabIndex={message.role === 'assistant' && message.type !== 'loading' && message.type !== 'image' ? 0 : undefined}
            onKeyDown={message.role === 'assistant' && message.type !== 'loading' && message.type !== 'image' ? (event) => handleMessageKeyDown(event, message) : undefined}
          >
            {message.role === 'assistant' ? (
              <div className={`bot-message-wrapper ${message.type === 'image' ? 'is-image' : ''} ${message.type === 'error' ? 'message-error' : ''}`}>
                {message.type === 'loading' ? (
                  <>
                    <div className="assistant-loading-wrapper">
                      <LoadingDots />
                    </div>
                    <div className="message-meta-actions">
                      <button
                        className="meta-btn meta-btn-retry"
                        type="button"
                        title="此消息没有可重试的 Agent Run"
                        aria-label="此消息没有可重试的 Agent Run"
                        disabled
                      >
                        <IconRotate />
                      </button>
                    </div>
                  </>
                ) : message.type === 'image' ? (
                  <div className="assistant-image-card">
                    <img
                      src={normalizeAssetSrc(message.imageSrc)}
                      alt={message.imageAlt || '生成结果'}
                      className="assistant-image"
                      onLoad={scrollChatToBottom}
                    />
                    <div className="assistant-image-actions">
                      <button type="button" className="meta-btn" onClick={() => onUseReference?.(message.imageSrc)}>
                        设为参考图
                      </button>
                      <button type="button" className="meta-btn" onClick={() => downloadImage(message.imageSrc, `gpt-image2-reference-${message.id}.png`)}>
                        下载
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <MarkdownMessage text={message.text} />
                    <div className="message-meta-actions">
                      <button className="meta-btn" type="button" title="赞同"><IconThumbsUp /></button>
                      <button className="meta-btn" type="button" title="不满意"><IconThumbsDown /></button>
                      <button className="meta-btn" type="button" title="复制消息（可用 Tab 后按 Enter/空格）" aria-label="复制消息" onClick={() => copyMessageText(message.id, message.text)}><IconCopy /></button>
                      {copyFeedback.messageId === message.id ? <span className="copy-feedback" role="status" aria-live="polite">{copyFeedback.text}</span> : null}
                      {message.type !== 'loading' ? (
                        <button
                          className="meta-btn meta-btn-retry"
                          type="button"
                          title={message.isRetrying ? '正在重新生成' : message.runId ? '重新生成' : '此消息没有可重试的 Agent Run'}
                          aria-label={message.isRetrying ? '正在重新生成' : message.runId ? '重新生成本轮图片' : '此消息没有可重试的 Agent Run'}
                          disabled={!message.runId || message.isRetrying}
                          onClick={() => onRetryRun?.(message)}
                        >
                          <IconRotate />
                        </button>
                      ) : null}
                    </div>
                  </>
                )}
              </div>
            ) : (
              <div className="user-message-wrapper">
                <p className="message-text">{message.text}</p>
              </div>
            )}
          </article>
        ))}
      </div>

      <PromptComposer
        status={status}
        prompt={prompt}
        referencePreview={referencePreview}
        attachments={attachments}
        onPromptChange={onPromptChange}
        onSubmit={onSubmit}
        onAddAttachments={onAddAttachments}
        onRemoveAttachment={onRemoveAttachment}
        onClearReference={onClearReference}
      />
    </aside>
  )
}

function CanvasNotice({ records }) {
  if (!records.length) return null

  return (
    <aside className="lovart-skipped-records" aria-live="polite">
      <strong>跳过了 {records.length} 个无效画布元素。</strong>
      <span>已加载其他有效内容。</span>
    </aside>
  )
}

export default function Workbench({ projectId = null, initialLaunchPrompt = '', initialLaunchRatio = null, initialLaunchCount = null, initialLaunchModel = null }) {
  const [store] = useState(() => loadWorkbenchStore(projectId))
  const [editor, setEditor] = useState(null)
  const [status, setStatus] = useState('就绪')
  const [error, setError] = useState('')
  const [prompt, setPrompt] = useState('')
  const [count] = useState(1)
  const [referenceImage, setReferenceImage] = useState(null)
  const [referencePreview, setReferencePreview] = useState('')
  const [attachments, setAttachments] = useState([])
  const [history, setHistory] = useState([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historyLoaded, setHistoryLoaded] = useState(false)
  const [canvasPersistenceLoaded, setCanvasPersistenceLoaded] = useState(!projectId)
  const [launchAttachmentsReady, setLaunchAttachmentsReady] = useState(!initialLaunchPrompt)
  const [skippedRecords, setSkippedRecords] = useState([])
  const [messages, setMessages] = useState([
    {
      id: 'welcome',
      role: 'assistant',
      type: 'text',
      text: '告诉我你想生成什么画面，我会先理解你的意图，再帮你生成图片。',
    },
  ])
  const previewRef = useRef('')
  const attachmentPreviewsRef = useRef([])
  const launchConsumedRef = useRef(false)
  const launchTriggeredRef = useRef(false)
  const pendingCanvasInsertRef = useRef(null)
  const canvasHydratedRef = useRef(false)
  const historyLoadedRef = useRef(false)
  const generationInFlightRef = useRef(false)
  const canvasSaveTimerRef = useRef(null)
  const editorRef = useRef(null)
  const separationAbortRef = useRef(null)
  const selectedLaunchModel = initialLaunchModel && IMAGE_MODELS.some((model) => model.id === initialLaunchModel) ? initialLaunchModel : GPT_IMAGE_MODEL

  async function persistProjectCanvas(nextEditor) {
    if (!projectId || !nextEditor) return false
    try {
      const response = await fetch(`/api/projects/${projectId}`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          snapshot_json: getSnapshot(nextEditor.store),
          view_state_json: {
            camera: nextEditor.getCamera(),
            currentPageId: nextEditor.getCurrentPageId(),
          },
        }),
      })
      if (!response.ok) throw new Error(`项目画布保存失败（${response.status}）。`)
      return true
    } catch (error) {
      console.error(error)
      return false
    }
  }

  function scheduleProjectCanvasSave(nextEditor) {
    if (!projectId || !nextEditor.__workbenchCanvasPersistenceReady) return
    if (canvasSaveTimerRef.current) window.clearTimeout(canvasSaveTimerRef.current)
    canvasSaveTimerRef.current = window.setTimeout(() => {
      canvasSaveTimerRef.current = null
      persistProjectCanvas(nextEditor)
    }, 750)
  }

  useEffect(() => {
    if (!projectId || !editor) return
    let cancelled = false

    async function loadProjectCanvas() {
      try {
        const response = await fetch(`/api/projects/${projectId}`, { credentials: 'include' })
        if (!response.ok) return
        const project = await response.json()
        if (cancelled) return
        const snapshot = getNormalizedSnapshot(project.snapshot_json)
        if (snapshot && snapshotHasShapes(snapshot)) {
          loadSnapshot(editor.store, snapshot)
          canvasHydratedRef.current = true
        }
        if (project.view_state_json?.currentPageId) {
          editor.setCurrentPage(project.view_state_json.currentPageId)
        }
        if (project.view_state_json?.camera) {
          editor.setCamera(project.view_state_json.camera, { immediate: true, force: true })
        }
      } catch {
        // 忽略异常
      } finally {
        if (!cancelled) {
          editor.__workbenchCanvasPersistenceReady = true
          setCanvasPersistenceLoaded(true)
        }
      }
    }

    void loadProjectCanvas()
    return () => {
      cancelled = true
    }
  }, [editor, projectId])

  useEffect(() => {
    return () => {
      if (canvasSaveTimerRef.current) {
        window.clearTimeout(canvasSaveTimerRef.current)
      }
    }
  }, [])

  useEffect(() => {
    loadHistory()
  }, [])

  useEffect(() => {
    if (!projectId || !initialLaunchPrompt) return
    let cancelled = false

    async function hydrateLaunchAttachments() {
      try {
        const files = await loadLaunchAttachments(projectId)
        if (!files.length || cancelled) return
        const validationError = getAttachmentValidationError(files)
        if (validationError) {
          setError(`首页附件无法使用：${validationError}`)
          return
        }
        if (cancelled) return
        const nextAttachments = files.map((file) => ({
          id: `${file.name}-${file.size}-${file.lastModified}-${Math.random().toString(36).slice(2, 7)}`,
          file,
          preview: URL.createObjectURL(file),
        }))
        attachmentPreviewsRef.current.push(...nextAttachments.map((attachment) => attachment.preview))
        setAttachments(nextAttachments)
      } catch (err) {
        const message = err instanceof Error ? err.message : '附件交接失败，请重试。'
        setError(`首页附件无法使用：${message}`)
      } finally {
        if (!cancelled) setLaunchAttachmentsReady(true)
      }
    }

    void hydrateLaunchAttachments()
    return () => {
      cancelled = true
    }
  }, [initialLaunchPrompt, projectId])

  useEffect(() => {
    if (!initialLaunchPrompt || launchConsumedRef.current) return
    setPrompt(initialLaunchPrompt)
    launchConsumedRef.current = true
  }, [initialLaunchPrompt])

  useEffect(() => {
    if (!editor || !pendingCanvasInsertRef.current) return
    const { images, meta, referenceImage, placeholderIds } = pendingCanvasInsertRef.current
    pendingCanvasInsertRef.current = null
    void addImagesToCanvas(editor, images, meta, referenceImage, placeholderIds)
  }, [editor])

  useEffect(() => {
    if (!projectId || !editor || !history.length || !canvasPersistenceLoaded) return
    void (async () => {
      for (const item of [...history].reverse()) {
        await addImagesToCanvas(editor, getGenerationImages(item), {
          prompt: item.prompt || '',
          ratio: item.ratio || '1:1',
          quality: item.quality || 'High',
          style: item.style || '柔和电影感',
        })
      }
    })()
  }, [canvasPersistenceLoaded, editor, history, projectId])

  useEffect(() => {
    if (!projectId || !initialLaunchPrompt || !launchAttachmentsReady || !canvasPersistenceLoaded || launchTriggeredRef.current || !historyLoaded || history.length > 0) return
    if (prompt.trim() !== initialLaunchPrompt.trim()) return
    launchTriggeredRef.current = true
    const cleanUrl = `/workbench?projectId=${projectId}`
    window.history.replaceState({}, '', cleanUrl)
    window.dispatchEvent(new PopStateEvent('popstate'))
    void generateImage({ ratio: initialLaunchRatio, count: initialLaunchCount, model: selectedLaunchModel })
  }, [canvasPersistenceLoaded, history, historyLoaded, initialLaunchCount, initialLaunchPrompt, initialLaunchRatio, launchAttachmentsReady, projectId, prompt])

  useEffect(() => {
    return () => {
      if (previewRef.current) {
        URL.revokeObjectURL(previewRef.current)
      }
    }
  }, [])

  useEffect(() => {
    return () => {
      attachmentPreviewsRef.current.forEach((preview) => URL.revokeObjectURL(preview))
    }
  }, [])

  async function loadHistory() {
    setHistoryLoading(true)
    try {
      const historyPath = projectId ? `/api/projects/${projectId}/generations` : '/api/history'
      const requests = [fetch(historyPath, { credentials: 'include' })]
      if (projectId) {
        requests.push(fetch(`/api/projects/${projectId}/messages`, { credentials: 'include' }))
      }

      const [historyResponse, messagesResponse] = await Promise.all(requests)
      if (historyResponse.ok) {
        const data = await historyResponse.json()
        const items = Array.isArray(data.items) ? data.items : Array.isArray(data) ? data : []
        setHistory(items)
      }
      if (messagesResponse?.ok) {
        const storedMessages = await messagesResponse.json()
        if (Array.isArray(storedMessages) && storedMessages.length) {
          const uniqueMessages = [...new Map(storedMessages.map((message) => [message.id, message])).values()]
          setMessages(uniqueMessages.map(projectMessageToChatMessage))
        }
      }
    } catch (err) {
      setError(err instanceof Error ? `加载项目历史失败：${err.message}` : '加载项目历史失败，请刷新后重试。')
    } finally {
      historyLoadedRef.current = true
      setHistoryLoaded(true)
      setHistoryLoading(false)
    }
  }

  async function persistProjectMessage(role, messageType, text, extra = {}) {
    if (!projectId) return
    const response = await fetch(`/api/projects/${projectId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ role, message_type: messageType, text, ...extra }),
    })
    if (!response.ok) {
      throw new Error('保存项目对话失败。')
    }
  }

  function queueCanvasInsert(images, meta, reference = null, placeholderIds = []) {
    pendingCanvasInsertRef.current = { images, meta, referenceImage: reference, placeholderIds }
    if (editor) {
      const next = pendingCanvasInsertRef.current
      pendingCanvasInsertRef.current = null
      void addImagesToCanvas(editor, next.images, next.meta, next.referenceImage, next.placeholderIds)
    }
  }

  function pushMessage(role, text, extra = {}) {
    setMessages((current) => [...current, createChatMessage(role, extra.type || 'text', { text, ...extra })])
  }

  function replaceMessage(messageId, nextMessage) {
    setMessages((current) => current.map((message) => (message.id === messageId ? { ...message, ...nextMessage } : message)))
  }

  function removeMessage(messageId) {
    setMessages((current) => current.filter((message) => message.id !== messageId))
  }

  async function generateImage({
    prompt: promptOverride = prompt,
    referenceImage: referenceOverride = referenceImage,
    ratio: ratioOverride,
    resolution: resolutionOverride,
    count: countOverride,
    model: modelOverride = selectedLaunchModel,
  } = {}) {
    if (generationInFlightRef.current) return
    const userPrompt = promptOverride.trim()
    if (!userPrompt) return

    generationInFlightRef.current = true
    let loadingMessage
    let createdPlaceholderIds = []

    try {
      const generationReference = referenceOverride
      const targetCount = countOverride ? Math.max(1, Math.min(8, Number(countOverride))) : 1
      const targetRatio = ratioOverride && ratioOverride !== 'auto'
        ? ratioOverride
        : generationReference?.ratio || '1:1'

      // 生图开始时，立刻在画布上创建可响应拖拽的占位 Shape 并选中
      if (editor) {
        createdPlaceholderIds = createPlaceholderShapes(editor, targetCount, targetRatio, generationReference)
      }

      setStatus('生成中')
      setError('')

      const userMessage = createChatMessage('user', 'text', { text: userPrompt })
      loadingMessage = createChatMessage('assistant', 'loading', {
        text: '正在生成',
        prompt: userPrompt,
        generationRatio: targetRatio,
        generationQuality: resolutionOverride ? { '1K': 'Draft', '2K': 'High', '4K': 'Ultra' }[resolutionOverride] || 'High' : 'High',
        generationCount: targetCount,
      })
      const nextMessages = [...messages, userMessage, loadingMessage]
      setMessages(nextMessages)
      setPrompt('')

      const textMessages = nextMessages.filter((item) => item.type === 'text')
      const understandMessages = [...textMessages]
      if (generationReference) {
        understandMessages[understandMessages.length - 1] = {
          ...understandMessages[understandMessages.length - 1],
          image_url: generationReference.src,
        }
      }

      const historicalImage = getLatestHistoricalGeneratedImage(history)
      const historicalImageSrc = historicalImage?.src || ''
      const generationImageUrl = generationReference?.src || historicalImageSrc
      const referenceSrc = generationReference?.src || ''
      const imageCapacity = 8 - Number(Boolean(referenceSrc))
      const attachmentUrls = !projectId
        ? await Promise.all(attachments.map((attachment) => getFileDataUrl(attachment.file)))
        : []
      const imageUrls = [...new Set(attachmentUrls.filter((src) => src && src !== referenceSrc))].slice(0, imageCapacity)
      if (historicalImageSrc && historicalImageSrc !== referenceSrc && !imageUrls.includes(historicalImageSrc) && imageUrls.length < imageCapacity) {
        imageUrls.push(historicalImageSrc)
      }

      let interpretedPrompt = userPrompt
      let interpretedStyle = '柔和电影感'
      let interpretedRatio = targetRatio
      const resolutionQuality = { '1K': 'Draft', '2K': 'High', '4K': 'Ultra' }
      let interpretedQuality = resolutionQuality[resolutionOverride] || 'High'
      let assistantReply = '已生成图片。'
      let data

      if (projectId) {
        const uploadForm = new FormData()
        attachments.forEach((attachment) => uploadForm.append('image', attachment.file))
        let attachmentAssetIds = []
        if (attachments.length) {
          setStatus('上传并规范化参考图')
          const uploadResponse = await fetch(`/api/projects/${projectId}/assets`, {
            method: 'POST',
            credentials: 'include',
            body: uploadForm,
          })
          const uploadData = await uploadResponse.json()
          if (!uploadResponse.ok) {
            throw new Error(uploadData.detail?.error?.message || uploadData.detail || '参考图上传失败。')
          }
          attachmentAssetIds = uploadData.map((asset) => asset.id)
        }
        setStatus('生成中')
        const idempotencyKey = createIdempotencyKey()
        const response = await fetch(`/api/projects/${projectId}/agent-runs`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            prompt: userPrompt,
            messages: understandMessages.map((item) => ({
              role: item.role,
              text: item.text,
            })),
            ...(generationReference?.assetId || historicalImage?.assetId
              ? { reference_asset_id: generationReference?.assetId || historicalImage.assetId }
              : {}),
            attachment_asset_ids: attachmentAssetIds,
            execution_mode: 'direct',
            generation_ratio: targetRatio,
            generation_quality: interpretedQuality,
            ...(countOverride ? { generation_count: countOverride } : {}),
            model: modelOverride,
            idempotency_key: idempotencyKey,
          }),
        })
        data = await response.json()
        if (!response.ok) {
          const requestError = new Error(data.detail?.error?.message || data.detail || data.error?.message || data.error_message || '生成失败，请检查后端服务。')
          requestError.errorCode = data.error_code || data.detail?.error?.error_code || ''
          throw requestError
        }
        if (data.status === 'failed') {
          const runError = new Error(data.error_message || '生成失败，请稍后重试。')
          runError.runId = data.run_id || ''
          runError.errorCode = data.error_code || ''
          runError.retryable = Boolean(data.retryable && data.run_id)
          throw runError
        }
        assistantReply = (data.assistant_reply || `已生成 ${(data.images || []).length} 张图片。`).trim()
      } else {
        const understandPayload = {
          messages: understandMessages.map((item) => ({
            role: item.role,
            text: item.text,
            ...(item.image_url ? { image_url: item.image_url } : {}),
            ...(item === understandMessages[understandMessages.length - 1] && imageUrls.length
              ? { image_urls: imageUrls }
              : {}),
          })),
        }

        const understandResponse = await fetch('/api/chat-understand', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(understandPayload),
        })
        const understandData = await understandResponse.json()
        if (!understandResponse.ok) {
          throw new Error(understandData.detail || '对话理解失败，请检查 MiniMax 服务配置。')
        }

        interpretedPrompt = (understandData.interpreted_prompt || userPrompt).trim()
        interpretedStyle = (understandData.interpreted_style || '柔和电影感').trim()
        interpretedRatio = ratioOverride && ratioOverride !== 'auto'
          ? ratioOverride
          : generationReference?.ratio || understandData.interpreted_ratio || '1:1'
        interpretedQuality = resolutionQuality[resolutionOverride] || understandData.interpreted_quality || 'High'
        const interpretedCount = countOverride
          ? Math.max(1, Math.min(8, Number(countOverride)))
          : Number.isFinite(Number(understandData.interpreted_count))
            ? Math.max(1, Math.min(8, Number(understandData.interpreted_count)))
            : 1
        assistantReply = (understandData.assistant_reply || '我已经理解你的需求，开始生成图片。').trim()
        const requestPayload = {
          project_id: projectId,
          prompt: interpretedPrompt,
          style: interpretedStyle,
          ratio: interpretedRatio,
          quality: interpretedQuality,
          count: interpretedCount,
          model: modelOverride,
          ...(generationImageUrl
            ? {
                image_url: generationImageUrl,
                ...(generationReference?.assetId ? { reference_asset_id: generationReference.assetId } : {}),
              }
            : {}),
        }
        const generationForm = new FormData()
        generationForm.append('payload', JSON.stringify(requestPayload))
        attachments.forEach((attachment) => generationForm.append('image', attachment.file))

        const response = await fetch('/api/generate-image', {
          method: 'POST',
          ...(attachments.length
            ? { body: generationForm }
            : { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(requestPayload) }),
        })
        data = await response.json()
        if (!response.ok) {
          throw new Error(data.detail || '生成失败，请检查后端服务。')
        }
      }

      const images = projectId
        ? (data.images || []).map((asset) => ({
            src: asset.src,
            assetId: asset.id,
            referenceAssetId: asset.metadata?.reference_asset_id ?? null,
          }))
        : Array.isArray(data.output_assets) && data.output_assets.length
          ? data.output_assets.map((asset) => ({ src: asset.src, assetId: asset.id }))
          : extractGeneratedImages(data)
      const completedTextOnlyRun = projectId && data.status === 'completed' && !images.length && !generationReference
      if (!images.length && !completedTextOnlyRun) {
        throw new Error('接口返回成功，但没有可用的生成图像。')
      }

      if (projectId) {
        canvasHydratedRef.current = true
      }
      if (images.length) {
        queueCanvasInsert(images, {
          prompt: interpretedPrompt,
          ratio: interpretedRatio,
          quality: interpretedQuality,
          style: interpretedStyle,
        }, generationReference, createdPlaceholderIds)
      } else {
        // 若没有图像返回，清除占位
        if (editor && createdPlaceholderIds.length) {
          createdPlaceholderIds.forEach((id) => editor.deleteShape(id))
        }
      }

      replaceMessage(loadingMessage.id, {
        type: 'text',
        text: assistantReply,
        runId: projectId ? data?.run_id || '' : '',
        prompt: userPrompt,
        generationRatio: projectId ? targetRatio : interpretedRatio,
        generationQuality: projectId ? interpretedQuality : interpretedQuality,
        generationCount: countOverride || 1,
      })
      if (images.length) {
        images.forEach((image) => {
          pushMessage('assistant', '', {
            type: 'image',
            imageSrc: image.src,
            imageAlt: interpretedPrompt || '生成结果',
          })
        })
      }
      setStatus('已完成')
      if (projectId && initialLaunchPrompt) {
        try {
          await clearLaunchAttachments(projectId)
        } catch (err) {
          const message = err instanceof Error ? err.message : '附件交接记录清理失败。'
          setError(`结果已生成，但${message}`)
        }
      }
      clearAttachments()
      await loadHistory()
    } catch (err) {
      setStatus('失败')
      const message = err instanceof Error ? err.message : '生成失败，请确认后端服务已启动。'
      setError(message)
      if (loadingMessage) {
        replaceMessage(loadingMessage.id, {
          type: 'error',
          text: message,
          runId: err instanceof Error ? err.runId : '',
          errorCode: err instanceof Error ? err.errorCode || '' : '',
          retryable: err instanceof Error ? err.retryable === true : false,
          isRetrying: false,
        })
      } else {
        pushMessage('assistant', message, { type: 'error' })
      }
      if (editor && createdPlaceholderIds.length) {
        createdPlaceholderIds.forEach((id) => editor.deleteShape(id))
      }
    } finally {
      generationInFlightRef.current = false
    }
  }

  function handleMount(nextEditor) {
    editorRef.current = nextEditor
    nextEditor.__workbenchProjectId = projectId
    nextEditor.__workbenchPersistProjectCanvas = () => persistProjectCanvas(nextEditor)
    nextEditor.__workbenchSeparateImage = (sourceShapeId, onStatusChange) => separateImage(sourceShapeId, onStatusChange, nextEditor)
    setEditor(nextEditor)
    restoreWorkbenchView(nextEditor, projectId)

    const unsubscribe = nextEditor.store.listen(
      () => {
        saveWorkbenchStore(nextEditor)
        scheduleProjectCanvasSave(nextEditor)
      },
      { source: 'user', scope: 'document' }
    )

    saveWorkbenchStore(nextEditor)

    return () => {
      unsubscribe()
      if (separationAbortRef.current) {
        separationAbortRef.current.abort()
        separationAbortRef.current = null
      }
      if (editorRef.current === nextEditor) editorRef.current = null
      if (canvasSaveTimerRef.current) {
        window.clearTimeout(canvasSaveTimerRef.current)
        canvasSaveTimerRef.current = null
      }
      if (nextEditor.__workbenchCanvasPersistenceReady) {
        void persistProjectCanvas(nextEditor)
      }
      saveWorkbenchStore(nextEditor)
    }
  }

  function handleAddAttachments(fileList) {
    const selectedFiles = Array.from(fileList || [])
    const validationError = getAttachmentValidationError(selectedFiles, attachments.map((attachment) => attachment.file))
    if (validationError) {
      setError(validationError)
      return
    }
    if (!selectedFiles.length) return
    setError('')
    const nextAttachments = selectedFiles.map((file) => ({
      id: `${file.name}-${file.size}-${file.lastModified}-${Math.random().toString(36).slice(2, 7)}`,
      file,
      preview: URL.createObjectURL(file),
    }))
    attachmentPreviewsRef.current.push(...nextAttachments.map((attachment) => attachment.preview))
    setAttachments((current) => [...current, ...nextAttachments])
  }

  function handleRemoveAttachment(id) {
    setAttachments((current) => {
      const attachment = current.find((item) => item.id === id)
      if (attachment) {
        URL.revokeObjectURL(attachment.preview)
        attachmentPreviewsRef.current = attachmentPreviewsRef.current.filter((preview) => preview !== attachment.preview)
      }
      return current.filter((item) => item.id !== id)
    })
  }

  function clearAttachments() {
    attachmentPreviewsRef.current.forEach((preview) => URL.revokeObjectURL(preview))
    attachmentPreviewsRef.current = []
    setAttachments([])
  }

  function handleUseReference(src) {
    const shapeId = editor ? getImageShapeIdBySrc(editor, src) : null
    const sourceShape = shapeId ? editor.getShape(shapeId) : null
    setReferenceImage({
      src,
      shapeId,
      assetId: sourceShape?.meta?.projectAssetId ?? null,
      ratio: sourceShape?.meta?.ratio ?? null,
    })
    setReferencePreview(src)
  }

  function clearReferenceImage() {
    setReferenceImage(null)
    setReferencePreview('')
  }

  async function separateImage(sourceShapeId, onStatusChange, mountedEditor = editorRef.current) {
    if (!projectId || !mountedEditor) throw new Error('当前画布项目不可用，请保留原图继续编辑。')
    const sourceShape = mountedEditor.getShape(sourceShapeId)
    const sourceAssetId = sourceShape?.meta?.projectAssetId
    if (!sourceShape || sourceShape.type !== 'image' || !sourceAssetId) {
      throw new Error('该图片缺少项目素材信息，暂不支持分离编辑。')
    }
    if (sourceShape.rotation || sourceShape.props?.crop) {
      throw new Error('暂不支持旋转或裁剪图片的分离编辑。')
    }

    const abortController = new AbortController()
    separationAbortRef.current?.abort()
    separationAbortRef.current = abortController
    const isCurrentEditor = () => editorRef.current === mountedEditor && !abortController.signal.aborted
    try {
      const createResponse = await fetch(`/api/projects/${projectId}/image-separations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        signal: abortController.signal,
        body: JSON.stringify({ source_asset_id: sourceAssetId, source_shape_id: sourceShapeId, mode: 'auto' }),
      })
      const createData = await createResponse.json().catch(() => ({}))
      if (!createResponse.ok) throw new Error(createData.detail || '图片分离任务创建失败，请保留原图继续编辑。')

      const separationId = createData.separation_id
      while (true) {
        if (!isCurrentEditor()) throw new DOMException('图片分离已取消。', 'AbortError')
        const response = await fetch(`/api/projects/${projectId}/image-separations/${separationId}`, {
          credentials: 'include',
          signal: abortController.signal,
        })
        const data = await response.json().catch(() => ({}))
        if (!response.ok) throw new Error(data.detail || '图片分离任务查询失败，请保留原图继续编辑。')
        if (!isCurrentEditor()) throw new DOMException('图片分离已取消。', 'AbortError')
        onStatusChange?.(data.status)
        if (data.layers?.length && data.status === 'processing') {
          const previewSourceShape = mountedEditor.getShape(sourceShapeId)
          if (previewSourceShape?.type === 'image') {
            await insertImageSeparationResult(mountedEditor, data, previewSourceShape, { preview: true })
            saveWorkbenchStore(mountedEditor)
          }
        }
        if (data.status === 'completed') {
          const latestSourceShape = mountedEditor.getShape(sourceShapeId)
          if (!isCurrentEditor() || !latestSourceShape || latestSourceShape.type !== 'image') {
            throw new DOMException('图片分离已取消。', 'AbortError')
          }
          const insertion = await insertImageSeparationResult(mountedEditor, data, latestSourceShape)
          const saved = await persistProjectCanvas(mountedEditor)
          if (!saved) {
            if (insertion.createdShapeIds.length) mountedEditor.deleteShapes(insertion.createdShapeIds)
            if (insertion.createdAssetIds.length) mountedEditor.deleteAssets(insertion.createdAssetIds)
            try {
              await fetch(`/api/projects/${projectId}/image-separations/${separationId}`, {
                method: 'DELETE',
                credentials: 'include',
              })
            } catch {
              // The local canvas is still restored; a later retry can clean up the server result.
            }
            mountedEditor.updateShape({
              id: insertion.sourceShape.id,
              type: 'image',
              opacity: insertion.sourceShape.opacity,
              meta: insertion.sourceShape.meta,
            })
            mountedEditor.select(insertion.sourceShape.id)
            throw new Error('项目画布保存失败，请稍后重试。')
          }
          return
        }
        if (data.status === 'failed') throw new Error(data.message || '图片分离失败，请保留原图继续编辑。')
        await new Promise((resolve, reject) => {
          const timeoutId = window.setTimeout(resolve, 1500)
          abortController.signal.addEventListener('abort', () => {
            window.clearTimeout(timeoutId)
            reject(new DOMException('图片分离已取消。', 'AbortError'))
          }, { once: true })
        })
      }
    } finally {
      if (separationAbortRef.current === abortController) separationAbortRef.current = null
    }
  }

  function handleInspectorGenerate({
    prompt: nextPrompt,
    referenceImage: nextReference,
    ratio: nextRatio,
    resolution: nextResolution,
    count: nextCount,
    model: nextModel,
  }) {
    setReferenceImage(nextReference)
    setReferencePreview(nextReference.src)
    void generateImage({
      prompt: nextPrompt,
      referenceImage: nextReference,
      ratio: nextRatio,
      resolution: nextResolution,
      count: nextCount,
      model: nextModel,
    })
  }

  async function handleRetryRun(message) {
    if (!projectId || !message?.runId || generationInFlightRef.current || message.isRetrying) return

    generationInFlightRef.current = true
    const retryLoading = createChatMessage('assistant', 'loading', {
      text: '正在重新生成',
      prompt: message.prompt,
      generationRatio: message.generationRatio,
      generationQuality: message.generationQuality,
      generationCount: message.generationCount,
    })
    let createdPlaceholderIds = []
    replaceMessage(message.id, { isRetrying: true })
    setMessages((current) => [...current, retryLoading])

    try {
      const targetRatio = message.generationRatio || '1:1'
      const targetCount = Math.max(1, Math.min(8, Number(message.generationCount) || 1))
      if (editor) {
        createdPlaceholderIds = createPlaceholderShapes(editor, targetCount, targetRatio, null)
      }
      setStatus('生成中')
      setError('')
      const response = await fetch(`/api/projects/${projectId}/agent-runs/${message.runId}/retry`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ idempotency_key: createIdempotencyKey() }),
      })
      const data = await response.json()
      if (!response.ok) {
        const requestError = new Error(data.detail?.error?.message || data.detail || data.error?.message || data.error_message || '重试失败，请稍后再试。')
        requestError.errorCode = data.error_code || data.detail?.error?.error_code || ''
        throw requestError
      }
      if (data.status === 'failed') {
        const retryError = new Error(data.error_message || '生成失败，请稍后重试。')
        retryError.runId = data.run_id || ''
        retryError.errorCode = data.error_code || ''
        retryError.retryable = Boolean(data.retryable && retryError.runId)
        throw retryError
      }

      const images = (data.images || []).map((asset) => ({
        src: asset.src,
        assetId: asset.id,
        referenceAssetId: asset.metadata?.reference_asset_id ?? null,
      }))
      if (!images.length && data.status !== 'completed') {
        throw new Error('接口返回成功，但没有可用的生成图像。')
      }
      if (images.length) {
        queueCanvasInsert(images, {
          prompt: message.prompt || '',
          ratio: targetRatio,
          quality: message.generationQuality || 'High',
          style: '柔和电影感',
        }, null, createdPlaceholderIds)
      } else if (editor) {
        createdPlaceholderIds.forEach((id) => editor.deleteShape(id))
      }
      replaceMessage(retryLoading.id, {
        type: 'text',
        text: (data.assistant_reply || `已生成 ${images.length} 张图片。`).trim(),
        runId: data.run_id || '',
        prompt: message.prompt,
        generationRatio: targetRatio,
        generationQuality: message.generationQuality,
        generationCount: targetCount,
      })
      images.forEach((image) => {
        pushMessage('assistant', '', {
          type: 'image',
          imageSrc: image.src,
          imageAlt: message.prompt || '生成结果',
        })
      })
      replaceMessage(message.id, { isRetrying: false })
      setStatus('已完成')
      await loadHistory()
    } catch (err) {
      const retryMessage = err instanceof Error ? err.message : '重试失败，请稍后再试。'
      setStatus('失败')
      setError(retryMessage)
      replaceMessage(retryLoading.id, {
        type: 'error',
        text: retryMessage,
        runId: err instanceof Error && err.retryable === true && err.runId ? err.runId : '',
        errorCode: err instanceof Error ? err.errorCode || '' : '',
        retryable: err instanceof Error && err.retryable === true && Boolean(err.runId),
        prompt: message.prompt,
        generationRatio: message.generationRatio,
        generationQuality: message.generationQuality,
        generationCount: message.generationCount,
      })
      replaceMessage(message.id, { isRetrying: false })
      if (editor && createdPlaceholderIds.length) {
        createdPlaceholderIds.forEach((id) => editor.deleteShape(id))
      }
    } finally {
      generationInFlightRef.current = false
    }
  }

  function handleChatSubmit(event) {
    event.preventDefault()
    void generateImage()
  }

  return (
    <main className="lovart-workbench" aria-label="Lovart style infinite canvas">
      <section className="lovart-stage">
        <div className="lovart-canvas-shell">
          <Tldraw
            store={store}
            onMount={handleMount}
            inferDarkMode={false}
            components={{
              StylePanel: HiddenStylePanel,
              ImageToolbar: ImageToolbarWithSeparateEdit,
            }}
          />
          <ComfyLinesOverlay editor={editor} />
          {/* 🌟 纯净无边框圆角占位与左上角 3 点跳动动画，支持实时移动跟随 */}
          <PlaceholderLoadingOverlay editor={editor} />
          <ImageSelectionHeader editor={editor} />
          <ImagePromptInspector
            editor={editor}
            onGenerateWithRef={handleInspectorGenerate}
            initialLaunchModel={initialLaunchModel}
          />
          <CanvasNotice records={skippedRecords} />
        </div>

        <ChatDrawer
          messages={messages}
          prompt={prompt}
          error={error}
          referencePreview={referencePreview}
          attachments={attachments}
          status={status}
          onPromptChange={setPrompt}
          onSubmit={handleChatSubmit}
          onAddAttachments={handleAddAttachments}
          onRemoveAttachment={handleRemoveAttachment}
          onClearReference={clearReferenceImage}
          onUseReference={handleUseReference}
          onRetryRun={handleRetryRun}
        />
      </section>
    </main>
  )
}