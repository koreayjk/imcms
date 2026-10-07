'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { saveAdDocument } from '@/app/doc/ad/actions'
import { blobToBase64, downloadBlob, elementToPdf } from '@/lib/pdf-client'
import type { AdDocKind } from '@/lib/ad-doc'

type Act = 'email' | 'download' | 'print'
export type MailDefaults = { to: string; subject: string; message: string; me: string | null }

// 문서 위 버튼: [✉ 이메일로 보내기] [⬇ PDF 다운로드] [🖨 인쇄]
//   지금 내용 화면(live)에서 누르면 먼저 번호를 매겨 저장하고(내용이 같으면 그 번호 그대로) 저장본 화면에서 이어서 한다
export default function AdDocToolbar(props:
  | { mode: 'live'; contractId: string; kind: AdDocKind }
  | { mode: 'saved'; docId: string; filename: string; mail: MailDefaults; autoDo?: Act | null }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [mailOpen, setMailOpen] = useState(false)

  const docEl = () => document.querySelector<HTMLElement>('[data-ad-doc]')
  async function download() {
    if (props.mode !== 'saved') return
    const el = docEl()
    if (!el) return
    setBusy('PDF 만드는 중…'); setError('')
    try { downloadBlob(await elementToPdf(el), props.filename) } catch (e) { setError(`PDF를 만들지 못했습니다: ${e instanceof Error ? e.message : e}`) }
    setBusy('')
  }

  function act(a: Act) {
    if (props.mode === 'saved') {
      if (a === 'print') return window.print()
      if (a === 'download') return void download()
      return setMailOpen(true)
    }
    const { contractId, kind } = props
    start(async () => {
      setError('')
      const r = await saveAdDocument(contractId, kind)
      if (r.error || !r.id) return setError(r.error ?? '저장하지 못했습니다.')
      router.push(`/doc/saved/${r.id}?${r.reused ? 'same=1' : 'new=1'}&do=${a}&t=${Date.now()}`)
    })
  }

  // 저장본 화면으로 넘어오면 누른 일을 이어서 (한 번만)
  const autoDo = props.mode === 'saved' ? props.autoDo : null
  useEffect(() => {
    if (!autoDo) return
    const u = new URL(window.location.href)
    u.searchParams.delete('do'); u.searchParams.delete('t')
    window.history.replaceState(window.history.state, '', u.toString())
    const t = setTimeout(() => act(autoDo), 500)
    return () => clearTimeout(t)
  }, [autoDo]) // eslint-disable-line react-hooks/exhaustive-deps

  const off = pending || !!busy
  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <button type="button" disabled={off} onClick={() => act('email')} className="btn-primary">✉ 이메일로 보내기</button>
        <button type="button" disabled={off} onClick={() => act('download')} className="btn-secondary bg-white">⬇ PDF 다운로드</button>
        <button type="button" disabled={off} onClick={() => act('print')} className="btn-secondary bg-white">🖨 인쇄</button>
      </div>
      {(pending || busy) && <p className="text-[12.5px] text-review">{busy || '저장하는 중…'}</p>}
      {error && <p role="alert" className="text-[12.5px] text-danger">{error}</p>}
      {mailOpen && props.mode === 'saved' && <MailDialog docId={props.docId} filename={props.filename} defaults={props.mail} onClose={() => setMailOpen(false)} getEl={docEl} />}
    </div>
  )
}

function MailDialog({ docId, filename, defaults, onClose, getEl }: { docId: string; filename: string; defaults: MailDefaults; onClose: () => void; getEl: () => HTMLElement | null }) {
  const router = useRouter()
  const [to, setTo] = useState(defaults.to)
  const [subject, setSubject] = useState(defaults.subject)
  const [message, setMessage] = useState(defaults.message)
  const [ccMe, setCcMe] = useState(true)
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [done, setDone] = useState('')
  const first = useRef<HTMLInputElement>(null)
  useEffect(() => { first.current?.focus() }, [])

  async function send() {
    const list = to.split(/[,;\s]+/).map((x) => x.trim()).filter(Boolean)
    if (!list.length) return setError('받는 사람 이메일을 적어 주세요.')
    const el = getEl()
    if (!el) return
    setError(''); setBusy('PDF 만드는 중…')
    try {
      const pdf = await blobToBase64(await elementToPdf(el))
      setBusy('보내는 중…')
      const res = await fetch('/api/ad-doc/mail', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ docId, to: list, subject, message, ccMe, pdf }) })
      const j = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string }
      if (!res.ok || !j.ok) throw new Error(j.error ?? `보내지 못했습니다 (HTTP ${res.status})`)
      setDone(`${list.join(', ')}에게 보냈습니다.`)
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
    setBusy('')
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4 print:hidden" role="dialog" aria-modal="true" aria-label="이메일로 보내기">
      <div className="w-full max-w-[560px] rounded-lg bg-white p-5 text-left shadow-xl">
        <h2 className="text-[16px] font-bold">이메일로 보내기</h2>
        {done ? (
          <>
            <p className="mt-3 rounded bg-published/10 px-3 py-2.5 text-[14px] font-semibold text-published">✓ {done}</p>
            <p className="mt-2 text-[12.5px] text-muted">광고주가 회신하면 {defaults.me ?? '보낸 사람'} 메일로 옵니다.</p>
            <div className="mt-4 flex justify-end"><button type="button" onClick={onClose} className="btn-primary">닫기</button></div>
          </>
        ) : (
          <>
            <div className="mt-3 space-y-3 text-[13px]">
              <label className="block"><span className="field-label">받는 사람 (여러 명은 쉼표로)</span><input ref={first} value={to} onChange={(e) => setTo(e.target.value)} placeholder="ad@company.com" className="field-input" /></label>
              <label className="block"><span className="field-label">제목</span><input value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={150} className="field-input" /></label>
              <label className="block"><span className="field-label">내용</span><textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={8} maxLength={3000} className="field-input resize-y" /></label>
              <p className="rounded bg-paper px-3 py-2 text-[12.5px] leading-relaxed">📎 첨부: <strong>{filename}</strong> (지금 보이는 문서 그대로 PDF로 만들어 붙입니다)<br />메일 맨 아래에는 우리 매체 정보(상호·대표·사업자번호·주소·연락처·홈페이지)와 로고가 자동으로 붙습니다.</p>
              {defaults.me && <label className="flex items-center gap-2 text-[12.5px] text-muted"><input type="checkbox" checked={ccMe} onChange={(e) => setCcMe(e.target.checked)} />나({defaults.me})에게도 사본 보내기</label>}
            </div>
            {error && <p role="alert" className="mt-3 text-[13px] text-danger">{error}</p>}
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={onClose} disabled={!!busy} className="btn-secondary">취소</button>
              <button type="button" onClick={send} disabled={!!busy} className="btn-primary">{busy || '보내기'}</button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
