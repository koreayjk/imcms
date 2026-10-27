import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getCmsContext } from '@/lib/cms'
import { getT } from '@/lib/cms-t'
import { formatDate, formatDateTime } from '@/lib/format'
import { ISSUER, PRODUCT } from '@/lib/product'
import { type InvoiceItem } from '@/lib/support'
import { monthLabelL, taxNote, wonL } from '@/lib/support-i18n'
import PendingButton from '@/components/cms/PendingButton'
import PrintButton from '@/components/cms/PrintButton'
import { deleteInvoice, resendInvoiceMail, setInvoicePaid } from '../../actions'
import ConfirmSubmit from '@/components/cms/ConfirmSubmit'
import InvoicePayments, { type PaymentRow } from '@/components/cms/InvoicePayments'
import { payProvider } from '@/lib/pay-provider'
import { payLinkFor } from '@/lib/pay-link'
import { cmsOrigin } from '@/lib/origin'
import CopyPayLink from '@/components/cms/CopyPayLink'
import BillingForm from '@/components/cms/BillingForm'
import BackLink from '@/components/cms/BackLink'

export default async function InvoicePage(
  props: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string; sent?: string }> }
) {
  const searchParams = await props.searchParams
  const params = await props.params
  const { supabase, isSuper, isStaff } = await getCmsContext()
  const { t, lang } = await getT()
  const { data: inv } = await supabase.from('invoices').select('*, outlet:outlets(name)').eq('id', params.id).maybeSingle()
  if (!inv) notFound()
  // payments.sql 실행 전이면 결제 기록·자동결제 표가 없어 비어 있다
  const [{ data: billingRow }, { data: siteRow }, { data: payments }, { data: autopay }] = await Promise.all([
    supabase.from('outlet_billing').select('*').eq('outlet_id', inv.outlet_id).maybeSingle(),
    supabase.from('outlets').select('site').eq('id', inv.outlet_id).maybeSingle(),
    supabase.from('payments').select('*').eq('invoice_id', inv.id).order('created_at', { ascending: false }),
    supabase.from('outlet_autopay').select('card_company, card_number, last_error').eq('outlet_id', inv.outlet_id).eq('active', true).maybeSingle(),
  ])
  // 자료를 지운(해지) 매체의 청구서: 매체 이름·청구 정보는 청구서에 남겨 둔 값으로 보여 준다
  const saved = billingRow ?? ((inv as { bill_to_snapshot?: typeof billingRow }).bill_to_snapshot ?? null)
  // 결제 정보에 아직 적지 않은 칸은 홈페이지 설정의 “하단 표시 정보”(발행소·대표·사업자번호·전화·이메일·주소)로 채운다
  const legal = ((siteRow as { site?: { legal?: Record<string, string | undefined> } } | null)?.site?.legal ?? {}) as Record<string, string | undefined>
  const pick = (a: string | null | undefined, b: string | undefined) => (a && a.trim() ? a : b?.trim() || null)
  const billing = {
    company_name: pick(saved?.company_name, legal.company),
    biz_no: pick(saved?.biz_no, legal.bizNo),
    ceo_name: pick(saved?.ceo_name, legal.ceo || legal.publisher),
    address: pick(saved?.address, [legal.postcode, legal.address].filter(Boolean).join(' ')),
    manager_name: pick(saved?.manager_name, legal.ceo || legal.publisher),
    manager_email: pick(saved?.manager_email, legal.email),
    manager_phone: pick(saved?.manager_phone, legal.phone),
  }
  const outletName = (inv.outlet as { name?: string } | null)?.name ?? (inv as { outlet_name?: string | null }).outlet_name ?? null
  const items = (inv.items ?? []) as InvoiceItem[]
  // 운영팀: 로그인 없이 결제하는 전용 링크 (미납일 때)
  const payUrl = isStaff && inv.status !== 'paid' ? await payLinkFor(supabase, inv.id, await cmsOrigin()) : null
  const row = (k: string, v: string | null | undefined) => (
    <div className="flex gap-3"><dt className="w-24 shrink-0 text-muted sm:w-32">{k}</dt><dd className="min-w-0 break-words">{v || '-'}</dd></div>
  )

  return (
    <div className="mx-auto max-w-[860px] px-4 py-6 md:px-8 md:py-10">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 print:hidden">
        <BackLink href="/support/invoices" className="text-[13px] text-muted hover:text-ink">{t('← 청구서 목록', '← Invoices')}</BackLink>
        <div className="flex flex-wrap gap-2">
          {isSuper && inv.status !== 'paid' && (
            <form action={deleteInvoice.bind(null, inv.id)}>
              <ConfirmSubmit message={t(`${monthLabelL(inv.month, lang)} ${(inv.outlet as { name?: string } | null)?.name ?? ''} 청구서를 지울까요?\n지우면 되돌릴 수 없습니다. (시험 결제 기록도 함께 지워집니다)`, `Delete the ${monthLabelL(inv.month, lang)} invoice for ${(inv.outlet as { name?: string } | null)?.name ?? ''}?\nThis cannot be undone. (Test payment records are deleted too.)`)} className="btn-secondary bg-white text-danger">{t('청구서 지우기', 'Delete invoice')}</ConfirmSubmit>
            </form>
          )}
          {isSuper && (
            <form action={setInvoicePaid.bind(null, inv.id, inv.status !== 'paid')}>
              <PendingButton pending="…" className="btn-secondary bg-white">{inv.status === 'paid' ? t('미납으로 되돌리기', 'Mark as unpaid') : t('납부 완료 처리', 'Mark as paid')}</PendingButton>
            </form>
          )}
          <PrintButton />
        </div>
      </div>

      {searchParams.error && <p role="alert" className="mb-4 rounded-lg bg-danger/10 px-4 py-3 text-[13.5px] text-danger print:hidden">{searchParams.error}</p>}

      <article className="rounded-2xl bg-white p-5 ring-1 sm:p-10 ring-black/5 print:rounded-none print:p-0 print:ring-0">
        <header className="flex flex-wrap items-start justify-between gap-3 border-b-2 border-ink pb-5">
          <div>
            <p className="flex items-center gap-2 text-[14px] font-bold text-[#1D3461]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/brand/icon-192.png" alt="" width={36} height={36} className="rounded-lg" />
              {lang === 'en' ? PRODUCT.nameEn : PRODUCT.name}
            </p>
            <h1 className="mt-1 text-[28px] font-extrabold tracking-tight">{lang === 'en' ? `Invoice for ${monthLabelL(inv.month, lang)}` : `${monthLabelL(inv.month, lang)} 청구서`}</h1>
            <p className="mt-1.5 text-[12.5px] text-muted tabular-nums">
              {inv.invoice_no && <>{t('청구서 번호', 'Invoice no.')} {inv.invoice_no} · </>}{t('발행일', 'Issued')} {formatDate(inv.created_at, lang)}
            </p>
          </div>
          <span className={`whitespace-nowrap rounded px-3 py-1.5 text-[13px] font-bold ${inv.status === 'paid' ? 'bg-published/10 text-published' : 'bg-danger/10 text-danger'}`}>
            {inv.status === 'paid' ? `${t('납부 완료', 'Paid')}${inv.paid_at ? ` · ${formatDateTime(inv.paid_at, lang)}` : ''}` : t('미납', 'Unpaid')}
          </span>
        </header>

        <div className="mt-6 grid gap-6 text-[13.5px] sm:grid-cols-2">
          <section>
            <h2 className="mb-2 text-[13px] font-bold">{t('공급받는 자', 'Bill to')}</h2>
            <dl className="space-y-1">
              {row(t('매체', 'Publication'), outletName)}
              {row(t('상호', 'Company'), billing?.company_name)}
              {row(t('사업자번호', 'Business reg. no.'), billing?.biz_no)}
              {row(t('대표자', 'Representative'), billing?.ceo_name)}
              {row(t('담당자', 'Contact'), [billing?.manager_name, billing?.manager_email].filter(Boolean).join(' · '))}
            </dl>
          </section>
          <section>
            <h2 className="mb-2 text-[13px] font-bold">{t('공급자', 'Supplier')}</h2>
            <dl className="space-y-1">
              {row(t('상호', 'Company'), ISSUER.company ?? (lang === 'en' ? `${PRODUCT.nameEn} (business details to be registered)` : `${PRODUCT.name} (사업자 정보 등록 예정)`))}
              {ISSUER.bizNo && row(lang === 'en' ? 'Business no. (U.S. EIN)' : ISSUER.bizNoLabel, ISSUER.bizNo)}
              {row(t('대표자', 'Representative'), ISSUER.ceo)}
              {row(t('주소', 'Address'), ISSUER.address)}
              {row(t('연락처', 'Contact'), ISSUER.contact)}
            </dl>
          </section>
        </div>

        <div className="overflow-x-auto">
        <table className="table-cards mt-8 w-full text-[14px] md:min-w-[480px]">
          <thead>
            <tr className="border-y border-ink/80 bg-[#F8F9FA] text-left text-[12.5px]">
              <th className="px-3 py-2.5 font-semibold">{t('항목', 'Item')}</th><th className="w-20 px-3 py-2.5 text-right font-semibold">{t('수량', 'Qty')}</th><th className="w-32 px-3 py-2.5 text-right font-semibold">{t('단가', 'Unit price')}</th><th className="w-36 px-3 py-2.5 text-right font-semibold">{t('금액', 'Amount')}</th>
            </tr>
          </thead>
          <tbody className="tabular-nums">
            {items.map((it, i) => (
              <tr key={i} className="border-b border-line">
                <td className="tc-full px-3 py-3 font-medium md:font-normal">{it.name}</td><td data-label={t('수량', 'Qty')} className="px-3 py-3 text-right">{it.qty}</td><td data-label={t('단가', 'Unit price')} className="px-3 py-3 text-right">{wonL(it.unit_price, lang)}</td><td data-label={t('금액', 'Amount')} className="px-3 py-3 text-right font-semibold md:font-normal">{it.qty * it.unit_price === 0 ? t('무료', 'Free') : wonL(it.qty * it.unit_price, lang)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>

        <dl className="ml-auto mt-5 w-full space-y-1.5 sm:w-72 text-[14px] tabular-nums">
          <div className="flex justify-between border-t-2 border-ink pt-2 text-[20px] font-extrabold"><dt>{t('합계', 'Total')}</dt><dd>{wonL(inv.total, lang)}</dd></div>
          <p className="text-right text-[12px] text-muted">{taxNote(lang)}</p>
        </dl>

        {(inv.due_date || inv.memo) && (
          <div className="mt-8 rounded-xl bg-[#F8F9FA] px-5 py-4 text-[13.5px] leading-relaxed">
            {inv.due_date && <p><strong>{t('납부 기한', 'Due date')}</strong> {inv.due_date}</p>}
            {inv.memo && <p className="mt-1 whitespace-pre-line">{inv.memo}</p>}
          </div>
        )}
      </article>

      {isStaff && (
        <details className="mt-5 rounded-xl border border-line bg-white p-4 print:hidden" open={!saved?.company_name && !saved?.manager_email}>
          <summary className="cursor-pointer text-[14px] font-bold">{lang === 'en' ? `${saved?.company_name || saved?.manager_email ? 'Edit' : 'Enter'} bill-to and contact info` : `공급받는 자·담당자 정보 ${saved?.company_name || saved?.manager_email ? '수정' : '입력'}`} <span className="text-[12px] font-normal text-muted">{t('(운영팀에게만 보입니다)', '(visible to the team only)')}</span></summary>
          <p className="mb-3 mt-1 text-[12.5px] leading-relaxed text-muted">{lang === 'en' ? 'Empty fields are pre-filled from the footer information in the site settings (publisher, representative, business registration no., phone, address). Review and save, and it is stored as this publication\'s “Billing info”. It is used in the invoice\'s bill-to block, as the recipient of the invoice email, and as the email on the payment window. The customer can also edit it on their own billing info screen.' : '홈페이지 설정에 적어 둔 하단 표시 정보(발행소·대표·사업자번호·전화·주소)가 비어 있는 칸에 미리 채워져 있습니다. 확인하고 저장하면 이 매체의 “결제 정보”에 저장됩니다. 청구서의 공급받는 자 칸, 청구서 안내 메일 받는 사람, 결제창 이메일에 쓰입니다. 고객이 자기 결제 정보 화면에서 직접 고칠 수도 있습니다.'}</p>
          <BillingForm outletId={inv.outlet_id} billing={billing} />
        </details>
      )}

      {isStaff && inv.status !== 'paid' && (
        <section className="mt-5 rounded-xl border border-line bg-white p-4 print:hidden">
          <h2 className="text-[14px] font-bold">{t('청구서 메일 다시 보내기', 'Resend invoice email')} <span className="text-[12px] font-normal text-muted">{t('(운영팀에게만 보입니다)', '(visible to the team only)')}</span></h2>
          {searchParams.sent && <p role="status" className="mt-2 rounded bg-published/10 px-3 py-2 text-[13px] font-semibold text-published">{t('청구서 메일을 다시 보냈습니다.', 'The invoice email was sent again.')}</p>}
          <p className="mt-1 text-[12.5px] leading-relaxed text-muted">{t('받는 곳', 'Sent to')}: <strong className="text-ink">{saved?.manager_email ?? t('결제 담당자 이메일이 없어 그 그룹의 발행인 계정', 'the group\'s publisher account (no billing contact email)')}</strong>. {t('담당자 이메일을 고친 뒤 이 버튼으로 다시 보내세요. 처음 보낸 메일과는 별개로 한 번 더 나갑니다.', 'After correcting the contact email, resend it with this button. It goes out once more, separately from the first email.')}</p>
          <form action={resendInvoiceMail.bind(null, inv.id)} className="mt-2">
            <PendingButton pending={t('보내는 중…', 'Sending…')} confirm={t('이 청구서 메일을 다시 보낼까요?', 'Resend this invoice email?')} className="rounded-full bg-[#2F6BF0] px-5 py-2 text-[13px] font-bold text-white">{t('청구서 메일 다시 보내기', 'Resend invoice email')}</PendingButton>
          </form>
        </section>
      )}

      {payUrl && (
        <section className="mt-5 rounded-xl border border-line bg-white p-4 print:hidden">
          <h2 className="text-[14px] font-bold">{t('결제 전용 링크', 'Payment-only link')} <span className="text-[12px] font-normal text-muted">{t('(운영팀에게만 보입니다)', '(visible to the team only)')}</span></h2>
          <p className="mt-1 text-[12.5px] leading-relaxed text-muted">{t('로그인 없이 이 청구서를 보고 카드로 결제하는 주소입니다. 청구서 안내 메일에 이미 들어 있고, 카톡·문자로 따로 보낼 때 복사해 쓰세요. 링크를 아는 사람은 누구나 이 청구서를 결제할 수 있으니 고객 담당자에게만 보내세요.', 'A link to view this invoice and pay by card without logging in. It is already in the invoice email; copy it when you send it separately by chat or text. Anyone with the link can pay this invoice, so send it only to the customer\'s contact.')}</p>
          <div className="mt-2"><CopyPayLink url={payUrl} /></div>
        </section>
      )}

      <InvoicePayments
        invoiceId={inv.id}
        unpaid={inv.status !== 'paid'}
        provider={payProvider().provider}
        clientKey={process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY ?? ''}
        testMode={payProvider().testMode}
        autopay={autopay ?? null}
        payments={(payments ?? []) as PaymentRow[]}
        isStaff={isStaff}
        isSuper={isSuper}
      />
    </div>
  )
}
