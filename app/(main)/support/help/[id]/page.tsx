import Link from 'next/link'
import { notFound } from 'next/navigation'
import { readyVideos, posterOf } from '@/lib/help-videos'
import { listGuideVideos, guideVideoUrls } from '@/lib/guide-videos'
import { getT } from '@/lib/cms-t'
import HelpVideoCard from '@/components/cms/HelpVideoCard'

// 영상 한 편만 보여 주는 안내 주소 (/support/help/영상이름). 고객에게 "이 영상 보세요" 하고 링크로 보낼 때 쓴다
//   로그인이 필요하다 (로그인하면 바로 이 화면으로 돌아온다)
export default async function HelpVideoPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params
  const { t, lang } = await getT()
  const uploaded = await listGuideVideos()
  const all = readyVideos(new Set(uploaded.map((u) => u.id)), lang)
  const i = all.findIndex((v) => v.id === id)
  if (i < 0) notFound()
  const v = all[i]
  const urls = await guideVideoUrls(v.own ? [v.id] : [])
  const next = all[i + 1]
  return (
    <div className="mx-auto max-w-[860px] px-4 py-6 md:px-8 md:py-10">
      <Link href="/support/help#videos" className="text-[13px] text-muted hover:text-ink hover:underline">← {t('이용안내 영상 목록', 'All help videos')}</Link>
      <div className="mt-4">
        <HelpVideoCard n={i + 1} title={v.title} desc={v.desc} videoId={v.videoId} src={v.own ? urls[v.id] : undefined} poster={posterOf(v.id)} link={v.link} shareId={v.id} autoOpen />
      </div>
      {next && (
        <p className="mt-5 text-[14px]">
          {t('다음 영상', 'Next video')}: <Link href={`/support/help/${next.id}`} className="font-semibold text-[#2F6BF0] hover:underline">{next.title} →</Link>
        </p>
      )}
    </div>
  )
}
