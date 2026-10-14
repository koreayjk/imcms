import type { OutletSiteSettings } from './sites'

// AI 활용 표시 (기사 작성 가이드 · 네이버 뉴스제휴 운영평가 D항)
//   매체 설정(홈페이지 설정 → AI 활용 표시)을 켜면 AI 초안·AI로 다시 쓴 함께 송고 기사 본문 끝에 한 문단을 붙인다
//   문단 모양: <p><em>※ 문구</em></p> — 함께 송고 때 AI가 이 문단은 고쳐 쓰지 않는다

export const AI_NOTICE_DEFAULT = {
  ko: '이 기사는 AI의 도움을 받아 작성했으며, 기자가 사실관계를 확인했습니다.',
  en: 'This article was produced with the help of AI and reviewed by our editors.',
} as const

export type AiNoticeSetting = { on: boolean; text?: string }

// 켜져 있으면 붙일 문구, 꺼져 있으면 null
export function aiNoticeText(site: OutletSiteSettings | null | undefined): string | null {
  const n = site?.aiNotice
  if (!n?.on) return null
  return n.text?.trim() || AI_NOTICE_DEFAULT[site?.lang === 'en' ? 'en' : 'ko']
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

// <p> 안쪽 html 이 AI 활용 표시 문단인지
const AI_WORD = /AI|인공지능|artificial intelligence/i
export const isAiNoticeInner = (inner: string) => /^\s*<em>\s*※/.test(inner) && AI_WORD.test(inner)
// 직접 정한 문구에도 AI 를 가리키는 말이 있어야 표시 문단으로 알아본다
export const mentionsAi = (text: string) => AI_WORD.test(text)

const NOTICE_P = /<p[^>]*>\s*<em>\s*※[^<]*(?:AI|인공지능|[Aa]rtificial [Ii]ntelligence)[^<]*<\/em>\s*<\/p>/g

export const hasAiNotice = (html: string) => new RegExp(NOTICE_P.source).test(html)

// 본문 끝에 표시 문단을 붙인다 (이미 있으면 바꾼다)
export function withAiNotice(html: string, text: string) {
  return `${html.replace(NOTICE_P, '').trimEnd()}<p><em>※ ${esc(text)}</em></p>`
}
