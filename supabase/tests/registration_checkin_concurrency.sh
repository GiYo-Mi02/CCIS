#!/usr/bin/env bash
set -euo pipefail

admin_id='00000000-0000-0000-0000-000000000001'
event_id='00000000-0000-0000-0000-000000000003'
registration_id='00000000-0000-0000-0000-000000000004'

cleanup() {
  psql "$SUPABASE_DB_URL" --set ON_ERROR_STOP=1 --command "DELETE FROM internal.email_outbox WHERE source_id = '$event_id'; DELETE FROM public.events WHERE id = '$event_id'; DELETE FROM auth.users WHERE id IN ('$admin_id', '00000000-0000-0000-0000-000000000002');" >/dev/null
}
trap cleanup EXIT

psql "$SUPABASE_DB_URL" --set ON_ERROR_STOP=1 --file supabase/tests/registration_checkin_fixture.sql >/dev/null

psql "$SUPABASE_DB_URL" --set ON_ERROR_STOP=1 --command "
  BEGIN;
  SELECT internal.enforce_rate_limit('attendance_scan', '$admin_id', 180, 60);
  SET LOCAL ROLE authenticated;
  SELECT set_config('request.jwt.claims', '{\"role\":\"authenticated\",\"sub\":\"$admin_id\"}', true);
  SELECT 1 FROM public.event_registrations WHERE id = '$registration_id'::uuid FOR UPDATE;
  SELECT pg_sleep(0.5);
  DO \$\$ DECLARE v_was_already_attended BOOLEAN; BEGIN
    SELECT was_already_attended INTO v_was_already_attended
    FROM public.check_in_event_registration('$registration_id'::uuid);
    IF v_was_already_attended THEN RAISE EXCEPTION 'first scanner reported a repeat'; END IF;
  END \$\$;
  COMMIT;
" >/dev/null &
first_scanner=$!

sleep 0.1

psql "$SUPABASE_DB_URL" --set ON_ERROR_STOP=1 --command "
  BEGIN;
  SET LOCAL ROLE authenticated;
  SELECT set_config('request.jwt.claims', '{\"role\":\"authenticated\",\"sub\":\"$admin_id\"}', true);
  DO \$\$ DECLARE v_was_already_attended BOOLEAN; BEGIN
    SELECT was_already_attended INTO v_was_already_attended
    FROM public.check_in_event_registration('$registration_id'::uuid);
    IF NOT v_was_already_attended THEN RAISE EXCEPTION 'second scanner reported a new entry'; END IF;
  END \$\$;
  COMMIT;
" >/dev/null &
second_scanner=$!

wait "$first_scanner"
wait "$second_scanner"
