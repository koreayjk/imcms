import type { Metadata } from 'next'
import { gdpaBaseEn } from '@/lib/gdpa-server'
import { BOARD_LABEL_EN } from '@/lib/gdpa'
import { BoardList } from '@/components/gdpa/Board'

export const metadata: Metadata = { title: BOARD_LABEL_EN.activity }
export const revalidate = 60

export default async function Page(props: { searchParams: Promise<{ page?: string }> }) {
  const searchParams = await props.searchParams
  return <BoardList base={await gdpaBaseEn()} lang="en" board="activity" page={Math.max(1, Number(searchParams.page) || 1)} />
}
