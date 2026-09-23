#!/usr/bin/env bash
#
# STOPGAP local-test schema bootstrap.
#
# The migration re-baseline is not done yet: `supabase/migrations/` does NOT
# reproduce the full schema (the baseline migration is empty; core tables live
# only in schema.sql, and several tables only in loose *.sql patches). Until the
# re-baseline lands, this script applies the canonical SQL fragments to the LOCAL
# Supabase Postgres so the Layer 3 contract/RLS suite has a schema to run against.
#
# It uses ON_ERROR_STOP=0 to tolerate the duplicate-policy / already-exists noise
# that comes from overlapping fragments — acceptable for an ephemeral test DB,
# NOT for prod. Once migrations/ reproduce prod, DELETE this and use
# `supabase db reset` instead.
set -u

DB_URL="${SUPABASE_DB_URL:-postgresql://postgres:postgres@127.0.0.1:54322/postgres}"

# Hard refusal: never run against anything but a local database.
case "$DB_URL" in
  *127.0.0.1*|*localhost*) ;;
  *) echo "[bootstrap] REFUSING — SUPABASE_DB_URL is not local: $DB_URL" >&2; exit 1 ;;
esac

cd "$(dirname "$0")/../supabase" || exit 1

# Order matters: core schema first, then fixes, then additive tables/patches.
FILES=(
  schema.sql                      # 22 core tables + RLS + can_view_user_data + handle_new_user
  fix-rls-security.sql            # hardened policy redefinitions
  fix-cascades.sql
  add-is-backfilled.sql           # feed_items.is_backfilled
  comment-replies-and-likes.sql   # feed_comments.parent_comment_id + comment_likes
  custom-drinks.sql               # custom_drinks
  notifications.sql               # notifications, notification_preferences, device_tokens
  weekly-roast.sql                # roast_recaps, roast_awards, roast_streaks, group_records
  storage-policies.sql
  migrations/20260731_drink_cost.sql  # drink_entries.cost (optional per-drink price)
  migrations/20260923_group_roast_access.sql      # members-only roast data; joins need an invite
  migrations/20260923_pin_function_search_path.sql  # SECURITY DEFINER functions resolve in public
)

for f in "${FILES[@]}"; do
  if [ ! -f "$f" ]; then echo "[bootstrap] skip missing $f"; continue; fi
  echo "[bootstrap] applying $f"
  psql "$DB_URL" -v ON_ERROR_STOP=0 -q -f "$f" 2>&1 | grep -iE 'ERROR' | head -8 || true
done

# Make new tables visible to PostgREST (supabase-js) immediately.
psql "$DB_URL" -v ON_ERROR_STOP=0 -c "NOTIFY pgrst, 'reload schema';" >/dev/null 2>&1 || true
echo "[bootstrap] done"
