'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import {
  LayoutDashboard,
  FileText,
  FolderTree,
  Tag,
  Image as ImageIcon,
  Bot,
  Settings,
  ExternalLink,
  type LucideIcon,
} from 'lucide-react';
import LogoutButton from './LogoutButton';
import './admin-theme.css';

type Item = { name: string; href: string; icon: LucideIcon };
const groups: { label: string; items: Item[] }[] = [
  {
    label: 'Overview',
    items: [{ name: 'Dashboard', href: '/admin', icon: LayoutDashboard }],
  },
  {
    label: 'Content',
    items: [
      { name: 'Posts', href: '/admin/posts', icon: FileText },
      { name: 'Categories', href: '/admin/categories', icon: FolderTree },
      { name: 'Tags', href: '/admin/tags', icon: Tag },
      { name: 'Media', href: '/admin/media', icon: ImageIcon },
    ],
  },
  {
    label: 'System',
    items: [
      { name: 'RAG', href: '/admin/rag', icon: Bot },
      { name: 'Settings', href: '/admin/settings', icon: Settings },
    ],
  },
];
const flat = groups.flatMap((g) => g.items);

const useActive = () => {
  const pathname = usePathname();
  return (href: string) =>
    pathname === href || (href !== '/admin' && pathname.startsWith(href));
};

function Brand() {
  return (
    <Link
      href="/admin"
      className="flex items-center gap-2.5 font-semibold tracking-tight"
      style={{ color: 'var(--text-primary)' }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/logo-dark.svg" alt="muse.log" width={32} height={32} className="rounded-md" />
      <span>
        muse.log <span style={{ color: 'var(--text-muted)' }}>admin</span>
      </span>
    </Link>
  );
}

function MobileBar() {
  const isActive = useActive();
  return (
    <div
      className="lg:hidden sticky top-0 z-30 flex gap-1 overflow-x-auto border-b px-3 py-2"
      style={{
        background: 'var(--bg-primary)',
        borderColor: 'var(--border-color-light)',
      }}
    >
      {flat.map((i) => (
        <Link
          key={i.href}
          href={i.href}
          className="flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-sm"
          style={{
            background: isActive(i.href) ? 'var(--color-primary)' : 'transparent',
            color: isActive(i.href) ? 'var(--t-on-accent)' : 'var(--text-secondary)',
          }}
        >
          <i.icon size={15} />
          {i.name}
        </Link>
      ))}
    </div>
  );
}

function Sidebar({ email }: { email?: string }) {
  const isActive = useActive();
  return (
    <aside
      className="adm-aside hidden lg:flex sticky top-0 h-screen w-64 shrink-0 flex-col"
    >
      <div className="px-5 py-5">
        <Brand />
      </div>
      <nav className="flex-1 space-y-5 overflow-y-auto px-3">
        {groups.map((g) => (
          <div key={g.label}>
            <div
              className="mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-wider"
              style={{ color: 'var(--text-muted)' }}
            >
              {g.label}
            </div>
            {g.items.map((i) => (
              <Link
                key={i.href}
                href={i.href}
                className="relative flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-[var(--bg-tertiary)]"
                style={{
                  background: isActive(i.href) ? 'var(--bg-tertiary)' : undefined,
                  color: isActive(i.href)
                    ? 'var(--text-primary)'
                    : 'var(--text-secondary)',
                }}
              >
                {isActive(i.href) && (
                  <span
                    className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-full"
                    style={{ background: 'var(--color-primary)' }}
                  />
                )}
                <i.icon
                  size={17}
                  style={{
                    color: isActive(i.href) ? 'var(--color-primary)' : undefined,
                  }}
                />
                {i.name}
              </Link>
            ))}
          </div>
        ))}
      </nav>
      <div className="px-3">
        <Link
          href="/"
          className="flex items-center gap-3 px-3 py-2 text-sm"
          style={{ color: 'var(--text-muted)' }}
        >
          <ExternalLink size={16} /> View blog
        </Link>
      </div>
      <div
        className="m-3 flex items-center gap-3 rounded-lg border p-3"
        style={{ borderColor: 'var(--border-color-light)' }}
      >
        <div
          className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-sm font-semibold"
          style={{ background: 'var(--color-primary)', color: 'var(--t-on-accent)' }}
        >
          {email?.[0]?.toUpperCase()}
        </div>
        <div
          className="min-w-0 flex-1 truncate text-xs"
          style={{ color: 'var(--text-secondary)' }}
        >
          {email}
        </div>
      </div>
      <div className="px-3 pb-4">
        <LogoutButton />
      </div>
    </aside>
  );
}

export default function AdminShell({
  email,
  children,
}: {
  email?: string;
  children: ReactNode;
}) {
  return (
    <div className="adm-root min-h-screen">
      <div className="flex min-h-screen">
        <Sidebar email={email} />
        <div className="min-w-0 flex-1">
          <MobileBar />
          <main className="mx-auto max-w-6xl p-6 lg:p-10">{children}</main>
        </div>
      </div>
    </div>
  );
}
