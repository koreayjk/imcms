import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getCmsContext } from '@/lib/cms'
import { pressVisible } from '@/lib/view-scope'
import { getT } from '@/lib/cms-t'
import { MANUAL_SOURCE, ensureFullBody, type PressRelease } from '@/lib/press'
import { sanitizeBody } from '@/lib/article-html'
import { formatDateTime } from '@/lib/format'
import PendingButton from '@/components/cms/PendingButton'
import { aiReady } from '@/lib/ai-draft'
import { aiLevel, aiLimitMessage, getAiStatus, myLimitFull, myLimitMessage } from '@/lib/ai-usage'
import { ensureEmailImages, ensureEmailText } from '@/lib/press-attachments'
import { createArticleFromPress, deleteManualPress } from '../actions'
import { isForeignSource, isUsSource } from '@/lib/press-sources'
import BackLink from '@/components/cms/BackLink'

export const preferredRegion = 'icn1'
// AI 초안은 최대 50초까지 기다린다
export const maxDuration = 60

export default async function PressDetailPage(
  props: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string }> }
) {
  const searchParams = await props.searchParams
  const params = await props.params
  const ctx = await getCmsContext()
  const { supabase, user, outletId } = ctx
  const { t, lang } = await getT()

  const { data } = await supabase.from('press_releases').select('*').eq('id', params.id).maybeSingle()
  if (!data || !pressVisible(data as { publisher_id?: string | null }, ctx)) notFound()
  const withImages = await ensureEmailImages(supabase, await ensureFullBody(supabase, data as PressRelease), outletId)
  const attachments = withImages.attachments
  // 메일 첨부 문서의 글자를 본문에 넣는다 (메일 자동 수신 부가 서비스를 쓰거나 체험 중인 매체에만 메일이 들어오므로 따로 구분하지 않는다)
  const { release: r, notes: readNotes } = await ensureEmailText(supabase, withImages.release, attachments)
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
  // 미국 출처에 실린 사진: 기자가 사용 권리를 확인한 사진만 기사에 넣는다 (체크하지 않으면 사진 없이 만든다)
  const usPhotos = isUsSource(r.source_key)
    ? Array.from((r.body_html ?? '').matchAll(/<img[^>]+src="([^"]+)"[^>]*>(?:<p><em>▲ ([^<]*)<\/em><\/p>)?/g), (m) => ({ src: m[1].replace(/&amp;/g, '&'), caption: m[2] ?? '' }))
    : []
  const emailed = r.source_key === 'email'
  // 해외 언론: 원문 그대로는 막고, AI가 출처를 밝힌 한국어 기사로 새로 쓴다
  const foreign = isForeignSource(r.source_key)
  const aiHelp = t('AI 초안: 기사체로 다시 쓰고 확인할 점을 메모로 남깁니다. 원문 그대로: 보도자료 문장을 그대로 옮깁니다.', 'AI draft: rewrites the release in news style and leaves a note of points to check. As-is: copies the press release text unchanged.')

  return (
    <div className="mx-auto max-w-[900px] px-4 py-5 md:px-8 md:py-8 pb-28 md:pb-28">
      <nav className="mb-5 flex items-center gap-1.5 text-[12.5px] text-muted" aria-label={t('현재 위치', 'Breadcrumb')}>
        <BackLink href="/press" className="hover:text-ink">{t('보도자료함', 'Press releases')}</BackLink>
        <span>›</span>
        <span className="min-w-0 max-w-md truncate text-ink">{r.title}</span>
      </nav>

      {searchParams.error && (
        <p role="alert" className="mb-5 rounded-lg border border-danger/30 bg-danger/5 px-5 py-3.5 text-[13.5px] text-danger">{searchParams.error}</p>
      )}

      {made && made.length > 0 && (
        <div className="mb-5 rounded-lg border border-published/30 bg-published/5 px-5 py-3.5 text-[13.5px]">
          <strong className="text-published">{t('이미 기사로 만든 보도자료입니다.', 'A story has already been created from this press release.')}</strong>{' '}
          {made.map((a) => (
            <Link key={a.id} href={`/articles/${a.id}/edit`} className="ml-1 underline underline-offset-2">{a.title}</Link>
          ))}
        </div>
      )}

      <article className="rounded-lg border border-line bg-white px-5 py-6 md:px-10 md:py-9">
        <p className="flex flex-wrap items-center gap-2 text-[12.5px] text-muted">
          {manual && <span className="rounded bg-ink px-1.5 py-0.5 text-white">{t('직접 등록', 'Added manually')}</span>}
          {emailed && <span className="rounded bg-review px-1.5 py-0.5 text-white">{t('메일로 받음', 'Received by email')}</span>}
          <span className="rounded bg-line/70 px-1.5 py-0.5">{r.source_name}</span>
          <span className="tabular-nums">{formatDateTime(r.published_at, lang)}</span>
          {r.link && <a href={r.link} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-ink">{t('원문 보기 ↗', 'View original ↗')}</a>}
          {(manual || emailed) && r.created_by === user.id && !made?.length && (
            <form action={deleteManualPress.bind(null, r.id)} className="ml-auto">
              <PendingButton pending={t('삭제 중…', 'Deleting…')} className="text-[12px] text-danger underline underline-offset-2">{t('삭제', 'Delete')}</PendingButton>
            </form>
          )}
        </p>
        <h1 className="mt-3 text-[22px] font-extrabold md:text-[26px] leading-snug tracking-tight">{r.title}</h1>
        {r.body_html ? (
          <div className="article-content mt-5 text-[16px] leading-[1.85] md:mt-7 md:leading-[1.9]" dangerouslySetInnerHTML={{ __html: sanitizeBody(r.body_html) }} />
        ) : (
          <div className="mt-7 space-y-3 text-[15px] leading-relaxed">
            <p>{r.summary}</p>
            <p className="rounded bg-draft/10 px-3 py-2 text-[13px] text-draft">{t('전문을 가져오지 못했습니다. 기사로 만들면 요약만 들어가니 원문을 확인해 보완해 주세요.', 'Could not retrieve the full text. A story created from this will contain only the summary, so please check the original and fill in the rest.')}</p>
          </div>
        )}
        {files.length > 0 && (
          <div className="mt-8 border-t border-line pt-5">
            <p className="text-[13px] font-bold">{t('첨부파일', 'Attachments')}</p>
            <ul className="mt-2 flex flex-wrap gap-2">
              {files.map((f) => (
                <li key={f.id}>
                  <a href={`/press/attachment/${f.id}`} className="inline-flex max-w-full items-center gap-1.5 break-all rounded border border-line px-3 py-1.5 text-[13px] hover:border-ink">
                    📎 {f.name} <span className="text-[11.5px] text-muted">{Math.max(1, Math.round(f.size / 1024))}KB</span>
                  </a>
                </li>
              ))}
            </ul>
            {readNotes.map((n) => <p key={n} className="mt-2 text-[12px] text-draft">{n}</p>)}
            <p className="mt-2 text-[12px] text-muted">
              {t('한글·워드·PDF·텍스트 파일의 글자는 위 본문 아래에 자동으로 옮겨 두었습니다. 표·그림 속 글자나 문서 안의 사진은 빠질 수 있으니 파일도 함께 확인해 주세요.', 'Text from Hangul (HWP), Word, PDF, and text files has been copied below the body above. Text inside tables or images and photos embedded in documents may be missing, so please check the files as well.')}
            </p>
          </div>
        )}
      </article>

      {usPhotos.length > 0 && (
        <section aria-labelledby="photo-check" className="mt-5 rounded-lg border border-draft/40 bg-draft/10 px-5 py-4">
          <h2 id="photo-check" className="text-[14px] font-bold">{t('사진 사용 확인', 'Photo rights check')}</h2>
          <p className="mt-1 text-[12.5px] leading-relaxed text-muted">
            {t('쓸 수 있다고 확인한 사진만 체크하세요. 체크하지 않은 사진은 기사에 넣지 않습니다. 보통 쓸 수 있는 것: 보도자료 발행처가 언론용으로 낸 사진, 미국 연방 정부 사진, 직접 찍거나 허락받은 사진. 쓰면 안 되는 것: 다른 언론사·통신사·사진기자의 사진, 사용 조건(예: 편집용 한정)을 지킬 수 없는 사진.', 'Check only the photos you have confirmed you may use. Unchecked photos are left out of the story. Usually fine: photos the issuer distributed for news use, U.S. federal government photos, and photos you took or have permission to use. Not fine: photos from other news outlets, wire services or photographers, or photos whose terms (for example editorial-use only) you cannot meet.')}
          </p>
          <ul className="mt-3 grid gap-3 sm:grid-cols-3">
            {usPhotos.map((p) => (
              <li key={p.src} className="rounded border border-line bg-white p-2 text-[12px]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.src} alt="" className="h-28 w-full rounded object-cover" />
                {p.caption && <p className="mt-1 line-clamp-2 text-muted">{p.caption.replace(/^Photo provided by /, '')}</p>}
                <label className="mt-1.5 flex items-start gap-1.5 font-semibold"><input type="checkbox" name="photo" value={p.src} form="create-ai" className="mt-0.5" /><span>{t('이 사진을 써도 되는 것을 확인했습니다', 'I confirmed I may use this photo')}</span></label>
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className="mt-4 text-[12px] leading-relaxed text-muted md:hidden">
        {ai ? aiHelp : aiBlocked ? t('이번 달 AI 사용 한도를 다 썼습니다.', 'You have used up this month\'s AI limit.') : t('AI 초안은 관리자가 AI 키를 설정하면 쓸 수 있습니다.', 'AI drafts become available once an admin sets up an AI key.')}
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
            {foreign ? t('해외 언론 기사입니다. AI가 번역이 아니라 출처를 밝힌 한국어 기사로 새로 쓰고, 원문 주소는 확인 메모에 남깁니다. 원문 사진은 쓰지 않습니다.', 'This is a story from a foreign news outlet. Rather than translating it, the AI writes a new Korean-language story that credits the source, and leaves the original URL in the review notes. Photos from the original are not used.') : ai
              ? aiHelp
              : aiBlocked ? t('이번 달 AI 사용 한도를 다 썼습니다. 원문 그대로 기사 만들기는 쓸 수 있습니다.', 'You have used up this month\'s AI limit. You can still create a story from the original text as-is.')
              : t('AI 초안은 관리자가 AI 키(ANTHROPIC_API_KEY 또는 GEMINI_API_KEY)를 설정하면 쓸 수 있습니다.', 'AI drafts become available once an admin sets an AI key (ANTHROPIC_API_KEY or GEMINI_API_KEY).')}{' '}
            {!foreign && t('사진은 우리 저장소로 옮겨집니다.', 'Photos are copied to our storage.')}
          </p>
          <BackLink href="/press" className="btn-secondary hidden md:inline-flex">{t('목록', 'List')}</BackLink>
          {!foreign && (
            <form action={createArticleFromPress.bind(null, r.id, 'raw')} className="flex-1 md:flex-none">
              <PendingButton pending={t('만드는 중…', 'Creating…')} className="btn-secondary w-full whitespace-nowrap px-3 md:w-auto">{t('원문 그대로', 'Use original')}<span className="hidden md:inline">{t(' 기사로', ' as story')}</span></PendingButton>
            </form>
          )}
          <form id="create-ai" action={createArticleFromPress.bind(null, r.id, 'ai')} className="flex-[1.4] md:flex-none">
            <PendingButton pending={t('AI가 쓰는 중…', 'AI is writing…')} className="btn-publish w-full whitespace-nowrap px-3 md:w-auto md:px-5" disabled={!ai}>{lang === 'en' ? <>Create<span className="hidden md:inline"> story from</span> AI draft</> : <>AI 초안<span className="hidden md:inline">으로 기사</span> 만들기</>}</PendingButton>
          </form>
        </div>
      </div>
    </div>
  )
}
