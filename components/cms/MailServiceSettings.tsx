'use client'

import { useFormState } from 'react-dom'
import { saveMailAddress, type AddressState } from '@/app/(main)/press/email/actions'
import PendingButton from './PendingButton'

// 관리자만: 메일 수신 서비스(Postmark) 연결
export default function MailServiceSettings({ address, webhook }: { address: string | null; webhook: string | null }) {
  const [state, action] = useFormState<AddressState, FormData>(saveMailAddress, {})
  return (
    <section className="mt-6 rounded-lg border border-review/30 bg-review/5 p-6">
      <h2 className="text-[15px] font-bold">관리자 설정 · 메일 수신 서비스 연결 <span className="text-[12px] font-normal text-muted">(관리자에게만 보입니다)</span></h2>
      <p className="mt-1 text-[13px] text-muted">처음 한 번만 하면 됩니다. 기자마다 따로 할 필요 없습니다.</p>

      <ol className="mt-4 list-decimal space-y-3 pl-5 text-[13.5px] leading-[1.75]">
        <li>
          <a href="https://postmarkapp.com" target="_blank" rel="noopener" className="font-semibold underline underline-offset-2">postmarkapp.com</a>에 가입하고 <strong>Server</strong>를 하나 만듭니다 (이름 예: IM 뉴스룸).
        </li>
        <li>
          서버 안의 <strong>Default Inbound Stream</strong> → <strong>Settings</strong>에 있는 <strong>Inbound address</strong>(…@inbound.postmarkapp.com)를 복사해 아래 칸에 붙여넣고 저장합니다.
          <form action={action} className="mt-2 flex gap-2">
            <label htmlFor="mail-address" className="sr-only">수신 주소</label>
            <input id="mail-address" name="address" defaultValue={address ?? ''} placeholder="abc123@inbound.postmarkapp.com" className="field-input max-w-sm bg-white" />
            <PendingButton pending="저장 중…" className="btn-primary">저장</PendingButton>
          </form>
          {state.error && <p role="alert" className="mt-1 text-[12.5px] text-danger">{state.error}</p>}
          {state.ok && <p role="status" className="mt-1 text-[12.5px] text-published">저장했습니다. 이제 기자마다 전용 주소가 만들어집니다.</p>}
        </li>
        <li>
          같은 Settings 화면의 <strong>Webhook</strong> 칸에 아래 주소를 붙여넣고 <strong>Save</strong>를 누릅니다.
          {webhook ? (
            <div className="mt-2 flex items-center gap-2 rounded border border-line bg-white py-1.5 pl-3 pr-1.5">
              <code className="min-w-0 flex-1 truncate text-[12.5px]">{webhook}</code>
              <button type="button" onClick={() => navigator.clipboard.writeText(webhook)} className="rounded bg-ink px-3 py-1.5 text-[12.5px] font-semibold text-white">복사</button>
            </div>
          ) : (
            <p className="mt-1 text-danger">비밀 열쇠를 읽지 못했습니다. press-email.sql 실행 여부를 확인하세요.</p>
          )}
          <p className="mt-1 text-[12.5px] text-muted">이 주소에는 비밀 열쇠가 들어 있습니다. 다른 곳에 공유하지 마세요.</p>
        </li>
        <li>기자들에게 “보도자료함 → 메일로 받기”에서 안내대로 설정하라고 알려 주세요.</li>
      </ol>
      <p className="mt-4 text-[12.5px] leading-relaxed text-muted">
        Postmark는 가입 후 무료로 시험해 볼 수 있고, 받는 메일이 많아지면 유료 요금제가 필요합니다(요금은 Postmark 요금표 확인).
        나중에 제품 도메인을 사면 수신 주소만 우리 도메인 주소로 바꾸면 됩니다.
      </p>
    </section>
  )
}
