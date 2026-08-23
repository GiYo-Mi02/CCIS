# Archived manual SQL

The numbered SQL files in this directory are historical deployment artifacts. They are retained only for incident archaeology and are **not** part of the production deployment path.

Authoritative schema changes live exclusively in `supabase/migrations/` and must pass a clean `supabase db reset` plus `supabase/tests/security_contract.sql` in CI. Do not run these archived scripts against any environment; several contain destructive seed cleanup or policies superseded by later security migrations.

Operational templates that intentionally require a human-provided secret remain outside this directory and are explicitly labeled as non-migrations.
