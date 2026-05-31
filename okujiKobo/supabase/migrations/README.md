# Canonical migration tree

This directory is **the canonical migration tree for Okuji.** New migrations land here, numbered sequentially.

## Why this tree

The repository contains three historical migration directories:

| Path | Role |
|---|---|
| `okujiKobo/supabase/migrations/` | **Canonical (this directory).** New migrations land here. |
| `supabase/migrations/` (repo root) | Historical mobile-app tree. Applied to production at points in time. No new migrations land here. |
| `okuji-db/supabase/migrations/000_baseline.sql` | Reference documentation. Represents an intended clean baseline; not applied directly. |

Per DEC-19 (resolved 2026-05-30), this fragmentation has a single resolution path: the canonical tree above. Greenfield deploys should apply migrations from this directory in numbered order.

## Adding a new migration

1. Sequential filename: `NNN_short_description.sql` where `NNN` is the next available number.
2. Write the migration as a pure SQL file. Idempotency guards (`IF NOT EXISTS`, `DROP ... IF EXISTS`) are preferred so reapplies are safe.
3. Top-of-file comment block: what does this migration do, which roadmap item is it implementing, what's the rationale.
4. Apply locally to confirm: `supabase db push` against your local project, or paste into the Supabase SQL editor on a non-production project first.
5. Commit the file alongside any application code that depends on the schema change in the same PR. Don't ship a schema change without its callers.

## Conventions

- **Naming:** `NNN_subject_in_snake_case.sql`. The `NNN` is a three-digit sequence; the rest is a short subject (verbs first when describing an action: `add_X`, `drop_X`, `unify_X`).
- **Comments:** the migration file is the source of truth for *what* and *why*. Reviewers should not have to dig through PR descriptions to understand a migration.
- **DROP CASCADE:** acceptable when retiring legacy structures with no production users. Surface explicitly in the PR description and migration comments when used.
- **Application code:** if a column is added that callers should set, the same PR adds the caller updates. If a column is dropped, the same PR removes its references in callers.

## What lives at the root `supabase/`

`supabase/functions/` (Deno edge functions) **is still active** at the repo root — only `supabase/migrations/` at the root is historical. The edge functions there are the canonical implementations.
