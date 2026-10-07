import { NextResponse, type NextRequest } from 'next/server'
import { Zip, ZipPassThrough } from 'fflate'
import { getCmsContext } from '@/lib/cms'
import { EXPORT_FORMAT, EXPORT_VERSION, bodyImages, csvCell, storagePath, type ExportArticle } from '@/lib/data-export'

// 자료 내보내기: 발행인(우리 그룹 매체)·총관리자가 기사 전체(JSON·CSV)와 사진(ZIP)을 내려받는다
//   다른 프로그램으로 옮길 때 그 회사에 그대로 넘기면 되고, IM 뉴스룸 가져오기 도구도 같은 형식을 읽는다
export const dynamic = 'force-dynamic'
export const maxDuration = 300

const PAGE = 500
const PHOTO_PARALLEL = 6

type Row = Record<string, any>

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams
  const outletId = q.get('outlet') ?? ''
  const kind = q.get('kind') ?? 'json'
  if (!/^[0-9a-f-]{36}$/.test(outletId)) return NextResponse.json({ error: '매체를 골라 주세요.' }, { status: 400 })

  const { supabase, isSuper, isGroupAdmin, publisherId, trial } = await getCmsContext()
  if (!isGroupAdmin || trial) return NextResponse.json({ error: '자료 내보내기는 발행인·총관리자만 할 수 있습니다.' }, { status: 403 })
  const { data: outlet } = await supabase.from('outlets').select('id, name, domain, publisher_id').eq('id', outletId).maybeSingle()
  if (!outlet || (!isSuper && outlet.publisher_id !== publisherId)) return NextResponse.json({ error: '우리 그룹 매체만 내보낼 수 있습니다.' }, { status: 403 })

  const { data: cats } = await supabase.from('categories').select('*').eq('outlet_id', outletId).order('sort_order')
  const catById = new Map(((cats ?? []) as Row[]).map((c) => [c.id as string, c]))
  const origin = outlet.domain ? `https://${outlet.domain}` : null
  const stamp = new Date().toISOString().slice(0, 10)
  const base = `${outlet.name}-${stamp}`.replace(/[\\/:*?"<>|\s]+/g, '_')

  // 기사를 500건씩 차례로 읽는다 (발행일 → 만든 순)
  async function* articles(range?: { from: string; to: string } | 'unpublished'): AsyncGenerator<ExportArticle> {
    for (let from = 0; ; from += PAGE) {
      let query = supabase.from('articles').select('*').eq('outlet_id', outletId)
      if (range === 'unpublished') query = query.is('published_at', null)
      else if (range) query = query.gte('published_at', range.from).lt('published_at', range.to)
      const { data, error } = await query.order('published_at', { ascending: true, nullsFirst: false }).order('created_at').range(from, from + PAGE - 1)
      if (error) throw new Error(error.message)
      for (const a of (data ?? []) as Row[]) {
        const c = a.category_id ? catById.get(a.category_id) : null
        yield {
          id: a.id, legacy_id: a.legacy_id ?? null,
          url: origin && a.status === 'published' ? `${origin}/news/${a.id}` : null,
          title: a.title ?? '', excerpt: a.excerpt ?? null, body: a.body ?? '',
          section_slug: c?.slug ?? null, section_name: c?.name ?? null,
          byline: a.byline ?? null, status: a.status, published_at: a.published_at ?? null, updated_at: a.updated_at ?? null,
          tags: a.tags ?? [], thumbnail_url: a.thumbnail_url ?? null, view_count: a.view_count ?? 0,
          images: bodyImages(a.body),
        }
      }
      if ((data ?? []).length < PAGE) return
    }
  }

  const enc = new TextEncoder()
  const download = (stream: ReadableStream, name: string, type: string) =>
    new Response(stream, {
      headers: {
        'content-type': type,
        'content-disposition': `attachment; filename="export.${name.split('.').pop()}"; filename*=UTF-8''${encodeURIComponent(name)}`,
        'cache-control': 'no-store',
      },
    })

  // 1) 기사 전체 JSON (다른 회사에 넘기는 원본, 가져오기 도구도 읽는다)
  if (kind === 'json') {
    const stream = new ReadableStream({
      async start(ctrl) {
        try {
          const head = {
            format: EXPORT_FORMAT, version: EXPORT_VERSION, exported_at: new Date().toISOString(),
            outlet: { id: outlet.id, name: outlet.name, domain: outlet.domain },
            note: '기사 본문(body)은 HTML입니다. 사진은 사진 ZIP 파일에 저장소 경로 그대로 들어 있고, 본문·대표 사진 주소의 /media/ 뒤 경로와 같습니다.',
            sections: ((cats ?? []) as Row[]).map((c) => ({ slug: c.slug, name: c.name, parent_slug: c.parent_slug ?? null, sort_order: c.sort_order })),
          }
          ctrl.enqueue(enc.encode(JSON.stringify(head, null, 1).replace(/\n}$/, ',\n "articles": [\n')))
          let first = true
          for await (const a of articles()) {
            ctrl.enqueue(enc.encode((first ? '' : ',\n') + JSON.stringify(a)))
            first = false
          }
          ctrl.enqueue(enc.encode('\n]}\n'))
          ctrl.close()
        } catch (e) {
          ctrl.error(e)
        }
      },
    })
    return download(stream, `${base}-기사.json`, 'application/json; charset=utf-8')
  }

  // 2) 기사 전체 CSV (엑셀로 열어 보는 용도)
  if (kind === 'csv') {
    const cols = ['기사번호', '옛 기사번호', '제목', '요약', '섹션', '기자', '상태', '발행일', '수정일', '태그', '대표 사진', '조회수', '기사 주소', '본문(HTML)'] as const
    const stream = new ReadableStream({
      async start(ctrl) {
        try {
          ctrl.enqueue(enc.encode('﻿' + cols.join(',') + '\r\n'))
          for await (const a of articles()) {
            const row = [a.id, a.legacy_id, a.title, a.excerpt, a.section_name, a.byline, a.status, a.published_at, a.updated_at, a.tags, a.thumbnail_url, a.view_count, a.url, a.body]
            ctrl.enqueue(enc.encode(row.map(csvCell).join(',') + '\r\n'))
          }
          ctrl.close()
        } catch (e) {
          ctrl.error(e)
        }
      },
    })
    return download(stream, `${base}-기사.csv`, 'text/csv; charset=utf-8')
  }

  // 3) 사진 ZIP (발행 연도별, 많으면 월별). 저장소 경로 그대로 넣고, 기사별 사진 목록을 함께 넣는다
  if (kind === 'photos') {
    const year = q.get('year') ?? ''
    const month = q.get('month') ?? ''
    let range: { from: string; to: string } | 'unpublished'
    let label: string
    if (year === 'none') { range = 'unpublished'; label = '발행전' }
    else if (/^\d{4}$/.test(year) && (!month || /^(0?[1-9]|1[0-2])$/.test(month))) {
      const y = Number(year)
      const m = month ? Number(month) : 0
      // 발행일은 한국 시각 기준으로 나눈다
      const kst = (yy: number, mm: number) => new Date(Date.UTC(yy, mm, 1) - 9 * 3_600_000).toISOString()
      range = m ? { from: kst(y, m - 1), to: kst(y, m) } : { from: kst(y, 0), to: kst(y + 1, 0) }
      label = m ? `${y}-${String(m).padStart(2, '0')}` : String(y)
    } else return NextResponse.json({ error: '연도를 골라 주세요.' }, { status: 400 })

    const stream = new ReadableStream({
      async start(ctrl) {
        const zip = new Zip((err, chunk, final) => {
          if (err) return ctrl.error(err)
          ctrl.enqueue(chunk)
          if (final) ctrl.close()
        })
        const put = (name: string, data: Uint8Array) => {
          const f = new ZipPassThrough(name)
          zip.add(f)
          f.push(data, true)
        }
        try {
          const list = ['기사번호,제목,사진 주소,ZIP 안 파일']
          const wanted = new Map<string, string>()
          for await (const a of articles(range)) {
            for (const url of new Set([a.thumbnail_url, ...a.images].filter(Boolean) as string[])) {
              const path = storagePath(url)
              list.push([a.id, a.title, url, path ?? '(다른 사이트 사진이라 넣지 않음)'].map(csvCell).join(','))
              if (path && !wanted.has(path)) wanted.set(path, url)
            }
          }
          const todo = [...wanted.entries()]
          let missing = 0
          for (let i = 0; i < todo.length; i += PHOTO_PARALLEL) {
            const got = await Promise.all(todo.slice(i, i + PHOTO_PARALLEL).map(async ([path, url]) => {
              try {
                const r = await fetch(url)
                return r.ok ? { path, data: new Uint8Array(await r.arrayBuffer()) } : null
              } catch {
                return null
              }
            }))
            for (const g of got) if (g) put(`photos/${g.path}`, g.data); else missing++
          }
          put('사진목록.csv', enc.encode('﻿' + list.join('\r\n') + '\r\n'))
          put('읽어보세요.txt', enc.encode([
            `${outlet.name} 기사 사진 (${label}) — IM 뉴스룸에서 내보냄 ${new Date().toISOString()}`,
            '',
            `· photos/ 폴더: 사진 ${todo.length - missing}장. 폴더 경로는 기사 본문·대표 사진 주소의 "/media/" 뒤 경로와 같습니다.`,
            '· 사진목록.csv: 기사마다 쓰인 사진 주소와 ZIP 안 파일 이름.',
            '· 보도자료 배포처 등 다른 사이트에 있는 사진은 주소만 적고 파일은 넣지 않았습니다.',
            missing ? `· 내려받지 못한 사진 ${missing}장이 있습니다. 다시 내려받거나 고객센터에 알려 주세요.` : '',
            '· 기사 본문·제목·발행일은 같은 화면의 "기사 전체 (JSON)" 파일에 있습니다.',
          ].join('\r\n')))
          zip.end()
        } catch (e) {
          ctrl.error(e)
        }
      },
    })
    return download(stream, `${base}-사진-${label}.zip`, 'application/zip')
  }

  return NextResponse.json({ error: '내보낼 종류를 골라 주세요.' }, { status: 400 })
}
