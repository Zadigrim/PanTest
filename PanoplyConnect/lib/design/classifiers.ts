// Canonical classifier list — used by the designer, stop library, and explore pages.

export interface Classifier {
  id: string
  label: string
  icon: string
}

export const CLASSIFIERS: Classifier[] = [
  { id: 'general',        label: 'General',         icon: '🧭' },
  { id: 'educational',    label: 'Educational',     icon: '🎓' },
  { id: 'heritage',       label: 'Heritage',        icon: '🏛️' },
  { id: 'nature',         label: 'Nature',          icon: '🌿' },
  { id: 'food_drink',     label: 'Food & Drink',    icon: '🍽️' },
  { id: 'arts_culture',   label: 'Arts & Culture',  icon: '🎨' },
  { id: 'family',         label: 'Family',          icon: '👨‍👩‍👧' },
  { id: 'accessible',     label: 'Accessible',      icon: '♿' },
  { id: 'challenge',      label: 'Challenge',       icon: '🏆' },
  { id: 'hidden_gem',     label: 'Hidden Gem',      icon: '💎' },
  { id: 'learning',       label: 'Learning',        icon: '📚' },
  { id: 'tour',           label: 'Tour',            icon: '🗺️' },
  { id: 'outdoor',        label: 'Outdoor',         icon: '🥾' },
  { id: 'architecture',   label: 'Architecture',    icon: '🏗️' },
  { id: 'wildlife',       label: 'Wildlife',        icon: '🦅' },
  { id: 'marine',         label: 'Marine',          icon: '🌊' },
  { id: 'brewery',        label: 'Brewery',         icon: '🍺' },
  { id: 'wine',           label: 'Wine',            icon: '🍷' },
  { id: 'coffee',         label: 'Coffee',          icon: '☕' },
  { id: 'music',          label: 'Music',           icon: '🎵' },
  { id: 'theater',        label: 'Theater',         icon: '🎭' },
  { id: 'photography',    label: 'Photography',     icon: '📷' },
  { id: 'cycling',        label: 'Cycling',         icon: '🚴' },
  { id: 'winter',         label: 'Winter',          icon: '⛷️' },
  { id: 'night',          label: 'Night',           icon: '🌙' },
  { id: 'spiritual',      label: 'Spiritual',       icon: '🙏' },
  { id: 'industrial',     label: 'Industrial',      icon: '🏭' },
  { id: 'garden',         label: 'Garden',          icon: '🌸' },
  { id: 'schools',        label: 'Schools',         icon: '🎒' },
  { id: 'science',        label: 'Science',         icon: '🔭' },
]

const CLASSIFIER_MAP = new Map(CLASSIFIERS.map((c) => [c.id, c]))

export function classifierIcon(id: string | null | undefined): string {
  if (!id) return '🧭'
  return CLASSIFIER_MAP.get(id)?.icon ?? '🧭'
}

export function classifierLabel(id: string | null | undefined): string {
  if (!id) return 'General'
  return CLASSIFIER_MAP.get(id)?.label ?? id
}
