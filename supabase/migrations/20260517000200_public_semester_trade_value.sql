CREATE OR REPLACE FUNCTION public.get_semester_trade_value(p_semester_start TIMESTAMPTZ)
RETURNS NUMERIC
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(SUM(amount), 0)
  FROM public.offers
  WHERE status = 'accepted'
    AND created_at >= p_semester_start;
$$;

GRANT EXECUTE ON FUNCTION public.get_semester_trade_value(TIMESTAMPTZ) TO anon, authenticated;
