'use client'

import { useActionState } from 'react'
import { testLinks, type LinkResult, type LinkTest } from '@/app/(main)/admin/link-test/actions'

const LABEL: Record<LinkResult['verdict'], { t: string; c: string }> = {
  file: { t: '파일 바로 받음', c: 'bg-published/10 text-published' },
  page: { t: '안내 화면', c: 'bg-draft/15 text-draft' },
  login: { t: '로그인 필요', c: 'bg-danger/10 text-danger' },
  expired: { t: '만료·없음', c: 'bg-line/60 text-muted' },
  blocked: { t: '막힘', c: 'bg-danger/10 text-danger' },
  error: { t: '오류', c: 'bg-danger/10 text-danger' },
  skipped: { t: '건너뜀', c: 'bg-line/60 text-muted' },
}

export default function LinkTestForm() {
  const [state, action, pending] = useActionState<LinkTest | null, FormData>(testLinks, null)
  const counts = (state?.results ?? []).reduce<Record<string, number>>((m, r) => { m[r.verdict] = (m[r.verdict] ?? 0) + 1; return m }, {})
  return (
    <div className="space-y-5">
      <form action={action} className="space-y-3">
        <textarea name="links" rows={8} placeholder={'링크를 한 줄에 하나씩 붙여 넣으세요 (링크-샘플.txt 내용을 그대로 붙여도 됩니다)\nhttps://bigfile.mail.naver.com/download?fid=…\nhttps://kmmbox.korea.kr/bigDataDownload/…/'} className="field-input w-full font-mono text-[12.5px]" required />
        <label className="flex items-center gap-2 text-[13px]"><input type="checkbox" name="full" /> 끝까지 받아서 시간도 재기 (한 번에 8개까지, 파일은 저장하지 않고 버립니다. 기본은 앞부분만 확인)</label>
        <button type="submit" disabled={pending} className="btn-primary px-4 py-2 disabled:opacity-60">{pending ? '시험하는 중… (최대 1분)' : '시험하기'}</button>
      </form>
      {state?.error && <p className={`rounded border px-3 py-2 text-[13px] ${state.ok ? 'border-line bg-[#FFF8E6] text-[#6B4E00]' : 'border-danger/40 text-danger'}`}>{state.error}</p>}
      {state?.results && (
        <>
          <p className="text-[13px] text-muted">{Object.entries(counts).map(([k, n]) => `${LABEL[k as LinkResult['verdict']].t} ${n}`).join(' · ')} — 서울 리전(실제 서비스와 같은 환경)에서 시험한 결과입니다.</p>
          <div className="overflow-x-auto rounded border border-line">
            <table className="w-full text-[12.5px]">
              <thead className="bg-[#F8F9FA] text-left text-muted"><tr><th className="px-3 py-2">#</th><th className="px-3 py-2">주소(토큰은 앞부분만)</th><th className="px-3 py-2">결과</th><th className="px-3 py-2">자세히</th></tr></thead>
              <tbody className="divide-y divide-line">
                {state.results.map((r) => (
                  <tr key={r.n} className="align-top">
                    <td className="px-3 py-2 tabular-nums">{r.n}</td>
                    <td className="max-w-[320px] break-all px-3 py-2 font-mono text-[11.5px]">{r.shown}{r.hops && r.hops.length > 1 && <span className="block text-muted">→ {r.hops.slice(1).join(' → ')}</span>}</td>
                    <td className="px-3 py-2"><span className={`rounded px-2 py-0.5 text-[11.5px] font-semibold ${LABEL[r.verdict].c}`}>{LABEL[r.verdict].t}</span></td>
                    <td className="px-3 py-2 leading-relaxed">{r.note}
                      <span className="block text-muted">{[r.status && `응답 ${r.status}`, r.type, r.magic && `내용: ${r.magic}`, r.filename && `파일명: ${r.filename}`, r.size ? `${(r.size / 1048576).toFixed(1)}MB` : '', r.ms && `${(r.ms / 1000).toFixed(1)}초`].filter(Boolean).join(' · ')}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
