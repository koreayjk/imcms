'use client'

import { useEffect, useMemo, useState } from 'react'
import { createShare, prepareReleases, runDraft, type CompareRelease, type CompareResult } from '@/app/(main)/admin/ai-compare/actions'
import { DOC_ACCEPT, extractDocText, guessTitle } from '@/lib/doc-extract'
import { AI_TEST_SET, AI_TEST_SET_VERSION } from '@/lib/ai-test-set'
import { useT, useCmsLang } from '@/components/cms/CmsLang'

type Model = { id: string; label: string; input: number; output: number; ready: boolean; note?: string }
type Run = { releases: CompareRelease[]; models: string[]; results: Record<string, CompareResult | 'running'>; at: string }

const WON = 1400
const wonL = (usd: number, lang: 'ko' | 'en') => (lang === 'en' ? `KRW ${Math.round(usd * WON).toLocaleString('en-US')}` : `${Math.round(usd * WON).toLocaleString()}원`)
const STORE = 'im-ai-compare-last'
const CUSTOM_STORE = 'im-ai-compare-custom'
const TEST_SET_FLAG = 'im-ai-compare-testset'
const key = (r: string, m: string) => `${r}|${m}`

// 기본 시험 자료를 맨 위에 두고, 이미 있는 같은 제목 자료는 하나만 남긴다
function withTestSet(list: CompareRelease[]) {
  const titles = new Set(AI_TEST_SET.map((t) => t.title))
  return [...AI_TEST_SET, ...list.filter((c) => !titles.has(c.title))]
}

export default function AiCompare({ models }: { models: Model[] }) {
  const t = useT()
  const lang = useCmsLang()
  const loc = lang === 'en' ? 'en-US' : 'ko-KR'
  const won = (usd: number) => wonL(usd, lang)
  const CUSTOM_SOURCE = t('직접 올린 자료', 'Uploaded by me')
  const [picked, setPicked] = useState<string[]>(() => models.filter((m) => m.ready).map((m) => m.id).filter((id) => id !== 'gemini-3.5-flash-lite'))
  const [run, setRun] = useState<Run | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [open, setOpen] = useState<string | null>(null)
  const [shareTitle, setShareTitle] = useState('')
  const [blind, setBlind] = useState(true)
  const [sharing, setSharing] = useState(false)
  const [shareUrl, setShareUrl] = useState('')
  const [shareError, setShareError] = useState('')
  const [copied, setCopied] = useState(false)
  // 비교할 자료: 최근 보도자료 10건 + 직접 올린 파일·붙여넣은 글
  const [includeRecent, setIncludeRecent] = useState(true)
  const [custom, setCustom] = useState<CompareRelease[]>([])
  const [customLoaded, setCustomLoaded] = useState(false)
  const [reading, setReading] = useState(false)
  const [fileError, setFileError] = useState('')
  const [pasteOpen, setPasteOpen] = useState(false)
  const [pasteText, setPasteText] = useState('')

  // 지난 비교 결과는 이 브라우저에만 남겨 둔다
  useEffect(() => {
    try { const s = localStorage.getItem(STORE); if (s) setRun(JSON.parse(s)) } catch {}
    // 내 자료 + 기본 시험 자료 6건(처음 한 번 맨 위에 넣는다, 같은 제목은 하나만)
    let list: CompareRelease[] = []
    try { const c = localStorage.getItem(CUSTOM_STORE); if (c) list = JSON.parse(c) } catch {}
    let seeded = false
    try { seeded = localStorage.getItem(TEST_SET_FLAG) === AI_TEST_SET_VERSION } catch {}
    if (!seeded) {
      list = withTestSet(list)
      // 목록과 표시를 함께 저장해야 다시 불러올 때 시험 자료가 빠지지 않는다
      try {
        localStorage.setItem(CUSTOM_STORE, JSON.stringify(list))
        localStorage.setItem(TEST_SET_FLAG, AI_TEST_SET_VERSION)
      } catch {}
    }
    setCustom(list)
    setCustomLoaded(true)
  }, [])
  useEffect(() => {
    // 불러오기 전에 빈 목록으로 덮어쓰지 않도록
    if (!customLoaded) return
    try { localStorage.setItem(CUSTOM_STORE, JSON.stringify(custom)) } catch {}
  }, [custom, customLoaded])

  // 워드·텍스트 파일은 이 브라우저에서 글자만 뽑는다 (사진이 든 큰 파일도 서버로 보내지 않는다)
  async function addFiles(files: FileList | null) {
    if (!files?.length) return
    setFileError('')
    setReading(true)
    const added: CompareRelease[] = []
    const errors: string[] = []
    for (const f of Array.from(files)) {
      try {
        const text = await extractDocText(f)
        added.push({ id: `file-${Date.now()}-${added.length}`, title: guessTitle(text, f.name), source: CUSTOM_SOURCE, text: text.slice(0, 12000) })
      } catch (e) {
        errors.push(`${f.name}: ${e instanceof Error ? e.message : t('읽지 못했습니다', 'Could not read the file')}`)
      }
    }
    setCustom((prev) => [...prev, ...added])
    setFileError(errors.join('\n'))
    setReading(false)
  }

  const missingTest = AI_TEST_SET.filter((x) => !custom.some((c) => c.title === x.title))

  function addPasted() {
    const text = pasteText.trim()
    if (text.length < 50) { setFileError(t('붙여넣은 글이 너무 짧습니다. 보도자료 전문을 붙여넣어 주세요.', 'The pasted text is too short. Paste the full press release.')); return }
    setCustom((prev) => [...prev, { id: `paste-${Date.now()}`, title: guessTitle(text, t('붙여넣은 보도자료', 'Pasted press release')), source: CUSTOM_SOURCE, text: text.slice(0, 12000) }])
    setPasteText('')
    setPasteOpen(false)
    setFileError('')
  }
  useEffect(() => {
    if (!run || busy) return
    try { localStorage.setItem(STORE, JSON.stringify(run)) } catch {}
  }, [run, busy])

  const ready = models.filter((m) => m.ready)
  // 대략 예상 비용: 보도자료 1건 = 입력 4천·출력 3천 토큰
  const releaseCount = custom.length + (includeRecent ? 10 : 0)
  const estimate = picked.reduce((a, id) => {
    const m = models.find((x) => x.id === id)!
    return a + releaseCount * (4000 * m.input + 3000 * m.output) / 1e6
  }, 0)

  async function start() {
    setError('')
    setBusy(true)
    let releases = [...custom]
    if (includeRecent) {
      const prep = await prepareReleases(10)
      if (prep.error && !custom.length) { setError(prep.error); setBusy(false); return }
      releases = [...releases, ...(prep.releases ?? [])]
    }
    if (!releases.length) {
      setError(t('비교할 자료가 없습니다. 파일을 올리거나 “최근 보도자료 10건”을 켜 주세요.', 'There is nothing to compare. Upload a file or turn on “10 most recent press releases”.'))
      setBusy(false)
      return
    }
    const next: Run = { releases, models: picked, results: {}, at: new Date().toISOString() }
    setRun(next)
    await runJobs(releases.flatMap((r) => picked.map((m) => ({ r, m }))))
  }

  // 클로드는 3개씩 동시에, 제미나이는 사용 한도(분당 요청 수)가 빡빡해 1개씩 차례로
  async function runJobs(jobs: { r: CompareRelease; m: string }[]) {
    setBusy(true)
    const pool = async (list: typeof jobs, workers: number, gapMs: number) => {
      let i = 0
      const worker = async () => {
        while (i < list.length) {
          const { r, m } = list[i++]
          setRun((prev) => prev && { ...prev, results: { ...prev.results, [key(r.id, m)]: 'running' } })
          const res = await runDraft(m, r).catch((e) => ({ ok: false as const, error: e instanceof Error ? e.message : t('실패', 'Failed') }))
          setRun((prev) => prev && { ...prev, results: { ...prev.results, [key(r.id, m)]: res } })
          if (gapMs && i < list.length) await new Promise((ok) => setTimeout(ok, gapMs))
        }
      }
      await Promise.all(Array.from({ length: workers }, worker))
    }
    const isGemini = (m: string) => m.startsWith('gemini')
    await Promise.all([
      pool(jobs.filter((j) => !isGemini(j.m)), 3, 0),
      pool(jobs.filter((j) => isGemini(j.m)), 1, 1500),
    ])
    setBusy(false)
  }

  async function share() {
    if (!run) return
    setShareError('')
    setSharing(true)
    const results: Record<string, { draft: Extract<CompareResult, { ok: true }>['draft']; ms: number; costUsd: number; issues: Extract<CompareResult, { ok: true }>['issues'] }> = {}
    for (const [k, v] of Object.entries(run.results)) if (v !== 'running' && v.ok) results[k] = { draft: v.draft, ms: v.ms, costUsd: v.costUsd, issues: v.issues }
    const res = await createShare({
      title: shareTitle.trim() || t(`AI 초안 비교 (${new Date(run.at).toLocaleDateString('ko-KR')})`, `AI draft comparison (${new Date(run.at).toLocaleDateString('en-US')})`),
      blind,
      data: { at: run.at, releases: run.releases, models: run.models.map((id) => ({ id, label: models.find((m) => m.id === id)?.label ?? id })), results },
    }).catch(() => ({ error: t('링크를 만들지 못했습니다. 다시 눌러 주세요.', 'Could not create the link. Please try again.') } as { token?: string; error?: string }))
    setSharing(false)
    if (res.error || !res.token) { setShareError(res.error ?? t('링크를 만들지 못했습니다.', 'Could not create the link.')); return }
    setShareUrl(`${window.location.origin}/ai-review/${res.token}`)
    setCopied(false)
  }

  const failedJobs = run
    ? run.releases.flatMap((r) => run.models.filter((m) => { const x = run.results[key(r.id, m)]; return !x || (x !== 'running' && !x.ok) }).map((m) => ({ r, m })))
    : []

  const summary = useMemo(() => {
    if (!run) return []
    return run.models.map((id) => {
      const m = models.find((x) => x.id === id)
      const rs = run.releases.map((r) => run.results[key(r.id, id)]).filter((x): x is Extract<CompareResult, { ok: true }> => !!x && x !== 'running' && x.ok)
      const failed = run.releases.filter((r) => { const x = run.results[key(r.id, id)]; return x && x !== 'running' && !x.ok }).length
      const avg = (f: (x: (typeof rs)[number]) => number) => (rs.length ? rs.reduce((a, x) => a + f(x), 0) / rs.length : 0)
      return {
        id, label: m?.label ?? id, done: rs.length, failed,
        ms: avg((x) => x.ms), cost: avg((x) => x.costUsd),
        issues: rs.reduce((a, x) => a + x.issues.length, 0),
        chars: avg((x) => x.draft.paragraphs.join('').length),
      }
    })
  }, [run, models])

  const total = run ? run.releases.length * run.models.length : 0
  const finished = run ? Object.values(run.results).filter((x) => x !== 'running').length : 0

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-line bg-white p-5">
        <h2 className="text-[15px] font-bold">{t('비교할 모델', 'Models to compare')}</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {models.map((m) => (
            <label key={m.id} className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-[13.5px] ${m.ready ? 'cursor-pointer border-line hover:border-ink' : 'border-dashed border-line opacity-60'}`}>
              <input type="checkbox" disabled={!m.ready || busy} checked={picked.includes(m.id)} onChange={(e) => setPicked(e.target.checked ? [...picked, m.id] : picked.filter((x) => x !== m.id))} />
              <span>
                <strong>{m.label}</strong>
                <span className="ml-1.5 text-[11.5px] text-muted">${m.input} / ${m.output}</span>
                {!m.ready && <span className="ml-1.5 text-[11.5px] text-danger">{m.id.startsWith('gemini') ? t('GEMINI_API_KEY 필요', 'GEMINI_API_KEY required') : t('ANTHROPIC_API_KEY 필요', 'ANTHROPIC_API_KEY required')}</span>}
              </span>
            </label>
          ))}
        </div>
        <h2 className="mt-6 text-[15px] font-bold">{t('비교할 자료', 'Material to compare')}</h2>
        <div className="mt-3 space-y-3">
          <label className="flex items-center gap-2 text-[13.5px]">
            <input type="checkbox" checked={includeRecent} disabled={busy} onChange={(e) => setIncludeRecent(e.target.checked)} />
            {t('보도자료함의 최근 보도자료 10건', '10 most recent press releases in the press release inbox')}
          </label>
          <div className="rounded-lg border border-dashed border-line p-3">
            <div className="flex flex-wrap items-center gap-2">
              <strong className="text-[13.5px]">{t(`내 자료 ${custom.length}건`, `My material: ${custom.length}`)}</strong>
              <label className={`cursor-pointer rounded-lg border border-line bg-white px-3 py-1.5 text-[13px] font-semibold hover:border-ink ${busy || reading ? 'pointer-events-none opacity-50' : ''}`}>
                {reading ? t('읽는 중…', 'Reading…') : t('파일 올리기 (한글·워드·txt)', 'Upload files (HWP, Word, txt)')}
                <input type="file" accept={DOC_ACCEPT} multiple className="sr-only" onChange={(e) => { addFiles(e.target.files); e.target.value = '' }} />
              </label>
              <button type="button" disabled={busy} onClick={() => setPasteOpen(!pasteOpen)} className="rounded-lg border border-line bg-white px-3 py-1.5 text-[13px] hover:border-ink">
                {pasteOpen ? t('붙여넣기 닫기', 'Close paste box') : t('글 붙여넣기', 'Paste text')}
              </button>
              {missingTest.length > 0 && !busy && (
                <button type="button" onClick={() => setCustom(withTestSet(custom))} className="rounded-lg border border-line bg-white px-3 py-1.5 text-[13px] hover:border-ink">
                  {t(`시험 자료 ${missingTest.length}건 넣기`, `Add ${missingTest.length} test ${missingTest.length === 1 ? 'item' : 'items'}`)}
                </button>
              )}
              {custom.length > 0 && !busy && (
                <button type="button" onClick={() => setCustom([])} className="ml-auto text-[12px] text-muted underline underline-offset-2 hover:text-danger">{t('모두 빼기', 'Remove all')}</button>
              )}
            </div>
            <p className="mt-1.5 text-[11.5px] text-muted">{t('파일은 서버로 보내지 않고 이 브라우저에서 글자만 읽어 비교에 씁니다. 한글(.hwp .hwpx)·워드(.doc .docx)·텍스트(.txt)를 읽습니다.', 'Files are not sent to the server; the text is read in this browser only and used for the comparison. HWP (.hwp .hwpx), Word (.doc .docx) and text (.txt) files can be read.')}</p>
            {pasteOpen && (
              <div className="mt-2 space-y-2">
                <textarea value={pasteText} onChange={(e) => setPasteText(e.target.value)} rows={6} placeholder={t('보도자료 전문을 붙여넣으세요. 첫 줄을 제목으로 씁니다.', 'Paste the full press release. The first line is used as the title.')} className="w-full rounded-md border border-line px-3 py-2 text-[13px] outline-none focus:border-ink" />
                <button type="button" onClick={addPasted} className="btn-secondary px-4 py-1.5 text-[13px]">{t('내 자료에 추가', 'Add to my material')}</button>
              </div>
            )}
            {fileError && <p role="alert" className="mt-2 whitespace-pre-line text-[12.5px] text-danger">{fileError}</p>}
            {custom.length > 0 && (
              <ul className="mt-2 divide-y divide-line rounded-md border border-line bg-white">
                {custom.map((c) => (
                  <li key={c.id} className="flex items-center gap-3 px-3 py-2 text-[13px]">
                    <span className="min-w-0 flex-1 truncate">{c.title}</span>
                    <span className="shrink-0 text-[11.5px] tabular-nums text-muted">{t(`${c.text.length.toLocaleString()}자`, `${c.text.length.toLocaleString('en-US')} chars`)}</span>
                    {!busy && <button type="button" onClick={() => setCustom(custom.filter((x) => x.id !== c.id))} className="shrink-0 text-[12px] text-muted hover:text-danger" aria-label={t(`${c.title} 빼기`, `Remove ${c.title}`)}>{t('빼기', 'Remove')}</button>}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button type="button" onClick={start} disabled={busy || reading || !picked.length || !releaseCount} className="btn-publish px-5">
            {busy ? t(`비교 중… ${finished}/${total}`, `Comparing… ${finished}/${total}`) : t(`비교 시작 (자료 ${releaseCount}건 × 모델 ${picked.length}개)`, `Start comparison (${releaseCount} ${releaseCount === 1 ? 'item' : 'items'} × ${picked.length} ${picked.length === 1 ? 'model' : 'models'})`)}
          </button>
          {!busy && failedJobs.length > 0 && (
            <button type="button" onClick={() => { setError(''); runJobs(failedJobs) }} className="rounded-lg border border-line px-4 py-2 text-[13.5px] font-semibold hover:border-ink">
              {t(`실패한 ${failedJobs.length}건만 다시`, `Retry only the ${failedJobs.length} failed`)}
            </button>
          )}
          {!busy && picked.length > 0 && <span className="text-[12.5px] text-muted">{t('예상 비용 약', 'Estimated cost about')} {won(estimate)} · {t('보통 2~4분 걸립니다', 'usually takes 2–4 minutes')}</span>}
          {!ready.length && <span className="text-[12.5px] text-danger">{t('Vercel에 AI 키를 넣고 다시 배포해야 비교할 수 있습니다.', 'Add the AI keys in Vercel and redeploy before you can compare.')}</span>}
        </div>
        {error && <p role="alert" className="mt-2 text-[13px] text-danger">{error}</p>}
      </section>

      <section className="rounded-lg border border-line bg-white p-5">
        <h2 className="text-[15px] font-bold">{t('다른 기자에게 검토받기', 'Get a review from other reporters')}</h2>
        <p className="mt-1 text-[12.5px] leading-relaxed text-muted">
          {t('링크를 보내면 로그인 없이 초안을 보고 자료마다 가장 좋은 초안을 골라 의견을 남길 수 있습니다. 결과는 이 화면 맨 위 “받은 검토”에 모입니다. 링크는 30일 동안 쓸 수 있습니다.', 'Send the link and reviewers can read the drafts without logging in, pick the best draft for each item and leave comments. Results are collected under “Reviews received” at the top of this page. The link works for 30 days.')}
        </p>
        {busy ? (
          <p className="mt-3 rounded-md bg-[#F8F9FA] px-3 py-2.5 text-[13px] text-muted">{t('비교가 끝나면 링크를 만들 수 있습니다.', 'You can create the link once the comparison finishes.')}</p>
        ) : !run || finished === 0 ? (
          <p className="mt-3 rounded-md bg-[#F8F9FA] px-3 py-2.5 text-[13px] leading-relaxed text-muted">
            {t(`이 브라우저에 비교 결과가 없습니다. 비교 결과는 비교를 실행한 컴퓨터·브라우저에만 남습니다.
            그 브라우저에서 이 화면을 열거나, 위에서 비교를 한 번 더 실행하면 바로 링크를 만들 수 있습니다.`, `There are no comparison results in this browser. Results stay only on the computer and browser where the comparison was run.
            Open this page in that browser, or run the comparison again above, and you can create the link right away.`)}
          </p>
        ) : (
          <>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <input
                value={shareTitle}
                onChange={(e) => setShareTitle(e.target.value)}
                maxLength={80}
                placeholder={t(`제목 (예: AI 초안 비교 ${new Date(run!.at).toLocaleDateString('ko-KR')})`, `Title (e.g. AI draft comparison ${new Date(run!.at).toLocaleDateString('en-US')})`)}
                className="w-full rounded-md border border-line px-3 py-2 text-[13.5px] outline-none focus:border-ink sm:w-auto sm:min-w-[260px] sm:flex-1"
              />
              <label className="flex items-center gap-2 text-[13px]">
                <input type="checkbox" checked={blind} onChange={(e) => setBlind(e.target.checked)} />
                {t('AI 이름 가리기(블라인드)', 'Hide AI names (blind)')}
              </label>
              <button type="button" onClick={share} disabled={sharing} className="btn-publish px-5">
                {sharing ? t('만드는 중…', 'Creating…') : t('검토 링크 만들기', 'Create review link')}
              </button>
            </div>
            {blind && <p className="mt-1.5 text-[11.5px] text-muted">{t('블라인드: 초안이 A·B·C로만 보이고 자료마다 순서가 섞입니다. 시간·비용도 가립니다. 검토를 보낸 뒤에 공개됩니다.', 'Blind: drafts are shown only as A, B and C, and the order is shuffled for each item. Time and cost are hidden too. They are revealed after a review is submitted.')}</p>}
            {shareError && <p role="alert" className="mt-2 text-[13px] text-danger">{shareError}</p>}
            {shareUrl && (
              <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg bg-published/5 p-3">
                <input readOnly value={shareUrl} onFocus={(e) => e.target.select()} className="min-w-0 flex-1 rounded-md border border-line bg-white px-3 py-2 text-[13px]" />
                <button
                  type="button"
                  onClick={async () => { try { await navigator.clipboard.writeText(shareUrl); setCopied(true) } catch {} }}
                  className="rounded-lg border border-published px-4 py-2 text-[13px] font-semibold text-published"
                >
                  {copied ? t('복사됨 ✓', 'Copied ✓') : t('링크 복사', 'Copy link')}
                </button>
                <a href={shareUrl} target="_blank" rel="noreferrer" className="text-[13px] text-review underline underline-offset-2">{t('미리 보기', 'Preview')}</a>
              </div>
            )}
          </>
        )}
      </section>

      {run && (
        <>
          <section className="overflow-x-auto rounded-lg border border-line bg-white">
            <h2 className="border-b border-line px-5 py-3 text-[15px] font-bold">
              {t('요약', 'Summary')} <span className="text-[12px] font-normal text-muted">{new Date(run.at).toLocaleString(loc)} · {t(`보도자료 ${run.releases.length}건`, `${run.releases.length} press ${run.releases.length === 1 ? 'release' : 'releases'}`)}</span>
            </h2>
            <table className="table-cards w-full text-[13.5px] tabular-nums md:min-w-[760px]">
              <thead>
                <tr className="border-b border-line text-left text-[12px] text-muted">
                  <th className="px-5 py-2 font-medium">{t('모델', 'Model')}</th><th className="px-3 py-2 text-right font-medium">{t('완료', 'Done')}</th><th className="px-3 py-2 text-right font-medium">{t('실패', 'Failed')}</th>
                  <th className="px-3 py-2 text-right font-medium">{t('평균 시간', 'Avg. time')}</th><th className="px-3 py-2 text-right font-medium">{t('기사 1건 비용', 'Cost per story')}</th><th className="px-3 py-2 text-right font-medium">{t('하루 10건 한 달', '10 per day, monthly')}</th>
                  <th className="px-3 py-2 text-right font-medium">{t('원문에 없는 숫자·인용', 'Numbers/quotes not in source')}</th><th className="px-5 py-2 text-right font-medium">{t('평균 본문 길이', 'Avg. body length')}</th>
                </tr>
              </thead>
              <tbody>
                {summary.map((s) => (
                  <tr key={s.id} className="border-b border-line/60 last:border-0">
                    <td className="tc-full px-5 py-2.5 font-bold">{s.label}</td>
                    <td data-label={t('완료', 'Done')} className="px-3 py-2.5 text-right">{s.done}</td>
                    <td data-label={t('실패', 'Failed')} className={`px-3 py-2.5 text-right ${s.failed ? 'font-bold text-danger' : ''}`}>{s.failed}</td>
                    <td data-label={t('평균 시간', 'Avg. time')} className="px-3 py-2.5 text-right">{s.done ? t(`${(s.ms / 1000).toFixed(1)}초`, `${(s.ms / 1000).toFixed(1)}s`) : '-'}</td>
                    <td data-label={t('1건 비용', 'Cost per story')} className="px-3 py-2.5 text-right">{s.done ? won(s.cost) : '-'}</td>
                    <td data-label={t('하루 10건 한 달', '10 per day, monthly')} className="px-3 py-2.5 text-right">{s.done ? won(s.cost * 300) : '-'}</td>
                    <td data-label={t('원문에 없는 숫자·인용', 'Numbers/quotes not in source')} className={`px-3 py-2.5 text-right ${s.issues ? 'font-bold text-danger' : 'text-published'}`}>{s.done ? t(`${s.issues}건`, String(s.issues)) : '-'}</td>
                    <td data-label={t('평균 본문 길이', 'Avg. body length')} className="px-5 py-2.5 text-right">{s.done ? t(`${Math.round(s.chars).toLocaleString()}자`, `${Math.round(s.chars).toLocaleString('en-US')} chars`) : '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="border-t border-line px-5 py-2.5 text-[11.5px] text-muted">
              {t(`비용은 실제 사용 토큰 × 공시 가격(1달러 ${WON}원)으로 계산했습니다. “원문에 없는 숫자·인용”은 자동 점검이라 표현만 바뀐 경우도 잡힐 수 있으니, 아래에서 직접 확인하세요.`, `Cost is the actual tokens used × the published price (USD 1 = KRW ${WON}). “Numbers/quotes not in source” is an automatic check and can also flag cases where only the wording changed, so verify below.`)}
            </p>
          </section>


          <nav className="rounded-lg border border-line bg-white px-5 py-3" aria-label={t('자료 목록', 'Material list')}>
            <p className="text-[12.5px] font-bold text-muted">{t(`자료 ${run.releases.length}건 — 누르면 해당 자료로 이동`, `${run.releases.length} ${run.releases.length === 1 ? 'item' : 'items'} — click to jump to it`)}</p>
            <ol className="mt-2 grid gap-x-6 gap-y-1 text-[13px] md:grid-cols-2">
              {run.releases.map((r, idx) => {
                const fails = run.models.filter((m) => { const x = run.results[key(r.id, m)]; return x && x !== 'running' && !x.ok }).length
                return (
                  <li key={r.id} className="flex min-w-0 items-center gap-2">
                    <span className="w-5 shrink-0 text-right tabular-nums text-muted">{idx + 1}</span>
                    {/^(test|file|paste)-/.test(r.id) && (
                      <span className="shrink-0 rounded bg-review/10 px-1.5 text-[10.5px] font-semibold text-review">{t('내 자료', 'Mine')}</span>
                    )}
                    <a href={`#rel-${idx + 1}`} className="min-w-0 truncate hover:underline">{r.title}</a>
                    {fails > 0 && <span className="shrink-0 text-[11px] font-semibold text-danger">{t(`실패 ${fails}`, `${fails} failed`)}</span>}
                  </li>
                )
              })}
            </ol>
          </nav>

          <div className="space-y-4">
            {run.releases.map((r, idx) => (
              <section key={r.id} id={`rel-${idx + 1}`} className="scroll-mt-4 rounded-lg border border-line bg-white">
                <div className="flex flex-wrap items-center gap-2 border-b border-line px-5 py-3">
                  <span className="text-[12px] font-bold text-muted">{idx + 1}</span>
                  <h3 className="min-w-[10rem] flex-1 truncate text-[14.5px] font-bold">{r.title}</h3>
                  <span className="text-[11.5px] text-muted">{r.source}</span>
                  <button type="button" onClick={() => setOpen(open === r.id ? null : r.id)} className="text-[12px] text-review underline underline-offset-2">{open === r.id ? t('원문 접기', 'Hide source') : t('원문 보기', 'View source')}</button>
                </div>
                {open === r.id && <p className="max-h-72 overflow-y-auto whitespace-pre-line border-b border-line bg-[#F8F9FA] px-5 py-3 text-[12.5px] leading-relaxed">{r.text}</p>}
                {/* 휴대폰에서는 모델 칸을 위아래로 쌓는다 (컴퓨터에서는 나란히, 넓으면 옆으로 밀어 보기) */}
                <div className="md:overflow-x-auto">
                <div className="grid grid-cols-1 gap-px bg-line md:[grid-template-columns:var(--cols)]" style={{ '--cols': `repeat(${run.models.length}, minmax(260px, 1fr))` } as React.CSSProperties}>
                  {run.models.map((m) => {
                    const res = run.results[key(r.id, m)]
                    const label = models.find((x) => x.id === m)?.label ?? m
                    return (
                      <div key={m} className="min-w-0 bg-white p-4">
                        <p className="mb-2 flex items-center gap-2 text-[11.5px] font-bold text-muted">
                          {label}
                          {res && res !== 'running' && res.ok && <span className="font-normal">{(res.ms / 1000).toFixed(1)}{t('초', 's')} · {won(res.costUsd)}</span>}
                        </p>
                        {!res ? <p className="text-[12.5px] text-muted">{t('대기 중', 'Waiting')}</p>
                          : res === 'running' ? <p className="text-[12.5px] text-review">{t('작성 중…', 'Writing…')}</p>
                          : !res.ok ? <p className="text-[12.5px] text-danger">{t('실패', 'Failed')}: {res.error}</p>
                          : (
                            <div className="text-[13px] leading-relaxed">
                              {res.issues.length > 0 && (
                                <p className="mb-2 rounded bg-danger/5 px-2 py-1.5 text-[11.5px] text-danger">
                                  {t('⚠ 원문에 없는', '⚠ Not in the source:')} {res.issues.map((i) => (i.kind === 'number' ? t(`숫자 ${i.text}`, `number ${i.text}`) : t(`인용 “${i.text}”`, `quote “${i.text}”`))).join(', ')}
                                </p>
                              )}
                              <p className="text-[15px] font-bold leading-snug">{res.draft.title}</p>
                              {res.draft.subtitle && <p className="mt-1 text-[12.5px] text-muted">{res.draft.subtitle}</p>}
                              <div className="mt-2 space-y-1.5">{res.draft.paragraphs.map((p, i) => <p key={i}>{p}</p>)}</div>
                              {res.draft.review_notes.length > 0 && (
                                <div className="mt-2 rounded bg-[#FFF8E6] px-2 py-1.5 text-[11.5px]">
                                  <strong>{t('기자 확인 메모', 'Notes for the reporter to check')}</strong>
                                  {res.draft.review_notes.map((n, i) => <p key={i}>• {n}</p>)}
                                </div>
                              )}
                            </div>
                          )}
                      </div>
                    )
                  })}
                </div>
                </div>
              </section>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
