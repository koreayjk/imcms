import Anthropic from '@anthropic-ai/sdk'

export type AiDraft = {
  title: string
  subtitle: string
  paragraphs: string[]
  review_notes: string[]
}

// ───────── 쓸 수 있는 모델과 가격 (100만 토큰당 달러, 비용 표시용) ─────────
export type AiProvider = 'anthropic' | 'gemini'
export type AiModel = { id: string; label: string; provider: AiProvider; input: number; output: number; note?: string }

export const AI_MODELS: AiModel[] = [
  { id: 'claude-opus-5-5', label: 'Claude Opus 5.5', provider: 'anthropic', input: 4, output: 20 },
  { id: 'claude-sonnet-5-5', label: 'Claude Sonnet 5.5', provider: 'anthropic', input: 2, output: 10 },
  // 2026년 말까지 할인가 (2027년부터 $1.50 / $7.50)
  { id: 'gemini-3.8-flash', label: 'Gemini 3.8 Flash', provider: 'gemini', input: 0.75, output: 3.75, note: '2027년부터 입력 $1.50 / 출력 $7.50' },
  { id: 'gemini-3.5-flash-lite', label: 'Gemini 3.5 Flash-Lite', provider: 'gemini', input: 0.3, output: 2.5 },
]

const KEY: Record<AiProvider, string> = { anthropic: 'ANTHROPIC_API_KEY', gemini: 'GEMINI_API_KEY' }
export const providerReady = (p: AiProvider) => !!process.env[KEY[p]]

// 실제로 쓰는 모델: Vercel 환경 변수 AI_MODEL (없으면 키가 있는 쪽의 기본 모델)
export function activeModel(): AiModel | null {
  const chosen = AI_MODELS.find((m) => m.id === process.env.AI_MODEL)
  if (chosen && providerReady(chosen.provider)) return chosen
  if (providerReady('anthropic')) return AI_MODELS[0]
  if (providerReady('gemini')) return AI_MODELS.find((m) => m.id === 'gemini-3.8-flash')!
  return null
}

export const aiReady = () => activeModel() !== null

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

// 제미나이는 additionalProperties를 받지 않을 수 있어 뺀 사본을 쓴다
const { additionalProperties: _omit, ...GEMINI_SCHEMA } = SCHEMA

export class AiDraftError extends Error {}

export type DraftInput = { title: string; text: string; source: string }
export type DraftResult = { draft: AiDraft; model: AiModel; ms: number; inputTokens: number; outputTokens: number; costUsd: number }

function userPrompt(input: DraftInput) {
  return `출처: ${input.source}\n\n<보도자료 제목>\n${input.title}\n</보도자료 제목>\n\n<보도자료 본문>\n${input.text}\n</보도자료 본문>`
}

function parseDraft(text: string | undefined): AiDraft {
  if (!text) throw new AiDraftError('AI 응답이 비어 있습니다. 다시 시도해 주세요.')
  try {
    const d = JSON.parse(text) as AiDraft
    if (!d.title || !d.paragraphs?.length) throw new Error('empty')
    return { title: d.title, subtitle: d.subtitle ?? '', paragraphs: d.paragraphs, review_notes: d.review_notes ?? [] }
  } catch {
    throw new AiDraftError('AI 응답을 읽지 못했습니다. 다시 시도해 주세요.')
  }
}

async function withAnthropic(model: AiModel, input: DraftInput) {
  const client = new Anthropic({ timeout: 50_000, maxRetries: 1 })
  let response: Anthropic.Beta.BetaMessage
  try {
    response = await client.beta.messages.create({
      model: model.id,
      max_tokens: 16000,
      // 보도자료 재작성은 난도가 낮고 서버리스 시간 제한(60초)이 있어 낮은 effort로 빠르게 받는다
      output_config: { effort: 'low', format: { type: 'json_schema', schema: SCHEMA } },
      // 안전 필터가 거절하면 서버가 알맞은 모델로 다시 시도한다
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      system: SYSTEM,
      messages: [{ role: 'user', content: userPrompt(input) }],
    })
  } catch (e) {
    if (e instanceof Anthropic.AuthenticationError) throw new AiDraftError('AI 키가 올바르지 않습니다. ANTHROPIC_API_KEY를 확인해 주세요.')
    if (e instanceof Anthropic.RateLimitError) throw new AiDraftError('AI 요청이 몰려 잠시 제한되었습니다. 1분 뒤 다시 시도해 주세요.')
    if (e instanceof Anthropic.APIConnectionTimeoutError) throw new AiDraftError('AI 응답이 늦어 시간을 초과했습니다. 다시 시도하거나 원문 그대로 기사로 만들어 주세요.')
    if (e instanceof Anthropic.APIError) throw new AiDraftError(`AI 요청이 실패했습니다 (${e.status ?? '연결 오류'}).`)
    throw e
  }
  if (response.stop_reason === 'refusal') throw new AiDraftError('AI가 이 보도자료의 기사화를 거절했습니다. 원문 그대로 기사로 만든 뒤 직접 다듬어 주세요.')
  if (response.stop_reason === 'max_tokens') throw new AiDraftError('보도자료가 너무 길어 초안이 중간에 끊겼습니다. 원문 그대로 기사로 만들어 주세요.')
  const text = response.content.find((b): b is Anthropic.Beta.BetaTextBlock => b.type === 'text')?.text
  return { draft: parseDraft(text), inputTokens: response.usage.input_tokens, outputTokens: response.usage.output_tokens }
}

// 제미나이: 공식 REST generateContent (구조화 출력 = generationConfig.responseFormat.text)
async function withGemini(model: AiModel, input: DraftInput) {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), 50_000)
  let res: Response
  try {
    res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model.id}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY! },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: SYSTEM }] },
        contents: [{ role: 'user', parts: [{ text: userPrompt(input) }] }],
        generationConfig: {
          thinkingConfig: { thinkingLevel: 'low' },
          responseFormat: { text: { mimeType: 'application/json', schema: GEMINI_SCHEMA } },
        },
      }),
      signal: ctrl.signal,
      cache: 'no-store',
    })
  } catch (e) {
    if (e instanceof Error && e.name === 'AbortError') throw new AiDraftError('AI 응답이 늦어 시간을 초과했습니다. 다시 시도해 주세요.')
    throw new AiDraftError('제미나이에 연결하지 못했습니다.')
  } finally {
    clearTimeout(timer)
  }
  const body = (await res.json().catch(() => null)) as any
  if (!res.ok) {
    if (res.status === 400 && /API key/i.test(body?.error?.message ?? '')) throw new AiDraftError('제미나이 키가 올바르지 않습니다. GEMINI_API_KEY를 확인해 주세요.')
    if (res.status === 429) throw new AiDraftError('제미나이 요청이 몰려 잠시 제한되었습니다. 1분 뒤 다시 시도해 주세요.')
    throw new AiDraftError(`제미나이 요청이 실패했습니다 (${res.status}${body?.error?.message ? `: ${String(body.error.message).slice(0, 120)}` : ''}).`)
  }
  const cand = body?.candidates?.[0]
  if (cand?.finishReason === 'MAX_TOKENS') throw new AiDraftError('보도자료가 너무 길어 초안이 중간에 끊겼습니다.')
  if (cand?.finishReason && !['STOP', 'FINISH_REASON_UNSPECIFIED'].includes(cand.finishReason)) {
    throw new AiDraftError(`제미나이가 이 보도자료의 기사화를 멈췄습니다 (${cand.finishReason}).`)
  }
  // 생각(thought) 부분은 빼고 답만
  const text = (cand?.content?.parts ?? []).filter((p: any) => !p.thought && typeof p.text === 'string').map((p: any) => p.text).join('')
  const u = body?.usageMetadata ?? {}
  return {
    draft: parseDraft(text),
    inputTokens: Number(u.promptTokenCount ?? 0),
    outputTokens: Number(u.candidatesTokenCount ?? 0) + Number(u.thoughtsTokenCount ?? 0),
  }
}

export async function draftWithModel(modelId: string, input: DraftInput): Promise<DraftResult> {
  const model = AI_MODELS.find((m) => m.id === modelId)
  if (!model) throw new AiDraftError('알 수 없는 AI 모델입니다.')
  if (!providerReady(model.provider)) throw new AiDraftError(`${model.label}을(를) 쓰려면 ${KEY[model.provider]}를 설정해야 합니다.`)
  const started = Date.now()
  const r = model.provider === 'gemini' ? await withGemini(model, input) : await withAnthropic(model, input)
  const costUsd = (r.inputTokens * model.input + r.outputTokens * model.output) / 1_000_000
  return { ...r, model, ms: Date.now() - started, costUsd }
}

export async function draftFromPressRelease(input: DraftInput): Promise<AiDraft> {
  const model = activeModel()
  if (!model) throw new AiDraftError('AI 기능이 아직 설정되지 않았습니다. 관리자에게 AI 키(ANTHROPIC_API_KEY 또는 GEMINI_API_KEY) 설정을 요청하세요.')
  return (await draftWithModel(model.id, input)).draft
}
