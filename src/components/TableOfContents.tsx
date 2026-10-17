'use client';

import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { motion } from 'motion/react';
import { useScrollSpy } from '@/hooks/useScrollSpy';
import type { TocItem } from '@/types/category';

interface TableOfContentsProps {
  content: string;
  scrollContainerRef?: React.RefObject<HTMLElement | null>;
}

export default function TableOfContents({
  scrollContainerRef,
}: TableOfContentsProps) {
  const [items, setItems] = useState<TocItem[]>([]);
  const headingIds = useMemo(() => items.map((item) => item.id), [items]);
  const activeId = useScrollSpy(headingIds, scrollContainerRef?.current);
  const listRef = useRef<HTMLDivElement>(null);

  const targetRef = useRef<number | null>(null);
  const frameRef = useRef(0);

  // 활성 제목이 목차 스크롤 영역 밖으로 나가면 보이는 위치로 따라간다 (프레임마다 이징)
  useEffect(() => {
    const box = listRef.current;
    if (!box || !activeId) return;
    const el = box.querySelector<HTMLElement>(`[data-toc-id="${CSS.escape(activeId)}"]`);
    if (!el) return;
    const pad = 24;
    const top = el.offsetTop;
    const bottom = top + el.offsetHeight;
    const max = box.scrollHeight - box.clientHeight;
    const from = targetRef.current ?? box.scrollTop;
    let next = from;
    if (top - pad < from) next = top - pad;
    else if (bottom + pad > from + box.clientHeight) next = bottom + pad - box.clientHeight;
    next = Math.min(max, Math.max(0, next));
    if (next === from && targetRef.current === null) return;
    targetRef.current = next;

    if (frameRef.current) return;
    const step = () => {
      const target = targetRef.current;
      if (target === null) { frameRef.current = 0; return; }
      const diff = target - box.scrollTop;
      if (Math.abs(diff) < 0.5) {
        box.scrollTop = target;
        targetRef.current = null;
        frameRef.current = 0;
        return;
      }
      box.scrollTop += diff * 0.12;
      frameRef.current = requestAnimationFrame(step);
    };
    frameRef.current = requestAnimationFrame(step);
  }, [activeId]);

  useEffect(() => () => cancelAnimationFrame(frameRef.current), []);

  const extractHeadingsFromDOM = useCallback(() => {
    const container = scrollContainerRef?.current;
    if (!container) return;

    const prose = container.querySelector('.post-prose');
    if (!prose) return;

    const headings = prose.querySelectorAll('h1[id], h2[id], h3[id]');
    const extracted: TocItem[] = Array.from(headings).map((el) => ({
      id: el.id,
      text: el.textContent || '',
      level: (el.tagName === 'H1' ? 1 : el.tagName === 'H2' ? 2 : 3) as 1 | 2 | 3,
    }));

    if (extracted.length > 0) {
      setItems(extracted);
    }
  }, [scrollContainerRef]);

  useEffect(() => {
    // DOM 렌더링 완료 후 헤딩 추출
    const timer = setTimeout(extractHeadingsFromDOM, 500);
    return () => clearTimeout(timer);
  }, [extractHeadingsFromDOM]);

  if (items.length === 0) return null;

  // 상대 레벨 계산: 글에서 실제 사용된 최소 헤딩 레벨을 기준으로 정규화
  const minLevel = Math.min(...items.map((item) => item.level));
  const getRelativeLevel = (level: number) =>
    Math.min(level - minLevel, 2) as 0 | 1 | 2;

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (element && scrollContainerRef?.current) {
      const offsetTop = element.offsetTop - 150;
      scrollContainerRef.current.scrollTo({
        top: offsetTop,
        behavior: 'smooth',
      });
    } else if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <motion.div
      initial={{ x: 100, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ delay: 0.5 }}
      className="fixed right-6 top-1/2 -translate-y-1/2 z-20 w-[220px] hidden xl:block"
    >
      <div
        ref={listRef}
        className="p-4"
        style={{
          position: 'relative',
          maxHeight: '60vh',
          overflowY: 'auto',
          scrollbarWidth: 'thin',
          scrollbarColor: 'var(--neural-line) transparent',
        }}
      >
        <div className="space-y-0.5">
            {items.map((item, index) => (
              <div key={item.id}>
                <motion.button
                  data-toc-id={item.id}
                  onClick={() => scrollToSection(item.id)}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.6 + index * 0.05 }}
                  className={`block w-full text-left px-2 py-1.5 transition-colors ${
                    activeId === item.id
                      ? ''
                      : 'text-[var(--neural-text-muted)] hover:text-[var(--neural-text-primary)]'
                  }`}
                  style={{
                    paddingLeft: `${0.5 + getRelativeLevel(item.level) * 0.75}rem`,
                    color: activeId === item.id ? 'var(--neural-accent)' : undefined,
                  }}
                >
                  <span
                    className="block truncate"
                    style={{
                      fontFamily: 'var(--font-ibm-plex-mono), sans-serif',
                      fontWeight: getRelativeLevel(item.level) === 0 ? 700 : 500,
                      fontSize: getRelativeLevel(item.level) === 0 ? '13px' : '12px',
                    }}
                  >
                    {item.text}
                  </span>
                </motion.button>
              </div>
            ))}
          </div>
      </div>
    </motion.div>
  );
}
