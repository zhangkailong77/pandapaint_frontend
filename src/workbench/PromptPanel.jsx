import React from 'react'
import { WORKBENCH_EXAMPLES } from './workbenchState.js'

export default function PromptPanel({
  generation,
  promptScore,
  onSubmit,
  onChangePrompt,
  onChangeStyle,
  onChangeRatio,
  onChangeQuality,
  onChangeCount,
  onReferenceChange,
  onClearReference,
  onUseExample,
}) {
  return (
    <form className="prompt-panel glass-card" onSubmit={onSubmit}>
      <div className="panel-header">
        <span>提示词控制台</span>
        <b>{promptScore}% 清晰度</b>
      </div>

      <label>
        图像提示词
        <textarea value={generation.prompt} onChange={(event) => onChangePrompt(event.target.value)} rows="9" />
      </label>

      <div className="example-row">
        {WORKBENCH_EXAMPLES.map((item, index) => (
          <button type="button" key={item} onClick={() => onUseExample(item)}>示例 {index + 1}</button>
        ))}
      </div>

      <label className="upload-card">
        参考图片（可选）
        <input type="file" accept="image/*" onChange={onReferenceChange} />
        {generation.referencePreview ? (
          <div className="upload-preview">
            <img src={generation.referencePreview} alt="参考图片预览" />
            <button type="button" onClick={onClearReference}>移除图片</button>
          </div>
        ) : (
          <div className="upload-empty">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" x2="12" y1="3" y2="15" />
            </svg>
            <span>上传一张参考图，让提示词基于图片继续生成。</span>
          </div>
        )}
      </label>

      <div className="control-grid">
        <label>
          风格
          <select value={generation.style} onChange={(event) => onChangeStyle(event.target.value)}>
            <option>杂志玻璃质感</option>
            <option>高级产品摄影</option>
            <option>柔和电影感</option>
            <option>未来界面风格</option>
          </select>
        </label>
        <label>
          比例
          <select value={generation.ratio} onChange={(event) => onChangeRatio(event.target.value)}>
            <option>16:9</option>
            <option>1:1</option>
            <option>4:5</option>
            <option>9:16</option>
          </select>
        </label>
        <label>
          质量
          <select value={generation.quality} onChange={(event) => onChangeQuality(event.target.value)}>
            <option value="High">高质量</option>
            <option value="Ultra">极致质量</option>
            <option value="Draft">草稿</option>
          </select>
        </label>
      </div>

      <div className="count-row">
        <span>生成数量</span>
        {[1, 2, 4, 8].map((item) => (
          <button
            type="button"
            key={item}
            className={generation.count === item ? 'active' : ''}
            onClick={() => onChangeCount(item)}
          >
            {item}
          </button>
        ))}
      </div>

      {generation.error ? <p className="panel-error">{generation.error}</p> : null}

      <button className="generate-button" type="submit" disabled={generation.status === '生成中'}>
        {generation.status === '生成中' ? '生成中' : '生成图像'}
      </button>
    </form>
  )
}
