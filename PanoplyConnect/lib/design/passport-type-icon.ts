const CLASSIFIER_ICONS: Record<string, string> = {
  educational:     '🎓',
  heritage:        '🏛️',
  nature:          '🌿',
  food_drink:      '🍽️',
  arts_culture:    '🎨',
  family:          '👨‍👩‍👧',
  accessible:      '♿',
  challenge:       '🏆',
  hidden_gem:      '💎',
  learning:        '📚',
  tour:            '🗺️',
}

export function passportTypeIcon(classifier: string | null): string {
  if (!classifier) return '🧭'
  return CLASSIFIER_ICONS[classifier] ?? '🧭'
}

export function passportTypeIconFromClassifiers(classifiers: string[] | null | undefined): string {
  if (!classifiers || classifiers.length === 0) return '🧭'
  return passportTypeIcon(classifiers[0])
}
