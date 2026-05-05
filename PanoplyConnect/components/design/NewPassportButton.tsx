'use client'

import Link from 'next/link'
import { Button } from './ui/Button'

interface Props {
  userId: string
}

/**
 * Button that navigates to /design/new where the user can choose how to
 * start their new passport (blank, from library, or from a template).
 *
 * Kept as a client component so the /design list page remains a server
 * component. The userId prop is accepted for API compatibility but is not
 * needed here since /design/new handles auth server-side.
 */
export function NewPassportButton({ userId: _userId }: Props) {
  return (
    <Button asChild size="lg">
      <Link href="/design/new">+ New passport</Link>
    </Button>
  )
}
