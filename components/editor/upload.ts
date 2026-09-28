import { createClient } from '@/lib/supabase'

const MAX_EDGE = 1600
const MAX_BYTES = 10 * 1024 * 1024

async function shrink(file: File): Promise<Blob> {
  if (file.type === 'image/gif') return file
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height))
  if (scale === 1 && file.size < 1.5 * 1024 * 1024) return file
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  const type = file.type === 'image/jpeg' ? 'image/jpeg' : 'image/webp'
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b ?? file), type, 0.85))
}

// 사진을 줄여서(긴 변 1600px) 저장소에 올리고 공개 주소를 돌려준다
export async function uploadImage(file: File, outletId: string | null) {
  if (!file.type.startsWith('image/')) throw new Error('사진 파일(JPG, PNG, WEBP, GIF)만 올릴 수 있습니다.')
  if (file.size > MAX_BYTES * 3) throw new Error('사진 용량이 너무 큽니다. 30MB 이하 파일을 올려주세요.')

  const blob = await shrink(file)
  if (blob.size > MAX_BYTES) throw new Error('줄인 뒤에도 10MB를 넘습니다. 더 작은 사진을 올려주세요.')

  const ext = blob.type === 'image/jpeg' ? 'jpg' : blob.type === 'image/gif' ? 'gif' : blob.type === 'image/png' ? 'png' : 'webp'
  const now = new Date()
  const path = `${outletId ?? 'common'}/${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}/${crypto.randomUUID()}.${ext}`

  const supabase = createClient()
  const { error } = await supabase.storage.from('media').upload(path, blob, { contentType: blob.type, cacheControl: '31536000' })
  if (error) throw new Error(`사진 업로드 실패: ${error.message}`)
  return supabase.storage.from('media').getPublicUrl(path).data.publicUrl
}
