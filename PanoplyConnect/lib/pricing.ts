// Single authoritative source for pricing model logic.
// Import from here — never duplicate this logic elsewhere.

export type PricingModel =
  | 'free'
  | 'paid_passport'
  | 'community'
  | 'regional'
  | 'enterprise'
  | 'patron'

export type InstitutionType =
  | 'k12_school'
  | 'public_library'
  | 'museum'
  | 'educational_nonprofit'
  | 'after_school_program'
  | 'literacy_organization'
  | 'youth_development'
  | 'homeschool_cooperative'
  | 'historical_society'
  | 'heritage_organization'
  | 'cultural_center'
  | 'oral_history_project'
  | 'community_theater'
  | 'public_art_organization'
  | 'community_arts_center'
  | 'community_music_program'
  | 'writing_center'
  | 'food_bank'
  | 'homeless_shelter'
  | 'refugee_immigrant_services'
  | 'free_health_clinic'
  | 'adult_literacy'
  | 'community_garden'
  | 'maker_space'
  | 'tool_lending_library'
  | 'seed_library'
  | 'municipality'
  | 'parks_department'
  | 'nature_conservatory'
  | 'land_trust'
  | 'watershed_council'
  | 'native_plant_society'
  | 'wildlife_rehabilitation'
  | 'environmental_education'
  | 'zoo'
  | 'aquarium'
  | 'botanical_garden'
  | 'science_museum'
  | 'childrens_museum'
  | 'nature_center'
  | 'chamber_of_commerce'
  | 'local_tourism_board'
  | 'state_tourism_board'
  | 'convention_bureau'
  | 'proprietor'
  | 'hotel_group_small'
  | 'hotel_chain'
  | 'airline'
  | 'expo_organizer'
  | 'national_tourism_org'
  | 'theme_park'
  | 'cruise_line'
  | 'corporate_sponsor'
  | 'foundation'
  | 'other'

const FREE_TYPES: string[] = [
  'k12_school', 'public_library', 'museum', 'educational_nonprofit',
  'after_school_program', 'literacy_organization', 'youth_development',
  'homeschool_cooperative', 'historical_society', 'heritage_organization',
  'cultural_center', 'oral_history_project', 'community_theater',
  'public_art_organization', 'community_arts_center', 'community_music_program',
  'writing_center', 'food_bank', 'homeless_shelter', 'refugee_immigrant_services',
  'free_health_clinic', 'adult_literacy', 'community_garden', 'maker_space',
  'tool_lending_library', 'seed_library', 'parks_department', 'nature_conservatory',
  'land_trust', 'watershed_council', 'native_plant_society', 'wildlife_rehabilitation',
  'environmental_education',
  // Legacy aliases
  'school', 'library', 'park', 'nonprofit',
]

// Nature and science types where admission answer determines pricing
const ADMISSION_DEPENDENT_TYPES: string[] = [
  'zoo', 'aquarium', 'botanical_garden', 'science_museum', 'childrens_museum', 'nature_center',
  'nature_center_paid', // legacy alias
]

const COMMUNITY_TYPES: string[] = [
  'chamber_of_commerce', 'local_tourism_board', 'proprietor', 'hotel_group_small',
  'tourism_board', // legacy alias
]

const REGIONAL_TYPES: string[] = [
  'state_tourism_board', 'convention_bureau',
]

const ENTERPRISE_TYPES: string[] = [
  'hotel_chain', 'airline', 'expo_organizer', 'national_tourism_org',
  'theme_park', 'cruise_line',
]

const PATRON_TYPES: string[] = [
  'corporate_sponsor', 'foundation',
]

export function computePricingModel(
  institutionType: string,
  chargesAdmission = false,
  municipalityPopulation?: number,
): PricingModel {
  if (institutionType === 'municipality') {
    return municipalityPopulation && municipalityPopulation > 25000 ? 'community' : 'free'
  }
  if (FREE_TYPES.includes(institutionType)) return 'free'
  if (ADMISSION_DEPENDENT_TYPES.includes(institutionType)) {
    return chargesAdmission ? 'paid_passport' : 'free'
  }
  if (COMMUNITY_TYPES.includes(institutionType)) return 'community'
  if (REGIONAL_TYPES.includes(institutionType)) return 'regional'
  if (ENTERPRISE_TYPES.includes(institutionType)) return 'enterprise'
  if (PATRON_TYPES.includes(institutionType)) return 'patron'
  return 'community'
}

/** Returns true when the institution type needs an admission question. */
export function isAdmissionDependent(institutionType: string): boolean {
  return ADMISSION_DEPENDENT_TYPES.includes(institutionType)
}

export const PRICING_MODEL_LABELS: Record<PricingModel, string> = {
  free:          'Free forever',
  paid_passport: 'Paid passport model — 70% to institution',
  community:     'Community — $200 to $999/month',
  regional:      'Regional — $1,000 to $5,000/month',
  enterprise:    'Enterprise — $5,000 to $25,000/month',
  patron:        'Patron — negotiated rate',
}

export const PRICING_MODEL_DESCRIPTIONS: Record<PricingModel, string> = {
  free:
    'No cost. No credit card. No expiration. '
    + 'Full platform access funded by commercial tiers.',
  paid_passport:
    'No subscription fee. Institution keeps 70% of every passport sold. '
    + 'Panoply keeps 30%. Only pay when you earn.',
  community:
    'For small to mid-size commercial operators. '
    + 'McMenamins-type proprietors, local chambers, small tourism boards.',
  regional:
    'For large city tourism boards, state tourism organizations, '
    + 'convention bureaus, and regional destination marketing organizations.',
  enterprise:
    'For large hotel chains, airlines, major expo organizers, '
    + 'and national tourism organizations operating at scale.',
  patron:
    'For organizations funding community access for others. '
    + 'Sponsors free tier access in their region. '
    + 'Receives aggregate behavioral data and regional attribution.',
}

export const PRICING_BADGE_COLORS: Record<PricingModel, string> = {
  free:          'bg-[#1D9E75] text-white',
  paid_passport: 'bg-[#2D5A8E] text-white',
  community:     'bg-[#EF9F27] text-white',
  regional:      'bg-[#D85A30] text-white',
  enterprise:    'bg-[#7F77DD] text-white',
  patron:        'bg-[#C8A060] text-white',
}

/** Grouped institution types for dropdowns, in display order. */
export const INSTITUTION_TYPE_GROUPS: { label: string; types: string[] }[] = [
  {
    label: 'Educational',
    types: ['k12_school', 'public_library', 'museum', 'educational_nonprofit',
      'after_school_program', 'literacy_organization', 'youth_development', 'homeschool_cooperative'],
  },
  {
    label: 'Cultural Preservation',
    types: ['historical_society', 'heritage_organization', 'cultural_center', 'oral_history_project'],
  },
  {
    label: 'Community Arts',
    types: ['community_theater', 'public_art_organization', 'community_arts_center',
      'community_music_program', 'writing_center'],
  },
  {
    label: 'Social Services',
    types: ['food_bank', 'homeless_shelter', 'refugee_immigrant_services',
      'free_health_clinic', 'adult_literacy'],
  },
  {
    label: 'Environmental (free-access only)',
    types: ['parks_department', 'nature_conservatory', 'land_trust', 'watershed_council',
      'native_plant_society', 'wildlife_rehabilitation', 'environmental_education'],
  },
  {
    label: 'Nature & Science (admission determines pricing)',
    types: ['zoo', 'aquarium', 'botanical_garden', 'science_museum', 'childrens_museum', 'nature_center'],
  },
  {
    label: 'Community Access',
    types: ['community_garden', 'maker_space', 'tool_lending_library', 'seed_library'],
  },
  {
    label: 'Municipal',
    types: ['municipality'],
  },
  {
    label: 'Commercial — Community tier',
    types: ['chamber_of_commerce', 'local_tourism_board', 'proprietor', 'hotel_group_small'],
  },
  {
    label: 'Commercial — Regional tier',
    types: ['state_tourism_board', 'convention_bureau'],
  },
  {
    label: 'Commercial — Enterprise tier',
    types: ['hotel_chain', 'airline', 'expo_organizer', 'national_tourism_org', 'theme_park', 'cruise_line'],
  },
  {
    label: 'Patron',
    types: ['corporate_sponsor', 'foundation'],
  },
  {
    label: 'Other',
    types: ['other'],
  },
]
