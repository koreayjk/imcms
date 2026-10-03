// 저작권 걱정 없는 사진 찾기 (기사쓰기 '추천 사진')
//   Openverse(위키미디어 공용·플리커 등 공개 라이선스 사진 모음)에서 상업적 이용과 수정이 허락된 라이선스만 찾는다:
//     CC0 · 퍼블릭 도메인 · CC BY · CC BY-SA  (변경 금지 ND·비영리 NC 는 제외)
//   CC BY·BY-SA 는 출처(작가·라이선스) 표기가 조건이라, 가져올 때 사진 설명에 자동으로 붙인다
//   서버에서만 쓴다

export type PhotoHit = {
  id: string
  title: string
  thumb: string
  url: string
  width: number | null
  height: number | null
  creator: string
  license: string
  licenseUrl: string
  source: string
  page: string
  // 사진 설명에 붙일 출처 표기 (예: "사진=Berthold Werner, 위키미디어 공용 (CC BY-SA 3.0)")
  credit: string
}

const LICENSES = 'cc0,pdm,by,by-sa'
const SOURCE_LABEL: Record<string, string> = { wikimedia: '위키미디어 공용', flickr: '플리커', geographorguk: 'Geograph', nappy: 'nappy', rawpixel: 'rawpixel', stocksnap: 'StockSnap' }

function licenseLabel(code: string, version: string | null) {
  if (code === 'cc0') return 'CC0'
  if (code === 'pdm') return '퍼블릭 도메인'
  return `CC ${code.toUpperCase()}${version ? ` ${version}` : ''}`
}

export function photoCredit(h: Pick<PhotoHit, 'creator' | 'source' | 'license'>) {
  // "RonAlmog, (Flickr page)" 같은 군더더기는 뺀다
  const name = h.creator.replace(/\((?:flickr|wikimedia)[^)]*\)/gi, '').replace(/[\s,]+$/, '').trim()
  const who = name && !/^unknown$/i.test(name) ? name : '작가 미상'
  return `사진=${who}, ${SOURCE_LABEL[h.source] ?? h.source} (${h.license})`
}

// 위키미디어 원본은 아주 클 수 있어 1280px 사본 주소로 바꾼다 (위키미디어는 정해진 폭만 만들어 준다)
export function downloadUrl(url: string) {
  const m = url.match(/^https:\/\/upload\.wikimedia\.org\/wikipedia\/commons\/([0-9a-f])\/([0-9a-f]{2})\/([^/?#]+)$/)
  if (!m || /\.svg$/i.test(m[3])) return url
  return `https://upload.wikimedia.org/wikipedia/commons/thumb/${m[1]}/${m[2]}/${m[3]}/1280px-${m[3]}`
}

export async function searchOpenPhotos(query: string, limit = 12): Promise<PhotoHit[]> {
  const q = query.trim().slice(0, 100)
  if (!q) return []
  const params = new URLSearchParams({ q, license: LICENSES, page_size: String(Math.min(20, limit + 6)), mature: 'false' })
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), 9000)
  try {
    const res = await fetch(`https://api.openverse.org/v1/images/?${params}`, {
      headers: { 'User-Agent': 'IMNewsroom/1.0 (https://imcms.vercel.app)' },
      signal: ctrl.signal,
      cache: 'no-store',
    })
    if (res.status === 429) throw new Error('사진 검색을 잠시 많이 썼습니다. 1~2분 뒤에 다시 찾아 주세요.')
    if (!res.ok) throw new Error(`사진 검색이 실패했습니다 (${res.status}).`)
    const data = (await res.json()) as { results?: any[] }
    return (data.results ?? [])
      // 너무 작은 사진은 기사에 쓰기 어려워 뺀다
      .filter((r) => r.url && (!r.width || r.width >= 800) && LICENSES.split(',').includes(r.license))
      .slice(0, limit)
      .map((r) => {
        const hit = {
          id: String(r.id),
          title: String(r.title ?? '').slice(0, 120),
          thumb: String(r.thumbnail ?? r.url),
          url: String(r.url),
          width: r.width ?? null,
          height: r.height ?? null,
          creator: String(r.creator ?? '').slice(0, 80),
          license: licenseLabel(String(r.license), r.license_version ?? null),
          licenseUrl: String(r.license_url ?? ''),
          source: String(r.source ?? r.provider ?? ''),
          page: String(r.foreign_landing_url ?? ''),
        }
        return { ...hit, credit: photoCredit(hit) }
      })
  } catch (e) {
    if (e instanceof Error && e.name === 'AbortError') throw new Error('사진 검색 응답이 늦습니다. 다시 시도해 주세요.')
    throw e
  } finally {
    clearTimeout(timer)
  }
}
