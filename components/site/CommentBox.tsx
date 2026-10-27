'use client'

import { useActionState, useEffect, useState, useTransition } from 'react'
import { listComments, postComment, readerLogout, reportComment, startEmailLogin, type PublicComment, type ReaderState } from '@/app/reader/actions'
import type { SiteLang } from '@/lib/sites'

// 기사 아래 댓글: 독자는 구글 또는 이메일 링크로 로그인하고, 쓴 댓글은 편집국이 승인해야 보인다 (comments.sql)
export default function CommentBox({ articleId, lang, next }: { articleId: string; lang: SiteLang; next: string }) {
  const en = lang === 'en'
  const [data, setData] = useState<{ comments: PublicComment[]; reader: { name: string } | null; google: boolean } | null>(null)
  const [body, setBody] = useState('')
  const [msg, setMsg] = useState<{ ok?: string; error?: string }>({})
  const [pending, start] = useTransition()
  const [login, loginAction] = useActionState<ReaderState, FormData>(startEmailLogin, {})

  const load = () => listComments(articleId).then((d) => { if (d.on) setData({ comments: d.comments, reader: d.reader, google: d.google }) })
  useEffect(() => { void load() /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [articleId])
  if (!data) return null

  const fmt = (iso: string) => new Intl.DateTimeFormat(en ? 'en-US' : 'ko-KR', { dateStyle: 'medium' }).format(new Date(iso))
  const submit = () => start(async () => {
    const r = await postComment(articleId, body)
    if (r.error) return setMsg({ error: r.error })
    setBody('')
    setMsg({ ok: en ? 'Thanks! Your comment will appear after our editors approve it.' : '댓글을 받았습니다. 편집국이 승인하면 보입니다.' })
  })

  return (
    <section aria-labelledby="comments-title" className="mt-10 border-t border-rule pt-6">
      <h2 id="comments-title" className="text-[17px] font-bold text-body">{en ? 'Comments' : '댓글'} <span className="font-normal text-sub">{data.comments.length}</span></h2>

      {data.comments.length > 0 ? (
        <ul className="mt-4 divide-y divide-rule">
          {data.comments.map((c) => (
            <li key={c.id} className="py-3.5">
              <p className="text-[13px] text-sub"><strong className="font-semibold text-body">{c.name}</strong> · {fmt(c.created_at)}</p>
              <p className="mt-1 whitespace-pre-line break-words text-[15px] leading-[1.7] text-body">{c.body}</p>
              {data.reader && (
                <button type="button" className="mt-1 text-[12px] text-sub underline-offset-2 hover:text-body hover:underline" onClick={() => start(async () => {
                  if (!window.confirm(en ? 'Report this comment to the editors?' : '이 댓글을 신고할까요?')) return
                  const r = await reportComment(c.id)
                  window.alert(r.error ?? (en ? 'Thank you. We will review it.' : '신고했습니다. 확인하겠습니다.'))
                })}>{en ? 'Report' : '신고'}</button>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-[14px] text-sub">{en ? 'No comments yet.' : '아직 댓글이 없습니다.'}</p>
      )}

      <div className="mt-5 rounded border border-rule bg-soft p-4">
        {data.reader ? (
          <div className="space-y-2">
            <p className="flex flex-wrap items-center justify-between gap-2 text-[13px] text-sub">
              <span>{en ? 'Signed in as' : '로그인:'} <strong className="text-body">{data.reader.name}</strong></span>
              <button type="button" className="underline-offset-2 hover:text-body hover:underline" onClick={() => start(async () => { await readerLogout(); setData({ ...data, reader: null }); setMsg({}) })}>{en ? 'Sign out' : '로그아웃'}</button>
            </p>
            <label htmlFor="comment-body" className="sr-only">{en ? 'Your comment' : '댓글 내용'}</label>
            <textarea id="comment-body" value={body} onChange={(e) => setBody(e.target.value)} maxLength={1000} rows={4}
              placeholder={en ? 'Join the conversation. Please be respectful; comments are reviewed before they appear.' : '의견을 남겨 주세요. 서로 존중해 주세요. 댓글은 검토 뒤에 보입니다.'}
              className="w-full rounded border border-rule bg-white px-3 py-2 text-[15px]" />
            <div className="flex flex-wrap items-center gap-3">
              <button type="button" disabled={pending || !body.trim()} onClick={submit} className="rounded bg-brand px-4 py-2 text-[14px] font-semibold text-white disabled:opacity-50">{en ? 'Post comment' : '댓글 등록'}</button>
              <span className="text-[12px] text-sub">{body.length}/1000</span>
            </div>
            {msg.ok && <p role="status" className="text-[13px] text-brand">{msg.ok}</p>}
            {msg.error && <p role="alert" className="text-[13px] text-[#C0392B]">{msg.error}</p>}
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-[14px] font-semibold text-body">{en ? 'Sign in to comment' : '댓글을 쓰려면 로그인하세요'}</p>
            {data.google && (
              <a href={`/api/reader/google?next=${encodeURIComponent(next)}`} className="inline-flex items-center gap-2 rounded border border-rule bg-white px-4 py-2 text-[14px] font-semibold text-body hover:border-brand">
                {en ? 'Continue with Google' : '구글로 로그인'}
              </a>
            )}
            {login.ok ? (
              <p role="status" className="text-[13.5px] text-brand">{en ? 'Check your email. We sent you a sign-in link (valid for 30 minutes).' : '메일을 확인하세요. 로그인 링크를 보냈습니다(30분 동안 사용 가능).'}</p>
            ) : (
              <form action={loginAction} className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
                <input type="hidden" name="next" value={next} />
                <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden className="hidden" />
                <label className="sr-only" htmlFor="rd-name">{en ? 'Name to show' : '댓글에 보일 이름'}</label>
                <input id="rd-name" name="name" required maxLength={60} placeholder={en ? 'Name to show' : '댓글에 보일 이름'} className="rounded border border-rule bg-white px-3 py-2 text-[14px]" />
                <label className="sr-only" htmlFor="rd-email">Email</label>
                <input id="rd-email" name="email" type="email" required maxLength={200} placeholder={en ? 'Email address' : '이메일 주소'} className="rounded border border-rule bg-white px-3 py-2 text-[14px]" autoComplete="email" />
                <button type="submit" className="rounded bg-brand px-4 py-2 text-[14px] font-semibold text-white">{en ? 'Email me a link' : '로그인 링크 받기'}</button>
                {login.error && <p role="alert" className="text-[13px] text-[#C0392B] sm:col-span-3">{login.error}</p>}
              </form>
            )}
            <p className="text-[12px] text-sub">{en ? 'We use your email only to sign you in. Your name is shown with your comments.' : '이메일은 로그인에만 쓰고, 댓글에는 입력한 이름이 보입니다.'}</p>
          </div>
        )}
      </div>
    </section>
  )
}
