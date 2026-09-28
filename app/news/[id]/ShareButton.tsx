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
      type="button"
      className="rounded-full border border-rule px-3.5 py-1.5 text-[12.5px] text-sub transition-colors hover:border-brand hover:text-brand"
    >
      공유
    </button>
  )
}
