// 서버에서만 쓴다 (토큰이 브라우저로 가지 않게)

// 매체 도메인을 Vercel 프로젝트에 자동으로 등록하고 연결 상태(DNS)를 확인한다
//   Vercel 환경 변수: VERCEL_API_TOKEN(도메인 관리용 토큰), VERCEL_PROJECT_ID, (팀 계정이면) VERCEL_TEAM_ID
//   설정이 없으면 아무것도 하지 않는다 (지금처럼 Vercel 화면에서 직접 추가)
const TOKEN = process.env.VERCEL_API_TOKEN
const PROJECT = process.env.VERCEL_PROJECT_ID
const TEAM = process.env.VERCEL_TEAM_ID

// Vercel 기본 DNS 값 (Vercel이 다른 값을 권하면 그 값을 쓴다)
export const DEFAULT_A = '76.76.21.21'
export const DEFAULT_CNAME = 'cname.vercel-dns.com'

export const domainsReady = () => !!(TOKEN && PROJECT)

async function api(path: string, init: RequestInit = {}) {
  const url = `https://api.vercel.com${path}${TEAM ? `${path.includes('?') ? '&' : '?'}teamId=${encodeURIComponent(TEAM)}` : ''}`
  const res = await fetch(url, {
    ...init,
    cache: 'no-store',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json', ...(init.headers ?? {}) },
  })
  const body = await res.json().catch(() => ({}))
  return { ok: res.ok, status: res.status, body: body as any }
}

// *.vercel.app 같은 하위 주소는 www 를 만들지 않는다
const isApex = (d: string) => d.split('.').length === 2 || /\.(co|or|ne|go|ac|re|pe)\.kr$/.test(d) && d.split('.').length === 3
const isVercelSub = (d: string) => d.endsWith('.vercel.app')

async function addOne(name: string, redirect?: string) {
  const r = await api(`/v10/projects/${PROJECT}/domains`, {
    method: 'POST',
    body: JSON.stringify(redirect ? { name, redirect, redirectStatusCode: 308 } : { name }),
  })
  if (r.ok) return null
  const code = r.body?.error?.code as string | undefined
  // 이미 이 프로젝트에 있으면 성공으로 본다
  if (code === 'domain_already_in_use' || code === 'domain_already_exists' || r.status === 409) {
    const mine = await api(`/v9/projects/${PROJECT}/domains/${encodeURIComponent(name)}`)
    if (mine.ok) return null
    return `${name}: 다른 Vercel 프로젝트에서 쓰고 있는 도메인입니다.`
  }
  return `${name}: ${r.body?.error?.message ?? `Vercel 오류 (${r.status})`}`
}

// 도메인 등록: 대표 도메인 + www(대표 도메인으로 이동). 실패해도 매체 저장은 막지 않고 안내 문구만 돌려준다
export async function connectDomain(domain: string | null | undefined): Promise<string | null> {
  if (!domain || !domainsReady()) return null
  try {
    const err = await addOne(domain)
    if (err) return err
    if (!isVercelSub(domain) && isApex(domain)) {
      const wErr = await addOne(`www.${domain}`, domain)
      if (wErr) return wErr
    }
    return null
  } catch (e) {
    return `Vercel에 연결하지 못했습니다: ${e instanceof Error ? e.message : String(e)}`
  }
}

export type DomainRecord = { type: 'A' | 'CNAME' | 'TXT'; host: string; value: string }
export type DomainStatus =
  | { state: 'off' }
  | { state: 'missing' }
  | { state: 'ok' }
  | { state: 'dns'; records: DomainRecord[] }
  | { state: 'verify'; records: DomainRecord[] }
  | { state: 'error'; message: string }

// 연결 상태: 등록됐는지 → 소유 확인(TXT)이 필요한지 → DNS가 맞게 설정됐는지
export async function domainStatus(domain: string): Promise<DomainStatus> {
  if (!domainsReady()) return { state: 'off' }
  try {
    const p = await api(`/v9/projects/${PROJECT}/domains/${encodeURIComponent(domain)}`)
    if (p.status === 404) return { state: 'missing' }
    if (!p.ok) return { state: 'error', message: p.body?.error?.message ?? `Vercel 오류 (${p.status})` }
    if (p.body?.verified === false && Array.isArray(p.body?.verification)) {
      const records = (p.body.verification as any[]).map((v) => ({ type: String(v.type).toUpperCase() as DomainRecord['type'], host: String(v.domain).replace(`.${domain}`, '').replace(domain, '@'), value: String(v.value) }))
      return { state: 'verify', records }
    }
    if (isVercelSub(domain)) return { state: 'ok' }
    const c = await api(`/v6/domains/${encodeURIComponent(domain)}/config`)
    if (c.ok && c.body?.misconfigured === false) return { state: 'ok' }
    const ip = (c.body?.recommendedIPv4?.find?.((x: any) => x.rank === 1)?.value?.[0] as string | undefined) ?? DEFAULT_A
    const cname = ((c.body?.recommendedCNAME?.find?.((x: any) => x.rank === 1)?.value as string | undefined) ?? DEFAULT_CNAME).replace(/\.$/, '')
    const records: DomainRecord[] = isApex(domain)
      ? [{ type: 'A', host: '@', value: ip }, { type: 'CNAME', host: 'www', value: cname }]
      : [{ type: 'CNAME', host: domain.split('.')[0], value: cname }]
    return { state: 'dns', records }
  } catch (e) {
    return { state: 'error', message: e instanceof Error ? e.message : String(e) }
  }
}
