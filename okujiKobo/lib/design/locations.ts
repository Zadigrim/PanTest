// Canonical location reference for the passport designer (migration 112).
//
// passports.country is ISO 3166-1 alpha-2; passports.region is the FULL ISO
// 3166-2 subdivision code (country prefix included, e.g. 'US-WA'). This module
// is the single source of truth for the designer's country/region pickers and
// for turning stored codes into display names on the /design filter.
//
// Shaped to be shared with Explore/marketplace later: pure data + lookups, no
// React, no designer-only coupling. Add a country's subdivisions by extending
// SUBDIVISIONS — the UI reveals a region selector only for countries present
// here (hasSubdivisions), and filters by country alone otherwise.

export interface Country { code: string; name: string }
export interface Subdivision { code: string; name: string } // code = full ISO 3166-2, e.g. 'US-WA'

// ISO 3166-1 alpha-2, sorted by display name. Comprehensive so a creator can
// tag a passport anywhere; the /design filter only ever SHOWS the subset that
// appears in the creator's own library.
export const COUNTRIES: Country[] = [
  { code: 'AF', name: 'Afghanistan' }, { code: 'AX', name: 'Åland Islands' },
  { code: 'AL', name: 'Albania' }, { code: 'DZ', name: 'Algeria' },
  { code: 'AS', name: 'American Samoa' }, { code: 'AD', name: 'Andorra' },
  { code: 'AO', name: 'Angola' }, { code: 'AI', name: 'Anguilla' },
  { code: 'AQ', name: 'Antarctica' }, { code: 'AG', name: 'Antigua and Barbuda' },
  { code: 'AR', name: 'Argentina' }, { code: 'AM', name: 'Armenia' },
  { code: 'AW', name: 'Aruba' }, { code: 'AU', name: 'Australia' },
  { code: 'AT', name: 'Austria' }, { code: 'AZ', name: 'Azerbaijan' },
  { code: 'BS', name: 'Bahamas' }, { code: 'BH', name: 'Bahrain' },
  { code: 'BD', name: 'Bangladesh' }, { code: 'BB', name: 'Barbados' },
  { code: 'BY', name: 'Belarus' }, { code: 'BE', name: 'Belgium' },
  { code: 'BZ', name: 'Belize' }, { code: 'BJ', name: 'Benin' },
  { code: 'BM', name: 'Bermuda' }, { code: 'BT', name: 'Bhutan' },
  { code: 'BO', name: 'Bolivia' }, { code: 'BQ', name: 'Bonaire, Sint Eustatius and Saba' },
  { code: 'BA', name: 'Bosnia and Herzegovina' }, { code: 'BW', name: 'Botswana' },
  { code: 'BV', name: 'Bouvet Island' }, { code: 'BR', name: 'Brazil' },
  { code: 'IO', name: 'British Indian Ocean Territory' }, { code: 'BN', name: 'Brunei Darussalam' },
  { code: 'BG', name: 'Bulgaria' }, { code: 'BF', name: 'Burkina Faso' },
  { code: 'BI', name: 'Burundi' }, { code: 'CV', name: 'Cabo Verde' },
  { code: 'KH', name: 'Cambodia' }, { code: 'CM', name: 'Cameroon' },
  { code: 'CA', name: 'Canada' }, { code: 'KY', name: 'Cayman Islands' },
  { code: 'CF', name: 'Central African Republic' }, { code: 'TD', name: 'Chad' },
  { code: 'CL', name: 'Chile' }, { code: 'CN', name: 'China' },
  { code: 'CX', name: 'Christmas Island' }, { code: 'CC', name: 'Cocos (Keeling) Islands' },
  { code: 'CO', name: 'Colombia' }, { code: 'KM', name: 'Comoros' },
  { code: 'CG', name: 'Congo' }, { code: 'CD', name: 'Congo (Democratic Republic)' },
  { code: 'CK', name: 'Cook Islands' }, { code: 'CR', name: 'Costa Rica' },
  { code: 'CI', name: "Côte d'Ivoire" }, { code: 'HR', name: 'Croatia' },
  { code: 'CU', name: 'Cuba' }, { code: 'CW', name: 'Curaçao' },
  { code: 'CY', name: 'Cyprus' }, { code: 'CZ', name: 'Czechia' },
  { code: 'DK', name: 'Denmark' }, { code: 'DJ', name: 'Djibouti' },
  { code: 'DM', name: 'Dominica' }, { code: 'DO', name: 'Dominican Republic' },
  { code: 'EC', name: 'Ecuador' }, { code: 'EG', name: 'Egypt' },
  { code: 'SV', name: 'El Salvador' }, { code: 'GQ', name: 'Equatorial Guinea' },
  { code: 'ER', name: 'Eritrea' }, { code: 'EE', name: 'Estonia' },
  { code: 'SZ', name: 'Eswatini' }, { code: 'ET', name: 'Ethiopia' },
  { code: 'FK', name: 'Falkland Islands' }, { code: 'FO', name: 'Faroe Islands' },
  { code: 'FJ', name: 'Fiji' }, { code: 'FI', name: 'Finland' },
  { code: 'FR', name: 'France' }, { code: 'GF', name: 'French Guiana' },
  { code: 'PF', name: 'French Polynesia' }, { code: 'TF', name: 'French Southern Territories' },
  { code: 'GA', name: 'Gabon' }, { code: 'GM', name: 'Gambia' },
  { code: 'GE', name: 'Georgia' }, { code: 'DE', name: 'Germany' },
  { code: 'GH', name: 'Ghana' }, { code: 'GI', name: 'Gibraltar' },
  { code: 'GR', name: 'Greece' }, { code: 'GL', name: 'Greenland' },
  { code: 'GD', name: 'Grenada' }, { code: 'GP', name: 'Guadeloupe' },
  { code: 'GU', name: 'Guam' }, { code: 'GT', name: 'Guatemala' },
  { code: 'GG', name: 'Guernsey' }, { code: 'GN', name: 'Guinea' },
  { code: 'GW', name: 'Guinea-Bissau' }, { code: 'GY', name: 'Guyana' },
  { code: 'HT', name: 'Haiti' }, { code: 'HM', name: 'Heard Island and McDonald Islands' },
  { code: 'VA', name: 'Holy See' }, { code: 'HN', name: 'Honduras' },
  { code: 'HK', name: 'Hong Kong' }, { code: 'HU', name: 'Hungary' },
  { code: 'IS', name: 'Iceland' }, { code: 'IN', name: 'India' },
  { code: 'ID', name: 'Indonesia' }, { code: 'IR', name: 'Iran' },
  { code: 'IQ', name: 'Iraq' }, { code: 'IE', name: 'Ireland' },
  { code: 'IM', name: 'Isle of Man' }, { code: 'IL', name: 'Israel' },
  { code: 'IT', name: 'Italy' }, { code: 'JM', name: 'Jamaica' },
  { code: 'JP', name: 'Japan' }, { code: 'JE', name: 'Jersey' },
  { code: 'JO', name: 'Jordan' }, { code: 'KZ', name: 'Kazakhstan' },
  { code: 'KE', name: 'Kenya' }, { code: 'KI', name: 'Kiribati' },
  { code: 'KP', name: 'Korea (North)' }, { code: 'KR', name: 'Korea (South)' },
  { code: 'KW', name: 'Kuwait' }, { code: 'KG', name: 'Kyrgyzstan' },
  { code: 'LA', name: 'Laos' }, { code: 'LV', name: 'Latvia' },
  { code: 'LB', name: 'Lebanon' }, { code: 'LS', name: 'Lesotho' },
  { code: 'LR', name: 'Liberia' }, { code: 'LY', name: 'Libya' },
  { code: 'LI', name: 'Liechtenstein' }, { code: 'LT', name: 'Lithuania' },
  { code: 'LU', name: 'Luxembourg' }, { code: 'MO', name: 'Macao' },
  { code: 'MG', name: 'Madagascar' }, { code: 'MW', name: 'Malawi' },
  { code: 'MY', name: 'Malaysia' }, { code: 'MV', name: 'Maldives' },
  { code: 'ML', name: 'Mali' }, { code: 'MT', name: 'Malta' },
  { code: 'MH', name: 'Marshall Islands' }, { code: 'MQ', name: 'Martinique' },
  { code: 'MR', name: 'Mauritania' }, { code: 'MU', name: 'Mauritius' },
  { code: 'YT', name: 'Mayotte' }, { code: 'MX', name: 'Mexico' },
  { code: 'FM', name: 'Micronesia' }, { code: 'MD', name: 'Moldova' },
  { code: 'MC', name: 'Monaco' }, { code: 'MN', name: 'Mongolia' },
  { code: 'ME', name: 'Montenegro' }, { code: 'MS', name: 'Montserrat' },
  { code: 'MA', name: 'Morocco' }, { code: 'MZ', name: 'Mozambique' },
  { code: 'MM', name: 'Myanmar' }, { code: 'NA', name: 'Namibia' },
  { code: 'NR', name: 'Nauru' }, { code: 'NP', name: 'Nepal' },
  { code: 'NL', name: 'Netherlands' }, { code: 'NC', name: 'New Caledonia' },
  { code: 'NZ', name: 'New Zealand' }, { code: 'NI', name: 'Nicaragua' },
  { code: 'NE', name: 'Niger' }, { code: 'NG', name: 'Nigeria' },
  { code: 'NU', name: 'Niue' }, { code: 'NF', name: 'Norfolk Island' },
  { code: 'MK', name: 'North Macedonia' }, { code: 'MP', name: 'Northern Mariana Islands' },
  { code: 'NO', name: 'Norway' }, { code: 'OM', name: 'Oman' },
  { code: 'PK', name: 'Pakistan' }, { code: 'PW', name: 'Palau' },
  { code: 'PS', name: 'Palestine' }, { code: 'PA', name: 'Panama' },
  { code: 'PG', name: 'Papua New Guinea' }, { code: 'PY', name: 'Paraguay' },
  { code: 'PE', name: 'Peru' }, { code: 'PH', name: 'Philippines' },
  { code: 'PN', name: 'Pitcairn' }, { code: 'PL', name: 'Poland' },
  { code: 'PT', name: 'Portugal' }, { code: 'PR', name: 'Puerto Rico' },
  { code: 'QA', name: 'Qatar' }, { code: 'RE', name: 'Réunion' },
  { code: 'RO', name: 'Romania' }, { code: 'RU', name: 'Russia' },
  { code: 'RW', name: 'Rwanda' }, { code: 'BL', name: 'Saint Barthélemy' },
  { code: 'SH', name: 'Saint Helena' }, { code: 'KN', name: 'Saint Kitts and Nevis' },
  { code: 'LC', name: 'Saint Lucia' }, { code: 'MF', name: 'Saint Martin (French)' },
  { code: 'PM', name: 'Saint Pierre and Miquelon' }, { code: 'VC', name: 'Saint Vincent and the Grenadines' },
  { code: 'WS', name: 'Samoa' }, { code: 'SM', name: 'San Marino' },
  { code: 'ST', name: 'Sao Tome and Principe' }, { code: 'SA', name: 'Saudi Arabia' },
  { code: 'SN', name: 'Senegal' }, { code: 'RS', name: 'Serbia' },
  { code: 'SC', name: 'Seychelles' }, { code: 'SL', name: 'Sierra Leone' },
  { code: 'SG', name: 'Singapore' }, { code: 'SX', name: 'Sint Maarten (Dutch)' },
  { code: 'SK', name: 'Slovakia' }, { code: 'SI', name: 'Slovenia' },
  { code: 'SB', name: 'Solomon Islands' }, { code: 'SO', name: 'Somalia' },
  { code: 'ZA', name: 'South Africa' }, { code: 'GS', name: 'South Georgia and the South Sandwich Islands' },
  { code: 'SS', name: 'South Sudan' }, { code: 'ES', name: 'Spain' },
  { code: 'LK', name: 'Sri Lanka' }, { code: 'SD', name: 'Sudan' },
  { code: 'SR', name: 'Suriname' }, { code: 'SJ', name: 'Svalbard and Jan Mayen' },
  { code: 'SE', name: 'Sweden' }, { code: 'CH', name: 'Switzerland' },
  { code: 'SY', name: 'Syria' }, { code: 'TW', name: 'Taiwan' },
  { code: 'TJ', name: 'Tajikistan' }, { code: 'TZ', name: 'Tanzania' },
  { code: 'TH', name: 'Thailand' }, { code: 'TL', name: 'Timor-Leste' },
  { code: 'TG', name: 'Togo' }, { code: 'TK', name: 'Tokelau' },
  { code: 'TO', name: 'Tonga' }, { code: 'TT', name: 'Trinidad and Tobago' },
  { code: 'TN', name: 'Tunisia' }, { code: 'TR', name: 'Türkiye' },
  { code: 'TM', name: 'Turkmenistan' }, { code: 'TC', name: 'Turks and Caicos Islands' },
  { code: 'TV', name: 'Tuvalu' }, { code: 'UG', name: 'Uganda' },
  { code: 'UA', name: 'Ukraine' }, { code: 'AE', name: 'United Arab Emirates' },
  { code: 'GB', name: 'United Kingdom' }, { code: 'US', name: 'United States' },
  { code: 'UM', name: 'United States Minor Outlying Islands' }, { code: 'UY', name: 'Uruguay' },
  { code: 'UZ', name: 'Uzbekistan' }, { code: 'VU', name: 'Vanuatu' },
  { code: 'VE', name: 'Venezuela' }, { code: 'VN', name: 'Vietnam' },
  { code: 'VG', name: 'Virgin Islands (British)' }, { code: 'VI', name: 'Virgin Islands (U.S.)' },
  { code: 'WF', name: 'Wallis and Futuna' }, { code: 'EH', name: 'Western Sahara' },
  { code: 'YE', name: 'Yemen' }, { code: 'ZM', name: 'Zambia' },
  { code: 'ZW', name: 'Zimbabwe' },
]

// ISO 3166-2 subdivisions, keyed by ISO 3166-1 alpha-2 country code. US at
// minimum (50 states + DC + the five inhabited territories). Add other
// countries here to light up their cascading region selector.
export const SUBDIVISIONS: Record<string, Subdivision[]> = {
  US: [
    { code: 'US-AL', name: 'Alabama' }, { code: 'US-AK', name: 'Alaska' },
    { code: 'US-AZ', name: 'Arizona' }, { code: 'US-AR', name: 'Arkansas' },
    { code: 'US-CA', name: 'California' }, { code: 'US-CO', name: 'Colorado' },
    { code: 'US-CT', name: 'Connecticut' }, { code: 'US-DE', name: 'Delaware' },
    { code: 'US-DC', name: 'District of Columbia' }, { code: 'US-FL', name: 'Florida' },
    { code: 'US-GA', name: 'Georgia' }, { code: 'US-HI', name: 'Hawaii' },
    { code: 'US-ID', name: 'Idaho' }, { code: 'US-IL', name: 'Illinois' },
    { code: 'US-IN', name: 'Indiana' }, { code: 'US-IA', name: 'Iowa' },
    { code: 'US-KS', name: 'Kansas' }, { code: 'US-KY', name: 'Kentucky' },
    { code: 'US-LA', name: 'Louisiana' }, { code: 'US-ME', name: 'Maine' },
    { code: 'US-MD', name: 'Maryland' }, { code: 'US-MA', name: 'Massachusetts' },
    { code: 'US-MI', name: 'Michigan' }, { code: 'US-MN', name: 'Minnesota' },
    { code: 'US-MS', name: 'Mississippi' }, { code: 'US-MO', name: 'Missouri' },
    { code: 'US-MT', name: 'Montana' }, { code: 'US-NE', name: 'Nebraska' },
    { code: 'US-NV', name: 'Nevada' }, { code: 'US-NH', name: 'New Hampshire' },
    { code: 'US-NJ', name: 'New Jersey' }, { code: 'US-NM', name: 'New Mexico' },
    { code: 'US-NY', name: 'New York' }, { code: 'US-NC', name: 'North Carolina' },
    { code: 'US-ND', name: 'North Dakota' }, { code: 'US-OH', name: 'Ohio' },
    { code: 'US-OK', name: 'Oklahoma' }, { code: 'US-OR', name: 'Oregon' },
    { code: 'US-PA', name: 'Pennsylvania' }, { code: 'US-RI', name: 'Rhode Island' },
    { code: 'US-SC', name: 'South Carolina' }, { code: 'US-SD', name: 'South Dakota' },
    { code: 'US-TN', name: 'Tennessee' }, { code: 'US-TX', name: 'Texas' },
    { code: 'US-UT', name: 'Utah' }, { code: 'US-VT', name: 'Vermont' },
    { code: 'US-VA', name: 'Virginia' }, { code: 'US-WA', name: 'Washington' },
    { code: 'US-WV', name: 'West Virginia' }, { code: 'US-WI', name: 'Wisconsin' },
    { code: 'US-WY', name: 'Wyoming' },
    { code: 'US-AS', name: 'American Samoa' }, { code: 'US-GU', name: 'Guam' },
    { code: 'US-MP', name: 'Northern Mariana Islands' }, { code: 'US-PR', name: 'Puerto Rico' },
    { code: 'US-VI', name: 'U.S. Virgin Islands' },
  ],
}

const COUNTRY_NAME = new Map(COUNTRIES.map((c) => [c.code, c.name]))
const REGION_NAME = new Map(
  Object.values(SUBDIVISIONS).flat().map((s) => [s.code, s.name]),
)

/** Display name for an ISO 3166-1 alpha-2 code; falls back to the raw code. */
export function countryName(code: string | null | undefined): string {
  if (!code) return ''
  return COUNTRY_NAME.get(code) ?? code
}

/** Display name for a full ISO 3166-2 region code; falls back to the raw code. */
export function regionName(code: string | null | undefined): string {
  if (!code) return ''
  return REGION_NAME.get(code) ?? code
}

/** True when this country has a subdivision list (→ show the region selector). */
export function hasSubdivisions(countryCode: string | null | undefined): boolean {
  return !!countryCode && (SUBDIVISIONS[countryCode]?.length ?? 0) > 0
}

/** Subdivisions for a country, or [] when none are modeled. */
export function subdivisionsFor(countryCode: string | null | undefined): Subdivision[] {
  return (countryCode && SUBDIVISIONS[countryCode]) || []
}

// ── Geo-join tables (for the passport location map, migration 112 data) ───────
//
// The vendored topojson keys geographies by numeric ISO 3166-1 (world) and by
// 2-digit FIPS (US states); our passports store alpha-2 / ISO 3166-2. These
// tables join the two. Pure data, no schema. Adding another country's drill map
// later means adding its own id→region table alongside US_FIPS_TO_REGION.

/** ISO 3166-1 alpha-2 → numeric (3-digit, as world-atlas uses for geo ids). */
export const ALPHA2_TO_NUMERIC: Record<string, string> = {
  AF: '004', AX: '248', AL: '008', DZ: '012', AS: '016', AD: '020', AO: '024',
  AI: '660', AQ: '010', AG: '028', AR: '032', AM: '051', AW: '533', AU: '036',
  AT: '040', AZ: '031', BS: '044', BH: '048', BD: '050', BB: '052', BY: '112',
  BE: '056', BZ: '084', BJ: '204', BM: '060', BT: '064', BO: '068', BQ: '535',
  BA: '070', BW: '072', BV: '074', BR: '076', IO: '086', BN: '096', BG: '100',
  BF: '854', BI: '108', CV: '132', KH: '116', CM: '120', CA: '124', KY: '136',
  CF: '140', TD: '148', CL: '152', CN: '156', CX: '162', CC: '166', CO: '170',
  KM: '174', CG: '178', CD: '180', CK: '184', CR: '188', CI: '384', HR: '191',
  CU: '192', CW: '531', CY: '196', CZ: '203', DK: '208', DJ: '262', DM: '212',
  DO: '214', EC: '218', EG: '818', SV: '222', GQ: '226', ER: '232', EE: '233',
  SZ: '748', ET: '231', FK: '238', FO: '234', FJ: '242', FI: '246', FR: '250',
  GF: '254', PF: '258', TF: '260', GA: '266', GM: '270', GE: '268', DE: '276',
  GH: '288', GI: '292', GR: '300', GL: '304', GD: '308', GP: '312', GU: '316',
  GT: '320', GG: '831', GN: '324', GW: '624', GY: '328', HT: '332', HM: '334',
  VA: '336', HN: '340', HK: '344', HU: '348', IS: '352', IN: '356', ID: '360',
  IR: '364', IQ: '368', IE: '372', IM: '833', IL: '376', IT: '380', JM: '388',
  JP: '392', JE: '832', JO: '400', KZ: '398', KE: '404', KI: '296', KP: '408',
  KR: '410', KW: '414', KG: '417', LA: '418', LV: '428', LB: '422', LS: '426',
  LR: '430', LY: '434', LI: '438', LT: '440', LU: '442', MO: '446', MG: '450',
  MW: '454', MY: '458', MV: '462', ML: '466', MT: '470', MH: '584', MQ: '474',
  MR: '478', MU: '480', YT: '175', MX: '484', FM: '583', MD: '498', MC: '492',
  MN: '496', ME: '499', MS: '500', MA: '504', MZ: '508', MM: '104', NA: '516',
  NR: '520', NP: '524', NL: '528', NC: '540', NZ: '554', NI: '558', NE: '562',
  NG: '566', NU: '570', NF: '574', MK: '807', MP: '580', NO: '578', OM: '512',
  PK: '586', PW: '585', PS: '275', PA: '591', PG: '598', PY: '600', PE: '604',
  PH: '608', PN: '612', PL: '616', PT: '620', PR: '630', QA: '634', RE: '638',
  RO: '642', RU: '643', RW: '646', BL: '652', SH: '654', KN: '659', LC: '662',
  MF: '663', PM: '666', VC: '670', WS: '882', SM: '674', ST: '678', SA: '682',
  SN: '686', RS: '688', SC: '690', SL: '694', SG: '702', SX: '534', SK: '703',
  SI: '705', SB: '090', SO: '706', ZA: '710', GS: '239', SS: '728', ES: '724',
  LK: '144', SD: '729', SR: '740', SJ: '744', SE: '752', CH: '756', SY: '760',
  TW: '158', TJ: '762', TZ: '834', TH: '764', TL: '626', TG: '768', TK: '772',
  TO: '776', TT: '780', TN: '788', TR: '792', TM: '795', TC: '796', TV: '798',
  UG: '800', UA: '804', AE: '784', GB: '826', US: '840', UM: '581', UY: '858',
  UZ: '860', VU: '548', VE: '862', VN: '704', VG: '092', VI: '850', WF: '876',
  EH: '732', YE: '887', ZM: '894', ZW: '716',
}

/** Numeric ISO 3166-1 → alpha-2 (reverse of ALPHA2_TO_NUMERIC). */
export const NUMERIC_TO_ALPHA2: Record<string, string> = Object.fromEntries(
  Object.entries(ALPHA2_TO_NUMERIC).map(([a2, num]) => [num, a2]),
)

/** 2-digit FIPS (us-atlas state geo id) → full ISO 3166-2 region code. */
export const US_FIPS_TO_REGION: Record<string, string> = {
  '01': 'US-AL', '02': 'US-AK', '04': 'US-AZ', '05': 'US-AR', '06': 'US-CA',
  '08': 'US-CO', '09': 'US-CT', '10': 'US-DE', '11': 'US-DC', '12': 'US-FL',
  '13': 'US-GA', '15': 'US-HI', '16': 'US-ID', '17': 'US-IL', '18': 'US-IN',
  '19': 'US-IA', '20': 'US-KS', '21': 'US-KY', '22': 'US-LA', '23': 'US-ME',
  '24': 'US-MD', '25': 'US-MA', '26': 'US-MI', '27': 'US-MN', '28': 'US-MS',
  '29': 'US-MO', '30': 'US-MT', '31': 'US-NE', '32': 'US-NV', '33': 'US-NH',
  '34': 'US-NJ', '35': 'US-NM', '36': 'US-NY', '37': 'US-NC', '38': 'US-ND',
  '39': 'US-OH', '40': 'US-OK', '41': 'US-OR', '42': 'US-PA', '44': 'US-RI',
  '45': 'US-SC', '46': 'US-SD', '47': 'US-TN', '48': 'US-TX', '49': 'US-UT',
  '50': 'US-VT', '51': 'US-VA', '53': 'US-WA', '54': 'US-WV', '55': 'US-WI',
  '56': 'US-WY', '60': 'US-AS', '66': 'US-GU', '69': 'US-MP', '72': 'US-PR',
  '78': 'US-VI',
}
