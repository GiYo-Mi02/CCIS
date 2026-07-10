-- 23_event_registration_rpc.sql
-- Migration to deploy registration PL/pgSQL function with row locks and privilege restrictions.

CREATE OR REPLACE FUNCTION public.register_for_event(p_event_id UUID, p_profile_id UUID)
RETURNS public.event_registrations
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event public.events%ROWTYPE;
  v_current_count INT;
  v_existing_registration public.event_registrations%ROWTYPE;
  v_new_registration public.event_registrations%ROWTYPE;
BEGIN
  -- Check if registration record already exists (cancelled or active)
  SELECT * INTO v_existing_registration
  FROM public.event_registrations
  WHERE event_id = p_event_id AND profile_id = p_profile_id;

  IF FOUND THEN
    IF v_existing_registration.status = 'cancelled' THEN
      -- Lock the event row to serialize capacity checks
      SELECT * INTO v_event
      FROM public.events
      WHERE id = p_event_id
      FOR UPDATE;

      -- Recompute live count inside the lock (excluding cancelled registrations)
      SELECT count(*) INTO v_current_count
      FROM public.event_registrations
      WHERE event_id = p_event_id
        AND status != 'cancelled';

      IF v_current_count >= v_event.registration_cap THEN
        RAISE EXCEPTION 'EVENT_FULL';
      END IF;

      -- Re-activate the cancelled registration to bypass unique constraint violation
      UPDATE public.event_registrations
      SET status = 'confirmed', registered_at = now()
      WHERE event_id = p_event_id AND profile_id = p_profile_id
      RETURNING * INTO v_new_registration;
      
      RETURN v_new_registration;
    ELSE
      RAISE EXCEPTION 'ALREADY_REGISTERED';
    END IF;
  END IF;

  -- Lock the event row for new registrations to serialize capacity checks
  SELECT * INTO v_event
  FROM public.events
  WHERE id = p_event_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'EVENT_NOT_FOUND';
  END IF;

  -- Recompute live count inside the lock (excluding cancelled registrations)
  SELECT count(*) INTO v_current_count
  FROM public.event_registrations
  WHERE event_id = p_event_id
    AND status != 'cancelled';

  IF v_current_count >= v_event.registration_cap THEN
    RAISE EXCEPTION 'EVENT_FULL';
  END IF;

  -- Insert new registration
  INSERT INTO public.event_registrations (event_id, profile_id, status)
  VALUES (p_event_id, p_profile_id, 'confirmed')
  RETURNING * INTO v_new_registration;

  RETURN v_new_registration;
END;
$$;

-- Lock down direct writes: Remove the direct INSERT grant from authenticated users
REVOKE INSERT ON public.event_registrations FROM authenticated;

-- Allow only the RPC function to write
GRANT EXECUTE ON FUNCTION public.register_for_event(UUID, UUID) TO authenticated;

-- Clean up permissive RLS insert policies if they exist (for defense in depth)
DROP POLICY IF EXISTS "Users can insert own registrations" ON public.event_registrations;
DROP POLICY IF EXISTS "Authenticated users can register for events" ON public.event_registrations;
DROP POLICY IF EXISTS "Allow authenticated inserts" ON public.event_registrations;
