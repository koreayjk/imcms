'use client'

import { useActionState, useRef, useState } from 'react'
import { updateMyProfile, type ProfileState } from '@/app/(main)/account/actions'
import { uploadImage } from '@/components/editor/upload'
import PendingButton from './PendingButton'
import { useCmsLang, useT } from './CmsLang'

// 내 정보: 작성자 소개 (사진·소개·공개 이메일). 영문 홈페이지에서 기사 위 "By 이름"을 누르면 보이는 화면에 쓰인다
export default function ProfileForm({ bio, photoUrl, publicEmail, outletId }: { bio: string; photoUrl: string; publicEmail: string; outletId: string | null }) {
  const t = useT()
  const lang = useCmsLang()
  const [state, action] = useActionState<ProfileState, FormData>(updateMyProfile, {})
  const [photo, setPhoto] = useState(photoUrl)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  async function pick(file: File | undefined) {
    if (!file) return
    setBusy(true); setErr('')
    try { setPhoto(await uploadImage(file, outletId, null, lang)) } catch (e) { setErr(e instanceof Error ? e.message : String(e)) }
    setBusy(false)
    if (fileRef.current) fileRef.current.value = ''
  }

  return (
    <form action={action} className="space-y-3 border-t border-line pt-5">
      <div>
        <h2 className="text-[15px] font-bold">{t('작성자 소개', 'Author profile')}</h2>
        <p className="mt-0.5 text-[12.5px] text-muted">{t('영문 홈페이지에서 기사 위의 기자 이름을 누르면 나오는 소개 화면입니다. 비워도 됩니다.', 'Shown when readers click your name above a story on an English site. All fields are optional.')}</p>
      </div>
      <input type="hidden" name="photo_url" value={photo} />
      <div className="flex items-center gap-3">
        {photo
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={photo} alt="" className="h-20 w-16 rounded object-cover" />
          : <span aria-hidden className="grid h-20 w-16 place-items-center rounded bg-line/70 text-[12px] text-muted">{t('사진 없음', 'No photo')}</span>}
        <div className="flex flex-wrap items-center gap-2">
          <label className={`btn-secondary cursor-pointer px-3 py-1.5 text-[12.5px] ${busy ? 'pointer-events-none opacity-60' : ''}`}>
            {busy ? t('올리는 중…', 'Uploading…') : photo ? t('사진 바꾸기', 'Change photo') : t('사진 올리기', 'Upload photo')}
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => void pick(e.target.files?.[0])} />
          </label>
          {photo && <button type="button" onClick={() => setPhoto('')} className="text-[12.5px] text-muted underline">{t('지우기', 'Remove')}</button>}
        </div>
      </div>
      {err && <p role="alert" className="text-[12.5px] text-danger">{err}</p>}
      <div>
        <label htmlFor="public_email" className="text-[13px] font-semibold">{t('공개 이메일', 'Public email')}</label>
        <input id="public_email" name="public_email" type="email" defaultValue={publicEmail} maxLength={120} className="field-input max-w-sm" autoComplete="off" />
      </div>
      <div>
        <label htmlFor="bio" className="text-[13px] font-semibold">{t('소개', 'Bio')}</label>
        <textarea id="bio" name="bio" defaultValue={bio} maxLength={1500} rows={6} className="field-input" />
      </div>
      <div className="flex items-center gap-3">
        <PendingButton pending={t('저장 중…', 'Saving…')} className="btn-primary">{t('저장', 'Save')}</PendingButton>
        <p role={state.error ? 'alert' : 'status'} className={`text-[12.5px] ${state.error ? 'text-danger' : 'text-published'}`}>{state.error ?? (state.ok ? t('저장했습니다.', 'Saved.') : '')}</p>
      </div>
    </form>
  )
}
