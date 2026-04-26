// Stamp placement logic.
// PATENT-RELEVANT: center-within-box rule, free bleed outside.
import { supabase } from './supabase'
import type { Stop, StampPlacement } from '../types'

export function computeStampPlacement(
  touchX: number,
  touchY: number,
  boxLeft: number,
  boxTop: number,
  boxWidth: number,
  boxHeight: number,
  contactRadius: number,
  stop: Pick<Stop, 'stamp_rotation_fixed' | 'stamp_rotation_range'>
): StampPlacement | null {
  // Center point must fall within the location box bounding area
  if (
    touchX < boxLeft ||
    touchX > boxLeft + boxWidth ||
    touchY < boxTop ||
    touchY > boxTop + boxHeight
  ) {
    return null // outside box — silent no-op
  }

  const posX = ((touchX - boxLeft) / boxWidth) * 100
  const posY = ((touchY - boxTop) / boxHeight) * 100

  let rotationDeg: number
  if (stop.stamp_rotation_fixed != null) {
    rotationDeg = stop.stamp_rotation_fixed
  } else {
    const range = stop.stamp_rotation_range ?? 5
    rotationDeg = (Math.random() * 2 - 1) * range
  }

  return {
    posX,
    posY,
    contactSizePx: contactRadius * 2,
    rotationDeg,
  }
}

export function smudgeFilterId(smudge: Stop['stamp_smudge']): string {
  const map = {
    none: 'smudge-none',
    light: 'smudge-light',
    medium: 'smudge-medium',
    heavy: 'smudge-heavy',
  }
  return map[smudge]
}

export async function saveStamp(params: {
  userId: string
  stopId: string
  collectorPassportId: string
  geohash: string
  placement: StampPlacement
  verificationMethod: string
  stopOpenedAt: string
}) {
  const { data, error } = await supabase
    .from('stamps')
    .insert({
      user_id: params.userId,
      stop_id: params.stopId,
      collector_passport_id: params.collectorPassportId,
      geohash: params.geohash,
      stamp_pos_x: params.placement.posX,
      stamp_pos_y: params.placement.posY,
      contact_size_px: params.placement.contactSizePx,
      rotation_deg: params.placement.rotationDeg,
      verification_method: params.verificationMethod,
      stop_opened_at: params.stopOpenedAt,
      verified_at: new Date().toISOString(),
    })
    .select()
    .single()

  return { data, error }
}
