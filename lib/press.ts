import type { SupabaseClient } from '@supabase/supabase-js'
import { PRESS_SOURCES, findPressSource, type PressSource } from './press-sources'

const UA = 'Mozilla/5.0 (compatible; IMCMS-PressReader/1.0)'
const STALE_MS = 10 * 60 * 1000

export type PressRelease = {
  id: string
  created_by?: string | null
  source_key: string
  source_name: string
  title: string
  link: string
  summary: string | null
  body_html: string | null
  image_url: string | null
  published_at: string | null
}

function decode(s: string) {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ').replace(/&middot;/g, '·').replace(/&amp;/g, '&')
}

export function escapeHtml(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function stripTags(html: string) {
  return decode(html.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim()
}

function tagText(block: string, name: string) {
  const m = block.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, 'i'))
  if (!m) return ''
  return m[1].replace(/^\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*$/, '$1').trim()
}

export function parseRss(xml: string) {
  return Array.from(xml.matchAll(/<item\b[\s\S]*?<\/item>/gi), (m) => {
    const b = m[0]
    const link = decode(tagText(b, 'link')).replace(/[?&]sourceType=rss\b/, '')
    return {
      guid: decode(tagText(b, 'guid')) || link,
      title: stripTags(decode(tagText(b, 'title'))),
      link,
      description: decode(tagText(b, 'description')),
      pubDate: tagText(b, 'pubDate'),
    }
  }).filter((i) => i.title && i.link)
}

async function fetchText(url: string, ms = 7000) {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), ms)
  try {
    const res = await fetch(url, { headers: { 'User-Agent': UA }, signal: ctrl.signal, cache: 'no-store' })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return await res.text()
  } finally {
    clearTimeout(timer)
  }
}

export type PressRow = {
  source_key: string
  source_name: string
  guid: string
  title: string
  link: string
  summary: string | null
  body_html: string | null
  published_at: string | null
}

export type CollectResult = { key: string; ok: boolean; message: string | null; rows: PressRow[] }

// 출처 하나의 RSS를 읽어 저장할 행으로 바꾼다 (저장은 호출한 쪽에서)
export async function collectSource(s: PressSource): Promise<CollectResult> {
  try {
    const items = parseRss(await fetchText(s.url)).slice(0, 40)
    const rows = items.map((i) => ({
      source_key: s.key,
      source_name: s.name,
      guid: i.guid,
      title: i.title,
      link: i.link,
      summary: stripTags(i.description).replace(/^.{0,30}?--\s*\(?뉴스와이어\)?\s*--\s*/, '').slice(0, 400) || null,
      body_html: s.kind === 'rss' ? i.description || null : null,
      published_at: i.pubDate && !Number.isNaN(Date.parse(i.pubDate)) ? new Date(i.pubDate).toISOString() : null,
    }))
    return { key: s.key, ok: true, message: null, rows }
  } catch (e) {
    const message = e instanceof Error ? (e.name === 'AbortError' ? '응답 시간 초과' : e.message) : '알 수 없는 오류'
    return { key: s.key, ok: false, message, rows: [] }
  }
}

// 오래된(10분) 출처만 다시 가져온다. 새 항목은 guid 기준으로 중복 없이 쌓인다
export async function refreshPress(supabase: SupabaseClient, force = false) {
  const { data: logs } = await supabase.from('press_fetch_log').select('source_key, fetched_at')
  const last = new Map((logs ?? []).map((l) => [l.source_key as string, new Date(l.fetched_at as string).getTime()]))
  const due = PRESS_SOURCES.filter((s) => force || Date.now() - (last.get(s.key) ?? 0) > STALE_MS)

  await Promise.all(
    due.map(async (s) => {
      let r = await collectSource(s)
      if (r.rows.length) {
        const { error } = await supabase.from('press_releases').upsert(r.rows, { onConflict: 'guid', ignoreDuplicates: true })
        if (error) r = { ...r, ok: false, message: error.message }
      }
      await supabase.from('press_fetch_log').upsert({ source_key: s.key, fetched_at: new Date().toISOString(), ok: r.ok, message: r.message, item_count: r.ok ? r.rows.length : 0 })
    })
  )
}

// <div …>가 시작하는 위치에서 짝이 맞는 </div> 바로 뒤 위치 (안쪽 div 개수를 센다)
function divEnd(s: string, start: number) {
  const re = /<div\b|<\/div>/gi
  re.lastIndex = start
  let depth = 0
  for (let m = re.exec(s); m; m = re.exec(s)) {
    depth += m[0][1] === '/' ? -1 : 1
    if (depth === 0) return m.index + m[0].length
  }
  return s.length
}

// 뉴스와이어 기사 페이지에서 본문과 사진(설명 포함)만 뽑아 문단 HTML로 만든다
export function newswireBody(page: string) {
  const open = '<section class="article_column">'
  const start = page.indexOf(open)
  if (start < 0) return null
  // 본문 뒤의 연락처·다른 보도자료·광고는 버린다
  const ends = ['</section>', '<div class="release-contact"', '<div class="release-source-news"']
    .map((m) => page.indexOf(m, start))
    .filter((i) => i > 0)
  let s = page.slice(start + open.length, ends.length ? Math.min(...ends) : undefined)

  // 사진 묶음(images_column > column_image > … )은 통째로 사진 자리표시로 바꾼다
  //   세로 사진은 class="images_column vertical"처럼 다른 이름이 붙으므로 class 앞부분만 본다
  const images: { src: string; caption: string; video?: string }[] = []
  for (let at = s.search(/<div class="images_column\b/); at >= 0; at = s.search(/<div class="images_column\b/)) {
    const end = divEnd(s, at)
    const block = s.slice(at, end)
    const marks = block.split(/(?=<div class="column_image\b)/).slice(1).flatMap((one) => {
      const desc = one.match(/<div class="desc">\s*(?:<span>)?([\s\S]*?)(?:<\/span>\s*)?<\/div>/)?.[1]
      // 유튜브 영상 칸: 영상으로 넣는다 (사진으로 넣으면 깨진다)
      const yt = /class="column_image[^"]*\byoutube\b/.test(one) ? (one.match(/youtube(?:-nocookie)?\.com\/(?:embed\/|watch\?v=)([\w-]{6,})/) ?? one.match(/youtu\.be\/([\w-]{6,})/))?.[1] : null
      if (yt) {
        images.push({ src: '', video: yt, caption: decode((desc ?? '').replace(/<[^>]+>/g, '')).trim() })
        return [`@@IMG${images.length - 1}@@`]
      }
      // 원본 크기(data-src)를 쓰고, 없으면 화면용 사진(img src)
      const src = one.match(/data-src="([^"]+)"/)?.[1] ?? one.match(/<img\b[^>]*\bsrc="([^"]+)"/)?.[1]
      if (!src || !/<img\b/.test(one)) return []
      const alt = one.match(/<img\b[^>]*\balt="([^"]*)"/)?.[1]
      images.push({ src: decode(src), caption: decode((desc ?? alt ?? '').replace(/<[^>]+>/g, '')).trim() })
      return [`@@IMG${images.length - 1}@@`]
    })
    s = `${s.slice(0, at)}\n\n${marks.join('\n\n')}\n\n${s.slice(end)}`
  }
  // 묶음 밖에 따로 있는 기사 사진(class="pic_…")도 놓치지 않는다
  s = s.replace(/<img\b[^>]*\bclass="pic_[^"]*"[^>]*>/g, (tag) => {
    const src = tag.match(/\bsrc="([^"]+)"/)?.[1]
    if (!src) return ''
    images.push({ src: decode(src), caption: decode(tag.match(/\balt="([^"]*)"/)?.[1] ?? '').trim() })
    return `\n\n@@IMG${images.length - 1}@@\n\n`
  })
  s = s.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '')
  s = decode(s).replace(/[ \t]+/g, ' ')

  const blocks = s.split(/\n\s*\n/).map((b) => b.replace(/\s*\n\s*/g, ' ').trim()).filter(Boolean)
  if (blocks[0]) blocks[0] = blocks[0].replace(/^.{0,30}?--\s*\(?뉴스와이어\)?\s*--\s*/, '')

  const html = blocks
    .map((b) => {
      const m = b.match(/^@@IMG(\d+)@@$/)
      if (!m) return `<p>${escapeHtml(b)}</p>`
      const img = images[Number(m[1])]
      const cap = img.caption ? `<p><em>▲ ${escapeHtml(img.caption)}</em></p>` : ''
      if (img.video) return `<div data-youtube-video=""><iframe src="https://www.youtube-nocookie.com/embed/${img.video}" width="640" height="360" allowfullscreen></iframe></div>${cap}`
      return `<img src="${escapeHtml(img.src)}" alt="${escapeHtml(img.caption)}">${cap}`
    })
    .join('')
  return { html, image: images.find((i) => !i.video)?.src ?? null }
}

// 목록에는 요약만 있으므로, 처음 열 때 전문을 가져와 저장해 둔다
//   예전 방식으로 읽어 세로 사진 등을 놓친 보도자료(사진 없음 + image_url 비어 있음)도 한 번 다시 읽는다.
//   다시 읽은 뒤 사진이 없으면 image_url을 ''로 두어 다음부터는 다시 읽지 않는다
export async function ensureFullBody(supabase: SupabaseClient, r: PressRelease): Promise<PressRelease> {
  if (findPressSource(r.source_key)?.kind !== 'newswire') return r
  const missedPhotos = !!r.body_html && r.image_url === null && !/<img\b|data-youtube-video/.test(r.body_html)
  if (r.body_html && !missedPhotos) return r
  try {
    const parsed = newswireBody(await fetchText(r.link, 8000))
    if (!parsed) return r
    const image = parsed.image ?? ''
    await supabase.from('press_releases').update({ body_html: parsed.html, image_url: image }).eq('id', r.id)
    return { ...r, body_html: parsed.html, image_url: image }
  } catch {
    return r
  }
}

// AI에 보낼 본문: 사진·태그는 빼고 문단만 남긴다
export function htmlToText(html: string) {
  return decode(
    html
      .replace(/<img[^>]*>/gi, '')
      .replace(/<p><em>▲[\s\S]*?<\/em><\/p>/g, '')
      .replace(/<\/(p|h\d|li|blockquote)>|<br\s*\/?>/gi, '\n\n')
      .replace(/<[^>]+>/g, '')
  )
    .split(/\n\s*\n/)
    .map((p) => p.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join('\n\n')
}

// 기사 끝 "○○에서 배포한 보도자료" 문구에 들어갈 이름
export function sourceLabel(r: Pick<PressRelease, 'source_key' | 'source_name'>) {
  if (r.source_key.startsWith('nw-')) return '뉴스와이어'
  if (r.source_key.startsWith('kr-')) return '정책브리핑'
  return r.source_name
}

// 붙여넣은 글을 문단 HTML로 (빈 줄로 나뉘어 있으면 빈 줄, 아니면 줄바꿈 기준)
export function textToParagraphs(text: string) {
  const clean = text.replace(/\r\n?/g, '\n').trim()
  const parts = /\n\s*\n/.test(clean) ? clean.split(/\n\s*\n/) : clean.split('\n')
  return parts.map((p) => p.replace(/\s*\n\s*/g, ' ').trim()).filter(Boolean)
}

export const MANUAL_SOURCE = 'manual'

