import { cookies, headers } from 'next/headers'
import { makeT, parseCmsLang, type CmsLang, type T } from './cms-i18n'

// 로그인 전 화면(로그인·가입·비밀번호 찾기·체험 신청)의 언어
//   ① 화면 위 "English / 한국어" 단추로 고른 값(쿠키 im_lang) → ② 브라우저 언어(한국어가 하나도 없고 영어가 있으면 English) → ③ 한국어
export const LANG_COOKIE = 'im_lang'

export async function getPublicLang(): Promise<CmsLang> {
  const picked = parseCmsLang((await cookies()).get(LANG_COOKIE)?.value)
  if (picked) return picked
  const al = ((await headers()).get('accept-language') ?? '').toLowerCase()
  return al.includes('ko') ? 'ko' : /(^|[,;\s])en/.test(al) ? 'en' : 'ko'
}

// 서버 화면·서버 함수에서: const { t, lang } = await getPublicT()
export async function getPublicT(): Promise<{ t: T; lang: CmsLang }> {
  const lang = await getPublicLang()
  return { t: makeT(lang), lang }
}
