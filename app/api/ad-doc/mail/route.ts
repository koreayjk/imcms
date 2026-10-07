import { NextResponse, type NextRequest } from 'next/server'
import { getCmsContext } from '@/lib/cms'
import { sendMailWithAttachments } from '@/lib/mail'
import type { AdDocData } from '@/lib/ad-doc'
import { defaultSubject, docName, signatureHtml, signatureText } from '@/lib/ad-mail'
import { cmsOrigin } from '@/lib/origin'

// 저장한 광고 문서(견적서·게재 확인서)를 PDF로 첨부해 광고주에게 보낸다 (그 매체 편집장·발행인)
//   PDF는 편집국 화면에서 만들어 올린다. 보낸 사람 이름은 매체 이름, 회신은 보낸 편집국 사람 메일로 간다
export const dynamic = 'force-dynamic'
export const maxDuration = 30

const EMAIL = /^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

export async function POST(req: NextRequest) {
  const { supabase, user, isEditorPlus } = await getCmsContext()
  if (!isEditorPlus) return NextResponse.json({ error: '편집장·발행인만 보낼 수 있습니다.' }, { status: 403 })
  const body = (await req.json().catch(() => null)) as { docId?: string; to?: string[]; subject?: string; message?: string; ccMe?: boolean; pdf?: string } | null
  if (!body?.docId || !/^[0-9a-f-]{36}$/.test(body.docId)) return NextResponse.json({ error: '문서를 찾지 못했습니다.' }, { status: 400 })
  const to = Array.from(new Set((body.to ?? []).map((x) => x.trim().toLowerCase()).filter(Boolean))).slice(0, 5)
  if (!to.length) return NextResponse.json({ error: '받는 사람 이메일을 적어 주세요.' }, { status: 400 })
  const bad = to.find((x) => !EMAIL.test(x))
  if (bad) return NextResponse.json({ error: `이메일 주소를 확인해 주세요: ${bad}` }, { status: 400 })
  const pdf = (body.pdf ?? '').replace(/^data:[^,]+,/, '')
  if (!pdf || pdf.length > 6_000_000 || !/^[A-Za-z0-9+/=]+$/.test(pdf.slice(0, 2000))) return NextResponse.json({ error: 'PDF 파일을 만들지 못했습니다. 다시 눌러 주세요.' }, { status: 400 })

  // DB 권한으로 우리 매체 문서인지 확인된다
  const { data: doc } = await supabase.from('ad_documents').select('id, kind, doc_no, data').eq('id', body.docId).maybeSingle()
  if (!doc) return NextResponse.json({ error: '문서를 찾지 못했습니다.' }, { status: 404 })
  const d = doc.data as AdDocData
  const name = docName(doc.kind)
  const subject = (body.subject ?? '').trim().slice(0, 150) || defaultSubject(d, doc.doc_no)
  const message = (body.message ?? '').trim().slice(0, 3000)
  const filename = `${d.outlet.name}_${name}_${doc.doc_no}.pdf`.replace(/[\\/:*?"<>|\s]+/g, '_')
  // 매체 로고는 전체 주소로 (메일 프로그램은 상대 주소 그림을 못 띄운다)
  // SVG 로고는 지메일 등에서 안 보이므로 넣지 않는다 (이름 글자만)
  const logo = d.outlet.logo && !/\.svg(\?|$)/i.test(d.outlet.logo) ? (/^https?:\/\//.test(d.outlet.logo) ? d.outlet.logo : `${await cmsOrigin()}${d.outlet.logo.startsWith('/') ? '' : '/'}${d.outlet.logo}`) : null
  const html = `<div style="font-family:-apple-system,'Apple SD Gothic Neo','Malgun Gothic',sans-serif;font-size:14px;line-height:1.75;color:#111">${esc(message).replace(/\n/g, '<br>')}`
    + `<p style="margin:18px 0 0;color:#888;font-size:12px">📎 첨부: ${esc(filename)}</p>`
    + `${signatureHtml(d, logo)}</div>`
  const r = await sendMailWithAttachments({
    to, cc: body.ccMe && user.email ? [user.email] : undefined,
    subject, html, text: `${message}\n\n첨부: ${filename}\n\n${signatureText(d)}`,
    fromName: d.outlet.name, replyTo: user.email ?? d.supplier.email ?? null, tag: 'ad-document',
    attachments: [{ filename, content: pdf, contentType: 'application/pdf' }],
  })
  if (!r.ok) return NextResponse.json({ error: `보내지 못했습니다: ${r.error}` }, { status: 502 })
  await supabase.from('ad_documents').update({ sent_to: to.join(', ').slice(0, 400), sent_at: new Date().toISOString() }).eq('id', doc.id)
  return NextResponse.json({ ok: true })
}
