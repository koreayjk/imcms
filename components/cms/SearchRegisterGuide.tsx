'use client'

import { useState, useTransition } from 'react'
import { checkSearchSetup, type SearchCheck } from '@/app/(main)/admin/outlets/[id]/site/actions'

// 홈페이지 설정 → 검색 노출: 담당 매니저가 혼자 네이버·구글 검색 등록을 끝낼 수 있게 순서·복사할 주소·점검 버튼
export default function SearchRegisterGuide({ outletId, domain }: { outletId: string; domain: string | null }) {
  const base = domain ? `https://${domain}` : null
  const [checks, setChecks] = useState<SearchCheck[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()

  function check() {
    setError(null)
    start(async () => {
      const r = await checkSearchSetup(outletId)
      if (r.error) { setError(r.error); setChecks(null) } else setChecks(r.items ?? [])
    })
  }

  return (
    <div className="mt-4 space-y-3">
      {/* 복사해서 쓰는 주소 */}
      <div className="rounded bg-[#F8F9FA] px-4 py-3 text-[13px]">
        <p className="font-semibold">등록할 때 쓰는 주소</p>
        {base ? (
          <ul className="mt-2 space-y-1.5">
            <Copy label="매체 주소 (네이버·구글에 등록)" value={base} />
            <Copy label="사이트맵 (네이버·구글)" value={`${base}/sitemap.xml`} />
            <Copy label="뉴스 사이트맵 (구글)" value={`${base}/news-sitemap.xml`} />
            <Copy label="RSS (네이버)" value={`${base}/rss.xml`} />
          </ul>
        ) : (
          <p className="mt-1 text-muted">위 “도메인” 칸에 매체 주소를 저장하면 여기에 등록할 주소가 나옵니다. 도메인 연결 전에는 검색 등록을 하지 마세요.</p>
        )}
      </div>

      {/* 점검 버튼 */}
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={check} disabled={pending || !base} className="btn-secondary">{pending ? '확인 중…' : '검색 등록 점검하기'}</button>
        <span className="text-[12.5px] text-muted">저장한 뒤 누르면 매체 홈페이지에 코드·사이트맵이 실제로 보이는지 확인합니다.</span>
      </div>
      {error && <p role="alert" className="text-[13px] text-danger">{error}</p>}
      {checks && (
        <ul className="divide-y divide-line rounded border border-line bg-white text-[13px]">
          {checks.map((c) => (
            <li key={c.label} className="flex items-start gap-2.5 px-3 py-2">
              <span className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full text-[11px] font-bold text-white ${c.ok ? 'bg-published' : 'bg-danger'}`} aria-hidden>{c.ok ? '✓' : '!'}</span>
              <span className="min-w-0"><strong>{c.label}</strong> <span className="text-muted">— {c.detail}</span></span>
            </li>
          ))}
        </ul>
      )}

      {/* 순서 */}
      <details className="rounded bg-[#F8F9FA] px-4 py-3 text-[13px] leading-relaxed">
        <summary className="cursor-pointer font-semibold">네이버·구글 검색 등록하는 방법 (담당 매니저용)</summary>
        <div className="mt-3 space-y-4">
          <p className="rounded bg-white px-3 py-2 text-[12.5px] ring-1 ring-black/5">
            <strong>꼭 IM 뉴스룸 운영 계정</strong>(운영용 구글 계정·네이버 아이디)으로 로그인해서 하세요. 개인 계정으로 하면 알림이 개인 메일로 가고 다른 매니저가 관리할 수 없습니다.
            시작 전에 ① 도메인 연결이 끝났는지 ② 위 “구글·네이버 검색에 노출하기”가 켜져 있는지 ③ 테스트 기사를 지웠는지 확인하세요.
          </p>

          <section>
            <h4 className="font-bold">1. 네이버 — 코드 받기</h4>
            <ol className="mt-1 list-decimal space-y-1 pl-5">
              <li><a href="https://searchadvisor.naver.com/console/board" target="_blank" rel="noopener" className="text-review underline underline-offset-2">네이버 서치어드바이저 ↗</a> → 오른쪽 위 <b>웹마스터 도구</b></li>
              <li>사이트 등록 칸에 위 <b>매체 주소</b>를 붙여 넣고 → 등록</li>
              <li>소유확인 방법에서 <b>HTML 태그</b> → 나온 한 줄 전체 복사</li>
              <li><b>소유확인 버튼은 아직 누르지 않습니다.</b></li>
            </ol>
          </section>

          <section>
            <h4 className="font-bold">2. 구글 — 코드 받기</h4>
            <ol className="mt-1 list-decimal space-y-1 pl-5">
              <li><a href="https://search.google.com/search-console" target="_blank" rel="noopener" className="text-review underline underline-offset-2">구글 서치콘솔 ↗</a> → 왼쪽 위 속성 선택 칸 → <b>속성 추가</b> → <b>웹사이트 추가</b></li>
              <li>두 칸 중 <b>URL 접두어</b>에 위 <b>매체 주소</b>를 넣고 → 계속 (“도메인” 칸은 쓰지 않습니다)</li>
              <li>다른 확인 방법 중 <b>HTML 태그</b> → 한 줄 전체 복사</li>
              <li><b>이 창은 닫지 말고 둡니다.</b></li>
            </ol>
          </section>

          <section>
            <h4 className="font-bold">3. 여기에 넣고 저장 → 점검</h4>
            <ol className="mt-1 list-decimal space-y-1 pl-5">
              <li>위 <b>네이버 확인 코드</b>·<b>구글 확인 코드</b> 칸에 복사한 줄을 통째로 붙여 넣습니다</li>
              <li>화면 맨 아래 <b>[저장]</b>을 누릅니다 (배포는 필요 없습니다)</li>
              <li><b>[검색 등록 점검하기]</b>를 눌러 다섯 줄이 모두 초록 ✓인지 확인합니다</li>
            </ol>
          </section>

          <section>
            <h4 className="font-bold">4. 소유 확인 → 사이트맵 제출</h4>
            <ul className="mt-1 list-disc space-y-1 pl-5">
              <li><b>네이버</b>: <b>소유확인</b> → 사이트 목록에서 매체 주소 클릭 → 왼쪽 <b>요청 → 사이트맵 제출</b>에 <b>사이트맵</b> 주소 → 확인 → <b>요청 → RSS 제출</b>에 <b>RSS</b> 주소 → 확인</li>
              <li><b>구글</b>: 열어 둔 창에서 <b>확인</b> → 속성으로 이동 → 왼쪽 <b>Sitemaps</b>에 <code>sitemap.xml</code> 제출, <code>news-sitemap.xml</code> 제출</li>
              <li><b>구글</b>: 왼쪽 <b>URL 검사</b>에 매체 주소 → <b>색인 생성 요청</b> (첫 화면이 더 빨리 올라갑니다)</li>
            </ul>
          </section>

          <section>
            <h4 className="font-bold">5. 마무리</h4>
            <ul className="mt-1 list-disc space-y-1 pl-5">
              <li>구글 서치콘솔 <b>설정 → 사용자 및 권한 → 사용자 추가</b>에서 매체 대표의 구글 계정을 <b>소유자</b>로 추가 (대표가 검색 성적을 직접 봅니다)</li>
              <li>대표에게 안내: 검색 반영까지 며칠~2주, 네이버 <b>“뉴스” 탭</b> 노출은 언론사가 직접 뉴스 검색제휴 심사를 신청해야 함</li>
              <li>고객 상담 → 이 고객사 카드의 <b>개통 체크리스트</b>에도 체크</li>
            </ul>
          </section>

          <section>
            <h4 className="font-bold">막힐 때</h4>
            <ul className="mt-1 list-disc space-y-1 pl-5">
              <li><b>소유 확인 실패</b>: 저장했는지, [검색 등록 점검하기]에서 코드가 ✓인지 확인 → 1분 뒤 다시 소유 확인</li>
              <li><b>구글 사이트맵 “가져올 수 없음”(Couldn’t fetch)</b>: 제출 직후 흔한 표시입니다. 하루 기다리면 보통 “성공”으로 바뀝니다. 계속 그러면 사이트맵을 지우고 다시 제출</li>
              <li><b>뉴스 사이트맵이 비어 있음</b>: 최근 48시간에 발행한 기사만 담습니다. 기사를 발행하면 채워집니다</li>
              <li><b>도메인을 바꿈</b>: 새 주소로 1번부터 다시 하고 코드를 바꿔 넣습니다</li>
            </ul>
          </section>
        </div>
      </details>
    </div>
  )
}

function Copy({ label, value }: { label: string; value: string }) {
  const [done, setDone] = useState(false)
  return (
    <li className="flex flex-wrap items-center gap-2">
      <span className="w-[190px] shrink-0 text-muted">{label}</span>
      <code className="min-w-0 break-all rounded bg-white px-2 py-0.5 ring-1 ring-black/5">{value}</code>
      <button type="button" onClick={() => navigator.clipboard?.writeText(value).then(() => { setDone(true); setTimeout(() => setDone(false), 1500) })} className="text-[12px] font-semibold text-review hover:underline">
        {done ? '복사됨' : '복사'}
      </button>
    </li>
  )
}
