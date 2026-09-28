import sanitizeHtml from 'sanitize-html'
import { toHtml } from './body-text'

export function sanitizeBody(body: string | null | undefined) {
  return sanitizeHtml(toHtml(body), {
    allowedTags: ['p', 'br', 'h2', 'h3', 'strong', 'b', 'em', 'i', 'u', 's', 'blockquote', 'ul', 'ol', 'li', 'a', 'img', 'figure', 'figcaption', 'hr', 'iframe', 'div'],
    allowedAttributes: {
      a: ['href', 'target', 'rel'],
      img: ['src', 'alt', 'title', 'width', 'height'],
      iframe: ['src', 'width', 'height', 'allowfullscreen', 'frameborder', 'allow'],
      p: ['style'],
      h2: ['style'],
      h3: ['style'],
      div: ['data-youtube-video'],
    },
    allowedStyles: { '*': { 'text-align': [/^(left|right|center|justify)$/] } },
    allowedSchemes: ['http', 'https', 'mailto'],
    allowedIframeHostnames: ['www.youtube.com', 'www.youtube-nocookie.com'],
    transformTags: {
      a: sanitizeHtml.simpleTransform('a', { target: '_blank', rel: 'noopener noreferrer' }),
    },
  })
}
