import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { GDPA } from '@/lib/gdpa'
import { gdpaBase } from '@/lib/gdpa-server'
import { gdpaSession } from '@/lib/gdpa-auth'
import { formatDate } from '@/lib/format'
import GdpaSignupForm from '@/components/gdpa/GdpaSignupForm'

export const metadata: Metadata = { title: '내 정보' }
export const dynamic = 'force-dynamic'

const STATUS = {
  pending: { label: '승인 대기', tone: 'bg-[#9A8C46]/15 text-[#6B5F22]', note: '사무국이 신청 내용을 확인하고 있습니다. 승인되면 이메일로 알려 드립니다.' },
  approved: { label: '승인 완료', tone: 'bg-[#1E7D4D]/10 text-[#1E7D4D]', note: '협회 회원입니다. 공지사항과 행사·교육 안내를 확인해 주세요.' },
  rejected: { label: '승인 보류', tone: 'bg-[#B3392C]/10 text-[#B3392C]', note: '가입 신청이 보류되었습니다. 자세한 내용은 사무국에 문의해 주세요.' },
}

export default async function MyPage() {
  const base = (await gdpaBase())
  const { email, member } = await gdpaSession()
  if (!email) redirect(`${base}/login`)

  return (
    <div className="mx-auto max-w-[760px] px-4 py-14">
      <h1 className="text-[28px] font-extrabold tracking-[-0.03em] text-[var(--g-navy)]">내 정보</h1>
      {member ? (
        <>
          <div className="mt-6 rounded-lg border border-[var(--g-line)] p-6">
            <div className="flex flex-wrap items-center gap-3">
              <p className="text-[20px] font-bold">{member.name}</p>
              <span className={`rounded px-2 py-0.5 text-[13px] font-bold ${STATUS[member.status].tone}`}>{STATUS[member.status].label}</span>
              <span className="text-[13px] text-[var(--g-sub)]">{member.member_type === 'outlet' ? '회원사(언론사)' : '개인회원'}</span>
            </div>
            <p className="mt-2 text-[14.5px] text-[var(--g-sub)]">{STATUS[member.status].note}</p>
            <dl className="mt-5 grid gap-x-6 gap-y-2 text-[15px] sm:grid-cols-[110px_1fr]">
              <dt className="text-[var(--g-sub)]">이메일</dt><dd>{email}</dd>
              <dt className="text-[var(--g-sub)]">휴대전화</dt><dd>{member.phone ?? '-'}</dd>
              <dt className="text-[var(--g-sub)]">소속·직함</dt><dd>{[member.org, member.position].filter(Boolean).join(' · ') || '-'}</dd>
              <dt className="text-[var(--g-sub)]">가입 신청</dt><dd>{formatDate(member.created_at)}</dd>
              <dt className="text-[var(--g-sub)]">약관 동의</dt><dd>이용약관·개인정보 {formatDate(member.agreed_terms_at)} · 행사 안내 수신 {member.marketing ? '동의' : '안 함'}</dd>
            </dl>
          </div>
          <p className="mt-6 text-[14px] leading-[1.75] text-[var(--g-sub)]">
            정보를 바꾸거나 탈퇴하려면 사무국에 연락해 주세요({GDPA.office.email || '사무국 연락처는 “오시는 길·문의”에 안내합니다'}). 탈퇴하면 개인정보는 지체 없이 파기합니다.{' '}
            <Link href={`${base}/privacy`} className="underline">개인정보처리방침</Link>
          </p>
        </>
      ) : (
        <>
          <p className="mt-3 text-[15px] text-[var(--g-sub)]">{email} 계정은 아직 협회 회원이 아닙니다. 아래에서 협회 회원을 신청할 수 있습니다.</p>
          <div className="mt-8"><GdpaSignupForm base={base} loggedInEmail={email} /></div>
        </>
      )}
    </div>
  )
}
