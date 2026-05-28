// Shared JWT auth for edge functions.
//
// Validates the caller's bearer token against Supabase Auth via getUser() —
// authoritative validation that respects revoked tokens and deleted accounts,
// not local signature verification. The authenticated user id returned here is
// the ONLY trusted source of identity; callers must never trust a userId from
// the request body.
//
// This helper only handles authentication (401). Authorization (403) is
// action-specific and is enforced by each function after it has the user id.
import { createClient, type User } from 'https://esm.sh/@supabase/supabase-js@2'

export type AuthResult = { user: User } | { error: 'unauthorized'; status: 401 }

export async function extractAndVerifyJWT(req: Request, supabaseUrl: string): Promise<AuthResult> {
  const header = req.headers.get('Authorization') ?? req.headers.get('authorization')
  const token = header?.startsWith('Bearer ') ? header.slice('Bearer '.length).trim() : null
  if (!token) return { error: 'unauthorized', status: 401 }

  // Anon-key client used purely to validate the supplied JWT with the auth server.
  const supabase = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY') ?? '')
  const { data, error } = await supabase.auth.getUser(token)
  if (error || !data?.user) return { error: 'unauthorized', status: 401 }

  return { user: data.user }
}
