import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { byteaToBytes } from '@/lib/press-attachments'

// 메일로 받은 보도자료의 첨부파일(한글·PDF 등) 내려받기 — 로그인한 편집국 계정만
export async function GET(_req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { data } = await supabase.from('press_attachments').select('name, content_type, data, copied_url').eq('id', params.id).maybeSingle()
  if (!data) return NextResponse.json({ error: 'not found' }, { status: 404 })
  if (data.copied_url && !data.data) return NextResponse.redirect(data.copied_url)

  const bytes = byteaToBytes(data.data)
  return new Response(new Blob([bytes as BlobPart]), {
    headers: {
      'Content-Type': data.content_type || 'application/octet-stream',
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(data.name)}`,
      'Cache-Control': 'private, no-store',
    },
  })
}
