import type { SiteConfig } from './sites'
import { esc } from './mail'
import { formatDate } from './format'

// 뉴스레터 메일 본문 (매체 색·이름, 머리말, 기사 목록, 수신거부)
export type NewsletterArticle = { id: string; title: string; excerpt: string | null; thumbnail_url: string | null; published_at: string | null; category?: string | null }

export function newsletterMail(o: { site: Pick<SiteConfig, 'name' | 'colors' | 'slogan'>; baseUrl: string; subject: string; intro: string; articles: NewsletterArticle[]; unsubscribeUrl: string; legalLine: string }) {
  const brand = o.site.colors.brand
  const link = (id: string) => `${o.baseUrl}/news/${id}`
  const items = o.articles.map((a) => `
<tr><td style="padding:18px 0;border-top:1px solid #E6E8EB">
  <a href="${esc(link(a.id))}" style="text-decoration:none;color:#14171C">
    ${a.thumbnail_url ? `<img src="${esc(a.thumbnail_url)}" alt="" width="536" style="display:block;width:100%;max-width:536px;height:auto;border-radius:6px;margin-bottom:12px">` : ''}
    ${a.category ? `<div style="font-size:12px;font-weight:700;color:${esc(brand)};margin-bottom:4px">${esc(a.category)}</div>` : ''}
    <div style="font-size:18px;font-weight:800;line-height:1.45">${esc(a.title)}</div>
    ${a.excerpt ? `<div style="margin-top:6px;font-size:14px;line-height:1.65;color:#5B616B">${esc(a.excerpt.slice(0, 160))}</div>` : ''}
    ${a.published_at ? `<div style="margin-top:6px;font-size:12px;color:#8A9099">${esc(formatDate(a.published_at))}</div>` : ''}
  </a>
</td></tr>`).join('')
  const html = `<!doctype html><html lang="ko"><body style="margin:0;background:#F4F5F7;font-family:-apple-system,'Apple SD Gothic Neo','Malgun Gothic',sans-serif;color:#14171C">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:20px 10px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#fff;border-radius:10px;overflow:hidden">
<tr><td style="background:${esc(brand)};padding:22px 32px"><a href="${esc(o.baseUrl)}" style="color:#fff;text-decoration:none;font-size:22px;font-weight:800">${esc(o.site.name)}</a>${o.site.slogan ? `<div style="color:rgba(255,255,255,.8);font-size:12px;margin-top:4px">${esc(o.site.slogan)}</div>` : ''}</td></tr>
<tr><td style="padding:26px 32px 6px">
  <div style="font-size:21px;font-weight:800;line-height:1.4">${esc(o.subject)}</div>
  ${o.intro ? `<div style="margin-top:12px;font-size:15px;line-height:1.75;color:#3B4048;white-space:pre-line">${esc(o.intro)}</div>` : ''}
</td></tr>
<tr><td style="padding:6px 32px 20px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0">${items}</table></td></tr>
<tr><td style="padding:18px 32px 26px;background:#F8F9FA;font-size:12px;line-height:1.7;color:#8A9099">
  ${esc(o.legalLine)}<br>
  이 메일은 ${esc(o.site.name)} 뉴스레터 구독을 신청하신 분께 보내 드립니다. 더 받지 않으려면 <a href="${esc(o.unsubscribeUrl)}" style="color:#5B616B">수신거부</a>를 눌러 주세요.
</td></tr>
</table></td></tr></table></body></html>`
  const text = [
    o.site.name, '', o.subject, '', o.intro, '',
    ...o.articles.flatMap((a) => [`■ ${a.title}`, link(a.id), '']),
    o.legalLine, `수신거부: ${o.unsubscribeUrl}`,
  ].join('\n')
  return { html, text }
}

// 뉴스레터 하단 표기 (발행인·주소·연락처)
export function legalLine(site: Pick<SiteConfig, 'name' | 'legal'>) {
  const l = site.legal
  return [l.company || site.name, l.publisher && `발행인 ${l.publisher}`, l.address, l.phone, l.email].filter(Boolean).join(' · ')
}
