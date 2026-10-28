'use client';

import { useState, useRef } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { Category } from '@/types/database';
import {
  GripVertical,
  ChevronRight,
  ChevronDown,
  Plus,
  Pencil,
  Trash2,
} from 'lucide-react';

export interface FlatNode {
  id: string;
  category: Category;
  depth: number;
  hasChildren: boolean;
  childCount: number;
}

interface CategoryNodeProps {
  node: FlatNode;
  collapsed: boolean;
  onToggle: (id: string) => void;
  onEdit: (category: Category) => void;
  onDelete: (category: Category) => void;
  onAddChild: (parentId: string) => void;
  onInlineRename: (id: string, newName: string) => void;
  isOver: boolean;
}

export default function CategoryNode({
  node,
  collapsed,
  onToggle,
  onEdit,
  onDelete,
  onAddChild,
  onInlineRename,
  isOver,
}: CategoryNodeProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: node.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    paddingLeft: `${node.depth * 2}rem`,
  };

  const cat = node.category;

  function handleDoubleClick() {
    if (isDragging) return;
    setEditValue(cat.name);
    setIsEditing(true);
  }

  function commitEdit() {
    const trimmed = editValue.trim();
    if (trimmed && trimmed !== cat.name) {
      onInlineRename(cat.id, trimmed);
    }
    setIsEditing(false);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      commitEdit();
    } else if (e.key === 'Escape') {
      setIsEditing(false);
    }
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`border-t border-[var(--t-border-soft)] first:border-t-0 hover:bg-[var(--t-sunken)] ${
        isDragging ? 'bg-[var(--t-sunken)]' : ''
      }`}
    >
      {isOver && (
        <div className="mb-0.5 h-0.5 rounded-sm bg-[var(--t-accent)]" />
      )}
      <div className="flex items-center gap-2 px-4 py-3">
        {/* Drag handle */}
        <button
          {...attributes}
          {...listeners}
          className="adm-icon-btn cursor-grab active:cursor-grabbing"
          style={{ touchAction: 'none' }}
          aria-label="Drag to reorder"
        >
          <GripVertical size={15} />
        </button>

        {/* Expand/collapse */}
        {node.hasChildren ? (
          <button
            onClick={() => onToggle(node.id)}
            className="adm-icon-btn"
            aria-label={collapsed ? 'Expand' : 'Collapse'}
          >
            {collapsed ? <ChevronRight size={15} /> : <ChevronDown size={15} />}
          </button>
        ) : (
          <span className="inline-block w-8" />
        )}

        {/* Category info */}
        <div className="flex-1 min-w-0">
          {isEditing ? (
            <input
              ref={inputRef}
              autoFocus
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onBlur={commitEdit}
              onKeyDown={handleKeyDown}
              className="adm-input"
              style={{ width: 'auto', minWidth: 0 }}
            />
          ) : (
            <span
              className="cursor-pointer font-semibold text-[var(--t-text)]"
              onDoubleClick={handleDoubleClick}
              title="Double-click to rename"
            >
              {cat.name}
            </span>
          )}
          <span className="adm-sub ml-2">/{cat.slug}</span>
          <span className="ml-2 rounded-full bg-[var(--t-sunken)] px-2 py-0.5 text-xs text-[var(--t-text2)]">
            L{cat.level}
          </span>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1">
          {cat.level < 3 && (
            <button
              onClick={() => onAddChild(cat.id)}
              className="adm-icon-btn"
              title="Add child"
              aria-label={`Add child to ${cat.name}`}
            >
              <Plus size={15} />
            </button>
          )}
          <button
            onClick={() => onEdit(cat)}
            className="adm-icon-btn"
            title="Edit"
            aria-label={`Edit ${cat.name}`}
          >
            <Pencil size={15} />
          </button>
          <button
            onClick={() => onDelete(cat)}
            className="adm-icon-btn danger"
            title="Delete"
            aria-label={`Delete ${cat.name}`}
          >
            <Trash2 size={15} />
          </button>
        </div>
      </div>
    </div>
  );
}
