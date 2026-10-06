import type { Metadata } from 'next'
import { gdpaBase } from '@/lib/gdpa-server'
import { boardPost } from '@/lib/gdpa-data'
import { BoardView } from '@/components/gdpa/Board'

export const revalidate = 60

export async function generateMetadata(props: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const params = await props.params
  const p = await boardPost(params.id)
  return { title: p?.title ?? '글' }
}

export default async function Page(props: { params: Promise<{ id: string }> }) {
  const params = await props.params
  return <BoardView base={(await gdpaBase())} board="notice" id={params.id} />
}
