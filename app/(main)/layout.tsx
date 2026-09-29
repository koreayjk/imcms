import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import Rail from '@/components/cms/Rail'
import TopBar from '@/components/cms/TopBar'
import { isApproved } from '@/lib/cms'

export default async function MainLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()
  if (!isApproved(profile)) redirect('/pending')

  const { count: pendingCount } = profile?.role === 'admin'
    ? await supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('approved', false)
    : { count: 0 }

  const { data: outlet } = profile?.outlet_id
    ? await supabase.from('outlets').select('name').eq('id', profile.outlet_id).single()
    : { data: null }

  return (
    <div className="flex h-screen overflow-hidden bg-[#F4F5F7]">
      <Rail role={profile?.role ?? null} pendingCount={pendingCount ?? 0} />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar outletName={outlet?.name ?? null} userName={profile?.full_name ?? user.email ?? ''} role={profile?.role ?? null} />
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  )
}
