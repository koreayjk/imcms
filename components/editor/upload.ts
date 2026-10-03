import { createClient } from '@/lib/supabase'

const MAX_EDGE = 1600
const MAX_BYTES = 10 * 1024 * 1024

// 사진 오른쪽 아래에 글자 워터마크 (흰 글씨 + 그림자라 밝은 사진·어두운 사진 모두 보인다)
function drawWatermark(ctx: CanvasRenderingContext2D, w: number, h: number, text: string) {
  const size = Math.max(14, Math.round(Math.min(w, h) * 0.04))
  const pad = Math.round(size * 0.8)
  ctx.save()
  ctx.font = `700 ${size}px Pretendard, "Apple SD Gothic Neo", "Malgun Gothic", "Noto Sans KR", sans-serif`
  ctx.textAlign = 'right'
  ctx.textBaseline = 'bottom'
  ctx.shadowColor = 'rgba(0, 0, 0, 0.6)'
  ctx.shadowBlur = Math.round(size * 0.4)
  ctx.shadowOffsetY = 1
  ctx.fillStyle = 'rgba(255, 255, 255, 0.85)'
  ctx.fillText(text, w - pad, h - pad)
  ctx.restore()
}

export async function shrink(file: File, watermark?: string | null): Promise<Blob> {
  // 움직이는 GIF는 그대로 (워터마크를 넣으면 움직임이 사라진다)
  if (file.type === 'image/gif') return file
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height))
  if (scale === 1 && file.size < 1.5 * 1024 * 1024 && !watermark) return file
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  if (watermark) drawWatermark(ctx, canvas.width, canvas.height, watermark)
  const type = file.type === 'image/jpeg' ? 'image/jpeg' : 'image/webp'
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b ?? file), type, 0.85))
}

// 사진을 줄여서(긴 변 1600px) 저장소에 올리고 공개 주소를 돌려준다. watermark 글자를 주면 오른쪽 아래에 넣는다
export async function uploadImage(file: File, outletId: string | null, watermark?: string | null) {
  if (!file.type.startsWith('image/')) throw new Error('사진 파일(JPG, PNG, WEBP, GIF)만 올릴 수 있습니다.')
  if (file.size > MAX_BYTES * 3) throw new Error('사진 용량이 너무 큽니다. 30MB 이하 파일을 올려주세요.')

  const blob = await shrink(file, watermark?.trim() || null)
  if (blob.size > MAX_BYTES) throw new Error('줄인 뒤에도 10MB를 넘습니다. 더 작은 사진을 올려주세요.')

  const ext = blob.type === 'image/jpeg' ? 'jpg' : blob.type === 'image/gif' ? 'gif' : blob.type === 'image/png' ? 'png' : 'webp'
  const now = new Date()
  const path = `${outletId ?? 'common'}/${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}/${crypto.randomUUID()}.${ext}`

  const supabase = createClient()
  const { error } = await supabase.storage.from('media').upload(path, blob, { contentType: blob.type, cacheControl: '31536000' })
  if (error) throw new Error(`사진 업로드 실패: ${error.message}`)
  return supabase.storage.from('media').getPublicUrl(path).data.publicUrl
}

// 기사쓰기의 워터마크 설정 (이 브라우저에 기억)
const WM_KEY = 'im-watermark'
export type WatermarkPref = { on: boolean; text: string }
export function loadWatermark(defaultText: string): WatermarkPref {
  try {
    const v = JSON.parse(localStorage.getItem(WM_KEY) ?? 'null') as WatermarkPref | null
    if (v && typeof v.on === 'boolean') return { on: v.on, text: v.text || defaultText }
  } catch {}
  return { on: false, text: defaultText }
}
export function saveWatermark(v: WatermarkPref) {
  try { localStorage.setItem(WM_KEY, JSON.stringify(v)) } catch {}
}
