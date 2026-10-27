// 편집국(관리 화면) 언어: 한국어 / English
//   정하는 순서: ① 내 정보에서 고른 언어(profiles.cms_lang) → ② 그 매체의 "편집국 언어"(홈페이지 설정, site.cmsLang) → ③ 한국어
//   쓰는 법: 글자마다 한국어 원문과 영어를 함께 적는다  t('기사쓰기', 'Write')
//     · 서버 화면: const { t } = await getT()            (lib/cms-t.ts)
//     · 클라이언트 컴포넌트: const t = useT()            (components/cms/CmsLang.tsx)
//     · 영어에서 숫자·날짜는 en-US 방식 (formatDate 등에 lang 'en' 을 넘긴다)
export type CmsLang = 'ko' | 'en'
export const parseCmsLang = (v: unknown): CmsLang | null => (v === 'en' ? 'en' : v === 'ko' ? 'ko' : null)
export type T = (ko: string, en: string) => string
export const makeT = (lang: CmsLang): T => (ko, en) => (lang === 'en' ? en : ko)
