import sanitizeHtml from 'sanitize-html'
import { toHtml } from './body-text'

const COLOR = /^(#[0-9a-f]{3,8}|rgba?\([\d\s,.%]+\))$/i

export function sanitizeBody(body: string | null | undefined) {
  return sanitizeHtml(toHtml(body), {
    allowedTags: ['p', 'br', 'h2', 'h3', 'h4', 'strong', 'b', 'em', 'i', 'u', 's', 'sup', 'sub', 'span', 'mark', 'blockquote', 'ul', 'ol', 'li', 'a', 'img', 'figure', 'figcaption', 'hr', 'iframe', 'div', 'table', 'colgroup', 'col', 'thead', 'tbody', 'tr', 'th', 'td'],
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
    },
    // 편집기가 만드는 서식만 허용한다 (글자색·크기, 형광펜, 사진 너비, 정렬)
    allowedStyles: {
      '*': { 'text-align': [/^(left|right|center|justify)$/] },
      span: { color: [COLOR], 'font-size': [/^\d{1,2}px$/] },
      mark: { 'background-color': [COLOR], color: [/^inherit$/] },
      img: { width: [/^\d{1,3}%$/] },
    },
    allowedSchemes: ['http', 'https', 'mailto'],
    allowedIframeHostnames: ['www.youtube.com', 'www.youtube-nocookie.com'],
    transformTags: {
      a: sanitizeHtml.simpleTransform('a', { target: '_blank', rel: 'noopener noreferrer' }),
    },
  })
}
