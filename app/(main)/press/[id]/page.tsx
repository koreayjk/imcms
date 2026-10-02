import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getCmsContext } from '@/lib/cms'
import { MANUAL_SOURCE, ensureFullBody, sourceLabel, type PressRelease } from '@/lib/press'
import { sanitizeBody } from '@/lib/article-html'
import { formatDateTime } from '@/lib/format'
import PendingButton from '@/components/cms/PendingButton'
import { aiReady } from '@/lib/ai-draft'
import { aiLevel, aiLimitMessage, getAiStatus, myLimitFull, myLimitMessage } from '@/lib/ai-usage'
import { ensureEmailImages } from '@/lib/press-attachments'
import { createArticleFromPress, deleteManualPress } from '../actions'

export const preferredRegion = 'icn1'
// AI 초안은 최대 50초까지 기다린다
export const maxDuration = 60

export default async function PressDetailPage({ params, searchParams }: { params: { id: string }; searchParams: { error?: string } }) {
  const { supabase, user, outletId } = await getCmsContext()

  const { data } = await supabase.from('press_releases').select('*').eq('id', params.id).maybeSingle()
  if (!data) notFound()
  const { release: r, attachments } = await ensureEmailImages(supabase, await ensureFullBody(supabase, data as PressRelease), outletId)
  const files = attachments.filter((a) => !a.content_type.startsWith('image/') || !a.copied_url)

  const [{ data: made }, usage] = await Promise.all([
    outletId
      ? supabase.from('articles').select('id, title, status').eq('outlet_id', outletId).eq('press_release_id', r.id)
      : Promise.resolve({ data: [] as { id: string; title: string; status: string }[] }),
    getAiStatus(supabase, outletId),
  ])
  const level = aiLevel(usage)
  // 한도를 다 썼고 추가 사용이 꺼져 있으면 AI 초안 버튼을 막는다
  const aiBlocked = ((level === 'full' || level === 'over') && !usage?.overage) || myLimitFull(usage)

  const ai = aiReady() && !aiBlocked
  const manual = r.source_key === MANUAL_SOURCE
  const emailed = r.source_key === 'email'

  return (
    <div className="mx-auto max-w-[900px] px-4 py-5 md:px-8 md:py-8 pb-28 md:pb-28">
      <nav className="mb-5 flex items-center gap-1.5 text-[12.5px] text-muted" aria-label="현재 위치">
        <Link href="/press" className="hover:text-ink">보도자료함</Link>
        <span>›</span>
        <span className="min-w-0 max-w-md truncate text-ink">{r.title}</span>
      </nav>

      {searchParams.error && (
        <p role="alert" className="mb-5 rounded-lg border border-danger/30 bg-danger/5 px-5 py-3.5 text-[13.5px] text-danger">{searchParams.error}</p>
      )}

      {made && made.length > 0 && (
        <div className="mb-5 rounded-lg border border-published/30 bg-published/5 px-5 py-3.5 text-[13.5px]">
          <strong className="text-published">이미 기사로 만든 보도자료입니다.</strong>{' '}
          {made.map((a) => (
            <Link key={a.id} href={`/articles/${a.id}/edit`} className="ml-1 underline underline-offset-2">{a.title}</Link>
          ))}
        </div>
      )}

      <article className="rounded-lg border border-line bg-white px-5 py-6 md:px-10 md:py-9">
        <p className="flex flex-wrap items-center gap-2 text-[12.5px] text-muted">
          {manual && <span className="rounded bg-ink px-1.5 py-0.5 text-white">직접 등록</span>}
          {emailed && <span className="rounded bg-review px-1.5 py-0.5 text-white">메일로 받음</span>}
          <span className="rounded bg-line/70 px-1.5 py-0.5">{r.source_name}</span>
          <span className="tabular-nums">{formatDateTime(r.published_at)}</span>
          {r.link && <a href={r.link} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-ink">원문 보기 ↗</a>}
          {(manual || emailed) && r.created_by === user.id && !made?.length && (
            <form action={deleteManualPress.bind(null, r.id)} className="ml-auto">
              <PendingButton pending="삭제 중…" className="text-[12px] text-danger underline underline-offset-2">삭제</PendingButton>
            </form>
          )}
        </p>
        <h1 className="mt-3 text-[22px] font-extrabold md:text-[26px] leading-snug tracking-tight">{r.title}</h1>
        {r.body_html ? (
          <div className="article-content mt-5 text-[16px] leading-[1.85] md:mt-7 md:leading-[1.9]" dangerouslySetInnerHTML={{ __html: sanitizeBody(r.body_html) }} />
        ) : (
          <div className="mt-7 space-y-3 text-[15px] leading-relaxed">
            <p>{r.summary}</p>
            <p className="rounded bg-draft/10 px-3 py-2 text-[13px] text-draft">전문을 가져오지 못했습니다. 기사로 만들면 요약만 들어가니 원문을 확인해 보완해 주세요.</p>
          </div>
        )}
        {files.length > 0 && (
          <div className="mt-8 border-t border-line pt-5">
            <p className="text-[13px] font-bold">첨부파일</p>
            <ul className="mt-2 flex flex-wrap gap-2">
              {files.map((f) => (
                <li key={f.id}>
                  <a href={`/press/attachment/${f.id}`} className="inline-flex items-center gap-1.5 rounded border border-line px-3 py-1.5 text-[13px] hover:border-ink">
                    📎 {f.name} <span className="text-[11.5px] text-muted">{Math.max(1, Math.round(f.size / 1024))}KB</span>
                  </a>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-[12px] text-muted">한글·PDF 파일 내용은 기사에 자동으로 들어가지 않습니다. 내려받아 확인한 뒤 필요한 부분을 옮겨 주세요.</p>
          </div>
        )}
      </article>

      <p className="mt-4 text-[12px] leading-relaxed text-muted md:hidden">
        {ai ? 'AI 초안: 기사체로 다시 쓰고 확인할 점을 메모로 남깁니다. 원문 그대로: 보도자료 문장을 그대로 옮깁니다.' : aiBlocked ? '이번 달 AI 초안 한도를 다 썼습니다.' : 'AI 초안은 관리자가 AI 키를 설정하면 쓸 수 있습니다.'}{' '}
        끝에 “{sourceLabel(r)}에서 배포한 보도자료를 바탕으로 작성” 문구가 붙습니다.
      </p>

      {usage && (level || usage.mine_limit != null) && (
        <p
          role={level === 'ok' ? undefined : 'status'}
          className={`mt-4 rounded-lg border px-4 py-2.5 text-[13px] ${!level || level === 'ok' ? 'border-line bg-white text-muted' : level === 'near' ? 'border-draft/40 bg-draft/10 text-ink' : 'border-danger/30 bg-danger/5 font-medium text-danger'}`}
        >
          {aiLimitMessage(usage)}
          {myLimitMessage(usage) && <span className={`mt-0.5 block ${myLimitFull(usage) ? 'font-semibold text-danger' : ''}`}>{myLimitMessage(usage)}</span>}
        </p>
      )}

      <div className="cms-actionbar border-t border-line bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-[900px] items-center gap-3 px-4 py-2.5 md:px-8 md:py-3">
          <p className="hidden flex-1 text-[12.5px] leading-relaxed text-muted md:block">
            {ai
              ? 'AI 초안: 기사체로 다시 쓰고 확인할 점을 메모로 남깁니다. 원문 그대로: 보도자료 문장을 그대로 옮깁니다.'
              : aiBlocked ? '이번 달 AI 초안 한도를 다 썼습니다. 원문 그대로 기사 만들기는 쓸 수 있습니다.'
              : 'AI 초안은 관리자가 AI 키(ANTHROPIC_API_KEY 또는 GEMINI_API_KEY)를 설정하면 쓸 수 있습니다.'}{' '}
            사진은 우리 저장소로 옮겨지고, 끝에 “{sourceLabel(r)}에서 배포한 보도자료를 바탕으로 작성” 문구가 붙습니다.
          </p>
          <Link href="/press" className="btn-secondary hidden md:inline-flex">목록</Link>
          <form action={createArticleFromPress.bind(null, r.id, 'raw')} className="flex-1 md:flex-none">
            <PendingButton pending="만드는 중…" className="btn-secondary w-full whitespace-nowrap px-3 md:w-auto">원문 그대로<span className="hidden md:inline"> 기사로</span></PendingButton>
          </form>
          <form action={createArticleFromPress.bind(null, r.id, 'ai')} className="flex-[1.4] md:flex-none">
            <PendingButton pending="AI가 쓰는 중…" className="btn-publish w-full whitespace-nowrap px-3 md:w-auto md:px-5" disabled={!ai}>AI 초안<span className="hidden md:inline">으로 기사</span> 만들기</PendingButton>
          </form>
        </div>
      </div>
    </div>
  )
}
