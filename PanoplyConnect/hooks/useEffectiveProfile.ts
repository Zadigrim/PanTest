import { useSimulation } from '@/lib/admin/simulation-context'

const INSTITUTIONAL_ROLES = ['institutional_manager', 'employee', 'educational_user'] as const

export function useEffectiveProfile(real: { institutionId: string | null }) {
  const { simulation } = useSimulation()

  if (!simulation.active || simulation.role === 'real') {
    return real
  }

  if ((INSTITUTIONAL_ROLES as readonly string[]).includes(simulation.role)) {
    return { institutionId: real.institutionId ?? '__simulated__' }
  }

  // Non-institutional simulated roles have no institution access
  return { institutionId: null }
}
