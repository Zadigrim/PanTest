// Passport collections — shared types (migration 111).
import type { DesignerPassport } from '@/lib/design/types'

export type CollectionStatus = 'draft' | 'published' | 'archived'

export interface PassportCollection {
  id: string
  owner_id: string
  institution_id: string | null
  slug: string
  title: string
  subtitle: string | null
  description: string | null
  cover_asset_id: string | null
  status: CollectionStatus
  is_okuji_official: boolean
  edition_label: string | null
  sort_order: number
  created_at: string
  updated_at: string
  published_at: string | null
}

export interface CollectionItem {
  collection_id: string
  passport_id: string
  position: number
}

export type RewardKind = 'count' | 'all'

export interface CollectionReward {
  id: string
  collection_id: string
  kind: RewardKind
  required_count: number | null
  badge_key: string
  title: string
  description: string | null
  badge_asset_id: string | null
  created_at: string
}

// A member passport as shown in the editor (a subset of DesignerPassport).
export type MemberPassport = Pick<DesignerPassport, 'id' | 'title' | 'status'>
