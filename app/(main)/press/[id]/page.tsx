import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getCmsContext } from '@/lib/cms'
import { ensureFullBody, sourceLabel, type PressRelease } from '@/lib/press'
import { sanitizeBody } from '@/lib/article-html'
import { formatDateTime } from '@/lib/format'
import PendingButton from '@/components/cms/PendingButton'
import { createArticleFromPress } from '../actions'

export const preferredRegion = 'icn1'
export const maxDuration = 30

export default async function PressDetailPage({ params }: { params: { id: string } }) {
  const { supabase, outletId } = await getCmsContext()

  const { data } = await supabase.from('press_releases').select('*').eq('id', params.id).maybeSingle()
  if (!data) notFound()
  const r = await ensureFullBody(supabase, data as PressRelease)

  const { data: made } = outletId
    ? await supabase.from('articles').select('id, title, status').eq('outlet_id', outletId).eq('press_release_id', r.id)
    : { data: [] as { id: string; title: string; status: string }[] }

  return (
    <div className="mx-auto max-w-[900px] px-8 py-8 pb-28">
      <nav className="mb-5 flex items-center gap-1.5 text-[12.5px] text-muted" aria-label="현재 위치">
        <Link href="/press" className="hover:text-ink">보도자료함</Link>
        <span>›</span>
        <span className="max-w-md truncate text-ink">{r.title}</span>
      </nav>

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
          <span className="rounded bg-line/70 px-1.5 py-0.5">{r.source_name}</span>
          <span className="tabular-nums">{formatDateTime(r.published_at)}</span>
          <a href={r.link} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-ink">원문 보기 ↗</a>
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
          <p className="flex-1 text-[12.5px] text-muted">
            기사 초안이 만들어지고 사진은 우리 저장소로 옮겨집니다. 끝에 “{sourceLabel(r.source_key)}에서 배포한 보도자료를 바탕으로 작성” 문구가 붙습니다.
          </p>
          <Link href="/press" className="btn-secondary">목록</Link>
          <form action={createArticleFromPress.bind(null, r.id)}>
            <PendingButton pending="만드는 중…" className="btn-publish px-5">기사로 만들기</PendingButton>
          </form>
        </div>
      </div>
    </div>
  )
}
