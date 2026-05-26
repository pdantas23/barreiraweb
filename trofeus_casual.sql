ALTER TABLE public.profiles DROP COLUMN IF EXISTS elo;

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS trofeus_casual INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS profiles_trofeus_casual_idx ON public.profiles (trofeus_casual DESC, username ASC);

CREATE OR REPLACE FUNCTION public.increment_trofeus_casual(p_user_id uuid, p_delta integer)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total integer;
BEGIN
  UPDATE public.profiles
     SET trofeus_casual = GREATEST(0, trofeus_casual + p_delta)
   WHERE user_id = p_user_id
   RETURNING trofeus_casual INTO v_total;
  RETURN v_total;
END;
$$;

REVOKE ALL ON FUNCTION public.increment_trofeus_casual(uuid, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.increment_trofeus_casual(uuid, integer) FROM anon;
REVOKE ALL ON FUNCTION public.increment_trofeus_casual(uuid, integer) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.increment_trofeus_casual(uuid, integer) TO service_role;
