import { redirect } from 'next/navigation'

// Root route redirects to article list — the main CMS workspace
export default function RootPage() {
  redirect('/articles')
}
