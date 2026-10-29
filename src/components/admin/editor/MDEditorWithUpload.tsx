'use client';

import {
  useRef,
  useState,
  useCallback,
  useMemo,
  useImperativeHandle,
  forwardRef,
  DragEvent,
  ClipboardEvent,
} from 'react';
import dynamic from 'next/dynamic';
import { ImagePlus } from 'lucide-react';

const MDEditor = dynamic(() => import('@uiw/react-md-editor'), { ssr: false });
const MermaidPreview = dynamic(() => import('@/components/MermaidDiagram'), { ssr: false });

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const MAX_SIZE = 5 * 1024 * 1024; // 5MB

export interface MDEditorWithUploadRef {
  /** submit 시 호출: blob URL → 실제 URL로 교체된 content 반환 */
  uploadPendingImages: (content: string) => Promise<string>;
  /** 취소 시 호출: blob URL revoke */
  cleanup: () => void;
}

interface Props {
  value: string;
  onChange: (value: string) => void;
  height?: number;
  /** 'preview'면 읽기 전용 미리보기 (brain 출신 글) */
  preview?: 'live' | 'edit' | 'preview';
}

// blobUrl → File 매핑
type PendingImage = { blobUrl: string; file: File; altText: string };

const MDEditorWithUpload = forwardRef<MDEditorWithUploadRef, Props>(
  ({ value, onChange, height = 500, preview }, ref) => {
    const [dragOver, setDragOver] = useState(false);
    const editorRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const pendingRef = useRef<PendingImage[]>([]);

    const extractText = (node: React.ReactNode): string => {
      if (typeof node === 'string') return node;
      if (typeof node === 'number') return String(node);
      if (Array.isArray(node)) return node.map(extractText).join('');
      if (node && typeof node === 'object' && 'props' in node) {
        return extractText((node as React.ReactElement<{ children?: React.ReactNode }>).props.children);
      }
      return '';
    };

    const previewComponents = useMemo(() => ({
      pre({ children, ...props }: React.HTMLAttributes<HTMLPreElement>) {
        const child = Array.isArray(children) ? children[0] : children;
        if (
          child &&
          typeof child === 'object' &&
          'props' in child
        ) {
          const codeEl = child as React.ReactElement<{ className?: string; children?: React.ReactNode }>;
          if (codeEl.props.className?.includes('language-mermaid')) {
            return <MermaidPreview chart={extractText(codeEl.props.children)} />;
          }
        }
        return <pre {...props}>{children}</pre>;
      },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }), []);

    const insertMarkdown = useCallback(
      (markdown: string) => {
        const textarea = editorRef.current?.querySelector('textarea');
        if (textarea) {
          const start = textarea.selectionStart ?? value.length;
          const end = textarea.selectionEnd ?? value.length;
          const newValue = value.slice(0, start) + markdown + value.slice(end);
          onChange(newValue);
          requestAnimationFrame(() => {
            textarea.selectionStart = start + markdown.length;
            textarea.selectionEnd = start + markdown.length;
            textarea.focus();
          });
        } else {
          onChange(value + '\n' + markdown);
        }
      },
      [value, onChange]
    );

    const addImage = useCallback(
      (file: File) => {
        if (!ALLOWED_TYPES.includes(file.type)) {
          alert('지원하지 않는 형식입니다. (jpg, png, gif, webp만 가능)');
          return;
        }
        if (file.size > MAX_SIZE) {
          alert('파일 크기가 5MB를 초과합니다.');
          return;
        }
        const blobUrl = URL.createObjectURL(file);
        const altText = file.name.replace(/\.[^/.]+$/, '');
        pendingRef.current.push({ blobUrl, file, altText });
        insertMarkdown(`![${altText}](${blobUrl})`);
      },
      [insertMarkdown]
    );

    useImperativeHandle(ref, () => ({
      async uploadPendingImages(content: string): Promise<string> {
        const pending = pendingRef.current;
        if (pending.length === 0) return content;

        let result = content;
        for (const { blobUrl, file, altText } of pending) {
          if (!result.includes(blobUrl)) {
            // 에디터에서 삭제된 이미지 — revoke만
            URL.revokeObjectURL(blobUrl);
            continue;
          }
          const formData = new FormData();
          formData.append('file', file);
          formData.append('alt_text', altText);
          const res = await fetch('/api/media', { method: 'POST', body: formData });
          if (!res.ok) {
            const err = await res.json();
            throw new Error(err.error || '이미지 업로드 실패');
          }
          const data = await res.json();
          result = result.replaceAll(blobUrl, data.url);
          URL.revokeObjectURL(blobUrl);
        }
        pendingRef.current = [];
        return result;
      },
      cleanup() {
        for (const { blobUrl } of pendingRef.current) {
          URL.revokeObjectURL(blobUrl);
        }
        pendingRef.current = [];
      },
    }));

    const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) addImage(file);
      e.target.value = '';
    };

    const handleDrop = (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files?.[0];
      if (file && file.type.startsWith('image/')) addImage(file);
    };

    const handlePaste = (e: ClipboardEvent<HTMLDivElement>) => {
      const items = Array.from(e.clipboardData.items);
      const imageItem = items.find((item) => item.type.startsWith('image/'));
      if (imageItem) {
        const file = imageItem.getAsFile();
        if (file) {
          e.preventDefault();
          addImage(file);
        }
      }
    };

    return (
      <div
        ref={editorRef}
        onDrop={handleDrop}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onPaste={handlePaste}
        className={`relative rounded-[var(--t-radius)] ${
          dragOver ? 'outline-2 outline-dashed outline-[var(--t-accent)]' : 'outline-none'
        }`}
      >
        {/* Upload toolbar */}
        <div className="mb-1 flex items-center gap-3 rounded-t-[var(--t-radius)] bg-[var(--t-surface)] px-3 py-2 text-sm">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="adm-btn !h-8 text-xs"
          >
            <ImagePlus size={15} />
            이미지 첨부
          </button>
          <span className="adm-hint !mt-0">
            드래그&드롭 또는 Ctrl+V로도 첨부 가능 · 글 저장 시 업로드됩니다
          </span>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/gif,image/webp"
          onChange={handleFileInput}
          className="hidden"
        />

        {dragOver && (
          <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-[var(--t-radius)] bg-[color-mix(in_srgb,var(--t-accent)_8%,transparent)]">
            <span className="text-base font-semibold text-[var(--t-accent)]">
              이미지를 놓으세요
            </span>
          </div>
        )}

        <div data-color-mode="light" className="overflow-hidden rounded-[var(--t-radius)]">
          <MDEditor
            value={value}
            onChange={(val) => onChange(val || '')}
            height={height}
            preview={preview}
            previewOptions={{ components: previewComponents }}
          />
        </div>

        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }
);

MDEditorWithUpload.displayName = 'MDEditorWithUpload';

export default MDEditorWithUpload;
