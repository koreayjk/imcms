import Anthropic from '@anthropic-ai/sdk'
import type { ForeignTopic } from './press-sources'

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

// 실제로 쓰는 모델: Vercel 환경 변수 AI_MODEL (없으면 Gemini Flash, Gemini 키가 없을 때만 Claude)
export function activeModel(): AiModel | null {
  const chosen = AI_MODELS.find((m) => m.id === process.env.AI_MODEL)
  if (chosen && providerReady(chosen.provider)) return chosen
  if (providerReady('gemini')) return AI_MODELS.find((m) => m.id === 'gemini-3.8-flash')!
  if (providerReady('anthropic')) return AI_MODELS[0]
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
- "이 기사는 ○○에서 배포한 보도자료를 바탕으로 작성됐습니다" 같은 출처·작성 경위 문장은 쓰지 않습니다.

형식
- title: 기사 제목. 핵심만 담아 40자 안팎. 따옴표 인용은 꼭 필요할 때만.
- subtitle: 부제목. 제목을 보완하는 한두 문장, 줄바꿈으로 구분 가능.
- paragraphs: 본문 문단 배열. 4~8개 문단, 문단마다 2~4문장. 바이라인([매체=기자])은 넣지 않습니다.
- review_notes: 기자가 발행 전에 확인해야 할 점. 원문이 모호하거나 과장이 의심되는 주장, 확인이 필요한 수치, 원문과 제목의 강조점이 달라진 부분 등. 없으면 빈 배열.`

// 해외 언론(영문) 기사 → 한국 독자용 기사 (번역이 아니라 사실만 골라 새로 쓰고, 출처 매체를 본문에 밝힌다)
//   매체 분야(해외 언론 묶음)마다 독자와 주의할 점이 다르다
const FOREIGN_AUDIENCE: Record<ForeignTopic, { reader: string; example: string; extra: string }> = {
  israel: {
    reader: '한국 독자(특히 이스라엘과 성경에 관심 있는 한국 그리스도인)',
    example: '"예루살렘포스트에 따르면", "~라고 와이넷이 보도했다"',
    extra: '- 전쟁·분쟁·정치 사안은 주장마다 주체를 밝힙니다(예: "이스라엘군은 ~라고 주장했다"). 한쪽을 일방적으로 편들거나 혐오하는 표현을 쓰지 않습니다.',
  },
  education: {
    reader: '한국 독자(특히 자녀 교육·입시·해외 유학에 관심 있는 학부모와 학생, 교사·교육 관계자)',
    example: '"인사이드하이어에드에 따르면", "~라고 더파이뉴스가 보도했다"',
    extra: [
      '- 미국 등 해외 교육 제도·용어는 처음 나올 때 짧게 풀어 씁니다(예: K-12(유치원~고교 12학년), 커뮤니티칼리지(2년제 공립대), OPT(졸업 후 현장실습 취업 허가)).',
      '- 학비·장학금 등 금액은 원문 통화 그대로 쓰고 원화로 환산하지 않습니다. 비자·이민 제도는 원문 시점 기준임을 밝히고 단정하지 않습니다.',
      '- 한국 학생·학부모에게 의미가 있는 부분(유학생 수, 비자, 입시·학비 변화 등)이 원문에 있으면 앞쪽에 둡니다. 원문에 없는 한국 관련 내용은 만들지 않습니다.',
      '- 정책 논쟁은 주장마다 주체를 밝히고(예: "교육부는 ~라고 밝혔다", "비판론자들은 ~라고 지적했다") 한쪽을 편들지 않습니다.',
    ].join('\n'),
  },
}

function foreignSystem(topic: ForeignTopic = 'israel') {
  const a = FOREIGN_AUDIENCE[topic]
  return `당신은 한국 인터넷신문의 국제부 기자입니다. 해외 언론의 영문 기사를 읽고, ${a.reader}를 위한 한국어 기사를 새로 씁니다.

원칙
- 번역하지 않습니다. 원문 문장 순서를 따라가지 말고, 핵심 사실을 골라 한국 독자에게 필요한 순서로 다시 구성합니다.
- 본문에 출처 매체를 반드시 밝힙니다(예: ${a.example}). 칼럼·분석 기사라면 "○○는 칼럼에서 ~라고 주장했다"처럼 필자의 주장으로 씁니다.
- 원문에 있는 사실만 씁니다. 숫자·날짜·인물·직함·인용을 만들거나 추측하지 않습니다. "목요일" 같은 요일은 확실할 때만 날짜로 바꿉니다.
- 직접 인용은 기사당 3개 이하, 한 문장 이내로 원문 뜻 그대로 옮기고 발언자를 밝힙니다.
${a.extra}
- 기사체로 씁니다: "~했다", "~밝혔다". 원문 매체의 사진·광고·구독 안내는 다루지 않습니다.
- "이 기사는 ~를 바탕으로 작성됐습니다" 같은 출처 안내 문장은 쓰지 않습니다(출처는 본문 문장 속에서 밝힙니다).

형식
- title: 한국어 제목, 40자 안팎. 과장 없이.
- subtitle: 부제목 한두 문장.
- paragraphs: 본문 문단 배열. 5~8개 문단, 문단마다 2~4문장. 바이라인은 넣지 않습니다.
- review_notes: 기자가 확인해야 할 점. 원문끼리 다른 수치, 요일→날짜로 바꾼 곳, 고유명사 한국어 표기, 번역이 애매한 표현, 원문이 후원·홍보성 기사로 보이는지 등. 없으면 빈 배열.`
}

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

// foreign: 해외 언론 기사 (출처를 밝힌 한국어 기사로 새로 쓴다)
//   topic: 해외 언론 묶음 (이스라엘 / 교육·유학) — 독자와 주의할 점이 달라진다
export type DraftInput = { title: string; text: string; source: string; foreign?: boolean; topic?: ForeignTopic; link?: string }
export type DraftResult = { draft: AiDraft; model: AiModel; ms: number; inputTokens: number; outputTokens: number; costUsd: number }

function userPrompt(input: DraftInput) {
  if (input.foreign) {
    return `출처 매체: ${input.source}${input.link ? `\n원문 주소: ${input.link}` : ''}\n\n<원문 제목>\n${input.title}\n</원문 제목>\n\n<원문 본문 (영문)>\n${input.text}\n</원문 본문>`
  }
  return `출처: ${input.source}\n\n<보도자료 제목>\n${input.title}\n</보도자료 제목>\n\n<보도자료 본문>\n${input.text}\n</보도자료 본문>`
}

// "이 기사는 뉴스와이어에서 배포한 보도자료를 바탕으로 작성됐습니다" 류의 출처 안내 문단
export const SOURCE_NOTE = /^[※*\s]*((이|본)\s*기사는\s*)?[^.]{0,40}보도자료를\s*(바탕으로|토대로|기반으로)\s*(작성|재구성)/

function parseDraft(text: string | undefined): AiDraft {
  if (!text) throw new AiDraftError('AI 응답이 비어 있습니다. 다시 시도해 주세요.')
  // 가끔 ```json … ``` 으로 감싸거나 앞뒤에 말을 붙여 오므로 { … } 부분만 읽는다
  const body = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
  const from = body.indexOf('{')
  const to = body.lastIndexOf('}')
  try {
    const d = JSON.parse(from >= 0 && to > from ? body.slice(from, to + 1) : body) as AiDraft
    // AI가 지시와 달리 출처 안내 문장을 붙여도 뺀다
    const paragraphs = (d.paragraphs ?? []).map((x) => String(x).trim()).filter((x) => x && !(x.length < 120 && SOURCE_NOTE.test(x)))
    if (!d.title || !paragraphs.length) throw new Error('empty')
    return { title: String(d.title), subtitle: String(d.subtitle ?? ''), paragraphs, review_notes: (d.review_notes ?? []).map(String) }
  } catch {
    throw new AiDraftError('AI 응답을 읽지 못했습니다. 다시 시도해 주세요.')
  }
}

async function withAnthropic(model: AiModel, input: DraftInput, budgetMs = 50_000) {
  const client = new Anthropic({ timeout: budgetMs, maxRetries: budgetMs >= 40_000 ? 1 : 0 })
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
      system: input.foreign ? foreignSystem(input.topic) : SYSTEM,
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
// - 503(구글 쪽 과부하)·500·429는 잠깐 기다렸다 다시 보낸다
// - 답이 중간에 막히거나(RECITATION 등) 형식이 깨지면 한 번 더 쓰게 한다
// 모두 서버리스 시간 제한 안(50초)에서만
const GEMINI_RETRY = [2_000, 5_000]
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

// 구글 오류의 RetryInfo.retryDelay ("37s", "1.5s") → 밀리초. 너무 길면(20초 넘게) 기다리지 않는다
function retryDelayMs(body: any): number {
  const info = (body?.error?.details ?? []).find((d: any) => String(d?.['@type'] ?? '').endsWith('RetryInfo'))
  const sec = parseFloat(String(info?.retryDelay ?? ''))
  return Number.isFinite(sec) && sec > 0 && sec <= 20 ? Math.ceil(sec * 1000) : 0
}

// 웹에 이미 있는 글과 너무 비슷하면 제미나이가 출력을 멈춘다(RECITATION). 다시 쓸 때 덧붙이는 지시
const REWRITE_HINT = '\n\n주의: 원문 문장을 길게 그대로 옮기지 말고, 사실은 그대로 두되 문장은 기사체로 새로 쓰세요. 인용문은 핵심 한두 문장만 짧게 쓰세요.'

function geminiPayload(input: DraftInput, hint = '') {
  return JSON.stringify({
    system_instruction: { parts: [{ text: input.foreign ? foreignSystem(input.topic) : SYSTEM }] },
    contents: [{ role: 'user', parts: [{ text: userPrompt(input) + hint }] }],
    generationConfig: {
      // REST에서는 enum 이름(대문자)으로 보내야 한다 (API 참조 문서의 ThinkingLevel·MimeType)
      thinkingConfig: { thinkingLevel: 'LOW' },
      maxOutputTokens: 16384,
      responseFormat: { text: { mimeType: 'APPLICATION_JSON', schema: GEMINI_SCHEMA } },
    },
  })
}

export async function geminiRequest(model: AiModel, payload: string, deadline: number) {
  let res: Response
  let body: any
  for (let attempt = 0; ; attempt++) {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), Math.max(1_000, deadline - Date.now()))
    try {
      res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model.id}:generateContent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY! },
        body: payload,
        signal: ctrl.signal,
        cache: 'no-store',
      })
    } catch (e) {
      if (e instanceof Error && e.name === 'AbortError') throw new AiDraftError('AI 응답이 늦어 시간을 초과했습니다. 다시 시도해 주세요.')
      throw new AiDraftError('제미나이에 연결하지 못했습니다.')
    } finally {
      clearTimeout(timer)
    }
    body = await res.json().catch(() => null)
    const retryable = res.status === 503 || res.status === 500 || res.status === 429
    // 429면 구글이 알려 준 대기 시간(RetryInfo.retryDelay, 예: "37s")을 따른다
    const asked = res.status === 429 ? retryDelayMs(body) : 0
    const wait = asked ? Math.max(asked, GEMINI_RETRY[attempt] ?? 0) : GEMINI_RETRY[attempt]
    // 다시 보낼 시간(대기 + 응답 약 15초)이 남아 있을 때만
    if (!retryable || attempt >= GEMINI_RETRY.length || wait === undefined || Date.now() + wait + 15_000 > deadline) break
    await sleep(wait + Math.floor(Math.random() * 500))
  }
  if (!res.ok) {
    const msg = String(body?.error?.message ?? '')
    if (res.status === 400 && /API key/i.test(msg)) throw new AiDraftError('제미나이 키가 올바르지 않습니다. GEMINI_API_KEY를 확인해 주세요.')
    if (res.status === 429) {
      // 무료 등급 한도면 결제(유료 등급) 연결이 필요하다
      if (/free.?tier|free_tier/i.test(msg) || /free.?tier/i.test(JSON.stringify(body?.error?.details ?? ''))) {
        throw new AiDraftError('제미나이 무료 등급 한도를 넘었습니다(429). Google AI Studio에서 이 키의 프로젝트에 결제를 연결(유료 등급)해야 합니다.')
      }
      throw new AiDraftError(`제미나이 사용 한도를 넘었습니다(429)${msg ? `: ${msg.slice(0, 160)}` : ''}`)
    }
    if (res.status === 503 || res.status === 500) throw new AiDraftError(`구글 제미나이 서버가 지금 붐빕니다(${res.status}, 일시적). 몇 분 뒤 다시 시도해 주세요.`)
    throw new AiDraftError(`제미나이 요청이 실패했습니다 (${res.status}${body?.error?.message ? `: ${String(body.error.message).slice(0, 120)}` : ''}).`)
  }
  return body
}

async function withGemini(model: AiModel, input: DraftInput, budgetMs = 50_000) {
  const deadline = Date.now() + budgetMs
  let inputTokens = 0
  let outputTokens = 0
  for (let attempt = 0; ; attempt++) {
    const body = await geminiRequest(model, geminiPayload(input, attempt ? REWRITE_HINT : ''), deadline)
    const u = body?.usageMetadata ?? {}
    inputTokens += Number(u.promptTokenCount ?? 0)
    outputTokens += Number(u.candidatesTokenCount ?? 0) + Number(u.thoughtsTokenCount ?? 0)
    const cand = body?.candidates?.[0]
    const reason: string | undefined = cand?.finishReason ?? body?.promptFeedback?.blockReason
    // 생각(thought) 부분은 빼고 답만
    const text = (cand?.content?.parts ?? []).filter((p: any) => !p.thought && typeof p.text === 'string').map((p: any) => p.text).join('')
    try {
      if (reason === 'MAX_TOKENS') throw new AiDraftError('보도자료가 너무 길어 초안이 중간에 끊겼습니다(MAX_TOKENS).')
      if (reason && !['STOP', 'FINISH_REASON_UNSPECIFIED'].includes(reason)) {
        throw new AiDraftError(reason === 'RECITATION'
          ? '제미나이가 원문과 너무 비슷하다며 쓰기를 멈췄습니다(RECITATION).'
          : `제미나이가 이 보도자료의 기사화를 멈췄습니다 (${reason}).`)
      }
      return { draft: parseDraft(text), inputTokens, outputTokens }
    } catch (e) {
      // 한 번 더 쓸 시간(약 20초)이 남아 있으면 다시 쓰게 한다
      if (attempt === 0 && Date.now() + 20_000 < deadline) continue
      throw e
    }
  }
}

// budgetMs: 이 모델에 쓸 수 있는 최대 시간 (서버리스 60초 제한 안에서 나눠 쓴다)
export async function draftWithModel(modelId: string, input: DraftInput, budgetMs = 50_000): Promise<DraftResult> {
  const model = AI_MODELS.find((m) => m.id === modelId)
  if (!model) throw new AiDraftError('알 수 없는 AI 모델입니다.')
  if (!providerReady(model.provider)) throw new AiDraftError(`${model.label}을(를) 쓰려면 ${KEY[model.provider]}를 설정해야 합니다.`)
  const started = Date.now()
  const r = model.provider === 'gemini' ? await withGemini(model, input, budgetMs) : await withAnthropic(model, input, budgetMs)
  const costUsd = (r.inputTokens * model.input + r.outputTokens * model.output) / 1_000_000
  return { ...r, model, ms: Date.now() - started, costUsd }
}

export async function draftFromPressRelease(input: DraftInput): Promise<DraftResult> {
  const model = activeModel()
  if (!model) throw new AiDraftError('AI 기능이 아직 설정되지 않았습니다. 관리자에게 AI 키(ANTHROPIC_API_KEY 또는 GEMINI_API_KEY) 설정을 요청하세요.')
  // 제미나이를 쓰고 클로드 키도 있으면: 제미나이 30초 안에 못 쓰면 남은 시간에 클로드로 대신 쓴다
  const canFallback = model.provider === 'gemini' && providerReady('anthropic')
  const started = Date.now()
  try {
    return await draftWithModel(model.id, input, canFallback ? 30_000 : 50_000)
  } catch (e) {
    // 제미나이가 실패하면(과부하·출력 중단 등) 클로드 키가 있을 때 클로드로 대신 쓴다. 키 오류는 그대로 알린다
    const keyError = e instanceof AiDraftError && /키가 올바르지/.test(e.message)
    const left = 52_000 - (Date.now() - started)
    if (!canFallback || keyError || left < 15_000) throw e
    console.warn(`[ai-draft] 제미나이 실패 → 클로드로 대신 작성: ${e instanceof Error ? e.message : e}`)
    return await draftWithModel('claude-sonnet-5-5', input, left)
  }
}
