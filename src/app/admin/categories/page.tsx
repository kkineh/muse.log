'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { Plus } from 'lucide-react';
import type { Category, CategoryWithChildren } from '@/types/database';
import CategoryTree from './components/CategoryTree';
import CategoryFormDialog from './components/CategoryFormDialog';
import DeleteConfirmDialog from './components/DeleteConfirmDialog';

function flattenCategories(nodes: CategoryWithChildren[]): Category[] {
  return nodes.flatMap((node) => [
    node as Category,
    ...flattenCategories(node.children ?? []),
  ]);
}

export default function CategoriesPage() {
  const [categories, setCategories] = useState<CategoryWithChildren[]>([]);

  // Form dialog state
  const [formOpen, setFormOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [defaultParentId, setDefaultParentId] = useState<string | null>(null);

  // Delete dialog state
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletingCategory, setDeletingCategory] = useState<Category | null>(
    null
  );

  const allFlat = useMemo(() => flattenCategories(categories), [categories]);

  const fetchCategories = useCallback(async () => {
    // The GET is edge-cached for 24h; the admin list must always read fresh.
    const res = await fetch('/api/categories', { cache: 'no-store' });
    const data = await res.json();
    setCategories(data);
  }, []);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  // --- Handlers ---

  const handleEdit = useCallback((category: Category) => {
    setEditingCategory(category);
    setDefaultParentId(null);
    setFormOpen(true);
  }, []);

  const handleAddChild = useCallback((parentId: string) => {
    setEditingCategory(null);
    setDefaultParentId(parentId);
    setFormOpen(true);
  }, []);

  const handleNewCategory = useCallback(() => {
    setEditingCategory(null);
    setDefaultParentId(null);
    setFormOpen(true);
  }, []);

  const handleDelete = useCallback((category: Category) => {
    setDeletingCategory(category);
    setDeleteOpen(true);
  }, []);

  const handleFormSubmit = useCallback(
    async (data: {
      name: string;
      slug: string;
      description: string;
      parent_id: string | null;
      level: 1 | 2 | 3;
    }) => {
      try {
        const res = await fetch('/api/categories', {
          method: editingCategory ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(
            editingCategory ? { id: editingCategory.id, ...data } : data
          ),
        });
        if (!res.ok) {
          // Surface the server's reason instead of a generic message.
          const body = await res.json().catch(() => null);
          throw new Error(body?.error ?? `Request failed (${res.status})`);
        }
        await fetchCategories();
      } catch (error) {
        console.error(error);
        const action = editingCategory ? 'update' : 'create';
        alert(
          `Failed to ${action} category: ${
            error instanceof Error ? error.message : 'Unknown error'
          }`
        );
      }
    },
    [editingCategory, fetchCategories]
  );

  const handleDeleteConfirm = useCallback(async () => {
    if (!deletingCategory) return;
    try {
      const res = await fetch(`/api/categories?id=${deletingCategory.id}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Failed to delete category');
      await fetchCategories();
    } catch (error) {
      console.error(error);
      alert('Failed to delete category');
    }
  }, [deletingCategory, fetchCategories]);

  const handleReorder = useCallback(
    async (
      updates: Array<{
        id: string;
        parent_id: string | null;
        level: 1 | 2 | 3;
        order: number;
      }>
    ) => {
      try {
        const res = await fetch('/api/categories/reorder', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ updates }),
        });
        if (!res.ok) throw new Error('Failed to reorder');
        await fetchCategories();
      } catch (error) {
        console.error(error);
        alert('Failed to reorder categories');
      }
    },
    [fetchCategories]
  );

  const handleInlineRename = useCallback(
    async (id: string, newName: string) => {
      try {
        const res = await fetch('/api/categories', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id, name: newName }),
        });
        if (!res.ok) throw new Error('Failed to rename category');
        await fetchCategories();
      } catch (error) {
        console.error(error);
        alert('Failed to rename category');
      }
    },
    [fetchCategories]
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="adm-h1">Categories</h1>

        <button
          onClick={handleNewCategory}
          className="adm-btn adm-btn-primary"
        >
          <Plus size={15} /> New Category
        </button>
      </div>

      {categories.length === 0 ? (
        <div className="adm-panel p-12 text-center text-[var(--t-text2)]">
          <p>No categories yet.</p>
        </div>
      ) : (
        <CategoryTree
          categories={categories}
          allFlat={allFlat}
          onEdit={handleEdit}
          onDelete={handleDelete}
          onAddChild={handleAddChild}
          onReorder={handleReorder}
          onInlineRename={handleInlineRename}
        />
      )}

      <CategoryFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        category={editingCategory}
        allCategories={allFlat}
        onSubmit={handleFormSubmit}
        defaultParentId={defaultParentId}
      />

      <DeleteConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        categoryName={deletingCategory?.name ?? ''}
        hasChildren={
          deletingCategory
            ? allFlat.some((c) => c.parent_id === deletingCategory.id)
            : false
        }
        onConfirm={handleDeleteConfirm}
      />
    </div>
  );
}
