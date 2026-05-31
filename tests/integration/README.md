# Layer 3 — local Supabase contract & RLS tests

These tests run **only** against a local Supabase stack. The guard in
`tests/helpers/db-safety.ts` hard-fails if the target is anything but
`localhost`/`127.0.0.1` (and explicitly blocks the prod project ref). They are
**excluded from the fast suite** (`npm test`) and run via `npm run test:rls`.

> **Status:** the migration re-baseline is not done, so `supabase db reset` does
> not build the full schema. Until it is, use the stopgap bootstrap below. Full
> plan: see the Obsidian note _hevydrinkr Test Suite — Layer 3_.

## Prerequisites
- Docker running (Docker Desktop, Colima, etc.) — needs to pull Supabase images.
- Supabase CLI.

## Run locally
```bash
supabase start                       # boots local Postgres+Auth+REST
npm run db:bootstrap                 # STOPGAP: applies canonical SQL to the local DB
                                     #   (after re-baseline: use `supabase db reset` instead)

# Write .env.test from the running stack (local only — gitignored):
supabase status -o env > /tmp/sb.env
cat > .env.test <<EOF
NEXT_PUBLIC_SUPABASE_URL=$(. /tmp/sb.env; echo "$API_URL")
NEXT_PUBLIC_SUPABASE_ANON_KEY=$(. /tmp/sb.env; echo "$ANON_KEY")
SUPABASE_SERVICE_ROLE_KEY=$(. /tmp/sb.env; echo "$SERVICE_ROLE_KEY")
SUPABASE_DB_URL=$(. /tmp/sb.env; echo "$DB_URL")
EOF

npm run test:rls                     # contract + RLS suite
```

## What runs
- `contract.test.ts` — asserts every table/column/RPC in `tests/contract/db-contract.json` exists in the live local schema (the column-level half Layer 2 can't check statically).
- `rls.test.ts` — the RLS policy matrix (ownership, private accounts / `can_view_user_data`, `blocked_users` privacy) plus a pinned **KNOWN GAP** test documenting that blocking isn't enforced at the DB layer.

## Notes
- `.env.test` is gitignored (`.env*`) — never commit local keys; never point it at prod.
- CI runs this as a **non-blocking** job (`.github/workflows/ci.yml`) until the re-baseline makes the bootstrap unnecessary and the schema complete; then flip it to a required gate.
