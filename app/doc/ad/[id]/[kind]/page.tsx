import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { getCmsContext } from '@/lib/cms'
import { buildAdDoc } from '@/lib/ad-doc'
import AdDocument from '@/components/cms/AdDocument'
import AdDocToolbar from '@/components/cms/AdDocToolbar'
import { formatDateTime } from '@/lib/format'

// 광고 문서 만들기 (지금 계약 내용으로): 견적서 / 광고 게재 확인서. 그 매체 편집장·발행인만 (DB 권한으로 확인)
//   '저장'하면 번호를 매겨 보관하고(/doc/saved/…), 저장 전에도 인쇄·PDF로 받을 수 있다
export const metadata: Metadata = { title: '광고 문서', robots: { index: false } }

export default async function AdDocPage(props: { params: Promise<{ id: string; kind: string }> }) {
  const { id, kind } = await props.params
  if (kind !== 'quote' && kind !== 'report') notFound()
  const { supabase, isEditorPlus } = await getCmsContext()
  if (!isEditorPlus) redirect('/newsroom')
  const data = await buildAdDoc(supabase, id, kind)
  if (!data) notFound()
  data.no = '저장 전 (저장하면 번호가 매겨집니다)'
  const { data: saved } = await supabase.from('ad_documents').select('id, doc_no, issued_at').eq('contract_id', id).eq('kind', kind).order('issued_at', { ascending: false }).limit(5)
  const name = kind === 'quote' ? '견적서' : '게재 확인서'

  return (
    <div className="min-h-screen bg-[#E5E7EB] py-6 print:bg-white print:py-0">
      <style>{'@page { size: A4; margin: 14mm } @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact } }'}</style>
      <div className="mx-auto mb-4 flex max-w-[210mm] flex-wrap items-start justify-between gap-3 px-2 print:hidden">
        <div className="text-[13px] leading-relaxed text-[#4B5563]">
          <p>버튼을 누르면 문서번호를 매겨 <strong className="text-[#111]">자동으로 저장</strong>한 뒤 이메일 보내기·PDF 다운로드·인쇄로 이어집니다.</p>
          <p className="text-[12px]">저장한 문서는 광고 계약 목록에서 다시 열 수 있고, 내용이 그대로면 다시 눌러도 번호가 새로 생기지 않습니다.</p>
          {(saved ?? []).length > 0 && (
            <p className="mt-1">이미 저장한 {name}: {(saved as { id: string; doc_no: string; issued_at: string }[]).map((x, i) => (
              <span key={x.id}>{i > 0 && ', '}<Link href={`/doc/saved/${x.id}`} className="font-semibold text-review underline underline-offset-2">{x.doc_no}</Link> ({formatDateTime(x.issued_at)})</span>
            ))}</p>
          )}
        </div>
        <AdDocToolbar mode="live" contractId={id} kind={kind} />
      </div>
      <AdDocument d={data} />
    </div>
  )
}
