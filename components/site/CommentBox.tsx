'use client'

import { useActionState, useEffect, useState, useTransition } from 'react'
import { deleteGuestComment, listComments, newCaptcha, postComment, postGuestComment, readerLogout, reportComment, startEmailLogin, subscribeReaderNewsletter, type CommentKind, type PublicComment, type ReaderState } from '@/app/reader/actions'
import type { SiteLang } from '@/lib/sites'

// 기사 아래 댓글 (comments.sql). 매체 설정에 따라 두 가지:
//   guest: 닉네임·비밀번호·그림 문자만 넣고 바로 쓴다 (본인 댓글은 비밀번호로 삭제)
//   login: 구글 또는 이메일 링크로 로그인해서 쓴다
// 쓴 댓글은 매체 설정에 따라 편집국이 승인해야 보이거나, 먼저 보이고 자동 검사에 걸린 것만 승인을 기다린다
export default function CommentBox({ articleId, lang, next }: { articleId: string; lang: SiteLang; next: string }) {
  const en = lang === 'en'
  const [data, setData] = useState<{ comments: PublicComment[]; reader: { name: string } | null; google: boolean; newsletter: boolean; kind: CommentKind } | null>(null)
  const [body, setBody] = useState('')
  const [msg, setMsg] = useState<{ ok?: string; error?: string }>({})
  const [pending, start] = useTransition()
  const [login, loginAction] = useActionState<ReaderState, FormData>(startEmailLogin, {})
  const [g, setG] = useState({ name: '', pw: '', cap: '' })
  const [cap, setCap] = useState<{ image: string; token: string } | null>(null)
  const refreshCap = () => newCaptcha().then(setCap)

  const load = () => listComments(articleId).then((d) => { if (d.on) setData({ comments: d.comments, reader: d.reader, google: d.google, newsletter: d.newsletter, kind: d.kind }) })
  useEffect(() => { void load() /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [articleId])
  const guestMode = data?.kind === 'guest'
  useEffect(() => { if (guestMode) void refreshCap() }, [guestMode])
  if (!data) return null

  const fmt = (iso: string) => new Intl.DateTimeFormat(en ? 'en-US' : 'ko-KR', { dateStyle: 'medium' }).format(new Date(iso))
  const submit = () => start(async () => {
    const r = guestMode
      ? await postGuestComment(articleId, { name: g.name, password: g.pw, body, captchaToken: cap?.token ?? '', captcha: g.cap })
      : await postComment(articleId, body)
    if (guestMode) { setG((x) => ({ ...x, cap: '' })); void refreshCap() }
    if (r.error) return setMsg({ error: r.error })
    setBody('')
    if (r.live) { setMsg({ ok: en ? 'Your comment has been posted.' : '댓글이 등록되었습니다.' }); void load() }
    else setMsg({ ok: en ? 'Thanks! Your comment will appear after our editors review it.' : '댓글을 받았습니다. 편집국이 검토하면 보입니다.' })
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
              {(data.reader || guestMode) && (
                <p className="mt-1 flex gap-3 text-[12px] text-sub">
                  <button type="button" className="underline-offset-2 hover:text-body hover:underline" onClick={() => start(async () => {
                    if (!window.confirm(en ? 'Report this comment to the editors?' : '이 댓글을 신고할까요?')) return
                    const r = await reportComment(c.id)
                    window.alert(r.error ?? (en ? 'Thank you. We will review it.' : '신고했습니다. 확인하겠습니다.'))
                  })}>{en ? 'Report' : '신고'}</button>
                  {guestMode && c.guest && (
                    <button type="button" className="underline-offset-2 hover:text-body hover:underline" onClick={() => start(async () => {
                      const pw = window.prompt(en ? 'Enter the password you used when posting.' : '댓글을 쓸 때 정한 비밀번호를 입력하세요.')
                      if (!pw) return
                      const r = await deleteGuestComment(c.id, pw)
                      if (r.error) return window.alert(r.error)
                      void load()
                    })}>{en ? 'Delete' : '삭제'}</button>
                  )}
                </p>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-[14px] text-sub">{en ? 'No comments yet.' : '아직 댓글이 없습니다.'}</p>
      )}

      <div className="mt-5 rounded border border-rule bg-soft p-4">
        {guestMode ? (
          <div className="space-y-2">
            <div className="grid gap-2 sm:grid-cols-2">
              <label className="sr-only" htmlFor="gc-name">{en ? 'Nickname' : '닉네임'}</label>
              <input id="gc-name" value={g.name} onChange={(e) => setG({ ...g, name: e.target.value })} maxLength={20} placeholder={en ? 'Nickname' : '닉네임'} autoComplete="nickname" className="rounded border border-rule bg-white px-3 py-2 text-[14px]" />
              <label className="sr-only" htmlFor="gc-pw">{en ? 'Password' : '비밀번호'}</label>
              <input id="gc-pw" type="password" value={g.pw} onChange={(e) => setG({ ...g, pw: e.target.value })} maxLength={30} placeholder={en ? 'Password (to delete your comment later)' : '비밀번호 (나중에 삭제할 때 필요)'} autoComplete="new-password" className="rounded border border-rule bg-white px-3 py-2 text-[14px]" />
            </div>
            <label htmlFor="comment-body" className="sr-only">{en ? 'Your comment' : '댓글 내용'}</label>
            <textarea id="comment-body" value={body} onChange={(e) => setBody(e.target.value)} maxLength={500} rows={4}
              placeholder={en ? 'Join the conversation. Please be respectful; comments may be reviewed by our editors.' : '의견을 남겨 주세요. 서로 존중해 주세요. 댓글은 편집국이 검토할 수 있습니다.'}
              className="w-full rounded border border-rule bg-white px-3 py-2 text-[15px]" />
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" onClick={() => void refreshCap()} title={en ? 'Refresh' : '다른 그림으로 바꾸기'} className="shrink-0 rounded border border-rule bg-white p-0.5">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {cap ? <img src={cap.image} alt={en ? 'Characters to type' : '입력할 문자'} width={124} height={40} /> : <span className="block h-10 w-[124px]" />}
              </button>
              <label className="sr-only" htmlFor="gc-cap">{en ? 'Type the characters' : '그림 속 문자'}</label>
              <input id="gc-cap" value={g.cap} onChange={(e) => setG({ ...g, cap: e.target.value })} maxLength={4} autoComplete="off" placeholder={en ? 'Type the characters' : '그림 속 문자 입력'} className="w-36 rounded border border-rule bg-white px-3 py-2 text-[14px] uppercase" />
              <span className="ml-auto text-[12px] text-sub">{body.length}/500</span>
              <button type="button" disabled={pending || !body.trim() || !g.name.trim() || !g.pw || !g.cap.trim()} onClick={submit} className="rounded bg-brand px-4 py-2 text-[14px] font-semibold text-white disabled:opacity-50">{en ? 'Post comment' : '댓글 등록'}</button>
            </div>
            {msg.ok && <p role="status" className="text-[13px] text-brand">{msg.ok}</p>}
            {msg.error && <p role="alert" className="text-[13px] text-[#C0392B]">{msg.error}</p>}
            <p className="text-[12px] text-sub">{en ? 'Your nickname is shown with the comment. Your password is stored only in encrypted form, and a scrambled form of your connection address is kept to prevent abuse.' : '닉네임이 댓글에 표시됩니다. 비밀번호는 암호화해 저장하고, 도배 방지를 위해 접속 주소를 알아볼 수 없는 값으로 바꿔 보관합니다.'}</p>
          </div>
        ) : data.reader ? (
          <div className="space-y-2">
            <p className="flex flex-wrap items-center justify-between gap-2 text-[13px] text-sub">
              <span>{en ? 'Signed in as' : '로그인:'} <strong className="text-body">{data.reader.name}</strong></span>
              {data.newsletter && (
                <button type="button" className="mr-3 underline-offset-2 hover:text-body hover:underline" onClick={() => start(async () => {
                  const r = await subscribeReaderNewsletter()
                  window.alert(r.error ?? (en ? 'Check your email and click the link to start the newsletter.' : '메일을 확인해 링크를 누르면 뉴스레터 구독이 시작됩니다.'))
                })}>{en ? 'Get the newsletter' : '뉴스레터 받기'}</button>
              )}
              <button type="button" className="underline-offset-2 hover:text-body hover:underline" onClick={() => start(async () => { await readerLogout(); setData({ ...data, reader: null }); setMsg({}) })}>{en ? 'Sign out' : '로그아웃'}</button>
            </p>
            <label htmlFor="comment-body" className="sr-only">{en ? 'Your comment' : '댓글 내용'}</label>
            <textarea id="comment-body" value={body} onChange={(e) => setBody(e.target.value)} maxLength={1000} rows={4}
              placeholder={en ? 'Join the conversation. Please be respectful; comments may be reviewed by our editors.' : '의견을 남겨 주세요. 서로 존중해 주세요. 댓글은 편집국이 검토할 수 있습니다.'}
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
              <p role="status" className="text-[13.5px] text-brand">{en ? 'Check your email. We sent you a sign-in link (valid for 30 minutes).' : '메일을 확인하세요. 로그인 링크를 보냈습니다(30분 동안 사용 가능).'}{login.newsletter ? (en ? ' A second email will ask you to confirm the newsletter.' : ' 뉴스레터 구독 확인 메일도 따로 갑니다.') : ''}</p>
            ) : (
              <form action={loginAction} className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
                <input type="hidden" name="next" value={next} />
                <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden className="hidden" />
                <label className="sr-only" htmlFor="rd-name">{en ? 'Name to show' : '댓글에 보일 이름'}</label>
                <input id="rd-name" name="name" required maxLength={60} placeholder={en ? 'Name to show' : '댓글에 보일 이름'} className="rounded border border-rule bg-white px-3 py-2 text-[14px]" />
                <label className="sr-only" htmlFor="rd-email">Email</label>
                <input id="rd-email" name="email" type="email" required maxLength={200} placeholder={en ? 'Email address' : '이메일 주소'} className="rounded border border-rule bg-white px-3 py-2 text-[14px]" autoComplete="email" />
                <button type="submit" className="rounded bg-brand px-4 py-2 text-[14px] font-semibold text-white">{en ? 'Email me a link' : '로그인 링크 받기'}</button>
                {data.newsletter && (
                  <label className="flex items-start gap-2 text-[12.5px] text-sub sm:col-span-3"><input type="checkbox" name="newsletter" className="mt-0.5" /><span>{en ? 'Also email me the newsletter (we will send a separate confirmation email; you can unsubscribe anytime).' : '뉴스레터도 받겠습니다 (구독 확인 메일을 따로 보냅니다. 언제든 수신거부할 수 있습니다).'}</span></label>
                )}
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
