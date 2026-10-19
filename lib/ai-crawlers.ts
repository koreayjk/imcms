// AI 크롤러 설정: 매체별 robots.txt에 AI 회사 수집 봇 규칙을 넣는다
//   robots.txt는 "정중한 요청"이다. 규칙을 지키는 회사의 봇만 따르고, 이미 수집된 자료를 지우지는 못한다.
//   구글·네이버 검색 봇(Googlebot, Yeti)은 어느 쪽을 골라도 건드리지 않는다.

export type AiBotMode = 'allow' | 'answer' | 'block'

// 모델 학습·자료 수집용 봇
export const AI_TRAINING_BOTS = [
  'GPTBot', // OpenAI (학습)
  'ClaudeBot', // Anthropic (학습)
  'anthropic-ai', // Anthropic (예전 이름)
  'Google-Extended', // 구글 Gemini 학습·답변 근거 (구글 검색 노출과는 별개)
  'Applebot-Extended', // Apple AI 학습
  'CCBot', // Common Crawl (여러 AI가 이 자료를 씀)
  'Bytespider', // ByteDance
  'Meta-ExternalAgent', // Meta AI 학습
  'Amazonbot', // Amazon
  'cohere-ai', // Cohere
  'Diffbot',
  'Omgilibot',
  'ImagesiftBot',
] as const

// AI 검색·답변에서 출처로 보여 주거나, 사용자가 시킨 때 읽으러 오는 봇
export const AI_ANSWER_BOTS = [
  'OAI-SearchBot', // ChatGPT 검색
  'ChatGPT-User', // ChatGPT 사용자 요청
  'Claude-SearchBot', // Claude 검색
  'Claude-User', // Claude 사용자 요청
  'PerplexityBot', // Perplexity 검색
  'Perplexity-User',
  'DuckAssistBot', // DuckDuckGo AI 답변
  'MistralAI-User',
] as const

export const AI_BOT_MODES: { key: AiBotMode; label: string; hint: string }[] = [
  { key: 'allow', label: '모두 허용', hint: '지금처럼 아무 것도 막지 않습니다. AI가 기사를 학습에 쓰고, 답변에서 출처로 보여 줄 수도 있습니다.' },
  { key: 'answer', label: '학습용 수집은 막고, AI 검색·답변에 출처로 나오는 것은 허용 (권장)', hint: 'ChatGPT·Claude·Perplexity가 질문에 답하며 기사 링크를 보여 주는 것은 두고, 모델 학습용 대량 수집 봇만 막습니다.' },
  { key: 'block', label: 'AI 봇 모두 막기', hint: '위 두 종류를 모두 막습니다. AI 답변에 기사가 출처로 나오지 않을 수 있습니다.' },
]

export function parseAiBotMode(v: unknown): AiBotMode | undefined {
  return v === 'allow' || v === 'answer' || v === 'block' ? v : undefined
}

// robots.txt에 이어 붙일 줄. 'allow'(또는 미설정)면 아무것도 넣지 않는다.
export function aiBotRobotsLines(mode: AiBotMode | undefined): string[] {
  if (mode !== 'answer' && mode !== 'block') return []
  const bots: readonly string[] = mode === 'block' ? [...AI_TRAINING_BOTS, ...AI_ANSWER_BOTS] : AI_TRAINING_BOTS
  return [
    mode === 'block' ? '# AI 봇 전체 차단' : '# AI 모델 학습용 수집 차단 (AI 검색·답변 출처 표시는 허용)',
    ...bots.map((b) => `User-agent: ${b}`),
    'Disallow: /',
    '',
  ]
}
