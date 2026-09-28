'use client'

import { EditorContent, useEditor, type Editor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Image from '@tiptap/extension-image'
import Link from '@tiptap/extension-link'
import Youtube from '@tiptap/extension-youtube'
import Placeholder from '@tiptap/extension-placeholder'
import Underline from '@tiptap/extension-underline'
import TextAlign from '@tiptap/extension-text-align'
import { useEffect, type ReactNode } from 'react'

type Props = {
  initialHtml: string
  onChange: (html: string, charCount: number) => void
  onReady: (editor: Editor) => void
}

export default function RichEditor({ initialHtml, onChange, onReady }: Props) {
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({ heading: { levels: [2, 3] } }),
      Underline,
      Image.configure({ inline: false }),
      Link.configure({ openOnClick: false, autolink: true }),
      Youtube.configure({ nocookie: true, width: 640, height: 360 }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Placeholder.configure({ placeholder: '기사 본문을 입력하세요' }),
    ],
    content: initialHtml,
    editorProps: { attributes: { class: 'article-content min-h-[520px] px-6 py-5 text-[16px] leading-[1.9] outline-none' } },
    onUpdate: ({ editor }) => onChange(editor.getHTML(), editor.getText().replace(/\s/g, '').length),
    onCreate: ({ editor }) => onChange(editor.getHTML(), editor.getText().replace(/\s/g, '').length),
  })

  useEffect(() => {
    if (editor) onReady(editor)
  }, [editor, onReady])

  if (!editor) return <div className="min-h-[580px] rounded border border-line bg-white" />

  const setLink = () => {
    const prev = editor.getAttributes('link').href as string | undefined
    const url = window.prompt('링크 주소를 입력하세요 (비우면 링크 삭제)', prev ?? 'https://')
    if (url === null) return
    if (!url.trim() || url === 'https://') editor.chain().focus().unsetLink().run()
    else editor.chain().focus().extendMarkRange('link').setLink({ href: url.trim() }).run()
  }

  return (
    <div className="rounded border border-line bg-white focus-within:border-ink/60">
      <div role="toolbar" aria-label="본문 서식" className="sticky top-0 z-10 flex flex-wrap items-center gap-0.5 border-b border-line bg-[#FAFBFC] px-2 py-1.5">
        <Btn label="굵게" active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()}><b>B</b></Btn>
        <Btn label="기울임" active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()}><i className="font-serif">I</i></Btn>
        <Btn label="밑줄" active={editor.isActive('underline')} onClick={() => editor.chain().focus().toggleUnderline().run()}><u>U</u></Btn>
        <Btn label="취소선" active={editor.isActive('strike')} onClick={() => editor.chain().focus().toggleStrike().run()}><s>S</s></Btn>
        <Sep />
        <Btn label="소제목" active={editor.isActive('heading', { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>소제목</Btn>
        <Btn label="작은 제목" active={editor.isActive('heading', { level: 3 })} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}>작은제목</Btn>
        <Btn label="인용" active={editor.isActive('blockquote')} onClick={() => editor.chain().focus().toggleBlockquote().run()}>“ 인용</Btn>
        <Sep />
        <Btn label="글머리 목록" active={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()}>• 목록</Btn>
        <Btn label="번호 목록" active={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()}>1. 목록</Btn>
        <Sep />
        <Btn label="왼쪽 정렬" active={editor.isActive({ textAlign: 'left' })} onClick={() => editor.chain().focus().setTextAlign('left').run()}>왼쪽</Btn>
        <Btn label="가운데 정렬" active={editor.isActive({ textAlign: 'center' })} onClick={() => editor.chain().focus().setTextAlign('center').run()}>가운데</Btn>
        <Btn label="오른쪽 정렬" active={editor.isActive({ textAlign: 'right' })} onClick={() => editor.chain().focus().setTextAlign('right').run()}>오른쪽</Btn>
        <Sep />
        <Btn label="링크" active={editor.isActive('link')} onClick={setLink}>링크</Btn>
        <Btn label="구분선" onClick={() => editor.chain().focus().setHorizontalRule().run()}>구분선</Btn>
        <Sep />
        <Btn label="되돌리기" onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()}>↶</Btn>
        <Btn label="다시 실행" onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()}>↷</Btn>
      </div>
      <EditorContent editor={editor} />
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
      className={`h-8 min-w-8 rounded px-2 text-[13px] transition-colors disabled:opacity-30 ${
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
