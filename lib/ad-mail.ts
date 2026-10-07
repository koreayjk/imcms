import type { AdDocData } from './ad-doc'

// 광고 문서 메일: 정중한 기본 제목·본문, 메일 맨 아래 매체 정보·로고 (편집국에서 보내기 전에 고칠 수 있다)
const won = (n: number) => `${Math.round(n).toLocaleString('ko-KR')}원`
const dot = (d: string) => d.replace(/-/g, '.')
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

export function docName(kind: AdDocData['kind']) {
  return kind === 'quote' ? '광고 견적서' : '광고 게재 확인서'
}

export function defaultSubject(d: AdDocData, no: string) {
  return `[${d.outlet.name}] ${docName(d.kind)} 송부의 건 (${no})`
}

export function defaultMessage(d: AdDocData, opts: { contactName?: string | null; senderName?: string | null }) {
  const c = d.contract
  const who = `${c.receiver} ${opts.contactName ? `${opts.contactName}님` : '담당자님'}`
  const from = `${d.outlet.name}${opts.senderName ? ` ${opts.senderName}` : ''}`
  if (d.kind === 'quote') {
    return [
      `안녕하세요, ${who}.`,
      `${d.outlet.name} 광고 담당${opts.senderName ? ` ${opts.senderName}` : ''}입니다.`,
      '',
      '요청하신 광고 견적서를 PDF 파일로 첨부해 보내드립니다.',
      '',
      `· 광고 내용: ${c.title}`,
      ...(c.slots ? [`· 광고 자리: ${c.slots}`] : []),
      `· 게재 기간: ${dot(c.startsOn)} ~ ${dot(c.endsOn)}`,
      `· 견적 금액: ${won(c.total)}${c.vat ? ' (부가세 포함)' : ''}`,
      '',
      '첨부한 견적서를 확인해 보시고, 궁금하신 점이나 진행 여부를 회신해 주시면 바로 안내해 드리겠습니다.',
      '좋은 인연으로 함께할 수 있기를 바랍니다.',
      '',
      '감사합니다.',
      `${from} 드림`,
    ].join('\n')
  }
  const views = (d.stats ?? []).reduce((n, s) => n + s.views, 0)
  const clicks = (d.stats ?? []).reduce((n, s) => n + s.clicks, 0)
  return [
    `안녕하세요, ${who}.`,
    `${d.outlet.name} 광고 담당${opts.senderName ? ` ${opts.senderName}` : ''}입니다.`,
    '',
    `${d.outlet.name}에 게재한 광고의 게재 확인서를 PDF 파일로 첨부해 보내드립니다.`,
    '',
    `· 광고 내용: ${c.title}`,
    `· 게재 기간: ${dot(c.startsOn)} ~ ${dot(c.endsOn)}`,
    ...(views ? [`· 노출 ${views.toLocaleString()}회 · 클릭 ${clicks.toLocaleString()}회`] : []),
    '',
    '저희 매체에 광고를 맡겨 주셔서 진심으로 감사드립니다.',
    '확인해 보시고 궁금하신 점은 언제든 회신해 주세요. 다음에도 좋은 기회로 함께하기를 바랍니다.',
    '',
    '감사합니다.',
    `${from} 드림`,
  ].join('\n')
}

// 메일 맨 아래 매체 정보 (로고가 있으면 함께). logoUrl 은 http(s)로 시작하는 전체 주소
export function signatureHtml(d: AdDocData, logoUrl: string | null) {
  const s = d.supplier
  const rows = [
    s.company !== d.outlet.name ? s.company : '',
    [s.ceo && `대표 ${s.ceo}`, s.bizNo && `사업자등록번호 ${s.bizNo}`].filter(Boolean).join(' · '),
    s.address,
    [s.phone && `전화 ${s.phone}`, s.email && `이메일 ${s.email}`].filter(Boolean).join(' · '),
  ].filter(Boolean)
  const site = d.outlet.domain ? `https://${d.outlet.domain}` : ''
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:28px;border-top:2px solid ${esc(d.outlet.brand || '#1F3A5F')};padding-top:14px;font-family:-apple-system,'Apple SD Gothic Neo','Malgun Gothic',sans-serif"><tr>`
    + (logoUrl ? `<td style="padding:14px 16px 0 0;vertical-align:top"><img src="${esc(logoUrl)}" alt="${esc(d.outlet.name)}" height="40" style="display:block;height:40px;width:auto;border:0"></td>` : '')
    + `<td style="padding-top:14px;vertical-align:top;font-size:12.5px;line-height:1.65;color:#555">`
    + `<div style="font-size:15px;font-weight:700;color:${esc(d.outlet.brand || '#111')}">${esc(d.outlet.name)}</div>`
    + rows.map((r) => `<div>${esc(r)}</div>`).join('')
    + (site ? `<div><a href="${esc(site)}" style="color:${esc(d.outlet.brand || '#1F3A5F')};text-decoration:none">${esc(d.outlet.domain!)}</a></div>` : '')
    + `</td></tr></table>`
}

export function signatureText(d: AdDocData) {
  const s = d.supplier
  return ['──────────', d.outlet.name, s.company !== d.outlet.name ? s.company : '', [s.ceo && `대표 ${s.ceo}`, s.bizNo && `사업자등록번호 ${s.bizNo}`].filter(Boolean).join(' · '), s.address, [s.phone, s.email].filter(Boolean).join(' · '), d.outlet.domain ?? '']
    .filter(Boolean).join('\n')
}
