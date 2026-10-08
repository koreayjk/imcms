// 업무요청 AI 첫 답변: 화면과 서버가 함께 쓰는 이름표·주소 (서버 전용 코드를 화면에 싣지 않으려고 따로 둔다)

export type SupportKind = 'howto' | 'design' | 'bug' | 'billing' | 'account' | 'feature' | 'other'

export const SUPPORT_KIND_LABEL: Record<SupportKind, string> = {
  howto: '사용법', design: '디자인·홈페이지', bug: '오류', billing: '요금·결제', account: '계정', feature: '새 기능', other: '기타',
}

// 답변에 넣어도 되는 편집국 주소 (화면에서 눌러 이동할 수 있게 바꾼다)
export const SUPPORT_LINKS: Record<string, string> = {
  '/newsroom': '뉴스룸', '/articles/new': '기사쓰기', '/articles': '기사목록', '/press': '보도자료함', '/press/new': '보도자료 직접 등록',
  '/press/email': '메일로 보도자료 받기', '/admin/home': '홈편집', '/admin/categories': '섹션', '/admin/ads': '광고 배너',
  '/admin/ads/contracts': '광고 계약', '/admin/newsletter': '뉴스레터', '/admin/users': '회원', '/admin/outlets': '매체',
  '/admin/export': '자료 내보내기', '/admin/settings': '설정·AI', '/account': '내 정보', '/support': '고객센터',
  '/support/tickets/new': '업무요청 쓰기', '/support/notices': '공지', '/support/help': '이용안내', '/support/invoices': '청구서',
  '/support/billing': '결제 정보', '/feedback': '개선 요청',
}
