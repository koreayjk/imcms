'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { getMyInbox, type MyInbox } from '@/app/(main)/press/email/actions'
import { formatDateTime } from '@/lib/format'

const FILTER_WORDS = '보도자료 OR 보도참고자료 OR 배포자료 OR "press release"'

function CopyButton({ text, label = '복사' }: { text: string; label?: string }) {
  const [done, setDone] = useState(false)
  return (
    <button
      type="button"
      onClick={async () => {
        try { await navigator.clipboard.writeText(text) } catch { window.prompt('아래 내용을 복사하세요', text) }
        setDone(true)
        setTimeout(() => setDone(false), 1800)
      }}
      className={`shrink-0 rounded px-3 py-1.5 text-[12.5px] font-semibold ${done ? 'bg-published text-white' : 'bg-ink text-white hover:opacity-90'}`}
    >
      {done ? '복사됨 ✓' : label}
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
const GMAIL_SEARCH = `https://mail.google.com/mail/u/0/#search/${encodeURIComponent(FILTER_WORDS)}`
const STEP_KEY = 'im_press_mail_step'

function OpenGmail({ href, children, onClick }: { href: string; children: ReactNode; onClick?: () => void }) {
  return (
    <a href={href} target="_blank" rel="noopener" onClick={onClick} className="inline-flex items-center gap-1.5 rounded-md bg-[#1A73E8] px-4 py-2.5 text-[14px] font-semibold text-white hover:bg-[#1765CC]">
      {children} <span aria-hidden>↗</span>
    </a>
  )
}

export default function PressEmailSetup({ initial }: { initial: MyInbox | null }) {
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
    const t = setInterval(async () => {
      const { inbox: next } = await getMyInbox()
      if (next) setInbox(next)
      if (Date.now() - started > 5 * 60_000) setWatching(false)
    }, 5000)
    return () => clearInterval(t)
  }, [watching])

  const address = inbox?.address
  const recentCode = inbox?.verify_at && Date.now() - new Date(inbox.verify_at).getTime() < 24 * 3600_000
  const receiving = (inbox?.received_count ?? 0) > 0

  if (!address) {
    return <p className="mt-6 rounded-lg border border-danger/30 bg-danger/5 px-5 py-4 text-[14px] text-danger">아직 관리자가 메일 수신 설정을 마치지 않아 내 전용 주소가 없습니다. 관리자에게 문의하세요.</p>
  }

  const steps = ['전달 주소 등록', '확인 코드 넣기', '보도자료만 보내기']

  return (
    <div className="mt-6 space-y-5">
      {/* 내 전용 주소 + 받은 현황 */}
      <section className="rounded-lg border border-line bg-white px-5 py-4">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <span className="text-[13px] font-bold text-muted">내 전용 주소</span>
          <code className="min-w-0 break-all text-[16px] font-bold">{address}</code>
          <CopyButton text={address} label="주소 복사" />
        </div>
        <p className="mt-2 text-[12.5px] text-muted">
          {receiving
            ? <><strong className="text-published">받는 중 ✓</strong> 지금까지 {inbox!.received_count}건 · 마지막 {formatDateTime(inbox!.last_received_at)}</>
            : '아직 받은 보도자료가 없습니다.'}
          {' '}이 주소는 나만 쓰는 주소이니 다른 사람에게 알려주지 마세요.
        </p>
      </section>

      {/* 방법 고르기 */}
      <div className="grid gap-3 sm:grid-cols-2">
        {([
          ['auto', '자동으로 받기', '지메일 · PC에서 한 번, 약 3분', '추천'],
          ['manual', '직접 전달하기', '네이버·다음·회사 메일 · 보도자료가 올 때마다 “전달” 한 번', ''],
        ] as const).map(([k, t, d, badge]) => (
          <button key={k} type="button" onClick={() => setMode(k)} aria-pressed={mode === k}
            className={`rounded-lg border-2 px-5 py-4 text-left transition ${mode === k ? 'border-ink bg-white' : 'border-line bg-white/60 hover:border-ink/40'}`}>
            <span className="flex items-center gap-2 text-[15px] font-bold">{t}{badge && <span className="rounded bg-published/10 px-1.5 text-[11px] text-published">{badge}</span>}</span>
            <span className="mt-0.5 block text-[13px] text-muted">{d}</span>
          </button>
        ))}
      </div>

      {mode === 'auto' && (
        <section className="rounded-lg border border-line bg-white p-4 sm:p-6">
          {/* 단계 표시 */}
          <ol className="flex flex-wrap items-center gap-2 text-[13px]">
            {steps.map((t, i) => (
              <li key={t} className="flex items-center gap-2">
                <button type="button" onClick={() => go(i + 1)}
                  className={`flex items-center gap-1.5 rounded-full px-3 py-1 ${step === i + 1 ? 'bg-ink font-bold text-white' : step > i + 1 ? 'bg-published/10 font-semibold text-published' : 'bg-line/60 text-muted'}`}>
                  <span className="tabular-nums">{step > i + 1 ? '✓' : i + 1}</span> {t}
                </button>
                {i < steps.length - 1 && <span className="text-muted" aria-hidden>›</span>}
              </li>
            ))}
          </ol>

          <div className="mt-6 min-h-[200px]">
            {step === 1 && (
              <div className="space-y-4 text-[14.5px] leading-[1.8]">
                <p className="text-[17px] font-bold">지메일에 내 전용 주소를 등록합니다</p>
                <p>
                  아래 파란 버튼을 누르면 지메일 전달 설정이 열립니다.<br />
                  <Btn>전달 주소 추가</Btn>를 누르고 <strong>붙여넣기</strong>(Ctrl+V · 맥은 ⌘+V) → <Btn>다음</Btn> → <Btn>계속</Btn> → <Btn>확인</Btn>.
                </p>
                <div className="flex flex-wrap gap-2">
                  <CopyButton text={address} label="① 주소 복사" />
                  <OpenGmail href={GMAIL_FORWARD} onClick={() => setWatching(true)}>② 지메일 전달 설정 열기</OpenGmail>
                </div>
                <p className="text-[12.5px] text-muted">PC 인터넷 창에서 해 주세요(휴대폰 지메일 앱에는 이 메뉴가 없습니다). 한 번만 하면 휴대폰으로 받은 메일도 똑같이 들어옵니다.</p>
                <button type="button" onClick={() => go(2)} className="btn-primary">다 했어요, 다음 →</button>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-4 text-[14.5px] leading-[1.8]">
                <p className="text-[17px] font-bold">구글 확인 코드를 넣습니다</p>
                <div className={`rounded-lg border-2 px-5 py-4 ${recentCode ? 'border-published bg-published/5' : 'border-dashed border-line'}`} aria-live="polite">
                  {recentCode && inbox?.verify_code ? (
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="text-[30px] font-extrabold tracking-[0.12em] tabular-nums">{inbox.verify_code}</span>
                      <CopyButton text={inbox.verify_code} label="코드 복사" />
                      {inbox.verify_link && <a href={inbox.verify_link} target="_blank" rel="noopener noreferrer" className="text-[13px] font-semibold text-review underline underline-offset-2">또는 이 링크 누르기 ↗</a>}
                    </div>
                  ) : recentCode && inbox?.verify_link ? (
                    <a href={inbox.verify_link} target="_blank" rel="noopener noreferrer" className="font-semibold text-review underline underline-offset-2">구글 확인 링크 누르기 ↗</a>
                  ) : (
                    <p className="text-[13.5px] text-muted">{watching ? '⏳ 구글 확인 메일을 기다리는 중… 보통 1분 안에 여기에 코드가 나타납니다.' : '코드가 아직 없습니다. 1단계를 마쳤다면 '}{!watching && <button type="button" onClick={() => setWatching(true)} className="font-semibold text-review underline underline-offset-2">다시 확인</button>}</p>
                  )}
                </div>
                <p>지메일 화면으로 돌아가 <Btn>확인 코드</Btn> 칸에 붙여넣고 <Btn>확인</Btn>.</p>
                <p className="text-[13px] text-[#6B5F22]">⚠ 그 아래 <strong>“전달 사용 중지”는 그대로</strong> 두세요. 바꾸면 개인 메일까지 모두 넘어옵니다.</p>
                <button type="button" onClick={() => go(3)} className="btn-primary">다 했어요, 다음 →</button>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-4 text-[14.5px] leading-[1.8]">
                <p className="text-[17px] font-bold">보도자료 메일만 보내도록 정합니다</p>
                <p>아래 버튼을 누르면 지메일에서 보도자료 메일이 검색된 화면이 열립니다.</p>
                <OpenGmail href={GMAIL_SEARCH}>지메일에서 보도자료 검색 열기</OpenGmail>
                <ol className="list-decimal space-y-1 pl-5">
                  <li>맨 위 검색창 오른쪽 끝 <Btn>검색 옵션</Btn>(조절 막대 모양) 누르기</li>
                  <li>아래쪽 <Btn>필터 만들기</Btn> 누르기</li>
                  <li><Btn>다음 주소로 전달</Btn>에 체크하고 내 전용 주소 고르기 → <Btn>필터 만들기</Btn></li>
                </ol>
                <details className="text-[13px] text-muted">
                  <summary className="cursor-pointer">“포함하는 단어” 칸이 비어 있다면</summary>
                  <div className="mt-1">이 문구를 붙여넣으세요.<Copyable text={FILTER_WORDS} /></div>
                </details>
                <button type="button" onClick={() => go(4)} className="btn-primary">설정 끝 ✓</button>
              </div>
            )}

            {step === 4 && (
              <div className="space-y-3 text-[14.5px] leading-[1.8]">
                <p className="text-[17px] font-bold text-published">설정이 끝났습니다 ✓</p>
                <p>이제 <strong>보도자료 메일이 새로 오면</strong> 1~2분 안에 보도자료함에 “메일” 표시로 들어옵니다(이미 받은 메일은 넘어가지 않습니다).</p>
                <p className="text-[13.5px] text-muted">시험해 보려면: 다른 메일 계정에서 제목에 “보도자료”를 넣어 내 지메일로 보내 보세요. 위의 “받는 중 ✓”이 나타나면 성공입니다.</p>
                <button type="button" onClick={() => go(1)} className="text-[13px] text-muted underline underline-offset-2">처음부터 다시 보기</button>
              </div>
            )}
          </div>
        </section>
      )}

      {mode === 'manual' && (
        <section className="space-y-4 rounded-lg border border-line bg-white p-4 text-[14.5px] sm:p-6 leading-[1.8]">
          <p className="text-[17px] font-bold">보도자료 메일이 올 때마다 “전달”을 한 번 눌러 주세요</p>
          <p className="text-[13.5px] text-muted">지메일은 보도자료만 골라 자동으로 넘길 수 있지만, 네이버·다음 메일은 그런 설정을 쓰기 어렵습니다. 대신 <strong>처음에 주소록에 한 번 저장</strong>해 두면, 이후에는 보도자료 메일을 열어 <Btn>전달</Btn>만 누르면(메일 한 통에 5초) 보도자료함에 들어옵니다.</p>

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
            <summary className="cursor-pointer font-semibold text-ink">회사 메일을 자동으로 받고 싶다면</summary>
            <p className="mt-1.5">구글 워크스페이스(주소가 @회사도메인이어도 화면이 지메일)면 “자동으로 받기”와 똑같이 하면 됩니다. 아웃룩·네이버웍스는 “규칙(자동 전달)” 메뉴에서 <strong>제목에 ‘보도자료’ 포함 → 내 전용 주소로 전달</strong>을 만드세요. 저장이 안 되면 회사 전산 담당자에게 “외부 주소 자동 전달 허용”을 요청하세요.</p>
          </details>
        </section>
      )}

      <details className="rounded-lg border border-line bg-white px-4 py-4 sm:px-6">
        <summary className="cursor-pointer text-[14px] font-bold">알아둘 점</summary>
        <ul className="mt-3 list-disc space-y-1.5 pl-5 text-[13.5px] leading-relaxed text-[#3B4048]">
          <li>들어온 보도자료는 <strong>편집국 모두가 볼 수 있습니다.</strong> 개인 메일이 섞이지 않게 보도자료만 보내세요.</li>
          <li>첨부는 사진·PDF·한글·워드 파일을 가져옵니다(한 통에 합계 15MB까지, 넘는 첨부는 이름만 남고 받은 메일에서 확인). 사진은 기사 본문에 자동으로 들어갑니다.</li>
          <li>같은 보도자료가 여러 기자에게 오면 하나만 들어오고, 메일 끝 “수신거부” 안내는 자동으로 잘라냅니다.</li>
        </ul>
      </details>
    </div>
  )
}
