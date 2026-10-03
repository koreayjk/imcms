import { createClient } from './supabase'
import { rewriteForOutlet } from '@/app/(main)/articles/rewrite'

export type SyndicateResult = { created: string[]; updated: string[]; warnings: string[]; rewritten?: string[] }

// 발행된 원본을 syndicate_to 매체들에 사본으로 올리거나, 이미 있는 사본을 원본 내용으로 갱신한다
//   rewrite: 사본의 제목·부제·본문 글을 매체마다 AI로 다시 써서 올린다 (같은 글이 그대로 겹치지 않게). 실패하면 원문 그대로
export async function syndicate(articleId: string, { rewrite = true }: { rewrite?: boolean } = {}): Promise<SyndicateResult> {
  const supabase = createClient()
  const result: SyndicateResult = { created: [], updated: [], warnings: [], rewritten: [] }

  const { data: src, error } = await supabase
    .from('articles')
    .select('*, category:categories(slug, name), outlet:outlets(name)')
    .eq('id', articleId)
    .single()
  if (error || !src) throw new Error('원본 기사를 불러오지 못했습니다.')
  if (src.source_article_id || src.status !== 'published') return result

  const targets = ((src.syndicate_to ?? []) as string[]).filter((id) => id !== src.outlet_id)
  if (!targets.length) return result

  const [{ data: outlets }, { data: cats }, { data: copies }] = await Promise.all([
    supabase.from('outlets').select('id, name').in('id', targets),
    supabase.from('categories').select('id, outlet_id, slug, name').in('outlet_id', targets),
    supabase.from('articles').select('id, outlet_id').eq('source_article_id', src.id),
  ])

  const srcCategory = src.category as unknown as { slug: string; name: string } | null
  const srcOutletName = (src.outlet as unknown as { name: string } | null)?.name

  // 매체마다 AI 변환은 동시에 (매체 수만큼 기다리지 않게)
  const rewrites = new Map<string, Awaited<ReturnType<typeof rewriteForOutlet>>>()
  if (rewrite) {
    await Promise.all((outlets ?? []).map(async (o) => {
      try {
        rewrites.set(o.id, await rewriteForOutlet({ sourceOutletId: src.outlet_id, sourceOutletName: srcOutletName ?? null, outletName: o.name, title: src.title, excerpt: src.excerpt, body: src.body }))
      } catch {
        rewrites.set(o.id, { ok: false, error: 'AI로 바꾸지 못했습니다' })
      }
    }))
  }

  for (const outlet of outlets ?? []) {
    const outletCats = (cats ?? []).filter((c) => c.outlet_id === outlet.id)
    const cat = srcCategory
      ? outletCats.find((c) => c.slug === srcCategory.slug) ?? outletCats.find((c) => c.name === srcCategory.name)
      : undefined
    if (srcCategory && !cat) result.warnings.push(`${outlet.name}: '${srcCategory.name}' 섹션이 없어 섹션 없이 올렸습니다.`)

    const rw = rewrites.get(outlet.id)
    if (rw && !rw.ok) result.warnings.push(`${outlet.name}: AI로 문장을 바꾸지 못해 원문 그대로 올렸습니다 (${rw.error})`)
    const body = rw?.ok ? rw.body : srcOutletName ? (src.body as string).replace(`[${srcOutletName}=`, `[${outlet.name}=`) : src.body
    const content: Record<string, unknown> = {
      title: rw?.ok ? rw.title : src.title,
      body,
      excerpt: rw?.ok ? rw.excerpt : src.excerpt,
      thumbnail_url: src.thumbnail_url,
      tags: src.tags,
      meta_title: src.meta_title,
      meta_description: src.meta_description,
    }
    if ('byline' in src) content.byline = src.byline
    // 원본 발행 일시(예약 포함)를 사본도 따라간다
    if (src.published_at) content.published_at = src.published_at

    if (rw?.ok) result.rewritten!.push(outlet.name)
    const existing = (copies ?? []).find((c) => c.outlet_id === outlet.id)
    if (existing) {
      const { error: e } = await supabase.from('articles').update(content).eq('id', existing.id)
      if (e) result.warnings.push(`${outlet.name}: 갱신 실패 (${e.message})`)
      else result.updated.push(outlet.name)
    } else {
      const { error: e } = await supabase.from('articles').insert({
        ...content,
        category_id: cat?.id ?? null,
        outlet_id: outlet.id,
        author_id: src.author_id,
        source_article_id: src.id,
        status: 'published',
        published_at: src.published_at ?? new Date().toISOString(),
      })
      if (e) result.warnings.push(`${outlet.name}: 송고 실패 (${e.message})`)
      else result.created.push(outlet.name)
    }
  }
  return result
}

export function describe(r: SyndicateResult) {
  const lines: string[] = []
  if (r.created.length) lines.push(`함께 송고: ${r.created.join(', ')}`)
  if (r.rewritten?.length) lines.push(`AI로 문장을 바꿔 올림: ${r.rewritten.join(', ')}`)
  if (r.updated.length) lines.push(`사본 갱신: ${r.updated.join(', ')}`)
  lines.push(...r.warnings)
  return lines.join('\n')
}
