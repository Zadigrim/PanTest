export interface StampAsset {
  id: string
  name: string | null
  url: string | null
  thumbnail_data: string | null
  file_format: string | null
  is_monochrome: boolean | null
  institution_id: string | null
  owner_id: string
}
