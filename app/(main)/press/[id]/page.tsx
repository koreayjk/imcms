import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getCmsContext } from '@/lib/cms'
import { MANUAL_SOURCE, ensureFullBody, sourceLabel, type PressRelease } from '@/lib/press'
import { sanitizeBody } from '@/lib/article-html'
import { formatDateTime } from '@/lib/format'
import PendingButton from '@/components/cms/PendingButton'
import { aiReady } from '@/lib/ai-draft'
import { createArticleFromPress, deleteManualPress } from '../actions'

export const preferredRegion = 'icn1'
// AI 초안은 최대 50초까지 기다린다
export const maxDuration = 60

export default async function PressDetailPage({ params, searchParams }: { params: { id: string }; searchParams: { error?: string } }) {
  const { supabase, user, outletId } = await getCmsContext()

  const { data } = await supabase.from('press_releases').select('*').eq('id', params.id).maybeSingle()
  if (!data) notFound()
  const r = await ensureFullBody(supabase, data as PressRelease)

  const { data: made } = outletId
    ? await supabase.from('articles').select('id, title, status').eq('outlet_id', outletId).eq('press_release_id', r.id)
    : { data: [] as { id: string; title: string; status: string }[] }

  const ai = aiReady()
  const manual = r.source_key === MANUAL_SOURCE

  return (
    <div className="mx-auto max-w-[900px] px-8 py-8 pb-28">
      <nav className="mb-5 flex items-center gap-1.5 text-[12.5px] text-muted" aria-label="현재 위치">
        <Link href="/press" className="hover:text-ink">보도자료함</Link>
        <span>›</span>
        <span className="max-w-md truncate text-ink">{r.title}</span>
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

      <article className="rounded-lg border border-line bg-white px-10 py-9">
        <p className="flex flex-wrap items-center gap-2 text-[12.5px] text-muted">
          {manual && <span className="rounded bg-ink px-1.5 py-0.5 text-white">직접 등록</span>}
          <span className="rounded bg-line/70 px-1.5 py-0.5">{r.source_name}</span>
          <span className="tabular-nums">{formatDateTime(r.published_at)}</span>
          {r.link && <a href={r.link} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-ink">원문 보기 ↗</a>}
          {manual && r.created_by === user.id && !made?.length && (
            <form action={deleteManualPress.bind(null, r.id)} className="ml-auto">
              <PendingButton pending="삭제 중…" className="text-[12px] text-danger underline underline-offset-2">삭제</PendingButton>
            </form>
          )}
        </p>
        <h1 className="mt-3 text-[26px] font-extrabold leading-snug tracking-tight">{r.title}</h1>
        {r.body_html ? (
          <div className="article-content mt-7 text-[16px] leading-[1.9]" dangerouslySetInnerHTML={{ __html: sanitizeBody(r.body_html) }} />
        ) : (
          <div className="mt-7 space-y-3 text-[15px] leading-relaxed">
            <p>{r.summary}</p>
            <p className="rounded bg-draft/10 px-3 py-2 text-[13px] text-draft">전문을 가져오지 못했습니다. 기사로 만들면 요약만 들어가니 원문을 확인해 보완해 주세요.</p>
          </div>
        )}
      </article>

      <div className="fixed bottom-0 right-0 z-20 border-t border-line bg-white/95 backdrop-blur" style={{ left: 76 }}>
        <div className="mx-auto flex max-w-[900px] items-center gap-3 px-8 py-3">
          <p className="flex-1 text-[12.5px] leading-relaxed text-muted">
            {ai
              ? 'AI 초안: 기사체로 다시 쓰고 확인할 점을 메모로 남깁니다. 원문 그대로: 보도자료 문장을 그대로 옮깁니다.'
              : 'AI 초안은 ANTHROPIC_API_KEY를 설정하면 쓸 수 있습니다.'}{' '}
            사진은 우리 저장소로 옮겨지고, 끝에 “{sourceLabel(r)}에서 배포한 보도자료를 바탕으로 작성” 문구가 붙습니다.
          </p>
          <Link href="/press" className="btn-secondary">목록</Link>
          <form action={createArticleFromPress.bind(null, r.id, 'raw')}>
            <PendingButton pending="만드는 중…" className="btn-secondary">원문 그대로 기사로</PendingButton>
          </form>
          <form action={createArticleFromPress.bind(null, r.id, 'ai')}>
            <PendingButton pending="AI가 쓰는 중… (최대 1분)" className="btn-publish px-5" disabled={!ai}>AI 초안으로 기사 만들기</PendingButton>
          </form>
        </div>
      </div>
    </div>
  )
}
