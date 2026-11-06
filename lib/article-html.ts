import sanitizeHtml from 'sanitize-html'
import { toHtml } from './body-text'

const COLOR = /^(#[0-9a-f]{3,8}|rgba?\([\d\s,.%]+\))$/i

// 출처 표기 "(사진=○○ 제공)"가 줄 끝에서 "(사진=" 만 남기고 끊기지 않게: "=" 뒤에 줄바꿈 금지 표시(WORD JOINER)를 넣고, 괄호 안 띄어쓰기는 줄바꿈이 안 되는 공백으로 바꾼다
const CREDIT = /\((?:사진|자료|출처|제공|그래픽|일러스트|이미지|포토)\s*[=:：][^)<>]{0,80}\)/g
export function keepCredit(html: string) {
  return html.replace(CREDIT, (m) => m.replace(/([=:：])\s*/, '$1\u2060').replace(/ /g, '\u00a0'))
}

export function sanitizeBody(body: string | null | undefined) {
  return keepCredit(sanitizeHtml(toHtml(body), {
    allowedTags: ['p', 'br', 'h2', 'h3', 'h4', 'strong', 'b', 'em', 'i', 'u', 's', 'sup', 'sub', 'span', 'mark', 'blockquote', 'ul', 'ol', 'li', 'a', 'img', 'figure', 'figcaption', 'hr', 'iframe', 'div', 'video', 'table', 'colgroup', 'col', 'thead', 'tbody', 'tr', 'th', 'td'],
    allowedAttributes: {
      a: ['href', 'target', 'rel'],
      img: ['src', 'alt', 'title', 'width', 'height', 'style', 'data-align'],
      span: ['style'],
      mark: ['style', 'data-color'],
      th: ['colspan', 'rowspan', 'style'],
      td: ['colspan', 'rowspan', 'style'],
      col: ['style'],
      iframe: ['src', 'width', 'height', 'allowfullscreen', 'frameborder', 'allow'],
      p: ['style'],
      h2: ['style'],
      h3: ['style'],
      h4: ['style'],
      div: ['data-youtube-video'],
      video: ['src', 'poster', 'controls', 'preload', 'playsinline', 'width', 'height'],
    },
    // 편집기가 만드는 서식만 허용한다 (글자색·크기, 형광펜, 사진 너비, 정렬)
    allowedStyles: {
      '*': { 'text-align': [/^(left|right|center|justify)$/] },
      span: { color: [COLOR], 'font-size': [/^\d{1,2}px$/] },
      mark: { 'background-color': [COLOR], color: [/^inherit$/] },
      img: { width: [/^\d{1,3}%$/] },
    },
    allowedSchemes: ['http', 'https', 'mailto'],
    allowedSchemesAppliedToAttributes: ['href', 'src', 'cite', 'poster'],
    allowedIframeHostnames: ['www.youtube.com', 'www.youtube-nocookie.com'],
    transformTags: {
      a: sanitizeHtml.simpleTransform('a', { target: '_blank', rel: 'noopener noreferrer' }),
    },
  }))
}
