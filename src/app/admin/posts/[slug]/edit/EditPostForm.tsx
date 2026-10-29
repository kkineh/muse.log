'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Save, X } from 'lucide-react';
import type { Category, PostWithCategoryAndTags } from '@/types/database';
import TagSelector from '@/components/admin/TagSelector';
import dynamic from 'next/dynamic';
import type { MDEditorWithUploadRef } from '@/components/admin/editor/MDEditorWithUpload';

const MDEditorWithUpload = dynamic(
  () => import('@/components/admin/editor/MDEditorWithUpload'),
  { ssr: false }
);

interface EditPostFormProps {
  post: PostWithCategoryAndTags;
  categories: Category[];
}

export function EditPostForm({ post, categories }: EditPostFormProps) {
  const router = useRouter();
  const editorRef = useRef<MDEditorWithUploadRef>(null);
  const [title, setTitle] = useState(post.title);
  const [slug] = useState(post.slug);
  const [content, setContent] = useState(post.content);
  const [excerpt, setExcerpt] = useState(post.excerpt || '');
  const [categoryId, setCategoryId] = useState(post.category_id || '');
  const [tagIds, setTagIds] = useState<string[]>(
    (post.post_tags || []).map((pt) => pt.tag_id)
  );
  const [published, setPublished] = useState(post.published);
  const [loading, setLoading] = useState(false);
  // brain 출신 글은 본문·제목·excerpt·공개를 brain에서만 고친다
  const isBrain = post.origin === 'brain';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const body = isBrain
        ? { id: post.id, category_id: categoryId || null, tag_ids: tagIds }
        : {
            id: post.id,
            title,
            content: await (editorRef.current?.uploadPendingImages(content) ??
              Promise.resolve(content)),
            excerpt: excerpt || null,
            category_id: categoryId || null,
            published,
            tag_ids: tagIds,
          };

      const res = await fetch('/api/posts', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to update post');
      }

      router.push('/admin/posts');
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to update post');
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {isBrain && (
        <p className="adm-hint">
          brain에서 관리하는 글입니다. 본문과 공개 여부는 brain에서 고치세요.
        </p>
      )}
      <div className="adm-panel adm-section space-y-4">
        {/* Title */}
        <div className="adm-field">
          <label>Title *</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            disabled={isBrain}
            className={`adm-input${isBrain ? ' cursor-not-allowed opacity-60' : ''}`}
          />
        </div>

        {/* Slug (Read-only) */}
        <div className="adm-field">
          <label>Slug (Cannot be changed)</label>
          <input
            type="text"
            value={slug}
            disabled
            className="adm-input cursor-not-allowed opacity-60"
          />
          <p className="adm-hint">
            Slug cannot be modified after creation to preserve URL integrity.
          </p>
        </div>

        {/* Category */}
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

        {/* Tags */}
        <TagSelector selectedTagIds={tagIds} onChange={setTagIds} />

        {/* Excerpt */}
        <div className="adm-field">
          <label>Excerpt</label>
          <textarea
            value={excerpt}
            onChange={(e) => setExcerpt(e.target.value)}
            rows={3}
            disabled={isBrain}
            className={`adm-input${isBrain ? ' cursor-not-allowed opacity-60' : ''}`}
          />
        </div>
      </div>

      <div className="adm-panel adm-section">
        {/* Content */}
        <div className="adm-field">
          <label>Content (Markdown) *</label>
          <MDEditorWithUpload
            ref={editorRef}
            value={content}
            onChange={setContent}
            height={500}
            preview={isBrain ? 'preview' : undefined}
          />
        </div>
      </div>

      <div className="adm-panel adm-section">
        {/* Published */}
        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            id="published"
            checked={published}
            onChange={(e) => setPublished(e.target.checked)}
            disabled={isBrain}
            className={`h-5 w-5 accent-[var(--t-accent)]${isBrain ? ' cursor-not-allowed opacity-60' : ''}`}
          />
          <label
            htmlFor="published"
            className="text-sm font-medium"
            style={{ color: 'var(--t-text2)' }}
          >
            Published
          </label>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <button
          type="submit"
          disabled={loading}
          className="adm-btn adm-btn-primary disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Save size={15} /> {loading ? 'Updating...' : 'Update Post'}
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
  );
}
