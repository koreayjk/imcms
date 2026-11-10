import { unstable_cache } from 'next/cache'

// 유튜브 채널의 쇼츠 목록 (홈페이지 "쇼츠" 구역)
//   1) YOUTUBE_API_KEY 환경 변수가 있으면 유튜브 공식 API로 쇼츠 전용 목록(채널 ID의 UC → UUSH)을 최대 50개까지 읽는다
//   2) 없으면 유튜브가 공개하는 쇼츠 전용 목록(RSS)을 읽는다 — 최근 15개까지만 준다
//   3) 쇼츠 전용 목록을 못 읽으면 채널 전체 영상 목록(최근 15개)에서 쇼츠만 골라낸다 (youtube.com/shorts/<ID> 가 열리면 쇼츠)
//   서버가 30분마다 한 번만 읽고, 실패는 저장하지 않는다 (다음 접속에서 다시 시도)
export type Short = { id: string; title: string; published: string }

const decode = (s: string) => s.replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').trim()

function parseFeed(xml: string): Short[] {
  return xml.split('<entry>').slice(1).map((e) => ({
    id: /<yt:videoId>([\w-]{6,20})</.exec(e)?.[1] ?? '',
    title: decode(/<title>([^<]*)</.exec(e)?.[1] ?? ''),
    published: /<published>([^<]*)</.exec(e)?.[1] ?? '',
  })).filter((x) => x.id)
}

async function viaApi(channelId: string, key: string): Promise<Short[]> {
  const playlist = `UUSH${channelId.slice(2)}`
  const res = await fetch(`https://www.googleapis.com/youtube/v3/playlistItems?part=snippet,contentDetails&maxResults=50&playlistId=${playlist}&key=${encodeURIComponent(key)}`, { signal: AbortSignal.timeout(8000), cache: 'no-store' })
  if (!res.ok) throw new Error(`api ${res.status}`)
  const j = (await res.json()) as { items?: { snippet?: { title?: string; publishedAt?: string }; contentDetails?: { videoId?: string; videoPublishedAt?: string } }[] }
  return (j.items ?? []).map((it) => ({
    id: it.contentDetails?.videoId ?? '',
    title: decode(it.snippet?.title ?? ''),
    published: it.contentDetails?.videoPublishedAt ?? it.snippet?.publishedAt ?? '',
  })).filter((x) => /^[\w-]{6,20}$/.test(x.id))
}

async function viaShortsFeed(channelId: string): Promise<Short[]> {
  const res = await fetch(`https://www.youtube.com/feeds/videos.xml?playlist_id=UUSH${channelId.slice(2)}`, { signal: AbortSignal.timeout(8000), cache: 'no-store' })
  if (!res.ok) throw new Error(`shorts feed ${res.status}`)
  return parseFeed(await res.text())
}

async function viaChannelFeed(channelId: string): Promise<Short[]> {
  const res = await fetch(`https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`, { signal: AbortSignal.timeout(8000), cache: 'no-store' })
  if (!res.ok) throw new Error(`feed ${res.status}`)
  const items = parseFeed(await res.text())
  const flags = await Promise.all(items.map(async (x) => {
    try {
      const r = await fetch(`https://www.youtube.com/shorts/${x.id}`, { redirect: 'manual', signal: AbortSignal.timeout(6000), cache: 'no-store' })
      return r.status === 200
    } catch { return false }
  }))
  return items.filter((_, i) => flags[i])
}

async function loadShorts(channelId: string): Promise<Short[]> {
  const key = process.env.YOUTUBE_API_KEY
  if (key) {
    try { const a = await viaApi(channelId, key); if (a.length) return a } catch { /* 키 문제 등은 아래 공개 목록으로 */ }
  }
  try { const f = await viaShortsFeed(channelId); if (f.length) return f } catch { /* 아래로 */ }
  return viaChannelFeed(channelId)
}

const cached = unstable_cache(loadShorts, ['yt-shorts-v2'], { revalidate: 1800, tags: ['shorts'] })

export async function getShorts(channelId: string, count = 20): Promise<Short[]> {
  try { return (await cached(channelId)).slice(0, count) } catch { return [] }
}
