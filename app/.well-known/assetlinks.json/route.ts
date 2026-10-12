import { headers } from 'next/headers'
import { ANDROID_CERT_SHA256, ANDROID_PACKAGE, outletApp } from '@/lib/android'

// 안드로이드 앱이 이 사이트의 공식 앱임을 확인하는 파일 (Digital Asset Links)
//   맞으면 앱에서 주소창 없이 사이트가 열린다. 지문이 비어 있으면 빈 목록을 돌려준다
//   독자용 앱이 있는 매체 도메인은 그 매체 앱, 그 밖의 주소는 IM 뉴스룸 편집국 앱
export const dynamic = 'force-dynamic'

export async function GET() {
  const host = ((await headers()).get('host') ?? '').split(':')[0].toLowerCase()
  const outlet = outletApp([host])
  const pkg = outlet ? outlet.package : ANDROID_PACKAGE
  const certs = outlet ? outlet.sha256 : ANDROID_CERT_SHA256
  const body = certs.length
    ? [{
        relation: ['delegate_permission/common.handle_all_urls'],
        target: { namespace: 'android_app', package_name: pkg, sha256_cert_fingerprints: certs },
      }]
    : []
  return Response.json(body, { headers: { 'Cache-Control': 'public, max-age=3600' } })
}
