'use client';

import { useState, useEffect, useRef } from 'react';
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
        setTags((prev) => [...prev, newTag]);
        onChange([...selectedTagIds, newTag.id]);
        setSearch('');
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
    <div ref={containerRef} className="relative">
      <label
        className="block text-sm font-medium mb-2"
        style={{ color: 'var(--text-secondary)' }}
      >
        Tags
      </label>

      {/* Selected tags */}
      <div
        className="flex flex-wrap gap-2 p-3 rounded-lg border min-h-[48px] cursor-text"
        style={{
          background: 'var(--bg-primary)',
          borderColor: 'var(--border-color)',
        }}
        onClick={() => setIsOpen(true)}
      >
        {selectedTags.map((tag) => (
          <span
            key={tag.id}
            className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm"
            style={{
              backgroundColor: tagMix(tag.color, 13),
              color: tagColor(tag.color),
              border: `1px solid ${tagMix(tag.color, 25)}`,
            }}
          >
            {tag.name}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleToggleTag(tag.id);
              }}
              className="ml-1 hover:opacity-70"
            >
              x
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
          className="flex-1 min-w-[120px] bg-transparent outline-none text-sm"
          style={{ color: 'var(--text-primary)' }}
        />
      </div>

      {/* Dropdown */}
      {isOpen && (filteredTags.length > 0 || showCreateOption) && (
        <div
          className="absolute z-10 w-full mt-1 rounded-lg border shadow-lg max-h-48 overflow-y-auto"
          style={{
            background: 'var(--bg-secondary)',
            borderColor: 'var(--border-color)',
          }}
        >
          {filteredTags.map((tag) => (
            <button
              key={tag.id}
              type="button"
              onClick={() => {
                handleToggleTag(tag.id);
                setSearch('');
              }}
              className="w-full text-left px-4 py-2 text-sm hover:opacity-80 flex items-center gap-2"
              style={{ color: 'var(--text-primary)' }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'var(--bg-tertiary)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
              }}
            >
              <span
                className="w-3 h-3 rounded-full inline-block"
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
              className="w-full text-left px-4 py-2 text-sm flex items-center gap-2"
              style={{ color: 'var(--color-primary)' }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'var(--bg-tertiary)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
              }}
            >
              + Create &quot;{search.trim()}&quot;
            </button>
          )}
        </div>
      )}
    </div>
  );
}
