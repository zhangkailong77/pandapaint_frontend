import React from 'react'
import { clamp, createSelectionSet, screenToWorld, worldToScreen } from './workbenchState.js'

const MIN_ZOOM = 0.35
const MAX_ZOOM = 2.5
const ZOOM_STEP = 0.12

function CanvasWorkbench(
  {
    items,
    viewport,
    selectionId,
    generationStatus,
    onViewportChange,
    onSelectItem,
    onMoveItem,
    onResetView,
    onDeleteSelectedItem,
  },
  ref
) {
  const hostRef = React.useRef(null)
  const pointerStateRef = React.useRef(null)
  const selectionSet = React.useMemo(() => createSelectionSet(selectionId ? [selectionId] : []), [selectionId])

  React.useImperativeHandle(ref, () => hostRef.current)

  function updateViewport(nextViewport) {
    onViewportChange({
      x: Number.isFinite(nextViewport.x) ? nextViewport.x : 0,
      y: Number.isFinite(nextViewport.y) ? nextViewport.y : 0,
      zoom: clamp(Number.isFinite(nextViewport.zoom) ? nextViewport.zoom : 1, MIN_ZOOM, MAX_ZOOM),
    })
  }

  function handleWheel(event) {
    event.preventDefault()
    const rect = hostRef.current?.getBoundingClientRect()
    if (!rect) return

    const cursor = { x: event.clientX - rect.left, y: event.clientY - rect.top }
    const worldCursor = screenToWorld(cursor, viewport)
    const delta = event.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP
    const nextZoom = clamp(viewport.zoom + delta, MIN_ZOOM, MAX_ZOOM)

    updateViewport({
      zoom: nextZoom,
      x: cursor.x - worldCursor.x * nextZoom,
      y: cursor.y - worldCursor.y * nextZoom,
    })
  }

  function handlePointerDown(event) {
    const target = event.target.closest('[data-canvas-item-id]')
    if (target) {
      const itemId = target.getAttribute('data-canvas-item-id')
      onSelectItem(itemId)

      pointerStateRef.current = {
        mode: 'item',
        itemId,
        startX: event.clientX,
        startY: event.clientY,
        origin: items.find((item) => item.id === itemId) || null,
      }
      event.currentTarget.setPointerCapture?.(event.pointerId)
      return
    }

    onSelectItem(null)
    pointerStateRef.current = {
      mode: 'pan',
      startX: event.clientX,
      startY: event.clientY,
      originX: viewport.x,
      originY: viewport.y,
    }
    event.currentTarget.setPointerCapture?.(event.pointerId)
  }

  function handlePointerMove(event) {
    const state = pointerStateRef.current
    if (!state) return

    if (state.mode === 'pan') {
      updateViewport({
        x: state.originX + (event.clientX - state.startX),
        y: state.originY + (event.clientY - state.startY),
        zoom: viewport.zoom,
      })
      return
    }

    if (state.mode === 'item' && state.origin) {
      const deltaX = (event.clientX - state.startX) / viewport.zoom
      const deltaY = (event.clientY - state.startY) / viewport.zoom
      onMoveItem(state.itemId, {
        x: state.origin.x + deltaX,
        y: state.origin.y + deltaY,
      })
    }
  }

  function handlePointerUp() {
    pointerStateRef.current = null
  }

  function handleKeyDown(event) {
    if (event.key === 'Escape') {
      onResetView()
    }
    if ((event.key === 'Delete' || event.key === 'Backspace') && selectionId) {
      event.preventDefault()
      onDeleteSelectedItem()
    }
    if ((event.ctrlKey || event.metaKey) && event.key === '0') {
      event.preventDefault()
      onResetView()
    }
  }

  function zoomBy(factor) {
    const rect = hostRef.current?.getBoundingClientRect()
    const centerX = rect ? rect.width / 2 : window.innerWidth / 2
    const centerY = rect ? rect.height / 2 : window.innerHeight / 2
    const nextZoom = clamp(viewport.zoom * factor, MIN_ZOOM, MAX_ZOOM)
    const worldCenter = screenToWorld({ x: centerX, y: centerY }, viewport)

    updateViewport({
      zoom: nextZoom,
      x: centerX - worldCenter.x * nextZoom,
      y: centerY - worldCenter.y * nextZoom,
    })
  }

  return (
    <section className="canvas-stage glass-card" aria-label="无限画布" onKeyDown={handleKeyDown} tabIndex={0}>
      <div className="canvas-stage-header">
        <div>
          <span>工作画布</span>
          <strong>{generationStatus}</strong>
        </div>
        <div className="canvas-stage-actions">
          <button type="button" onClick={() => zoomBy(1.12)}>放大</button>
          <button type="button" onClick={() => zoomBy(0.88)}>缩小</button>
          <button type="button" onClick={onResetView}>重置视图</button>
        </div>
      </div>

      <div
        ref={hostRef}
        className="canvas-viewport"
        role="presentation"
        onWheel={handleWheel}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        tabIndex={0}
      >
        <div
          className="canvas-grid"
          style={{
            transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`,
          }}
        >
          <div className="canvas-origin" />
          {items.map((item) => {
            const screenBounds = worldToScreen({ x: item.x, y: item.y }, viewport)
            const isSelected = selectionSet.has(item.id)
            return (
              <article
                key={item.id}
                className={`canvas-item ${isSelected ? 'is-selected' : ''}`}
                data-canvas-item-id={item.id}
                style={{
                  left: item.x,
                  top: item.y,
                  width: item.width,
                  height: item.height,
                }}
                aria-label={item.prompt || item.id}
              >
                <img src={item.src} alt={item.prompt || '生成图片'} draggable="false" />
                <div className="canvas-item-meta">
                  <span>{item.ratio}</span>
                  <small>{screenBounds.x.toFixed(0)}, {screenBounds.y.toFixed(0)}</small>
                </div>
              </article>
            )
          })}
          {!items.length ? (
            <div className={`canvas-empty ${generationStatus === '生成中' ? 'is-generating' : ''}`}>
              <strong>{generationStatus === '生成中' ? '图片正在进入画布' : '等待生成任务'}</strong>
              <p>拖动画布、滚轮缩放，生成结果会落在视口中心附近。</p>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  )
}

export default React.forwardRef(CanvasWorkbench)
