import type { SupabaseClient } from '@supabase/supabase-js';
import type { InboxItem, InboxStore, StoreResult } from './handler.ts';

const COLUMNS = 'id, body, created_at';

function wrap<T>(data: T | null, error: { code?: string } | null): StoreResult<T> {
  if (error || data === null) return { ok: false, code: error?.code ?? 'unknown' };
  return { ok: true, value: data };
}

/** 사용자 세션 클라이언트로 만든다. RLS가 admin 여부를 한 번 더 확인한다 */
export function createInboxStore(supabase: SupabaseClient): InboxStore {
  return {
    async listUnprocessed(limit) {
      const { data, error } = await supabase
        .from('inbox')
        .select(COLUMNS)
        .is('processed_at', null)
        .order('created_at', { ascending: false })
        .limit(limit);
      return wrap(data as InboxItem[] | null, error);
    },
    async insert(body) {
      const { data, error } = await supabase
        .from('inbox')
        .insert({ body })
        .select(COLUMNS)
        .single();
      return wrap(data as InboxItem | null, error);
    },
  };
}
