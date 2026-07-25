import type { ReactNode } from 'react'

// Reading shell for the /guide/* instructional pages. Deliberately NOT inside
// any route group and importing NO AppNav — these pages carry no site chrome,
// are unlinked from anywhere, and are noindex per-page. The wordmark is plain
// lowercase text (brand rule) and links nowhere, so the shell adds no
// navigation surface that could make a guide page stumble-onto-able.
export default function GuideLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-paper text-ink">
      <header className="border-b border-hairline">
        <div className="mx-auto flex max-w-3xl items-center px-6 py-5">
          <span
            className="text-lg font-medium text-ink"
            style={{ letterSpacing: '-0.02em', fontFamily: 'var(--font-inter), Inter, system-ui, sans-serif' }}
          >
            okuji
          </span>
          <span className="ml-3 text-[13px] text-muted">field guide</span>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-6 py-10 pb-24">{children}</main>
    </div>
  )
}
