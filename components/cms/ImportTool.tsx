'use client'

import { useMemo, useRef, useState } from 'react'
import { Unzip, UnzipInflate } from 'fflate'
import { createClient } from '@/lib/supabase'
import { formatDateTime } from '@/lib/format'
import { refreshOutletPages } from '@/app/(main)/articles/refresh'
import {
  FIELDS, PHOTO_TYPES, PhotoIndex, csvTable, decodeText, guessArticleTable, guessMapping, imExport, parseDate, plainText,
  rewriteBodyImages, sqlRows, sqlTables, storageSafe, toBodyHtml, type FieldKey, type Mapping, type SqlTableInfo, type Table,
} from '@/lib/import-parse'

type Outlet = { id: string; name: string; domain: string | null; group: string | null }
type Cat = { id: string; name: string; slug: string }
type Source = { file: string; kind: 'sql' | 'csv' | 'im'; encoding: string; text?: string; tables?: SqlTableInfo[]; table: Table }
type PhotoStats = { files: number; uploaded: number; existed: number; skipped: number; failed: number }
type Result = { inserted: number; existed: number; filtered: number; invalid: number; missingPhotos: number; errors: string[] }

const BATCH = 50
const PHOTO_PARALLEL = 6
const MAX_PHOTO = 10 * 1024 * 1024

function hash(s: string) {
  let h = 2166136261
  for (const ch of s) h = Math.imul(h ^ ch.codePointAt(0)!, 16777619) >>> 0
  return h.toString(36)
}
const cleanByline = (s: string) => plainText(s).replace(/\s*기자\s*$/, '').replace(/\s*\S+@\S+\s*/, ' ').trim().slice(0, 40)

// 다른 프로그램 자료 가져오기 (총관리자). 파일은 이 브라우저에서 읽고, 기사·사진만 우리 DB·저장소에 올린다
export default function ImportTool({ outlets, userId }: { outlets: Outlet[]; userId: string }) {
  const supabase = useMemo(() => createClient(), [])
  const [outletId, setOutletId] = useState('')
  const [cats, setCats] = useState<Cat[]>([])
  const [src, setSrc] = useState<Source | null>(null)
  const [reading, setReading] = useState('')
  const [mapping, setMapping] = useState<Mapping>({})
  const [skipCol, setSkipCol] = useState('')
  const [skipVals, setSkipVals] = useState('')
  const [sectionMap, setSectionMap] = useState<Record<string, string>>({})
  const [defaultByline, setDefaultByline] = useState('')
  const photos = useRef(new PhotoIndex())
  const [photoStats, setPhotoStats] = useState<PhotoStats | null>(null)
  const [photoBusy, setPhotoBusy] = useState('')
  const [progress, setProgress] = useState('')
  const [result, setResult] = useState<Result | null>(null)
  const [error, setError] = useState('')
  const outlet = outlets.find((o) => o.id === outletId)

  async function pickOutlet(id: string) {
    setOutletId(id)
    setResult(null)
    const { data } = await supabase.from('categories').select('id, name, slug').eq('outlet_id', id).order('sort_order')
    setCats((data ?? []) as Cat[])
    setDefaultByline(outlets.find((o) => o.id === id)?.name ?? '')
  }

  // ───── 1. 기사 파일 읽기 ─────
  async function readFile(file: File) {
    setError(''); setResult(null); setSrc(null); setReading(`${file.name} 읽는 중…`)
    try {
      const { text, encoding } = decodeText(new Uint8Array(await file.arrayBuffer()))
      const im = /\.json$/i.test(file.name) ? imExport(text) : null
      if (im) {
        const rows = im.articles.map((a: any) => ({
          legacy_id: String(a.legacy_id ?? a.id ?? ''), title: a.title ?? '', excerpt: a.excerpt ?? null, body: a.body ?? '',
          published_at: a.published_at ?? null, section: a.section_slug ?? null, byline: a.byline ?? null,
          thumbnail: a.thumbnail_url ?? null, tags: (a.tags ?? []).join(', '), views: String(a.view_count ?? 0),
        }))
        const table: Table = { name: 'IM 뉴스룸 내보내기', columns: Object.keys(rows[0] ?? { title: '' }), rows }
        setSrc({ file: file.name, kind: 'im', encoding, table })
        applyTable(table, { legacy_id: 'legacy_id', title: 'title', subtitle: 'excerpt', body: 'body', published_at: 'published_at', section: 'section', byline: 'byline', thumbnail: 'thumbnail', tags: 'tags', views: 'views' })
      } else if (/\.sql$/i.test(file.name) || /CREATE\s+TABLE|INSERT\s+INTO/i.test(text.slice(0, 200000))) {
        const tables = sqlTables(text)
        if (!tables.length) throw new Error('이 파일에서 INSERT 문(기사 자료)을 찾지 못했습니다. MySQL 백업(.sql) 파일인지 확인해 주세요.')
        const best = guessArticleTable(tables)!
        const table = sqlRows(text, best)
        setSrc({ file: file.name, kind: 'sql', encoding, text, tables, table })
        applyTable(table)
      } else {
        const table = csvTable(text, file.name)
        if (!table.rows.length) throw new Error('읽을 행이 없습니다.')
        setSrc({ file: file.name, kind: 'csv', encoding, table })
        applyTable(table)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setReading('')
    }
  }

  function applyTable(table: Table, fixed?: Mapping) {
    const m = fixed ?? guessMapping(table.columns)
    setMapping(m)
    const del = table.columns.find((c) => /^(del|delete|is_?del|del_?yn|delete_?yn|is_?deleted|deleted|use_?yn|status|state|view_?yn|open_?yn)$/i.test(c))
    setSkipCol(del ?? '')
    setSkipVals(del ? (/use|view|open/i.test(del) ? 'N' : /status|state/i.test(del) ? '' : 'Y, 1') : '')
  }

  function chooseTable(name: string) {
    if (!src?.text || !src.tables) return
    const info = src.tables.find((t) => t.name === name)
    if (!info) return
    const table = sqlRows(src.text, info)
    setSrc({ ...src, table })
    applyTable(table)
  }

  const skipSet = useMemo(() => new Set(skipVals.split(',').map((s) => s.trim()).filter(Boolean)), [skipVals])
  const rows = useMemo(() => (src?.table.rows ?? []).filter((r) => !(skipCol && skipSet.has((r[skipCol] ?? '').trim()))), [src, skipCol, skipSet])

  // 섹션 값별 기사 수 → 우리 섹션 고르기 (이름·영문 이름이 같으면 미리 골라 둔다)
  const sectionValues = useMemo(() => {
    if (!mapping.section) return []
    const n = new Map<string, number>()
    for (const r of rows) { const v = (r[mapping.section] ?? '').trim(); n.set(v, (n.get(v) ?? 0) + 1) }
    return [...n.entries()].sort((a, b) => b[1] - a[1])
  }, [rows, mapping.section])
  const sectionOf = (v: string) => sectionMap[v] ?? cats.find((c) => c.slug.toLowerCase() === v.toLowerCase() || c.name === v)?.id ?? ''

  // ───── 2. 사진 ZIP 올리기 (이 브라우저에서 풀어 한 장씩 저장소로) ─────
  async function uploadZip(files: FileList) {
    if (!outletId) return setError('먼저 매체를 고르세요.')
    setError('')
    const stats: PhotoStats = photoStats ?? { files: 0, uploaded: 0, existed: 0, skipped: 0, failed: 0 }
    const show = () => setPhotoStats({ ...stats })
    for (const file of Array.from(files)) {
      setPhotoBusy(`${file.name} 푸는 중…`)
      const pending = new Set<Promise<void>>()
      const put = async (name: string, data: Uint8Array, type: string) => {
        const path = `${outletId}/legacy/${storageSafe(name)}`
        const { error: err } = await supabase.storage.from('media').upload(path, new Blob([data as BlobPart], { type }), { contentType: type, cacheControl: '31536000', upsert: false })
        if (err && !/exist|duplicate/i.test(err.message)) { stats.failed++; return show() }
        if (err) stats.existed++; else stats.uploaded++
        photos.current.add(name, supabase.storage.from('media').getPublicUrl(path).data.publicUrl)
        show()
      }
      const uz = new Unzip()
      uz.register(UnzipInflate)
      uz.onfile = (f) => {
        if (f.name.endsWith('/')) return
        const ext = f.name.split('.').pop()?.toLowerCase() ?? ''
        stats.files++
        if (!PHOTO_TYPES[ext] || (f.originalSize ?? 0) > MAX_PHOTO) { stats.skipped++; return }
        const chunks: Uint8Array[] = []
        f.ondata = (err, dat, final) => {
          if (err) { stats.failed++; return }
          chunks.push(dat)
          if (!final) return
          const all = new Uint8Array(chunks.reduce((a, c) => a + c.length, 0))
          let o = 0
          for (const c of chunks) { all.set(c, o); o += c.length }
          if (all.length > MAX_PHOTO) { stats.skipped++; return }
          const p = put(f.name, all, PHOTO_TYPES[ext]).finally(() => pending.delete(p))
          pending.add(p)
        }
        f.start()
      }
      try {
        const reader = file.stream().getReader()
        for (;;) {
          const { value, done } = await reader.read()
          uz.push(value ?? new Uint8Array(0), done)
          while (pending.size >= PHOTO_PARALLEL) await Promise.race(pending)
          if (done) break
        }
        await Promise.all(pending)
      } catch (e) {
        setError(`${file.name}: ZIP을 풀지 못했습니다 (${e instanceof Error ? e.message : e})`)
      }
    }
    setPhotoBusy('')
  }

  // ───── 3. 행 → 기사 ─────
  function build(r: Record<string, string | null>) {
    const get = (k: FieldKey) => (mapping[k] ? r[mapping[k]!] ?? null : null)
    const title = plainText(get('title') ?? '').slice(0, 300)
    const published_at = parseDate(get('published_at'))
    const raw = toBodyHtml(get('body'))
    const { html, missing } = rewriteBodyImages(raw, photos.current)
    const thumbRaw = get('thumbnail')
    const firstImg = html.match(/<img\b[^>]*?\bsrc\s*=\s*["'](https?:\/\/[^"']+)["']/i)?.[1] ?? null
    const thumbnail_url = (thumbRaw && (photos.current.resolve(thumbRaw) ?? (/^https?:\/\//i.test(thumbRaw) ? thumbRaw : null))) || firstImg
    const sub = get('subtitle')
    const byline = get('byline') ? cleanByline(get('byline')!) : defaultByline.trim()
    const legacy = (get('legacy_id') ?? '').trim().slice(0, 64) || `t${hash(`${title}|${get('published_at') ?? ''}`)}`
    const tags = Array.from(new Set((get('tags') ?? '').split(/[,|#;]/).map((t) => t.trim()).filter(Boolean))).slice(0, 10)
    const views = Number.parseInt(get('views') ?? '', 10)
    return {
      ok: !!title && !!published_at && !!plainText(html),
      missing,
      row: {
        outlet_id: outletId, author_id: userId, legacy_id: legacy, title, body: html,
        excerpt: (sub ? plainText(sub) : plainText(html)).slice(0, sub ? 300 : 150) || null,
        thumbnail_url, status: 'published', published_at, byline: byline || null, byline_email: null,
        category_id: mapping.section ? sectionOf((get('section') ?? '').trim()) || null : null,
        tags: tags.length ? tags : null, view_count: Number.isFinite(views) && views > 0 ? views : 0,
      },
    }
  }

  const preview = useMemo(() => rows.slice(0, 5).map((r) => build(r)), [rows, mapping, sectionMap, cats, defaultByline, photoStats]) // eslint-disable-line react-hooks/exhaustive-deps
  const photoCheck = useMemo(() => {
    let missing = 0
    let withImg = 0
    for (const r of rows.slice(0, 300)) {
      const b = toBodyHtml(mapping.body ? r[mapping.body] : '')
      if (/<img/i.test(b)) withImg++
      missing += rewriteBodyImages(b, photos.current).missing
    }
    return { missing, withImg, sample: Math.min(rows.length, 300) }
  }, [rows, mapping.body, photoStats]) // eslint-disable-line react-hooks/exhaustive-deps

  // ───── 4. 가져오기 ─────
  async function run() {
    if (!outletId || !src) return
    if (!mapping.title || !mapping.body || !mapping.published_at) return setError('제목·본문·발행일 칸을 정해 주세요.')
    if (!window.confirm(`${outlet?.name}에 기사 ${rows.length.toLocaleString()}건을 가져올까요?\n\n· 바로 '발행' 상태로 들어가 홈페이지에 보입니다.\n· 이미 가져온 기사(같은 옛 기사 번호)는 건너뜁니다. 여러 번 눌러도 두 번 들어가지 않습니다.`)) return
    setError(''); setResult(null)
    const res: Result = { inserted: 0, existed: 0, filtered: (src.table.rows.length - rows.length), invalid: 0, missingPhotos: 0, errors: [] }
    // 이미 가져온 옛 기사 번호
    setProgress('이미 가져온 기사 확인 중…')
    const existing = new Set<string>()
    for (let from = 0; ; from += 1000) {
      const { data, error: err } = await supabase.from('articles').select('legacy_id').eq('outlet_id', outletId).not('legacy_id', 'is', null).range(from, from + 999)
      if (err) { setProgress(''); return setError(/legacy_id/.test(err.message) ? '먼저 Supabase에서 supabase/data-migration.sql을 실행해 주세요.' : err.message) }
      for (const x of (data ?? []) as { legacy_id: string }[]) existing.add(x.legacy_id)
      if ((data ?? []).length < 1000) break
    }
    let batch: Record<string, unknown>[] = []
    const flush = async () => {
      if (!batch.length) return
      const { error: err } = await supabase.from('articles').insert(batch)
      if (!err) res.inserted += batch.length
      else {
        // 한 건씩 다시 넣어 문제 있는 기사만 골라낸다
        for (const one of batch) {
          const { error: e1 } = await supabase.from('articles').insert(one)
          if (e1) { if (res.errors.length < 30) res.errors.push(`${one.legacy_id} 「${String(one.title).slice(0, 30)}」: ${e1.message}`) }
          else res.inserted++
        }
      }
      batch = []
    }
    for (let i = 0; i < rows.length; i++) {
      const b = build(rows[i])
      if (!b.ok) { res.invalid++; continue }
      if (existing.has(b.row.legacy_id)) { res.existed++; continue }
      existing.add(b.row.legacy_id)
      res.missingPhotos += b.missing
      batch.push(b.row)
      if (batch.length >= BATCH) {
        await flush()
        setProgress(`${(i + 1).toLocaleString()} / ${rows.length.toLocaleString()} 처리 · 새로 넣음 ${res.inserted.toLocaleString()}건`)
      }
    }
    await flush()
    await refreshOutletPages(outletId).catch(() => null)
    setProgress('')
    setResult(res)
  }

  const step = (n: number, title: string, children: React.ReactNode, disabled = false) => (
    <section className={`rounded-lg border border-line bg-white p-5 ${disabled ? 'pointer-events-none opacity-50' : ''}`}>
      <h2 className="text-[15px] font-bold">{n}. {title}</h2>
      <div className="mt-3">{children}</div>
    </section>
  )

  return (
    <div className="space-y-5">
      {step(1, '옮겨 올 매체', (
        <select value={outletId} onChange={(e) => pickOutlet(e.target.value)} className="field-input max-w-sm">
          <option value="">매체 선택</option>
          {outlets.map((o) => <option key={o.id} value={o.id}>{o.group ? `${o.group} · ` : ''}{o.name}</option>)}
        </select>
      ))}

      {step(2, '기사 자료 파일', (
        <>
          <p className="text-[12.5px] leading-relaxed text-muted">
            예전 업체에서 받은 <strong className="text-ink">DB 백업 파일(.sql)</strong>, 엑셀에서 저장한 <strong className="text-ink">CSV</strong>, 또는 IM 뉴스룸에서 내보낸 <strong className="text-ink">JSON</strong>을 고르세요.
            파일은 이 컴퓨터에서만 읽고 서버에 그대로 올리지 않습니다(회원 정보 표는 읽지 않습니다). ZIP으로 받았다면 먼저 풀어 주세요.
          </p>
          <input type="file" accept=".sql,.csv,.tsv,.txt,.json" onChange={(e) => e.target.files?.[0] && readFile(e.target.files[0])} className="mt-3 block text-[13px]" />
          {reading && <p className="mt-2 text-[13px] text-review">{reading}</p>}
          {src && (
            <div className="mt-3 rounded-md bg-paper px-4 py-3 text-[13px]">
              <p><strong>{src.file}</strong> · {src.kind === 'sql' ? 'DB 백업' : src.kind === 'csv' ? 'CSV' : 'IM 뉴스룸 내보내기'} · 글자 {src.encoding === 'euc-kr' ? '옛 한국어(EUC-KR)' : 'UTF-8'}</p>
              {src.tables && (
                <label className="mt-2 flex flex-wrap items-center gap-2">
                  기사가 든 표
                  <select value={src.table.name} onChange={(e) => chooseTable(e.target.value)} className="rounded border border-line bg-white px-2 py-1">
                    {src.tables.map((t) => <option key={t.name} value={t.name}>{t.name} ({(t.bytes / 1e6).toFixed(1)}MB · 칸 {t.columns.length}개)</option>)}
                  </select>
                </label>
              )}
              <p className="mt-1 text-muted">읽은 행 {src.table.rows.length.toLocaleString()}개 · 칸 {src.table.columns.length}개</p>
            </div>
          )}
        </>
      ), !outletId)}

      {src && step(3, '칸 맞추기', (
        <>
          <p className="text-[12.5px] text-muted">이름을 보고 미리 골라 두었습니다. 아래 미리보기를 보며 맞는지 확인하세요.</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {FIELDS.map((f) => (
              <label key={f.key} className="flex items-center gap-2 text-[13px]">
                <span className="w-24 shrink-0">{f.label}{f.need && <span className="text-danger"> *</span>}</span>
                <select value={mapping[f.key] ?? ''} onChange={(e) => setMapping({ ...mapping, [f.key]: e.target.value || undefined })} className="min-w-0 flex-1 rounded border border-line bg-white px-2 py-1" disabled={src.kind === 'im'}>
                  <option value="">{f.need ? '고르세요' : '없음'}</option>
                  {src.table.columns.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </label>
            ))}
          </div>
          {!mapping.legacy_id && <p className="mt-2 text-[12.5px] text-draft">옛 기사 번호 칸이 없으면 옛 기사 주소를 새 기사로 연결할 수 없습니다. 보통 idxno·no·idx 같은 이름입니다.</p>}
          <div className="mt-3 flex flex-wrap items-center gap-2 text-[13px]">
            <span>건너뛸 기사: 칸</span>
            <select value={skipCol} onChange={(e) => setSkipCol(e.target.value)} className="rounded border border-line bg-white px-2 py-1">
              <option value="">없음</option>
              {src.table.columns.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <span>값이</span>
            <input value={skipVals} onChange={(e) => setSkipVals(e.target.value)} placeholder="예: Y, 1" className="w-28 rounded border border-line px-2 py-1" />
            <span className="text-muted">이면 (삭제된 기사 등) → 남는 기사 {rows.length.toLocaleString()}건</span>
          </div>
          {!mapping.byline && (
            <label className="mt-3 flex items-center gap-2 text-[13px]">
              기자 이름 칸이 없을 때 쓸 이름 <input value={defaultByline} onChange={(e) => setDefaultByline(e.target.value)} className="w-40 rounded border border-line px-2 py-1" />
            </label>
          )}
          <div className="mt-4 overflow-x-auto rounded-md border border-line">
            <table className="w-full min-w-[640px] text-[12.5px]">
              <thead><tr className="border-b border-line text-left text-muted"><th className="px-3 py-1.5 font-normal">옛 번호</th><th className="px-2 py-1.5 font-normal">제목</th><th className="px-2 py-1.5 font-normal">발행일</th><th className="px-2 py-1.5 font-normal">섹션</th><th className="px-2 py-1.5 font-normal">기자</th><th className="px-3 py-1.5 font-normal">본문</th></tr></thead>
              <tbody className="divide-y divide-line">
                {preview.map((p, i) => (
                  <tr key={i} className={p.ok ? '' : 'bg-danger/5'}>
                    <td className="px-3 py-1.5 tabular-nums">{p.row.legacy_id}</td>
                    <td className="max-w-[260px] truncate px-2 py-1.5 font-medium">{p.row.title || <span className="text-danger">제목 없음</span>}</td>
                    <td className="whitespace-nowrap px-2 py-1.5 tabular-nums">{p.row.published_at ? formatDateTime(p.row.published_at) : <span className="text-danger">날짜 못 읽음</span>}</td>
                    <td className="px-2 py-1.5">{cats.find((c) => c.id === p.row.category_id)?.name ?? '-'}</td>
                    <td className="px-2 py-1.5">{p.row.byline ?? '-'}</td>
                    <td className="px-3 py-1.5 text-muted">{plainText(p.row.body).length.toLocaleString()}자{p.missing ? <span className="text-draft"> · 사진 {p.missing}장 못 찾음</span> : ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ))}

      {src && mapping.section && step(4, '섹션 맞추기', (
        <>
          <p className="text-[12.5px] text-muted">예전 섹션(코드)마다 우리 섹션을 고르세요. 우리 섹션은 먼저 “섹션 관리”에서 만들어 두세요. 고르지 않으면 섹션 없이 들어갑니다.</p>
          <ul className="mt-3 max-h-[360px] divide-y divide-line overflow-y-auto rounded-md border border-line">
            {sectionValues.map(([v, n]) => {
              const sample = rows.find((r) => (r[mapping.section!] ?? '').trim() === v)
              return (
                <li key={v} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2 text-[13px]">
                  <span className="w-28 shrink-0 font-mono font-semibold">{v || '(비어 있음)'}</span>
                  <span className="w-16 shrink-0 text-muted tabular-nums">{n.toLocaleString()}건</span>
                  <span className="min-w-0 flex-1 truncate text-[12px] text-muted">예: {sample ? plainText(sample[mapping.title!] ?? '') : ''}</span>
                  <select value={sectionOf(v)} onChange={(e) => setSectionMap({ ...sectionMap, [v]: e.target.value })} className="rounded border border-line bg-white px-2 py-1">
                    <option value="">섹션 없음</option>
                    {cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </li>
              )
            })}
          </ul>
        </>
      ))}

      {src && step(mapping.section ? 5 : 4, '사진 (ZIP)', (
        <>
          <p className="text-[12.5px] leading-relaxed text-muted">
            예전 업체에서 받은 사진 ZIP을 고르세요(여러 개 가능). 이 컴퓨터에서 풀어 사진만 저장소에 올리고, 기사 본문 속 사진 주소(/news/photo/… 등)를 새 주소로 바꿉니다.
            <strong className="text-ink"> 기사를 가져오기 전에</strong> 올려야 본문 사진이 연결됩니다. 이미 올린 사진은 다시 올리지 않습니다.
          </p>
          <input type="file" accept=".zip" multiple onChange={(e) => e.target.files?.length && uploadZip(e.target.files)} className="mt-3 block text-[13px]" disabled={!!photoBusy} />
          {(photoStats || photoBusy) && (
            <p className="mt-2 text-[13px]">
              {photoBusy && <span className="text-review">{photoBusy} </span>}
              {photoStats && <>파일 {photoStats.files.toLocaleString()}개 · 올림 {photoStats.uploaded.toLocaleString()} · 이미 있음 {photoStats.existed.toLocaleString()} · 사진 아님/10MB 넘음 {photoStats.skipped} · 실패 <span className={photoStats.failed ? 'text-danger' : ''}>{photoStats.failed}</span></>}
            </p>
          )}
          <p className="mt-2 text-[12.5px] text-muted">
            앞쪽 {photoCheck.sample}건 확인: 사진 있는 기사 {photoCheck.withImg}건 · 짝을 못 찾은 사진 <strong className={photoCheck.missing ? 'text-draft' : 'text-published'}>{photoCheck.missing}장</strong>
            {photoCheck.missing > 0 && ' (사진 ZIP을 더 올리거나, 없는 사진이면 그대로 가져와도 됩니다)'}
          </p>
        </>
      ))}

      {src && step(mapping.section ? 6 : 5, '가져오기', (
        <>
          <p className="text-[12.5px] leading-relaxed text-muted">
            기사 {rows.length.toLocaleString()}건을 {outlet?.name}에 ‘발행’ 상태로 넣습니다. 옛 기사 주소(…articleView.html?idxno=123, …article.html?no=123)로 들어오면 새 기사로 넘어갑니다.
            도중에 멈춰도 다시 누르면 이어서 넣습니다(이미 넣은 기사는 건너뜀).
          </p>
          <button type="button" onClick={run} disabled={!!progress || !!photoBusy} className="btn-primary mt-3">{progress ? '가져오는 중…' : `기사 ${rows.length.toLocaleString()}건 가져오기`}</button>
          {progress && <p className="mt-2 text-[13px] text-review">{progress} — 이 화면을 닫지 마세요.</p>}
          {result && (
            <div className="mt-3 rounded-md bg-paper px-4 py-3 text-[13px] leading-relaxed">
              <p className="font-semibold text-published">끝났습니다. 새로 넣은 기사 {result.inserted.toLocaleString()}건</p>
              <p className="text-muted">이미 있던 기사 {result.existed.toLocaleString()} · 건너뛴 기사(조건) {result.filtered.toLocaleString()} · 제목·날짜·본문이 비어 못 넣은 기사 {result.invalid.toLocaleString()} · 짝을 못 찾은 본문 사진 {result.missingPhotos.toLocaleString()}장</p>
              {result.errors.length > 0 && <ul className="mt-2 list-disc pl-5 text-[12px] text-danger">{result.errors.map((e) => <li key={e}>{e}</li>)}</ul>}
            </div>
          )}
        </>
      ))}

      {error && <p role="alert" className="rounded-md border border-danger/30 bg-danger/5 px-4 py-3 text-[13px] text-danger">{error}</p>}
    </div>
  )
}
