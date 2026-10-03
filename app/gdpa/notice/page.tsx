import type { Metadata } from 'next'
import { gdpaBase } from '@/lib/gdpa-server'
import { BOARD_LABEL } from '@/lib/gdpa'
import { BoardList } from '@/components/gdpa/Board'

export const metadata: Metadata = { title: BOARD_LABEL.notice }
export const revalidate = 60

export default function Page({ searchParams }: { searchParams: { page?: string } }) {
  return <BoardList base={gdpaBase()} board="notice" page={Math.max(1, Number(searchParams.page) || 1)} />
}
