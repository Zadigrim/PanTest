import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { createClient } from '@/lib/supabase/server'

const resend = new Resend(process.env.RESEND_API_KEY!)

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { passportId, pageId, tokenCode } = (await request.json()) as {
    passportId: string
    pageId: string
    tokenCode: string
  }

  const { data: passport } = await supabase
    .from('passports')
    .select('title')
    .eq('id', passportId)
    .single()

  const { data: page } = await supabase
    .from('passport_pages')
    .select('section_name, section_title')
    .eq('id', pageId)
    .single()

  const { data: profile } = await supabase
    .from('profiles')
    .select('display_name')
    .eq('id', user.id)
    .single()

  const pageName = page?.section_title ?? page?.section_name ?? 'Page'
  const collectorName = profile?.display_name ?? 'Collector'
  const passportTitle = passport?.title ?? 'Passport'

  const { error } = await resend.emails.send({
    from: 'Panoply <no-reply@panoply.app>',
    to: user.email!,
    subject: `🎉 You completed ${pageName} — ${passportTitle}`,
    html: `
      <div style="font-family:serif;max-width:480px;margin:0 auto;padding:32px;">
        <h1 style="color:#0D1B2A;font-size:24px;">Congratulations, ${collectorName}!</h1>
        <p style="color:#64748B;">You completed <strong>${pageName}</strong> in <strong>${passportTitle}</strong>.</p>
        <div style="background:#E1F5EE;border-radius:8px;padding:16px;margin:24px 0;">
          <p style="margin:0;font-size:13px;color:#64748B;">Your redemption code</p>
          <p style="margin:4px 0 0;font-size:24px;font-weight:700;color:#0F6E56;letter-spacing:2px;">${tokenCode}</p>
          <p style="margin:8px 0 0;font-size:12px;color:#64748B;">Show this at the location to claim your prize.</p>
        </div>
        <p style="color:#64748B;font-size:13px;">Open Panoply on your phone to continue your journey.</p>
        <p style="margin-top:32px;color:#94A3B8;font-size:12px;">Panoply · Real experiences, collected.</p>
      </div>
    `,
  })

  if (error) {
    console.error('Resend error:', error)
    return NextResponse.json({ error: 'Email failed' }, { status: 500 })
  }

  return NextResponse.json({ sent: true })
}
