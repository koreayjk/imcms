import type { Metadata } from 'next'
import { gdpaBaseEn } from '@/lib/gdpa-server'
import { boardPost } from '@/lib/gdpa-data'
import { BoardView } from '@/components/gdpa/Board'

export const revalidate = 60

export async function generateMetadata(props: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const params = await props.params
  const p = await boardPost(params.id)
  return { title: p?.title ?? 'Post' }
}

export default async function Page(props: { params: Promise<{ id: string }> }) {
  const params = await props.params
  return <BoardView base={await gdpaBaseEn()} lang="en" board="notice" id={params.id} />
}
