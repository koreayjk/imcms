#!/usr/bin/env node
// 이관 확인 (병행 기간과 전환 날에 쓴다): 옛 주소가 새 기사로 넘어가고, 새 기사가 열리는지 하나씩 확인한다
//
//   node scripts/check-migration.mjs --site https://새주소 --from 1 --to 838
//   node scripts/check-migration.mjs --site https://새주소 --list 옛주소목록.txt          (한 줄에 하나: 전체 주소 또는 /경로)
//   옵션: --pattern "/ko-kr/articles/{n}"  (번호를 끼워 넣을 옛 주소 모양. 기본값은 팡고링고)
//         --sample 50                      (번호 범위에서 이만큼만 고르게 뽑아 확인. 기본은 전부)
//         --out 결과.txt                    (문제가 있는 주소를 파일로)
//
//   '새 주소'에만 요청을 보낸다. 옛 서비스(팡고링고 등)에는 아무 요청도 하지 않는다.
//   기사 한 건당 요청 2번(넘기기 확인 → 새 기사 열림), 동시에 4개씩, 이 도구임을 밝히는 이름으로 천천히 보낸다.
import { readFileSync, writeFileSync } from 'node:fs'

const args = Object.fromEntries(process.argv.slice(2).reduce((a, x, i, all) => (x.startsWith('--') ? [...a, [x.slice(2), all[i + 1] && !all[i + 1].startsWith('--') ? all[i + 1] : 'true']] : a), []))
const site = (args.site || '').replace(/\/$/, '')
if (!/^https?:\/\//.test(site)) {
  console.error('사용법: node scripts/check-migration.mjs --site https://새주소 --from 1 --to 838 [--pattern "/ko-kr/articles/{n}"] [--sample 50] [--list 파일] [--out 결과.txt]')
  process.exit(1)
}
const UA = 'IMNewsroom-MigrationCheck/1.0 (+https://imnewsroom.com)'
const pattern = args.pattern || '/ko-kr/articles/{n}'

let paths = []
if (args.list) {
  paths = readFileSync(args.list, 'utf8').split(/\r?\n/).map((l) => l.trim()).filter(Boolean).map((l) => l.replace(/^https?:\/\/[^/]+/, ''))
} else {
  const from = Number(args.from ?? 1), to = Number(args.to ?? 1)
  if (!Number.isInteger(from) || !Number.isInteger(to) || to < from) { console.error('--from / --to 숫자를 확인해 주세요.'); process.exit(1) }
  for (let n = from; n <= to; n++) paths.push(pattern.replace('{n}', String(n)))
}
if (args.sample && Number(args.sample) > 0 && Number(args.sample) < paths.length) {
  const k = Number(args.sample), step = paths.length / k
  paths = Array.from({ length: k }, (_, i) => paths[Math.floor(i * step)])
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
async function get(url, manual) {
  for (let t = 0; t < 3; t++) {
    try { return await fetch(url, { redirect: manual ? 'manual' : 'follow', headers: { 'user-agent': UA }, signal: AbortSignal.timeout(20000) }) }
    catch { await sleep(500 * (t + 1)) }
  }
  return null
}

const bad = []
let ok = 0, notMoved = 0
async function check(path) {
  const r = await get(site + path, true)
  if (!r) return bad.push(`${path}  → 응답 없음`)
  if (r.status === 404) { notMoved++; return bad.push(`${path}  → 404 (이 번호의 기사를 옮기지 않았거나 없는 번호)`) }
  const to = r.headers.get('location') || ''
  if (![301, 308].includes(r.status) || !/\/news\/[0-9a-f-]{36}$/i.test(to)) return bad.push(`${path}  → ${r.status} ${to} (영구 이동(301·308)이 아니거나 새 기사 주소가 아님)`)
  const page = await get(new URL(to, site).href, false)
  if (!page || page.status !== 200) return bad.push(`${path}  → ${to} 가 ${page ? page.status : '응답 없음'}`)
  const html = await page.text()
  if (!/<h1[\s>]/i.test(html)) return bad.push(`${path}  → ${to} 에 기사 제목이 없음`)
  ok++
}

let next = 0
async function worker() {
  while (next < paths.length) {
    const p = paths[next++]
    await check(p)
    if (next % 25 === 0) process.stdout.write(`  ${next}/${paths.length}\r`)
    await sleep(150)
  }
}
await Promise.all(Array.from({ length: 4 }, worker))

// 사이트 공통 파일
console.log('')
for (const p of ['/sitemap.xml', '/news-sitemap.xml', '/rss.xml', '/robots.txt']) {
  const r = await get(site + p, false)
  console.log(`${r && r.status === 200 ? '✓' : '✗'} ${p}  ${r ? r.status : '응답 없음'}`)
}
console.log(`\n확인한 옛 주소 ${paths.length}개: 정상 ${ok} · 문제 ${bad.length} (그중 404 ${notMoved})`)
if (bad.length) {
  const show = bad.slice(0, 15)
  console.log(show.join('\n') + (bad.length > show.length ? `\n… 외 ${bad.length - show.length}건` : ''))
  if (args.out) { writeFileSync(args.out, bad.join('\n') + '\n'); console.log(`문제 목록을 ${args.out} 에 저장했습니다.`) }
}
process.exit(bad.length ? 2 : 0)
