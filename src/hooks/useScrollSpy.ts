/**
 * Custom hook for scroll spy functionality
 * Tracks which heading is currently in the viewport
 */

'use client';

import { useEffect, useState } from 'react';

const ACTIVE_OFFSET = 160;

/**
 * Tracks the active heading from the scroll position, so headings are activated
 * one by one while the container scrolls past them (including smooth scrolls).
 *
 * @param headingIds - Array of heading IDs to track
 * @param root - Scroll container element
 * @returns The ID of the currently active heading
 */
export function useScrollSpy(
  headingIds: string[],
  root?: HTMLElement | null
): string {
  const [activeId, setActiveId] = useState('');

  useEffect(() => {
    if (headingIds.length === 0 || !root) return;

    let frame = 0;

    const update = () => {
      frame = 0;
      const top = root.getBoundingClientRect().top;
      const atBottom = root.scrollTop + root.clientHeight >= root.scrollHeight - 2;
      let current = '';
      for (const id of headingIds) {
        const el = document.getElementById(id);
        if (!el) continue;
        if (el.getBoundingClientRect().top - top <= ACTIVE_OFFSET + 10) current = id;
      }
      if (atBottom && root.scrollTop > 0) current = headingIds[headingIds.length - 1];
      setActiveId(current);
    };

    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };

    update();
    root.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      root.removeEventListener('scroll', onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [headingIds, root]);

  return activeId;
}
