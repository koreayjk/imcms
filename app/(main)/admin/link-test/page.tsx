import { redirect } from 'next/navigation'
import { getCmsContext } from '@/lib/cms'
import LinkTestForm from '@/components/cms/LinkTest'

// 한국 사이트는 해외 접속을 막기도 하므로 실제 서비스처럼 서울 리전에서 시험한다
export const preferredRegion = 'icn1'
export const maxDuration = 60

export default async function LinkTestPage() {
  const { isStaff } = await getCmsContext()
  if (!isStaff) redirect('/newsroom')
  return (
    <div className="mx-auto max-w-[1100px] px-4 py-5 md:px-8 md:py-8">
      <h1 className="text-[22px] font-bold tracking-tight">대용량 첨부 링크 시험</h1>
      <p className="mt-1 mb-6 max-w-[48em] text-[13px] leading-relaxed text-muted">
        보도자료 메일 안의 대용량 첨부 링크(네이버 bigfile, 정부 메일 kmmbox.korea.kr, 지자체 메일, 국회 mailer 등)를 서버가 <b>로그인 없이 받을 수 있는지</b> 확인합니다.
        파일은 저장하지 않고, 앞부분만 읽어 모양을 봅니다. 링크가 만료되기 전에 시험하세요. .kr 도메인과 naver.com 의 https 주소만 시험합니다.
      </p>
      <LinkTestForm />
    </div>
  )
}
