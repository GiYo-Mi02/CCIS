create or replace function public.check_profile_metadata()
  returns trigger
  language plpgsql
  set search_path to ''
  AS $function$
BEGIN
  -- SAFETY GUARD / PROMOTION: Automatically make whitelist emails devcom_head and approved
  IF NEW.email = 'ggiojoshua2006@gmail.com' OR NEW.email = 'devcommgio2006@gmail.com' THEN
    NEW.role := 'devcom_head';
    NEW.position := 'Lead Administrator';
    NEW.profile_complete := true;
    NEW.status := 'approved';
    NEW.approved_at := now();
    RETURN NEW;
  END IF;

  -- Enforce email ends with @umak.edu.ph (case-insensitive) for all other accounts
  IF NEW.email !~* '^[a-zA-Z0-9._%+-]+@umak\.edu\.ph$' THEN
    RAISE EXCEPTION 'Unsupported email. Only @umak.edu.ph accounts are acceptable.';
  END IF;

  -- Enforce name limit (not exceeding 255 characters)
  IF NEW.full_name IS NOT NULL AND length(NEW.full_name) > 255 THEN
    RAISE EXCEPTION 'Full name must not exceed 255 characters.';
  END IF;

  -- Enforce section matches uppercase letters, numbers, and hyphens only, no spaces
  IF NEW.section IS NOT NULL AND NEW.section !~ '^[A-Z0-9-]+$' THEN
    RAISE EXCEPTION 'Invalid section format. It must contain only uppercase letters, numbers, and hyphens, with no spaces (e.g., ACSAD, A-APPDEV).';
  END IF;

  RETURN NEW;
END;
$function$;

grant execute on function "public"."check_profile_metadata"() to public, "anon", "authenticated", "postgres", "service_role";
