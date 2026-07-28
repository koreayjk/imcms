'use client'

export default function ShareButton({ title }: { title: string }) {
  function share() {
    if (navigator.share) {
      navigator.share({ title, url: window.location.href }).catch(() => {})
    } else {
      navigator.clipboard.writeText(window.location.href).then(() => {
        alert('링크가 복사되었습니다.')
      }).catch(() => {})
    }
  }

  return (
    <button
      onClick={share}
      className="border border-line rounded px-2.5 py-1 text-[11px] hover:bg-line/40 transition-colors"
      aria-label="공유"
    >
      공유
    </button>
  )
}
