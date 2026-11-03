-- 009: inbox 본문 수정 허용 (2026-11-03 결정) - see docs/design/brain-inbox.md
-- admin이 미처리 항목의 body만 고친다. 처리된 행(processed_at 있음)은 잠긴다. DELETE는 여전히 없다.
-- 008 머리말의 "UPDATE 없음" 설명은 이 마이그레이션으로 대체된다 (008은 고치지 않는다).
BEGIN;

CREATE POLICY inbox_admin_update ON public.inbox FOR UPDATE TO authenticated
  USING (lower(auth.jwt() ->> 'email') = lower(public.get_admin_email()) AND processed_at IS NULL)
  WITH CHECK (lower(auth.jwt() ->> 'email') = lower(public.get_admin_email()) AND processed_at IS NULL);

GRANT UPDATE (body) ON public.inbox TO authenticated;   -- 컬럼 단위만. 시각·처리 여부는 못 바꾼다

COMMIT;

-- Verify:
--   select policyname, cmd from pg_policies where tablename = 'inbox' order by 1;
--     -- inbox_admin_insert INSERT, inbox_admin_select SELECT, inbox_admin_update UPDATE
--   select column_name, privilege_type from information_schema.column_privileges
--     where table_name = 'inbox' and grantee = 'authenticated' and privilege_type = 'UPDATE' order by 1;
--     -- body 한 행만
--   select privilege_type from information_schema.role_table_grants
--     where table_name = 'inbox' and grantee = 'authenticated' order by 1;                -- SELECT 만 (테이블 단위 UPDATE/DELETE 없음)
