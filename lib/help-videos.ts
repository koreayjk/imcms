// 고객센터 → 이용안내 "영상으로 배우기" 목록. 유튜브에 올린 뒤 youtube 칸에 주소(또는 영상 번호)를 붙여 넣으면 이용안내에 바로 나온다
//   youtube 가 비어 있는 영상은 아직 올리기 전이라 화면에 나오지 않는다. 순서가 곧 화면 순서(처음 쓰는 사람이 먼저 해야 할 일 순)
export type HelpVideo = {
  id: string
  title: string
  desc: string
  // 유튜브 주소(youtu.be/…, youtube.com/watch?v=…) 또는 11자리 영상 번호
  youtube?: string
  // 영상 설명 아래에 걸어 줄 편집국 화면
  link?: { label: string; href: string }
}

export const HELP_VIDEOS: HelpVideo[] = [
  { id: 'start', title: '처음 시작하기: 로그인과 화면 둘러보기', desc: '초대 메일로 가입하고 로그인한 뒤, 편집국 메뉴가 무엇인지 한 번에 훑어봅니다.', youtube: 'U7h_uSZf1Jg', link: { label: '뉴스룸으로', href: '/newsroom' } },
  { id: 'security', title: '내 정보와 보안: 비밀번호·2단계 인증', desc: '이름 바꾸기, 비밀번호 바꾸기, 2단계 인증(인증 앱) 켜는 방법입니다.', youtube: 'NRgUmOFRpAI', link: { label: '내 정보', href: '/account' } },
  { id: 'members', title: '기자·편집장 초대하고 직급 정하기', desc: '새 기자를 초대하고, 승인하고, 기자·편집장 직급을 정하는 방법입니다.', youtube: '6Kgk4xIuqpU', link: { label: '회원 관리', href: '/admin/users' } },
  { id: 'write', title: '기사 쓰고 승인신청·발행하기', desc: '기사쓰기 → 저장 → 승인신청 → 편집장 발행까지의 기본 흐름입니다.', youtube: 't8t-SgKtW7Y', link: { label: '기사쓰기', href: '/articles/new' } },
  { id: 'press', title: '보도자료로 기사 만들기 (AI 초안·법적 검수)', desc: '보도자료함에서 AI 초안을 만들고, 발행 전 법적 검수를 받는 방법입니다.', youtube: 'sRRRRIm1P8Y', link: { label: '보도자료함', href: '/press' } },
  { id: 'guide', title: '발행 전에 꼭 볼 것: 기사 작성 가이드 핵심', desc: '네이버 뉴스제휴 평가 기준에 맞춘 제목·바이라인·사진 출처 규칙을 짚어 봅니다.', youtube: '81CcaV6wdyw', link: { label: '작성 가이드', href: '/support/guide' } },
  { id: 'photos', title: '기사에 사진 넣고 저장 파일 쓰기', desc: '사진을 올리고, 설명을 달고, 저장 파일에서 다시 가져다 쓰는 방법입니다.', youtube: 'eJzR1GVs_2I', link: { label: '저장 파일', href: '/media' } },
  { id: 'approve', title: '편집장: 승인·반려와 일괄 승인', desc: '승인신청된 기사를 확인하고 한꺼번에 발행하거나 반려하는 방법입니다.', youtube: 'mijfdXVCkZM', link: { label: '기사목록', href: '/articles' } },
  { id: 'home', title: '홈 편집으로 첫 화면 배치하기', desc: '헤드라인·톱·주요 기사 자리를 직접 정하는 방법입니다.', youtube: 'TlujxxKRqss', link: { label: '홈편집', href: '/admin/home' } },
  { id: 'sections', title: '섹션(메뉴) 정리하기', desc: '섹션을 만들고 순서를 바꾸고, 하위 섹션을 묶는 방법입니다.', youtube: 'AtQUzJoWYI4', link: { label: '섹션', href: '/admin/categories' } },
  { id: 'ads', title: '첫 화면 광고 올리기와 예약 광고', desc: '배너 광고를 올리고, 기간을 정해 예약 광고를 거는 방법입니다.', youtube: '8RJupy37b2I', link: { label: '광고', href: '/admin/ads' } },
  { id: 'billing', title: '청구서 확인과 카드 등록(자동결제)', desc: '청구서를 보고 결제하고, 카드를 등록해 자동으로 결제되게 하는 방법입니다.', youtube: 'HKvkspHjPXo', link: { label: '결제 정보', href: '/support/billing' } },
  { id: 'newsletter', title: '뉴스레터 보내기', desc: '구독자에게 기사 모음을 메일로 보내는 방법입니다.', youtube: 'S1XK6JAM49o', link: { label: '뉴스레터', href: '/admin/newsletter' } },
  { id: 'support', title: '업무요청과 고객센터 이용하기', desc: '수정이나 문의를 업무요청으로 남기고, 답변과 공지를 확인하는 방법입니다.', youtube: 'HXyETgJWYBE', link: { label: '업무요청', href: '/support/tickets/new' } },
]

// 주소에서 11자리 영상 번호를 뽑는다 (모르는 모양이면 null)
export function youtubeId(input: string | undefined | null): string | null {
  const s = (input ?? '').trim()
  if (!s) return null
  if (/^[A-Za-z0-9_-]{11}$/.test(s)) return s
  try {
    const u = new URL(s)
    const host = u.hostname.replace(/^www\./, '').replace(/^m\./, '')
    if (host === 'youtu.be') return /^[A-Za-z0-9_-]{11}$/.test(u.pathname.slice(1, 12)) ? u.pathname.slice(1, 12) : null
    if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
      const v = u.searchParams.get('v')
      if (v && /^[A-Za-z0-9_-]{11}$/.test(v)) return v
      const m = u.pathname.match(/^\/(?:embed|shorts|live)\/([A-Za-z0-9_-]{11})/)
      if (m) return m[1]
    }
  } catch { /* 주소가 아님 */ }
  return null
}

export const readyVideos = () => HELP_VIDEOS.flatMap((v) => { const id = youtubeId(v.youtube); return id ? [{ ...v, videoId: id }] : [] })
