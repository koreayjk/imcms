'use client'

import { useEffect } from 'react'
import { markLaunchSeen } from '@/app/(main)/support/onboarding/actions'

// 개통 진행 현황을 열면 "새 소식" 표시를 지운다: 운영팀은 고객 글을 봤다고, 고객은 새 소식을 확인했다고 DB에 기록한다
export default function OnboardingSeen({ outletId }: { outletId: string }) {
  useEffect(() => { markLaunchSeen(outletId).catch(() => {}) }, [outletId])
  return null
}
