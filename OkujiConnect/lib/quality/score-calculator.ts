export interface QualityInputs {
  completionRate: number     // 0–1
  avgMoodRating: number      // 1–5
  returnVisitRate: number    // 0–1
  expertSignoffRate: number  // 0–1 (0 for non-learning passports)
}

export interface QualityScore {
  completionRate: number
  avgMoodRating: number
  returnVisitRate: number
  expertSignoffRate: number
  compositeScore: number
}

// NEVER pass journal entry content to this function.
// Analytics use only behavioral signals: completion, mood ratings, visit counts.
export function computeQualityScore(inputs: QualityInputs): QualityScore {
  const compositeScore =
    inputs.completionRate     * 0.30 +
    (inputs.avgMoodRating / 5) * 0.30 +
    inputs.returnVisitRate    * 0.20 +
    inputs.expertSignoffRate  * 0.20

  return {
    ...inputs,
    compositeScore: Math.min(1, Math.max(0, compositeScore)),
  }
}

export function formatCompositeAsStars(score: number): string {
  const stars = score * 5
  const full = Math.floor(stars)
  const half = stars - full >= 0.5 ? 1 : 0
  const empty = 5 - full - half
  return '★'.repeat(full) + (half ? '½' : '') + '☆'.repeat(empty)
}
