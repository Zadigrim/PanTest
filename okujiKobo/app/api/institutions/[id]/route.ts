import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { computePricingModel } from '@/lib/pricing'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: isAdmin } = await (supabase as any).rpc('is_platform_admin')

  // Non-admins can only update if they are an employee of this institution.
  // (SEC-02 will tighten this further in Phase 2 to require can_manage_billing
  // or can_manage_employees depending on which field is being changed.)
  if (!isAdmin) {
    const { data: auth } = await supabase
      .from('employee_authorizations')
      .select('id')
      .eq('institution_id', id)
      .eq('user_id', user.id)
      .maybeSingle()
    if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })

  // Fetch current row to fill in any missing fields for recomputation.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: current } = await (supabase as any)
    .from('institutions')
    .select('institution_type,charges_admission,municipality_population,pricing_model_locked')
    .eq('id', id)
    .single() as { data: { institution_type: string | null; charges_admission: boolean; municipality_population: number | null; pricing_model_locked: boolean } | null }

  if (!current) return NextResponse.json({ error: 'Institution not found' }, { status: 404 })

  const institution_type        = 'institution_type'        in body ? body.institution_type        : current.institution_type
  const charges_admission       = 'charges_admission'       in body ? body.charges_admission       : current.charges_admission
  const municipality_population = 'municipality_population' in body ? body.municipality_population : current.municipality_population

  const computedModel = computePricingModel(
    institution_type ?? '',
    charges_admission === true,
    typeof municipality_population === 'number' ? municipality_population : undefined,
  )

  // Admins may set a lock; non-admins cannot change lock state.
  let locked = current.pricing_model_locked
  let overrideBy: string | null = null
  let overrideAt: string | null = null
  let effectiveModel: string = computedModel

  if (isAdmin && 'pricing_model_locked' in body) {
    locked = body.pricing_model_locked === true && !!body.pricing_model_override
    if (locked) {
      effectiveModel = body.pricing_model_override
      overrideBy = user.id
      overrideAt = new Date().toISOString()
    }
  } else if (locked) {
    // Locked by admin, non-admin update — keep the current pricing_model.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: existing } = await (supabase as any)
      .from('institutions')
      .select('pricing_model,pricing_model_override_by,pricing_model_override_at')
      .eq('id', id)
      .single() as { data: { pricing_model: string; pricing_model_override_by: string | null; pricing_model_override_at: string | null } | null }
    effectiveModel = existing?.pricing_model ?? computedModel
    overrideBy = existing?.pricing_model_override_by ?? null
    overrideAt = existing?.pricing_model_override_at ?? null
  }

  // Build the update payload (only include editable fields from body).
  const allowed = [
    'name','slug','logo_url','institution_type','charges_admission',
    'municipality_population','catalog_url','contact_name','contact_email',
    'address_line1','address_city','address_state','address_zip',
    'website','internal_notes',
  ]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updates: Record<string, any> = {}
  for (const key of allowed) {
    if (key in body) updates[key] = body[key]
  }

  updates.pricing_model          = effectiveModel
  updates.pricing_model_computed = computedModel
  updates.pricing_model_locked   = locked
  updates.pricing_model_override_by  = overrideBy
  updates.pricing_model_override_at  = overrideAt

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('institutions')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    console.error('[PATCH /api/institutions/:id]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ institution: data })
}
