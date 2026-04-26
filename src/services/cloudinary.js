// ── Cloudinary Upload Service ─────────────────────────────────
// Utilise l'upload non signé (unsigned) — sécurisé pour le frontend
// L'API Secret n'est JAMAIS exposé côté client

const CLOUD_NAME    = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME
const UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET
const UPLOAD_URL    = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`
const UPLOAD_URL_RAW = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/raw/upload`
const UPLOAD_URL_VIDEO = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/video/upload`

const _upload = (file, folder, onProgress, url) => {
  return new Promise((resolve, reject) => {
    const formData = new FormData()
    formData.append('file',          file)
    formData.append('upload_preset', UPLOAD_PRESET)
    formData.append('folder',        folder)
    const xhr = new XMLHttpRequest()
    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable) onProgress?.(Math.round((e.loaded / e.total) * 100))
    })
    xhr.addEventListener('load', () => {
      if (xhr.status === 200) {
        const data = JSON.parse(xhr.responseText)
        resolve({ url: data.secure_url, publicId: data.public_id })
      } else {
        reject(new Error(`Cloudinary error: ${xhr.status} — ${xhr.responseText}`))
      }
    })
    xhr.addEventListener('error', () => reject(new Error('Erreur réseau lors de l\'upload')))
    xhr.addEventListener('abort', () => reject(new Error('Upload annulé')))
    xhr.open('POST', url)
    xhr.send(formData)
  })
}

export const uploadImage = (file, folder = 'lc360', onProgress) =>
  _upload(file, folder, onProgress, UPLOAD_URL)

export const uploadAudio = (file, folder = 'lc360/audio', onProgress) =>
  _upload(file, folder, onProgress, UPLOAD_URL_VIDEO)

export const uploadFile = (file, folder = 'lc360/files', onProgress) => {
  const type = file.type || ''
  const url  = type.startsWith('audio/') || type.startsWith('video/')
    ? UPLOAD_URL_VIDEO
    : UPLOAD_URL_RAW
  return _upload(file, folder, onProgress, url)
}

/**
 * Supprime une image Cloudinary via une Cloud Function (optionnel Phase 5)
 * Pour l'instant on garde juste l'URL dans Firestore
 */
export const getOptimizedUrl = (url, options = {}) => {
  if (!url || !url.includes('cloudinary.com')) return url
  const { width = 1920, quality = 'auto', format = 'auto' } = options
  // Injecte les transformations Cloudinary dans l'URL
  return url.replace('/upload/', `/upload/w_${width},q_${quality},f_${format}/`)
}
