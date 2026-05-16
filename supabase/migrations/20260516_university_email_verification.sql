BEGIN;

CREATE TABLE IF NOT EXISTS public.approved_university_email_domains (
  domain TEXT PRIMARY KEY,
  university TEXT NOT NULL
);

INSERT INTO public.approved_university_email_domains (domain, university)
VALUES
  ('@students.wits.ac.za', 'University of the Witwatersrand (Wits)'),
  ('@tuks.co.za', 'University of Pretoria (UP)'),
  ('@student.uj.ac.za', 'University of Johannesburg (UJ)'),
  ('@tut4life.ac.za', 'Tshwane University of Technology (TUT)'),
  ('@vut.ac.za', 'Vaal University of Technology (VUT)'),
  ('@mylife.unisa.ac.za', 'UNISA'),
  ('@myuct.ac.za', 'University of Cape Town (UCT)'),
  ('@sun.ac.za', 'Stellenbosch University'),
  ('@myuwc.ac.za', 'University of the Western Cape (UWC)'),
  ('@mycput.ac.za', 'Cape Peninsula University of Technology (CPUT)'),
  ('@stu.ukzn.ac.za', 'University of KwaZulu-Natal (UKZN)'),
  ('@dut4life.ac.za', 'Durban University of Technology (DUT)'),
  ('@mut.ac.za', 'Mangosuthu University of Technology (MUT)'),
  ('@unizulu.ac.za', 'University of Zululand'),
  ('@campus.ru.ac.za', 'Rhodes University'),
  ('@wsu.ac.za', 'Walter Sisulu University'),
  ('@mandela.ac.za', 'Nelson Mandela University'),
  ('@ufh.ac.za', 'University of Fort Hare'),
  ('@ufs.ac.za', 'University of the Free State (UFS)'),
  ('@cut.ac.za', 'Central University of Technology (CUT)'),
  ('@mynwu.ac.za', 'North-West University (NWU)'),
  ('@ul.ac.za', 'University of Limpopo'),
  ('@ump.ac.za', 'University of Mpumalanga'),
  ('@spu.ac.za', 'Sol Plaatje University')
ON CONFLICT (domain) DO UPDATE
SET university = EXCLUDED.university;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_verified BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS verified_university TEXT;

CREATE INDEX IF NOT EXISTS idx_profiles_is_verified
ON public.profiles (is_verified);

CREATE OR REPLACE FUNCTION public.resolve_university_verification(p_email TEXT)
RETURNS TABLE (
  is_verified BOOLEAN,
  verified_university TEXT
)
LANGUAGE SQL
STABLE
SET search_path = public
AS $$
  WITH sanitised AS (
    SELECT lower(btrim(COALESCE(p_email, ''))) AS email
  )
  SELECT
    matched.domain IS NOT NULL AS is_verified,
    matched.university AS verified_university
  FROM sanitised
  LEFT JOIN LATERAL (
    SELECT domain, university
    FROM public.approved_university_email_domains
    WHERE sanitised.email <> ''
      AND position('@' IN sanitised.email) > 1
      AND right(sanitised.email, char_length(domain)) = domain
    ORDER BY char_length(domain) DESC
    LIMIT 1
  ) AS matched ON TRUE;
$$;

CREATE OR REPLACE FUNCTION public.apply_profile_verification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  verification_record RECORD;
BEGIN
  NEW.email := NULLIF(lower(btrim(COALESCE(NEW.email, ''))), '');

  SELECT *
    INTO verification_record
    FROM public.resolve_university_verification(NEW.email);

  NEW.is_verified := COALESCE(verification_record.is_verified, FALSE);
  NEW.verified_university := CASE
    WHEN COALESCE(verification_record.is_verified, FALSE) THEN verification_record.verified_university
    ELSE NULL
  END;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profiles_apply_verification ON public.profiles;

CREATE TRIGGER trg_profiles_apply_verification
BEFORE INSERT OR UPDATE OF email, is_verified, verified_university
ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.apply_profile_verification();

UPDATE public.profiles
SET email = email;

COMMIT;
