'use client';

import Link from 'next/link';
import { Pencil, Settings } from 'lucide-react';

interface AdminToolbarProps {
  slug: string;
}

const linkClass =
  'flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition-colors hover:bg-[rgba(255,255,255,0.05)]';
const linkStyle = {
  color: 'var(--neural-text-muted)',
  fontFamily: 'var(--font-space-grotesk), sans-serif',
};

export default function AdminToolbar({ slug }: AdminToolbarProps) {
  return (
    <div className="flex items-center">
      <Link href="/admin" className={linkClass} style={linkStyle} title="대시보드">
        <Settings size={16} style={{ color: 'var(--neural-text-primary)' }} />
        <span>관리자</span>
      </Link>
      <Link href={`/admin/posts/${slug}/edit`} className={linkClass} style={linkStyle} title="글 편집">
        <Pencil size={16} style={{ color: 'var(--neural-text-primary)' }} />
        <span>편집</span>
      </Link>
    </div>
  );
}
