'use client'

import { useRef } from 'react'

export default function FilePicker({ files, setFiles }: { files: File[]; setFiles: (f: File[]) => void }) {
  const ref = useRef<HTMLInputElement>(null)
  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => ref.current?.click()} className="btn-secondary bg-white px-3 py-1.5 text-[13px]">📎 파일 선택 <span className="text-muted">(파일당 20MB 이하)</span></button>
        <input ref={ref} type="file" multiple hidden onChange={(e) => { setFiles([...files, ...Array.from(e.target.files ?? [])]); e.target.value = '' }} />
        {files.map((f, i) => (
          <span key={`${f.name}-${i}`} className="inline-flex items-center gap-1.5 rounded bg-line/60 px-2 py-1 text-[12.5px]">
            {f.name}
            <button type="button" onClick={() => setFiles(files.filter((_, j) => j !== i))} aria-label={`${f.name} 빼기`} className="text-muted hover:text-danger">×</button>
          </span>
        ))}
      </div>
      <p className="mt-1.5 text-[12px] text-muted">첨부한 파일은 우리 매체와 운영팀만 볼 수 있습니다. 비밀번호 같은 민감한 정보는 파일이나 본문에 적지 마세요.</p>
    </div>
  )
}
