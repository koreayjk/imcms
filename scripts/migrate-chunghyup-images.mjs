// 청년후계농업신문(미래농업매거진) 이관: 기사 속 이미지를 팡고링고 S3에서 받아 우리 Supabase 저장소(media)에 올린다.
//
// 사용법 (Node 18 이상, 사용자 컴퓨터에서):
//   1) 팡고링고가 보낸 chunghyup_data.sql 을 이 컴퓨터에 풀어 둔다 (zip 안의 .sql)
//   2) 서비스 키는 Supabase 대시보드 > Project Settings > API 의 "service_role" 키.
//      채팅·메일·깃에 적지 말고, 아래처럼 이 터미널에서만 환경변수로 넣는다.
//        macOS/Linux:  export SUPABASE_SERVICE_ROLE_KEY='...'
//        Windows(PowerShell):  $env:SUPABASE_SERVICE_ROLE_KEY='...'
//   3) 먼저 확인만(아무것도 올리지 않음):  node scripts/migrate-chunghyup-images.mjs chunghyup_data.sql --dry
//   4) 실제로 올리기:                        node scripts/migrate-chunghyup-images.mjs chunghyup_data.sql
//   (선택) 용량이 커서 줄여 둔 파일만 올릴 때:  node scripts/migrate-chunghyup-images.mjs chunghyup_data.sql --local ./chunghyup-fix
//        --local 폴더 안에 article-images/날짜/파일 구조로 두면, 그 폴더에 있는 파일만 S3 대신 그 파일로 올린다
//   5) 끝나면 service_role 키를 Supabase에서 교체(Reset)하는 것을 권한다.
//
// 올라가는 곳: media/<매체id>/migrated/<팡고링고 경로>   예) media/020d226e-…/migrated/article-images/2026-01-07/xxxx.png
//   · 팡고링고 경로(article-images/날짜/파일)를 그대로 쓰므로, 본문 주소는 앞부분만 바꾸면 된다 (주소 바꾸기는 Claude가 한다)
//   · 이미 올라간 파일은 건너뛴다 (여러 번 실행해도 된다)
//   · 이 매체의 사진 용량(30GB, 베이직)에 들어간다. 약 320MB
// 다른 사이트(농림축산식품부·다음 브런치 등)의 이미지는 받지 않는다 (권리 확인 전).
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const OUTLET_ID = '020d226e-edea-4e08-a7d9-ba45bffba46d'           // 미래농업매거진
const SUPABASE_URL = 'https://xmkrpjsetdneulyyasrf.supabase.co'       // imcms 운영 프로젝트
const BUCKET = 'media'
const S3_HOST = /https:\/\/pango-lingo-chunghyup-assetsbucket-wrmvzvcu\.s3[a-z0-9.-]*amazonaws\.com\/([^"' )<>?]+)/g
const TYPES = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif' }
const PARALLEL = 6

const file = process.argv[2]
const dry = process.argv.includes('--dry')
const localDir = process.argv.includes('--local') ? process.argv[process.argv.indexOf('--local') + 1] : null
if (!file) { console.error('사용법: node scripts/migrate-chunghyup-images.mjs chunghyup_data.sql [--dry]'); process.exit(1) }
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!dry && !key) { console.error('SUPABASE_SERVICE_ROLE_KEY 환경변수가 없습니다. (파일 위쪽 설명 참고)'); process.exit(1) }

const sql = readFileSync(file, 'utf8')
const paths = [...new Set([...sql.matchAll(S3_HOST)].map((m) => decodeURIComponent(m[1])))].filter((p) => /^article-images\//.test(p) && (!localDir || existsSync(join(localDir, p)))).sort()
console.log(`이미지 ${paths.length}개 (${dry ? '확인만 — 올리지 않음' : '올리는 중'})`)
if (dry) { console.log(paths.slice(0, 5).join('\n'), '\n…'); process.exit(0) }

let done = 0, skipped = 0
const failed = []
async function one(p) {
  const target = `${OUTLET_ID}/migrated/${p}`
  const url = `${SUPABASE_URL}/storage/v1/object/${BUCKET}/${target.split('/').map(encodeURIComponent).join('/')}`
  const ext = p.split('.').pop().toLowerCase()
  const type = TYPES[ext]
  if (!type) throw new Error(`모르는 확장자: ${ext}`)
  let body
  if (localDir) body = readFileSync(join(localDir, p))
  else {
    const src = await fetch(`https://pango-lingo-chunghyup-assetsbucket-wrmvzvcu.s3.amazonaws.com/${p.split('/').map(encodeURIComponent).join('/')}`)
    if (!src.ok) throw new Error(`내려받기 실패 ${src.status}`)
    body = Buffer.from(await src.arrayBuffer())
  }
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, apikey: key, 'Content-Type': type, 'Cache-Control': 'max-age=31536000', 'x-upsert': 'false' },
    body,
  })
  if (res.status === 409 || (res.status === 400 && /already exists|Duplicate/i.test(await res.clone().text()))) { skipped++; return }
  if (!res.ok) throw new Error(`올리기 실패 ${res.status} ${(await res.text()).slice(0, 120)}`)
  done++
}

const queue = [...paths]
await Promise.all(Array.from({ length: PARALLEL }, async () => {
  while (queue.length) {
    const p = queue.shift()
    try { await one(p) } catch (e) { failed.push(`${p} — ${e.message}`) }
    const n = done + skipped + failed.length
    if (n % 20 === 0 || n === paths.length) console.log(`${n}/${paths.length}`)
  }
}))

console.log(`\n올림 ${done}, 이미 있어서 건너뜀 ${skipped}, 실패 ${failed.length}`)
if (failed.length) { console.log(failed.join('\n')); process.exit(2) }
