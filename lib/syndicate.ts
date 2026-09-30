import { createClient } from './supabase'

export type SyndicateResult = { created: string[]; updated: string[]; warnings: string[] }

// 발행된 원본을 syndicate_to 매체들에 사본으로 올리거나, 이미 있는 사본을 원본 내용으로 갱신한다
export async function syndicate(articleId: string): Promise<SyndicateResult> {
  const supabase = createClient()
  const result: SyndicateResult = { created: [], updated: [], warnings: [] }

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

  for (const outlet of outlets ?? []) {
    const outletCats = (cats ?? []).filter((c) => c.outlet_id === outlet.id)
    const cat = srcCategory
      ? outletCats.find((c) => c.slug === srcCategory.slug) ?? outletCats.find((c) => c.name === srcCategory.name)
      : undefined
    if (srcCategory && !cat) result.warnings.push(`${outlet.name}: '${srcCategory.name}' 섹션이 없어 섹션 없이 올렸습니다.`)

    const body = srcOutletName ? (src.body as string).replace(`[${srcOutletName}=`, `[${outlet.name}=`) : src.body
    const content: Record<string, unknown> = {
      title: src.title,
      body,
      excerpt: src.excerpt,
      thumbnail_url: src.thumbnail_url,
      tags: src.tags,
      meta_title: src.meta_title,
      meta_description: src.meta_description,
    }
    if ('byline' in src) content.byline = src.byline

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
  if (r.updated.length) lines.push(`사본 갱신: ${r.updated.join(', ')}`)
  lines.push(...r.warnings)
  return lines.join('\n')
}
