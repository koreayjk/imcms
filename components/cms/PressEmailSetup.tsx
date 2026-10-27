'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { getMyInbox, requestPressAddon, type MyInbox } from '@/app/(main)/press/email/actions'
import { formatDateTime } from '@/lib/format'
import { PRESS_MAIL_ADDON_FEE, PRESS_MAIL_TRIAL } from '@/lib/pricing'
import { useT, useCmsLang } from '@/components/cms/CmsLang'

const FILTER_WORDS = '보도자료 OR 보도참고자료 OR 배포자료 OR "press release"'
// 영어 화면: 영문 보도자료 제목에도 걸리도록 영어 낱말을 앞에 둔다 (한국어 낱말도 그대로 남긴다)
const FILTER_WORDS_EN = '"press release" OR "news release" OR "media advisory" OR 보도자료 OR 보도참고자료 OR 배포자료'

function CopyButton({ text, label }: { text: string; label?: string }) {
  const t = useT()
  const [done, setDone] = useState(false)
  return (
    <button
      type="button"
      onClick={async () => {
        try { await navigator.clipboard.writeText(text) } catch { window.prompt(t('아래 내용을 복사하세요', 'Copy the text below'), text) }
        setDone(true)
        setTimeout(() => setDone(false), 1800)
      }}
      className={`shrink-0 rounded px-3 py-1.5 text-[12.5px] font-semibold ${done ? 'bg-published text-white' : 'bg-ink text-white hover:opacity-90'}`}
    >
      {done ? t('복사됨 ✓', 'Copied ✓') : (label ?? t('복사', 'Copy'))}
    </button>
  )
}

function Copyable({ text }: { text: string }) {
  return (
    <div className="mt-2 flex items-center gap-2 rounded border border-line bg-[#F8F9FA] py-1.5 pl-3 pr-1.5">
      <code className="min-w-0 flex-1 truncate text-[13px]">{text}</code>
      <CopyButton text={text} />
    </div>
  )
}

// 메뉴 이름은 실제 화면 글자와 같게 굵게 표시한다
function Btn({ children }: { children: ReactNode }) {
  return <strong className="rounded bg-line/70 px-1.5 py-px font-semibold text-ink">{children}</strong>
}

// 지메일 화면 바로 열기 (u/0 = 지금 로그인한 첫 번째 계정)
const GMAIL_FORWARD = 'https://mail.google.com/mail/u/0/#settings/fwdandpop'
const GMAIL_FILTERS = 'https://mail.google.com/mail/u/0/#settings/filters'
const STEP_KEY = 'im_press_mail_step'

function OpenGmail({ href, children, onClick }: { href: string; children: ReactNode; onClick?: () => void }) {
  return (
    <a href={href} target="_blank" rel="noopener" onClick={onClick} className="inline-flex items-center gap-1.5 rounded-md bg-[#1A73E8] px-4 py-2.5 text-[14px] font-semibold text-white hover:bg-[#1765CC]">
      {children} <span aria-hidden>↗</span>
    </a>
  )
}

// 부가 서비스(월 39,000원) 안내: 체험 중이거나 체험을 다 쓴 베이직·스탠다드 매체에 보인다
function AddonNotice({ inbox }: { inbox: MyInbox }) {
  const t = useT()
  const en = useCmsLang() === 'en'
  const [state, setState] = useState<'idle' | 'busy' | 'done' | 'already'>('idle')
  const [err, setErr] = useState('')
  const left = inbox.trial_left ?? 0
  const fee = PRESS_MAIL_ADDON_FEE.toLocaleString(en ? 'en-US' : 'ko-KR')
  const lost = inbox.dropped_week ?? 0
  const apply = async () => {
    setState('busy'); setErr('')
    const res = await requestPressAddon()
    if (res.error) { setErr(res.error); setState('idle'); return }
    setState(res.already ? 'already' : 'done')
  }
  return (
    <section className={`rounded-lg border px-5 py-4 ${left > 0 ? 'border-review/40 bg-review/5' : 'border-draft/50 bg-draft/10'}`}>
      <h2 className="text-[15px] font-bold">
        {left > 0 ? (en ? `Add-on trial in progress — ${left} ${left === 1 ? 'email' : 'emails'} left` : `부가 서비스 체험 중 — 메일 ${left}통 남았습니다`) : t('체험이 끝났습니다 — 이제 오는 메일은 받지 못합니다', 'Your trial has ended — new emails can no longer be received')}
      </h2>
      <p className="mt-1.5 text-[13.5px] leading-relaxed">
        {left > 0
          ? (en
            ? <>Your first {PRESS_MAIL_TRIAL} emails are free. Press releases are added to the press inbox automatically, text from attachments (Hangul, Word, PDF, text) is inserted into the body, and the AI reads the email body and attachments together to write a draft.</>
            : <>처음 {PRESS_MAIL_TRIAL}통은 무료로 받아 볼 수 있습니다. 보도자료가 자동으로 보도자료함에 들어오고, 첨부파일(한글·워드·PDF·텍스트) 내용이 본문에 들어오고, AI가 메일 본문과 첨부를 함께 읽고 초안을 씁니다.</>)
          : (en
            ? <>{lost > 0 ? <strong className="text-danger">{lost} {lost === 1 ? 'email' : 'emails'} arrived in the last 7 days but could not be received. </strong> : null}Press releases you already received can still be used. To keep receiving new emails, please apply for the add-on.</>
            : <>{lost > 0 ? <strong className="text-danger">최근 7일 동안 {lost}통이 도착했지만 받지 못했습니다. </strong> : null}이미 받은 보도자료는 그대로 쓸 수 있고, 새 메일을 계속 받으려면 부가 서비스를 신청해 주세요.</>)}
      </p>
      <p className="mt-1.5 text-[13.5px]"><strong>{en ? `Automatic press release email intake · KRW ${fee}/month` : `보도자료 메일 자동 수신 · 월 ${fee}원`}</strong> <span className="text-muted">{t('(프리미엄 요금제는 기본 포함 · 켠 달은 남은 일수만큼 일할 계산해 다음 청구서에 포함)', '(Included with the Premium plan · in the month you turn it on, the fee is prorated by the remaining days and added to your next invoice)')}</span></p>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        {state === 'done' || state === 'already'
          ? <p role="status" className="rounded bg-published/10 px-3 py-2 text-[13px] font-semibold text-published">{state === 'already' ? t('이미 신청이 접수돼 있습니다. 운영팀이 확인해 켜 드립니다.', 'Your request has already been received. The IM Newsroom team will review it and turn the add-on on for you.') : t('신청이 접수됐습니다. 운영팀이 확인해 켜 드리고, 켜지면 바로 메일을 받습니다.', 'Your request has been received. The IM Newsroom team will review it and turn the add-on on, and you will start receiving emails right away.')}</p>
          : <button type="button" onClick={apply} disabled={state === 'busy'} className="rounded bg-ink px-4 py-2 text-[13.5px] font-semibold text-white hover:opacity-90 disabled:opacity-60">{state === 'busy' ? t('신청 중…', 'Applying…') : (en ? `Apply for the add-on (KRW ${fee}/month)` : `부가 서비스 신청하기 (월 ${fee}원)`)}</button>}
        {err && <span role="alert" className="text-[13px] text-danger">{err}</span>}
      </div>
    </section>
  )
}

export default function PressEmailSetup({ initial }: { initial: MyInbox | null }) {
  const t = useT()
  const lang = useCmsLang()
  const en = lang === 'en'
  const [inbox, setInbox] = useState(initial)
  const [mode, setMode] = useState<'auto' | 'manual'>('auto')
  const [step, setStep] = useState(1)
  const [watching, setWatching] = useState(false)

  // 어디까지 했는지 기억 (창을 닫았다 와도 이어서)
  useEffect(() => {
    try { const v = Number(localStorage.getItem(STEP_KEY)); if (v >= 1 && v <= 4) setStep(v) } catch { /* 없음 */ }
  }, [])
  const go = (n: number) => {
    setStep(n)
    try { localStorage.setItem(STEP_KEY, String(n)) } catch { /* 없음 */ }
    if (n === 2) setWatching(true)
  }

  // 확인 코드를 기다리는 동안 5초마다 새로 확인한다 (최대 5분)
  useEffect(() => {
    if (!watching) return
    const started = Date.now()
    const timer = setInterval(async () => {
      const { inbox: next } = await getMyInbox()
      if (next) setInbox(next)
      if (Date.now() - started > 5 * 60_000) setWatching(false)
    }, 5000)
    return () => clearInterval(timer)
  }, [watching])

  const address = inbox?.address
  const recentCode = inbox?.verify_at && Date.now() - new Date(inbox.verify_at).getTime() < 24 * 3600_000
  const receiving = (inbox?.received_count ?? 0) > 0

  if (!address) {
    return <p className="mt-6 rounded-lg border border-danger/30 bg-danger/5 px-5 py-4 text-[14px] text-danger">{t('아직 관리자가 메일 수신 설정을 마치지 않아 내 전용 주소가 없습니다. 관리자에게 문의하세요.', 'Your dedicated address is not available yet because an admin has not finished setting up email intake. Please contact an admin.')}</p>
  }

  const steps = en ? ['Register forwarding address', 'Enter confirmation code', 'Forward press releases only'] : ['전달 주소 등록', '확인 코드 넣기', '보도자료만 보내기']
  const filterWords = en ? FILTER_WORDS_EN : FILTER_WORDS

  return (
    <div className="mt-6 space-y-5">
      {inbox && inbox.mail_on === false && <AddonNotice inbox={inbox} />}
      {/* 내 전용 주소 + 받은 현황 */}
      <section className="rounded-lg border border-line bg-white px-5 py-4">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <span className="text-[13px] font-bold text-muted">{t('내 전용 주소', 'Your dedicated address')}</span>
          <code className="min-w-0 break-all text-[16px] font-bold">{address}</code>
          <CopyButton text={address} label={t('주소 복사', 'Copy address')} />
        </div>
        <p className="mt-2 text-[12.5px] text-muted">
          {receiving
            ? (en
              ? <><strong className="text-published">Receiving ✓</strong> {inbox!.received_count} so far · last {formatDateTime(inbox!.last_received_at, lang)}</>
              : <><strong className="text-published">받는 중 ✓</strong> 지금까지 {inbox!.received_count}건 · 마지막 {formatDateTime(inbox!.last_received_at)}</>)
            : t('아직 받은 보도자료가 없습니다.', 'No press releases received yet.')}
          {' '}{t('이 주소는 나만 쓰는 주소이니 다른 사람에게 알려주지 마세요.', 'This address is yours alone, so do not share it with anyone else.')}
        </p>
        {inbox?.daily_limit != null && (
          <p className="mt-1.5 text-[12.5px] text-muted">
            {en ? <>
              Your outlet (based on your plan) can receive up to <strong>{inbox.daily_limit} press releases per day</strong> by email (all reporters combined; the count resets at midnight Korea time).
              {' '}{inbox.used_today ?? 0} received today. Emails that arrive after the limit is reached are not received, so set things up to forward <strong>press releases only</strong>.
            </> : <>
              우리 언론사(요금제 기준)는 <strong>하루 {inbox.daily_limit}건</strong>까지 메일로 받습니다(기자들이 받은 것을 합쳐서, 한국 시간 0시에 새로 시작).
              오늘 {inbox.used_today ?? 0}건 받았습니다. 한도를 넘은 날의 메일은 받지 않으니 <strong>보도자료만</strong> 넘어오게 설정해 주세요.
            </>}
          </p>
        )}
        {(inbox?.dropped_today ?? 0) > 0 && (
          <p role="status" className="mt-1.5 rounded bg-danger/10 px-3 py-2 text-[12.5px] font-semibold text-danger">
            {en
              ? `${inbox!.dropped_today} ${inbox!.dropped_today === 1 ? 'email was' : 'emails were'} not received because the daily limit was reached. Receiving resumes at midnight (Korea time). Narrow your Gmail filter so that only press releases are forwarded. If you need a higher limit, let us know with a Support request.`
              : `오늘 한도를 넘어 받지 못한 메일이 ${inbox!.dropped_today}건 있습니다. 내일 0시부터 다시 받습니다. 지메일 필터를 좁혀 보도자료만 전달되게 해 주세요. 한도를 늘려야 하면 업무요청으로 알려 주세요.`}
          </p>
        )}
      </section>

      {/* 방법 고르기 */}
      <div className="grid gap-3 sm:grid-cols-2">
        {([
          ['auto', t('자동으로 받기', 'Automatic'), t('지메일 · PC에서 한 번, 약 3분', 'Gmail · set up once on a computer, about 3 minutes'), t('추천', 'Recommended')],
          ['manual', t('직접 전달하기', 'Forward manually'), t('네이버·다음 메일 · 메일 한 통씩 직접 전달', 'Other email (Naver, Daum, Outlook…) · forward each email yourself'), ''],
        ] as const).map(([k, ttl, d, badge]) => (
          <button key={k} type="button" onClick={() => setMode(k)} aria-pressed={mode === k}
            className={`rounded-lg border-2 px-5 py-4 text-left transition ${mode === k ? 'border-ink bg-white' : 'border-line bg-white/60 hover:border-ink/40'}`}>
            <span className="flex items-center gap-2 text-[15px] font-bold">{ttl}{badge && <span className="rounded bg-published/10 px-1.5 text-[11px] text-published">{badge}</span>}</span>
            <span className="mt-0.5 block text-[13px] text-muted">{d}</span>
          </button>
        ))}
      </div>

      {mode === 'auto' && (
        <section className="rounded-lg border border-line bg-white p-4 sm:p-6">
          {/* 단계 표시 */}
          <ol className="flex flex-wrap items-center gap-2 text-[13px]">
            {steps.map((label, i) => (
              <li key={label} className="flex items-center gap-2">
                <button type="button" onClick={() => go(i + 1)}
                  className={`flex items-center gap-1.5 rounded-full px-3 py-1 ${step === i + 1 ? 'bg-ink font-bold text-white' : step > i + 1 ? 'bg-published/10 font-semibold text-published' : 'bg-line/60 text-muted'}`}>
                  <span className="tabular-nums">{step > i + 1 ? '✓' : i + 1}</span> {label}
                </button>
                {i < steps.length - 1 && <span className="text-muted" aria-hidden>›</span>}
              </li>
            ))}
          </ol>

          <div className="mt-6 min-h-[200px]">
            {step === 1 && (
              <div className="space-y-4 text-[14.5px] leading-[1.8]">
                <p className="text-[17px] font-bold">{t('지메일에 내 전용 주소를 등록합니다', 'Register your dedicated address in Gmail')}</p>
                <p>
                  {en ? <>
                    Click the blue button below to open Gmail&apos;s forwarding settings.<br />
                    Click <Btn>Add a forwarding address</Btn>, then <strong>paste</strong> (Ctrl+V · ⌘+V on a Mac) → <Btn>Next</Btn> → <Btn>Proceed</Btn> → <Btn>OK</Btn>.
                  </> : <>
                    아래 파란 버튼을 누르면 지메일 전달 설정이 열립니다.<br />
                    <Btn>전달 주소 추가</Btn>를 누르고 <strong>붙여넣기</strong>(Ctrl+V · 맥은 ⌘+V) → <Btn>다음</Btn> → <Btn>계속</Btn> → <Btn>확인</Btn>.
                  </>}
                </p>
                <div className="flex flex-wrap gap-2">
                  <CopyButton text={address} label={t('① 주소 복사', '① Copy address')} />
                  <OpenGmail href={GMAIL_FORWARD} onClick={() => setWatching(true)}>{t('② 지메일 전달 설정 열기', '② Open Gmail forwarding settings')}</OpenGmail>
                </div>
                <details className="rounded-lg border border-line bg-[#FAFAFA] px-4 py-3 text-[13.5px] leading-[1.75]">
                  <summary className="cursor-pointer font-semibold">{t('전달 주소 추가 버튼이 안 보이고, 입력 칸(수신메일을 [ ] 에 전달)만 보여요', 'I don’t see the Add a forwarding address button, only an input box (“Forward a copy of incoming mail to”)')}</summary>
                  {en ? (
                    <ol className="mt-2 list-decimal space-y-1.5 pl-5">
                      <li><strong>Do not enter the address in that box.</strong> If you do, all of your incoming mail, not just press releases, will be forwarded, and you will get an error because the address has not been registered yet.</li>
                      <li>Under the box, in the help text “Tip: You can also forward only some of your mail by creating a filter!”, click the blue <Btn>creating a filter</Btn> link.</li>
                      <li>Paste into the <Btn>Has the words</Btn> field (use “Copy filter words” in step 3 below), then click <Btn>Create filter</Btn>.</li>
                      <li>Check <Btn>Forward it to</Btn> and click <Btn>Add forwarding address</Btn> → paste the copied address → <Btn>Next</Btn> → <Btn>Proceed</Btn> → <Btn>OK</Btn>.</li>
                      <li>Then go to step 2 above (Enter confirmation code) and click the Google confirmation link. Once confirmed, finish the filter as described in step 3.</li>
                    </ol>
                  ) : (
                    <ol className="mt-2 list-decimal space-y-1.5 pl-5">
                      <li><strong>그 칸에는 주소를 넣지 마세요.</strong> 넣으면 보도자료뿐 아니라 받은 메일 전체가 넘어오고, 주소를 먼저 등록하지 않아 오류도 납니다.</li>
                      <li>칸 아래 “도움말: <strong>필터를 사용</strong>하여 특정 메일을 전달할 수 있습니다”의 파란 <Btn>필터를 사용</Btn>을 누릅니다.</li>
                      <li><Btn>포함하는 단어</Btn> 칸에 붙여넣기(아래 ③단계의 “필터 단어 복사”) 후 <Btn>필터 만들기</Btn>.</li>
                      <li><Btn>다음 주소로 전달</Btn>을 체크하고 <Btn>전달 주소 추가</Btn> → 복사한 주소 붙여넣기 → <Btn>다음</Btn> → <Btn>계속</Btn> → <Btn>확인</Btn>.</li>
                      <li>그다음 위 ②단계(확인 코드 넣기)로 가서 구글 확인 링크를 누르세요. 확인이 끝나면 ③단계 안내대로 필터를 마무리합니다.</li>
                    </ol>
                  )}
                </details>
                <p className="text-[12.5px] text-muted">{t('PC 인터넷 창에서 해 주세요(휴대폰 지메일 앱에는 이 메뉴가 없습니다). 한 번만 하면 휴대폰으로 받은 메일도 똑같이 들어옵니다.', 'Do this in a desktop web browser (the Gmail mobile app does not have this menu). Once set up, mail you receive on your phone is forwarded the same way.')}</p>
                <button type="button" onClick={() => go(2)} className="btn-primary">{t('다 했어요, 다음 →', 'Done, next →')}</button>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-4 text-[14.5px] leading-[1.8]">
                <p className="text-[17px] font-bold">{t('구글 확인 코드를 넣습니다', 'Enter the Google confirmation code')}</p>
                <div className={`rounded-lg border-2 px-5 py-4 ${recentCode ? 'border-published bg-published/5' : 'border-dashed border-line'}`} aria-live="polite">
                  {recentCode && inbox?.verify_code ? (
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="text-[30px] font-extrabold tracking-[0.12em] tabular-nums">{inbox.verify_code}</span>
                      <CopyButton text={inbox.verify_code} label={t('코드 복사', 'Copy code')} />
                      {inbox.verify_link && <a href={inbox.verify_link} target="_blank" rel="noopener noreferrer" className="text-[13px] font-semibold text-review underline underline-offset-2">{t('또는 이 링크 누르기 ↗', 'Or click this link ↗')}</a>}
                    </div>
                  ) : recentCode && inbox?.verify_link ? (
                    <a href={inbox.verify_link} target="_blank" rel="noopener noreferrer" className="font-semibold text-review underline underline-offset-2">{t('구글 확인 링크 누르기 ↗', 'Click the Google confirmation link ↗')}</a>
                  ) : (
                    <p className="text-[13.5px] text-muted">{watching ? t('⏳ 구글 확인 메일을 기다리는 중… 보통 1분 안에 여기에 코드가 나타납니다.', '⏳ Waiting for the Google confirmation email… The code usually appears here within a minute.') : t('코드가 아직 없습니다. 1단계를 마쳤다면 ', 'No code yet. If you have finished step 1, ')}{!watching && <button type="button" onClick={() => setWatching(true)} className="font-semibold text-review underline underline-offset-2">{t('다시 확인', 'check again')}</button>}</p>
                  )}
                </div>
                {en
                  ? <p>If a <strong>link</strong> appears, click it and press <Btn>Confirm</Btn> on the Google page that opens (you have succeeded when it says the address can now forward mail to you). If a <strong>6-digit code</strong> appears, go back to Gmail, paste it into the <Btn>Confirmation code</Btn> field, and click <Btn>Verify</Btn>.</p>
                  : <p><strong>링크</strong>가 나왔다면 눌러서 열린 구글 화면에서 <Btn>확인</Btn>을 누르면 끝납니다(“이제 …님이 메일을 전달할 수 있습니다” 문구가 나오면 성공). <strong>6자리 코드</strong>가 나왔다면 지메일 화면으로 돌아가 <Btn>확인 코드</Btn> 칸에 붙여넣고 <Btn>확인</Btn>.</p>}
                <p className="text-[13px] text-[#6B5F22]">{en ? <>⚠ Leave <strong>“Disable forwarding” as is</strong> below it. If you change it, all of your personal email will be forwarded too.</> : <>⚠ 그 아래 <strong>“전달 사용 중지”는 그대로</strong> 두세요. 바꾸면 개인 메일까지 모두 넘어옵니다.</>}</p>
                <button type="button" onClick={() => go(3)} className="btn-primary">{t('다 했어요, 다음 →', 'Done, next →')}</button>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-4 text-[14.5px] leading-[1.8]">
                <p className="text-[17px] font-bold">{t('보도자료 메일만 보내도록 정합니다', 'Forward press release emails only')}</p>
                <p>{en ? <>The button below opens Gmail&apos;s <strong>filter settings</strong>.</> : <>아래 버튼을 누르면 지메일의 <strong>필터 설정</strong>이 열립니다.</>}</p>
                <div className="flex flex-wrap gap-2">
                  <CopyButton text={filterWords} label={t('① 필터 단어 복사', '① Copy filter words')} />
                  <OpenGmail href={GMAIL_FILTERS}>{t('② 지메일 필터 설정 열기', '② Open Gmail filter settings')}</OpenGmail>
                </div>
                {en ? (
                  <ol className="list-decimal space-y-1 pl-5">
                    <li>Click the blue <Btn>Create a new filter</Btn> link in the middle</li>
                    <li><strong>Paste</strong> the words you copied in ① into the <Btn>Has the words</Btn> field, then click <Btn>Create filter</Btn> at the bottom right</li>
                    <li>Check <Btn>Forward it to</Btn> and choose your dedicated address</li>
                    <li>Do <strong>not check</strong> “Also apply filter to matching conversations” at the bottom (if you do, your old emails are forwarded all at once)</li>
                    <li>Click the blue <Btn>Create filter</Btn></li>
                  </ol>
                ) : (
                  <ol className="list-decimal space-y-1 pl-5">
                    <li>가운데 파란 글씨 <Btn>새 필터 만들기</Btn> 누르기</li>
                    <li><Btn>포함하는 단어</Btn> 칸에 <strong>붙여넣기</strong>(①에서 복사한 단어) 후 오른쪽 아래 <Btn>필터 만들기</Btn></li>
                    <li><Btn>전달</Btn>에 체크하고 내 전용 주소 고르기</li>
                    <li>맨 아래 “일치하는 대화 n개에도 필터 적용”은 <strong>체크하지 마세요</strong>(체크하면 예전 메일까지 한꺼번에 넘어옵니다)</li>
                    <li>파란 <Btn>필터 만들기</Btn></li>
                  </ol>
                )}
                <p className="text-[12.5px] text-muted">{en ? <>If a different Google account opens because you are signed in to several, change the number in <code>/u/0/</code> at the start of the address to your account number (<code>/u/1/</code>, etc.) or switch accounts at the top right of Gmail.</> : <>지메일 계정이 여러 개라 다른 계정이 열리면, 주소 맨 앞 <code>/u/0/</code>의 숫자를 내 계정 번호(<code>/u/1/</code> 등)로 바꾸거나 지메일 오른쪽 위에서 계정을 바꿔 주세요.</>}</p>
                <button type="button" onClick={() => go(4)} className="btn-primary">{t('설정 끝 ✓', 'Setup done ✓')}</button>
              </div>
            )}

            {step === 4 && (
              <div className="space-y-3 text-[14.5px] leading-[1.8]">
                <p className="text-[17px] font-bold text-published">{t('설정이 끝났습니다 ✓', 'Setup is complete ✓')}</p>
                <p>{en ? <>From now on, <strong>when a new press release email arrives</strong>, it appears in the press inbox within 1 to 2 minutes with an “Email” label (emails you already received are not forwarded).</> : <>이제 <strong>보도자료 메일이 새로 오면</strong> 1~2분 안에 보도자료함에 “메일” 표시로 들어옵니다(이미 받은 메일은 넘어가지 않습니다).</>}</p>
                <p className="text-[13.5px] text-muted">{t('시험해 보려면: 다른 메일 계정에서 제목에 “보도자료”를 넣어 내 지메일로 보내 보세요. 위의 “받는 중 ✓”이 나타나면 성공입니다.', 'To test it: from another email account, send an email with “press release” in the subject to your Gmail. If “Receiving ✓” appears above, it worked.')}</p>
                <button type="button" onClick={() => go(1)} className="text-[13px] text-muted underline underline-offset-2">{t('처음부터 다시 보기', 'Start over')}</button>
              </div>
            )}
          </div>
        </section>
      )}

      {mode === 'manual' && (
        en ? (
          <section className="space-y-4 rounded-lg border border-line bg-white p-4 text-[14.5px] sm:p-6 leading-[1.8]">
            <p className="rounded-lg border border-draft/40 bg-draft/10 px-4 py-3 text-[14px] font-semibold leading-relaxed">
              Only Gmail can forward press releases to the press inbox automatically. With any other email service (Naver Mail, Daum Mail, Outlook, and so on), you <strong>forward each press release email yourself</strong>.
              If you receive press releases often, <strong className="text-published">we recommend using Gmail</strong> (“Automatic” above). Manual forwarding works just as well, so follow the steps below.
            </p>
            <p className="text-[17px] font-bold">How to forward manually</p>
            <p className="text-[13.5px] text-muted">Save your dedicated address once as a contact in your email service. After that, you only need to open a press release email and click <Btn>Forward</Btn> (5 seconds per email), and it goes into the press inbox. Naver Mail, a popular Korean service, <strong>has no automatic forwarding</strong> (its “Auto-sort mail” settings only offer moving to a folder, marking as read, marking important, color, and delete), so the steps below use Naver Mail as the example. Other services work the same way; only the place where you save a contact differs.</p>

            <div className="rounded-lg bg-[#F8F9FA] px-4 py-4">
              <p className="font-bold">① One time only: save your dedicated address as a contact</p>
              <p className="mt-1 text-[13px] text-muted">First copy your <strong>dedicated address</strong> from above. <CopyButton text={address} label="Copy address" /></p>
              <ol className="mt-2 list-decimal space-y-1 pl-5">
                <li>In <strong>Naver Mail</strong>, click the <strong>person icon (Contacts)</strong> among the icons at the top center to go to your contacts.</li>
                <li>Click <Btn>Add contact</Btn> at the top left to open the input window.</li>
                <li>In the <strong>name</strong> field, type <strong>IM Press Inbox</strong>. <span className="text-muted">(You can leave the family-name field empty. Any easily recognizable name works.)</span></li>
                <li>Paste your copied <strong>dedicated address</strong> into the <strong>email</strong> field <span className="text-muted">(Ctrl+V · ⌘+V on a Mac)</span>. It goes in the email field, not the name field.</li>
                <li>Click <Btn>Save</Btn> and you are done. Leave the other fields empty.</li>
              </ol>
            </div>

            <div className="rounded-lg bg-[#F8F9FA] px-4 py-4">
              <p className="font-bold">② Each time a press release email arrives</p>
              <ol className="mt-2 list-decimal space-y-1 pl-5">
                <li>Open the press release email in your inbox and click <Btn>Forward</Btn>.</li>
                <li>Type <strong>IM</strong> in the <strong>To</strong> field, and the <strong>IM Press Inbox</strong> contact you saved appears. Select it.</li>
                <li>Click <Btn>Send</Btn> and you are done. You can leave the message body empty.</li>
              </ol>
            </div>

            <p className="text-[13px] text-muted">IM Newsroom automatically finds the sender, title, and attached photos and adds the press release to the press inbox with an “Email” label. The same steps work in a mobile email app. Daum Mail and company email work the same way; only the way you save a contact differs.</p>
            <details className="text-[13px] text-muted">
              <summary className="cursor-pointer font-semibold text-ink">Keeping press releases together in Naver Mail</summary>
              <ol className="mt-1.5 list-decimal space-y-1 pl-5">
                <li>At the bottom left of Naver Mail, go to <Btn>Settings</Btn> → <Btn>Auto-sort mail</Btn> → <Btn>Add rule</Btn></li>
                <li>In the “Condition” section, enter <strong>press release</strong> (or <strong>보도자료</strong> for Korean emails) in the <strong>Subject</strong> field, and under “Action” choose <strong>Move to folder</strong> → <strong>Save in a new folder</strong> and name it “Press releases” (highlighting with a color also works).</li>
                <li>Click <Btn>Save</Btn>. From then on, emails with that word in the subject are gathered in one folder. Open them there and just click <Btn>Forward</Btn>.</li>
              </ol>
              <p className="mt-1.5">If you mostly receive press releases in Naver Mail and forwarding each one is a hassle, you can ask the senders to <strong>add your Gmail address as a recipient</strong> and use Gmail’s “Automatic” setup.</p>
            </details>
            <details className="text-[13px] text-muted">
              <summary className="cursor-pointer font-semibold text-ink">If you want to receive company email automatically</summary>
              <p className="mt-1.5">If your company uses Google Workspace (the screen is Gmail even if the address is @yourcompany.com), follow the same steps as “Automatic”. For Outlook or NAVER WORKS, create a rule (automatic forwarding) in the “Rules” menu: <strong>subject contains “press release” → forward to your dedicated address</strong>. If it will not save, ask your company IT administrator to “allow automatic forwarding to external addresses”.</p>
            </details>
          </section>
        ) : (
          <section className="space-y-4 rounded-lg border border-line bg-white p-4 text-[14.5px] sm:p-6 leading-[1.8]">
            <p className="rounded-lg border border-draft/40 bg-draft/10 px-4 py-3 text-[14px] font-semibold leading-relaxed">
              네이버 메일은 자동으로 넘기는 기능이 없어서, <strong>보도자료 메일을 한 통씩 직접 전달</strong>해야 합니다.
              보도자료를 자주 받으신다면 <strong className="text-published">지메일 사용을 권장합니다</strong>(위의 “자동으로 받기”). 네이버 방식도 기능은 똑같이 쓸 수 있으니 아래를 따라 해 주세요.
            </p>
            <p className="text-[17px] font-bold">직접 전달하는 방법</p>
            <p className="text-[13.5px] text-muted">지메일은 보도자료만 골라 자동으로 넘길 수 있지만, <strong>네이버 메일에는 자동 전달 기능이 없습니다</strong>(환경설정의 “메일 자동분류”에는 메일함 이동·읽음·중요·색상·삭제만 있습니다). 대신 <strong>처음에 주소록에 한 번 저장</strong>해 두면, 이후에는 보도자료 메일을 열어 <Btn>전달</Btn>만 누르면(메일 한 통에 5초) 보도자료함에 들어옵니다.</p>

            <div className="rounded-lg bg-[#F8F9FA] px-4 py-4">
              <p className="font-bold">① 처음 한 번만 — 내 전용 주소를 주소록에 저장</p>
              <p className="mt-1 text-[13px] text-muted">먼저 위의 <strong>내 전용 주소</strong>를 복사해 두세요. <CopyButton text={address} label="주소 복사" /></p>
              <ol className="mt-2 list-decimal space-y-1 pl-5">
                <li><strong>네이버 메일</strong> 화면 맨 위 가운데 아이콘들 중 <strong>사람 모양(주소록)</strong>을 눌러 주소록으로 갑니다.</li>
                <li>왼쪽 위 <Btn>연락처 추가</Btn>를 누르면 입력 창이 열립니다.</li>
                <li><strong>이름</strong> 칸(성 칸 옆)에 <strong>IM 보도자료함</strong>이라고 씁니다. <span className="text-muted">(성 칸은 비워 둬도 됩니다. 알아보기 쉬운 이름이면 아무거나 괜찮습니다.)</span></li>
                <li><strong>이메일</strong> 칸에 복사해 둔 <strong>내 전용 주소</strong>를 붙여넣습니다 <span className="text-muted">(Ctrl+V · 맥은 ⌘+V)</span>. 이름 칸이 아니라 이메일 칸입니다.</li>
                <li><Btn>저장</Btn>을 누르면 끝입니다. 다른 칸은 비워 두세요.</li>
              </ol>
            </div>

            <div className="rounded-lg bg-[#F8F9FA] px-4 py-4">
              <p className="font-bold">② 보도자료 메일이 올 때마다</p>
              <ol className="mt-2 list-decimal space-y-1 pl-5">
                <li>받은메일함에서 보도자료 메일을 열고 <Btn>전달</Btn>을 누릅니다.</li>
                <li><strong>받는 사람</strong> 칸에 <strong>IM</strong>이라고 입력하면 주소록에 저장한 <strong>IM 보도자료함</strong>이 나타납니다. 그것을 고릅니다.</li>
                <li><Btn>보내기</Btn>를 누르면 끝입니다. 본문은 비워 두셔도 됩니다.</li>
              </ol>
            </div>

            <p className="text-[13px] text-muted">보낸 기관과 제목, 첨부한 사진은 IM 뉴스룸이 알아서 찾아 보도자료함에 “메일” 표시로 넣어 줍니다. 휴대폰 메일 앱에서도 같은 방법으로 됩니다. 다음 메일·회사 메일도 주소록(연락처)에 저장하는 방법만 조금 다를 뿐 똑같습니다.</p>
            <details className="text-[13px] text-muted">
              <summary className="cursor-pointer font-semibold text-ink">네이버 메일에서 보도자료를 찾기 쉽게 모아 두려면</summary>
              <ol className="mt-1.5 list-decimal space-y-1 pl-5">
                <li>네이버 메일 왼쪽 아래 <Btn>환경설정</Btn> → <Btn>메일 자동분류</Btn> → <Btn>분류추가</Btn></li>
                <li>“분류 기준”의 <strong>메일 제목</strong> 칸에 <strong>보도자료</strong>를 쓰고, “처리 방법”에서 <strong>메일함으로 이동</strong> → <strong>새 메일함에 저장</strong>에 “보도자료”라고 씁니다 (색상 강조만 해도 됩니다).</li>
                <li><Btn>저장</Btn> — 이후 제목에 “보도자료”가 들어간 메일이 한 메일함에 모입니다. 거기서 열어 <Btn>전달</Btn>만 누르면 됩니다.</li>
              </ol>
              <p className="mt-1.5">보도자료를 주로 네이버로 받는데 매번 전달하기 번거롭다면, 보내는 기관에 <strong>지메일 주소도 수신처로 추가</strong>해 달라고 요청하고 지메일 “자동으로 받기”를 쓰는 방법도 있습니다.</p>
            </details>
            <details className="text-[13px] text-muted">
              <summary className="cursor-pointer font-semibold text-ink">회사 메일을 자동으로 받고 싶다면</summary>
              <p className="mt-1.5">구글 워크스페이스(주소가 @회사도메인이어도 화면이 지메일)면 “자동으로 받기”와 똑같이 하면 됩니다. 아웃룩·네이버웍스는 “규칙(자동 전달)” 메뉴에서 <strong>제목에 ‘보도자료’ 포함 → 내 전용 주소로 전달</strong>을 만드세요. 저장이 안 되면 회사 전산 담당자에게 “외부 주소 자동 전달 허용”을 요청하세요.</p>
            </details>
          </section>
        )
      )}

      <details className="rounded-lg border border-line bg-white px-4 py-4 sm:px-6">
        <summary className="cursor-pointer text-[14px] font-bold">{t('알아둘 점', 'Good to know')}</summary>
        {en ? (
          <ul className="mt-3 list-disc space-y-1.5 pl-5 text-[13.5px] leading-relaxed text-[#3B4048]">
            <li>Incoming press releases are <strong>visible to everyone in the newsroom.</strong> Forward press releases only, so that personal email does not get mixed in.</li>
            <li>Attachments in photo, PDF, Hangul, Word, and text (.txt, .md) formats are imported (up to 15MB in total per email; attachments over the limit keep only their names, so check the original email). Photos are inserted into the story body automatically, and from the Standard plan up, text from document files is also inserted below the body (Basic plans download the file instead).</li>
            <li>If the same press release reaches several reporters, only one copy is added, and the “unsubscribe” notice at the end of an email is trimmed off automatically.</li>
          </ul>
        ) : (
          <ul className="mt-3 list-disc space-y-1.5 pl-5 text-[13.5px] leading-relaxed text-[#3B4048]">
            <li>들어온 보도자료는 <strong>편집국 모두가 볼 수 있습니다.</strong> 개인 메일이 섞이지 않게 보도자료만 보내세요.</li>
            <li>첨부는 사진·PDF·한글·워드·텍스트(.txt·.md) 파일을 가져옵니다(한 통에 합계 15MB까지, 넘는 첨부는 이름만 남고 받은 메일에서 확인). 사진은 기사 본문에 자동으로 들어가고, 스탠다드 요금제부터는 문서 파일의 글자도 본문 아래에 자동으로 들어갑니다(베이직은 내려받기).</li>
            <li>같은 보도자료가 여러 기자에게 오면 하나만 들어오고, 메일 끝 “수신거부” 안내는 자동으로 잘라냅니다.</li>
          </ul>
        )}
      </details>
    </div>
  )
}
