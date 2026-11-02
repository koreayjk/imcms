// 서비스 신청서의 "기존 사이트 이전·연동 확인" 질문
//   신청 단계에서 미리 물어 두면, 개통·이전 때 필요한 정보(기사 백업, 도메인 관리, 소유 확인, 네이버 제휴 등)를
//   처음부터 알 수 있어 업체(ND소프트 등)에 보낼 문의를 정확히 쓸 수 있다.
//   모든 질문은 필수이고, 잘 모르면 "모르겠음"(새로 창간이면 "해당 없음")을 골라 바로 넘어갈 수 있다.
//   저장 칸을 따로 만들지 않고 신청서 요청사항 맨 앞에 적어 운영팀이 고객 상담 화면에서 바로 본다.
// forNew: 창간 준비 중인 신청자에게도 묻는 질문 (나머지는 이미 운영 중인 사이트가 있어야 의미가 있어서 가린다)
export type ApplyQuestion = { key: string; label: string; hint?: string; options: string[]; multi?: boolean; forNew?: boolean }

export const NEW_OUTLET = '창간 준비 중'
// 창간 준비 중이면서 도메인 칸이 비어 있으면(도메인이 아직 없음) 도메인 관리 질문도 필요 없다
export const questionsFor = (isNew: boolean, hasDomain = true) =>
  MIGRATION_QUESTIONS.filter((q) => !isNew || (q.forNew && (q.key !== 'q_domain' || hasDomain)))

export const MIGRATION_QUESTIONS: ApplyQuestion[] = [
  {
    key: 'q_contract',
    label: '지금 서비스 계약 만료일',
    hint: '지금 쓰는 업체(ND소프트 등)와의 계약이 언제까지인가요? 이전 일정을 잡는 데 필요합니다.',
    options: ['1개월 안에 끝남', '1~3개월 뒤 끝남', '3개월 이상 남음', '이미 끝났거나 해지함', '모르겠음', '해당 없음 (새로 창간)'],
  },
  {
    key: 'q_domain',
    forNew: true,
    label: '도메인 관리',
    hint: '도메인을 어디서 샀고 누가 관리하나요?',
    options: ['직접 관리 (가비아·후이즈 등)', '지금 업체가 대행해 줌', '아직 도메인이 없음', '모르겠음'],
  },
  {
    key: 'q_mail',
    label: '도메인 메일 사용',
    hint: '@내도메인 형태의 메일을 쓰나요? (전환할 때 메일 설정을 건드리지 않기 위해 필요합니다)',
    options: ['@도메인 메일을 쓰고 있음', '네이버·다음·지메일 등만 씀', '메일은 쓰지 않음', '모르겠음'],
  },
  {
    key: 'q_search',
    label: '구글 서치콘솔·네이버 서치어드바이저',
    hint: '검색 등록 계정에 직접 로그인할 수 있나요?',
    options: ['둘 다 직접 로그인할 수 있음', '구글만 가능', '네이버만 가능', '업체가 대신 등록해서 로그인하지 못함', '등록한 적 없음', '모르겠음'],
  },
  {
    key: 'q_naver',
    label: '네이버 뉴스 제휴',
    hint: '뉴스스탠드·뉴스검색 제휴 매체인가요? (제휴 매체는 전환 전에 네이버에 전송 주소를 알려야 합니다)',
    options: ['뉴스스탠드 제휴', '뉴스검색 제휴', '제휴 아님', '신청·심사 준비 중', '모르겠음'],
  },
  {
    key: 'q_features',
    label: '지금 쓰고 있고 꼭 필요한 기능',
    hint: '해당하는 것을 모두 고르세요. 없으면 “필요한 기능 없음”, 모르면 “모르겠음”.',
    multi: true,
    options: ['독자 회원가입', '댓글', '광고 배너', '뉴스레터', '영상·방송', '그 밖의 기능 (요청사항에 적을게요)', '필요한 기능 없음', '모르겠음'],
  },
  {
    key: 'q_brand',
    forNew: true,
    label: '로고 · 대표 색 · 광고 배너 위치 자료',
    hint: '홈페이지를 지금 모습대로 맞추려면 필요합니다.',
    options: ['지금 전달할 수 있음', '상담할 때 전달하겠음', '로고 제작이 필요함', '모르겠음'],
  },
]

// 신청서에서 받은 값을 확인하고, 요청사항 맨 앞에 붙일 글을 만든다
export function parseMigrationAnswers(form: FormData): { error?: string; block?: string } {
  const isNew = String(form.get('outlet_count') ?? '') === NEW_OUTLET
  const hasDomain = String(form.get('domain') ?? '').trim() !== ''
  const lines: string[] = isNew ? [`(창간 준비 중: 기존 사이트 관련 질문은 건너뜀${hasDomain ? '' : ', 도메인 칸이 비어 있어 도메인 관리 질문도 건너뜀'})`] : []
  for (const q of questionsFor(isNew, hasDomain)) {
    if (q.multi) {
      const picked = form.getAll(q.key).map(String).filter((v) => q.options.includes(v))
      if (!picked.length) return { error: `“${q.label}”에서 하나 이상 골라 주세요. 잘 모르겠으면 “모르겠음”을 고르세요.` }
      lines.push(`${q.label}: ${Array.from(new Set(picked)).join(', ')}`)
    } else {
      const v = String(form.get(q.key) ?? '')
      if (!q.options.includes(v)) return { error: `“${q.label}”을 골라 주세요. 잘 모르겠으면 “모르겠음”을 고르세요.` }
      lines.push(`${q.label}: ${v}`)
    }
  }
  return { block: `[이전·연동 확인]\n${lines.join('\n')}` }
}
