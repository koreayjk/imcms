import Anthropic from '@anthropic-ai/sdk'
import { activeModel, AiDraftError, geminiRequest, type AiModel } from './ai-draft'

// 함께 송고: 다른 매체에 올릴 사본의 문장을 AI로 다시 쓴다 (같은 글이 여러 매체에 똑같이 실리지 않도록)
//   사실·숫자·이름·직접 인용은 그대로 두고 문장 구성과 표현만 바꾼다. 문단 수는 그대로

const SYSTEM = `당신은 한국 인터넷신문의 편집 기자입니다. 같은 그룹의 다른 매체에 실을 기사를, 원래 기사와 문장이 겹치지 않게 다시 씁니다.

지킬 것
- 사실·숫자·날짜·이름·직함·기관명은 하나도 바꾸지 않습니다. 새 사실이나 평가를 덧붙이지 않고, 원문에 있는 내용을 빼지도 않습니다.
- 큰따옴표(“ ”) 안의 직접 인용은 글자 그대로 둡니다. 인용의 앞뒤 서술만 바꿉니다.
- 문장 구성·어순·단어 선택을 바꿔, 원래 기사와 같은 문장이 이어지지 않게 합니다. 기사체(~했다, ~밝혔다)를 유지합니다.
- paragraphs는 받은 문단 수와 정확히 같은 개수로, 같은 순서로 돌려줍니다. 소제목 문단은 짧은 소제목으로 둡니다.
- 제목은 같은 사실을 다른 표현으로 씁니다(과장 없이). 부제가 비어 있으면 빈 문자열로 둡니다.
- 모두 한국어로 씁니다.`

const SCHEMA = {
  type: 'object',
  properties: {
    title: { type: 'string' },
    subtitle: { type: 'string' },
    paragraphs: { type: 'array', items: { type: 'string' } },
  },
  required: ['title', 'subtitle', 'paragraphs'],
  additionalProperties: false,
} as const

export type RewriteInput = { title: string; subtitle: string; paragraphs: string[] }
export type RewriteOutput = RewriteInput

function prompt(i: RewriteInput) {
  return `다음 기사를 다시 써 주세요. 문단 ${i.paragraphs.length}개.\n\n제목: ${i.title}\n부제: ${i.subtitle || '(없음)'}\n\n${i.paragraphs.map((p, n) => `[문단 ${n + 1}]\n${p}`).join('\n\n')}`
}

function parse(text: string | undefined, input: RewriteInput): RewriteOutput {
  let v: RewriteOutput
  try {
    v = JSON.parse((text ?? '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')) as RewriteOutput
  } catch {
    throw new AiDraftError('AI가 바꾼 글을 읽지 못했습니다.')
  }
  const paragraphs = Array.isArray(v.paragraphs) ? v.paragraphs.map((p) => String(p).trim()) : []
  if (paragraphs.length !== input.paragraphs.length || paragraphs.some((p) => !p)) throw new AiDraftError('AI가 문단 수를 맞추지 못했습니다.')
  return { title: String(v.title ?? '').trim() || input.title, subtitle: String(v.subtitle ?? '').trim(), paragraphs }
}

async function withAnthropic(model: AiModel, input: RewriteInput) {
  const client = new Anthropic({ timeout: 50_000, maxRetries: 1 })
  let r: Anthropic.Beta.BetaMessage
  try {
    r = await client.beta.messages.create({
      model: model.id,
      max_tokens: 16000,
      output_config: { effort: 'low', format: { type: 'json_schema', schema: SCHEMA } },
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      system: SYSTEM,
      messages: [{ role: 'user', content: prompt(input) }],
    })
  } catch (e) {
    if (e instanceof Anthropic.APIError) throw new AiDraftError(`AI 요청이 실패했습니다 (${e.status ?? '연결 오류'}).`)
    throw e
  }
  if (r.stop_reason === 'refusal' || r.stop_reason === 'max_tokens') throw new AiDraftError('AI가 글을 다 바꾸지 못했습니다.')
  const text = r.content.find((b): b is Anthropic.Beta.BetaTextBlock => b.type === 'text')?.text
  return { out: parse(text, input), inputTokens: r.usage.input_tokens, outputTokens: r.usage.output_tokens }
}

async function withGemini(model: AiModel, input: RewriteInput) {
  const schema = { type: 'object', properties: SCHEMA.properties, required: SCHEMA.required }
  const payload = JSON.stringify({
    system_instruction: { parts: [{ text: SYSTEM }] },
    contents: [{ role: 'user', parts: [{ text: prompt(input) }] }],
    generationConfig: { thinkingConfig: { thinkingLevel: 'LOW' }, maxOutputTokens: 16384, responseFormat: { text: { mimeType: 'APPLICATION_JSON', schema } } },
  })
  const body = await geminiRequest(model, payload, Date.now() + 50_000)
  const u = body?.usageMetadata ?? {}
  const text = (body?.candidates?.[0]?.content?.parts ?? []).filter((p: { thought?: boolean; text?: string }) => !p.thought && typeof p.text === 'string').map((p: { text: string }) => p.text).join('')
  return { out: parse(text, input), inputTokens: Number(u.promptTokenCount ?? 0), outputTokens: Number(u.candidatesTokenCount ?? 0) + Number(u.thoughtsTokenCount ?? 0) }
}

export async function rewriteArticle(input: RewriteInput) {
  const model = activeModel()
  if (!model) throw new AiDraftError('AI 기능이 아직 설정되지 않았습니다.')
  const r = model.provider === 'gemini' ? await withGemini(model, input) : await withAnthropic(model, input)
  const costUsd = (r.inputTokens * model.input + r.outputTokens * model.output) / 1_000_000
  return { ...r, model, costUsd }
}
