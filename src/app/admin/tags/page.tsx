'use client';

import { useState, useEffect } from 'react';
import type { TagWithPostCount } from '@/types/database';
import { tagColor, tagMix } from '@/lib/tag-color';

export default function TagsPage() {
  const [tags, setTags] = useState<TagWithPostCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editSlug, setEditSlug] = useState('');
  const [editColor, setEditColor] = useState('#00FFC8');
  const [newName, setNewName] = useState('');
  const [newSlug, setNewSlug] = useState('');
  const [newColor, setNewColor] = useState('#00FFC8');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    fetchTags();
  }, []);

  const fetchTags = async () => {
    const res = await fetch('/api/tags');
    if (res.ok) {
      setTags(await res.json());
    }
    setLoading(false);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    setCreating(true);

    const slug =
      newSlug.trim() ||
      newName
        .toLowerCase()
        .replace(/[^a-z0-9가-힣ㄱ-ㅎㅏ-ㅣ\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .trim();

    const res = await fetch('/api/tags', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newName.trim(), slug, color: newColor }),
    });

    if (res.ok) {
      setNewName('');
      setNewSlug('');
      setNewColor('#00FFC8');
      fetchTags();
    } else {
      const err = await res.json();
      alert(err.error || 'Failed to create tag');
    }
    setCreating(false);
  };

  const handleUpdate = async (id: string) => {
    const res = await fetch('/api/tags', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, name: editName, slug: editSlug, color: editColor }),
    });

    if (res.ok) {
      setEditingId(null);
      fetchTags();
    } else {
      const err = await res.json();
      alert(err.error || 'Failed to update tag');
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`"${name}" 태그를 삭제하시겠습니까?`)) return;

    const res = await fetch(`/api/tags?id=${id}`, { method: 'DELETE' });
    if (res.ok) {
      fetchTags();
    } else {
      const err = await res.json();
      alert(err.error || 'Failed to delete tag');
    }
  };

  const startEdit = (tag: TagWithPostCount) => {
    setEditingId(tag.id);
    setEditName(tag.name);
    setEditSlug(tag.slug);
    setEditColor(tag.color);
  };

  if (loading) {
    return (
      <div style={{ color: 'var(--text-secondary)' }}>Loading tags...</div>
    );
  }

  return (
    <div>
      <h1
        className="text-3xl font-bold mb-8"
        style={{ color: 'var(--text-primary)' }}
      >
        Tags
      </h1>

      {/* Create new tag */}
      <form
        onSubmit={handleCreate}
        className="mb-8 p-6 rounded-lg border"
        style={{
          background: 'var(--bg-secondary)',
          borderColor: 'var(--border-color)',
        }}
      >
        <h2
          className="text-lg font-semibold mb-4"
          style={{ color: 'var(--text-primary)' }}
        >
          Create Tag
        </h2>
        <div className="flex gap-4 items-end flex-wrap">
          <div className="flex-1 min-w-[200px]">
            <label
              className="block text-sm mb-1"
              style={{ color: 'var(--text-secondary)' }}
            >
              Name *
            </label>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              required
              className="w-full px-3 py-2 rounded-lg border outline-none"
              style={{
                background: 'var(--bg-primary)',
                borderColor: 'var(--border-color)',
                color: 'var(--text-primary)',
              }}
            />
          </div>
          <div className="flex-1 min-w-[200px]">
            <label
              className="block text-sm mb-1"
              style={{ color: 'var(--text-secondary)' }}
            >
              Slug (auto-generated if empty)
            </label>
            <input
              type="text"
              value={newSlug}
              onChange={(e) => setNewSlug(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border outline-none"
              style={{
                background: 'var(--bg-primary)',
                borderColor: 'var(--border-color)',
                color: 'var(--text-primary)',
              }}
            />
          </div>
          <div>
            <label
              className="block text-sm mb-1"
              style={{ color: 'var(--text-secondary)' }}
            >
              Color
            </label>
            <input
              type="color"
              value={newColor}
              onChange={(e) => setNewColor(e.target.value)}
              className="w-12 h-10 rounded cursor-pointer border-0"
            />
          </div>
          <button
            type="submit"
            disabled={creating}
            className="px-6 py-2 rounded-lg font-medium transition-all"
            style={{
              background: creating ? 'var(--bg-tertiary)' : 'var(--color-primary)',
              color: 'white',
              opacity: creating ? 0.6 : 1,
            }}
          >
            {creating ? 'Creating...' : 'Create'}
          </button>
        </div>
      </form>

      {/* Tags list */}
      <div
        className="rounded-lg border overflow-hidden"
        style={{
          background: 'var(--bg-secondary)',
          borderColor: 'var(--border-color)',
        }}
      >
        <table className="w-full">
          <thead>
            <tr
              className="border-b"
              style={{ borderColor: 'var(--border-color)' }}
            >
              <th
                className="text-left px-6 py-3 text-sm font-medium"
                style={{ color: 'var(--text-secondary)' }}
              >
                Color
              </th>
              <th
                className="text-left px-6 py-3 text-sm font-medium"
                style={{ color: 'var(--text-secondary)' }}
              >
                Name
              </th>
              <th
                className="text-left px-6 py-3 text-sm font-medium"
                style={{ color: 'var(--text-secondary)' }}
              >
                Slug
              </th>
              <th
                className="text-left px-6 py-3 text-sm font-medium"
                style={{ color: 'var(--text-secondary)' }}
              >
                Posts
              </th>
              <th
                className="text-right px-6 py-3 text-sm font-medium"
                style={{ color: 'var(--text-secondary)' }}
              >
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {tags.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  className="px-6 py-8 text-center text-sm"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  No tags yet. Create one above.
                </td>
              </tr>
            ) : (
              tags.map((tag) => (
                <tr
                  key={tag.id}
                  className="border-b"
                  style={{ borderColor: 'var(--border-color)' }}
                >
                  {editingId === tag.id ? (
                    <>
                      <td className="px-6 py-3">
                        <input
                          type="color"
                          value={editColor}
                          onChange={(e) => setEditColor(e.target.value)}
                          className="w-8 h-8 rounded cursor-pointer border-0"
                        />
                      </td>
                      <td className="px-6 py-3">
                        <input
                          type="text"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="px-2 py-1 rounded border outline-none text-sm w-full"
                          style={{
                            background: 'var(--bg-primary)',
                            borderColor: 'var(--border-color)',
                            color: 'var(--text-primary)',
                          }}
                        />
                      </td>
                      <td className="px-6 py-3">
                        <input
                          type="text"
                          value={editSlug}
                          onChange={(e) => setEditSlug(e.target.value)}
                          className="px-2 py-1 rounded border outline-none text-sm w-full"
                          style={{
                            background: 'var(--bg-primary)',
                            borderColor: 'var(--border-color)',
                            color: 'var(--text-primary)',
                          }}
                        />
                      </td>
                      <td
                        className="px-6 py-3 text-sm"
                        style={{ color: 'var(--text-secondary)' }}
                      >
                        {tag.post_count}
                      </td>
                      <td className="px-6 py-3 text-right">
                        <button
                          onClick={() => handleUpdate(tag.id)}
                          className="text-sm px-3 py-1 rounded"
                          style={{ color: 'var(--color-primary)' }}
                        >
                          Save
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          className="text-sm px-3 py-1 rounded ml-2"
                          style={{ color: 'var(--text-secondary)' }}
                        >
                          Cancel
                        </button>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="px-6 py-3">
                        <span
                          className="w-6 h-6 rounded-full inline-block"
                          style={{ backgroundColor: tagColor(tag.color) }}
                        />
                      </td>
                      <td
                        className="px-6 py-3 text-sm font-medium"
                        style={{ color: 'var(--text-primary)' }}
                      >
                        <span
                          className="inline-flex items-center px-3 py-1 rounded-full"
                          style={{
                            backgroundColor: tagMix(tag.color, 13),
                            color: tagColor(tag.color),
                            border: `1px solid ${tagMix(tag.color, 25)}`,
                          }}
                        >
                          {tag.name}
                        </span>
                      </td>
                      <td
                        className="px-6 py-3 text-sm"
                        style={{ color: 'var(--text-secondary)' }}
                      >
                        {tag.slug}
                      </td>
                      <td
                        className="px-6 py-3 text-sm"
                        style={{ color: 'var(--text-secondary)' }}
                      >
                        {tag.post_count}
                      </td>
                      <td className="px-6 py-3 text-right">
                        <button
                          onClick={() => startEdit(tag)}
                          className="text-sm px-3 py-1 rounded"
                          style={{ color: 'var(--color-primary)' }}
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(tag.id, tag.name)}
                          className="text-sm px-3 py-1 rounded ml-2"
                          style={{ color: '#ef4444' }}
                        >
                          Delete
                        </button>
                      </td>
                    </>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
