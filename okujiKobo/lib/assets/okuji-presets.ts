/**
 * Bundled page-background presets — the "Okuji library" group on
 * the Backgrounds tab.
 *
 * These ship as static files under /public/presets/ (the existing
 * mechanism the designer's RightInspector already uses for its
 * preset section). They are NOT rows in `design_assets`; the
 * Assets-section UI surfaces them as a synthetic "okuji-preset"
 * group with no delete / rename / scope controls so creators get
 * one consistent view of every background they can pick from.
 *
 * If you add a new preset PNG/SVG to /public/presets/, add it
 * here too — there's no auto-discovery.
 */

export interface OkujiPreset {
  /** Stable synthetic id (prefixed `pbg_*` to never collide with a
   *  real design_assets uuid). Used as a React key + drawer key. */
  id: string
  /** Friendly label shown on the card. */
  label: string
  /** Public URL of the asset file. */
  url: string
  /** Format tag for the drawer meta line. */
  format: 'PNG' | 'SVG'
}

export const OKUJI_PAGE_BACKGROUNDS: OkujiPreset[] = [
  { id: 'pbg_okuji_ground_01', label: 'Guilloche medallion',  url: '/presets/png/okuji-ground-01-guilloche-medallion.png',  format: 'PNG' },
  { id: 'pbg_okuji_ground_02', label: 'Topographic contours', url: '/presets/png/okuji-ground-02-topographic-contours.png', format: 'PNG' },
  { id: 'pbg_okuji_ground_03', label: 'Woven waves',          url: '/presets/png/okuji-ground-03-woven-waves.png',          format: 'PNG' },
  { id: 'pbg_okuji_ground_04', label: 'Trail waypoints',      url: '/presets/png/okuji-ground-04-trail-waypoints.png',      format: 'PNG' },
  { id: 'pbg_okuji_ground_05', label: 'Rosette tiling',       url: '/presets/png/okuji-ground-05-rosette-tiling.png',       format: 'PNG' },
  { id: 'pbg_okuji_ground_06', label: 'Field rule',           url: '/presets/png/okuji-ground-06-field-rule.png',           format: 'PNG' },
]
