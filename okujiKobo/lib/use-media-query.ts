'use client'

import { useEffect, useState } from 'react'

/**
 * SSR-safe media-query hook. Returns `false` on the server and on the first
 * client render (deterministic — avoids a hydration mismatch), then updates
 * after mount to the real match and on every subsequent change.
 *
 * Usage: const coarse = useMediaQuery('(pointer: coarse)')
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return
    const mql = window.matchMedia(query)
    const update = () => setMatches(mql.matches)
    update()
    mql.addEventListener('change', update)
    return () => mql.removeEventListener('change', update)
  }, [query])

  return matches
}
