'use client'

import { useState } from 'react'
import { articleLink } from '@/app/(main)/articles/share'
import { useT } from './CmsLang'

// 기사 링크 복사: 공개된 기사는 기사 주소, 아직 발행 전이면 미리보기 링크 (받은 사람만 볼 수 있음)
export default function CopyLinkButton({ articleId, className = '', label }: { articleId: string; className?: string; label?: string }) {
  const t = useT()
  const [state, setState] = useState<'idle' | 'busy' | 'live' | 'preview'>('idle')
  async function copy() {
    setState('busy')
    const r = await articleLink(articleId).catch(() => ({ ok: false as const, error: t('링크를 만들지 못했습니다.', 'Could not create the link.') }))
    if (!r.ok) { setState('idle'); window.alert(r.error); return }
    try {
      await navigator.clipboard.writeText(r.url)
    } catch {
      window.prompt(t('아래 링크를 복사하세요', 'Copy the link below'), r.url)
    }
    setState(r.live ? 'live' : 'preview')
    setTimeout(() => setState('idle'), 2500)
  }
  return (
    <button type="button" onClick={copy} disabled={state === 'busy'} title={t('기사 링크를 복사합니다. 아직 발행 전이면 받은 사람만 볼 수 있는 미리보기 링크입니다.', 'Copies the story link. If it is not published yet, this is a preview link that only people who receive it can open.')} className={className}>
      {state === 'busy' ? '…' : state === 'live' ? t('복사됨 ✓', 'Copied ✓') : state === 'preview' ? t('미리보기 링크 복사됨 ✓', 'Preview link copied ✓') : (label ?? t('링크 복사', 'Copy link'))}
    </button>
  )
}
