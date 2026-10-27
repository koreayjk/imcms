'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { describe, syndicate } from '@/lib/syndicate'
import { refreshArticlePages } from '@/app/(main)/articles/refresh'
import { useT } from './CmsLang'

type Snapshot = { title: string | null; excerpt: string | null; body: string | null; byline?: string | null }

// 수정 이력의 한 판(고치기 전 내용)으로 기사 내용을 되돌린다
//   되돌리는 것도 수정이라, 지금 내용은 이력에 새로 남는다 (되돌린 걸 다시 되돌릴 수 있다)
//   발행된 원본이면 함께 송고한 다른 매체 사본도 같이 맞춘다
export default function RevisionRestore({ articleId, snapshot, when, live }: { articleId: string; snapshot: Snapshot; when: string; live: boolean }) {
  const t = useT()
  const [busy, setBusy] = useState(false)
  const router = useRouter()

  async function restore() {
    if (!window.confirm(t(`제목·부제·본문${snapshot.byline !== undefined ? '·기자명' : ''}을 ${when}에 고치기 전 내용으로 되돌릴까요?${live ? '\n발행된 기사라 홈페이지에도 바로 반영됩니다.' : ''}\n지금 내용은 수정 이력에 남아서 다시 되돌릴 수 있습니다.`, `Restore the headline, subhead, body${snapshot.byline !== undefined ? ' and byline' : ''} to how they were before the edit on ${when}?${live ? '\nThis story is published, so the site will update right away.' : ''}\nThe current version will be kept in the edit history, so you can undo this.`))) return
    setBusy(true)
    const supabase = createClient()
    const content: Record<string, unknown> = { title: snapshot.title ?? '', excerpt: snapshot.excerpt, body: snapshot.body ?? '' }
    if (snapshot.byline !== undefined) content.byline = snapshot.byline
    const { error } = await supabase.from('articles').update(content).eq('id', articleId)
    if (error) {
      window.alert(`${t('되돌리지 못했습니다', 'Could not restore')}: ${error.message}`)
    } else if (live) {
      try {
        const summary = describe(await syndicate(articleId))
        if (summary) window.alert(summary)
      } catch (e) {
        window.alert(`${t('함께 송고한 사본을 맞추는 중 문제가 생겼습니다', 'There was a problem updating the copies sent to other outlets')}: ${e instanceof Error ? e.message : ''}`)
      }
      await refreshArticlePages(articleId).catch(() => {})
    }
    setBusy(false)
    router.refresh()
  }

  return (
    <button type="button" onClick={restore} disabled={busy} className="btn-secondary text-[12.5px]">
      {busy ? t('되돌리는 중…', 'Restoring…') : t('이 수정 전으로 되돌리기', 'Restore to before this edit')}
    </button>
  )
}
