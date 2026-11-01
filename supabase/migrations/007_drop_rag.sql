-- Migration: 007_drop_rag
-- Description: drop RAG objects (chunk/embedding tables and vector search functions)
-- Apply only after the deployment that no longer calls search_chunks is live.
-- No CASCADE: if a dependent object remains, the error rolls everything back.
-- After applying, do not roll back to a pre-chat-rewrite deployment.

BEGIN;
DROP FUNCTION IF EXISTS public.search_chunks(public.vector, double precision, integer);   -- 005
DROP FUNCTION IF EXISTS public.search_posts(public.vector, double precision, integer);    -- 001
DROP TABLE    IF EXISTS public.post_chunks;                                         -- 005
DROP TABLE    IF EXISTS public.post_embeddings;                                     -- 001
COMMIT;

-- The vector type is in public (schema.sql dumps it as public.vector). The extension is left in place.
-- Verify:
--   select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--     where n.nspname = 'public' and p.proname in ('search_chunks', 'search_posts');  -- 0 rows
--   select to_regclass('public.post_chunks'), to_regclass('public.post_embeddings');  -- null, null
