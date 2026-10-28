'use client';

import * as Dialog from '@radix-ui/react-dialog';
import CategoryForm from './CategoryForm';
import type { Category } from '@/types/database';

interface CategoryFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  category: Category | null;
  allCategories: Category[];
  onSubmit: (data: {
    name: string;
    slug: string;
    description: string;
    parent_id: string | null;
    level: 1 | 2 | 3;
  }) => void;
  /** If set, pre-fill parent_id for "add child" flow */
  defaultParentId?: string | null;
}

export default function CategoryFormDialog({
  open,
  onOpenChange,
  category,
  allCategories,
  onSubmit,
  defaultParentId,
}: CategoryFormDialogProps) {
  const isEdit = !!category;

  const initialData = category
    ? {
        ...category,
        description: category.description ?? '',
      }
    : defaultParentId !== undefined
      ? {
          name: '',
          slug: '',
          description: '',
          parent_id: defaultParentId,
          level: (allCategories.find((c) => c.id === defaultParentId)
            ? Math.min(allCategories.find((c) => c.id === defaultParentId)!.level + 1, 3)
            : 1) as 1 | 2 | 3,
        }
      : undefined;

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <div className="adm-root !bg-transparent">
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/70" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-[51] w-[90vw] max-w-[500px] -translate-x-1/2 -translate-y-1/2 max-h-[85vh] overflow-y-auto rounded-[var(--t-radius)] bg-[var(--t-surface)] p-6 text-[var(--t-text)] shadow-[var(--t-shadow)]">
          <Dialog.Title className="adm-section-title text-lg">
            {isEdit ? 'Edit Category' : 'New Category'}
          </Dialog.Title>

          <CategoryForm
            initialData={initialData}
            allCategories={allCategories}
            onSubmit={(data) => {
              onSubmit(data);
              onOpenChange(false);
            }}
            onCancel={() => onOpenChange(false)}
            submitLabel={isEdit ? 'Save' : 'Create'}
          />
        </Dialog.Content>
        </div>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
