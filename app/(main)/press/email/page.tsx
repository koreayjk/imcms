import Link from 'next/link'
import { headers } from 'next/headers'
import { getCmsContext } from '@/lib/cms'
import { getT } from '@/lib/cms-t'
import PressEmailSetup from '@/components/cms/PressEmailSetup'
import MailServiceSettings from '@/components/cms/MailServiceSettings'
import PressMailLimits from '@/components/cms/PressMailLimits'
import { getMyInbox, getMailLimits } from './actions'

export default async function PressEmailPage() {
  const { supabase, isSuper } = await getCmsContext()
  const { t, lang } = await getT()
  const { inbox, error } = await getMyInbox()

  const isAdmin = isSuper
  const { data: admin } = isAdmin ? await supabase.rpc('admin_press_mail_settings') : { data: null }
  const settings = (Array.isArray(admin) ? admin[0] : admin) as { secret: string | null; address: string | null } | null
  const limits = isAdmin ? await getMailLimits() : null
  const host = (await headers()).get('host') ?? 'imcms.vercel.app'
  const webhook = settings?.secret ? `https://${host}/api/inbound/email?key=${settings.secret}` : null

  return (
    <div className="mx-auto max-w-[900px] px-4 py-5 md:px-8 md:py-8 pb-20 md:pb-20">
      <nav className="mb-5 flex items-center gap-1.5 text-[12.5px] text-muted" aria-label={t('현재 위치', 'Breadcrumb')}>
        <Link href="/press" className="hover:text-ink">{t('보도자료함', 'Press releases')}</Link>
        <span>›</span>
        <span className="text-ink">{t('메일로 받기', 'Receive by email')}</span>
      </nav>
      <h1 className="text-[22px] font-bold tracking-tight">{t('내 메일로 온 보도자료를 보도자료함으로', 'Send press releases from my email to the press inbox')}</h1>
      <p className="mt-1.5 text-[13.5px] leading-relaxed text-muted">
        {t('내 이메일에 한 번만 설정해 두면, 보도자료 메일이 올 때마다 자동으로 보도자료함에 들어옵니다. 개인 메일은 들어오지 않습니다.', 'Set this up once in your email account, and every press release email is added to the press inbox automatically. Personal emails are not included.')}
      </p>

      {error ? (
        <p className="mt-6 rounded-lg border border-draft/40 bg-draft/10 px-5 py-4 text-sm">
          {lang === 'en' ? <>To use this feature, an admin needs to run <code>supabase/press-email.sql</code> in Supabase.</> : <>이 기능을 쓰려면 관리자가 Supabase에서 <code>supabase/press-email.sql</code>을 실행해야 합니다.</>}
        </p>
      ) : (
        <PressEmailSetup initial={inbox} />
      )}

      {isAdmin && !error && <MailServiceSettings address={settings?.address ?? null} webhook={webhook} />}
      {isAdmin && !error && (limits
        ? <PressMailLimits initial={limits.outlets} plans={limits.plans} />
        : <p className="mt-6 rounded-lg border border-draft/40 bg-draft/10 px-5 py-4 text-sm">{lang === 'en' ? <>To use per-outlet daily limits, run <code>supabase/press-email-limits.sql</code> in Supabase.</> : <>언론사별 하루 한도를 쓰려면 Supabase에서 <code>supabase/press-email-limits.sql</code>을 실행해 주세요.</>}</p>)}
    </div>
  )
}
