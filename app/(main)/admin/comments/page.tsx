import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getCmsContext } from '@/lib/cms'
import { getT } from '@/lib/cms-t'
import { formatDateTime } from '@/lib/format'
import PendingButton from '@/components/cms/PendingButton'
import { banReader, decideComment, deleteComment } from './actions'
import { HOLD_LABEL } from '@/lib/comment-screen'

type Row = {
  id: string; body: string; status: 'pending' | 'approved' | 'rejected'; report_count: number; created_at: string; hold_reason: string | null
  article: { id: string; title: string } | null
  reader: { id: string; name: string | null; email: string; banned: boolean } | null
  outlet: { name: string } | null
}

// 편집국: 독자 댓글 승인·반려 (홈페이지 설정에서 "기사 댓글 받기"를 켠 매체)
export default async function CommentsPage(props: { searchParams: Promise<{ s?: string }> }) {
  const sp = await props.searchParams
  const { supabase, outletId, isEditorPlus, isStaff } = await getCmsContext()
  if (!isEditorPlus && !isStaff) redirect('/articles')
  const { t, lang } = await getT()
  const tab = sp.s === 'approved' || sp.s === 'rejected' ? sp.s : 'pending'

  let q = supabase
    .from('comments')
    .select('id, body, status, report_count, created_at, hold_reason, article:articles(id, title), reader:readers(id, name, email, banned), outlet:outlets(name)')
    .eq('status', tab)
    .order('created_at', { ascending: tab === 'pending' })
    .limit(100)
  if (outletId) q = q.eq('outlet_id', outletId)
  const [{ data, error }, ...counts] = await Promise.all([
    q,
    ...(['pending', 'approved', 'rejected'] as const).map((s) => {
      let c = supabase.from('comments').select('id', { count: 'exact', head: true }).eq('status', s)
      if (outletId) c = c.eq('outlet_id', outletId)
      return c
    }),
  ])
  const rows = (data ?? []) as unknown as Row[]
  const TABS = [
    { key: 'pending', label: t('승인 대기', 'Pending') },
    { key: 'approved', label: t('공개 중', 'Approved') },
    { key: 'rejected', label: t('반려', 'Rejected') },
  ]

  return (
    <div className="mx-auto max-w-[960px] px-4 py-5 md:px-8 md:py-8">
      <header className="mb-5">
        <h1 className="text-[22px] font-bold tracking-tight">{t('댓글', 'Comments')}</h1>
        <p className="mt-1 text-[13px] leading-relaxed text-muted">
          {t('새 댓글을 어떻게 받을지는 홈페이지 설정에서 고릅니다: 승인 후 공개, 또는 먼저 공개하고 나중에 검토. 먼저 공개로 해도 링크·연락처·욕설·고함·도배로 보이는 댓글은 자동으로 이 화면의 승인 대기에 잡힙니다. 신고가 3건 쌓인 댓글도 승인 대기로 돌아옵니다. “공개 중” 탭에서 문제 있는 댓글을 숨기거나 독자를 차단하세요.', 'Choose in your homepage settings how new comments are handled: approve before they show, or publish first and review afterward. Even in publish-first mode, comments that look like links, contact details, abuse, shouting or spam are held in Pending automatically. A comment with 3 reports also goes back to Pending. Use the Approved tab to hide problem comments or ban readers.')}
        </p>
      </header>

      <nav className="mb-4 flex gap-1 border-b border-line" aria-label={t('댓글 상태', 'Comment status')}>
        {TABS.map((x, i) => (
          <Link key={x.key} href={`/admin/comments?s=${x.key}`} aria-current={tab === x.key ? 'page' : undefined}
            className={`-mb-px border-b-2 px-4 py-2.5 text-[14px] ${tab === x.key ? 'border-ink font-bold text-ink' : 'border-transparent text-muted hover:text-ink'}`}>
            {x.label} <span className="ml-1 text-[12px] tabular-nums opacity-60">{counts[i].count ?? 0}</span>
          </Link>
        ))}
      </nav>

      {error ? (
        <p className="rounded-lg border border-draft/40 bg-draft/10 px-5 py-4 text-sm">{t('댓글을 쓰려면 운영팀이 Supabase에서 comments.sql을 먼저 실행해야 합니다.', 'The operations team needs to run comments.sql in Supabase before comments can be used.')}</p>
      ) : rows.length === 0 ? (
        <p className="rounded-lg border border-line bg-white px-5 py-10 text-center text-[14px] text-muted">{t('댓글이 없습니다.', 'No comments.')}</p>
      ) : (
        <ul className="space-y-3">
          {rows.map((c) => (
            <li key={c.id} className="rounded-lg border border-line bg-white p-4">
              <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[12.5px] text-muted">
                <strong className="text-ink">{c.reader?.name || c.reader?.email.split('@')[0]}</strong>
                <span className="break-all">{c.reader?.email}</span>
                <span>· {formatDateTime(c.created_at, lang)}</span>
                {!outletId && c.outlet?.name && <span>· {c.outlet.name}</span>}
                {c.hold_reason && HOLD_LABEL[c.hold_reason] && <span className="rounded bg-draft/20 px-1.5 text-ink">{t(`자동 검사: ${HOLD_LABEL[c.hold_reason][0]}`, `Auto screen: ${HOLD_LABEL[c.hold_reason][1]}`)}</span>}
                {c.report_count > 0 && <span className="rounded bg-danger/10 px-1.5 text-danger">{t(`신고 ${c.report_count}건`, `${c.report_count} report${c.report_count === 1 ? '' : 's'}`)}</span>}
                {c.reader?.banned && <span className="rounded bg-danger/10 px-1.5 text-danger">{t('차단된 독자', 'Banned')}</span>}
              </p>
              {c.article && <p className="mt-1 text-[12.5px]"><Link href={`/articles/${c.article.id}`} className="text-review underline underline-offset-2">{c.article.title}</Link></p>}
              <p className="mt-2 whitespace-pre-line break-words text-[14.5px] leading-[1.7]">{c.body}</p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {c.status !== 'approved' && (
                  <form action={decideComment.bind(null, c.id, 'approved')}><PendingButton pending="…" className="btn-primary px-3 py-1.5 text-[12.5px]">{t('승인', 'Approve')}</PendingButton></form>
                )}
                {c.status !== 'rejected' && (
                  <form action={decideComment.bind(null, c.id, 'rejected')}><PendingButton pending="…" className="btn-secondary px-3 py-1.5 text-[12.5px]">{c.status === 'approved' ? t('숨기기', 'Hide') : t('반려', 'Reject')}</PendingButton></form>
                )}
                <form action={deleteComment.bind(null, c.id)}><PendingButton pending="…" confirm={t('이 댓글을 지울까요?', 'Delete this comment?')} className="rounded border border-line px-3 py-1.5 text-[12.5px] text-danger">{t('삭제', 'Delete')}</PendingButton></form>
                {c.reader && !c.reader.banned && (
                  <form action={banReader.bind(null, c.reader.id)} className="ml-auto"><PendingButton pending="…" confirm={t('이 독자를 차단할까요? 쓴 댓글은 모두 반려됩니다.', 'Ban this reader? All of their comments will be rejected.')} className="text-[12.5px] text-muted underline underline-offset-2 hover:text-danger">{t('독자 차단', 'Ban reader')}</PendingButton></form>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
