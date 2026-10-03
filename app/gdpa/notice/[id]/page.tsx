import type { Metadata } from 'next'
import { gdpaBase } from '@/lib/gdpa-server'
import { boardPost } from '@/lib/gdpa-data'
import { BoardView } from '@/components/gdpa/Board'

export const revalidate = 60

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const p = await boardPost(params.id)
  return { title: p?.title ?? '글' }
}

export default function Page({ params }: { params: { id: string } }) {
  return <BoardView base={gdpaBase()} board="notice" id={params.id} />
}
