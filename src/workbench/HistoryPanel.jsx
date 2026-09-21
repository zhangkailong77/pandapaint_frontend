import React from 'react'
import { downloadImage, formatHistoryTime } from './workbenchState.js'

export default function HistoryPanel({ loading, items, onClearHistory, onAddToCanvas, onDownloadAll }) {
  return (
    <aside className="history-drawer glass-card">
      <div className="panel-header">
        <span>历史素材</span>
        <div className="history-actions">
          <button type="button" onClick={onDownloadAll} disabled={!items.length}>下载全部</button>
          <button type="button" onClick={onClearHistory} disabled={loading}>清空记录</button>
        </div>
      </div>

      {items.length > 0 ? (
        <div className="history-list">
          {items.map((item, index) => (
            <article key={item.id} className="history-item">
              <img className="history-thumb" src={item.src} alt={`历史生成 ${index + 1}`} />
              <div className="history-copy">
                <strong>{item.prompt}</strong>
                <p>{item.style} · {item.ratio} · {item.quality}</p>
                <small>{formatHistoryTime(item.created_at)}</small>
              </div>
              <div className="history-row">
                <button type="button" onClick={() => onAddToCanvas(item)}>放入画布</button>
                <button type="button" onClick={() => downloadImage(item.src, `gpt-image2-history-${index + 1}.png`)}>下载</button>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="history-empty">暂无历史图片</div>
      )}
    </aside>
  )
}
