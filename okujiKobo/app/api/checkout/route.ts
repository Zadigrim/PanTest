import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@/lib/supabase/server'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-06-20',
})

interface CheckoutBody {
  passportId: string
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
  let body: CheckoutBody
  try {
    body = (await request.json()) as CheckoutBody
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { passportId } = body
  if (!passportId) {
    return NextResponse.json({ error: 'passportId is required' }, { status: 400 })
  }

  // Fetch passport — must be published and not free
  const { data: passport, error: passportError } = await supabase
    .from('passports')
    .select('id, title, is_published, is_free, price_cents')
    .eq('id', passportId)
    .single()

  if (passportError || !passport) {
    return NextResponse.json({ error: 'Passport not found' }, { status: 404 })
  }

  if (!passport.is_published) {
    return NextResponse.json({ error: 'Passport is not published' }, { status: 403 })
  }

  if (passport.is_free) {
    return NextResponse.json(
      { error: 'Passport is free — use /api/acquire instead' },
      { status: 403 },
    )
  }

  if (!passport.price_cents || passport.price_cents <= 0) {
    return NextResponse.json({ error: 'Passport has no valid price' }, { status: 422 })
  }

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? ''

  // Create Stripe Checkout Session
  let session: Stripe.Checkout.Session
  try {
    session = await stripe.checkout.sessions.create({
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: passport.title,
            },
            unit_amount: passport.price_cents,
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${baseUrl}/passport/${passportId}?success=1`,
      cancel_url: `${baseUrl}/passport/${passportId}`,
      metadata: {
        passportId,
        userId: user.id,
      },
    })
  } catch (stripeError) {
    console.error('[checkout] Stripe error:', stripeError)
    return NextResponse.json({ error: 'Failed to create checkout session' }, { status: 502 })
  }

  return NextResponse.json({ url: session.url })
}
