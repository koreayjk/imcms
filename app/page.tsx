// 초기 스캐폴드 — Claude Code에서 실제 Supabase 연동 및 인증으로 교체 예정
const MOCK_ARTICLES = [
  { id: 1, title: '텍사스 A&M In-state 학비 개정 관련 보도', author: '조건호', status: 'in_review' },
  { id: 2, title: 'IM Mission 여름 비전트립 후기', author: '김경석', status: 'published' },
  { id: 3, title: '신입 기자 인터뷰 초안', author: '김진아', status: 'draft' },
]

const STATUS_LABEL: Record<string, string> = {
  draft: '초안',
  in_review: '검토중',
  published: '발행됨',
  rejected: '반려',
}

export default function DashboardPage() {
  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <header className="mb-8 flex items-baseline justify-between border-b border-line pb-4">
        <h1 className="text-lg font-semibold tracking-tight">IM CMS</h1>
        <span className="text-sm text-muted">기사 관리</span>
      </header>

      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-line text-left text-muted">
            <th className="py-2 font-normal">제목</th>
            <th className="py-2 font-normal">작성자</th>
            <th className="py-2 font-normal">상태</th>
          </tr>
        </thead>
        <tbody>
          {MOCK_ARTICLES.map((a) => (
            <tr key={a.id} className="border-b border-line/60">
              <td className="py-3 font-medium">{a.title}</td>
              <td className="py-3 text-muted">{a.author}</td>
              <td className="py-3">
                <span className={`status-badge status-${a.status}`}>
                  {STATUS_LABEL[a.status]}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  )
}
