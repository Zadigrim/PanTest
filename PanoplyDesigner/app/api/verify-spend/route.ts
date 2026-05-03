import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'
import type { SpendTier } from '@/lib/supabase/types'

const TIER_RANGES: Record<SpendTier, [number, number]> = {
  free:       [0,   0],
  under_15:   [0,   15],
  '15_50':    [15,  50],
  '50_150':   [50,  150],
  '150_500':  [150, 500],
  '500_plus': [500, 9999],
}

const TIER_LABELS: Record<SpendTier, string> = {
  free:       'Free',
  under_15:   'Under $15',
  '15_50':    '$15–$50',
  '50_150':   '$50–$150',
  '150_500':  '$150–$500',
  '500_plus': '$500+',
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { passportId, requestedTier } = await req.json() as {
    passportId: string
    requestedTier: SpendTier
  }

  // Verify passport ownership
  const { data: passport } = await supabase
    .from('passports')
    .select('*')
    .eq('id', passportId)
    .eq('creator_id', user.id)
    .single()

  if (!passport) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Fetch all stops across all pages
  const { data: pages } = await supabase
    .from('passport_pages')
    .select('id, section_name, section_title')
    .eq('passport_id', passportId)

  const pageIds = (pages ?? []).map((p) => p.id)
  const { data: stops } = pageIds.length > 0
    ? await supabase
        .from('stops')
        .select('name, address, verification_tier, experience_type')
        .in('page_id', pageIds)
    : { data: [] }

  // Build prompt for Claude
  const stopList = (stops ?? [])
    .map((s, i) => `  ${i + 1}. ${s.name}${s.address ? ` — ${s.address}` : ''}${s.experience_type ? ` (${s.experience_type})` : ''}`)
    .join('\n')

  const prompt = `You are an expert at estimating tourism and experience costs for passport-style exploration guides.

Passport title: "${passport.title}"
${passport.description ? `Description: ${passport.description}\n` : ''}
Creator's stated spend tier: ${TIER_LABELS[requestedTier as SpendTier] ?? requestedTier}

Stops (${(stops ?? []).length} total):
${stopList || '  (no stops yet)'}

Based on these stops and their locations, estimate the realistic total spend range for a single visitor to complete all stops in one trip. Consider:
- Entry fees, cover charges, minimum purchases
- Food and drink if stops are at bars, restaurants, cafés
- Transportation between stops
- Any typical upsells or expected purchases

Respond in this exact JSON format:
{
  "suggested_tier": "free|under_15|15_50|50_150|150_500|500_plus",
  "range_low": <number, minimum expected spend in USD>,
  "range_high": <number, maximum expected spend in USD>,
  "reasoning": "<2-3 sentence explanation>",
  "per_stop": [
    { "name": "<stop name>", "estimated_low": <number>, "estimated_high": <number>, "note": "<brief note>" }
  ]
}`

  const client = new Anthropic()
  let aiResult: {
    suggested_tier: SpendTier
    range_low: number
    range_high: number
    reasoning: string
    per_stop: Array<{ name: string; estimated_low: number; estimated_high: number; note: string }>
  }

  try {
    const message = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    })

    const text = message.content[0].type === 'text' ? message.content[0].text : ''
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('No JSON in response')
    aiResult = JSON.parse(jsonMatch[0])
  } catch (err) {
    return NextResponse.json({ error: 'AI verification failed', detail: String(err) }, { status: 500 })
  }

  // Log result
  await supabase.from('spend_verification_log').insert({
    passport_id: passportId,
    requested_tier: requestedTier,
    ai_suggested_range_low: aiResult.range_low,
    ai_suggested_range_high: aiResult.range_high,
    ai_reasoning: aiResult.reasoning,
  })

  return NextResponse.json({
    suggested_tier: aiResult.suggested_tier,
    range_low: aiResult.range_low,
    range_high: aiResult.range_high,
    reasoning: aiResult.reasoning,
    per_stop: aiResult.per_stop ?? [],
    requested_tier: requestedTier,
    tier_match: aiResult.suggested_tier === requestedTier,
  })
}
