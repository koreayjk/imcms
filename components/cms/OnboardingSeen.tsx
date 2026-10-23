'use client'

import { useEffect } from 'react'
import { markLaunchSeen } from '@/app/(main)/support/onboarding/actions'
import { ONBOARDING_SEEN_COOKIE } from '@/lib/onboarding-guide'

// 개통 진행 현황을 열면 "새 글" 표시를 지운다: 운영팀은 DB에 열어 봄을 기록하고, 고객은 이 브라우저에 마지막으로 본 시각을 남긴다
export default function OnboardingSeen({ outletId, staff }: { outletId: string; staff: boolean }) {
  useEffect(() => {
    if (staff) markLaunchSeen(outletId).catch(() => {})
    else document.cookie = `${ONBOARDING_SEEN_COOKIE}=${Date.now()}; path=/; max-age=31536000; samesite=lax`
  }, [outletId, staff])
  return null
}
