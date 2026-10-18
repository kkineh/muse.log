'use client';

import Link from 'next/link';
import { motion } from 'motion/react';
import { Pencil, Settings } from 'lucide-react';

interface AdminToolbarProps {
  slug: string;
}

const linkClass =
  'flex items-center justify-center w-10 h-10 rounded-lg transition-colors hover:bg-[rgba(255,255,255,0.05)] text-[var(--neural-text-muted)] hover:text-[var(--neural-text-primary)]';

export default function AdminToolbar({ slug }: AdminToolbarProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 }}
      className="fixed right-8 top-[88px] z-20 flex flex-col gap-1"
    >
      <Link href="/admin" aria-label="관리자" title="관리자" className={linkClass}>
        <Settings size={20} />
      </Link>
      <Link href={`/admin/posts/${slug}/edit`} aria-label="글 편집" title="글 편집" className={linkClass}>
        <Pencil size={20} />
      </Link>
    </motion.div>
  );
}
