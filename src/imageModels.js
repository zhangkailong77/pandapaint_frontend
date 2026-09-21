const DEFAULT_IMAGE_MODELS = [
  {
    id: 'gpt-image-2',
    name: 'GPT Image 2',
    desc: '默认的高质量图像生成主干网络，支持全量风格指令理解',
  },
  {
    id: 'gpt-image-2.5',
    name: 'GPT Image 2.5',
    desc: '新一代高质量图像生成模型',
  },
]

const configuredModelIds = String(import.meta.env.VITE_GPT_IMAGE_MODELS || '')
  .split(',')
  .map((model) => model.trim())
  .filter(Boolean)

const imageModelIds = [...new Set(configuredModelIds.length ? configuredModelIds : DEFAULT_IMAGE_MODELS.map((model) => model.id))]
const configuredDefaultModel = String(import.meta.env.VITE_GPT_IMAGE_MODEL || '').trim()

export const GPT_IMAGE_MODELS = imageModelIds.map((id) => {
  const fallback = DEFAULT_IMAGE_MODELS.find((model) => model.id === id)
  return fallback || { id, name: id, desc: '' }
})

export const GPT_IMAGE_MODEL = imageModelIds.includes(configuredDefaultModel)
  ? configuredDefaultModel
  : imageModelIds[0]

export function isGptImageModel(model) {
  return imageModelIds.includes(model)
}
