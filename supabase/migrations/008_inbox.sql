-- 008: brain inbox (roadmap ⑤) - see docs/design/brain-inbox.md
-- admin만 읽고 쓴다. 처리 표시(processed_at)는 service role 스크립트만 한다.
BEGIN;

CREATE TABLE public.inbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  body text NOT NULL CHECK (char_length(btrim(body)) >= 1 AND char_length(body) <= 2000),
  created_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz
);
CREATE INDEX inbox_unprocessed_idx ON public.inbox (created_at) WHERE processed_at IS NULL;

ALTER TABLE public.inbox ENABLE ROW LEVEL SECURITY;
CREATE POLICY inbox_admin_select ON public.inbox FOR SELECT TO authenticated
  USING (lower(auth.jwt() ->> 'email') = lower(public.get_admin_email()));
CREATE POLICY inbox_admin_insert ON public.inbox FOR INSERT TO authenticated
  WITH CHECK (lower(auth.jwt() ->> 'email') = lower(public.get_admin_email()));

REVOKE ALL ON public.inbox FROM anon, authenticated;
GRANT SELECT ON public.inbox TO authenticated;
GRANT INSERT (body) ON public.inbox TO authenticated;   -- 시각·처리 여부는 기본값만
GRANT ALL ON public.inbox TO service_role;

COMMIT;

-- Verify:
--   select relrowsecurity from pg_class where oid = 'public.inbox'::regclass;          -- true
--   select policyname, cmd from pg_policies where tablename = 'inbox' order by 1;     -- inbox_admin_insert INSERT, inbox_admin_select SELECT
--   select grantee, privilege_type from information_schema.role_table_grants
--     where table_name = 'inbox' and grantee in ('anon', 'authenticated') order by 1, 2; -- authenticated SELECT 만
