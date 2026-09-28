/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        ink: '#1a1a1a',
        paper: '#fafafa',
        line: '#e2e2e2',
        muted: '#6b6b6b',
        draft: '#9a8c46',
        review: '#2d6ca8',
        published: '#1e7d4d',
        danger: '#b3392c',
        // 공개 사이트: 매체별 색상은 SiteFrame에서 CSS 변수로 주입
        brand: 'var(--brand)',
        'brand-dark': 'var(--brand-dark)',
        gold: 'var(--gold)',
        'gold-ink': 'var(--gold-ink)',
        soft: '#F3F6F4',
        rule: '#E3E7E4',
        body: '#1C1F1D',
        sub: '#5F6661',
      },
      fontFamily: {
        sans: ['Pretendard Variable', 'Pretendard', '-apple-system', 'BlinkMacSystemFont', 'Apple SD Gothic Neo', 'Malgun Gothic', 'sans-serif'],
        serif: ['Georgia', 'Times New Roman', 'serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'monospace'],
      },
    },
  },
  plugins: [],
}
