// Shared predicate: does a stop use QR verification?
//
// Mirrors the mobile stopRequiresQr (app/passport/[id].tsx): canonical
// experience_verification_method === 'qr', with verification_tier / legacy
// evidence_tier IN (1,2) as the pre-046 fallback. GPS-only (tier 3) and honor
// (tier 5) are excluded. Used by the QR-sheet route AND the manage menu's
// enable/disable check so they agree on which stops get a code.
export interface StopVerificationFields {
  experience_verification_method?: string | null
  verification_tier?: number | null
  evidence_tier?: number | null
}

export function stopRequiresQr(s: StopVerificationFields): boolean {
  if (s.experience_verification_method != null) {
    return s.experience_verification_method === 'qr'
  }
  const tier = s.verification_tier ?? s.evidence_tier ?? 5
  return tier === 1 || tier === 2
}
