// Seed the Google Play reviewer account, with the Portland showcase
// passport pre-acquired. One-time admin/ops action — run with the
// service-role key. Idempotent: safe to re-run.
//
//   SUPABASE_SERVICE_ROLE_KEY=... node scripts/seed-reviewer-account.mjs
//
// Reads the Supabase URL + service-role key from the environment (your
// .env.local already exports SUPABASE_SERVICE_ROLE_KEY and
// NEXT_PUBLIC_SUPABASE_URL). Uses ONLY supported paths:
//   - auth.admin.createUser({ email_confirm: true })  → hashed password,
//     pre-confirmed email (no verification wall). The migration-011
//     trigger auto-creates the profiles row.
//   - rpc('ensure_collector_passport')                → valid
//     collector_passports acquisition with copy_number + expires_at.
// Then verifies with a real signInWithPassword round-trip.

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL =
  process.env.SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  process.env.EXPO_PUBLIC_SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.SUPABASE_ANON_KEY

const REVIEWER_EMAIL = process.env.REVIEWER_EMAIL || 'play-review@okuji.app'
const REVIEWER_PASSWORD = process.env.REVIEWER_PASSWORD || 'Okujikobomo1ch1do'
const PORTLAND_ID = 'c72ef8fe-98fb-4412-ad3c-34fb1dc3bdb0'

function die(msg) {
  console.error(`\n✖ ${msg}`)
  process.exit(1)
}

if (!SUPABASE_URL) die('Missing Supabase URL (set NEXT_PUBLIC_SUPABASE_URL or SUPABASE_URL).')
if (!SERVICE_ROLE_KEY) die('Missing SUPABASE_SERVICE_ROLE_KEY.')

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

async function findUserByEmail(email) {
  for (let page = 1; page <= 50; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 })
    if (error) die(`listUsers failed: ${error.message}`)
    const match = data.users.find((u) => (u.email || '').toLowerCase() === email.toLowerCase())
    if (match) return match
    if (data.users.length < 200) break
  }
  return null
}

async function main() {
  console.log(`→ Supabase: ${SUPABASE_URL}`)
  console.log(`→ Reviewer: ${REVIEWER_EMAIL}`)

  // ── 1. Create (or reconcile) the reviewer account ─────────────────────────
  let userId
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email: REVIEWER_EMAIL,
    password: REVIEWER_PASSWORD,
    email_confirm: true,
    user_metadata: { display_name: 'Play Reviewer' },
  })

  if (createErr) {
    const exists = createErr.status === 422 || /already|registered|exist/i.test(createErr.message || '')
    if (!exists) die(`createUser failed: ${createErr.message}`)
    const existing = await findUserByEmail(REVIEWER_EMAIL)
    if (!existing) die('createUser said the email exists but it was not found via listUsers.')
    userId = existing.id
    // Reconcile: force the chosen password + confirmed email so login works.
    const { error: updErr } = await admin.auth.admin.updateUserById(userId, {
      password: REVIEWER_PASSWORD,
      email_confirm: true,
    })
    if (updErr) die(`updateUserById failed: ${updErr.message}`)
    console.log(`✓ Account already existed — reconciled password + confirmed email (${userId})`)
  } else {
    userId = created.user.id
    console.log(`✓ Account created + email pre-confirmed (${userId})`)
  }

  // ── 2. Verify Portland is published before acquiring ──────────────────────
  const { data: passport, error: pErr } = await admin
    .from('passports')
    .select('id, title, is_published, price_cents, credential_type')
    .eq('id', PORTLAND_ID)
    .single()
  if (pErr || !passport) die(`Portland passport ${PORTLAND_ID} not found: ${pErr?.message ?? 'no row'}`)
  if (passport.is_published !== true) die(`Portland passport is not published (is_published=${passport.is_published}).`)
  console.log(`✓ Portland published: "${passport.title}" (type=${passport.credential_type}, price_cents=${passport.price_cents})`)

  // ── 3. Acquire via the real path (idempotent) ─────────────────────────────
  const { data: acq, error: acqErr } = await admin.rpc('ensure_collector_passport', {
    p_user_id: userId,
    p_passport_id: PORTLAND_ID,
  })
  if (acqErr) die(`ensure_collector_passport failed: ${acqErr.message}`)
  const acqRow = Array.isArray(acq) ? acq[0] : acq
  console.log(`✓ Acquired Portland — copy_number=${acqRow?.copy_number ?? '?'}, expires_at=${acqRow?.expires_at ?? 'never'}`)

  // ── 4. Verify: confirmed email, collector_passports row, real sign-in ─────
  const { data: gotUser } = await admin.auth.admin.getUserById(userId)
  const confirmed = !!gotUser?.user?.email_confirmed_at
  if (!confirmed) die('Account email is NOT confirmed after creation — reviewer would hit a wall.')

  const { data: cp, error: cpErr } = await admin
    .from('collector_passports')
    .select('id, copy_number, expires_at, acquired_at')
    .eq('user_id', userId)
    .eq('passport_id', PORTLAND_ID)
    .single()
  if (cpErr || !cp) die(`collector_passports row not found after acquire: ${cpErr?.message ?? 'no row'}`)

  let signInOk = false
  if (ANON_KEY) {
    const anon = createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false } })
    const { data: si, error: siErr } = await anon.auth.signInWithPassword({
      email: REVIEWER_EMAIL,
      password: REVIEWER_PASSWORD,
    })
    if (siErr) die(`Sign-in test FAILED — credentials would not work for the reviewer: ${siErr.message}`)
    signInOk = !!si?.session
    await anon.auth.signOut()
  }

  // ── Result ────────────────────────────────────────────────────────────────
  console.log('\n────────────────────────────────────────────')
  console.log('✓ DONE — reviewer account ready')
  console.log('────────────────────────────────────────────')
  console.log(`  email_confirmed : ${confirmed}`)
  console.log(`  collector_passport: id=${cp.id} copy_number=${cp.copy_number}`)
  console.log(`  sign-in verified : ${ANON_KEY ? signInOk : 'skipped (no anon key in env)'}`)
  console.log('\n  ── Paste into Play Console → App access ──')
  console.log(`  Email:    ${REVIEWER_EMAIL}`)
  console.log(`  Password: ${REVIEWER_PASSWORD}`)
  console.log('────────────────────────────────────────────\n')
}

main().catch((e) => die(e?.message ?? String(e)))
