import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { StartBlankButton } from '@/components/design/StartBlankButton'

export const metadata = { title: 'New Passport — OkujiDesigner' }

// ---------------------------------------------------------------------------
// Option cards
// ---------------------------------------------------------------------------

function OptionCard({
  title,
  description,
  action,
  disabled,
  disabledNote,
}: {
  title: string
  description: string
  action: React.ReactNode
  disabled?: boolean
  disabledNote?: string
}) {
  return (
    <div
      className={`flex flex-col rounded-modal border p-8 transition-shadow ${
        disabled
          ? 'border-okuji-gray-2 bg-okuji-gray-1 opacity-60'
          : 'border-okuji-gray-2 bg-white hover:shadow-md'
      }`}
    >
      <h2
        className={`text-lg font-semibold mb-2 ${
          disabled ? 'text-okuji-gray-3' : 'text-okuji-navy'
        }`}
      >
        {title}
      </h2>
      <p className="text-sm text-okuji-gray-3 leading-relaxed flex-1 mb-6">{description}</p>
      {disabled && disabledNote ? (
        <span className="inline-flex items-center rounded-panel bg-okuji-gray-2 px-4 py-2 text-sm font-medium text-okuji-gray-3 cursor-not-allowed self-start">
          {disabledNote}
        </span>
      ) : (
        action
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function DesignNewPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login?next=/design/new')

  return (
    <div className="min-h-screen bg-okuji-gray-1">
      {/* Top bar */}
      <header className="border-b border-okuji-gray-2 bg-white px-8 py-4">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl" aria-hidden="true">🧭</span>
            <span className="font-serif text-xl font-bold text-okuji-navy tracking-wide">
              OkujiDesigner
            </span>
          </div>
          <Link
            href="/design"
            className="text-sm text-okuji-gray-3 hover:text-okuji-navy transition-colors"
          >
            ← Back to my passports
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-8 py-14">
        {/* Page title */}
        <div className="mb-10 text-center">
          <h1 className="text-3xl font-bold text-okuji-navy">Start a new passport</h1>
          <p className="mt-2 text-sm text-okuji-gray-3">
            Choose how you want to begin building your experience.
          </p>
        </div>

        {/* Options grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Start from scratch */}
          <OptionCard
            title="Start from scratch"
            description="Blank passport. Your design, your stops. Full creative control from the first page."
            action={<StartBlankButton />}
          />

          {/* Import from library */}
          <OptionCard
            title="Import from library"
            description="Build around educational stops you've found. Browse the community library and import stops into a new passport."
            action={
              <Link
                href="/stops"
                className="inline-flex items-center h-10 px-5 rounded-panel border border-okuji-teal text-okuji-teal text-sm font-medium hover:bg-okuji-teal-lt transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-okuji-teal self-start"
              >
                Browse stops
                <svg
                  className="ml-1.5 h-4 w-4"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </Link>
            }
          />

          {/* Use a template — disabled */}
          <OptionCard
            title="Use a template"
            description="Pre-built framework for common destinations. Start with a tested structure and customise from there."
            disabled
            disabledNote="Templates coming soon"
          />
        </div>
      </main>
    </div>
  )
}
