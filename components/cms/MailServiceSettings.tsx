'use client'

import { useActionState } from 'react'
import { saveMailAddress, type AddressState } from '@/app/(main)/press/email/actions'
import PendingButton from './PendingButton'

// 관리자만: 메일 수신 서비스(Resend) 연결
export default function MailServiceSettings({ address, webhook }: { address: string | null; webhook: string | null }) {
  const [state, action] = useActionState<AddressState, FormData>(saveMailAddress, {})
  return (
    <section className="mt-6 rounded-lg border border-review/30 bg-review/5 p-6">
      <h2 className="text-[15px] font-bold">관리자 설정 · 메일 수신 서비스 연결 <span className="text-[12px] font-normal text-muted">(관리자에게만 보입니다)</span></h2>
      <p className="mt-1 text-[13px] text-muted">처음 한 번만 하면 됩니다. 기자마다 따로 할 필요 없습니다.</p>

      <ol className="mt-4 list-decimal space-y-3 pl-5 text-[13.5px] leading-[1.75]">
        <li>
          <a href="https://resend.com" target="_blank" rel="noopener" className="font-semibold underline underline-offset-2">resend.com</a>에서 <strong>Receiving</strong>(메일 받기)을 켭니다. Resend가 주는 <strong>…@…resend.app</strong> 주소를 쓰거나, 우리 도메인에 MX 기록을 넣어 우리 주소로 받을 수 있습니다.
        </li>
        <li>
          받을 주소 하나를 정해 아래 칸에 넣고 저장합니다 (예: press@abc123.resend.app). 기자마다 press+고유값@… 주소가 자동으로 만들어집니다.
          <form action={action} className="mt-2 flex gap-2">
            <label htmlFor="mail-address" className="sr-only">수신 주소</label>
            <input id="mail-address" name="address" defaultValue={address ?? ''} placeholder="press@abc123.resend.app" className="field-input max-w-sm bg-white" />
            <PendingButton pending="저장 중…" className="btn-primary">저장</PendingButton>
          </form>
          {state.error && <p role="alert" className="mt-1 text-[12.5px] text-danger">{state.error}</p>}
          {state.ok && <p role="status" className="mt-1 text-[12.5px] text-published">저장했습니다. 이제 기자마다 전용 주소가 만들어집니다.</p>}
        </li>
        <li>
          Resend → <strong>Webhooks</strong> → <strong>Add Endpoint</strong>에 아래 주소를 넣고 이벤트는 <strong>email.received</strong>를 고릅니다.
          {webhook ? (
            <div className="mt-2 flex items-center gap-2 rounded border border-line bg-white py-1.5 pl-3 pr-1.5">
              <code className="min-w-0 flex-1 truncate text-[12.5px]">{webhook}</code>
              <button type="button" onClick={() => navigator.clipboard.writeText(webhook)} className="rounded bg-ink px-3 py-1.5 text-[12.5px] font-semibold text-white">복사</button>
            </div>
          ) : (
            <p className="mt-1 text-danger">비밀 열쇠를 읽지 못했습니다. press-email.sql 실행 여부를 확인하세요.</p>
          )}
          <p className="mt-1 text-[12.5px] text-muted">이 주소에는 비밀 열쇠가 들어 있습니다. 다른 곳에 공유하지 마세요. 웹훅을 만든 뒤 나오는 <strong>Signing Secret</strong>(whsec_…)은 Vercel 환경 변수 RESEND_WEBHOOK_SECRET 에 넣어 주세요.</p>
        </li>
        <li>기자들에게 “보도자료함 → 메일로 받기”에서 안내대로 설정하라고 알려 주세요.</li>
      </ol>
      <p className="mt-4 text-[12.5px] leading-relaxed text-muted">
        Resend는 알림·뉴스레터 메일 보내기에도 같은 계정을 씁니다(RESEND_API_KEY). 받는 메일·보내는 메일이 많아지면 유료 요금제가 필요합니다(Resend 요금표 확인).
        나중에 제품 도메인을 사면 수신 주소만 우리 도메인 주소로 바꾸면 됩니다.
      </p>
    </section>
  )
}
