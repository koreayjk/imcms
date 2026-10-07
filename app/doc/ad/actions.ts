'use server'

import { revalidatePath } from 'next/cache'
import { getCmsContext } from '@/lib/cms'
import { buildAdDoc, nextDocNo, type AdDocKind } from '@/lib/ad-doc'

// 견적서·게재 확인서 저장: 번호를 매기고 지금 내용 그대로 보관한다 (서버에서 다시 만들어 저장 — 화면 값은 믿지 않는다)
export async function saveAdDocument(contractId: string, kind: AdDocKind): Promise<{ error?: string; id?: string; no?: string }> {
  const { supabase, isEditorPlus } = await getCmsContext()
  if (!isEditorPlus) return { error: '편집장·발행인만 문서를 저장할 수 있습니다.' }
  if (kind !== 'quote' && kind !== 'report') return { error: '문서 종류를 확인해 주세요.' }
  const data = await buildAdDoc(supabase, contractId, kind)
  if (!data) return { error: '계약을 찾지 못했습니다.' }
  const { data: c } = await supabase.from('ad_contracts').select('outlet_id').eq('id', contractId).maybeSingle()
  const outletId = (c as { outlet_id?: string } | null)?.outlet_id
  if (!outletId) return { error: '계약을 찾지 못했습니다.' }
  // 같은 번호가 동시에 나오면 한 번 더 매긴다
  for (let attempt = 0; attempt < 3; attempt++) {
    const no = await nextDocNo(supabase, outletId, kind)
    const { data: row, error } = await supabase.from('ad_documents')
      .insert({ outlet_id: outletId, contract_id: contractId, kind, doc_no: no, data: { ...data, no } })
      .select('id').single()
    if (!error) {
      revalidatePath('/admin/ads/contracts')
      return { id: (row as { id: string }).id, no }
    }
    if (/ad_documents/.test(error.message) && /does not exist|schema cache|find the table/i.test(error.message)) return { error: '문서를 저장하려면 Supabase에서 최신 supabase/ad-contracts.sql을 실행해 주세요.' }
    if (!/duplicate|unique/i.test(error.message)) return { error: `저장하지 못했습니다: ${error.message}` }
  }
  return { error: '문서 번호를 매기지 못했습니다. 다시 눌러 주세요.' }
}
