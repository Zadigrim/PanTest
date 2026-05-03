import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { renderToBuffer } from '@react-pdf/renderer'
import { PassportPDF } from '@/components/pdf/PassportPDF'
import React from 'react'

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: passport } = await supabase
    .from('passports')
    .select('*')
    .eq('id', params.id)
    .eq('creator_id', user.id)
    .single()

  if (!passport) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data: pages } = await supabase
    .from('passport_pages')
    .select('*')
    .eq('passport_id', params.id)
    .order('page_order', { ascending: true })

  const pageIds = (pages ?? []).map((p) => p.id)
  const { data: stops } = pageIds.length > 0
    ? await supabase
        .from('stops')
        .select('*')
        .in('page_id', pageIds)
        .order('stop_order', { ascending: true })
    : { data: [] }

  const buffer = await renderToBuffer(
    React.createElement(PassportPDF, {
      passport: passport as never,
      pages: (pages ?? []) as never,
      stops: (stops ?? []) as never,
    }),
  )

  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${passport.title.replace(/[^a-z0-9]/gi, '-')}.pdf"`,
    },
  })
}
