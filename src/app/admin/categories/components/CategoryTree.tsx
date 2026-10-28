'use client';

import { useState, useMemo, useCallback } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable';
import CategoryNode, { type FlatNode } from './CategoryNode';
import type { Category, CategoryWithChildren } from '@/types/database';

interface CategoryTreeProps {
  categories: CategoryWithChildren[];
  allFlat: Category[];
  onEdit: (category: Category) => void;
  onDelete: (category: Category) => void;
  onAddChild: (parentId: string) => void;
  onReorder: (updates: Array<{ id: string; parent_id: string | null; level: 1 | 2 | 3; order: number }>) => void;
  onInlineRename: (id: string, newName: string) => void;
}

function flattenTree(
  nodes: CategoryWithChildren[],
  depth: number,
  collapsedSet: Set<string>
): FlatNode[] {
  const result: FlatNode[] = [];
  for (const node of nodes) {
    const children = node.children ?? [];
    result.push({
      id: node.id,
      category: node,
      depth,
      hasChildren: children.length > 0,
      childCount: children.length,
    });
    if (children.length > 0 && !collapsedSet.has(node.id)) {
      result.push(...flattenTree(children, depth + 1, collapsedSet));
    }
  }
  return result;
}

export default function CategoryTree({
  categories,
  allFlat,
  onEdit,
  onDelete,
  onAddChild,
  onReorder,
  onInlineRename,
}: CategoryTreeProps) {
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set());
  const [activeId, setActiveId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const flatNodes = useMemo(
    () => flattenTree(categories, 0, collapsedIds),
    [categories, collapsedIds]
  );

  const activeNode = useMemo(
    () => flatNodes.find((n) => n.id === activeId) ?? null,
    [flatNodes, activeId]
  );

  const toggleCollapse = useCallback((id: string) => {
    setCollapsedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(String(event.active.id));
  };

  const handleDragOver = (event: DragOverEvent) => {
    setOverId(event.over ? String(event.over.id) : null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveId(null);
    setOverId(null);
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const activeIdx = flatNodes.findIndex((n) => n.id === active.id);
    const overIdx = flatNodes.findIndex((n) => n.id === over.id);
    if (activeIdx === -1 || overIdx === -1) return;

    const activeNode = flatNodes[activeIdx];
    const overNode = flatNodes[overIdx];

    // Determine new parent: use the same parent as the target node
    const newParentId = overNode.category.parent_id;
    const newLevel = overNode.category.level;

    // Check depth constraint: if the dragged node has children,
    // ensure max depth doesn't exceed 3
    const maxChildDepth = getMaxChildDepth(activeNode.id, allFlat);
    const depthIncrease = newLevel - activeNode.category.level;
    if (maxChildDepth + depthIncrease > 3) return;

    // Collect siblings at the target position's parent
    const siblings = flatNodes.filter(
      (n) => n.category.parent_id === newParentId && n.id !== active.id
    );

    // Insert active into siblings at the right position
    const overSiblingIdx = siblings.findIndex((n) => n.id === over.id);
    const reordered = [...siblings.map((n) => n.category)];

    // Remove active if it was already a sibling
    const existingIdx = reordered.findIndex((c) => c.id === active.id);
    if (existingIdx !== -1) reordered.splice(existingIdx, 1);

    // Insert at new position
    const insertIdx = overSiblingIdx !== -1 ? overSiblingIdx : reordered.length;
    reordered.splice(insertIdx, 0, {
      ...activeNode.category,
      parent_id: newParentId,
      level: newLevel,
    });

    // Build update list
    const updates = reordered.map((cat, idx) => ({
      id: cat.id,
      parent_id: newParentId,
      level: newLevel,
      order: idx,
    }));

    // If we moved to a different parent, also update the active node's children levels
    if (activeNode.category.parent_id !== newParentId) {
      const childUpdates = getChildLevelUpdates(activeNode.id, allFlat, depthIncrease);
      updates.push(...childUpdates);
    }

    onReorder(updates);
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <SortableContext
        items={flatNodes.map((n) => n.id)}
        strategy={verticalListSortingStrategy}
      >
        <div className="adm-panel">
          {flatNodes.map((node) => (
            <CategoryNode
              key={node.id}
              node={node}
              collapsed={collapsedIds.has(node.id)}
              onToggle={toggleCollapse}
              onEdit={onEdit}
              onDelete={onDelete}
              onAddChild={onAddChild}
              onInlineRename={onInlineRename}
              isOver={overId === node.id}
            />
          ))}
        </div>
      </SortableContext>

      <DragOverlay>
        {activeNode && (
          <div className="adm-panel flex items-center gap-3 px-4 py-3 opacity-90">
            <span className="font-semibold text-[var(--t-text)]">
              {activeNode.category.name}
            </span>
            <span className="text-sm text-[var(--t-muted)]">
              /{activeNode.category.slug}
            </span>
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}

function getMaxChildDepth(categoryId: string, allFlat: Category[]): number {
  let maxLevel = allFlat.find((c) => c.id === categoryId)?.level ?? 1;
  const queue = [categoryId];
  const visited = new Set<string>([categoryId]);

  while (queue.length > 0) {
    const current = queue.shift()!;
    const children = allFlat.filter((c) => c.parent_id === current);
    for (const child of children) {
      if (!visited.has(child.id)) {
        visited.add(child.id);
        queue.push(child.id);
        if (child.level > maxLevel) maxLevel = child.level;
      }
    }
  }

  return maxLevel;
}

function getChildLevelUpdates(
  categoryId: string,
  allFlat: Category[],
  depthIncrease: number
): Array<{ id: string; parent_id: string | null; level: 1 | 2 | 3; order: number }> {
  const updates: Array<{ id: string; parent_id: string | null; level: 1 | 2 | 3; order: number }> = [];
  const queue = [categoryId];
  const visited = new Set<string>([categoryId]);

  while (queue.length > 0) {
    const current = queue.shift()!;
    const children = allFlat.filter((c) => c.parent_id === current);
    for (const child of children) {
      if (!visited.has(child.id)) {
        visited.add(child.id);
        queue.push(child.id);
        const newLevel = Math.min(Math.max(child.level + depthIncrease, 1), 3) as 1 | 2 | 3;
        updates.push({
          id: child.id,
          parent_id: child.parent_id,
          level: newLevel,
          order: child.order,
        });
      }
    }
  }

  return updates;
}
