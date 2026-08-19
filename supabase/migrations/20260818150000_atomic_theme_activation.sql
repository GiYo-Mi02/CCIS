BEGIN;

-- Keep the newest active row if an earlier deployment left duplicates behind.
WITH ranked AS (
  SELECT
    id,
    row_number() OVER (ORDER BY created_at DESC, id DESC) AS row_number
  FROM public.theme_settings
  WHERE is_active
)
UPDATE public.theme_settings AS themes
SET is_active = false
FROM ranked
WHERE themes.id = ranked.id
  AND ranked.row_number > 1;

CREATE UNIQUE INDEX IF NOT EXISTS theme_settings_one_active_idx
  ON public.theme_settings (is_active)
  WHERE is_active;

CREATE OR REPLACE FUNCTION public.activate_theme(
  p_theme_id UUID DEFAULT NULL,
  p_preset_name TEXT DEFAULT NULL,
  p_primary_color TEXT DEFAULT NULL,
  p_accent_color TEXT DEFAULT NULL,
  p_canvas_color TEXT DEFAULT NULL
)
RETURNS public.theme_settings
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_theme_id UUID := p_theme_id;
  v_theme public.theme_settings;
BEGIN
  IF public.get_user_role() <> 'devcom_head' THEN
    RAISE EXCEPTION 'Only devcom_head users can activate themes';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('theme_settings:active'));

  IF v_theme_id IS NULL THEN
    IF p_preset_name IS NULL
       OR p_primary_color IS NULL
       OR p_accent_color IS NULL
       OR p_canvas_color IS NULL THEN
      RAISE EXCEPTION 'Theme details are required';
    END IF;

    SELECT id INTO v_theme_id
    FROM public.theme_settings
    WHERE preset_name = p_preset_name
    ORDER BY created_at DESC, id DESC
    LIMIT 1
    FOR UPDATE;

    IF v_theme_id IS NULL THEN
      INSERT INTO public.theme_settings (
        preset_name,
        primary_color,
        accent_color,
        canvas_color,
        is_active
      ) VALUES (
        p_preset_name,
        p_primary_color,
        p_accent_color,
        p_canvas_color,
        false
      )
      RETURNING id INTO v_theme_id;
    ELSE
      UPDATE public.theme_settings
      SET primary_color = p_primary_color,
          accent_color = p_accent_color,
          canvas_color = p_canvas_color
      WHERE id = v_theme_id;
    END IF;
  END IF;

  UPDATE public.theme_settings
  SET is_active = false
  WHERE is_active;

  UPDATE public.theme_settings
  SET is_active = true
  WHERE id = v_theme_id
  RETURNING * INTO v_theme;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Theme not found';
  END IF;

  RETURN v_theme;
END;
$$;

REVOKE ALL ON FUNCTION public.activate_theme(UUID, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.activate_theme(UUID, TEXT, TEXT, TEXT, TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.activate_theme(UUID, TEXT, TEXT, TEXT, TEXT) TO authenticated;

COMMIT;
