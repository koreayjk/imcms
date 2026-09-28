import type { SupabaseClient } from '@supabase/supabase-js'
import { PRESS_SOURCES, findPressSource } from './press-sources'

const UA = 'Mozilla/5.0 (compatible; IMCMS-PressReader/1.0)'
const STALE_MS = 10 * 60 * 1000

export type PressRelease = {
  id: string
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

function escapeHtml(s: string) {
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

// 오래된(10분) 출처만 다시 가져온다. 새 항목은 guid 기준으로 중복 없이 쌓인다
export async function refreshPress(supabase: SupabaseClient, force = false) {
  const { data: logs } = await supabase.from('press_fetch_log').select('source_key, fetched_at')
  const last = new Map((logs ?? []).map((l) => [l.source_key as string, new Date(l.fetched_at as string).getTime()]))
  const due = PRESS_SOURCES.filter((s) => force || Date.now() - (last.get(s.key) ?? 0) > STALE_MS)

  await Promise.all(
    due.map(async (s) => {
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
        if (rows.length) {
          const { error } = await supabase.from('press_releases').upsert(rows, { onConflict: 'guid', ignoreDuplicates: true })
          if (error) throw new Error(error.message)
        }
        await supabase.from('press_fetch_log').upsert({ source_key: s.key, fetched_at: new Date().toISOString(), ok: true, message: null, item_count: rows.length })
      } catch (e) {
        const message = e instanceof Error ? (e.name === 'AbortError' ? '응답 시간 초과' : e.message) : '알 수 없는 오류'
        await supabase.from('press_fetch_log').upsert({ source_key: s.key, fetched_at: new Date().toISOString(), ok: false, message, item_count: 0 })
      }
    })
  )
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
  const images: { src: string; caption: string }[] = []
  s = s.replace(/<div class="images_column"[\s\S]*?(?:<\/div>\s*){4}/g, (block) => {
    const marks = Array.from(block.matchAll(/data-src="([^"]+)"[\s\S]*?alt="([^"]*)"/g), (m) => {
      images.push({ src: m[1], caption: decode(m[2]) })
      return `@@IMG${images.length - 1}@@`
    })
    return `\n\n${marks.join('\n\n')}\n\n`
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
      return `<img src="${escapeHtml(img.src)}" alt="${escapeHtml(img.caption)}">` + (img.caption ? `<p><em>▲ ${escapeHtml(img.caption)}</em></p>` : '')
    })
    .join('')
  return { html, image: images[0]?.src ?? null }
}

// 목록에는 요약만 있으므로, 처음 열 때 전문을 가져와 저장해 둔다
export async function ensureFullBody(supabase: SupabaseClient, r: PressRelease): Promise<PressRelease> {
  if (r.body_html) return r
  if (findPressSource(r.source_key)?.kind !== 'newswire') return r
  try {
    const parsed = newswireBody(await fetchText(r.link, 8000))
    if (!parsed) return r
    await supabase.from('press_releases').update({ body_html: parsed.html, image_url: parsed.image }).eq('id', r.id)
    return { ...r, body_html: parsed.html, image_url: parsed.image }
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

export function sourceLabel(key: string) {
  return key.startsWith('nw-') ? '뉴스와이어' : key.startsWith('kr-') ? '정책브리핑' : '보도자료'
}
