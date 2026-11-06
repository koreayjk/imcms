// 기사 맨 위 "구글에서 선호 매체로 추가" 버튼: 구글 검색의 "선호하는 소스" 설정 화면으로 보낸다 (그 도메인이 미리 검색돼 있다).
//   누른 독자의 구글 검색에서 이 매체 기사가 '주요 뉴스'에 더 자주 나오게 하는 설정이라, 독자에게 한 번 알리는 용도다
type Props = { host: string; lang?: 'ko' | 'en' }

export default function GooglePreferredSource({ host, lang = 'ko' }: Props) {
  const en = lang === 'en'
  return (
    <a
      href={`https://www.google.com/preferences/source?q=${encodeURIComponent(host)}`}
      target="_blank"
      rel="noopener"
      className="group inline-flex items-center gap-2 rounded-full border border-rule bg-white py-1 pl-1.5 pr-3 text-[12.5px] font-semibold text-body shadow-[0_1px_0_rgba(0,0,0,.03)] transition hover:-translate-y-px hover:border-brand hover:shadow-[0_3px_10px_rgba(0,0,0,.08)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
      title={en ? 'Opens Google Search settings in a new tab' : '구글 검색 설정이 새 창으로 열립니다'}
    >
      <span className="grid h-6 w-6 place-items-center rounded-full bg-[#F4F6FA]" aria-hidden>
        <svg viewBox="0 0 48 48" width="14" height="14">
          <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
          <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
          <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
          <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
        </svg>
      </span>
      <span>{en ? 'Prefer us on Google' : '구글에서 우리 매체 먼저 보기'}</span>
      <svg viewBox="0 0 24 24" width="14" height="14" className="text-[#E8A317] transition-transform duration-200 group-hover:scale-125 group-hover:rotate-12" aria-hidden>
        <path fill="currentColor" d="M12 2.5l2.9 5.9 6.5.9-4.7 4.6 1.1 6.5L12 17.3l-5.8 3.1 1.1-6.5L2.6 9.3l6.5-.9z" />
      </svg>
    </a>
  )
}
