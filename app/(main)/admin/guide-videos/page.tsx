import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getCmsContext } from '@/lib/cms'
import { getT } from '@/lib/cms-t'
import { HELP_VIDEOS, posterOf, youtubeId } from '@/lib/help-videos'
import { listGuideVideos } from '@/lib/guide-videos'
import GuideVideoUploader from '@/components/cms/GuideVideoUploader'

// 이용안내 영상 올리기·바꾸기 (운영팀). 올린 영상은 로그인한 회원만 이용안내에서 볼 수 있다 (supabase/guide-videos.sql)
export default async function GuideVideosPage() {
  const { isStaff } = await getCmsContext()
  const { t } = await getT()
  if (!isStaff) redirect('/newsroom')
  const uploaded = await listGuideVideos()
  const map = new Map(uploaded.map((u) => [u.id, u]))
  const slots = HELP_VIDEOS.map((v) => ({
    id: v.id,
    title: v.title,
    poster: posterOf(v.id),
    youtube: !!youtubeId(v.youtube),
    uploaded: map.has(v.id) ? { size: map.get(v.id)!.size, updatedAt: map.get(v.id)!.updatedAt } : null,
  }))
  return (
    <div className="mx-auto max-w-[900px] px-4 py-6 md:px-8 md:py-10">
      <h1 className="text-[22px] font-extrabold tracking-tight">{t('이용안내 영상 관리', 'Manage help videos')}</h1>
      <p className="mt-1.5 text-[13.5px] leading-relaxed text-muted">
        {t('여기에 올린 영상은 로그인한 회원만', 'Videos uploaded here can be watched only by signed-in members, on the')} <Link href="/support/help#videos" className="underline">{t('이용안내', 'Help page')}</Link>{t('에서 볼 수 있습니다.', '.')} {t('같은 칸에 다시 올리면 순서와 자리는 그대로 두고 영상만 새것으로 바뀝니다.', 'Uploading again to the same slot keeps its order and position and only replaces the video.')}
        {t('올리지 않은 칸은 유튜브 영상이 있으면 그것을 보여 주고, 둘 다 없으면 화면에 나오지 않습니다. 화면 순서는 아래 순서와 같습니다.', 'For a slot with no upload, the YouTube video is shown if there is one; if there is neither, it does not appear. The on-screen order is the same as the order below.')}
      </p>
      <GuideVideoUploader slots={slots} />
    </div>
  )
}
