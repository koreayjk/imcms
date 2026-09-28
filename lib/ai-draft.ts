import Anthropic from '@anthropic-ai/sdk'

export type AiDraft = {
  title: string
  subtitle: string
  paragraphs: string[]
  review_notes: string[]
}

export const aiReady = () => !!process.env.ANTHROPIC_API_KEY

// 고정된 지시문 — 요청마다 바뀌지 않아야 캐시가 된다
const SYSTEM = `당신은 한국 인터넷신문의 편집 기자입니다. 기업·기관이 배포한 보도자료를 받아 그대로 옮기지 않고 스트레이트 기사 초안으로 다시 씁니다.

원칙
- 보도자료에 있는 사실만 씁니다. 원문에 없는 숫자, 날짜, 인물, 인용문, 배경 설명을 만들지 않습니다.
- 인용문은 원문 표현을 그대로 쓰되, 발언자 이름과 직함을 원문대로 붙입니다.
- 홍보성 수식어(최고의, 획기적인, 업계 최초 등 근거가 없는 표현)는 빼거나 "○○는 ~라고 밝혔다"처럼 주체를 밝혀 씁니다.
- 기사체로 씁니다: 3인칭, "~했다", "~밝혔다", "~할 예정이다". 존댓말과 "~습니다"체는 쓰지 않습니다.
- 역피라미드 구조: 첫 문단에 누가·언제·무엇을·왜를 담고, 뒤로 갈수록 세부 내용을 둡니다.
- 문의처, 연락처, 이메일, 웹사이트 주소, "○○ 소개" 같은 회사 소개 단락은 본문에서 뺍니다.
- 날짜는 원문에 적힌 대로 씁니다. 요일이나 연도를 추측해 덧붙이지 않습니다.

형식
- title: 기사 제목. 핵심만 담아 40자 안팎. 따옴표 인용은 꼭 필요할 때만.
- subtitle: 부제목. 제목을 보완하는 한두 문장, 줄바꿈으로 구분 가능.
- paragraphs: 본문 문단 배열. 4~8개 문단, 문단마다 2~4문장. 바이라인([매체=기자])은 넣지 않습니다.
- review_notes: 기자가 발행 전에 확인해야 할 점. 원문이 모호하거나 과장이 의심되는 주장, 확인이 필요한 수치, 원문과 제목의 강조점이 달라진 부분 등. 없으면 빈 배열.`

const SCHEMA = {
  type: 'object',
  properties: {
    title: { type: 'string' },
    subtitle: { type: 'string' },
    paragraphs: { type: 'array', items: { type: 'string' } },
    review_notes: { type: 'array', items: { type: 'string' } },
  },
  required: ['title', 'subtitle', 'paragraphs', 'review_notes'],
  additionalProperties: false,
} as const

export class AiDraftError extends Error {}

export async function draftFromPressRelease(input: { title: string; text: string; source: string }): Promise<AiDraft> {
  if (!aiReady()) throw new AiDraftError('AI 기능이 아직 설정되지 않았습니다. 관리자에게 ANTHROPIC_API_KEY 설정을 요청하세요.')

  const client = new Anthropic({ timeout: 50_000, maxRetries: 1 })
  let response: Anthropic.Beta.BetaMessage
  try {
    response = await client.beta.messages.create({
      model: 'claude-opus-5-5',
      max_tokens: 16000,
      // 보도자료 재작성은 난도가 낮고 서버리스 시간 제한(60초)이 있어 낮은 effort로 빠르게 받는다
      output_config: { effort: 'low', format: { type: 'json_schema', schema: SCHEMA } },
      // 안전 필터가 거절하면 서버가 알맞은 모델로 다시 시도한다
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      system: SYSTEM,
      messages: [
        {
          role: 'user',
          content: `출처: ${input.source}\n\n<보도자료 제목>\n${input.title}\n</보도자료 제목>\n\n<보도자료 본문>\n${input.text}\n</보도자료 본문>`,
        },
      ],
    })
  } catch (e) {
    if (e instanceof Anthropic.AuthenticationError) throw new AiDraftError('AI 키가 올바르지 않습니다. ANTHROPIC_API_KEY를 확인해 주세요.')
    if (e instanceof Anthropic.RateLimitError) throw new AiDraftError('AI 요청이 몰려 잠시 제한되었습니다. 1분 뒤 다시 시도해 주세요.')
    if (e instanceof Anthropic.APIConnectionTimeoutError) throw new AiDraftError('AI 응답이 늦어 시간을 초과했습니다. 다시 시도하거나 원문 그대로 기사로 만들어 주세요.')
    if (e instanceof Anthropic.APIError) throw new AiDraftError(`AI 요청이 실패했습니다 (${e.status ?? '연결 오류'}).`)
    throw e
  }

  if (response.stop_reason === 'refusal') {
    throw new AiDraftError('AI가 이 보도자료의 기사화를 거절했습니다. 원문 그대로 기사로 만든 뒤 직접 다듬어 주세요.')
  }
  if (response.stop_reason === 'max_tokens') {
    throw new AiDraftError('보도자료가 너무 길어 초안이 중간에 끊겼습니다. 원문 그대로 기사로 만들어 주세요.')
  }

  const text = response.content.find((b): b is Anthropic.Beta.BetaTextBlock => b.type === 'text')?.text
  if (!text) throw new AiDraftError('AI 응답이 비어 있습니다. 다시 시도해 주세요.')
  try {
    const d = JSON.parse(text) as AiDraft
    if (!d.title || !d.paragraphs?.length) throw new Error('empty')
    return d
  } catch {
    throw new AiDraftError('AI 응답을 읽지 못했습니다. 다시 시도해 주세요.')
  }
}
