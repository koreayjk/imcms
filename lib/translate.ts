import Anthropic from '@anthropic-ai/sdk'
import { AiDraftError, geminiRequest, providerReady, type AiModel } from './ai-draft'

// 기사 한글 → 영어·일본어·중국어 번역 (홈페이지의 언어 버튼에서 보이는 번역판). 서버(/api/cron/translate)가 부른다
export type TransLang = 'en' | 'ja' | 'zh'
export type TranslateInput = { title: string; excerpt: string | null; body: string }
export type Translated = { title: string; excerpt: string; body: string }

const EN_SYSTEM = `You are a professional Korean-to-English news translator for an online newspaper. Translate the given Korean news article into natural, accurate English news style.

Rules
- Translate faithfully. Do not add, remove, summarize or embellish any facts, numbers, dates, names or quotes.
- The body is HTML. Keep the HTML structure exactly: the same tags in the same order, and all attributes unchanged — especially every <img data-ph="n"> placeholder (keep each one exactly as written, in the same place), links (href unchanged) and entities like &nbsp;. Translate only the human-readable text between tags and the alt/title text. The body may be one part of a longer article: translate it as given.
- Photo captions that start with "▲" keep the "▲". "사진=…" becomes "Photo: …".
- Bylines such as "[매체이름=홍길동 기자]" become "[Outlet Name=Gil-dong Hong]" (translate the outlet name, romanize the reporter's name, drop "기자").
- Romanize Korean personal names with the Revised Romanization, given name after the family name written in Western order (e.g. 이호현 → Ho-hyun Lee). Use official English names for organizations, places and laws when they exist; otherwise translate descriptively.
- Convert Korean date/number styles naturally (e.g. 11월 9일 → Nov. 9; 3,000만 원 → 30 million won). Keep the currency as in the source.
- Direct quotes stay in quotation marks. Use a headline style for the title (no period at the end) and plain sentences for the excerpt.
- A sentence such as "※ 이 기사는 AI가 작성했습니다" is translated as a normal note ("This article was written with the help of AI.").
- Output only the JSON object requested.`

const COMMON = `- Translate faithfully. Do not add, remove, summarize or embellish any facts, numbers, dates, names or quotes.
- The body is HTML. Keep the HTML structure exactly: the same tags in the same order, and all attributes unchanged — especially every <img data-ph="n"> placeholder (keep each one exactly as written, in the same place), links (href unchanged) and entities like &nbsp;. Translate only the human-readable text between tags and the alt/title text. The body may be one part of a longer article: translate it as given.
- Photo captions that start with "▲" keep the "▲".
- Direct quotes stay in quotation marks. The title is a headline (no period at the end); the excerpt is plain sentences.
- Output only the JSON object requested.`

const JA_SYSTEM = `You are a professional Korean-to-Japanese news translator for an online newspaper. Translate the given Korean news article into natural, accurate Japanese in standard newspaper style (である調 for reporting; keep quotes as spoken).

Rules
${COMMON}
- "사진=…" becomes "写真=…". Bylines such as "[매체이름=홍길동 기자]" become "[媒体名=洪吉童記者]" (translate the outlet name; write the reporter's name the way Japanese media do — kanji when the name is written in hanja or has a standard kanji form, otherwise katakana — and use 記者).
- Write Korean place names, organizations and laws with their established Japanese names when they exist, otherwise translate descriptively; Korean personal names in katakana (or kanji if well known).
- Convert Korean date/number styles naturally (e.g. 3,000만 원 → 3000万ウォン). Keep the currency as in the source.
- A sentence such as "※ 이 기사는 AI가 작성했습니다" is translated as a normal note.
- The output must not contain Hangul.`

const ZH_SYSTEM = `You are a professional Korean-to-Chinese news translator for an online newspaper. Translate the given Korean news article into natural, accurate Simplified Chinese in standard news style.

Rules
${COMMON}
- "사진=…" becomes "图片=…". Bylines such as "[매체이름=홍길동 기자]" become "[媒体名=洪吉童 记者]" (translate the outlet name; write the reporter's name in hanzi — the hanja form if known, otherwise the standard Chinese transliteration — and use 记者).
- Write Korean place names, organizations and laws with their established Chinese names when they exist, otherwise translate descriptively.
- Convert Korean date/number styles naturally (e.g. 3,000만 원 → 3000万韩元). Keep the currency as in the source.
- A sentence such as "※ 이 기사는 AI가 작성했습니다" is translated as a normal note.
- The output must not contain Hangul.`

const SYSTEMS: Record<TransLang, string> = { en: EN_SYSTEM, ja: JA_SYSTEM, zh: ZH_SYSTEM }

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

async function withAnthropic(model: AiModel, input: TranslateInput, budgetMs: number, lang: TransLang) {
  const client = new Anthropic({ timeout: budgetMs, maxRetries: 0 })
  const response = await client.beta.messages.create({
    model: model.id,
    max_tokens: 16000,
    output_config: { effort: 'low', format: { type: 'json_schema', schema: SCHEMA } },
    system: SYSTEMS[lang],
    messages: [{ role: 'user', content: userPrompt(input) }],
  })
  if (response.stop_reason === 'max_tokens') throw new AiDraftError('번역이 길어 중간에 끊겼습니다.')
  const text = response.content.find((b): b is Anthropic.Beta.BetaTextBlock => b.type === 'text')?.text
  return parse(text)
}

async function withGemini(model: AiModel, input: TranslateInput, budgetMs: number, lang: TransLang) {
  const payload = JSON.stringify({
    system_instruction: { parts: [{ text: SYSTEMS[lang] }] },
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

// ───────── 긴 기사·사진이 많은 기사 ─────────
// 사진 태그는 번역에 보내지 않고 짧은 표시(<img data-ph="n">)로 바꿔 두었다가 번역 뒤에 원래 태그로 되돌린다 (AI가 사진을 빠뜨리지 못하게)
// 본문이 길면 문단 경계에서 나눠 동시에 번역한다 (한 번에 보내면 시간 안에 못 끝낸다)
const CHUNK_CHARS = 5000
const CHUNK_PARALLEL = 4

function protectImages(html: string) {
  const imgs: string[] = []
  const out = html.replace(/<img\b[^>]*>/gi, (m) => { imgs.push(m); return `<img data-ph="${imgs.length - 1}">` })
  return { html: out, imgs }
}
function restoreImages(html: string, imgs: string[]) {
  let n = 0
  const out = html.replace(/<img\b[^>]*data-ph=["']?(\d+)["']?[^>]*>/gi, (_m, i) => { n++; return imgs[Number(i)] ?? '' })
  return { html: out, n }
}
function splitBody(html: string): string[] {
  if (html.length <= CHUNK_CHARS * 1.3) return [html]
  const parts = html.split(/(?<=<\/(?:p|h[1-6]|ul|ol|blockquote|figure|table|div)>)/i)
  const chunks: string[] = []
  let cur = ''
  for (const p of parts) {
    if (cur && cur.length + p.length > CHUNK_CHARS) { chunks.push(cur); cur = '' }
    cur += p
  }
  if (cur) chunks.push(cur)
  return chunks
}

async function translateOnce(model: AiModel, input: TranslateInput, budgetMs: number, lang: TransLang): Promise<Translated> {
  return model.provider === 'gemini' ? withGemini(model, input, budgetMs, lang) : withAnthropic(model, input, budgetMs, lang)
}

// 조각 하나: 사진 표시 개수가 맞지 않으면 한 번 더 시도한다
async function translateChunk(model: AiModel, input: TranslateInput, expectImgs: number, budgetMs: number, lang: TransLang) {
  let last: Translated | null = null
  for (let k = 0; k < 2; k++) {
    last = await translateOnce(model, input, budgetMs, lang)
    const got = (last.body.match(/data-ph=/gi) ?? []).length
    if (got === expectImgs) return last
  }
  throw new AiDraftError(`번역 본문의 사진 표시 수가 달라졌습니다 (${expectImgs} → ${(last!.body.match(/data-ph=/gi) ?? []).length})`)
}

export async function translateArticle(model: AiModel, input: TranslateInput, lang: TransLang = 'en', budgetMs = 45_000): Promise<Translated> {
  if (!providerReady(model.provider)) throw new AiDraftError('AI 키가 설정되지 않았습니다.')
  const { html, imgs } = protectImages(input.body)
  const chunks = splitBody(html)
  const results: Translated[] = new Array(chunks.length)
  let next = 0
  const worker = async () => {
    while (true) {
      const k = next++
      if (k >= chunks.length) return
      const expect = (chunks[k].match(/data-ph=/gi) ?? []).length
      // 첫 조각만 제목·부제를 함께 번역한다
      const part: TranslateInput = k === 0 ? { title: input.title, excerpt: input.excerpt, body: chunks[k] } : { title: '-', excerpt: '', body: chunks[k] }
      results[k] = await translateChunk(model, part, expect, budgetMs, lang)
    }
  }
  await Promise.all(Array.from({ length: Math.min(CHUNK_PARALLEL, chunks.length) }, worker))
  const joined = results.map((r) => r.body).join('\n')
  const restored = restoreImages(joined, imgs)
  if (restored.n !== imgs.length) throw new AiDraftError(`번역 본문의 사진 태그 수가 달라졌습니다 (${imgs.length} → ${restored.n})`)
  const out: Translated = { title: results[0].title, excerpt: results[0].excerpt, body: restored.html }
  checkTranslation(input, out)
  return out
}
