// 첫 화면 시연: 보도자료의 홍보 문구에 교정 펜이 그어지고, 기사 초안과 기자 확인 메모가 나온다
function Del({ children, delay }: { children: React.ReactNode; delay: number }) {
  return (
    <del className="proof-del" style={{ animationDelay: `${delay}ms` }}>
      {children}
    </del>
  )
}

export default function ProofDemo() {
  return (
    <div className="relative text-[#14171C]" aria-label="예시: 보도자료가 기사 초안으로 바뀌는 모습">
      {/* 보도자료 원문 */}
      <div className="rounded-lg border border-[#E4E6EA] bg-white p-5 shadow-[0_1px_0_#E4E6EA] sm:p-6">
        <p className="flex items-center justify-between text-[11.5px] font-semibold tracking-[0.06em] text-[#5B616B]">
          <span>보도자료 원문</span>
          <span className="rounded bg-[#F4F5F7] px-1.5 py-0.5 font-medium tracking-normal">예시</span>
        </p>
        <p className="mt-3 text-[15px] font-bold leading-snug">
          <Del delay={400}>업계 최초!</Del> 한울요양병원, <Del delay={650}>획기적인</Del> 야간 돌봄 서비스 <Del delay={900}>전격</Del> 도입
        </p>
        <p className="mt-2.5 text-[13.5px] leading-relaxed text-[#3B4048]">
          <Del delay={1150}>국내 최고의 노인 전문 요양병원인</Del> 한울요양병원(원장 김정민)은 10월 1일부터 야간 전담 간호사를 4명에서 8명으로
          늘리는 ‘밤샘 돌봄’ 서비스를 도입한다고 밝혔다.
        </p>
        <p className="mt-2.5 text-[12.5px] text-[#5B616B]">
          <Del delay={1400}>문의: 홍보팀 02-000-0000 / care@example.com</Del>
        </p>
      </div>

      {/* 화살표 */}
      <div className="flex justify-center py-2.5" aria-hidden>
        <span className="proof-rise flex items-center gap-2 rounded-full bg-[#0F1115] ring-1 ring-white/20 px-3 py-1 text-[11.5px] font-semibold text-white shadow-[0_6px_18px_-6px_rgba(139,92,246,0.8)]" style={{ animationDelay: '1700ms' }}>
          <span className="h-1.5 w-1.5 rounded-full bg-white" />
          AI가 기사체로 다시 씀
        </span>
      </div>

      {/* 기사 초안 */}
      <div className="proof-rise rounded-lg border border-[#14171C] bg-white p-5 sm:p-6" style={{ animationDelay: '1900ms' }}>
        <p className="text-[11.5px] font-semibold tracking-[0.06em] text-[#5B616B]">기사 초안 · 작성중</p>
        <p className="mt-3 font-[family-name:var(--serif)] text-[19px] font-bold leading-snug tracking-[-0.01em]">
          한울요양병원, 야간 전담 간호사 4명→8명으로 늘린다
        </p>
        <p className="mt-1.5 text-[13px] text-[#5B616B]">10월부터 ‘밤샘 돌봄’ 서비스… 야간 환자 관찰 강화</p>
        <p className="mt-3 text-[13.5px] leading-relaxed text-[#3B4048]">
          [예시일보=홍길동 기자] 한울요양병원(원장 김정민)이 10월 1일부터 야간 전담 간호사를 기존 4명에서 8명으로 늘리는 ‘밤샘 돌봄’ 서비스를 시작한다.
        </p>
        <div className="mt-4 rounded border border-[#F2B544]/60 bg-[#FFF8E6] px-3.5 py-2.5 text-[12.5px] leading-relaxed">
          <p className="font-semibold text-[#7A5200]">기자 확인 메모</p>
          <p className="mt-0.5 text-[#3B4048]">• ‘업계 최초’는 근거가 없어 뺐습니다.</p>
          <p className="text-[#3B4048]">• 간호사 수(4명→8명)는 병원에 한 번 더 확인하세요.</p>
        </div>
      </div>
    </div>
  )
}
