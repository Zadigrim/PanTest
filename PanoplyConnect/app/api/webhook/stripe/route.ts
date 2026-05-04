import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createServerClient } from '@supabase/ssr'
import type { Database } from '@/lib/supabase/types'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-06-20',
})

// Use service-role client so inserts bypass RLS
function createServiceClient() {
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: {
        getAll: () => [],
        setAll: () => {},
      },
    },
  )
}

async function insertAcquisition(passportId: string, userId: string): Promise<void> {
  const supabase = createServiceClient()
  const { error } = await supabase.from('acquisitions').insert({
    user_id: userId,
    passport_id: passportId,
    price_paid_cents: 0, // paid via Stripe; actual amount tracked on payment intent
  })

  if (error && error.code !== '23505') {
    // 23505 = UNIQUE violation → already owned, safe to ignore
    console.error('[stripe-webhook] acquisition insert error:', error)
  }
}

// Webhooks require the raw request body for signature verification,
// so we must NOT call request.json() — use request.text() instead.
export async function POST(request: NextRequest): Promise<NextResponse> {
  const body = await request.text()
  const signature = request.headers.get('stripe-signature')

  if (!signature) {
    return NextResponse.json({ error: 'Missing stripe-signature header' }, { status: 400 })
  }

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, signature, process.env.STRIPE_WEBHOOK_SECRET!)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[stripe-webhook] signature verification failed:', message)
    return NextResponse.json({ error: `Webhook signature invalid: ${message}` }, { status: 400 })
  }

  try {
    switch (event.type) {
      case 'payment_intent.succeeded': {
        const intent = event.data.object as Stripe.PaymentIntent
        const { passportId, userId } = intent.metadata
        if (passportId && userId) {
          await insertAcquisition(passportId, userId)
        }
        break
      }

      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        const { passportId, userId } = session.metadata ?? {}
        if (passportId && userId) {
          await insertAcquisition(passportId, userId)
        }
        break
      }

      default:
        // Unhandled event type — acknowledge and move on
        break
    }
  } catch (handlerError) {
    // Log but always return 200 so Stripe does not retry
    console.error('[stripe-webhook] handler error:', handlerError)
  }

  // Always return 200 to acknowledge receipt
  return NextResponse.json({ received: true })
}
