import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import Sidebar from '@/components/Sidebar'

export default async function MainLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, full_name, role, outlet_id, created_at')
    .eq('id', user.id)
    .single()

  const { data: outlet } = profile?.outlet_id
    ? await supabase.from('outlets').select('name').eq('id', profile.outlet_id).single()
    : { data: null }

  return (
    <div className="flex h-screen overflow-hidden bg-paper">
      <Sidebar profile={profile} outletName={outlet?.name ?? null} />
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  )
}
