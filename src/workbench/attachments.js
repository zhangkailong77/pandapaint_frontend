export const MAX_ATTACHMENT_COUNT = 8
export const MAX_ATTACHMENT_SIZE = 10 * 1024 * 1024
export const MAX_ATTACHMENT_TOTAL_SIZE = 40 * 1024 * 1024

const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const DB_NAME = 'vary-ocean-flow-fish'
const DB_VERSION = 1
const STORE_NAME = 'launch-attachments'
const LAUNCH_ATTACHMENT_KEY = 'vary-ocean-flow-fish:launch-attachments:'

function getLaunchAttachmentKey(projectId) {
  return `${LAUNCH_ATTACHMENT_KEY}${projectId}`
}

export function getAttachmentValidationError(files, existingFiles = []) {
  const selectedFiles = Array.from(files || [])
  const invalidFile = selectedFiles.find((file) => !ACCEPTED_IMAGE_TYPES.includes(file.type))
  if (invalidFile) return '仅支持 JPEG、PNG 或 WebP 图片附件。'

  const oversizedFile = selectedFiles.find((file) => file.size > MAX_ATTACHMENT_SIZE)
  if (oversizedFile) return '单张图片附件不能超过 10MB。'

  if (selectedFiles.length + existingFiles.length > MAX_ATTACHMENT_COUNT) {
    return `最多可添加 ${MAX_ATTACHMENT_COUNT} 张图片附件。`
  }

  const totalSize = [...existingFiles, ...selectedFiles].reduce((total, file) => total + file.size, 0)
  if (totalSize > MAX_ATTACHMENT_TOTAL_SIZE) return '图片附件总大小不能超过 40MB。'
  return ''
}

function openAttachmentDatabase() {
  return new Promise((resolve, reject) => {
    if (!window.indexedDB) {
      reject(new Error('当前浏览器不支持附件交接，请更新浏览器后重试。'))
      return
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) {
        request.result.createObjectStore(STORE_NAME)
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(new Error('附件交接存储不可用，请重试。'))
  })
}

async function withAttachmentStore(mode, callback) {
  const database = await openAttachmentDatabase()
  try {
    return await new Promise((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, mode)
      const request = callback(transaction.objectStore(STORE_NAME))
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(new Error('附件交接失败，请重试。'))
    })
  } finally {
    database.close()
  }
}

export async function saveLaunchAttachments(projectId, files) {
  const nextFiles = Array.from(files)
  if (!nextFiles.length) return
  const key = getLaunchAttachmentKey(projectId)
  try {
    await withAttachmentStore('readwrite', (store) => store.put(nextFiles, String(projectId)))
    window.sessionStorage.setItem(key, 'indexeddb')
  } catch (error) {
    try {
      window.sessionStorage.setItem(key, JSON.stringify(await Promise.all(nextFiles.map(async (file) => ({
        name: file.name,
        type: file.type,
        lastModified: file.lastModified,
        dataUrl: await new Promise((resolve, reject) => {
          const reader = new FileReader()
          reader.onload = () => resolve(reader.result)
          reader.onerror = () => reject(new Error('图片读取失败，请重新选择。'))
          reader.readAsDataURL(file)
        }),
      })))))
    } catch {
      throw error
    }
  }
}

export async function loadLaunchAttachments(projectId) {
  const key = getLaunchAttachmentKey(projectId)
  const sessionValue = window.sessionStorage.getItem(key)
  try {
    const files = await withAttachmentStore('readonly', (store) => store.get(String(projectId)))
    if (files?.length) return files
  } catch (error) {
    if (!sessionValue || sessionValue === 'indexeddb') throw error
  }

  if (!sessionValue || sessionValue === 'indexeddb') return []
  try {
    return JSON.parse(sessionValue).map(({ name, type, lastModified, dataUrl }) => {
      const [header, data] = dataUrl.split(',', 2)
      const bytes = Uint8Array.from(atob(data), (char) => char.charCodeAt(0))
      return new File([bytes], name, { type: type || header.match(/data:([^;]+)/)?.[1] || '', lastModified })
    })
  } catch {
    throw new Error('附件交接数据无法读取，请重新选择后重试。')
  }
}

export async function clearLaunchAttachments(projectId) {
  try {
    await withAttachmentStore('readwrite', (store) => store.delete(String(projectId)))
  } catch (error) {
    if (window.sessionStorage.getItem(getLaunchAttachmentKey(projectId)) === 'indexeddb') throw error
  }
  window.sessionStorage.removeItem(getLaunchAttachmentKey(projectId))
}
