'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { ComponentProps, MouseEvent } from 'react'
import { markRestore, recalledSearch } from '@/lib/list-memory'

// 목록으로 가는 링크: 눌렀을 때 그 목록에서 마지막에 보던 쪽 번호·검색 조건·스크롤 자리로 돌아간다
//   when=false 이면 평범한 링크 (왼쪽 메뉴에서 이미 목록 화면에 있을 때는 처음으로 가도록)
type Props = Omit<ComponentProps<typeof Link>, 'href'> & { href: string; when?: boolean }

export default function BackLink({ href, when = true, onClick, children, ...rest }: Props) {
  const router = useRouter()
  function go(e: MouseEvent<HTMLAnchorElement>) {
    onClick?.(e)
    if (e.defaultPrevented || !when) return
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return
    const search = recalledSearch(href)
    if (!search) return // 기억한 조건이 없으면 평범하게 이동
    e.preventDefault()
    markRestore()
    router.push(href + search)
  }
  return <Link href={href} onClick={go} {...rest}>{children}</Link>
}
