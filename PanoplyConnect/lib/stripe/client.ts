import Stripe from 'stripe'

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-06-20',
})

// Revenue split for paid passport acquisitions
export const CREATOR_SHARE = 0.70  // 70% to creator
export const PANOPLY_SHARE = 0.30  // 30% to Panoply (Stripe fee comes from this)

// Tips: 100% to creator. Panoply retains ZERO.
// Stripe processing fee (~2.9% + $0.30) is deducted from the tip amount before transfer.
export function tipTransferAmount(amountCents: number): number {
  const stripeFee = Math.ceil(amountCents * 0.029 + 30)
  return amountCents - stripeFee
}
