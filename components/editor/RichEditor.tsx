'use client'

import { EditorContent, useEditor, type Editor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Link from '@tiptap/extension-link'
import Youtube from '@tiptap/extension-youtube'
import Placeholder from '@tiptap/extension-placeholder'
import Underline from '@tiptap/extension-underline'
import TextAlign from '@tiptap/extension-text-align'
import TextStyle from '@tiptap/extension-text-style'
import Color from '@tiptap/extension-color'
import Highlight from '@tiptap/extension-highlight'
import Table from '@tiptap/extension-table'
import TableRow from '@tiptap/extension-table-row'
import TableCell from '@tiptap/extension-table-cell'
import TableHeader from '@tiptap/extension-table-header'
import Subscript from '@tiptap/extension-subscript'
import Superscript from '@tiptap/extension-superscript'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Fragment, Slice } from '@tiptap/pm/model'
import type { EditorView } from '@tiptap/pm/view'
import { FontSize, ResizableImage } from './extensions'

// 워드·한글·웹에서 복사한 글을 서식(글꼴·굵기·색·크기 등) 없이 글자만 넣는다. 줄바꿈은 문단으로 살린다
function pastePlainText(view: EditorView, text: string) {
  const lines = text
    .replace(/\r\n?/g, '\n')
    .replace(/[\u200b\ufeff]/g, '')
    .replace(/[\u00a0\t]/g, ' ')
    .split('\n')
    .map((l) => l.replace(/ {2,}/g, ' ').trim())
    .filter(Boolean)
  if (!lines.length) return
  const { state } = view
  if (lines.length === 1) {
    view.dispatch(state.tr.insertText(lines[0]).scrollIntoView())
    return
  }
  const { paragraph } = state.schema.nodes
  const nodes = lines.map((l) => paragraph.create(null, state.schema.text(l)))
  // 앞뒤를 열어 두어 첫 줄·끝 줄은 지금 문단에 이어 붙는다
  view.dispatch(state.tr.replaceSelection(new Slice(Fragment.from(nodes), 1, 1)).scrollIntoView())
}

type Props = {
  initialHtml: string
  onChange: (html: string, charCount: number) => void
  onReady: (editor: Editor) => void
  // 도구 막대의 "사진" 버튼: 파일을 올리고 주소를 돌려준다
  onUploadImage?: (file: File) => Promise<string>
  // 편집장 이상: 글자 크기·글자색·HTML 보기 (기자마다 제각각 쓰면 신문 모양이 들쭉날쭉해진다)
  advanced?: boolean
}

const FONT_SIZES = ['12px', '14px', '15px', '16px', '18px', '20px', '24px', '28px', '32px']
const TEXT_COLORS = ['#1C1F1D', '#5F6661', '#B3392C', '#E5483A', '#D97706', '#1E7D4D', '#02472F', '#2D6CA8', '#1F4E8C', '#7C3AED']
const HIGHLIGHTS = ['#FFF3A3', '#FFE0B2', '#FFCDD2', '#C8E6C9', '#BBDEFB', '#E1BEE7']
const SYMBOLS = ['▲', '▼', '△', '▽', '◆', '◇', '■', '□', '●', '○', '◎', '★', '☆', '※', '☞', '→', '←', '↑', '↓', '·', '…', '―', '「', '」', '『', '』', '‘', '’', '“', '”', '㈜', '℃', '㎡', '㎞', '㎏', '㎎', '%', '①', '②', '③', '④', '⑤', '×', '÷', '±', '≒', '≥', '≤', '₩', '$', '€', '¥']

export default function RichEditor({ initialHtml, onChange, onReady, onUploadImage, advanced = false }: Props) {
  const [more, setMore] = useState(false)
  // 더보기를 펼쳐 둔 사람은 다음에도 펼친 채로 (이 브라우저에만 기억)
  useEffect(() => {
    try { if (localStorage.getItem('im-editor-more') === '1') setMore(true) } catch {}
  }, [])
  const toggleMore = (v: boolean) => {
    setMore(v)
    try { localStorage.setItem('im-editor-more', v ? '1' : '0') } catch {}
  }
  const [source, setSource] = useState<string | null>(null)
  const [full, setFull] = useState(false)
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  // 붙여넣기 방식: 기본은 글자만 (이 브라우저에 기억)
  const [pastePlain, setPastePlain] = useState(true)
  const pasteRef = useRef(true)
  const [pasteNote, setPasteNote] = useState(false)
  useEffect(() => {
    try { if (localStorage.getItem('im-paste-plain') === '0') { setPastePlain(false); pasteRef.current = false } } catch {}
  }, [])
  const togglePaste = () => {
    const v = !pastePlain
    setPastePlain(v)
    pasteRef.current = v
    setPasteNote(false)
    try { localStorage.setItem('im-paste-plain', v ? '1' : '0') } catch {}
  }
  useEffect(() => {
    if (!pasteNote) return
    const t = setTimeout(() => setPasteNote(false), 6000)
    return () => clearTimeout(t)
  }, [pasteNote])

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({ heading: { levels: [2, 3, 4] } }),
      Underline,
      TextStyle,
      FontSize,
      Color,
      Highlight.configure({ multicolor: true }),
      Subscript,
      Superscript,
      ResizableImage,
      Link.configure({ openOnClick: false, autolink: true }),
      Youtube.configure({ nocookie: true, width: 640, height: 360 }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Table.configure({ resizable: false }),
      TableRow,
      TableHeader,
      TableCell,
      Placeholder.configure({ placeholder: '기사 본문을 입력하세요' }),
    ],
    content: initialHtml,
    editorProps: {
      attributes: { class: 'article-content min-h-[520px] px-6 py-5 text-[16px] leading-[1.9] outline-none' },
      handlePaste: (view, event) => {
        if (!pasteRef.current) return false
        const dt = event.clipboardData
        const text = dt?.getData('text/plain') ?? ''
        // 사진만 복사한 경우, 또는 이 기사 안에서 옮기는 경우(서식 유지)는 원래대로
        if (!dt || !text) return false
        const html = dt.getData('text/html')
        if (html.includes('data-pm-slice')) return false
        event.preventDefault()
        pastePlainText(view, text)
        if (html) setPasteNote(true)
        return true
      },
    },
    onUpdate: ({ editor }) => onChange(editor.getHTML(), editor.getText().replace(/\s/g, '').length),
    onCreate: ({ editor }) => onChange(editor.getHTML(), editor.getText().replace(/\s/g, '').length),
  })

  useEffect(() => {
    if (editor) onReady(editor)
  }, [editor, onReady])

  // 전체 화면에서는 Esc로 빠져나온다
  useEffect(() => {
    if (!full) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setFull(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [full])

  if (!editor) return <div className="min-h-[600px] rounded border border-line bg-white" />

  const chain = () => editor.chain().focus()
  const inTable = editor.isActive('table')
  const block = editor.isActive('heading', { level: 2 }) ? 'h2' : editor.isActive('heading', { level: 3 }) ? 'h3' : editor.isActive('heading', { level: 4 }) ? 'h4' : 'p'
  const fontSize = (editor.getAttributes('textStyle').fontSize as string | undefined) ?? ''
  const align = ((editor.isActive('heading') ? editor.getAttributes('heading') : editor.getAttributes('paragraph')).textAlign as string | null) || 'justify'

  const setLink = () => {
    const prev = editor.getAttributes('link').href as string | undefined
    const url = window.prompt('링크 주소를 입력하세요 (비우면 링크 삭제)', prev ?? 'https://')
    if (url === null) return
    if (!url.trim() || url === 'https://') chain().unsetLink().run()
    else chain().extendMarkRange('link').setLink({ href: url.trim() }).run()
  }

  const addYoutube = () => {
    const url = window.prompt('유튜브 영상 주소를 입력하세요')
    if (url && !editor.chain().focus().setYoutubeVideo({ src: url.trim() }).run()) window.alert('유튜브 주소를 확인해 주세요.')
  }

  const pickImage = async (files: FileList | null) => {
    if (!files?.length || !onUploadImage) return
    setUploading(true)
    try {
      for (const f of Array.from(files)) {
        const src = await onUploadImage(f)
        editor.chain().focus().setImage({ src, alt: '' }).run()
      }
    } catch (e) {
      window.alert(e instanceof Error ? e.message : '사진을 올리지 못했습니다.')
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const applySource = () => {
    if (source === null) return
    editor.commands.setContent(source, true)
    setSource(null)
  }

  return (
    <div className={full ? 'fixed inset-0 z-50 flex flex-col bg-white' : 'rounded border border-line bg-white focus-within:border-ink/60'}>
      <div role="toolbar" aria-label="본문 서식" className={`sticky top-0 z-10 space-y-1 border-b border-line bg-[#FAFBFC] px-2 py-1.5 ${source !== null ? 'pointer-events-none opacity-40' : ''}`}>
        {/* 기본 도구: 기자가 매일 쓰는 것만 한 줄에 */}
        <div className="flex flex-wrap items-center gap-0.5">
          <Btn label="되돌리기 (Ctrl+Z)" onClick={() => chain().undo().run()} disabled={!editor.can().undo()}>↶</Btn>
          <Btn label="다시 실행 (Ctrl+Y)" onClick={() => chain().redo().run()} disabled={!editor.can().redo()}>↷</Btn>
          <Sep />
          <select
            aria-label="문단 형식"
            value={block}
            onChange={(e) => {
              const v = e.target.value
              if (v === 'p') chain().setParagraph().run()
              else chain().setHeading({ level: Number(v.slice(1)) as 2 | 3 | 4 }).run()
            }}
            className="h-8 rounded border border-line bg-white px-1.5 text-[13px]"
          >
            <option value="p">본문</option>
            <option value="h2">소제목</option>
            <option value="h3">중간제목</option>
            <option value="h4">작은제목</option>
          </select>
          <Sep />
          <Btn label="굵게 (Ctrl+B)" active={editor.isActive('bold')} onClick={() => chain().toggleBold().run()}><b>B</b></Btn>
          <Btn label="밑줄 (Ctrl+U)" active={editor.isActive('underline')} onClick={() => chain().toggleUnderline().run()}><u>U</u></Btn>
          <Sep />
          {/* 기본은 양쪽 정렬(정렬을 따로 정하지 않은 문단). 양쪽 정렬을 누르면 기본으로 되돌린다 */}
          <Btn label="양쪽 정렬 (기본)" active={align === 'justify'} onClick={() => chain().unsetTextAlign().run()}><AlignIcon kind="justify" /></Btn>
          <Btn label="왼쪽 정렬" active={align === 'left'} onClick={() => chain().setTextAlign('left').run()}><AlignIcon kind="left" /></Btn>
          <Btn label="가운데 정렬" active={align === 'center'} onClick={() => chain().setTextAlign('center').run()}><AlignIcon kind="center" /></Btn>
          <Btn label="오른쪽 정렬" active={align === 'right'} onClick={() => chain().setTextAlign('right').run()}><AlignIcon kind="right" /></Btn>
          <Sep />
          <Btn label="글머리 목록" active={editor.isActive('bulletList')} onClick={() => chain().toggleBulletList().run()}>• 목록</Btn>
          <Btn label="링크" active={editor.isActive('link')} onClick={setLink}>🔗 링크</Btn>
          {onUploadImage && (
            <>
              <Btn label="사진 넣기" onClick={() => fileRef.current?.click()} disabled={uploading}>{uploading ? '올리는 중…' : '🖼 사진'}</Btn>
              <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => pickImage(e.target.files)} />
            </>
          )}
          <Btn label="유튜브 영상" onClick={addYoutube}>▶ 영상</Btn>
          <Btn label="표 넣기 (3×3)" active={inTable} onClick={() => chain().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}>▦ 표</Btn>
          <Symbols onPick={(s) => chain().insertContent(s).run()} />
          <span className="ml-auto flex items-center gap-0.5">
            {pasteNote && <span role="status" className="hidden px-1 text-[11.5px] text-muted md:inline">서식 없이 글자만 붙여 넣었습니다</span>}
            <Btn
              label={pastePlain ? '글자만 붙여넣기 켜짐: 워드·한글에서 복사한 글꼴·굵기·색은 빼고 글자만 넣습니다. 누르면 서식도 함께 붙여 넣습니다' : '서식 포함 붙여넣기 켜짐: 누르면 글자만 붙여 넣습니다'}
              active={!pastePlain}
              onClick={togglePaste}
            >
              {pastePlain ? '📋 글자만 붙여넣기' : '📋 서식 포함 붙여넣기'}
            </Btn>
            <Btn label={more ? '추가 도구 접기' : '추가 도구 펼치기'} active={more} onClick={() => toggleMore(!more)}>{more ? '접기 ▴' : '더보기 ▾'}</Btn>
          </span>
        </div>

        {/* 더보기: 가끔 쓰는 것 (편집장 이상은 글자 크기·색·HTML까지) */}
        {more && (
          <div className="flex flex-wrap items-center gap-0.5 border-t border-line/70 pt-1">
            <Btn label="기울임 (Ctrl+I)" active={editor.isActive('italic')} onClick={() => chain().toggleItalic().run()}><i className="font-serif">I</i></Btn>
            <Btn label="취소선" active={editor.isActive('strike')} onClick={() => chain().toggleStrike().run()}><s>S</s></Btn>
            <Btn label="위첨자" active={editor.isActive('superscript')} onClick={() => chain().toggleSuperscript().run()}>X<sup>2</sup></Btn>
            <Btn label="아래첨자" active={editor.isActive('subscript')} onClick={() => chain().toggleSubscript().run()}>X<sub>2</sub></Btn>
            <Palette
              label="형광펜"
              colors={HIGHLIGHTS}
              current={editor.getAttributes('highlight').color as string | undefined}
              onPick={(c) => chain().setHighlight({ color: c }).run()}
              onClear={() => chain().unsetHighlight().run()}
              face={<span className="rounded px-1 text-[13px] font-bold" style={{ background: (editor.getAttributes('highlight').color as string) || '#FFF3A3' }}>가</span>}
            />
            <Sep />
            <Btn label="번호 목록" active={editor.isActive('orderedList')} onClick={() => chain().toggleOrderedList().run()}>1. 목록</Btn>
            <Btn label="인용문" active={editor.isActive('blockquote')} onClick={() => chain().toggleBlockquote().run()}>“ 인용</Btn>
            <Btn label="구분선" onClick={() => chain().setHorizontalRule().run()}>구분선</Btn>
            <Btn label="서식 지우기" onClick={() => chain().unsetAllMarks().clearNodes().run()}>서식 지우기</Btn>
            <Btn label={full ? '전체 화면 끝내기 (Esc)' : '전체 화면으로 쓰기'} active={full} onClick={() => setFull(!full)}>{full ? '⤡ 작게' : '⤢ 크게'}</Btn>
            {advanced && (
              <>
                <Sep />
                <span className="px-1 text-[11px] font-semibold text-muted">편집장</span>
                <select
                  aria-label="글자 크기"
                  value={fontSize}
                  onChange={(e) => (e.target.value ? chain().setFontSize(e.target.value).run() : chain().unsetFontSize().run())}
                  className="h-8 w-[78px] rounded border border-line bg-white px-1.5 text-[13px]"
                >
                  <option value="">크기</option>
                  {FONT_SIZES.map((s) => <option key={s} value={s}>{s.replace('px', '')}px</option>)}
                </select>
                <Palette
                  label="글자색"
                  colors={TEXT_COLORS}
                  current={editor.getAttributes('textStyle').color as string | undefined}
                  onPick={(c) => chain().setColor(c).run()}
                  onClear={() => chain().unsetColor().run()}
                  face={<span className="flex flex-col items-center leading-none"><span className="text-[13px] font-bold">가</span><span className="mt-0.5 h-[3px] w-4 rounded" style={{ background: (editor.getAttributes('textStyle').color as string) || '#E5483A' }} /></span>}
                />
                <Btn label="HTML 보기" active={source !== null} onClick={() => setSource(editor.getHTML())}>{'</>'} HTML</Btn>
              </>
            )}
          </div>
        )}

        {/* 표 안에 있을 때만 나오는 표 도구 */}
        {inTable && (
          <div className="flex flex-wrap items-center gap-0.5 rounded bg-[#EEF2F8] px-1.5 py-1 text-[12.5px]">
            <span className="mr-1 font-semibold text-[#2D6CA8]">표</span>
            <Btn label="위에 줄 추가" onClick={() => chain().addRowBefore().run()}>↑ 줄</Btn>
            <Btn label="아래에 줄 추가" onClick={() => chain().addRowAfter().run()}>↓ 줄</Btn>
            <Btn label="줄 삭제" onClick={() => chain().deleteRow().run()}>줄 삭제</Btn>
            <Sep />
            <Btn label="왼쪽에 칸 추가" onClick={() => chain().addColumnBefore().run()}>← 칸</Btn>
            <Btn label="오른쪽에 칸 추가" onClick={() => chain().addColumnAfter().run()}>→ 칸</Btn>
            <Btn label="칸 삭제" onClick={() => chain().deleteColumn().run()}>칸 삭제</Btn>
            <Sep />
            <Btn label="셀 합치기" onClick={() => chain().mergeCells().run()} disabled={!editor.can().mergeCells()}>합치기</Btn>
            <Btn label="셀 나누기" onClick={() => chain().splitCell().run()} disabled={!editor.can().splitCell()}>나누기</Btn>
            <Btn label="머리글 줄 켜고 끄기" onClick={() => chain().toggleHeaderRow().run()}>머리글</Btn>
            <Btn label="표 삭제" onClick={() => chain().deleteTable().run()}><span className="text-danger">표 삭제</span></Btn>
          </div>
        )}
      </div>

      {source !== null ? (
        <div className={`flex flex-col gap-2 p-3 ${full ? 'flex-1' : ''}`}>
          <p className="text-[12.5px] text-muted">HTML을 직접 고칠 수 있습니다. 허용되지 않는 태그·스크립트는 발행할 때 자동으로 지워집니다.</p>
          <label htmlFor="html-source" className="sr-only">HTML 원본</label>
          <textarea id="html-source" value={source} onChange={(e) => setSource(e.target.value)} spellCheck={false} className={`w-full rounded border border-line bg-[#0F1117] p-4 font-mono text-[12.5px] leading-relaxed text-[#E6E6E6] ${full ? 'flex-1' : 'min-h-[520px]'}`} />
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setSource(null)} className="btn-secondary">취소</button>
            <button type="button" onClick={applySource} className="btn-primary">편집 화면에 적용</button>
          </div>
        </div>
      ) : (
        <div className={full ? 'flex-1 overflow-y-auto' : ''}>
          <div className={full ? 'mx-auto max-w-[860px]' : ''}>
            <EditorContent editor={editor} />
          </div>
        </div>
      )}
    </div>
  )
}

function Btn({ label, active, disabled, onClick, children }: { label: string; active?: boolean; disabled?: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={`h-8 min-w-8 whitespace-nowrap rounded px-2 text-[13px] transition-colors disabled:opacity-30 ${
        active ? 'bg-ink text-white' : 'text-ink hover:bg-line/70'
      }`}
    >
      {children}
    </button>
  )
}

function Sep() {
  return <span className="mx-1 h-5 w-px bg-line" aria-hidden />
}

function AlignIcon({ kind }: { kind: 'left' | 'center' | 'right' | 'justify' }) {
  const lines = { left: [16, 10, 14], center: [16, 10, 14], right: [16, 10, 14], justify: [16, 16, 16] }[kind]
  return (
    <svg width="16" height="14" viewBox="0 0 16 14" aria-hidden>
      {lines.map((w, i) => {
        const x = kind === 'center' ? (16 - w) / 2 : kind === 'right' ? 16 - w : 0
        return <rect key={i} x={x} y={1 + i * 5} width={w} height="2" rx="1" fill="currentColor" />
      })}
    </svg>
  )
}

// 색 고르기 (글자색·형광펜)
function Palette({ label, colors, current, onPick, onClear, face }: { label: string; colors: string[]; current?: string; onPick: (c: string) => void; onClear: () => void; face: ReactNode }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="relative" onMouseLeave={() => setOpen(false)}>
      <button
        type="button"
        title={label}
        aria-label={label}
        aria-expanded={open}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => setOpen(!open)}
        className="flex h-8 min-w-8 items-center gap-0.5 rounded px-1.5 hover:bg-line/70"
      >
        {face}
        <span className="text-[9px] text-muted">▾</span>
      </button>
      {open && (
        <div className="absolute left-0 top-full z-30 w-[172px] rounded-lg border border-line bg-white p-2 shadow-lg" onMouseDown={(e) => e.preventDefault()}>
          <div className="grid grid-cols-5 gap-1.5">
            {colors.map((c) => (
              <button
                key={c}
                type="button"
                title={c}
                aria-label={`${label} ${c}`}
                onClick={() => { onPick(c); setOpen(false) }}
                className={`h-7 w-7 rounded border ${current?.toLowerCase() === c.toLowerCase() ? 'ring-2 ring-ink ring-offset-1' : 'border-black/10'}`}
                style={{ background: c }}
              />
            ))}
          </div>
          <button type="button" onClick={() => { onClear(); setOpen(false) }} className="mt-2 w-full rounded bg-line/60 py-1 text-[12px] hover:bg-line">
            {label} 없애기
          </button>
        </div>
      )}
    </div>
  )
}

// 기사에 자주 쓰는 특수문자
function Symbols({ onPick }: { onPick: (s: string) => void }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="relative" onMouseLeave={() => setOpen(false)}>
      <Btn label="특수문자" active={open} onClick={() => setOpen(!open)}>※ 특수문자</Btn>
      {open && (
        <div className="absolute left-0 top-full z-30 grid w-[276px] grid-cols-9 gap-1 rounded-lg border border-line bg-white p-2 shadow-lg" onMouseDown={(e) => e.preventDefault()}>
          {SYMBOLS.map((s) => (
            <button key={s} type="button" onClick={() => onPick(s)} className="h-7 rounded text-[14px] hover:bg-line/70" aria-label={`${s} 넣기`}>
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
