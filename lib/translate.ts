import Anthropic from '@anthropic-ai/sdk'
import { AiDraftError, geminiRequest, providerReady, type AiModel } from './ai-draft'

// 기사 한글 → 영어 번역 (홈페이지의 "한글 | English" 버튼에서 보이는 영어판). 서버(/api/cron/translate)가 부른다
export type TranslateInput = { title: string; excerpt: string | null; body: string }
export type Translated = { title: string; excerpt: string; body: string }

const SYSTEM = `You are a professional Korean-to-English news translator for an online newspaper. Translate the given Korean news article into natural, accurate English news style.

Rules
- Translate faithfully. Do not add, remove, summarize or embellish any facts, numbers, dates, names or quotes.
- The body is HTML. Keep the HTML structure exactly: the same tags in the same order, and all attributes unchanged — especially every <img> tag (src stays identical; translate only the alt text), links (href unchanged) and entities like &nbsp;. Translate only the human-readable text between tags and the alt/title text.
- Photo captions that start with "▲" keep the "▲". "사진=…" becomes "Photo: …".
- Bylines such as "[매체이름=홍길동 기자]" become "[Outlet Name=Gil-dong Hong]" (translate the outlet name, romanize the reporter's name, drop "기자").
- Romanize Korean personal names with the Revised Romanization, given name after the family name written in Western order (e.g. 이호현 → Ho-hyun Lee). Use official English names for organizations, places and laws when they exist; otherwise translate descriptively.
- Convert Korean date/number styles naturally (e.g. 11월 9일 → Nov. 9; 3,000만 원 → 30 million won). Keep the currency as in the source.
- Direct quotes stay in quotation marks. Use a headline style for the title (no period at the end) and plain sentences for the excerpt.
- A sentence such as "※ 이 기사는 AI가 작성했습니다" is translated as a normal note ("This article was written with the help of AI.").
- Output only the JSON object requested.`

const SCHEMA = {
  type: 'object',
  properties: { title: { type: 'string' }, excerpt: { type: 'string' }, body: { type: 'string' } },
  required: ['title', 'excerpt', 'body'],
  additionalProperties: false,
} as const
const { additionalProperties: _omit, ...GEMINI_SCHEMA } = SCHEMA

const userPrompt = (i: TranslateInput) =>
  `Translate this article.\n\n<title>\n${i.title}\n</title>\n\n<excerpt>\n${i.excerpt ?? ''}\n</excerpt>\n\n<body_html>\n${i.body}\n</body_html>`

function parse(text: string | undefined): Translated {
  if (!text) throw new AiDraftError('번역 응답이 비어 있습니다.')
  const body = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
  const from = body.indexOf('{')
  const to = body.lastIndexOf('}')
  try {
    const d = JSON.parse(from >= 0 && to > from ? body.slice(from, to + 1) : body) as Partial<Translated>
    if (!d.title || !d.body) throw new Error('empty')
    return { title: String(d.title).trim().replace(/\.+$/, ''), excerpt: String(d.excerpt ?? '').trim(), body: String(d.body) }
  } catch {
    throw new AiDraftError('번역 응답을 읽지 못했습니다.')
  }
}

// 번역이 제대로 됐는지: 사진 태그 수가 같고, 한글이 거의 남아 있지 않아야 한다
export function checkTranslation(input: TranslateInput, out: Translated) {
  const imgs = (h: string) => (h.match(/<img\b/gi) ?? []).length
  if (imgs(out.body) !== imgs(input.body)) throw new AiDraftError(`번역 본문의 사진 태그 수가 달라졌습니다 (${imgs(input.body)} → ${imgs(out.body)})`)
  const text = out.body.replace(/<[^>]+>/g, '')
  const hangul = (text.match(/[가-힣]/g) ?? []).length
  if (hangul > Math.max(30, text.length * 0.05)) throw new AiDraftError('번역 본문에 한글이 많이 남아 있습니다')
  if (/[가-힣]/.test(out.title) && (out.title.match(/[가-힣]/g) ?? []).length > 3) throw new AiDraftError('번역 제목에 한글이 남아 있습니다')
}

async function withAnthropic(model: AiModel, input: TranslateInput, budgetMs: number) {
  const client = new Anthropic({ timeout: budgetMs, maxRetries: 0 })
  const response = await client.beta.messages.create({
    model: model.id,
    max_tokens: 16000,
    output_config: { effort: 'low', format: { type: 'json_schema', schema: SCHEMA } },
    system: SYSTEM,
    messages: [{ role: 'user', content: userPrompt(input) }],
  })
  if (response.stop_reason === 'max_tokens') throw new AiDraftError('번역이 길어 중간에 끊겼습니다.')
  const text = response.content.find((b): b is Anthropic.Beta.BetaTextBlock => b.type === 'text')?.text
  return parse(text)
}

async function withGemini(model: AiModel, input: TranslateInput, budgetMs: number) {
  const payload = JSON.stringify({
    system_instruction: { parts: [{ text: SYSTEM }] },
    contents: [{ role: 'user', parts: [{ text: userPrompt(input) }] }],
    generationConfig: {
      thinkingConfig: { thinkingLevel: 'LOW' },
      maxOutputTokens: 16384,
      responseFormat: { text: { mimeType: 'APPLICATION_JSON', schema: GEMINI_SCHEMA } },
    },
  })
  const body = await geminiRequest(model, payload, Date.now() + budgetMs)
  const cand = body?.candidates?.[0]
  const reason: string | undefined = cand?.finishReason
  if (reason === 'MAX_TOKENS') throw new AiDraftError('번역이 길어 중간에 끊겼습니다.')
  if (reason && !['STOP', 'FINISH_REASON_UNSPECIFIED'].includes(reason)) throw new AiDraftError(`번역이 멈췄습니다 (${reason}).`)
  const text = (cand?.content?.parts ?? []).filter((p: any) => !p.thought && typeof p.text === 'string').map((p: any) => p.text).join('')
  return parse(text)
}

export async function translateToEnglish(model: AiModel, input: TranslateInput, budgetMs = 45_000): Promise<Translated> {
  if (!providerReady(model.provider)) throw new AiDraftError('AI 키가 설정되지 않았습니다.')
  const out = model.provider === 'gemini' ? await withGemini(model, input, budgetMs) : await withAnthropic(model, input, budgetMs)
  checkTranslation(input, out)
  return out
}
