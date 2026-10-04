'use server'

import { getCmsContext } from '@/lib/cms'
import { notify } from '@/lib/notify'
import { siteOrigin } from '@/lib/origin'

// 기사 상태가 바뀐 뒤 화면에서 부른다: 승인신청 → 편집장들, 반려·승인 → 쓴 기자
//   실제 기사 상태가 그 일과 맞을 때만, 같은 일은 10분에 한 번만 알린다
const STATUS = { submitted: 'in_review', rejected: 'rejected', published: 'published' } as const

export async function notifyArticle(id: string, event: keyof typeof STATUS) {
  const { supabase, user, profile, trial } = await getCmsContext()
  if (trial) return
  const { data: a } = await supabase.from('articles').select('id, title, status, author_id, reject_reason, outlet:outlets(name)').eq('id', id).maybeSingle()
  if (!a || a.status !== STATUS[event]) return
  if (event === 'submitted' && a.author_id !== user.id) return
  if (event !== 'submitted' && a.author_id === user.id) return
  const outlet = (a.outlet as unknown as { name: string } | null)?.name ?? ''
  const who = (profile?.full_name as string | undefined) ?? ''
  const url = `${siteOrigin()}/articles/${id}`
  const slot = Math.floor(Date.now() / 600_000)
  const kind = event === 'submitted' ? 'article_submitted' : event === 'rejected' ? 'article_rejected' : 'article_published'
  await notify(supabase, kind, id, `${kind}:${id}:${slot}`, () =>
    event === 'submitted'
      ? { subject: `[${outlet}] 승인신청: ${a.title}`, title: '승인을 기다리는 기사가 있습니다', lines: [`${who} 기자가 “${a.title}” 기사를 승인신청했습니다.`], button: { label: '기사 확인하기', url } }
      : event === 'rejected'
        ? { subject: `[${outlet}] 반려됨: ${a.title}`, title: '기사가 반려되었습니다', lines: [`“${a.title}”`, `반려 사유: ${a.reject_reason ?? '-'}`, '고친 뒤 다시 승인신청해 주세요.'], button: { label: '기사 고치기', url: `${url}/edit` } }
        : { subject: `[${outlet}] 발행됨: ${a.title}`, title: '기사가 승인되어 발행되었습니다', lines: [`“${a.title}” 기사를 ${who} 님이 승인했습니다.`], button: { label: '기사 보기', url } },
  )
}
