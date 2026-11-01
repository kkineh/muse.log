'use client';

import { useState, useEffect } from 'react';
import type { InboxItem } from '@/types/database';

const MAX_CHARS = 2000;

export default function InboxPage() {
  const [items, setItems] = useState<InboxItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchItems = async () => {
    try {
      const res = await fetch('/api/admin/inbox', { cache: 'no-store' });
      if (!res.ok) throw new Error(String(res.status));
      setItems((await res.json()).items);
    } catch {
      setError('목록을 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchItems();
  }, []);

  const save = async () => {
    const body = text.trim();
    if (!body || saving) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/inbox', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body }),
      });
      if (!res.ok) throw new Error(String(res.status));
      setText('');
      await fetchItems();
    } catch {
      setError('저장하지 못했습니다. 잠시 후 다시 시도해 주세요.');
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void save();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.nativeEvent.isComposing) return;
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      void save();
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="adm-h1">Inbox</h1>
        <p className="adm-sub mt-1">미처리 {items.length}건 · 다음 brain 세션에서 /inbox로 처리</p>
      </div>

      <form onSubmit={handleSubmit} className="adm-panel adm-section">
        <div className="adm-field">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            maxLength={MAX_CHARS}
            rows={4}
            placeholder="떠오른 생각 한 줄"
            className="adm-input w-full resize-y"
          />
        </div>
        <div className="mt-3 flex items-center justify-between gap-3">
          <span className="adm-sub">
            {error ?? `${text.trim().length} / ${MAX_CHARS}`}
          </span>
          <button
            type="submit"
            disabled={saving || !text.trim()}
            className="adm-btn adm-btn-primary disabled:opacity-60"
          >
            {saving ? '저장 중...' : '저장'}
          </button>
        </div>
      </form>

      <div className="adm-panel adm-section">
        {loading ? (
          <p className="adm-sub">Loading...</p>
        ) : items.length === 0 ? (
          <p className="adm-sub">미처리 항목이 없습니다.</p>
        ) : (
          <ul className="space-y-4">
            {items.map((item) => (
              <li key={item.id}>
                <time className="adm-sub text-xs" dateTime={item.created_at}>
                  {new Date(item.created_at).toLocaleString()}
                </time>
                <p className="mt-1 whitespace-pre-wrap break-words" style={{ color: 'var(--text-primary)' }}>
                  {item.body}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
