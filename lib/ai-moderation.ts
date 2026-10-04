import Anthropic from '@anthropic-ai/sdk'
import { AiDraftError, geminiRequest, type AiModel } from './ai-draft'
import { legalModel } from './ai-legal'

// 체험신문 발행 전 검사: 혐오·차별, 선정적 내용, 욕설·비속어가 있는지 AI가 본다 (trial-moderation.sql)
//   걸리면 발행하지 않고 총관리자 확인으로 넘긴다. 검수 모델(싼 모델)을 같이 쓴다

export type ModerationKind = 'hate' | 'sexual' | 'profanity'
export type Moderation = { flagged: boolean; kinds: ModerationKind[]; reason: string }

export const MODERATION_LABEL: Record<ModerationKind, string> = { hate: '혐오·차별', sexual: '선정성', profanity: '욕설' }

const SYSTEM = `당신은 한국 인터넷 신문의 게시 전 검사 담당자입니다. 누구나 글을 올릴 수 있는 체험용 신문에 올라오는 기사를 발행 전에 읽고, 공개하면 안 되는 글인지 판단합니다.

걸러 낼 것
- hate(혐오·차별): 인종·국적·지역·성별·종교·장애·나이·성적 지향 등을 이유로 집단을 비하·조롱하거나 차별·폭력을 부추기는 표현 (멸칭 포함).
- sexual(선정성): 성행위·신체를 노골적으로 묘사하거나 성적으로 대상화하는 내용, 음란물 홍보, 성매매·조건만남 알선.
- profanity(욕설): 욕설·비속어를 기사 문장에서 직접 쓴 경우 (초성·변형 표기 포함).

걸러 내지 않을 것
- 범죄·성범죄·혐오 사건을 사실 위주로 담담하게 전하는 보도, 판결·정책·통계 기사.
- 따옴표 안에서 사건 당사자의 발언을 그대로 옮기되 기사 전체가 보도의 틀을 지키는 경우.
- 정치인·기관에 대한 날카로운 비판, 의학·보건 기사의 신체 용어.

판단이 애매하면 flagged를 true로 둡니다 (사람이 한 번 더 봅니다).
reason에는 무엇이 문제인지 한국어 한 문장으로 쓰고, 문제가 없으면 빈 문자열로 둡니다.`

const SCHEMA = {
  type: 'object',
  properties: {
    flagged: { type: 'boolean' },
    kinds: { type: 'array', items: { type: 'string', enum: ['hate', 'sexual', 'profanity'] } },
    reason: { type: 'string' },
  },
  required: ['flagged', 'kinds', 'reason'],
  additionalProperties: false,
} as const

export type ModerationInput = { title: string; subtitle: string; text: string }

function prompt(i: ModerationInput) {
  return `다음 기사를 검사해 주세요.\n\n제목: ${i.title}\n부제: ${i.subtitle || '(없음)'}\n\n본문:\n${i.text.slice(0, 20000)}`
}

function parse(text: string | undefined): Moderation {
  try {
    const body = (text ?? '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
    const v = JSON.parse(body) as Partial<Moderation>
    const kinds = (Array.isArray(v.kinds) ? v.kinds : []).filter((k): k is ModerationKind => k in MODERATION_LABEL)
    return { flagged: !!v.flagged || kinds.length > 0, kinds, reason: String(v.reason ?? '').slice(0, 300) }
  } catch {
    throw new AiDraftError('AI 검사 결과를 읽지 못했습니다.')
  }
}

async function withAnthropic(model: AiModel, input: ModerationInput) {
  const client = new Anthropic({ timeout: 30_000, maxRetries: 1 })
  let r: Anthropic.Beta.BetaMessage
  try {
    r = await client.beta.messages.create({
      model: model.id,
      max_tokens: 1000,
      output_config: { effort: 'low', format: { type: 'json_schema', schema: SCHEMA } },
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      system: SYSTEM,
      messages: [{ role: 'user', content: prompt(input) }],
    })
  } catch (e) {
    if (e instanceof Anthropic.APIError) throw new AiDraftError(`AI 검사 요청이 실패했습니다 (${e.status ?? '연결 오류'}).`)
    throw e
  }
  // 거절은 내용이 심각하다는 뜻이므로 걸린 것으로 본다
  if (r.stop_reason === 'refusal') return { flagged: true, kinds: [], reason: 'AI가 이 글의 검사를 거절했습니다.' } satisfies Moderation
  return parse(r.content.find((b): b is Anthropic.Beta.BetaTextBlock => b.type === 'text')?.text)
}

function stripAdditional(o: unknown): unknown {
  if (Array.isArray(o)) return o.map(stripAdditional)
  if (o && typeof o === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(o)) if (k !== 'additionalProperties') out[k] = stripAdditional(v)
    return out
  }
  return o
}

async function withGemini(model: AiModel, input: ModerationInput) {
  const payload = JSON.stringify({
    system_instruction: { parts: [{ text: SYSTEM }] },
    contents: [{ role: 'user', parts: [{ text: prompt(input) }] }],
    generationConfig: { thinkingConfig: { thinkingLevel: 'LOW' }, maxOutputTokens: 2048, responseFormat: { text: { mimeType: 'APPLICATION_JSON', schema: stripAdditional(SCHEMA) } } },
  })
  const body = await geminiRequest(model, payload, Date.now() + 30_000)
  const c = body?.candidates?.[0]
  // 안전 필터에 막히면 걸린 것으로 본다
  if (c?.finishReason === 'SAFETY' || body?.promptFeedback?.blockReason) return { flagged: true, kinds: [], reason: 'AI 안전 필터에 걸렸습니다.' } satisfies Moderation
  const text = (c?.content?.parts ?? []).filter((p: { thought?: boolean; text?: string }) => !p.thought && typeof p.text === 'string').map((p: { text: string }) => p.text).join('')
  return parse(text)
}

// AI가 설정되지 않았으면 null (금칙어 검사만 한다)
export async function moderateArticle(input: ModerationInput): Promise<Moderation | null> {
  const model = legalModel()
  if (!model) return null
  return model.provider === 'gemini' ? withGemini(model, input) : withAnthropic(model, input)
}
