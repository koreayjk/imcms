'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { reconnectDomain } from '@/app/(main)/admin/outlets/[id]/site/actions'
import type { DomainStatus } from '@/lib/vercel-domains'

// 홈페이지 설정: 도메인 연결 상태 + 고객에게 알려줄 DNS 설정값
export default function DomainPanel({ outletId, domain, status }: { outletId: string; domain: string | null; status: DomainStatus }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [msg, setMsg] = useState<{ error?: string; ok?: string }>({})
  const reconnect = () => start(async () => { setMsg(await reconnectDomain(outletId)); router.refresh() })

  const records = status.state === 'dns' || status.state === 'verify' ? status.records : []
  const badge =
    !domain ? ['도메인 없음', 'bg-paper text-muted']
    : status.state === 'ok' ? ['연결됨', 'bg-[#1E7D4D]/12 text-[#1E5E3D]']
    : status.state === 'dns' ? ['DNS 설정 필요', 'bg-[#F2B544]/25 text-[#6B4A00]']
    : status.state === 'verify' ? ['소유 확인 필요', 'bg-[#F2B544]/25 text-[#6B4A00]']
    : status.state === 'missing' ? ['Vercel 미등록', 'bg-danger/10 text-danger']
    : status.state === 'off' ? ['자동 연결 꺼짐', 'bg-paper text-muted']
    : ['확인 실패', 'bg-danger/10 text-danger']

  return (
    <section className="mb-6 rounded-lg border border-line bg-white p-5" aria-label="도메인 연결">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-[15px] font-bold">도메인 연결</h2>
        <span className={`rounded px-2 py-0.5 text-[11.5px] font-semibold ${badge[1]}`}>{badge[0]}</span>
        {domain && <a href={`https://${domain}`} target="_blank" rel="noopener" className="text-[13px] text-muted underline underline-offset-2">{domain} ↗</a>}
        {domain && status.state !== 'off' && (
          <span className="ml-auto flex gap-1.5">
            {status.state === 'missing' && <button type="button" disabled={pending} onClick={reconnect} className="btn-primary px-3 py-1.5">Vercel에 등록</button>}
            <button type="button" disabled={pending} onClick={() => router.refresh()} className="btn-secondary px-3 py-1.5">다시 확인</button>
          </span>
        )}
      </div>
      {msg.error && <p role="alert" className="mt-2 text-[13px] text-danger">{msg.error}</p>}
      {msg.ok && <p role="status" className="mt-2 text-[13px] text-[#1E5E3D]">{msg.ok}</p>}

      {!domain && <p className="mt-2 text-[13px] text-muted">아래 ‘도메인’ 칸에 주소를 넣고 저장하면 연결 상태가 여기에 나옵니다.</p>}
      {domain && status.state === 'off' && (
        <p className="mt-2 text-[13px] leading-[1.7] text-muted">
          Vercel 환경 변수 <code>VERCEL_API_TOKEN</code>·<code>VERCEL_PROJECT_ID</code>를 넣으면 도메인을 저장할 때 Vercel에 자동으로 등록되고, 여기에서 연결 상태를 볼 수 있습니다. 지금은 Vercel → Settings → Domains 에서 직접 추가해 주세요.
        </p>
      )}
      {status.state === 'error' && <p className="mt-2 text-[13px] text-danger">{status.message}</p>}
      {status.state === 'ok' && <p className="mt-2 text-[13px] text-muted">도메인이 이 홈페이지에 연결돼 있습니다. 보안 인증서(https)도 Vercel이 자동으로 발급합니다.</p>}
      {records.length > 0 && (
        <div className="mt-3">
          <p className="text-[13px] leading-[1.7] text-muted">
            {status.state === 'verify' ? '다른 곳에서 쓰던 도메인이라 소유 확인이 필요합니다. ' : ''}
            도메인을 산 곳(가비아·후이즈·카페24 등)의 DNS 관리 화면에 아래 값을 넣어 달라고 고객에게 알려 주세요. 반영까지 보통 몇 분~몇 시간 걸립니다.
          </p>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full min-w-[420px] border-collapse text-[13px]">
              <thead><tr className="bg-paper text-left"><th className="px-3 py-2">종류</th><th className="px-3 py-2">호스트</th><th className="px-3 py-2">값</th></tr></thead>
              <tbody>
                {records.map((r, i) => (
                  <tr key={i} className="border-t border-line">
                    <td className="px-3 py-2 font-semibold">{r.type}</td>
                    <td className="px-3 py-2 font-mono">{r.host}</td>
                    <td className="px-3 py-2 font-mono break-all">{r.value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  )
}
