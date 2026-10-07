import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { getCmsContext } from '@/lib/cms'
import type { AdDocData } from '@/lib/ad-doc'
import AdDocument from '@/components/cms/AdDocument'
import PrintButton from '@/components/cms/PrintButton'
import { formatDateTime } from '@/lib/format'

// 저장한 광고 문서 다시 보기: 저장한 순간의 내용 그대로 (그 매체 편집장·발행인만)
export const metadata: Metadata = { title: '저장한 광고 문서', robots: { index: false } }

export default async function SavedAdDocPage(props: { params: Promise<{ docId: string }>; searchParams: Promise<{ new?: string }> }) {
  const { docId } = await props.params
  const sp = await props.searchParams
  if (!/^[0-9a-f-]{36}$/.test(docId)) notFound()
  const { supabase, isEditorPlus } = await getCmsContext()
  if (!isEditorPlus) redirect('/newsroom')
  const read = (cols: string) => supabase.from('ad_documents').select(cols).eq('id', docId).maybeSingle()
  let { data: doc, error } = await read('id, contract_id, kind, doc_no, data, issued_at, issuer:profiles!ad_documents_issued_by_fkey(full_name)')
  // 발급자 이름을 못 읽어도 문서는 보여준다
  if (error) ({ data: doc } = await read('id, contract_id, kind, doc_no, data, issued_at'))
  if (!doc) notFound()
  const d = doc as unknown as { contract_id: string; kind: 'quote' | 'report'; doc_no: string; data: AdDocData; issued_at: string; issuer?: { full_name?: string } | null }
  const name = d.kind === 'quote' ? '견적서' : '게재 확인서'

  return (
    <div className="min-h-screen bg-[#E5E7EB] py-6 print:bg-white print:py-0">
      <style>{'@page { size: A4; margin: 14mm } @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact } }'}</style>
      <div className="mx-auto mb-4 flex max-w-[210mm] flex-wrap items-start justify-between gap-3 px-2 print:hidden">
        <div className="text-[13px] leading-relaxed text-[#4B5563]">
          {sp.new && <p className="mb-1 font-semibold text-published">✓ {name}를 {d.doc_no}로 저장했습니다.</p>}
          <p>저장한 {name} <strong className="text-[#111]">{d.doc_no}</strong> · {formatDateTime(d.issued_at)}{d.issuer?.full_name ? ` · ${d.issuer.full_name}` : ''}</p>
          <p className="text-[12px]">저장한 순간의 내용 그대로입니다. 계약을 고친 뒤 새로 발급하려면 <Link href={`/doc/ad/${d.contract_id}/${d.kind}`} className="font-semibold text-review underline underline-offset-2">지금 내용으로 새로 만들기</Link> · <Link href="/admin/ads/contracts" className="underline underline-offset-2">광고 계약으로</Link></p>
        </div>
        <PrintButton />
      </div>
      <AdDocument d={{ ...d.data, no: d.doc_no }} />
    </div>
  )
}
