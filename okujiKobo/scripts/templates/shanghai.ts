import type { PassportTemplate } from './types'

// FIRST passport authored by the Passport Designer agent (city archetype).
// Fully populated with the migration-109 fields: per-stop description +
// sourced fun_fact, a passport-level selection_criterion, and Tier-A stamp
// hints (docs/passport-markup-spec.md §10). Seeds as a DRAFT (isPublished
// omitted) — the publish gate needs a real auth.uid(). Box layout + ±45
// rotation are applied by the seeder.
//
// HONEST-DATA: a stop carries a funFact ONLY when it can cite a stable source;
// stops without a crisp, sourced fact carry a description only (the
// design-director validation rejects an un-sourced funFact).
export const shanghai: PassportTemplate = {
  title: 'Both Banks · A Shanghai Passport',
  description: 'One river, two centuries — I walked both banks.',
  passportType: 'location',
  expectedSpendTier: '15_50',
  coverEmblem: '🏙️',
  selectionCriterion:
    'Iconic sights of Shanghai across both banks of the Huangpu — the Bund, Lujiazui, the Former French Concession, temples & gardens, and the West Bund art district.',
  pages: [
    {
      title: 'Puxi · The Bund & the Old City',
      stops: [
        {
          kind: 'gps', name: 'The Bund (Waitan)',
          address: { city: 'Shanghai', country: 'China' }, lat: 31.2397, lng: 121.4900, spend: 'free',
          description: 'A mile of colonial-era facades facing the Pudong skyline across the water.',
          funFact: 'The name "Bund" comes from an Anglo-Indian word for an embankment along a muddy waterfront.',
          factSourceUrl: 'https://en.wikipedia.org/wiki/The_Bund',
          stamp: { icon: '🌆', color: '2d5a8e' },
        },
        {
          kind: 'gps', name: 'Yu Garden',
          address: { city: 'Shanghai', country: 'China' }, lat: 31.2272, lng: 121.4920, spend: '5_to_15',
          description: 'A classical Chinese garden of rockeries, ponds, and pavilions in the Old City.',
          funFact: 'It was first laid out in 1559 during the Ming dynasty.',
          factSourceUrl: 'https://en.wikipedia.org/wiki/Yu_Garden',
          stamp: { icon: '🏯', color: '1d9e75' },
        },
        {
          kind: 'gps', name: 'City God Temple',
          address: { city: 'Shanghai', country: 'China' }, lat: 31.2270, lng: 121.4918, spend: 'free',
          description: 'A Taoist temple at the heart of the Old City bazaar.',
          stamp: { icon: '⛩️', color: '9b2335' },
        },
        {
          kind: 'gps', name: 'Nanjing Road Pedestrian Street',
          address: { city: 'Shanghai', country: 'China' }, lat: 31.2355, lng: 121.4750, spend: 'free',
          description: 'One of the busiest shopping streets in the world, running west from the Bund.',
          funFact: 'Nanjing Road is among the world’s busiest shopping streets.',
          factSourceUrl: 'https://en.wikipedia.org/wiki/Nanjing_Road',
          stamp: { icon: '🛍️', color: 'b07a4f' },
        },
        {
          kind: 'gps', name: 'Shanghai Museum',
          address: { city: 'Shanghai', country: 'China' }, lat: 31.2290, lng: 121.4760, spend: 'free',
          description: 'A museum of ancient Chinese art on People’s Square — bronzes, ceramics, calligraphy.',
          factSourceUrl: 'https://en.wikipedia.org/wiki/Shanghai_Museum',
          funFact: 'Its building is shaped to evoke an ancient bronze ding vessel — round top, square base.',
          stamp: { icon: '🏛️', color: '2d5a8e' },
        },
      ],
    },
    {
      title: 'Pudong · The Lujiazui Skyline',
      stops: [
        {
          kind: 'gps', name: 'Oriental Pearl Tower',
          address: { city: 'Shanghai', country: 'China' }, lat: 31.2397, lng: 121.4998, spend: '15_to_50',
          description: 'The spheres-on-a-column TV tower that defined the early Pudong skyline.',
          funFact: 'Completed in 1994, it stands 468 metres tall.',
          factSourceUrl: 'https://en.wikipedia.org/wiki/Oriental_Pearl_Tower',
          stamp: { icon: '🗼', color: '2d5a8e' },
        },
        {
          kind: 'gps', name: 'Shanghai Tower',
          address: { city: 'Shanghai', country: 'China' }, lat: 31.2336, lng: 121.5055, spend: '15_to_50',
          description: 'A twisting 128-storey megatall with one of the world’s highest observation decks.',
          funFact: 'At 632 metres it is the tallest building in China.',
          factSourceUrl: 'https://en.wikipedia.org/wiki/Shanghai_Tower',
          stamp: { icon: '🏙️', color: '2d5a8e' },
        },
        {
          kind: 'gps', name: 'Jin Mao Tower',
          address: { city: 'Shanghai', country: 'China' }, lat: 31.2360, lng: 121.5010, spend: '15_to_50',
          description: 'An 88-storey tower blending pagoda proportions with Art Deco lines.',
          funFact: 'It has 88 floors — eight is considered a lucky number in Chinese culture.',
          factSourceUrl: 'https://en.wikipedia.org/wiki/Jin_Mao_Tower',
          stamp: { icon: '🏢', color: '2d5a8e' },
        },
        {
          kind: 'gps', name: 'Riverside Promenade',
          address: { city: 'Shanghai', country: 'China' }, lat: 31.2400, lng: 121.4980, spend: 'free',
          description: 'The Pudong-side walkway looking back at the Bund’s historic skyline.',
          stamp: { icon: '🌊', color: '2d5a8e' },
        },
      ],
    },
    {
      title: 'The Former French Concession',
      stops: [
        {
          kind: 'gps', name: 'Xintiandi',
          address: { city: 'Shanghai', country: 'China' }, lat: 31.2200, lng: 121.4750, spend: 'free',
          description: 'Restored shikumen (stone-gate) lane houses turned into a dining and shopping quarter.',
          funFact: 'Xintiandi preserves Shanghai’s traditional shikumen lane-house architecture.',
          factSourceUrl: 'https://en.wikipedia.org/wiki/Xintiandi',
          stamp: { icon: '🍸', color: 'b07a4f' },
        },
        {
          kind: 'gps', name: 'Tianzifang',
          address: { city: 'Shanghai', country: 'China' }, lat: 31.2100, lng: 121.4680, spend: 'free',
          description: 'A warren of arts-and-crafts lanes in a former residential block.',
          stamp: { icon: '🎨', color: 'b07a4f' },
        },
        {
          kind: 'gps', name: 'Wukang Mansion',
          address: { city: 'Shanghai', country: 'China' }, lat: 31.2110, lng: 121.4350, spend: 'free',
          description: 'A prow-shaped 1924 apartment building, the most photographed corner of the concession.',
          stamp: { icon: '📸', color: 'b07a4f' },
        },
        {
          kind: 'gps', name: 'Fuxing Park',
          address: { city: 'Shanghai', country: 'China' }, lat: 31.2180, lng: 121.4680, spend: 'free',
          description: 'A French-style formal park of plane trees, lawns, and morning dancers.',
          stamp: { icon: '🌳', color: '1d9e75' },
        },
      ],
    },
    {
      title: 'Temples, Gardens & Water Towns',
      stops: [
        {
          kind: 'gps', name: "Jing'an Temple",
          address: { city: 'Shanghai', country: 'China' }, lat: 31.2240, lng: 121.4450, spend: '5_to_15',
          description: 'A golden-roofed Buddhist temple marooned among downtown towers.',
          funFact: 'Its origins trace to 247 AD during the Three Kingdoms period.',
          factSourceUrl: 'https://en.wikipedia.org/wiki/Jing%27an_Temple',
          stamp: { icon: '🛕', color: '9b2335' },
        },
        {
          kind: 'gps', name: 'Longhua Temple & Pagoda',
          address: { city: 'Shanghai', country: 'China' }, lat: 31.1760, lng: 121.4520, spend: 'under_5',
          description: 'The oldest and largest temple complex in Shanghai, beside its leaning pagoda.',
          funFact: 'Longhua is the largest and one of the oldest temple complexes in Shanghai.',
          factSourceUrl: 'https://en.wikipedia.org/wiki/Longhua_Temple',
          stamp: { icon: '🏯', color: '9b2335' },
        },
        {
          kind: 'gps', name: 'Zhujiajiao Water Town',
          place: 'Zhujiajiao, Shanghai, China', spend: 'free',
          description: 'A canal town of arched stone bridges and waterside teahouses west of the city.',
          funFact: 'Zhujiajiao has roughly 1,700 years of history as a canal town.',
          factSourceUrl: 'https://en.wikipedia.org/wiki/Zhujiajiao',
          stamp: { icon: '🛶', color: '1d9e75' },
        },
        {
          kind: 'gps', name: 'Qibao Old Street',
          place: 'Qibao Old Street, Minhang, Shanghai, China', spend: 'free',
          description: 'A lantern-lit old street of snack stalls along a narrow canal.',
          stamp: { icon: '🏮', color: 'b07a4f' },
        },
      ],
    },
    {
      title: 'Art & the West Bund',
      stops: [
        {
          kind: 'gps', name: 'Long Museum (West Bund)',
          address: { city: 'Shanghai', country: 'China' }, lat: 31.1800, lng: 121.4600, spend: '5_to_15',
          description: 'A private contemporary-art museum of board-formed concrete on the Xuhui riverfront.',
          factSourceUrl: 'https://en.wikipedia.org/wiki/Long_Museum',
          funFact: 'The West Bund branch is built around a preserved coal-hopper bridge from the site’s industrial past.',
          stamp: { icon: '🖼️', color: 'b07a4f' },
        },
        {
          kind: 'gps', name: 'Power Station of Art',
          address: { city: 'Shanghai', country: 'China' }, lat: 31.1870, lng: 121.4890, spend: 'free',
          description: 'A contemporary-art museum inside a converted riverside power plant.',
          funFact: 'It is mainland China’s first state-run museum dedicated to contemporary art, in a former power station.',
          factSourceUrl: 'https://en.wikipedia.org/wiki/Power_Station_of_Art',
          stamp: { icon: '🏭', color: 'b07a4f' },
        },
        {
          kind: 'gps', name: 'M50 Creative Park',
          place: 'M50 Creative Park, Moganshan Road, Shanghai, China', spend: 'free',
          description: 'Galleries and studios in a cluster of old textile-mill buildings on Moganshan Road.',
          stamp: { icon: '🎨', color: 'b07a4f' },
        },
        {
          kind: 'gps', name: 'Rockbund Art Museum',
          address: { city: 'Shanghai', country: 'China' }, lat: 31.2420, lng: 121.4900, spend: '5_to_15',
          description: 'A contemporary-art museum in a restored 1930s building just behind the Bund.',
          stamp: { icon: '🖼️', color: '2d5a8e' },
        },
      ],
    },
  ],
}

export default shanghai
