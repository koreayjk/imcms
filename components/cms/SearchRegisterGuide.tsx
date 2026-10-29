'use client'

import { useState, useTransition } from 'react'
import { useT, useCmsLang } from '@/components/cms/CmsLang'
import { checkSearchSetup, type SearchCheck } from '@/app/(main)/admin/outlets/[id]/site/actions'

// 홈페이지 설정 → 검색 노출: 담당 매니저가 혼자 네이버·구글 검색 등록을 끝낼 수 있게 순서·복사할 주소·점검 버튼
export default function SearchRegisterGuide({ outletId, domain, usa = false }: { outletId: string; domain: string | null; usa?: boolean }) {
  const t = useT()
  const en = useCmsLang() === 'en'
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
        <p className="font-semibold">{t('등록할 때 쓰는 주소', 'Addresses to register')}</p>
        {base ? (
          <ul className="mt-2 space-y-1.5">
            {usa ? (
              <>
                <Copy label={t('매체 주소 (구글·빙에 등록)', 'Site address (register with Google and Bing)')} value={base} />
                <Copy label={t('사이트맵 (구글·빙)', 'Sitemap (Google and Bing)')} value={`${base}/sitemap.xml`} />
                <Copy label={t('뉴스 사이트맵 (구글)', 'News sitemap (Google)')} value={`${base}/news-sitemap.xml`} />
                <Copy label={t('RSS (선택)', 'RSS (optional)')} value={`${base}/rss.xml`} />
              </>
            ) : (
              <>
                <Copy label={t('매체 주소 (네이버·구글에 등록)', 'Site address (register with Naver and Google)')} value={base} />
                <Copy label={t('사이트맵 (네이버·구글)', 'Sitemap (Naver and Google)')} value={`${base}/sitemap.xml`} />
                <Copy label={t('뉴스 사이트맵 (구글)', 'News sitemap (Google)')} value={`${base}/news-sitemap.xml`} />
                <Copy label={t('RSS (네이버)', 'RSS (Naver)')} value={`${base}/rss.xml`} />
              </>
            )}
          </ul>
        ) : (
          <p className="mt-1 text-muted">{t('위 “도메인” 칸에 매체 주소를 저장하면 여기에 등록할 주소가 나옵니다. 도메인 연결 전에는 검색 등록을 하지 마세요.', 'Save your site address in the "Domain" field above and the addresses to register will appear here. Do not register with search engines before the domain is connected.')}</p>
        )}
      </div>

      {/* 점검 버튼 */}
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={check} disabled={pending || !base} className="btn-secondary">{pending ? t('확인 중…', 'Checking…') : t('검색 등록 점검하기', 'Check search registration')}</button>
        <span className="text-[12.5px] text-muted">{t('저장한 뒤 누르면 매체 홈페이지에 코드·사이트맵이 실제로 보이는지 확인합니다.', 'After saving, click to verify that the verification codes and sitemaps are actually visible on the site.')}</span>
      </div>
      {error && <p role="alert" className="text-[13px] text-danger">{error}</p>}
      {checks && (
        <ul className="divide-y divide-line rounded border border-line bg-white text-[13px]">
          {checks.map((c) => (
            <li key={c.label} className="flex items-start gap-2.5 px-3 py-2">
              <span className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full text-[11px] font-bold text-white ${c.ok ? 'bg-published' : 'bg-danger'}`} aria-hidden>{c.ok ? '✓' : '!'}</span>
              <span className="min-w-0 break-words"><strong>{c.label}</strong> <span className="text-muted">— {c.detail}</span></span>
            </li>
          ))}
        </ul>
      )}

      {/* 순서 */}
      {usa ? (
        <details className="rounded bg-[#F8F9FA] px-4 py-3 text-[13px] leading-relaxed">
          <summary className="cursor-pointer font-semibold">{t('미국·영문 매체: 구글·빙 검색 등록하는 방법 (담당 매니저용)', 'US / English outlets: how to register with Google and Bing (for the account manager)')}</summary>
          <div className="mt-3 space-y-4">
            <p className="rounded bg-white px-3 py-2 text-[12.5px] ring-1 ring-black/5">
              {t('미국 매체는 네이버를 쓰지 않습니다. 구글이 가장 중요하고, 빙(Microsoft)은 코파일럿·덕덕고 검색과 일부 AI 검색의 바탕이라 함께 등록하는 것이 좋습니다. 꼭 IM 뉴스룸 운영 계정(운영용 구글·마이크로소프트 계정)으로 하세요. 시작 전에 ① 도메인 연결 ② 위 “검색에 노출하기” 켜기 ③ 테스트 기사 삭제를 확인하세요.', 'US outlets do not use Naver. Google matters most; Bing (Microsoft) also powers Copilot, DuckDuckGo and some AI search, so register with it too. Use the IM Newsroom team accounts (team Google and Microsoft accounts). Before you start, check that (1) the domain is connected, (2) “Show in search” above is on, and (3) test stories are deleted.')}
            </p>
            <section>
              <h4 className="font-bold">{t('1. 구글 — 코드 받기', '1. Google — get the code')}</h4>
              <ol className="mt-1 list-decimal space-y-1 pl-5">
                <li><a href="https://search.google.com/search-console" target="_blank" rel="noopener" className="text-review underline underline-offset-2">Google Search Console ↗</a> → {t('속성 추가 → ', 'Add property → ')}<b>{t('URL 접두어', 'URL prefix')}</b>{t('에 위 매체 주소 입력', ': enter the site address above')}</li>
                <li>{t('다른 확인 방법 중 ', 'Under other verification methods choose ')}<b>HTML tag</b>{t(' → 한 줄 전체 복사, 창은 닫지 않습니다', ' → copy the whole line and leave the window open')}</li>
              </ol>
            </section>
            <section>
              <h4 className="font-bold">{t('2. 빙 — 코드 받기', '2. Bing — get the code')}</h4>
              <ol className="mt-1 list-decimal space-y-1 pl-5">
                <li><a href="https://www.bing.com/webmasters" target="_blank" rel="noopener" className="text-review underline underline-offset-2">Bing Webmaster Tools ↗</a> → {t('로그인 → ', 'Sign in → ')}<b>Add a site</b>{t('에 위 매체 주소 입력', ': enter the site address above')}</li>
                <li><b>HTML Meta Tag</b>{t(' 방식 → 나온 한 줄 전체 복사 (이미 구글 서치콘솔에 등록했다면 “Import from Google Search Console”로 한 번에 가져올 수도 있습니다)', ' method → copy the whole line. If the site is already in Google Search Console you can instead use “Import from Google Search Console”.')}</li>
              </ol>
            </section>
            <section>
              <h4 className="font-bold">{t('3. 여기에 넣고 저장 → 점검', '3. Paste here, save, then check')}</h4>
              <ol className="mt-1 list-decimal space-y-1 pl-5">
                <li>{t('위 구글 확인 코드·빙 확인 코드 칸에 복사한 줄을 통째로 붙여 넣고 맨 아래 [저장] (배포 필요 없음)', 'Paste each line into the Google and Bing verification fields above, then click [Save] at the bottom (no deployment needed)')}</li>
                <li>{t('[검색 등록 점검하기]에서 모두 초록 ✓인지 확인', 'Click [Check search registration] and confirm every line shows a green ✓')}</li>
              </ol>
            </section>
            <section>
              <h4 className="font-bold">{t('4. 소유 확인 → 사이트맵 제출', '4. Verify ownership, then submit sitemaps')}</h4>
              <ul className="mt-1 list-disc space-y-1 pl-5">
                <li><b>Google</b>: {t('열어 둔 창에서 확인 → 왼쪽 Sitemaps에 ', 'click Verify → in the left menu under Sitemaps submit ')}<code>sitemap.xml</code>, <code>news-sitemap.xml</code>{t(' 제출 → URL 검사에 매체 주소 → 색인 생성 요청', ' → then paste the site address in URL inspection → Request indexing')}</li>
                <li><b>Bing</b>: {t('Verify → Sitemaps에 ', 'click Verify → under Sitemaps submit ')}<code>sitemap.xml</code>{t(' 제출 (URL Submission으로 홈 주소를 한 번 제출하면 더 빨리 읽힙니다)', ' (submitting the home address under URL Submission gets it read sooner)')}</li>
              </ul>
            </section>
            <section>
              <h4 className="font-bold">{t('5. 마무리', '5. Wrap up')}</h4>
              <ul className="mt-1 list-disc space-y-1 pl-5">
                <li>{t('구글 서치콘솔 설정 → 사용자 및 권한에서 발행인의 구글 계정을 사용자로 추가 (소유자 권한은 운영 계정이 유지)', 'In Google Search Console, Settings → Users and permissions, add the publisher’s Google account as a user (keep ownership with the team account)')}</li>
                <li>{t('구글 뉴스에 나오게 하려면 발행인이 Google Publisher Center에서 뉴스 출처를 등록할 수 있습니다 (선택, 구글이 따로 심사). 검색 반영까지 며칠~2주 걸립니다', 'To appear in Google News, the publisher can register the publication in Google Publisher Center (optional, reviewed by Google). Search results take a few days to 2 weeks to update')}</li>
              </ul>
            </section>
          </div>
        </details>
      ) : en ? (
      <details className="rounded bg-[#F8F9FA] px-4 py-3 text-[13px] leading-relaxed">
        <summary className="cursor-pointer font-semibold">How to register with Naver and Google Search (for the account manager)</summary>
        <div className="mt-3 space-y-4">
          <p className="rounded bg-white px-3 py-2 text-[12.5px] ring-1 ring-black/5">
            <strong>Be sure to sign in with the IM Newsroom team account</strong> (the team Google account and Naver ID). If you use a personal account, alerts go to a personal inbox and other managers cannot manage the site.
            Before you start, check that (1) the domain is connected, (2) "Show in Google and Naver search" above is turned on, and (3) test stories have been deleted.
          </p>

          <section>
            <h4 className="font-bold">1. Naver: get the code</h4>
            <ol className="mt-1 list-decimal space-y-1 pl-5">
              <li><a href="https://searchadvisor.naver.com/console/board" target="_blank" rel="noopener" className="text-review underline underline-offset-2">Naver Search Advisor ↗</a> → top right <b>Webmaster Tools</b></li>
              <li>Paste the <b>site address</b> above into the site registration field → Register</li>
              <li>Under ownership verification, choose <b>HTML tag</b> → copy the entire line shown</li>
              <li><b>Do not click the verify button yet.</b></li>
            </ol>
          </section>

          <section>
            <h4 className="font-bold">2. Google: get the code</h4>
            <ol className="mt-1 list-decimal space-y-1 pl-5">
              <li><a href="https://search.google.com/search-console" target="_blank" rel="noopener" className="text-review underline underline-offset-2">Google Search Console ↗</a> → property selector at top left → <b>Add property</b> → <b>Add website</b></li>
              <li>Of the two options, enter the <b>site address</b> above under <b>URL prefix</b> → Continue (do not use the "Domain" option)</li>
              <li>Under other verification methods, choose <b>HTML tag</b> → copy the entire line</li>
              <li><b>Leave this window open.</b></li>
            </ol>
          </section>

          <section>
            <h4 className="font-bold">3. Paste here, save, then check</h4>
            <ol className="mt-1 list-decimal space-y-1 pl-5">
              <li>Paste each copied line, in full, into the <b>Naver verification code</b> and <b>Google verification code</b> fields above</li>
              <li>Click <b>[Save]</b> at the bottom of the page (no deployment is needed)</li>
              <li>Click <b>[Check search registration]</b> and confirm that all five lines show a green ✓</li>
            </ol>
          </section>

          <section>
            <h4 className="font-bold">4. Verify ownership, then submit sitemaps</h4>
            <ul className="mt-1 list-disc space-y-1 pl-5">
              <li><b>Naver</b>: <b>Verify ownership</b> → click the site address in your site list → in the left menu, under <b>Request → Submit sitemap</b>, enter the <b>sitemap</b> address → Confirm → under <b>Request → Submit RSS</b>, enter the <b>RSS</b> address → Confirm</li>
              <li><b>Google</b>: in the window you left open, click <b>Verify</b> → go to the property → under <b>Sitemaps</b> in the left menu, submit <code>sitemap.xml</code> and <code>news-sitemap.xml</code></li>
              <li><b>Google</b>: enter the site address in <b>URL inspection</b> in the left menu → <b>Request indexing</b> (this gets the home page listed sooner)</li>
            </ul>
          </section>

          <section>
            <h4 className="font-bold">5. Wrap up</h4>
            <ul className="mt-1 list-disc space-y-1 pl-5">
              <li>In Google Search Console, go to <b>Settings → Users and permissions → Add user</b> and add the publisher's Google account as an <b>Owner</b> (so the publisher can see search performance directly)</li>
              <li>Tell the publisher: it takes a few days to 2 weeks for search results to update, and to appear in Naver's <b>"News" tab</b> the outlet must apply for Naver's news search partnership review itself</li>
              <li>Also tick the <b>launch checklist</b> on this customer's card in Customer Support</li>
            </ul>
          </section>

          <section>
            <h4 className="font-bold">If you get stuck</h4>
            <ul className="mt-1 list-disc space-y-1 pl-5">
              <li><b>Ownership verification fails</b>: check that you saved and that the code shows ✓ under [Check search registration], then try verifying again after a minute</li>
              <li><b>Google sitemap shows "Couldn't fetch"</b>: this is common right after submitting. It usually changes to "Success" after a day. If it persists, delete the sitemap and submit it again</li>
              <li><b>The news sitemap is empty</b>: it only includes stories published in the last 48 hours. It fills in once you publish a story</li>
              <li><b>You changed the domain</b>: start over from step 1 with the new address and replace the codes</li>
            </ul>
          </section>
        </div>
      </details>
      ) : (
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
      )}
    </div>
  )
}

function Copy({ label, value }: { label: string; value: string }) {
  const t = useT()
  const [done, setDone] = useState(false)
  return (
    <li className="flex flex-wrap items-center gap-2">
      <span className="w-[190px] shrink-0 text-muted">{label}</span>
      <code className="min-w-0 break-all rounded bg-white px-2 py-0.5 ring-1 ring-black/5">{value}</code>
      <button type="button" onClick={() => navigator.clipboard?.writeText(value).then(() => { setDone(true); setTimeout(() => setDone(false), 1500) })} className="text-[12px] font-semibold text-review hover:underline">
        {done ? t('복사됨', 'Copied') : t('복사', 'Copy')}
      </button>
    </li>
  )
}
