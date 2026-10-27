'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { formatDateTime } from '@/lib/format'
import { deviceLabel } from '@/lib/device'
import { useCmsLang, useT } from './CmsLang'

export type LoginRow = { created_at: string; ip: string | null; user_agent: string | null; session_id: string | null; active: boolean; current: boolean }

// 로그인 기록 표 + 모든 기기에서 로그아웃 (내 정보 · 회원 관리에서 같이 쓴다)
//   self: 내 기록이면 '지금 이 기기'는 남기고 다른 기기만 끊는다
export default function LoginHistory({ rows, self, name, signOut }: {
  rows: LoginRow[]
  self: boolean
  name?: string
  signOut: () => Promise<{ error?: string; ok?: string }>
}) {
  const t = useT()
  const lang = useCmsLang()
  const router = useRouter()
  const [msg, setMsg] = useState<{ error?: string; ok?: string }>({})
  const [pending, start] = useTransition()
  const others = rows.filter((r) => r.active && !r.current).length

  function run() {
    const q = self
      ? t('지금 쓰는 이 기기만 남기고, 다른 컴퓨터·휴대폰의 로그인을 모두 끊을까요?\n\n끊긴 기기는 바로 편집국을 열 수 없고, 다시 로그인해야 합니다.', 'Keep only this device signed in and sign out all other computers and phones?\n\nSigned-out devices can no longer open the newsroom and must sign in again.')
      : t(`${name ?? '이 회원'}님의 로그인을 모든 기기에서 끊을까요?\n\n바로 편집국을 열 수 없게 되고, 다시 로그인해야 합니다.\n(퇴사·계정 도용이 의심되면 '출입 정지'도 함께 하세요.)`, `Sign ${name ?? 'this member'} out of all devices?\n\nThey will immediately lose access to the newsroom and must sign in again.\n(If you suspect the person has left or the account was hijacked, also suspend their access.)`)
    if (!window.confirm(q)) return
    start(async () => {
      const r = await signOut()
      setMsg(r)
      router.refresh()
    })
  }

  return (
    <div className="space-y-3">
      {rows.length ? (
        <div className="overflow-x-auto rounded-md border border-line">
          <table className="table-cards w-full text-[13px] md:min-w-[480px]">
            <thead>
              <tr className="border-b border-line text-left text-[12px] text-muted">
                <th className="px-4 py-2 font-normal">{t('로그인 시각', 'Signed in at')}</th>
                <th className="px-2 py-2 font-normal">{t('기기 · 브라우저', 'Device · Browser')}</th>
                <th className="px-2 py-2 font-normal">IP</th>
                <th className="px-4 py-2 text-right font-normal">{t('상태', 'Status')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((r, i) => (
                <tr key={r.session_id ?? i}>
                  <td className="whitespace-nowrap px-4 py-2 tabular-nums">{formatDateTime(r.created_at, lang)}</td>
                  <td data-label={t('기기', 'Device')} className="px-2 py-2" title={r.user_agent ?? ''}>{deviceLabel(r.user_agent, lang)}</td>
                  <td data-label="IP" className="break-all px-2 py-2 font-mono text-[12px] text-muted">{r.ip || '-'}</td>
                  <td className="whitespace-nowrap px-4 py-2 text-right">
                    {r.current
                      ? <span className="rounded bg-review/10 px-1.5 py-0.5 text-[11.5px] font-bold text-review">{t('지금 이 기기', 'This device')}</span>
                      : r.active
                        ? <span className="rounded bg-published/10 px-1.5 py-0.5 text-[11.5px] font-bold text-published">{t('로그인 중', 'Signed in')}</span>
                        : <span className="text-[11.5px] text-muted">{t('끝남', 'Ended')}</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="rounded-md border border-line px-4 py-4 text-center text-[13px] text-muted">{t('아직 남은 로그인 기록이 없습니다. 다음 로그인부터 기록됩니다.', 'No sign-in history yet. Sign-ins will be recorded from the next one.')}</p>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={run} disabled={pending || (self && !others)} className="btn-secondary px-3 py-1.5 text-[13px] disabled:cursor-not-allowed disabled:opacity-50">
          {pending ? t('끊는 중…', 'Signing out…') : self ? t('다른 기기 모두 로그아웃', 'Sign out all other devices') : t('모든 기기에서 로그아웃', 'Sign out of all devices')}
        </button>
        {self && <span className="text-[12px] text-muted">{others ? t(`지금 이 기기 말고 ${others}곳에 로그인돼 있습니다.`, `Signed in on ${others} other ${others === 1 ? 'device' : 'devices'}.`) : t('다른 기기의 로그인은 없습니다.', 'No other devices are signed in.')}</span>}
        {msg.error && <span role="alert" className="text-[12.5px] text-danger">{msg.error}</span>}
        {msg.ok && !msg.error && <span role="status" className="text-[12.5px] text-published">{msg.ok}</span>}
      </div>
    </div>
  )
}
