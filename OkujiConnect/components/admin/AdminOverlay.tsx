'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { SimulationProvider } from '@/lib/admin/simulation-context'
import { AdminPanel } from './AdminPanel'
import { SimulationBanner } from './SimulationBanner'

interface AdminInfo {
  is_platform_admin: boolean
  email: string
  display_name: string | null
}

export function AdminOverlay({ children }: { children: React.ReactNode }) {
  const [admin, setAdmin] = useState<AdminInfo | null>(null)
  const [checked, setChecked] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    void (async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setChecked(true); return }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const db = supabase as any
      const { data } = await db
        .from('profiles')
        .select('is_platform_admin, display_name')
        .eq('id', user.id)
        .maybeSingle()

      if (data?.is_platform_admin) {
        setAdmin({
          is_platform_admin: true,
          email: user.email ?? '',
          display_name: data.display_name ?? null,
        })
      }
      setChecked(true)
    })()
  }, [])

  if (!checked) return <>{children}</>

  if (!admin?.is_platform_admin) return <>{children}</>

  return (
    <SimulationProvider>
      <SimulationBanner userEmail={admin.email} />
      {children}
      <AdminPanel userEmail={admin.email} />
    </SimulationProvider>
  )
}
