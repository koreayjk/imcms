'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useT } from '@/components/cms/CmsLang'

const KEY = 'im_ad_howto_closed'

// 광고 화면 위 안내: 기본 배너(배너 탭)와 계약 광고(광고 계약 탭)가 어떻게 번갈아 나가는지
export default function AdHowItWorks({ current }: { current: 'banners' | 'contracts' | 'inquiries' }) {
  const t = useT()
  const [open, setOpen] = useState(true)
  useEffect(() => {
    try { if (localStorage.getItem(KEY) === '1') setOpen(false) } catch { /* 없음 */ }
  }, [])
  const toggle = (v: boolean) => {
    setOpen(v)
    try { localStorage.setItem(KEY, v ? '0' : '1') } catch { /* 없음 */ }
  }

  if (!open) {
    return (
      <button type="button" onClick={() => toggle(true)} className="mb-4 text-[12.5px] font-semibold text-review underline underline-offset-2">
        {t('ⓘ 기본 배너와 계약 광고는 어떻게 나가나요?', 'ⓘ How do regular banners and contract ads run?')}
      </button>
    )
  }

  return (
    <section className="mb-5 rounded-lg border border-review/30 bg-review/5 p-4 md:p-5" aria-label={t('광고가 나가는 방식', 'How ads run')}>
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-[14.5px] font-bold">{t('광고는 이렇게 나갑니다', 'How ads run')}</h2>
        <button type="button" onClick={() => toggle(false)} className="shrink-0 text-[12px] text-muted hover:text-ink">{t('접기 ✕', 'Collapse ✕')}</button>
      </div>

      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <div className={`rounded-md border bg-white p-3.5 ${current === 'banners' ? 'border-ink' : 'border-line'}`}>
          <p className="text-[13.5px] font-bold">{t('① 기본 배너', '① Regular banners')} <span className="font-normal text-muted">· {t('배너 탭에서 올림', 'uploaded in the Banners tab')}</span></p>
          <ul className="mt-1.5 list-disc space-y-0.5 pl-4 text-[13px] leading-relaxed text-[#3B4048]">
            <li>{t('기간을', 'If you leave the dates')} <strong>{t('비워 두면 계속', 'blank, it runs continuously')}</strong> {t('나갑니다 (고정)', '(fixed)')}</li>
            <li>{t('기간을 정하면 그 기간에만 나갑니다', 'If you set dates, it runs only during that period')}</li>
            <li>{t('우리 매체 홍보·행사 안내, 상시 광고주 배너에 씁니다', 'Use it for promoting your own outlet, event notices and always-on advertiser banners')}</li>
          </ul>
          {current !== 'banners' && <Link href="/admin/ads" className="mt-2 inline-block text-[12.5px] font-semibold text-review hover:underline">{t('배너 탭으로 →', 'Go to Banners →')}</Link>}
        </div>
        <div className={`rounded-md border bg-white p-3.5 ${current === 'contracts' ? 'border-ink' : 'border-line'}`}>
          <p className="text-[13.5px] font-bold">{t('② 계약 광고', '② Contract ads')} <span className="font-normal text-muted">· {t('광고 계약 탭에서 예약', 'booked in the Contracts tab')}</span></p>
          <ul className="mt-1.5 list-disc space-y-0.5 pl-4 text-[13px] leading-relaxed text-[#3B4048]">
            <li><strong>{t('계약 기간에만', 'Only during the contract period')}</strong> {t('나갑니다 (시작일 0시 ~ 끝나는 날 밤)', '(from midnight on the start date through the end of the last day)')}</li>
            <li>{t('그동안 같은 자리의', 'In the meantime it')} <strong>{t('기본 배너를 대신', 'replaces the regular banner')}</strong>{t('합니다', ' in the same placement')}</li>
            <li>{t('달력에서 빈 날만 고를 수 있어 예약이 겹치지 않습니다', 'You can only pick open days on the calendar, so bookings never overlap')}</li>
          </ul>
          {current !== 'contracts' && <Link href="/admin/ads/contracts" className="mt-2 inline-block text-[12.5px] font-semibold text-review hover:underline">{t('광고 계약 탭으로 →', 'Go to Contracts →')}</Link>}
        </div>
      </div>

      {/* 한 자리의 한 달을 예로 */}
      <div className="mt-3 rounded-md border border-line bg-white p-3.5">
        <p className="text-[12.5px] font-semibold text-muted">{t('예) 상단 띠 자리의 한 달', 'Example: one month in the Top strip placement')}</p>
        <div className="mt-2 flex h-8 overflow-hidden rounded text-[12px] font-semibold">
          <span className="flex basis-[30%] items-center justify-center whitespace-nowrap bg-line/80 text-ink">{t('기본 배너', 'Regular banner')}</span>
          <span className="flex basis-[40%] items-center justify-center whitespace-nowrap bg-ink text-white">{t('계약 광고', 'Contract ad')}<span className="hidden sm:inline">&nbsp;{t('(10일~21일)', '(10th–21st)')}</span></span>
          <span className="flex basis-[30%] items-center justify-center whitespace-nowrap bg-line/80 text-ink">{t('기본 배너', 'Regular banner')}</span>
        </div>
        <ul className="mt-2.5 space-y-0.5 text-[12.5px] leading-relaxed text-[#3B4048]">
          <li>· <strong>{t('상단 띠·홈 중간·기사 아래·팝업', 'Top strip, Home middle, Below story, Popup')}</strong>{t(': 계약 광고가 있으면 그것만, 끝나면 기본 배너가 다시 나옵니다. 기본 배너가 여러 개면 방문할 때마다 번갈아 나옵니다.', ': if there is a contract ad, only that one runs; when it ends, the regular banner comes back. If there are several regular banners, they take turns with each visit.')}</li>
          <li>· <strong>{t('오른쪽', 'Right rail')}</strong>{t('(3칸): 계약 광고가 먼저 자리를 잡고, 남는 칸은 기본 배너로 채웁니다.', ' (3 slots): contract ads take their places first, and the remaining slots are filled with regular banners.')}</li>
          <li>· {t('바뀌는 시각은 시작일 0시이고, 늦어도 5분 안에 홈페이지에 반영됩니다.', 'The switch happens at midnight on the start date and shows on the homepage within 5 minutes at the latest.')}</li>
        </ul>
      </div>
    </section>
  )
}
