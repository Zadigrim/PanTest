import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function SharePage({ params }: { params: { token: string } }) {
  const supabase = await createClient()

  const { data: shareToken } = await supabase
    .from('share_tokens')
    .select('*, passport:passports(*)')
    .eq('token', params.token)
    .single()

  if (!shareToken) notFound()

  const passport = (shareToken as { passport: { cover_bg_color: string; cover_emblem: string; title: string; description: string | null } }).passport
  const bgColor = `#${passport.cover_bg_color ?? '0D1B2A'}`

  return (
    <div className="min-h-screen bg-paper flex items-center justify-center p-8">
      <div className="max-w-md w-full rounded-modal overflow-hidden shadow-xl">
        <div
          className="flex h-48 items-center justify-center text-7xl"
          style={{ backgroundColor: bgColor }}
        >
          {passport.cover_emblem ?? '🧭'}
        </div>
        <div className="bg-white px-6 py-5">
          <h1 className="font-serif text-xl font-bold text-navy">{passport.title}</h1>
          {passport.description && (
            <p className="mt-2 text-sm text-muted">{passport.description}</p>
          )}
          <div className="mt-4 rounded-card bg-cream px-4 py-3">
            <p className="text-xs text-green font-medium">Passport completed ✓</p>
          </div>
          <div className="mt-5 border-t border-hairline pt-4">
            <p className="text-xs text-muted">
              Shared via{' '}
              <span className="font-serif font-semibold text-navy">Okuji</span>
              {' '}· Real experiences, collected.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
