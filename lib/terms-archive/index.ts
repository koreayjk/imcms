import type { PolicySection } from '../service-terms'
import { TERMS_2026_10_02 } from './2026-10-02'

// 예전 이용약관 본문 (버전 → 시행일·본문). 동의 기록의 terms_version 으로 그때 문안을 찾는다
export const TERMS_HISTORY: Record<string, { effective: string; sections: PolicySection[] }> = {
  '2026-10-02': { effective: '2026년 10월 2일', sections: TERMS_2026_10_02 },
}
