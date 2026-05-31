import React, { createContext, useContext, useEffect, useState, useCallback } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { supabase } from '../lib/supabase'
import type { EmployeeAuthorization } from '../types'

const EMPLOYEE_MODE_KEY = '@okuji/employee_mode'

interface EmployeeContextValue {
  isEmployee: boolean
  employeeAuth: EmployeeAuthorization | null
  institutionType: string | null
  catalogUrl: string | null
  employeeMode: boolean
  setEmployeeMode: (v: boolean) => void
}

const EmployeeContext = createContext<EmployeeContextValue>({
  isEmployee: false,
  employeeAuth: null,
  institutionType: null,
  catalogUrl: null,
  employeeMode: false,
  setEmployeeMode: () => {},
})

export function useEmployeeContext() {
  return useContext(EmployeeContext)
}

export function EmployeeProvider({ children }: { children: React.ReactNode }) {
  const [employeeAuth, setEmployeeAuth] = useState<EmployeeAuthorization | null>(null)
  const [employeeMode, setEmployeeModeState] = useState(false)
  const [hydrated, setHydrated] = useState(false)

  // Load persisted mode on mount
  useEffect(() => {
    AsyncStorage.getItem(EMPLOYEE_MODE_KEY).then((val) => {
      if (val === 'true') setEmployeeModeState(true)
      setHydrated(true)
    })
  }, [])

  // Listen for auth changes and fetch employee_authorizations
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        fetchEmployeeAuth(session.user.id)
      } else {
        setEmployeeAuth(null)
        setEmployeeModeState(false)
      }
    })

    // Also load immediately for any current session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) fetchEmployeeAuth(session.user.id)
    })

    return () => subscription.unsubscribe()
  }, [])

  async function fetchEmployeeAuth(userId: string) {
    const { data, error } = await supabase
      .from('employee_authorizations')
      .select(`
        *,
        institutions (
          name,
          institution_type,
          catalog_url
        )
      `)
      .eq('user_id', userId)
      .eq('can_verify', true)
      .maybeSingle()

    if (error || !data) {
      setEmployeeAuth(null)
      return
    }

    const inst = (data as any).institutions
    const auth: EmployeeAuthorization = {
      id: data.id,
      user_id: data.user_id,
      institution_id: data.institution_id,
      can_verify: data.can_verify,
      can_distribute_prizes: data.can_distribute_prizes,
      institution_name: inst?.name ?? undefined,
      institution_type: inst?.institution_type ?? undefined,
      catalog_url: inst?.catalog_url ?? null,
    }
    setEmployeeAuth(auth)
  }

  const setEmployeeMode = useCallback((v: boolean) => {
    setEmployeeModeState(v)
    AsyncStorage.setItem(EMPLOYEE_MODE_KEY, v ? 'true' : 'false')
    // If turning off, clear mode — no side-effects needed
    if (!v) {
      // Mode is off; employeeAuth stays so toggle works again
    }
  }, [])

  const value: EmployeeContextValue = {
    isEmployee: !!employeeAuth,
    employeeAuth,
    institutionType: employeeAuth?.institution_type ?? null,
    catalogUrl: employeeAuth?.catalog_url ?? null,
    employeeMode: hydrated ? employeeMode : false,
    setEmployeeMode,
  }

  return (
    <EmployeeContext.Provider value={value}>
      {children}
    </EmployeeContext.Provider>
  )
}
