// IM 뉴스룸 편집국 앱: 인터넷이 끊겼을 때만 '연결 끊김' 화면을 보여준다
//   편집국 화면·기사 자료는 저장하지 않는다 (늘 서버에서 새로 받는다)
const CACHE = 'im-offline-v1'
const OFFLINE = ['/offline.html', '/brand/im-newsroom-mark.svg']

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(OFFLINE)).then(() => self.skipWaiting()))
})

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (e) => {
  const req = e.request
  if (req.method !== 'GET' || req.mode !== 'navigate') return
  e.respondWith(fetch(req).catch(() => caches.match('/offline.html')))
})
