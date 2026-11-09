'use server'

import { getCmsContext } from '@/lib/cms'
import { getT } from '@/lib/cms-t'

// 유튜브 채널 주소(https://www.youtube.com/@이름 등)에서 채널 ID(UC로 시작하는 24자)를 찾는다. 편집장 이상. youtube.com 주소만 읽는다
export async function lookupYoutubeChannel(input: string): Promise<{ error?: string; channelId?: string; name?: string }> {
  const { isEditorPlus, isStaff } = await getCmsContext()
  const { t } = await getT()
  if (!isEditorPlus && !isStaff) return { error: t('편집장 이상만 쓸 수 있습니다.', 'Only Editors-in-Chief and above can use this.') }
  let u: URL
  try { u = new URL(String(input ?? '').trim()) } catch { return { error: t('유튜브 채널 주소를 확인해 주세요. 예: https://www.youtube.com/@채널이름', 'Check the YouTube channel link. Example: https://www.youtube.com/@channel') } }
  if (u.protocol !== 'https:' || !/^(www\.|m\.)?youtube\.com$/.test(u.hostname)) return { error: t('youtube.com 주소만 쓸 수 있습니다.', 'Only youtube.com links are accepted.') }
  const direct = /^\/channel\/(UC[\w-]{22})/.exec(u.pathname)
  if (direct) return { channelId: direct[1] }
  if (!/^\/(@[^/]{1,80}|c\/[^/]{1,80}|user\/[^/]{1,80})\/?$/.test(u.pathname)) return { error: t('채널 주소(…/@채널이름)를 넣어 주세요. 영상 주소는 안 됩니다.', 'Enter a channel link (…/@name), not a video link.') }
  try {
    const res = await fetch(`https://www.youtube.com${u.pathname}`, { signal: AbortSignal.timeout(9000), cache: 'no-store', headers: { 'Accept-Language': 'ko,en;q=0.8' } })
    if (!res.ok) return { error: t(`채널을 찾지 못했습니다 (${res.status}).`, `Channel not found (${res.status}).`) }
    const html = await res.text()
    const id = /channel_id=(UC[\w-]{22})/.exec(html)?.[1] ?? /"channelId":"(UC[\w-]{22})"/.exec(html)?.[1]
    if (!id) return { error: t('채널 ID를 찾지 못했습니다. 채널 ID(UC로 시작)를 직접 넣어 주세요.', 'Could not find the channel ID. Enter it manually (starts with UC).') }
    const name = /<meta property="og:title" content="([^"]{1,120})"/.exec(html)?.[1]
    return { channelId: id, name }
  } catch {
    return { error: t('유튜브에서 답이 없습니다. 잠시 뒤에 다시 해 보세요.', 'YouTube did not respond. Try again in a moment.') }
  }
}
