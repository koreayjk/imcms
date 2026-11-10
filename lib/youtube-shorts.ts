import { unstable_cache } from 'next/cache'

// 유튜브 채널의 쇼츠 목록 (홈페이지 "쇼츠" 구역). 로그인·API 키 없이 채널의 공개 영상 목록(RSS)을 읽는다.
//   RSS 는 최근 영상 15개까지만 준다 → 그중 쇼츠만 골라 쓴다. 쇼츠 구분: youtube.com/shorts/<영상ID> 가 열리면(200) 쇼츠, 다른 주소로 넘어가면(3xx) 일반 영상
//   서버가 30분마다 한 번만 읽어 오고, 읽기에 실패하면 다음 접속에서 다시 시도한다 (실패는 저장하지 않는다)
export type Short = { id: string; title: string; published: string }

const decode = (s: string) => s.replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').trim()

async function loadShorts(channelId: string): Promise<Short[]> {
  const res = await fetch(`https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`, { signal: AbortSignal.timeout(8000), cache: 'no-store' })
  if (!res.ok) throw new Error(`feed ${res.status}`)
  const xml = await res.text()
  const items = xml.split('<entry>').slice(1).map((e) => ({
    id: /<yt:videoId>([\w-]{6,20})</.exec(e)?.[1] ?? '',
    title: decode(/<title>([^<]*)</.exec(e)?.[1] ?? ''),
    published: /<published>([^<]*)</.exec(e)?.[1] ?? '',
  })).filter((x) => x.id)
  const flags = await Promise.all(items.map(async (x) => {
    try {
      const r = await fetch(`https://www.youtube.com/shorts/${x.id}`, { redirect: 'manual', signal: AbortSignal.timeout(6000), cache: 'no-store' })
      return r.status === 200
    } catch { return false }
  }))
  return items.filter((_, i) => flags[i])
}

const cached = unstable_cache(loadShorts, ['yt-shorts-v1'], { revalidate: 1800, tags: ['shorts'] })

export async function getShorts(channelId: string, count = 12): Promise<Short[]> {
  try { return (await cached(channelId)).slice(0, count) } catch { return [] }
}
