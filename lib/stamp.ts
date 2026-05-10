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
  stop: Pick<Stop, 'stamp_rotation_fixed' | 'stamp_rotation_range' | 'rotation'>
): StampPlacement | null {
  const boxRotationDeg = stop.rotation ?? 0
  const cx = boxLeft + boxWidth / 2
  const cy = boxTop + boxHeight / 2

  let localX: number
  let localY: number

  if (boxRotationDeg === 0) {
    localX = touchX - cx
    localY = touchY - cy
  } else {
    // Rotate touch point into box-local space (inverse of box rotation)
    const rad = (boxRotationDeg * Math.PI) / 180
    const cosR = Math.cos(-rad)
    const sinR = Math.sin(-rad)
    const dx = touchX - cx
    const dy = touchY - cy
    localX = dx * cosR - dy * sinR
    localY = dx * sinR + dy * cosR
  }

  // Center-within-box rule: touch center must be inside the (unrotated) box
  if (
    localX < -boxWidth / 2 ||
    localX > boxWidth / 2 ||
    localY < -boxHeight / 2 ||
    localY > boxHeight / 2
  ) {
    return null // outside box — silent no-op
  }

  const posX = ((localX + boxWidth / 2) / boxWidth) * 100
  const posY = ((localY + boxHeight / 2) / boxHeight) * 100

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
