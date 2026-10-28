'use server'

import { currentSite } from '@/lib/public-data'
import { mailReady, noticeMail, sendMails } from '@/lib/mail'
import { siteOrigin } from '@/lib/origin'
import { paymentDbSecret } from '@/lib/toss'
import { anonClient, clearReaderCookie, getReader, googleReady, readToken, safeNext, signToken } from '@/lib/reader'
import { screenComment } from '@/lib/comment-screen'
import { subscribeNewsletter } from '@/app/newsletter/actions'
import { checkGuestPw, guestIpHash, hashGuestPw, makeCaptcha } from '@/lib/guest-comment'

// 홈페이지 독자 댓글 (comments.sql). 독자 로그인은 구글 또는 이메일 확인 링크
export type PublicComment = { id: string; name: string; body: string; created_at: string; guest: boolean; parent_id?: string | null; staff?: boolean }
export type CommentKind = 'guest' | 'login'

export async function listComments(articleId: string): Promise<{ comments: PublicComment[]; reader: { name: string } | null; google: boolean; on: boolean; newsletter: boolean; kind: CommentKind }> {
  const site = await currentSite()
  const on = !!site.commentsOn
  const newsletter = !!site.outletId && mailReady()
  const kind: CommentKind = site.commentsKind === 'guest' ? 'guest' : 'login'
  if (!on || !/^[0-9a-f-]{36}$/.test(articleId)) return { comments: [], reader: null, google: false, on, newsletter, kind }
  const [{ data }, reader] = await Promise.all([
    anonClient().rpc('comments_public', { secret: paymentDbSecret(), p_article: articleId }),
    kind === 'login' ? getReader() : Promise.resolve(null),
  ])
  return { comments: (data ?? []) as PublicComment[], reader: reader ? { name: reader.name } : null, google: googleReady(), on, newsletter, kind }
}

export type ReaderState = { ok?: boolean; error?: string; newsletter?: boolean }

// 이메일 로그인: 확인 링크를 메일로 보낸다 (링크를 누르면 로그인됨, 30분 안에)
export async function startEmailLogin(_prev: ReaderState, form: FormData): Promise<ReaderState> {
  if (String(form.get('website') ?? '')) return { ok: true } // 봇
  const site = await currentSite()
  const en = site.lang === 'en'
  const email = String(form.get('email') ?? '').trim().toLowerCase().slice(0, 200)
  const name = String(form.get('name') ?? '').trim().slice(0, 60)
  const next = safeNext(String(form.get('next') ?? '/'))
  const wantsNewsletter = form.get('newsletter') === 'on'
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: en ? 'Please check your email address.' : '이메일 주소를 확인해 주세요.' }
  if (!name) return { error: en ? 'Please enter the name to show with your comments.' : '댓글에 보일 이름을 적어 주세요.' }
  if (!site.outletId || !site.commentsOn || !mailReady() || !process.env.PAYMENT_DB_SECRET) return { error: en ? 'Comments are not available yet.' : '댓글은 준비 중입니다.' }
  const token = signToken('reader-email', { email, name, next }, 30 * 60)
  const url = `${await siteOrigin()}/reader/confirm?t=${encodeURIComponent(token)}`
  const { html, text } = noticeMail(en ? {
    title: `Sign in to comment on ${site.name}`,
    lines: ['Click the button below to sign in. The link works for 30 minutes.', "If you didn't ask for this, you can ignore this email."],
    button: { label: 'Sign in', url },
    footer: `${site.name} comment sign-in`,
  } : {
    title: `${site.name} 댓글 로그인`,
    lines: ['아래 버튼을 누르면 로그인됩니다. 링크는 30분 동안만 쓸 수 있습니다.', '직접 요청하지 않으셨다면 이 메일을 무시하세요.'],
    button: { label: '로그인', url },
    footer: `${site.name} 댓글 로그인 메일입니다.`,
  })
  const res = await sendMails([{ to: email, subject: en ? `[${site.name}] Sign in to comment` : `[${site.name}] 댓글 로그인`, html, text, fromName: site.name, tag: 'reader-login' }])
  if (!res.sent) return { error: en ? 'We could not send the email. Please try again shortly.' : '메일을 보내지 못했습니다. 잠시 뒤 다시 시도해 주세요.' }
  // "뉴스레터도 받기"를 고른 분에게만 구독 확인 메일을 따로 보낸다 (확인 링크를 눌러야 구독이 시작된다)
  if (wantsNewsletter) {
    const fd = new FormData()
    fd.set('email', email); fd.set('name', name); fd.set('agree', 'on')
    await subscribeNewsletter({}, fd).catch(() => null)
  }
  return { ok: true, newsletter: wantsNewsletter }
}

export async function readerLogout() {
  await clearReaderCookie()
}

// 댓글 쓰기 (항상 승인 대기: 편집국이 승인하면 보인다)
export async function postComment(articleId: string, body: string): Promise<{ ok?: boolean; live?: boolean; error?: string }> {
  const site = await currentSite()
  const en = site.lang === 'en'
  const reader = await getReader()
  if (!reader) return { error: en ? 'Please sign in first.' : '먼저 로그인해 주세요.' }
  const text = body.trim()
  if (!text) return { error: en ? 'Please write a comment.' : '댓글 내용을 적어 주세요.' }
  if (text.length > 1000) return { error: en ? 'Comments can be up to 1,000 characters.' : '댓글은 1,000자까지 쓸 수 있습니다.' }
  const { data, error } = await anonClient().rpc('comment_add', { secret: paymentDbSecret(), rid: reader.id, p_article: articleId, p_body: text, p_hold: screenComment(text) })
  if (error) return { error: en ? 'We could not save your comment. Please try again.' : '댓글을 저장하지 못했습니다. 다시 시도해 주세요.' }
  const map: Record<string, string> = en
    ? { banned: 'You can no longer post comments.', rate: 'You are posting too fast. Please wait a minute.', dup: 'You already posted this comment.', off: 'Comments are turned off.', closed: 'This story is not open for comments.' }
    : { banned: '더 이상 댓글을 쓸 수 없습니다.', rate: '너무 빨리 쓰고 있습니다. 잠시 뒤 다시 시도해 주세요.', dup: '이미 같은 댓글을 올렸습니다.', off: '댓글이 꺼져 있습니다.', closed: '댓글을 받지 않는 기사입니다.' }
  if (data !== 'ok' && data !== 'live') return { error: map[String(data)] ?? (en ? 'Could not post.' : '올리지 못했습니다.') }
  return { ok: true, live: data === 'live' }
}

// 신고: 로그인 독자는 독자 번호, 비회원은 접속 표시값으로 한 댓글에 한 번씩
export async function reportComment(commentId: string): Promise<{ ok?: boolean; error?: string }> {
  const site = await currentSite()
  const en = site.lang === 'en'
  let key: string
  if (site.commentsKind === 'guest') key = `ip:${await guestIpHash()}`
  else {
    const reader = await getReader()
    if (!reader) return { error: en ? 'Please sign in to report a comment.' : '신고하려면 로그인해 주세요.' }
    key = reader.id
  }
  const { error } = await anonClient().rpc('comment_report', { secret: paymentDbSecret(), p_key: key, p_comment: commentId })
  return error ? { error: en ? 'Could not report. Please try again.' : '신고하지 못했습니다. 다시 시도해 주세요.' } : { ok: true }
}

// ───────── 비회원(닉네임·비밀번호) 댓글 ─────────
export async function newCaptcha(): Promise<{ image: string; token: string }> {
  const { code, image } = makeCaptcha()
  return { image, token: signToken('captcha', { c: code }, 10 * 60) }
}

export async function postGuestComment(articleId: string, f: { name: string; password: string; body: string; captchaToken: string; captcha: string }): Promise<{ ok?: boolean; live?: boolean; error?: string }> {
  const site = await currentSite()
  const en = site.lang === 'en'
  if (!site.commentsOn || site.commentsKind !== 'guest') return { error: en ? 'Comments are not available.' : '댓글을 받지 않습니다.' }
  const name = f.name.trim()
  const text = f.body.trim()
  if (!name) return { error: en ? 'Please enter a nickname.' : '닉네임을 적어 주세요.' }
  if (name.length > 20) return { error: en ? 'Nicknames can be up to 20 characters.' : '닉네임은 20자까지 쓸 수 있습니다.' }
  if (f.password.length < 4 || f.password.length > 30) return { error: en ? 'Password must be 4–30 characters.' : '비밀번호는 4자 이상 30자 이하로 적어 주세요.' }
  if (!text) return { error: en ? 'Please write a comment.' : '댓글 내용을 적어 주세요.' }
  if (text.length > 500) return { error: en ? 'Comments can be up to 500 characters.' : '댓글은 500자까지 쓸 수 있습니다.' }
  const cap = readToken('captcha', f.captchaToken)
  if (!cap || cap.c !== f.captcha.trim().toUpperCase()) return { error: en ? 'The characters do not match. Please try again.' : '그림 속 문자가 맞지 않습니다. 다시 입력해 주세요.' }
  const { data, error } = await anonClient().rpc('comment_add_guest', {
    secret: paymentDbSecret(), p_article: articleId, p_name: name, p_pw: hashGuestPw(f.password), p_body: text,
    p_hold: screenComment(text), p_ip: await guestIpHash(),
  })
  if (error) return { error: en ? 'We could not save your comment. Please try again.' : '댓글을 저장하지 못했습니다. 다시 시도해 주세요.' }
  const map: Record<string, string> = en
    ? { banned: 'You can no longer post comments.', rate: 'You are posting too fast. Please wait a while.', dup: 'You already posted this comment.', off: 'Comments are turned off.', mode: 'Comments are not available.', closed: 'This story is not open for comments.' }
    : { banned: '더 이상 댓글을 쓸 수 없습니다.', rate: '너무 빨리 쓰고 있습니다. 잠시 뒤 다시 시도해 주세요.', dup: '이미 같은 댓글을 올렸습니다.', off: '댓글이 꺼져 있습니다.', mode: '댓글을 받지 않습니다.', closed: '댓글을 받지 않는 기사입니다.' }
  if (data !== 'ok' && data !== 'live') return { error: map[String(data)] ?? (en ? 'Could not post.' : '올리지 못했습니다.') }
  return { ok: true, live: data === 'live' }
}

// 비회원이 쓴 댓글은 비밀번호를 알면 지울 수 있다
export async function deleteGuestComment(commentId: string, password: string): Promise<{ ok?: boolean; error?: string }> {
  const site = await currentSite()
  const en = site.lang === 'en'
  const db = anonClient()
  const { data } = await db.rpc('comment_guest_hash', { secret: paymentDbSecret(), p_comment: commentId })
  if (typeof data !== 'string' || !checkGuestPw(password, data)) return { error: en ? 'The password does not match.' : '비밀번호가 맞지 않습니다.' }
  const { error } = await db.rpc('comment_guest_delete', { secret: paymentDbSecret(), p_comment: commentId })
  return error ? { error: en ? 'Could not delete. Please try again.' : '지우지 못했습니다. 다시 시도해 주세요.' } : { ok: true }
}

// 로그인한 독자가 뉴스레터도 받겠다고 할 때 (구독 확인 메일을 보낸다. 링크를 눌러야 구독 시작)
export async function subscribeReaderNewsletter(): Promise<{ ok?: boolean; error?: string }> {
  const site = await currentSite()
  const en = site.lang === 'en'
  const reader = await getReader()
  if (!reader) return { error: en ? 'Please sign in first.' : '먼저 로그인해 주세요.' }
  const { data: email } = await anonClient().rpc('reader_email', { secret: paymentDbSecret(), rid: reader.id })
  if (typeof email !== 'string') return { error: en ? 'Please sign in again.' : '다시 로그인해 주세요.' }
  const fd = new FormData()
  fd.set('email', email); fd.set('name', reader.name); fd.set('agree', 'on')
  const r = await subscribeNewsletter({}, fd)
  return r.error ? { error: r.error } : { ok: true }
}
