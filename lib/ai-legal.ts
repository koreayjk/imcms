import Anthropic from '@anthropic-ai/sdk'
import { activeModel, AI_MODELS, AiDraftError, geminiRequest, providerReady, type AiModel } from './ai-draft'

// 기사 발행 전 AI 법적 검수: 명예훼손·모욕, 개인정보·초상권, 저작권(도용·표절), 허위·과장, 기사형 광고 등
//   참고용 점검이다. 인터넷 검색으로 다른 기사와 대조하지는 않는다
import type { LegalCheck } from './legal-types'
export type { LegalCheck, LegalIssue } from './legal-types'

const SYSTEM = `당신은 한국 언론사의 법무 검토 담당자입니다. 기자가 쓴 기사를 발행 전에 읽고, 법적 분쟁이 생길 수 있는 표현을 찾아 알려 줍니다.

볼 것 (한국 법 기준: 형법·정보통신망법의 명예훼손·모욕, 언론중재법, 저작권법, 개인정보 보호법, 신문법의 기사·광고 구분, 공직선거법)
- defamation(명예훼손): 특정할 수 있는 개인·단체의 사회적 평가를 떨어뜨리는 사실 적시. 출처·근거 없이 단정하거나, 의혹을 사실처럼 쓰거나, 반론·해명 없이 한쪽 주장만 실은 경우.
- insult(모욕·비하): 사실 적시 없이 사람을 깎아내리는 표현, 혐오·비하 표현.
- privacy(개인정보·초상권): 일반인의 실명·나이·주소·연락처·직장 등으로 신원을 알 수 있게 쓴 경우, 미성년자·피해자 신원 노출, 동의 없는 사진 언급.
- copyright(저작권·도용): 다른 매체 기사·책·블로그 글을 출처 없이 길게 옮긴 흔적, 출처 없는 긴 인용, "~에 따르면" 없이 남의 취재 내용을 쓴 흔적, 사진·그림 출처 미표기.
- false_info(사실 확인 필요): 근거가 안 보이는 수치·단정, 확인되지 않은 소문, 과장된 표현.
- crime_report(범죄·사건 보도): 수사·재판 중인 사람을 범인으로 단정(무죄 추정 원칙), 피의자·피해자 실명, 자극적 묘사.
- ad(기사형 광고): 특정 상품·업체를 홍보하는 내용인데 광고 표시가 없는 경우.
- election(선거 보도): 선거 여론조사 결과를 조사기관·기간·방법 없이 쓴 경우, 특정 후보 편들기.

원칙
- 공인(정치인·고위 공직자·대기업)의 공적 활동 비판, 공식 발표·보도자료를 출처와 함께 옮긴 내용, 정부·기관 통계는 문제로 보지 않습니다.
- 지나치게 많이 찾지 말고, 실제로 문제가 될 만한 것만 고릅니다. 문제가 없으면 issues를 빈 배열로 둡니다.
- quote에는 문제가 되는 부분을 기사(제목·부제·본문)에서 한 글자도 바꾸지 말고 그대로 복사합니다. 한 문단 안에서만, 최대 150자. 줄이거나 "…"로 생략하지 않습니다.
- fix에는 quote 자리에 그대로 바꿔 넣을 고친 문장을 씁니다. 앞뒤 문장과 자연스럽게 이어지도록 quote와 같은 범위만 고쳐 씁니다(익명 처리, "~한 의혹을 받고 있다", "○○에 따르면" 등). 문장을 고쳐서 해결되지 않는 문제(반론 취재, 사진 출처 확인 등)는 빈 문자열로 둡니다.
- reason에는 왜 문제가 될 수 있는지 한두 문장으로 씁니다.
- suggestion에는 고치는 방법이나 할 일(출처 밝히기, 익명 처리, 반론 넣기 등)을 구체적으로 씁니다.
- severity: high = 소송·정정보도 청구 가능성이 큼, medium = 다듬는 게 좋음, low = 참고.
- risk는 가장 심각한 문제를 기준으로 low / medium / high.
- summary는 전체 판단을 한 문장으로 씁니다.
- photo_keywords에는 이 기사에 어울리는 사진을 공개 사진 모음에서 찾을 영어 검색어를 2~4개 씁니다. 장소·건물·사물·행사·풍경처럼 사진으로 찾을 수 있는 말로, 짧게(1~4단어). 일반인 이름이나 특정 회사 상표는 넣지 않습니다.
- photo_keywords를 뺀 나머지는 모두 한국어로 씁니다.`

const SCHEMA = {
  type: 'object',
  properties: {
    risk: { type: 'string', enum: ['low', 'medium', 'high'] },
    summary: { type: 'string' },
    issues: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          type: { type: 'string', enum: ['defamation', 'insult', 'privacy', 'copyright', 'false_info', 'crime_report', 'ad', 'election', 'other'] },
          severity: { type: 'string', enum: ['low', 'medium', 'high'] },
          quote: { type: 'string' },
          fix: { type: 'string' },
          reason: { type: 'string' },
          suggestion: { type: 'string' },
        },
        required: ['type', 'severity', 'quote', 'fix', 'reason', 'suggestion'],
        additionalProperties: false,
      },
    },
    photo_keywords: { type: 'array', items: { type: 'string' } },
  },
  required: ['risk', 'summary', 'issues', 'photo_keywords'],
  additionalProperties: false,
} as const

function stripAdditional(o: unknown): unknown {
  if (Array.isArray(o)) return o.map(stripAdditional)
  if (o && typeof o === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(o)) if (k !== 'additionalProperties') out[k] = stripAdditional(v)
    return out
  }
  return o
}

export type LegalInput = { title: string; subtitle: string; text: string }

function prompt(i: LegalInput) {
  return `다음 기사를 검토해 주세요.\n\n제목: ${i.title}\n부제: ${i.subtitle || '(없음)'}\n\n본문:\n${i.text.slice(0, 20000)}`
}

function parse(text: string | undefined): LegalCheck {
  try {
    const body = (text ?? '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
    const v = JSON.parse(body) as LegalCheck
    const issues = Array.isArray(v.issues) ? v.issues.slice(0, 20) : []
    const risk = ['low', 'medium', 'high'].includes(v.risk) ? v.risk : issues.some((x) => x.severity === 'high') ? 'high' : issues.length ? 'medium' : 'low'
    // 추천 사진 검색어 (영어, 짧게 최대 4개)
    const photo_keywords = Array.isArray(v.photo_keywords)
      ? v.photo_keywords.map((k) => String(k).replace(/[^\p{L}\p{N}\s'-]/gu, ' ').replace(/\s+/g, ' ').trim().slice(0, 40)).filter(Boolean).slice(0, 4)
      : []
    return { risk, summary: String(v.summary ?? ''), issues, photo_keywords }
  } catch {
    throw new AiDraftError('AI 검수 결과를 읽지 못했습니다. 다시 시도해 주세요.')
  }
}

async function withAnthropic(model: AiModel, input: LegalInput) {
  const client = new Anthropic({ timeout: 50_000, maxRetries: 1 })
  let r: Anthropic.Beta.BetaMessage
  try {
    r = await client.beta.messages.create({
      model: model.id,
      max_tokens: 8000,
      output_config: { effort: 'medium', format: { type: 'json_schema', schema: SCHEMA } },
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      system: SYSTEM,
      messages: [{ role: 'user', content: prompt(input) }],
    })
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError) throw new AiDraftError('AI 요청이 몰려 잠시 제한되었습니다. 1분 뒤 다시 시도해 주세요.')
    if (e instanceof Anthropic.APIConnectionTimeoutError) throw new AiDraftError('AI 검수가 늦어 시간을 초과했습니다. 다시 시도해 주세요.')
    if (e instanceof Anthropic.APIError) throw new AiDraftError(`AI 검수 요청이 실패했습니다 (${e.status ?? '연결 오류'}).`)
    throw e
  }
  if (r.stop_reason === 'refusal') throw new AiDraftError('AI가 이 기사의 검수를 거절했습니다. 편집장에게 직접 검토를 요청해 주세요.')
  const text = r.content.find((b): b is Anthropic.Beta.BetaTextBlock => b.type === 'text')?.text
  return { check: parse(text), inputTokens: r.usage.input_tokens, outputTokens: r.usage.output_tokens }
}

async function withGemini(model: AiModel, input: LegalInput) {
  const payload = JSON.stringify({
    system_instruction: { parts: [{ text: SYSTEM }] },
    contents: [{ role: 'user', parts: [{ text: prompt(input) }] }],
    generationConfig: { thinkingConfig: { thinkingLevel: 'LOW' }, maxOutputTokens: 8192, responseFormat: { text: { mimeType: 'APPLICATION_JSON', schema: stripAdditional(SCHEMA) } } },
  })
  const body = await geminiRequest(model, payload, Date.now() + 50_000)
  const u = body?.usageMetadata ?? {}
  const text = (body?.candidates?.[0]?.content?.parts ?? []).filter((p: { thought?: boolean; text?: string }) => !p.thought && typeof p.text === 'string').map((p: { text: string }) => p.text).join('')
  return { check: parse(text), inputTokens: Number(u.promptTokenCount ?? 0), outputTokens: Number(u.candidatesTokenCount ?? 0) + Number(u.thoughtsTokenCount ?? 0) }
}

// 검수 모델: 초안 쓰기와 따로 정할 수 있다 (Vercel 환경 변수 AI_LEGAL_MODEL, 없으면 Gemini Flash).
// 문제 표현을 찾는 일이라 싼 모델로 충분하다. Gemini 키가 없을 때만 초안 모델을 쓴다
export function legalModel(): AiModel | null {
  const chosen = AI_MODELS.find((m) => m.id === process.env.AI_LEGAL_MODEL)
  if (chosen && providerReady(chosen.provider)) return chosen
  if (providerReady('gemini')) return AI_MODELS.find((m) => m.id === 'gemini-3.8-flash')!
  return activeModel()
}

export async function checkLegal(input: LegalInput) {
  const model = legalModel()
  if (!model) throw new AiDraftError('AI 기능이 아직 설정되지 않았습니다.')
  const r = model.provider === 'gemini' ? await withGemini(model, input) : await withAnthropic(model, input)
  const costUsd = (r.inputTokens * model.input + r.outputTokens * model.output) / 1_000_000
  return { ...r, model, costUsd, check: { ...r.check, model: model.id, checked_at: new Date().toISOString() } }
}
