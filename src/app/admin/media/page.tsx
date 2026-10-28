'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { Copy, Trash2, Upload } from 'lucide-react';
import type { Media } from '@/types/database';

export default function MediaPage() {
  const [media, setMedia] = useState<Media[]>([]);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    fetchMedia();
  }, []);

  const fetchMedia = async () => {
    const res = await fetch('/api/media');
    const data = await res.json();
    setMedia(data);
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/media', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) throw new Error('Upload failed');

      await fetchMedia();
    } catch (_error) {
      console.error('Failed to upload file:', _error);
      alert('Failed to upload file');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this file?')) return;

    try {
      await fetch(`/api/media?id=${id}`, { method: 'DELETE' });
      await fetchMedia();
    } catch (_error) {
      console.error('Failed to delete file:', _error);
      alert('Failed to delete file');
    }
  };

  const copyUrl = (url: string) => {
    navigator.clipboard.writeText(url);
    alert('URL copied to clipboard!');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="adm-h1">Media Library</h1>
          <p className="adm-sub mt-1">{media.length} total</p>
        </div>

        <label
          className={`adm-btn adm-btn-primary ${
            uploading ? 'opacity-60 pointer-events-none' : ''
          }`}
        >
          <Upload size={15} />
          {uploading ? 'Uploading...' : 'Upload Image'}
          <input
            type="file"
            accept="image/*"
            onChange={handleUpload}
            disabled={uploading}
            className="hidden"
          />
        </label>
      </div>

      {media.length === 0 ? (
        <div className="adm-panel adm-section p-12 text-center">
          <p className="mb-3" style={{ color: 'var(--text-secondary)' }}>
            No media files yet.
          </p>
          <p className="adm-sub">Upload your first image to get started</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {media.map((item) => (
            <div key={item.id} className="adm-panel p-4">
              <div
                className="aspect-square mb-3 overflow-hidden relative"
                style={{
                  background: 'var(--t-sunken)',
                  borderRadius: 'calc(var(--t-radius) - 6px)',
                }}
              >
                <Image
                  src={item.url}
                  alt={item.alt_text || item.filename}
                  fill
                  className="object-cover"
                  sizes="(max-width: 768px) 100vw, (max-width: 1024px) 33vw, 25vw"
                />
              </div>

              <p
                className="text-sm font-medium mb-1 truncate"
                style={{ color: 'var(--text-primary)' }}
              >
                {item.filename}
              </p>

              <p className="adm-sub mb-3">
                {item.size ? Math.round(item.size / 1024) : 0} KB
              </p>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => copyUrl(item.url)}
                  className="adm-btn flex-1"
                  title="Copy URL"
                  aria-label={`Copy URL of ${item.filename}`}
                >
                  <Copy size={15} /> Copy URL
                </button>

                <button
                  onClick={() => handleDelete(item.id)}
                  className="adm-icon-btn danger"
                  title="Delete"
                  aria-label={`Delete ${item.filename}`}
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
