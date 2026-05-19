// TODO: Stripe Connect onboarding — creatorStripeConnectId must be set on profile.stripe_connect_account_id
// before transfers work. 100% of tip (minus Stripe fee) goes to creator. Okuji retains zero.

import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@/lib/supabase/server'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-06-20',
})

interface TipBody {
  passportId: string
  amountCents: number
  note?: string
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const supabase = await createClient()

  // Auth check
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Parse body
  let body: TipBody
  try {
    body = (await request.json()) as TipBody
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { passportId, amountCents, note } = body

  if (!passportId) {
    return NextResponse.json({ error: 'passportId is required' }, { status: 400 })
  }

  if (!amountCents || amountCents <= 0) {
    return NextResponse.json({ error: 'amountCents must be greater than 0' }, { status: 400 })
  }

  // Fetch passport to get creator_id and verify it exists
  const { data: passport, error: passportError } = await supabase
    .from('passports')
    .select('id, creator_id')
    .eq('id', passportId)
    .single()

  if (passportError || !passport) {
    return NextResponse.json({ error: 'Passport not found' }, { status: 404 })
  }

  // Fetch creator profile to check for Stripe Connect account
  const { data: creatorProfile } = await supabase
    .from('profiles')
    .select('stripe_connect_account_id')
    .eq('id', passport.creator_id)
    .single()

  const creatorStripeConnectId = creatorProfile?.stripe_connect_account_id ?? null

  // Create Stripe PaymentIntent
  // TODO: Stripe Connect onboarding — when creatorStripeConnectId is set,
  // add transfer_data: { destination: creatorStripeConnectId } to route 100%
  // of tip (minus Stripe fee) directly to the creator. Okuji retains zero.
  let paymentIntent: Stripe.PaymentIntent
  try {
    const intentParams: Stripe.PaymentIntentCreateParams = {
      amount: amountCents,
      currency: 'usd',
      metadata: {
        passportId,
        fromUserId: user.id,
        creatorId: passport.creator_id,
        type: 'tip',
      },
    }

    if (creatorStripeConnectId) {
      // Connect transfer: 100% of tip goes to creator, Okuji retains zero
      intentParams.transfer_data = { destination: creatorStripeConnectId }
    }
    // else: mock mode — no transfer until creator completes Connect onboarding

    paymentIntent = await stripe.paymentIntents.create(intentParams)
  } catch (stripeError) {
    console.error('[tip] Stripe error:', stripeError)
    return NextResponse.json({ error: 'Failed to create payment intent' }, { status: 502 })
  }

  // Insert tip record into database
  const { error: tipError } = await supabase.from('tips').insert({
    from_user_id: user.id,
    passport_id: passportId,
    creator_id: passport.creator_id,
    amount_cents: amountCents,
    stripe_payment_intent_id: paymentIntent.id,
    note: note ?? null,
  })

  if (tipError) {
    console.error('[tip] DB insert error:', tipError)
    // Payment intent was created; do not fail the client — log and continue
  }

  return NextResponse.json({ clientSecret: paymentIntent.client_secret })
}
