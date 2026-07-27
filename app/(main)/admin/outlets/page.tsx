import { createServerSupabaseClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import OutletManager from '@/components/OutletManager'

export default async function OutletsPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') redirect('/articles')

  const { data: outlets } = await supabase
    .from('outlets')
    .select('*')
    .order('created_at')

  return (
    <div className="mx-auto max-w-2xl px-6 py-8">
      <header className="mb-6">
        <h1 className="text-lg font-semibold">매체 관리</h1>
        <p className="text-sm text-muted mt-0.5">운영하는 언론사 매체를 등록·관리합니다</p>
      </header>
      <OutletManager outlets={outlets ?? []} />
    </div>
  )
}
