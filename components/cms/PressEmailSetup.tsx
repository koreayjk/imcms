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

function Step({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <li className="relative pl-11">
      <span className="absolute left-0 top-0 grid h-7 w-7 place-items-center rounded-full bg-ink text-[13px] font-bold text-white">{n}</span>
      <p className="text-[15px] font-bold">{title}</p>
      <div className="mt-2 space-y-2 text-[14px] leading-[1.75] text-[#3B4048]">{children}</div>
    </li>
  )
}

function Tip({ tone = 'info', children }: { tone?: 'info' | 'warn'; children: ReactNode }) {
  return (
    <p className={`rounded px-3 py-2 text-[13px] leading-relaxed ${tone === 'warn' ? 'bg-draft/10 text-[#6B5F22]' : 'bg-review/5 text-review'}`}>
      {tone === 'warn' ? '⚠ ' : '💡 '}
      {children}
    </p>
  )
}

const TABS = [
  { key: 'gmail', label: '지메일 (Gmail)' },
  { key: 'work', label: '회사 메일' },
  { key: 'naver', label: '네이버·다음 메일' },
] as const

export default function PressEmailSetup({ initial }: { initial: MyInbox | null }) {
  const [inbox, setInbox] = useState(initial)
  const [tab, setTab] = useState<(typeof TABS)[number]['key']>('gmail')
  const [watching, setWatching] = useState(false)

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

  return (
    <div className="mt-6 space-y-6">
      {/* 내 전용 주소 */}
      <section className="rounded-lg border-2 border-ink bg-white p-6">
        <p className="text-[13px] font-bold text-muted">내 전용 전달 주소</p>
        {address ? (
          <>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <code className="min-w-0 break-all text-[18px] font-bold">{address}</code>
              <CopyButton text={address} label="주소 복사" />
            </div>
            <p className="mt-2 text-[12.5px] text-muted">나만 쓰는 주소입니다. 이 주소로 온 메일은 보도자료함에 “메일” 표시와 함께 들어옵니다. 다른 사람에게 알려주지 마세요.</p>
          </>
        ) : (
          <p className="mt-2 text-[14px] text-danger">아직 관리자가 메일 수신 설정을 마치지 않아 주소가 없습니다. 관리자에게 문의하세요.</p>
        )}
        <div className="mt-4 flex flex-wrap gap-x-6 gap-y-1 border-t border-line pt-3 text-[13px] text-muted">
          <span>받은 보도자료 <strong className="tabular-nums text-ink">{inbox?.received_count ?? 0}</strong>건</span>
          <span>마지막으로 받은 때 <strong className="text-ink">{inbox?.last_received_at ? formatDateTime(inbox.last_received_at) : '아직 없음'}</strong></span>
        </div>
      </section>

      {/* 메일 종류별 안내 */}
      <section className="rounded-lg border border-line bg-white">
        <div className="flex border-b border-line px-3" role="tablist" aria-label="메일 종류">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={tab === t.key}
              onClick={() => setTab(t.key)}
              className={`-mb-px border-b-2 px-4 py-3.5 text-[14px] ${tab === t.key ? 'border-ink font-bold' : 'border-transparent text-muted hover:text-ink'}`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="p-6">
          {tab === 'gmail' && (
            <>
              <Tip tone="warn">휴대폰 지메일 앱에서는 이 설정을 할 수 없습니다. <strong>PC 인터넷 창</strong>에서 한 번만 해 두면 휴대폰으로 받은 메일도 똑같이 들어옵니다. 약 5분 걸립니다.</Tip>
              <ol className="mt-6 space-y-8">
                <Step n={1} title="지메일 설정 열기">
                  <p>PC에서 <a href="https://mail.google.com/mail/u/0/#settings/fwdandpop" target="_blank" rel="noopener" className="font-semibold underline underline-offset-2">mail.google.com</a>에 들어가 오른쪽 위 톱니바퀴(⚙) → <Btn>모든 설정 보기</Btn>를 누릅니다.</p>
                  <p>위쪽 탭 중에서 <Btn>전달 및 POP/IMAP</Btn>을 누릅니다.</p>
                </Step>

                <Step n={2} title="내 전용 주소를 전달 주소로 등록">
                  <p><Btn>전달 주소 추가</Btn>를 누르고, 아래 주소를 붙여넣은 뒤 <Btn>다음</Btn> → 새로 뜬 창에서 <Btn>계속</Btn> → <Btn>확인</Btn>을 누릅니다.</p>
                  {address && <Copyable text={address} />}
                  <div className="!mt-3">
                    <button
                      type="button"
                      onClick={() => setWatching(true)}
                      disabled={watching}
                      className="rounded bg-review px-3 py-1.5 text-[13px] font-semibold text-white disabled:opacity-70"
                    >
                      {watching ? '확인 코드 기다리는 중… (자동으로 새로 고침)' : '확인 메일을 보냈어요 → 코드 기다리기'}
                    </button>
                  </div>
                </Step>

                <Step n={3} title="구글 확인 코드 입력">
                  <p>구글이 내 전용 주소로 확인 메일을 보내면, 그 코드가 <strong>바로 아래 칸</strong>에 나타납니다. 보통 1분 안에 옵니다.</p>
                  <div className={`rounded-lg border-2 px-4 py-3.5 ${recentCode ? 'border-published bg-published/5' : 'border-dashed border-line'}`} aria-live="polite">
                    {recentCode ? (
                      <>
                        <p className="text-[12.5px] font-semibold text-published">지메일 확인 코드 ({formatDateTime(inbox!.verify_at)} 받음)</p>
                        {inbox?.verify_code && (
                          <div className="mt-1.5 flex items-center gap-3">
                            <span className="text-[26px] font-extrabold tracking-[0.12em] tabular-nums">{inbox.verify_code}</span>
                            <CopyButton text={inbox.verify_code} label="코드 복사" />
                          </div>
                        )}
                        {inbox?.verify_link && (
                          <a href={inbox.verify_link} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block text-[13px] font-semibold text-review underline underline-offset-2">
                            또는 이 확인 링크를 눌러도 됩니다 ↗
                          </a>
                        )}
                      </>
                    ) : (
                      <p className="text-[13px] text-muted">아직 받은 확인 코드가 없습니다. 2단계를 마친 뒤 위의 파란 버튼을 눌러 주세요.</p>
                    )}
                  </div>
                  <p>지메일 설정 화면으로 돌아가 <Btn>확인 코드</Btn> 칸에 붙여넣고 <Btn>확인</Btn>(또는 <Btn>인증</Btn>)을 누릅니다.</p>
                  <Tip tone="warn">
                    그 아래 <Btn>전달 사용 중지</Btn>는 <strong>그대로 두세요.</strong> “받은 메일의 사본을 전달”을 고르면 개인 메일까지 전부 넘어옵니다. 보도자료만 보내도록 다음 단계에서 필터를 만듭니다.
                  </Tip>
                </Step>

                <Step n={4} title="보도자료만 골라 보내는 필터 만들기">
                  <p>지메일 맨 위 검색창 오른쪽 끝의 <Btn>검색 옵션 표시</Btn>(조절 막대 모양 아이콘)를 누릅니다.</p>
                  <p><Btn>포함하는 단어</Btn> 칸에 아래 문구를 그대로 붙여넣습니다.</p>
                  <Copyable text={FILTER_WORDS} />
                  <Tip>특정 기관 메일만 받으려면 대신 <Btn>보낸사람</Btn> 칸에 그 주소를 적으세요. 여러 곳이면 <code>a@x.com OR b@y.com</code>처럼 OR로 잇습니다.</Tip>
                  <p>오른쪽 아래 <Btn>필터 만들기</Btn> → <Btn>다음 주소로 전달</Btn>에 체크하고 목록에서 내 전용 주소를 고른 뒤 → <Btn>필터 만들기</Btn>를 누르면 끝입니다.</p>
                  <Tip>필터는 <strong>앞으로 새로 오는 메일</strong>부터 전달합니다. 이미 받은 메일은 넘어가지 않습니다.</Tip>
                </Step>

                <Step n={5} title="잘 되는지 확인">
                  <p>다른 메일 계정에서 제목에 “보도자료”를 넣어 내 지메일로 보내 보세요. 1~2분 안에 보도자료함에 <strong>메일</strong> 표시와 함께 들어오고, 위의 “받은 보도자료” 숫자가 올라갑니다.</p>
                </Step>
              </ol>
            </>
          )}

          {tab === 'work' && (
            <div className="space-y-5 text-[14px] leading-[1.75] text-[#3B4048]">
              <p><strong>회사 메일이 구글(구글 워크스페이스)</strong>이면 “지메일” 탭과 똑같이 하면 됩니다. 주소가 @회사도메인이어도 화면은 지메일과 같습니다.</p>
              <p><strong>네이버웍스, 아웃룩(Microsoft 365) 등</strong> 다른 회사 메일은 대부분 “자동 전달” 또는 “규칙” 메뉴가 있습니다. 아래처럼 만드세요.</p>
              <ul className="list-disc space-y-1 pl-5">
                <li>조건: 제목에 <strong>보도자료</strong> (또는 보도참고자료, 배포자료) 포함</li>
                <li>동작: <strong>다음 주소로 전달</strong> → 내 전용 주소</li>
              </ul>
              {address && <Copyable text={address} />}
              <Tip tone="warn">회사 보안 정책으로 외부 전달이 막혀 있을 수 있습니다. 설정이 저장되지 않으면 회사 전산 담당자에게 “외부 주소 자동 전달 허용”을 요청하세요.</Tip>
            </div>
          )}

          {tab === 'naver' && (
            <div className="space-y-5 text-[14px] leading-[1.75] text-[#3B4048]">
              <Tip tone="warn">네이버 메일과 다음 메일은 <strong>자동 전달 기능이 없습니다.</strong> 보도자료 메일을 열고 “전달” 버튼으로 한 통씩 보내 주세요. 한 번에 10초면 됩니다.</Tip>
              <ol className="space-y-6">
                <Step n={1} title="내 전용 주소를 주소록에 저장 (처음 한 번)">
                  <p>주소록에 이름 <strong>“IM 보도자료함”</strong>으로 아래 주소를 저장해 두면, 받는 사람 칸에 “IM”만 쳐도 바로 나옵니다.</p>
                  {address && <Copyable text={address} />}
                </Step>
                <Step n={2} title="보도자료 메일 열고 전달">
                  <p>보도자료 메일을 열고 위쪽 <Btn>전달</Btn>을 누릅니다. 받는 사람에 “IM 보도자료함”을 넣고 <Btn>보내기</Btn>를 누르면 끝입니다.</p>
                  <Tip>본문에 아무것도 적지 않아도 됩니다. 원래 보낸 기관 이름과 제목은 IM 뉴스룸이 알아서 찾아 표시합니다.</Tip>
                </Step>
                <Step n={3} title="휴대폰에서도 됩니다">
                  <p>네이버·다음 메일 앱에서도 메일을 열고 <Btn>전달</Btn>을 누르면 똑같이 들어옵니다.</p>
                </Step>
              </ol>
              <Tip>자주 받는 보도자료 메일이 많다면, 보도자료용으로 <strong>지메일 계정을 따로 만들어</strong> 기관에 그 주소를 알려 두는 것도 방법입니다. 지메일은 자동 전달이 됩니다.</Tip>
            </div>
          )}
        </div>
      </section>

      {/* 알아둘 점 */}
      <section className="rounded-lg border border-line bg-white p-6">
        <h2 className="text-[15px] font-bold">알아둘 점</h2>
        <ul className="mt-3 list-disc space-y-1.5 pl-5 text-[13.5px] leading-relaxed text-[#3B4048]">
          <li>들어온 보도자료는 <strong>편집국 모두가 볼 수 있습니다.</strong> 개인 메일이 섞이지 않게 필터 조건을 확인하세요.</li>
          <li>첨부는 사진(JPG·PNG·WEBP·GIF), PDF, 한글(HWP·HWPX), 워드 파일을 가져옵니다. 한 통에 <strong>합계 3MB</strong>까지이고, 넘는 파일은 “가져오지 못한 파일”로 표시됩니다.</li>
          <li>사진은 보도자료를 처음 열 때 본문에 자동으로 들어갑니다. 한글·PDF 파일은 보도자료 화면에서 내려받을 수 있습니다.</li>
          <li>같은 보도자료가 여러 기자에게 오면 하나만 들어옵니다.</li>
          <li>메일 끝의 “수신거부”, “발신 전용” 안내는 자동으로 잘라냅니다.</li>
        </ul>
      </section>
    </div>
  )
}
