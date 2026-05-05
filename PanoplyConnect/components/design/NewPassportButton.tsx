'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from './ui/Button'

interface Props {
  userId: string
}

/**
 * Client component that POSTs to /api/design/create and redirects to the new
 * passport workspace. Kept separate so the /design list page can remain a
 * server component.
 */
export function NewPassportButton({ userId }: Props) {
  const router = useRouter()
  const [creating, setCreating] = useState(false)

  const handleCreate = async () => {
    setCreating(true)
    try {
      const res = await fetch('/api/design/create', { method: 'POST' })
      if (!res.ok) throw new Error(await res.text())
      const { id } = (await res.json()) as { id: string }
      router.push(`/design/${id}`)
    } catch {
      setCreating(false)
    }
  }

  return (
    <Button onClick={handleCreate} disabled={creating} size="lg">
      {creating ? 'Creating…' : '+ New passport'}
    </Button>
  )
}
