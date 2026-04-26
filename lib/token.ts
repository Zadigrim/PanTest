// Client-side redemption token utilities.
import { supabase } from './supabase'

export async function generateTokenForPage(pageId: string, userId: string) {
  const { data, error } = await supabase.functions.invoke('generate-token', {
    body: { pageId, userId },
  })
  if (error) throw error
  return data
}

export async function checkPageComplete(
  pageId: string,
  userId: string
): Promise<boolean> {
  const { data: stops } = await supabase
    .from('stops')
    .select('id')
    .eq('page_id', pageId)

  if (!stops || stops.length === 0) return false

  const { data: stamps } = await supabase
    .from('stamps')
    .select('stop_id')
    .eq('user_id', userId)
    .in('stop_id', stops.map((s) => s.id))

  return (stamps?.length ?? 0) >= stops.length
}

// Scaffold for Year 2 zero-knowledge journal encryption.
// In MVP, this is a no-op pass-through.
export const journalEncryption = {
  encrypt: (text: string): string => text,
  decrypt: (text: string): string => text,
}
