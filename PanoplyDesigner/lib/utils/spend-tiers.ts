import type { SpendTier } from '@/lib/supabase/types'

export const SPEND_TIERS: { value: SpendTier; label: string; range: string }[] = [
  { value: 'free',      label: 'Free',         range: '$0 — no money required' },
  { value: 'under_15',  label: 'Under $15',    range: 'Under $15 per person' },
  { value: '15_50',     label: '$15 – $50',    range: '$15–50 per person' },
  { value: '50_150',    label: '$50 – $150',   range: '$50–150 per person' },
  { value: '150_500',   label: '$150 – $500',  range: '$150–500 per person' },
  { value: '500_plus',  label: '$500+',        range: '$500+ per person' },
]

export function spendTierLabel(tier: SpendTier | null): string {
  return SPEND_TIERS.find((t) => t.value === tier)?.label ?? 'Not set'
}
