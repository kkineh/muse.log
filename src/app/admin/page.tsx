'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import type { DashboardData } from '@/types/database';
import PostTimelineChart from '@/components/admin/dashboard/PostTimelineChart';
import CategoryDistribution from '@/components/admin/dashboard/CategoryDistribution';
import PopularTags from '@/components/admin/dashboard/PopularTags';
import RecentPosts from '@/components/admin/dashboard/RecentPosts';
import PopularPosts from '@/components/admin/dashboard/PopularPosts';
import StorageGauge from '@/components/admin/dashboard/StorageGauge';

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

export default function AdminDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchDashboard() {
      try {
        const res = await fetch('/api/admin/dashboard', { cache: 'no-store' });
        if (!res.ok) throw new Error('Failed to fetch dashboard');
        const json = await res.json();
        setData(json);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load dashboard');
      } finally {
        setLoading(false);
      }
    }
    fetchDashboard();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div
            className="w-12 h-12 border-4 border-t-transparent rounded-full animate-spin mx-auto mb-4"
            style={{ borderColor: 'var(--color-primary)' }}
          />
          <p style={{ color: 'var(--text-secondary)' }}>Loading...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="text-center py-12">
        <p style={{ color: 'var(--text-secondary)' }}>
          {error || 'Failed to load dashboard'}
        </p>
      </div>
    );
  }

  const cards = [
    { title: 'Posts', value: data.total_posts },
    { title: 'Published', value: data.published_posts },
    { title: 'Drafts', value: data.draft_posts },
    { title: 'Categories', value: data.total_categories },
    { title: 'Media', value: data.total_media },
    { title: 'Storage', value: formatBytes(data.storage_used) },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="adm-h1">Dashboard</h1>
        <Link href="/admin/posts/new" className="adm-btn adm-btn-primary">
          <Plus size={15} /> New post
        </Link>
      </div>

      <div className="adm-dash">
        <div className="adm-stats">
          {cards.map((card) => (
            <div key={card.title} className="adm-stat">
              <div className="adm-label">{card.title}</div>
              <div className="adm-stat-value">{card.value}</div>
            </div>
          ))}
        </div>

        <div>
          <PostTimelineChart data={data.post_timeline} />
        </div>
        <div>
          <StorageGauge storageUsed={data.storage_used} totalMedia={data.total_media} />
        </div>
        <div className="d-half">
          <RecentPosts data={data.recent_posts} />
        </div>
        <div className="d-half">
          <PopularPosts data={data.popular_posts} />
        </div>
        <div className="d-half">
          <PopularTags data={data.popular_tags} />
        </div>
        <div className="d-half">
          <CategoryDistribution data={data.category_distribution} />
        </div>
      </div>
    </div>
  );
}
