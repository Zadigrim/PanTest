# Password reset — Supabase redirect allowlist (manual dashboard step)

Status: **Nathan does this by hand in the Supabase dashboard.** Code can't
set it. Until these URLs are allow-listed, the reset emails' links resolve
to "redirect not allowed" and the loop fails — so this is the gate between
"built" and "working."

## Why

`resetPasswordForEmail(email, { redirectTo })` only sends a link to a
`redirectTo` that Supabase has been told to trust. Each surface sets its
own `redirectTo` to its own host (web) or the frozen `okuji://` scheme
(mobile), so every one of those targets must be present in the project's
allow-list.

## Where

Supabase dashboard → **Authentication → URL Configuration → Redirect URLs**
(one shared project for all three surfaces).

## URLs to add

| Surface | Redirect URL | Notes |
| --- | --- | --- |
| **okuji mobile** | `okuji://auth` | The frozen deep-link scheme. Covers `okuji://auth?flow=recovery&code=…` (the marker + code are query params on the same target). If the project enforces exact matches, add `okuji://auth*` (wildcard) instead. |
| **kobo (web)** | `https://<kobo-host>/auth/callback` | Almost certainly already present (OAuth uses it today). The reset link routes through `/auth/callback?next=/auth/update-password`, so only the callback needs allow-listing, not `/auth/update-password` itself. |
| **moichido (web)** | `https://<moichido-host>/auth/callback` | Same: the moichido reset routes through its own host's `/auth/callback`. Add if not already present. |
| **local dev (optional)** | `http://localhost:3000/auth/callback` and your Expo dev redirect | Only needed to test the loop locally. The Expo dev redirect is whatever `makeRedirectUri` prints in your dev build (an `exp://…/--/auth` URL). |

> Note: because both web surfaces route through `/auth/callback` (which mints
> the recovery session and then forwards to `/auth/update-password` on the
> same origin), you do **not** need to allow-list `/auth/update-password` per
> host. Only the per-host `/auth/callback` and the mobile `okuji://auth`
> target must be trusted.

## Verify

After adding them, run the full loop on each surface yourself (request email →
click link → set new password → land signed-in). Build-green ≠ shipped — this
allow-list + your in-app pass is the real verification gate. Web is live on the
okujiKobo deploy; mobile needs the next AAB.
