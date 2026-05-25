import { classifierIcon } from './classifiers'

export function passportTypeIcon(classifier: string | null): string {
  return classifierIcon(classifier)
}

export function passportTypeIconFromClassifiers(
  classifiers: string[] | null | undefined,
): string {
  if (!classifiers || classifiers.length === 0) return '🧭'
  return classifierIcon(classifiers[0])
}
