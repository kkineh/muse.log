'use client';

interface Props {
  storageUsed: number; // bytes
  totalMedia: number;
}

const STORAGE_LIMIT = 1024 * 1024 * 1024; // 1GB

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return (bytes / Math.pow(k, i)).toFixed(1) + ' ' + sizes[i];
}

function GaugeBar({ label, used, limit }: { label: string; used: number; limit: number }) {
  const pct = Math.min((used / limit) * 100, 100);
  const color = pct > 80 ? '#f87171' : pct > 60 ? '#fbbf24' : 'var(--t-accent)';

  return (
    <div>
      <div className="flex justify-between mb-2">
        <span className="text-sm font-medium" style={{ color: 'var(--t-text)' }}>{label}</span>
        <span className="text-sm" style={{ color: 'var(--t-text2)' }}>
          {formatBytes(used)} / {formatBytes(limit)} ({pct.toFixed(1)}%)
        </span>
      </div>
      <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--t-sunken)' }}>
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
    </div>
  );
}

export default function StorageGauge({ storageUsed, totalMedia }: Props) {
  return (
    <div className="adm-panel adm-section">
      <h3 className="adm-section-title">Storage Usage (Supabase Free Tier)</h3>
      <div className="space-y-4">
        <GaugeBar label="Media Storage" used={storageUsed} limit={STORAGE_LIMIT} />
        <div className="adm-sub pt-1">
          {totalMedia} files uploaded
        </div>
      </div>
    </div>
  );
}
