import { createServerSupabaseClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import UserManager from '@/components/UserManager'

export default async function UsersPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') redirect('/articles')

  const [{ data: users }, { data: outlets }] = await Promise.all([
    supabase.from('profiles').select('*').order('created_at'),
    supabase.from('outlets').select('id, name').order('created_at'),
  ])

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <header className="mb-6">
        <h1 className="text-lg font-semibold">회원 관리</h1>
        <p className="text-sm text-muted mt-0.5">기자·편집장·관리자 역할과 소속 매체를 설정합니다</p>
      </header>
      <UserManager
        users={users ?? []}
        outlets={outlets ?? []}
        currentUserId={user.id}
      />
    </div>
  )
}
