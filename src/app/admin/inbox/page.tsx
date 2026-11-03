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
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

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

  const startEdit = (item: InboxItem) => {
    setEditingId(item.id);
    setDraft(item.body);
    setEditError(null);
  };

  const cancelEdit = () => {
    if (editSaving) return;
    setEditingId(null);
    setEditError(null);
  };

  const saveEdit = async () => {
    const body = draft.trim();
    if (!editingId || !body || editSaving) return;
    setEditSaving(true);
    setEditError(null);
    try {
      const res = await fetch('/api/admin/inbox', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: editingId, body }),
      });
      if (res.status === 404) {
        setEditError('이미 처리됐거나 없는 항목입니다. 새로고침해 주세요.');
        return;
      }
      if (!res.ok) throw new Error(String(res.status));
      const { item } = (await res.json()) as { item: InboxItem };
      setItems((prev) => prev.map((it) => (it.id === item.id ? item : it)));
      setEditingId(null);
    } catch {
      setEditError('수정하지 못했습니다. 잠시 후 다시 시도해 주세요.');
    } finally {
      setEditSaving(false);
    }
  };

  const handleEditKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.nativeEvent.isComposing) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      cancelEdit();
    } else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      void saveEdit();
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
        <p className="adm-sub mt-1">미처리 {items.length}건</p>
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
                <div className="flex items-center justify-between gap-3">
                  <time className="adm-sub text-xs" dateTime={item.created_at}>
                    {new Date(item.created_at).toLocaleString()}
                  </time>
                  {editingId !== item.id && (
                    <button
                      type="button"
                      onClick={() => startEdit(item)}
                      disabled={editSaving}
                      className="adm-btn disabled:opacity-60"
                    >
                      수정
                    </button>
                  )}
                </div>
                {editingId === item.id ? (
                  <div className="mt-1">
                    <textarea
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      onKeyDown={handleEditKeyDown}
                      maxLength={MAX_CHARS}
                      rows={4}
                      disabled={editSaving}
                      autoFocus
                      className="adm-input w-full resize-y"
                    />
                    <div className="mt-3 flex items-center justify-between gap-3">
                      <span className="adm-sub">
                        {editError ?? `${draft.trim().length} / ${MAX_CHARS}`}
                      </span>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={cancelEdit}
                          disabled={editSaving}
                          className="adm-btn disabled:opacity-60"
                        >
                          취소
                        </button>
                        <button
                          type="button"
                          onClick={() => void saveEdit()}
                          disabled={editSaving || !draft.trim()}
                          className="adm-btn adm-btn-primary disabled:opacity-60"
                        >
                          {editSaving ? '저장 중...' : '저장'}
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="mt-1 whitespace-pre-wrap break-words" style={{ color: 'var(--text-primary)' }}>
                    {item.body}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
