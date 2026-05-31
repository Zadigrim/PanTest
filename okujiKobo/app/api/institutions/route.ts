import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { computePricingModel, isAdmissionDependent } from '@/lib/pricing'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Only platform admins may create institutions via this route.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: isAdmin } = await (supabase as any).rpc('is_platform_admin')
  if (!isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })

  const {
    name,
    institution_type,
    charges_admission,
    municipality_population,
    pricing_model_override,
    pricing_model_locked,
    // contact / address fields
    contact_name,
    contact_email,
    website,
    address_line1,
    address_city,
    address_state,
    address_zip,
    internal_notes,
    // tier is the org-category axis (Appendix L); set manually here at
    // create time so a newly-provisioned institution isn't stuck on the
    // default 'pending' until someone remembers to edit it. tier and
    // pricing_model are independent — the pricing_model computation
    // below is unchanged.
    tier,
  } = body

  if (!name || typeof name !== 'string') {
    return NextResponse.json({ error: 'name is required' }, { status: 400 })
  }

  const computedModel = computePricingModel(
    institution_type ?? '',
    charges_admission === true,
    typeof municipality_population === 'number' ? municipality_population : undefined,
  )

  const locked = pricing_model_locked === true && !!pricing_model_override
  const effectiveModel = locked ? pricing_model_override : computedModel

  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('institutions')
    .insert({
      name: name.trim(),
      slug,
      institution_type: institution_type ?? null,
      charges_admission: charges_admission === true,
      municipality_population: typeof municipality_population === 'number' ? municipality_population : null,
      pricing_model: effectiveModel,
      pricing_model_computed: computedModel,
      pricing_model_locked: locked,
      pricing_model_override_by: locked ? user.id : null,
      pricing_model_override_at: locked ? new Date().toISOString() : null,
      contact_name: contact_name ?? null,
      contact_email: contact_email ?? null,
      website: website ?? null,
      address_line1: address_line1 ?? null,
      address_city: address_city ?? null,
      address_state: address_state ?? null,
      address_zip: address_zip ?? null,
      internal_notes: internal_notes ?? null,
      // tier defaults to 'pending' at the DB layer if omitted; we only
      // pass it through when the create form supplied a value. The
      // CHECK constraint rejects any value outside the allowed set.
      ...(typeof tier === 'string' ? { tier } : {}),
    })
    .select()
    .single()

  if (error) {
    console.error('[POST /api/institutions]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ institution: data }, { status: 201 })
}
