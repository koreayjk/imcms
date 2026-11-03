'use server'

import { getCmsContext } from '@/lib/cms'

// 대용량 첨부 링크 시험 (운영팀 전용): 메일 안의 대용량 링크를 서버(서울 리전)에서 로그인 없이 받을 수 있는지 확인한다
//   · 파일을 저장하지 않는다. 앞부분 64KB만 읽어 모양을 보고, "끝까지 받아 보기"를 켜면 받는 시간만 잰다 (내용은 버린다)
//   · 정해진 도메인(.kr, naver.com)의 https 주소만, 주소 변환(리디렉션)도 같은 조건으로 따라간다. 로그인·차단 우회는 하지 않는다
export type LinkResult = {
  n: number
  shown: string
  verdict: 'file' | 'page' | 'login' | 'expired' | 'blocked' | 'error' | 'skipped'
  note: string
  status?: number
  type?: string
  filename?: string
  size?: number
  magic?: string
  ms?: number
  hops?: string[]
}
export type LinkTest = { ok: boolean; error?: string; results?: LinkResult[]; at?: string }

const MAX_LINKS = 20
const SNIFF = 64 * 1024
const FULL_CAP = 30 * 1024 * 1024
const TIMEOUT = 15_000

const hostOk = (h: string) => !/^(\d{1,3}\.){3}\d{1,3}$/.test(h) && !h.includes(':') && h !== 'localhost' && (/\.kr$/i.test(h) || /(^|\.)naver\.com$/i.test(h))

// 화면에는 주소의 호스트와 경로만 보이고 토큰은 앞 4글자만
function mask(u: URL) {
  const path = u.pathname.replace(/[A-Za-z0-9_-]{10,}/g, (s) => `${s.slice(0, 4)}…`)
  const q = u.search ? `?${u.search.slice(1).replace(/=([^&]{5,})/g, (_, v: string) => `=${v.slice(0, 4)}…`)}` : ''
  return `${u.host}${path}${q}`
}

function magicOf(b: Uint8Array) {
  const h = (n: number) => Array.from(b.slice(0, n), (x) => x.toString(16).padStart(2, '0')).join('')
  if (b.length >= 4 && h(4) === '504b0304') return 'zip/hwpx/docx'
  if (b.length >= 8 && h(8) === 'd0cf11e0a1b11ae1') return 'OLE(hwp/doc)'
  if (b.length >= 4 && h(4) === '25504446') return 'pdf'
  if (b.length >= 3 && h(3) === 'ffd8ff') return 'jpg'
  if (b.length >= 4 && h(4) === '89504e47') return 'png'
  const head = new TextDecoder().decode(b.slice(0, 200)).trim().toLowerCase()
  if (head.startsWith('<!doctype') || head.startsWith('<html')) return 'html'
  return ''
}

function filenameOf(cd: string | null) {
  if (!cd) return undefined
  const star = /filename\*\s*=\s*(?:UTF-8|utf-8)''([^;]+)/.exec(cd)
  if (star) { try { return decodeURIComponent(star[1].trim()) } catch { /* 아래로 */ } }
  const m = /filename\s*=\s*"?([^";]+)"?/.exec(cd)
  return m ? m[1].trim() : undefined
}

async function one(raw: string, n: number, full: boolean): Promise<LinkResult> {
  let u: URL
  try { u = new URL(raw) } catch { return { n, shown: raw.slice(0, 60), verdict: 'skipped', note: '주소 모양이 아닙니다' } }
  if (u.protocol !== 'https:' || !hostOk(u.hostname)) return { n, shown: mask(u), verdict: 'skipped', note: '시험 가능한 주소가 아닙니다 (.kr 또는 naver.com 의 https 만)' }
  const hops: string[] = [mask(u)]
  const t0 = Date.now()
  try {
    let cur = u
    for (let i = 0; i < 4; i++) {
      const ctrl = new AbortController()
      const timer = setTimeout(() => ctrl.abort(), TIMEOUT)
      const res = await fetch(cur, { redirect: 'manual', signal: ctrl.signal, cache: 'no-store', headers: { 'User-Agent': 'IMNewsroom-linktest/1.0', Accept: '*/*' } }).finally(() => clearTimeout(timer))
      if (res.status >= 300 && res.status < 400 && res.headers.get('location')) {
        const next = new URL(res.headers.get('location')!, cur)
        if (next.protocol !== 'https:' || !hostOk(next.hostname)) return { n, shown: mask(u), verdict: 'blocked', note: `다른 주소(${next.host})로 넘겨져 중단했습니다`, status: res.status, hops, ms: Date.now() - t0 }
        hops.push(mask(next))
        if (/login|signin|auth/i.test(next.pathname + next.search)) return { n, shown: mask(u), verdict: 'login', note: '로그인 화면으로 넘어갑니다', status: res.status, hops, ms: Date.now() - t0 }
        cur = next
        continue
      }
      const type = res.headers.get('content-type') ?? ''
      const cd = res.headers.get('content-disposition')
      const len = Number(res.headers.get('content-length') ?? 0) || undefined
      // 앞부분만 읽는다 (끝까지 받기를 켰으면 용량 한도까지 세어 시간만 잰다)
      const reader = res.body?.getReader()
      const chunks: Uint8Array[] = []
      let got = 0
      const cap = full ? FULL_CAP : SNIFF
      const readStart = Date.now()
      while (reader && got < cap) {
        const { done, value } = await reader.read()
        if (done) break
        if (got < SNIFF) chunks.push(value)
        got += value.length
        if (Date.now() - t0 > 25_000) break
      }
      await reader?.cancel().catch(() => {})
      const head = new Uint8Array(chunks.reduce((s, c) => s + c.length, 0))
      let off = 0
      for (const c of chunks) { head.set(c, off); off += c.length }
      const magic = magicOf(head)
      const filename = filenameOf(cd)
      const text = magic === 'html' || /text\/html/i.test(type) ? new TextDecoder().decode(head.slice(0, 20000)) : ''
      const base = { n, shown: mask(u), status: res.status, type: type.split(';')[0], filename, size: full ? got : len, magic, ms: full ? Date.now() - readStart : Date.now() - t0, hops }
      if (!res.ok) return { ...base, verdict: res.status === 403 || res.status === 401 ? 'blocked' : res.status === 404 || res.status === 410 ? 'expired' : 'error', note: `응답 ${res.status}${res.status === 403 ? ' (접근이 막혔습니다)' : res.status === 404 || res.status === 410 ? ' (만료됐거나 없는 파일일 수 있습니다)' : ''}` }
      if (text) {
        if (/로그인|login|sign in/i.test(text) && !/다운로드|download/i.test(text)) return { ...base, verdict: 'login', note: '안내 화면에 로그인이 필요하다고 나옵니다' }
        if (/만료|expired|존재하지 않|삭제된/i.test(text)) return { ...base, verdict: 'expired', note: '만료됐거나 삭제된 파일이라고 나옵니다' }
        return { ...base, verdict: 'page', note: '파일이 아니라 안내 화면(HTML)이 왔습니다. 화면 안의 다운로드 버튼을 한 번 더 눌러야 할 수 있습니다' }
      }
      return { ...base, verdict: 'file', note: full ? `끝까지 받음: ${(got / 1048576).toFixed(1)}MB, ${Math.max(1, Math.round((Date.now() - readStart) / 1000))}초${got >= FULL_CAP ? ' (한도까지)' : ''}` : '로그인 없이 파일이 바로 받아집니다' }
    }
    return { n, shown: mask(u), verdict: 'error', note: '주소 변환이 너무 많이 이어집니다', hops, ms: Date.now() - t0 }
  } catch (e) {
    const aborted = e instanceof Error && e.name === 'AbortError'
    return { n, shown: mask(u), verdict: 'error', note: aborted ? '시간 안에 응답이 없습니다 (서버가 해외 접속을 막았을 수 있습니다)' : `연결하지 못했습니다: ${e instanceof Error ? e.message.slice(0, 120) : '알 수 없는 오류'}`, hops, ms: Date.now() - t0 }
  }
}

export async function testLinks(_prev: LinkTest | null, formData: FormData): Promise<LinkTest> {
  const { isStaff } = await getCmsContext()
  if (!isStaff) return { ok: false, error: '운영팀만 쓸 수 있습니다.' }
  const full = formData.get('full') === 'on'
  const urls = Array.from(new Set(String(formData.get('links') ?? '').split(/\r?\n/).map((l) => /https?:\/\/\S+/.exec(l)?.[0]?.replace(/[)>\]"',.]+$/, '') ?? '').filter(Boolean)))
  if (!urls.length) return { ok: false, error: '주소를 한 줄에 하나씩 붙여 넣어 주세요.' }
  const list = urls.slice(0, full ? 8 : MAX_LINKS)
  const results: LinkResult[] = []
  // 서버가 부담을 느끼지 않게 4개씩
  for (let i = 0; i < list.length; i += 4) {
    const part = await Promise.all(list.slice(i, i + 4).map((u, j) => one(u, i + j + 1, full)))
    results.push(...part)
  }
  const extra = urls.length - list.length
  return { ok: true, results, at: new Date().toISOString(), error: extra > 0 ? `${list.length}개만 시험했습니다 (나머지 ${extra}개는 다음에 다시 붙여 넣어 주세요)` : undefined }
}
