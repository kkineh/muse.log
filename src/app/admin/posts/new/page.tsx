'use client';

import { useState, useEffect, useRef } from 'react';
import { generateSlug } from '@/lib/slug';
import { useRouter } from 'next/navigation';
import { Save, X } from 'lucide-react';
import type { Category, CategoryWithChildren } from '@/types/database';
import TagSelector from '@/components/admin/TagSelector';
import dynamic from 'next/dynamic';
import type { MDEditorWithUploadRef } from '@/components/admin/editor/MDEditorWithUpload';

const MDEditorWithUpload = dynamic(
  () => import('@/components/admin/editor/MDEditorWithUpload'),
  { ssr: false }
);

export default function NewPostPage() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [content, setContent] = useState('');
  const [excerpt, setExcerpt] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [tagIds, setTagIds] = useState<string[]>([]);
  const [published, setPublished] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);
  const editorRef = useRef<MDEditorWithUploadRef>(null);

  useEffect(() => {
    // Fetch categories
    fetch('/api/categories')
      .then((res) => res.json())
      .then((data: CategoryWithChildren[]) => {
        // Flatten tree to list
        const flattenCategories = (cats: CategoryWithChildren[]): Category[] => {
          return cats.flatMap((cat) => [
            cat,
            ...(cat.children ? flattenCategories(cat.children) : []),
          ]);
        };
        setCategories(flattenCategories(data));
      });
  }, []);

  // Auto-generate slug from title
  useEffect(() => {
    if (title) {
      setSlug(generateSlug(title));
    }
  }, [title]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const finalContent = await (editorRef.current?.uploadPendingImages(content) ?? Promise.resolve(content));

      const res = await fetch('/api/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          slug,
          content: finalContent,
          excerpt,
          category_id: categoryId || null,
          published,
          tag_ids: tagIds,
        }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to create post');
      }

      router.push('/admin/posts');
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to create post');
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="adm-h1">New Post</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="adm-panel adm-section space-y-4">
          <h2 className="adm-section-title !mb-0">Details</h2>

          <div className="adm-field">
            <label>Title *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              className="adm-input"
            />
          </div>

          <div className="adm-field">
            <label>Slug *</label>
            <input
              type="text"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              required
              className="adm-input"
            />
          </div>

          <div className="adm-field">
            <label>Category</label>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="adm-input"
            >
              <option value="">Uncategorized</option>
              {categories
                .filter((cat) => cat.level === 1)
                .map((level1) => {
                  const children = categories.filter(
                    (cat) => cat.parent_id === level1.id
                  );
                  const grandchildren = categories.filter((cat) =>
                    children.some((c) => c.id === cat.parent_id)
                  );
                  return (
                    <optgroup key={level1.id} label={level1.name}>
                      <option value={level1.id}>{level1.name}</option>
                      {children.map((level2) => (
                        <>
                          <option key={level2.id} value={level2.id}>
                            {'\u2003'}{level2.name}
                          </option>
                          {grandchildren
                            .filter((cat) => cat.parent_id === level2.id)
                            .map((level3) => (
                              <option key={level3.id} value={level3.id}>
                                {'\u2003\u2003'}{level3.name}
                              </option>
                            ))}
                        </>
                      ))}
                    </optgroup>
                  );
                })}
            </select>
          </div>

          <TagSelector selectedTagIds={tagIds} onChange={setTagIds} />

          <div className="adm-field">
            <label>Excerpt</label>
            <textarea
              value={excerpt}
              onChange={(e) => setExcerpt(e.target.value)}
              rows={3}
              className="adm-input"
            />
          </div>
        </div>

        <div className="adm-panel adm-section">
          <h2 className="adm-section-title">Content</h2>
          <div className="adm-field">
            <label>Content (Markdown) *</label>
            <MDEditorWithUpload
              ref={editorRef}
              value={content}
              onChange={setContent}
              height={500}
            />
          </div>
        </div>

        <div className="adm-panel adm-section">
          <h2 className="adm-section-title">Publish</h2>
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="published"
              checked={published}
              onChange={(e) => setPublished(e.target.checked)}
              className="h-4 w-4 accent-[var(--t-accent)]"
            />
            <label htmlFor="published" className="text-sm font-medium text-[var(--t-text2)]">
              Publish immediately
            </label>
          </div>
        </div>

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={loading}
            className="adm-btn adm-btn-primary disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Save size={15} /> {loading ? 'Creating...' : 'Create Post'}
          </button>

          <button
            type="button"
            onClick={() => { editorRef.current?.cleanup(); router.back(); }}
            className="adm-btn"
          >
            <X size={15} /> Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
