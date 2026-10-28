'use client';

import * as Dialog from '@radix-ui/react-dialog';
import { Trash2 } from 'lucide-react';

interface DeleteConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categoryName: string;
  hasChildren: boolean;
  onConfirm: () => void;
}

export default function DeleteConfirmDialog({
  open,
  onOpenChange,
  categoryName,
  hasChildren,
  onConfirm,
}: DeleteConfirmDialogProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <div className="adm-root !bg-transparent">
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/70" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-[51] w-[90vw] max-w-[400px] -translate-x-1/2 -translate-y-1/2 rounded-[var(--t-radius)] bg-[var(--t-surface)] p-6 text-[var(--t-text)] shadow-[var(--t-shadow)]">
          <Dialog.Title className="adm-section-title">
            Delete Category
          </Dialog.Title>

          <p className="mb-2 text-[var(--t-text2)]">
            Are you sure you want to delete <strong>{categoryName}</strong>?
          </p>

          {hasChildren && (
            <p className="mb-4 rounded-[calc(var(--t-radius)-6px)] bg-[color-mix(in_srgb,#f87171_14%,transparent)] p-3 text-sm text-[#f87171]">
              This category has child categories. They will also be deleted.
            </p>
          )}

          <div className="flex gap-3 justify-end mt-4">
            <button
              onClick={() => onOpenChange(false)}
              className="adm-btn"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                onConfirm();
                onOpenChange(false);
              }}
              className="adm-btn adm-btn-danger"
            >
              <Trash2 size={15} /> Delete
            </button>
          </div>
        </Dialog.Content>
        </div>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
