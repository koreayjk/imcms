/** @type {import('next').NextConfig} */

// 기사 사진(Supabase 사진 저장소)을 화면 크기에 맞게 줄여 보낸다 (lib/image-url.ts)
const supabaseHost = (() => {
  try { return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').hostname } catch { return null }
})()

const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: supabaseHost ? [{ protocol: 'https', hostname: supabaseHost, pathname: '/storage/v1/object/public/**' }] : [],
    // 한 번 줄인 사진은 31일 동안 다시 만들지 않는다 (사진 주소는 바뀌지 않는다)
    minimumCacheTTL: 2678400,
    formats: ['image/webp'],
  },
}

module.exports = nextConfig
