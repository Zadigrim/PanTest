import { useEffect } from 'react'
import { useLocalSearchParams, router } from 'expo-router'

export default function DesignerRoot() {
  const { id } = useLocalSearchParams<{ id: string }>()
  useEffect(() => {
    router.replace(`/designer/${id}/pages` as any)
  }, [id])
  return null
}
