import Link from 'next/link'
import { headers } from 'next/headers'
import { getCmsContext } from '@/lib/cms'
import PressEmailSetup from '@/components/cms/PressEmailSetup'
import MailServiceSettings from '@/components/cms/MailServiceSettings'
import { getMyInbox } from './actions'

export default async function PressEmailPage() {
  const { supabase, isSuper } = await getCmsContext()
  const { inbox, error } = await getMyInbox()

  const isAdmin = isSuper
  const { data: admin } = isAdmin ? await supabase.rpc('admin_press_mail_settings') : { data: null }
  const settings = (Array.isArray(admin) ? admin[0] : admin) as { secret: string | null; address: string | null } | null
  const host = (await headers()).get('host') ?? 'imcms.vercel.app'
  const webhook = settings?.secret ? `https://${host}/api/inbound/email?key=${settings.secret}` : null

  return (
    <div className="mx-auto max-w-[900px] px-4 py-5 md:px-8 md:py-8 pb-20 md:pb-20">
      <nav className="mb-5 flex items-center gap-1.5 text-[12.5px] text-muted" aria-label="현재 위치">
        <Link href="/press" className="hover:text-ink">보도자료함</Link>
        <span>›</span>
        <span className="text-ink">메일로 받기</span>
      </nav>
      <h1 className="text-[22px] font-bold tracking-tight">내 메일로 온 보도자료를 보도자료함으로</h1>
      <p className="mt-1.5 text-[13.5px] leading-relaxed text-muted">
        내 이메일에 한 번만 설정해 두면, 보도자료 메일이 올 때마다 자동으로 보도자료함에 들어옵니다. 개인 메일은 들어오지 않습니다.
      </p>

      {error ? (
        <p className="mt-6 rounded-lg border border-draft/40 bg-draft/10 px-5 py-4 text-sm">
          이 기능을 쓰려면 관리자가 Supabase에서 <code>supabase/press-email.sql</code>을 실행해야 합니다.
        </p>
      ) : (
        <PressEmailSetup initial={inbox} />
      )}

      {isAdmin && !error && <MailServiceSettings address={settings?.address ?? null} webhook={webhook} />}
    </div>
  )
}
