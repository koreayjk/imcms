import Link from 'next/link'

type Props = { title: string; href?: string; note?: string; as?: 'h2' | 'h3' }

export default function SectionHeading({ title, href, note, as: Tag = 'h2' }: Props) {
  return (
    <div className="mb-4 flex items-end justify-between border-b border-rule">
      <div className="-mb-px flex items-baseline gap-2 border-b-2 border-brand pb-2">
        <Tag className="text-[18px] font-bold tracking-[-0.02em] text-brand">
          {href ? <Link href={href} className="hover:underline underline-offset-4">{title}</Link> : title}
        </Tag>
        {note && <span className="text-[12px] text-sub">{note}</span>}
      </div>
      {href && (
        <Link href={href} className="pb-2 text-[12px] text-sub hover:text-brand" aria-label={`${title} 더보기`}>
          더보기 +
        </Link>
      )}
    </div>
  )
}
