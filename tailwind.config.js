/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // 기능 우선: 상태값이 한눈에 보이도록 제한된 팔레트만 사용
        ink: '#1a1a1a',
        paper: '#fafafa',
        line: '#e2e2e2',
        muted: '#6b6b6b',
        draft: '#9a8c46',      // 초안
        review: '#2d6ca8',     // 검토중
        published: '#1e7d4d',  // 발행됨
        danger: '#b3392c',
        accent: '#c41c1c',
        navy:   '#003377',
        'navy-dark': '#002255',
      },
      fontFamily: {
        sans: ['Pretendard', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        serif: ['Georgia', 'Batang', 'serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'monospace'],
      },
    },
  },
  plugins: [],
}
