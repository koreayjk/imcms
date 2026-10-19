import * as tus from 'tus-js-client'
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

// ───────── 영상 ─────────
// 영상은 사진과 따로 'videos' 저장소에 둔다 (supabase/video-storage.sql). 변환은 하지 않으므로 MP4(H.264)를 권한다.
//   6MB 넘는 파일은 끊겨도 이어 올리는 방식(TUS)으로 브라우저에서 저장소로 바로 올린다
export const VIDEO_MAX_BYTES = 1024 * 1024 * 1024
const VIDEO_TYPES: Record<string, string> = { mp4: 'video/mp4', m4v: 'video/mp4', mov: 'video/quicktime', webm: 'video/webm' }
export const VIDEO_ACCEPT = 'video/mp4,video/quicktime,video/webm,.mp4,.m4v,.mov,.webm'

export function videoKind(file: File) {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
  const type = VIDEO_TYPES[ext]
  return type ? { ext: ext === 'm4v' ? 'mp4' : ext, type } : null
}

// 첫 장면에서 대표 이미지를 뽑는다. 이 브라우저가 영상을 못 열면 올리기 전에 알려 준다
function videoPoster(file: File): Promise<Blob | null> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const v = document.createElement('video')
    v.muted = true
    v.playsInline = true
    v.preload = 'auto'
    const done = (fn: () => void) => { clearTimeout(timer); URL.revokeObjectURL(url); v.removeAttribute('src'); v.load(); fn() }
    const timer = setTimeout(() => done(() => resolve(null)), 15000)
    v.onerror = () => done(() => reject(new Error('이 영상은 이 브라우저에서 열리지 않습니다. 휴대폰 기본 형식(HEVC)일 수 있습니다. MP4(H.264)로 저장하거나 변환해서 올려 주세요.')))
    v.onloadedmetadata = () => { v.currentTime = Math.min(1, (v.duration || 2) / 2) }
    v.onseeked = () => {
      try {
        const scale = Math.min(1, 1280 / Math.max(v.videoWidth || 1280, 1))
        const canvas = document.createElement('canvas')
        canvas.width = Math.max(2, Math.round((v.videoWidth || 1280) * scale))
        canvas.height = Math.max(2, Math.round((v.videoHeight || 720) * scale))
        canvas.getContext('2d')!.drawImage(v, 0, 0, canvas.width, canvas.height)
        canvas.toBlob((b) => done(() => resolve(b)), 'image/jpeg', 0.82)
      } catch {
        done(() => resolve(null))
      }
    }
    v.src = url
  })
}

function storageHost() {
  const base = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').replace(/\/$/, '')
  // 큰 파일은 저장소 전용 주소로 보내는 것이 빠르다 (Supabase 안내)
  return base.replace(/^(https:\/\/[a-z0-9]+)\.supabase\.co$/, '$1.storage.supabase.co')
}

function videoError(message: string, size = 0) {
  if (/bucket not found/i.test(message)) return '영상 저장소가 아직 준비되지 않았습니다. 운영팀이 설정을 마쳐야 합니다.'
  if (/exceeded|too large|payload too large|maximum allowed size|response code: 413/i.test(message)) {
    // 우리 한도(1GB)보다 작은데 막히면 Supabase 프로젝트 전체 한도가 낮은 것이다
    return size && size < VIDEO_MAX_BYTES
      ? `저장소의 업로드 한도가 이 영상(${Math.round(size / 1024 / 1024)}MB)보다 작게 설정되어 있습니다. 운영팀이 Supabase Storage 설정의 "Upload file size limit"을 1GB 이상으로 올려야 합니다.`
      : '영상이 허용 용량을 넘습니다. 1GB 이하로 줄여 올려 주세요.'
  }
  if (/row-level security|unauthori|403|401/i.test(message)) return '영상을 올릴 권한이 없습니다. 다시 로그인해 보시고, 계속되면 운영팀에 알려 주세요.'
  return `영상 업로드 실패: ${message.slice(0, 200)}`
}

export type UploadedVideo = { url: string; poster: string | null; bytes: number }

// 영상을 올리고 공개 주소(+첫 장면 이미지 주소)를 돌려준다. onProgress: 0~100
export async function uploadVideo(file: File, outletId: string | null, onProgress: (pct: number) => void): Promise<UploadedVideo> {
  const kind = videoKind(file)
  if (!kind) throw new Error('영상 파일(MP4, MOV, WEBM)만 올릴 수 있습니다.')
  if (file.size > VIDEO_MAX_BYTES) throw new Error('영상이 1GB를 넘습니다. 화질을 낮추거나 잘라서 올려 주세요.')

  // 이 브라우저에서 열리는 영상인지 먼저 확인하고 대표 이미지를 뽑는다
  const posterBlob = await videoPoster(file)

  const now = new Date()
  const path = `${outletId ?? 'common'}/${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}/${crypto.randomUUID()}.${kind.ext}`
  const supabase = createClient()

  if (file.size <= 6 * 1024 * 1024) {
    onProgress(10)
    const { error } = await supabase.storage.from('videos').upload(path, file, { contentType: kind.type, cacheControl: '31536000' })
    if (error) throw new Error(videoError(error.message, file.size))
  } else {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) throw new Error('로그인이 끝났습니다. 다시 로그인해 주세요.')
    await new Promise<void>((resolve, reject) => {
      const up = new tus.Upload(file, {
        endpoint: `${storageHost()}/storage/v1/upload/resumable`,
        retryDelays: [0, 3000, 5000, 10000, 20000],
        headers: { authorization: `Bearer ${session.access_token}`, 'x-upsert': 'false' },
        uploadDataDuringCreation: true,
        // 새로 고침 뒤 이어 올리기는 하지 않는다 (저장 경로를 매번 새로 만들기 때문)
        storeFingerprintForResuming: false,
        removeFingerprintOnSuccess: true,
        metadata: { bucketName: 'videos', objectName: path, contentType: kind.type, cacheControl: '31536000' },
        chunkSize: 6 * 1024 * 1024,
        onError: (err) => reject(new Error(videoError(String(err?.message ?? err), file.size))),
        onProgress: (sent, total) => onProgress(Math.min(99, Math.round((sent / total) * 100))),
        onSuccess: () => resolve(),
      })
      up.start()
    })
  }
  onProgress(100)

  let poster: string | null = null
  if (posterBlob) {
    try {
      poster = await uploadImage(new File([posterBlob], 'poster.jpg', { type: 'image/jpeg' }), outletId, null)
    } catch {
      poster = null
    }
  }
  return { url: supabase.storage.from('videos').getPublicUrl(path).data.publicUrl, poster, bytes: file.size }
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
