'use client';

import { useState, useEffect } from 'react';
import { Check, Pencil, Trash2, X } from 'lucide-react';
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
    return <div className="adm-sub">Loading tags...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="adm-h1">Tags</h1>
          <p className="adm-sub mt-1">{tags.length} total</p>
        </div>
      </div>

      {/* Create new tag */}
      <form onSubmit={handleCreate} className="adm-panel adm-section">
        <h2 className="adm-section-title">Create Tag</h2>
        <div className="flex gap-4 items-end flex-wrap">
          <div className="adm-field flex-1 min-w-[200px]">
            <label>Name *</label>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              required
              className="adm-input"
            />
          </div>
          <div className="adm-field flex-1 min-w-[200px]">
            <label>Slug (auto-generated if empty)</label>
            <input
              type="text"
              value={newSlug}
              onChange={(e) => setNewSlug(e.target.value)}
              className="adm-input"
            />
          </div>
          <div className="adm-field">
            <label>Color</label>
            <input
              type="color"
              value={newColor}
              onChange={(e) => setNewColor(e.target.value)}
              className="w-12 h-[2.3rem] p-0 rounded cursor-pointer border-0 bg-transparent"
            />
          </div>
          <button
            type="submit"
            disabled={creating}
            className="adm-btn adm-btn-primary disabled:opacity-60"
          >
            {creating ? 'Creating...' : 'Create'}
          </button>
        </div>
      </form>

      {/* Tags list */}
      <div className="adm-panel">
        <table className="adm-table">
          <thead>
            <tr>
              <th>Color</th>
              <th>Name</th>
              <th>Slug</th>
              <th>Posts</th>
              <th className="right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {tags.length === 0 ? (
              <tr>
                <td colSpan={5} className="text-center">
                  No tags yet. Create one above.
                </td>
              </tr>
            ) : (
              tags.map((tag) => (
                <tr key={tag.id}>
                  {editingId === tag.id ? (
                    <>
                      <td>
                        <input
                          type="color"
                          value={editColor}
                          onChange={(e) => setEditColor(e.target.value)}
                          className="w-8 h-8 p-0 rounded cursor-pointer border-0 bg-transparent"
                        />
                      </td>
                      <td>
                        <input
                          type="text"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="adm-input"
                        />
                      </td>
                      <td>
                        <input
                          type="text"
                          value={editSlug}
                          onChange={(e) => setEditSlug(e.target.value)}
                          className="adm-input"
                        />
                      </td>
                      <td>{tag.post_count}</td>
                      <td className="right">
                        <button
                          onClick={() => handleUpdate(tag.id)}
                          className="adm-icon-btn"
                          title="Save"
                          aria-label={`Save ${tag.name}`}
                        >
                          <Check size={15} />
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          className="adm-icon-btn"
                          title="Cancel"
                          aria-label="Cancel editing"
                        >
                          <X size={15} />
                        </button>
                      </td>
                    </>
                  ) : (
                    <>
                      <td>
                        <span
                          className="w-6 h-6 rounded-full inline-block"
                          style={{ backgroundColor: tagColor(tag.color) }}
                        />
                      </td>
                      <td>
                        <span
                          className="inline-flex items-center px-3 py-1 rounded-full font-medium"
                          style={{
                            backgroundColor: tagMix(tag.color, 13),
                            color: tagColor(tag.color),
                            border: `1px solid ${tagMix(tag.color, 25)}`,
                          }}
                        >
                          {tag.name}
                        </span>
                      </td>
                      <td>{tag.slug}</td>
                      <td>{tag.post_count}</td>
                      <td className="right">
                        <button
                          onClick={() => startEdit(tag)}
                          className="adm-icon-btn"
                          title="Edit"
                          aria-label={`Edit ${tag.name}`}
                        >
                          <Pencil size={15} />
                        </button>
                        <button
                          onClick={() => handleDelete(tag.id, tag.name)}
                          className="adm-icon-btn danger"
                          title="Delete"
                          aria-label={`Delete ${tag.name}`}
                        >
                          <Trash2 size={15} />
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
