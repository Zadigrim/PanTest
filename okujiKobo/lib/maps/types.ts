// Shared shape that EVERY place lookup produces, regardless of source
// (browser Places API or server Geocoding API). The designer and the
// seeder both consume this — so the parser lives in lib/maps/parse.ts
// once and produces this same shape from either Google response.

export interface ResolvedPlace {
  /** Google's formatted_address — the "human-readable" line. */
  formatted_address: string | null
  /** The place's display name. From Places API; null from raw Geocoding. */
  name: string | null
  /** Google place_id — useful for de-dupe / re-lookup later. Optional. */
  place_id: string | null
  /** Address parts, mapped to the stop schema columns. All optional. */
  street:  string | null
  city:    string | null
  state:   string | null
  zip:     string | null
  country: string | null
  /** Coordinates. Required — both surfaces only return a place if it
   *  has a geometry.location. */
  lat: number
  lng: number
}
