/**
 * Server-safe tab key set for /program.
 *
 * Lives outside ProgramTabs.tsx (which is `'use client'`) so the
 * server page can import these constants without crossing the
 * client boundary. Importing non-component values from a
 * `'use client'` file into a Server Component is allowed but
 * subtly different from importing from a plain module — Next 14
 * still bundles those imports as part of the client graph, which
 * can produce odd resolution errors. Keeping the constants here
 * sidesteps that whole class of issue.
 */

export const PROGRAM_TAB_KEYS = [
  'overview',
  'passports',
  'employees',
  'prizes',
  'analytics',
  'terminal',
] as const

export type ProgramTabKey = (typeof PROGRAM_TAB_KEYS)[number]
