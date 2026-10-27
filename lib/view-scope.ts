// 보기 모드(발행인·편집장·기자 화면): 운영팀·발행인 권한으로 읽어 온 자료를 그 역할이 실제로 보는 범위로 다시 거른다
//   DB 권한(RLS)은 진짜 계정 기준이라, 보기 모드일 때만 화면에서 같은 조건을 한 번 더 건다 (보기 모드가 아니면 그대로)
type Ctx = { viewAs: string | null; viewGroupId: string | null; outletId: string | null; isStaff?: boolean }
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Q = any

// 보도자료(press_releases): 공용 자료(그룹 없음) + 보는 매체가 속한 그룹의 메일·직접 등록 자료 (groups.sql 의 press_releases_read)
export function pressScope<T>(query: T, ctx: Ctx): T {
  if (!ctx.viewAs) return query
  const q = query as Q
  return ctx.viewGroupId ? q.or(`publisher_id.is.null,publisher_id.eq.${ctx.viewGroupId}`) : q.is('publisher_id', null)
}

export function pressVisible(row: { publisher_id?: string | null }, ctx: Ctx): boolean {
  if (!ctx.viewAs) return true
  return !row.publisher_id || row.publisher_id === ctx.viewGroupId
}

// 고객센터 업무요청(support_tickets): 발행인·편집장은 보는 매체의 요청, 기자는 그 매체에서 내가 보낸 요청 (support.sql 의 tickets_select)
//   발행인 화면은 그룹의 매체 요청 모두 — groupOutletIds 로 넘긴다
//   운영팀(총관리자·매니저)은 위쪽에서 매체를 고르면 그 매체의 요청만, "전체 매체"면 모든 매체의 요청을 본다
export function ticketScope<T>(query: T, ctx: Ctx, userId: string, groupOutletIds?: string[]): T {
  if (!ctx.viewAs) return ctx.isStaff && ctx.outletId ? (query as Q).eq('outlet_id', ctx.outletId) : query
  const q = query as Q
  if (ctx.viewAs === 'group' && groupOutletIds?.length) return q.in('outlet_id', groupOutletIds)
  if (!ctx.outletId) return q.eq('requester_id', userId).is('outlet_id', null)
  return ctx.viewAs === 'reporter' ? q.eq('requester_id', userId).eq('outlet_id', ctx.outletId) : q.eq('outlet_id', ctx.outletId)
}

export function ticketVisible(row: { requester_id?: string | null; outlet_id?: string | null }, ctx: Ctx, userId: string, groupOutletIds?: string[]): boolean {
  if (!ctx.viewAs) return true
  if (ctx.viewAs === 'group' && groupOutletIds?.length) return !!row.outlet_id && groupOutletIds.includes(row.outlet_id)
  if (ctx.viewAs === 'reporter') return row.requester_id === userId && row.outlet_id === ctx.outletId
  return !!ctx.outletId && row.outlet_id === ctx.outletId
}

// 발행인 화면: 보는 매체가 속한 그룹의 매체 ID 목록
export async function viewGroupOutletIds(supabase: Q, ctx: Ctx): Promise<string[] | undefined> {
  if (ctx.viewAs !== 'group' || !ctx.viewGroupId) return undefined
  const { data } = await supabase.from('outlets').select('id').eq('publisher_id', ctx.viewGroupId)
  return ((data ?? []) as { id: string }[]).map((o) => o.id)
}
