import { ANDROID_CERT_SHA256, ANDROID_PACKAGE } from '@/lib/android'

// 안드로이드 앱이 이 사이트의 공식 앱임을 확인하는 파일 (Digital Asset Links)
//   맞으면 앱에서 주소창 없이 편집국이 열린다. 지문이 비어 있으면 빈 목록을 돌려준다
export const dynamic = 'force-static'

export function GET() {
  const body = ANDROID_CERT_SHA256.length
    ? [{
        relation: ['delegate_permission/common.handle_all_urls'],
        target: { namespace: 'android_app', package_name: ANDROID_PACKAGE, sha256_cert_fingerprints: ANDROID_CERT_SHA256 },
      }]
    : []
  return Response.json(body, { headers: { 'Cache-Control': 'public, max-age=3600' } })
}
