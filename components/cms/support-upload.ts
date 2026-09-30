import { createClient } from '@/lib/supabase'

const MAX = 20 * 1024 * 1024

// 업무요청 첨부: 비공개 저장소 support/요청ID/ 에 올리고 목록에 기록한다
export async function uploadSupportFiles(ticketId: string, replyId: string | null, files: File[]) {
  const supabase = createClient()
  const failed: string[] = []
  for (const f of files) {
    if (f.size > MAX) { failed.push(`${f.name} (20MB 초과)`); continue }
    const safe = f.name.replace(/[^\w.\-가-힣]+/g, '_').slice(-80)
    const path = `${ticketId}/${crypto.randomUUID()}-${safe}`
    const { error } = await supabase.storage.from('support').upload(path, f, { contentType: f.type || 'application/octet-stream' })
    if (error) { failed.push(f.name); continue }
    const { error: rowErr } = await supabase.from('support_files').insert({ ticket_id: ticketId, reply_id: replyId, path, name: f.name.slice(0, 200), size: f.size })
    if (rowErr) failed.push(f.name)
  }
  return failed
}
