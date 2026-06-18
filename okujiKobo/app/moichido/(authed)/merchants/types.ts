// Shared result shape for the merchant-management server actions. Kept out of
// the 'use server' module (which may only export async functions) so both the
// actions and the client forms can import it.
export type ActionResult = { ok: true } | { ok: false; error: string }
