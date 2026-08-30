create or replace function public.list_loadtest_account_ids()
  returns table (
    user_id uuid
  )
  language plpgsql
  stable
  security definer
  set search_path to 'public', 'auth'
  AS $function$
BEGIN
  IF public.get_user_role() <> 'devcom_head' THEN
    RAISE EXCEPTION 'Only devcom_head users can list purge targets';
  END IF;

  RETURN QUERY
  SELECT users.id
  FROM auth.users AS users
  WHERE users.email ILIKE 'loadtest%'
     OR users.email ILIKE 'test%@umak.edu.ph'
  UNION
  SELECT tombstones.user_id
  FROM public.account_deletion_tombstones AS tombstones
  WHERE NOT tombstones.storage_deleted
     OR NOT tombstones.public_data_deleted
     OR NOT tombstones.auth_deleted;
END;
$function$;

grant execute on function "public"."list_loadtest_account_ids"() to "authenticated", "postgres", "service_role";

revoke all on function "public"."list_loadtest_account_ids"() from public;
