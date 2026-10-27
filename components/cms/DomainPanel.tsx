'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useT } from '@/components/cms/CmsLang'
import { reconnectDomain } from '@/app/(main)/admin/outlets/[id]/site/actions'
import type { DomainStatus } from '@/lib/vercel-domains'

// 홈페이지 설정: 도메인 연결 상태 + 고객에게 알려줄 DNS 설정값
export default function DomainPanel({ outletId, domain, status }: { outletId: string; domain: string | null; status: DomainStatus }) {
  const t = useT()
  const router = useRouter()
  const [pending, start] = useTransition()
  const [msg, setMsg] = useState<{ error?: string; ok?: string }>({})
  const reconnect = () => start(async () => { setMsg(await reconnectDomain(outletId)); router.refresh() })

  const records = status.state === 'dns' || status.state === 'verify' ? status.records : []
  const badge =
    !domain ? [t('도메인 없음', 'No domain'), 'bg-paper text-muted']
    : status.state === 'ok' ? [t('연결됨', 'Connected'), 'bg-[#1E7D4D]/12 text-[#1E5E3D]']
    : status.state === 'dns' ? [t('DNS 설정 필요', 'DNS setup needed'), 'bg-[#F2B544]/25 text-[#6B4A00]']
    : status.state === 'verify' ? [t('소유 확인 필요', 'Ownership verification needed'), 'bg-[#F2B544]/25 text-[#6B4A00]']
    : status.state === 'missing' ? [t('Vercel 미등록', 'Not registered with Vercel'), 'bg-danger/10 text-danger']
    : status.state === 'off' ? [t('자동 연결 꺼짐', 'Auto-connect off'), 'bg-paper text-muted']
    : [t('확인 실패', 'Check failed'), 'bg-danger/10 text-danger']

  return (
    <section className="mb-6 rounded-lg border border-line bg-white p-5" aria-label={t('도메인 연결', 'Domain connection')}>
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-[15px] font-bold">{t('도메인 연결', 'Domain connection')}</h2>
        <span className={`rounded px-2 py-0.5 text-[11.5px] font-semibold ${badge[1]}`}>{badge[0]}</span>
        {domain && <a href={`https://${domain}`} target="_blank" rel="noopener" className="break-all text-[13px] text-muted underline underline-offset-2">{domain} ↗</a>}
        {domain && status.state !== 'off' && (
          <span className="ml-auto flex gap-1.5">
            {status.state === 'missing' && <button type="button" disabled={pending} onClick={reconnect} className="btn-primary px-3 py-1.5">{t('Vercel에 등록', 'Register with Vercel')}</button>}
            <button type="button" disabled={pending} onClick={() => router.refresh()} className="btn-secondary px-3 py-1.5">{t('다시 확인', 'Check again')}</button>
          </span>
        )}
      </div>
      {msg.error && <p role="alert" className="mt-2 text-[13px] text-danger">{msg.error}</p>}
      {msg.ok && <p role="status" className="mt-2 text-[13px] text-[#1E5E3D]">{msg.ok}</p>}

      {!domain && <p className="mt-2 text-[13px] text-muted">{t('아래 ‘도메인’ 칸에 주소를 넣고 저장하면 연결 상태가 여기에 나옵니다.', 'Enter the address in the “Domain” field below and save, and the connection status will appear here.')}</p>}
      {domain && status.state === 'off' && (
        <p className="mt-2 text-[13px] leading-[1.7] text-muted">
          {t('Vercel 환경 변수 ', 'If you set the Vercel environment variables ')}<code>VERCEL_API_TOKEN</code>·<code>VERCEL_PROJECT_ID</code>{t('를 넣으면 도메인을 저장할 때 Vercel에 자동으로 등록되고, 여기에서 연결 상태를 볼 수 있습니다. 지금은 Vercel → Settings → Domains 에서 직접 추가해 주세요.', ', the domain is registered with Vercel automatically when you save it, and the connection status shows up here. For now, add it manually under Vercel → Settings → Domains.')}
        </p>
      )}
      {status.state === 'error' && <p className="mt-2 text-[13px] text-danger">{status.message}</p>}
      {status.state === 'ok' && <p className="mt-2 text-[13px] text-muted">{t('도메인이 이 홈페이지에 연결돼 있습니다. 보안 인증서(https)도 Vercel이 자동으로 발급합니다.', 'The domain is connected to this site. Vercel also issues the security certificate (https) automatically.')}</p>}
      {records.length > 0 && (
        <div className="mt-3">
          <p className="text-[13px] leading-[1.7] text-muted">
            {status.state === 'verify' ? t('다른 곳에서 쓰던 도메인이라 소유 확인이 필요합니다. ', 'This domain was used elsewhere, so ownership verification is required. ') : ''}
            {t('도메인을 산 곳(가비아·후이즈·카페24 등)의 DNS 관리 화면에 아래 값을 넣어 달라고 고객에게 알려 주세요. 반영까지 보통 몇 분~몇 시간 걸립니다.', 'Ask the customer to enter the values below in the DNS management screen of the registrar where they bought the domain (e.g., Gabia, Whois, Cafe24, GoDaddy). Changes usually take a few minutes to a few hours to take effect.')}
          </p>
          <div className="mt-2 overflow-x-auto">
            <table className="table-cards w-full border-collapse text-[13px] md:min-w-[420px]">
              <thead><tr className="bg-paper text-left"><th className="px-3 py-2">{t('종류', 'Type')}</th><th className="px-3 py-2">{t('호스트', 'Host')}</th><th className="px-3 py-2">{t('값', 'Value')}</th></tr></thead>
              <tbody>
                {records.map((r, i) => (
                  <tr key={i} className="border-t border-line">
                    <td data-label={t('종류', 'Type')} className="px-3 py-2 font-semibold">{r.type}</td>
                    <td data-label={t('호스트', 'Host')} className="break-all px-3 py-2 font-mono">{r.host}</td>
                    <td data-label={t('값', 'Value')} className="px-3 py-2 font-mono break-all">{r.value}</td>
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
