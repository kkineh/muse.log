'use client';

import { useState, useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import type { Tag } from '@/types/database';
import { tagColor, tagMix } from '@/lib/tag-color';

interface TagSelectorProps {
  selectedTagIds: string[];
  onChange: (ids: string[]) => void;
}

export default function TagSelector({ selectedTagIds, onChange }: TagSelectorProps) {
  const [tags, setTags] = useState<Tag[]>([]);
  const [search, setSearch] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchTags();
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchTags = async () => {
    const res = await fetch('/api/tags');
    if (res.ok) {
      const data = await res.json();
      setTags(data);
    }
  };

  const handleToggleTag = (tagId: string) => {
    if (selectedTagIds.includes(tagId)) {
      onChange(selectedTagIds.filter((id) => id !== tagId));
    } else {
      onChange([...selectedTagIds, tagId]);
    }
  };

  const handleCreateTag = async () => {
    if (!search.trim() || creating) return;
    setCreating(true);

    const slug = search
      .toLowerCase()
      .replace(/[^a-z0-9가-힣ㄱ-ㅎㅏ-ㅣ\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();

    try {
      const res = await fetch('/api/tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: search.trim(), slug }),
      });

      if (res.ok) {
        const newTag = await res.json();
        onChange([...selectedTagIds, newTag.id]);
        setSearch('');
        await fetchTags();
      }
    } catch (error) {
      console.error('Failed to create tag:', error);
    } finally {
      setCreating(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const filtered = tags.filter(
        (t) =>
          t.name.toLowerCase().includes(search.toLowerCase()) &&
          !selectedTagIds.includes(t.id)
      );
      if (filtered.length > 0) {
        handleToggleTag(filtered[0].id);
        setSearch('');
      } else if (search.trim()) {
        handleCreateTag();
      }
    }
  };

  const filteredTags = tags.filter(
    (t) =>
      t.name.toLowerCase().includes(search.toLowerCase()) &&
      !selectedTagIds.includes(t.id)
  );

  const selectedTags = tags.filter((t) => selectedTagIds.includes(t.id));
  const showCreateOption =
    search.trim() &&
    !tags.some((t) => t.name.toLowerCase() === search.toLowerCase());

  return (
    <div ref={containerRef} className="adm-field relative">
      <label>Tags</label>

      {/* Selected tags */}
      <div
        className="flex min-h-[2.3rem] cursor-text flex-wrap gap-2 rounded-[10px] bg-[var(--t-sunken)] p-2"
        onClick={() => setIsOpen(true)}
      >
        {selectedTags.map((tag) => (
          <span
            key={tag.id}
            className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-sm"
            style={{
              backgroundColor: tagMix(tag.color, 13),
              color: tagColor(tag.color),
            }}
          >
            {tag.name}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleToggleTag(tag.id);
              }}
              className="ml-1 inline-grid place-items-center hover:opacity-70"
            >
              <X size={12} />
            </button>
          </span>
        ))}
        <input
          type="text"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={selectedTags.length === 0 ? 'Search or create tags...' : ''}
          className="min-w-[120px] flex-1 bg-transparent px-1 text-sm text-[var(--t-text)] outline-none placeholder:text-[var(--t-muted)]"
        />
      </div>

      {/* Dropdown */}
      {isOpen && (filteredTags.length > 0 || showCreateOption) && (
        <div className="absolute z-10 mt-1 max-h-48 w-full overflow-y-auto rounded-[var(--t-radius)] bg-[var(--t-surface)] py-1 shadow-[var(--t-shadow)]">
          {filteredTags.map((tag) => (
            <button
              key={tag.id}
              type="button"
              onClick={() => {
                handleToggleTag(tag.id);
                setSearch('');
              }}
              className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-[var(--t-text)] hover:bg-[var(--t-sunken)]"
            >
              <span
                className="inline-block h-3 w-3 rounded-full"
                style={{ backgroundColor: tagColor(tag.color) }}
              />
              {tag.name}
            </button>
          ))}
          {showCreateOption && (
            <button
              type="button"
              onClick={handleCreateTag}
              disabled={creating}
              className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-[var(--t-accent)] hover:bg-[var(--t-sunken)]"
            >
              + Create &quot;{search.trim()}&quot;
            </button>
          )}
        </div>
      )}
    </div>
  );
}
