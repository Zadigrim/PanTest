import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import type { CreatorCertification, CertModule } from '@/lib/supabase/types'

const MODULES: { id: CertModule; title: string; description: string; icon: string; duration: string }[] = [
  {
    id: 'backgrounds',
    title: 'Backgrounds & Texture',
    description: 'Master guilloche patterns, paper colors, and grain overlays to create distinctive passport aesthetics.',
    icon: '🎨',
    duration: '~20 min',
  },
  {
    id: 'typography',
    title: 'Typography & Layout',
    description: 'Learn how to compose section titles, taglines, and prize text for maximum clarity and charm.',
    icon: '✍️',
    duration: '~15 min',
  },
  {
    id: 'stamps',
    title: 'Stamp Design',
    description: 'Choose icons, colors, smudge effects, and rotation ranges that feel authentic and tactile.',
    icon: '📮',
    duration: '~25 min',
  },
  {
    id: 'architecture',
    title: 'Passport Architecture',
    description: 'Structure pages, stops, and evidence tiers for clarity. Learn about the LocationBox patent-pending system.',
    icon: '🏗',
    duration: '~30 min',
  },
  {
    id: 'covers',
    title: 'Cover Design',
    description: 'Create compelling covers that signal the experience inside — using emblems, paper colors, and templates.',
    icon: '📔',
    duration: '~20 min',
  },
]

export default async function CertificationsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: certs } = await supabase
    .from('creator_certifications')
    .select('*')
    .eq('user_id', user.id)

  const completedModules = new Set(
    (certs ?? [])
      .filter((c: CreatorCertification) => c.completed_at != null)
      .map((c: CreatorCertification) => c.module),
  )

  return (
    <div className="min-h-screen bg-panoply-gray-1">
      <header className="border-b border-panoply-gray-2 bg-white px-8 py-4">
        <div className="mx-auto flex max-w-4xl items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/dashboard" className="text-sm text-panoply-gray-3 hover:text-panoply-navy transition-colors">
              ← Dashboard
            </Link>
            <span className="text-panoply-gray-2">·</span>
            <span className="font-semibold text-panoply-navy">Creator Certifications</span>
          </div>
          <span className="text-sm text-panoply-gray-3">
            {completedModules.size} / {MODULES.length} completed
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-8 py-10">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-panoply-navy">Creator Certifications</h1>
          <p className="mt-2 text-sm text-panoply-gray-3">
            Complete these short learning modules to unlock advanced features and verify your design expertise.
          </p>
        </div>

        {/* Progress bar */}
        <div className="mb-8 rounded-panel border border-panoply-gray-2 bg-white p-5">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-sm font-semibold text-panoply-navy">Overall progress</span>
            <span className="text-sm font-bold text-panoply-teal">
              {completedModules.size}/{MODULES.length}
            </span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-panoply-gray-2">
            <div
              className="h-full rounded-full bg-panoply-teal transition-all"
              style={{ width: `${(completedModules.size / MODULES.length) * 100}%` }}
            />
          </div>
          {completedModules.size === MODULES.length && (
            <p className="mt-3 text-sm font-semibold text-panoply-teal-dk">
              🎓 Certified Creator — all modules complete!
            </p>
          )}
        </div>

        {/* Module cards */}
        <div className="grid gap-4 md:grid-cols-2">
          {MODULES.map((mod) => {
            const done = completedModules.has(mod.id)
            return (
              <div
                key={mod.id}
                className={`rounded-panel border bg-white p-5 transition-shadow hover:shadow-md ${
                  done ? 'border-panoply-teal/40' : 'border-panoply-gray-2'
                }`}
              >
                <div className="flex items-start gap-3">
                  <span className="text-2xl">{mod.icon}</span>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-panoply-navy">{mod.title}</h3>
                      {done && (
                        <span className="rounded-full bg-panoply-teal-lt px-2 py-0.5 text-xs font-medium text-panoply-teal-dk">
                          ✓ Done
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-sm text-panoply-gray-3">{mod.description}</p>
                    <div className="mt-3 flex items-center justify-between">
                      <span className="text-xs text-panoply-gray-3">{mod.duration}</span>
                      <button
                        disabled
                        className="rounded-card border border-panoply-gray-2 px-3 py-1 text-xs text-panoply-gray-3 cursor-not-allowed opacity-60"
                        title="Coming soon"
                      >
                        {done ? 'Review' : 'Start'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </main>
    </div>
  )
}
