import Image from 'next/image'
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
          ? 'border-hairline bg-paper opacity-60'
          : 'border-hairline bg-white hover:shadow-md'
      }`}
    >
      <h2
        className={`text-lg font-semibold mb-2 ${
          disabled ? 'text-muted' : 'text-navy'
        }`}
      >
        {title}
      </h2>
      <p className="text-sm text-muted leading-relaxed flex-1 mb-6">{description}</p>
      {disabled && disabledNote ? (
        <span className="inline-flex items-center rounded-panel bg-hairline px-4 py-2 text-sm font-medium text-muted cursor-not-allowed self-start">
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
    <div className="min-h-screen bg-paper">
      {/* Top bar */}
      <header className="border-b border-hairline bg-white px-8 py-4">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <div className="flex items-center gap-3">
            <Image
              src="/appicon/png-rounded/okuji-icon-rounded-180.png"
              alt=""
              width={32}
              height={32}
              className="h-8 w-8 rounded-[7px]"
              aria-hidden="true"
            />
            <span className="font-serif text-xl font-bold text-navy tracking-wide">
              OkujiDesigner
            </span>
          </div>
          <Link
            href="/design"
            className="text-sm text-muted hover:text-navy transition-colors"
          >
            ← Back to my passports
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-8 py-14">
        {/* Page title */}
        <div className="mb-10 text-center">
          <h1 className="text-3xl font-bold text-navy">Start a new passport</h1>
          <p className="mt-2 text-sm text-muted">
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
                className="inline-flex items-center h-10 px-5 rounded-panel border border-green text-green text-sm font-medium hover:bg-cream transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green self-start"
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
