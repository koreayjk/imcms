import Link from 'next/link'
import { getCmsContext } from '@/lib/cms'
import { getT } from '@/lib/cms-t'
import { storageLimitBytes, formatBytes } from '@/lib/storage-quota'
import MediaManager, { type FileRow } from '@/components/cms/MediaManager'

const PAGE_SIZE = 40

type Props = { searchParams: Promise<{ kind?: string; owner?: string; unused?: string; page?: string }> }

export default async function MediaPage(props: Props) {
  const sp = await props.searchParams
  const { t, lang } = await getT()
  const { supabase, outletId, isEditorPlus, isSuper } = await getCmsContext()
  const kind = sp.kind === 'video' ? 'video' : 'photo'
  const owner = isEditorPlus && /^[0-9a-f-]{36}$/.test(sp.owner ?? '') ? sp.owner! : null
  const unused = sp.unused === '1'
  const page = Math.max(1, Number(sp.page) || 1)

  if (!outletId) {
    return <div className="mx-auto max-w-[900px] px-4 py-8 text-[14px] text-muted">{t('소속 매체가 있어야 저장 파일을 볼 수 있습니다.', 'You need to belong to an outlet to view saved files.')}</div>
  }

  const [filesRes, usageRes, outletRes, membersRes] = await Promise.all([
    supabase.rpc('outlet_files', { o: outletId, p_kind: kind, p_owner: owner, p_unused: unused, p_limit: PAGE_SIZE, p_offset: (page - 1) * PAGE_SIZE }),
    supabase.rpc('outlet_storage_bytes', { o: outletId }),
    supabase.from('outlets').select('plan').eq('id', outletId).maybeSingle(),
    isEditorPlus ? supabase.from('outlet_members').select('profile_id').eq('outlet_id', outletId) : Promise.resolve({ data: null }),
  ])

  if (filesRes.error) {
    const needSql = /outlet_files|function|schema cache/i.test(filesRes.error.message)
    return (
      <div className="mx-auto max-w-[900px] px-4 py-5 md:px-8 md:py-8">
        <h1 className="mb-4 text-[22px] font-bold tracking-tight">{t('저장 파일', 'Saved files')}</h1>
        <p className="rounded-lg border border-line bg-white p-5 text-[14px] leading-relaxed">
          {needSql ? (lang === 'en' ? <>To use the saved files screen, the IM Newsroom team needs to run <code>supabase/media-manager.sql</code> in Supabase.</> : <>저장 파일 화면을 쓰려면 운영팀이 Supabase에서 <code>supabase/media-manager.sql</code>을 실행해야 합니다.</>) : `${t('파일 목록을 불러오지 못했습니다', 'Could not load the file list')}: ${filesRes.error.message}`}
        </p>
      </div>
    )
  }

  const rows = ((filesRes.data ?? []) as { bucket_name: string; file_name: string; file_size: number; uploaded_at: string; owner_id: string | null; owner_name: string | null; in_use: boolean; total: number }[])
  const total = rows[0]?.total ?? 0
  const u = Array.isArray(usageRes.data) ? usageRes.data[0] : usageRes.data
  const used = u ? Number(u.photos ?? 0) + Number(u.videos ?? 0) : null
  const limit = storageLimitBytes((outletRes.data as { plan?: string | null } | null)?.plan)

  // 올린 사람으로 거르기: 이 매체 구성원 이름
  const ids = ((membersRes.data ?? []) as { profile_id: string }[]).map((m) => m.profile_id)
  const { data: people } = ids.length ? await supabase.from('profiles').select('id, full_name').in('id', ids) : { data: [] }
  const owners = ((people ?? []) as { id: string; full_name: string | null }[]).map((p) => ({ id: p.id, name: p.full_name || t('이름 없음', 'No name') })).sort((a, b) => a.name.localeCompare(b.name, lang === 'en' ? 'en' : 'ko'))

  const base = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').replace(/\/$/, '')
  const files: FileRow[] = rows.map((r) => ({
    bucket: r.bucket_name, name: r.file_name, size: Number(r.file_size), at: r.uploaded_at, owner: r.owner_name, inUse: r.in_use,
    url: `${base}/storage/v1/object/public/${r.bucket_name}/${r.file_name}`,
  }))

  const qs = (extra: Record<string, string | undefined>) => {
    const p = new URLSearchParams()
    const merged = { kind: kind === 'video' ? 'video' : undefined, owner: owner ?? undefined, unused: unused ? '1' : undefined, ...extra }
    for (const [k, v] of Object.entries(merged)) if (v) p.set(k, v)
    const s = p.toString()
    return `/media${s ? `?${s}` : ''}`
  }
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <div className="mx-auto max-w-[1100px] px-4 py-5 md:px-8 md:py-8">
      <h1 className="text-[22px] font-bold tracking-tight">{t('저장 파일', 'Saved files')}</h1>
      <p className="mt-1 text-[13px] text-muted">
        {isEditorPlus ? t('이 매체에 올라간 사진·영상입니다. 편집장 이상은 전체를, 기자는 자기가 올린 파일만 봅니다.', 'Photos and videos uploaded to this outlet. Editors-in-Chief and above see all files; reporters see only the files they uploaded.') : t('내가 올린 사진·영상입니다.', 'Photos and videos you uploaded.')}
        {' '}{t('기사·수정 이력·광고 배너·로고에서 쓰는 파일은 지울 수 없고, 지운 파일은 되돌릴 수 없습니다.', 'Files used in stories, revision history, ad banners, or the logo cannot be deleted, and deleted files cannot be recovered.')}
      </p>

      {used !== null && (
        <div className="mt-3 rounded-lg border border-line bg-white px-4 py-3 text-[13px]" aria-live="polite">
          {t('매체 저장 용량(사진+영상):', 'Outlet storage (photos + videos):')} <b>{formatBytes(used)}</b>{limit ? ` / ${formatBytes(limit)}` : ''}{lang === 'en' ? ' used' : ' 사용'}
          {limit && <span className="mt-1.5 block h-1.5 overflow-hidden rounded bg-line"><span className={`block h-full ${used / limit >= 0.8 ? 'bg-danger' : 'bg-review'}`} style={{ width: `${Math.min(100, Math.round((used / limit) * 100))}%` }} /></span>}
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2 text-[13px]">
        <Link href={qs({ kind: undefined, page: undefined })} className={`rounded-full px-3.5 py-1.5 font-semibold ${kind === 'photo' ? 'bg-ink text-white' : 'border border-line bg-white'}`}>{t('사진', 'Photos')}</Link>
        <Link href={qs({ kind: 'video', page: undefined })} className={`rounded-full px-3.5 py-1.5 font-semibold ${kind === 'video' ? 'bg-ink text-white' : 'border border-line bg-white'}`}>{t('영상', 'Videos')}</Link>
        <Link href={qs({ unused: unused ? undefined : '1', page: undefined })} className={`rounded-full px-3.5 py-1.5 ${unused ? 'bg-review text-white' : 'border border-line bg-white'}`}>{t('쓰이지 않는 파일만', 'Unused files only')}</Link>
        {isEditorPlus && owners.length > 0 && (
          <form action="/media" className="ml-auto flex items-center gap-1.5">
            {kind === 'video' && <input type="hidden" name="kind" value="video" />}
            {unused && <input type="hidden" name="unused" value="1" />}
            <label htmlFor="owner" className="text-muted">{t('올린 사람', 'Uploaded by')}</label>
            <select id="owner" name="owner" defaultValue={owner ?? ''} className="rounded border border-line bg-white px-2 py-1.5">
              <option value="">{t('전체', 'All')}</option>
              {owners.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
            <button className="rounded border border-line bg-white px-3 py-1.5 font-semibold">{t('보기', 'View')}</button>
          </form>
        )}
      </div>

      <MediaManager outletId={outletId} files={files} showOwner={isEditorPlus} kind={kind} total={total} />

      {pages > 1 && (
        <nav className="mt-6 flex items-center justify-center gap-2 text-[13px]" aria-label={t('쪽 이동', 'Pagination')}>
          {page > 1 && <Link href={qs({ page: String(page - 1) })} className="rounded border border-line bg-white px-3 py-1.5">{t('이전', 'Previous')}</Link>}
          <span className="text-muted">{lang === 'en' ? `Page ${page} of ${pages} · ${total.toLocaleString('en-US')} total` : `${page} / ${pages}쪽 · 전체 ${total.toLocaleString('ko-KR')}개`}</span>
          {page < pages && <Link href={qs({ page: String(page + 1) })} className="rounded border border-line bg-white px-3 py-1.5">{t('다음', 'Next')}</Link>}
        </nav>
      )}
    </div>
  )
}
