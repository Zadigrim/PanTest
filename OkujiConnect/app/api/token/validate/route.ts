import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { CompletionToken, PrizeConfiguration } from '@/lib/supabase/types'

interface ValidateBody {
  tokenCode: string
}

interface ValidateSuccessResponse {
  valid: true
  token: CompletionToken
  prizeConfig: PrizeConfiguration | null
  collectorFirstName: string | null
}

interface ValidateFailResponse {
  valid: false
  reason: string
}

type ValidateResponse = ValidateSuccessResponse | ValidateFailResponse

export async function POST(request: NextRequest): Promise<NextResponse<ValidateResponse>> {
  const supabase = await createClient()

  // Auth check — must be an authenticated employee
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' } as unknown as ValidateFailResponse, {
      status: 401,
    })
  }

  // Parse body
  let body: ValidateBody
  try {
    body = (await request.json()) as ValidateBody
  } catch {
    return NextResponse.json(
      { valid: false, reason: 'Invalid JSON body' },
      { status: 400 },
    )
  }

  const { tokenCode } = body
  if (!tokenCode) {
    return NextResponse.json({ valid: false, reason: 'tokenCode is required' }, { status: 400 })
  }

  // Find completion token by token_code
  const { data: token, error: tokenError } = await supabase
    .from('completion_tokens')
    .select('*')
    .eq('token_code', tokenCode)
    .single()

  if (tokenError || !token) {
    return NextResponse.json({ valid: false, reason: 'Token not found' })
  }

  // Check if already redeemed
  if (token.redeemed_at !== null) {
    return NextResponse.json({ valid: false, reason: 'Token already redeemed' })
  }

  // Look up which institution owns the passport for this token
  const { data: passport, error: passportError } = await supabase
    .from('passports')
    .select('id, proprietor_id')
    .eq('id', token.passport_id)
    .single()

  if (passportError || !passport || !passport.proprietor_id) {
    return NextResponse.json(
      { valid: false, reason: 'Passport or institution not found' },
      { status: 404 },
    )
  }

  // Verify employee is authorized for this institution with can_verify = true
  const { data: authorization, error: authzError } = await supabase
    .from('employee_authorizations')
    .select('id, can_verify, institution_id')
    .eq('user_id', user.id)
    .eq('institution_id', passport.proprietor_id)
    .eq('can_verify', true)
    .single()

  if (authzError || !authorization) {
    return NextResponse.json(
      { valid: false, reason: 'Not authorized to verify tokens for this institution' },
      { status: 403 },
    )
  }

  // Fetch prize_configuration for the page
  const { data: prizeConfig } = await supabase
    .from('prize_configurations')
    .select('*')
    .eq('page_id', token.page_id)
    .eq('institution_id', passport.proprietor_id)
    .single()

  // Check location_whitelist if configured (simplified: verify institution match)
  // Full geo-fencing would compare the employee's current stop to prizeConfig.location_whitelist
  if (prizeConfig?.location_whitelist && prizeConfig.location_whitelist.length > 0) {
    const institutionId = authorization.institution_id
    if (!prizeConfig.location_whitelist.includes(institutionId)) {
      return NextResponse.json(
        { valid: false, reason: 'Employee location not in prize whitelist' },
      )
    }
  }

  // Fetch collector's display name for a friendly UI greeting
  const { data: collectorProfile } = await supabase
    .from('profiles')
    .select('display_name')
    .eq('id', token.user_id)
    .single()

  const collectorFirstName = collectorProfile?.display_name?.split(' ')[0] ?? null

  return NextResponse.json({
    valid: true,
    token,
    prizeConfig: prizeConfig ?? null,
    collectorFirstName,
  })
}
