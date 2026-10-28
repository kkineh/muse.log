'use client';

import { useState, useEffect } from 'react';
import type { Category } from '@/types/database';
import { generateSlug } from '@/lib/slug';

interface CategoryFormProps {
  initialData?: {
    name: string;
    slug: string;
    description: string;
    parent_id: string | null;
    level: 1 | 2 | 3;
  };
  allCategories: Category[];
  onSubmit: (data: {
    name: string;
    slug: string;
    description: string;
    parent_id: string | null;
    level: 1 | 2 | 3;
  }) => void;
  onCancel: () => void;
  submitLabel?: string;
}

export default function CategoryForm({
  initialData,
  allCategories,
  onSubmit,
  onCancel,
  submitLabel = 'Create',
}: CategoryFormProps) {
  const [name, setName] = useState(initialData?.name ?? '');
  const [slug, setSlug] = useState(initialData?.slug ?? '');
  const [description, setDescription] = useState(initialData?.description ?? '');
  const [parentId, setParentId] = useState<string>(initialData?.parent_id ?? '');
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(!!initialData);

  // Auto-generate slug from name
  useEffect(() => {
    if (!slugManuallyEdited && name) {
      setSlug(generateSlug(name));
    }
  }, [name, slugManuallyEdited]);

  // Determine available parents based on level constraints
  const availableParents = allCategories.filter((cat) => {
    // Can't be parent of self
    if (initialData && cat.id === (initialData as Category & { id?: string }).id) return false;
    // Only level 1 and 2 can be parents (max level 3)
    return cat.level <= 2;
  });

  const computeLevel = (pid: string | null): 1 | 2 | 3 => {
    if (!pid) return 1;
    const parent = allCategories.find((c) => c.id === pid);
    if (!parent) return 1;
    return Math.min(parent.level + 1, 3) as 1 | 2 | 3;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const pid = parentId || null;
    onSubmit({
      name,
      slug,
      description,
      parent_id: pid,
      level: computeLevel(pid),
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="adm-field">
        <label>Name *</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          className="adm-input"
        />
      </div>
      <div className="adm-field">
        <label>Slug *</label>
        <input
          type="text"
          value={slug}
          onChange={(e) => {
            setSlug(e.target.value);
            setSlugManuallyEdited(true);
          }}
          required
          className="adm-input"
        />
      </div>
      <div className="adm-field">
        <label>Parent</label>
        <select
          value={parentId}
          onChange={(e) => setParentId(e.target.value)}
          className="adm-input"
        >
          <option value="">None (Top Level)</option>
          {availableParents.map((cat) => (
            <option key={cat.id} value={cat.id}>
              {'—'.repeat(cat.level - 1)} {cat.name}
            </option>
          ))}
        </select>
        <p className="adm-hint">Level: {computeLevel(parentId || null)}</p>
      </div>
      <div className="adm-field">
        <label>Description</label>
        <input
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="adm-input"
        />
      </div>

      <div className="flex gap-3 pt-2">
        <button type="submit" className="adm-btn adm-btn-primary">
          {submitLabel}
        </button>
        <button type="button" onClick={onCancel} className="adm-btn">
          Cancel
        </button>
      </div>
    </form>
  );
}
