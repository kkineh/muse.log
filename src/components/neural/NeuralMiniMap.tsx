'use client';

import { useCallback, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Map as MapIcon, Minimize2 } from 'lucide-react';
import { NeuralNetwork } from './NeuralNetwork';
import { NEURAL_PALETTES } from '@/lib/neural-palettes';
import { useNeuralPalette } from '@/hooks/useNeuralPalette';
import { useMinimapCollapsed } from '@/hooks/useMinimapCollapsed';
import type { NeuralGraphData, NeuralNode } from '@/lib/neural-graph-builder';

interface NeuralMiniMapProps {
  graph: NeuralGraphData;
  tagPostLinks?: { source: string; target: string; sharedCount: number }[];
  currentSlug: string;
}

const MIN_SIZE = { w: 220, h: 160 };

type Edge = 'top' | 'right' | 'corner';


function clampSize(w: number, h: number) {
  const maxW = Math.max(MIN_SIZE.w, window.innerWidth * 0.8);
  const maxH = Math.max(MIN_SIZE.h, window.innerHeight * 0.8);
  return {
    w: Math.min(maxW, Math.max(MIN_SIZE.w, w)),
    h: Math.min(maxH, Math.max(MIN_SIZE.h, h)),
  };
}

export function NeuralMiniMap({ graph, tagPostLinks, currentSlug }: NeuralMiniMapProps) {
  const router = useRouter();
  const palette = NEURAL_PALETTES[useNeuralPalette()];
  const [collapsed, setCollapsed] = useMinimapCollapsed();
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [navigatingPostId, setNavigatingPostId] = useState<string | null>(null);
  const [size, setSize] = useState(MIN_SIZE);
  const sizeRef = useRef(MIN_SIZE);
  const dragRef = useRef<{ edge: Edge; x: number; y: number; w: number; h: number } | null>(null);

  const currentNodeId = graph.postMap.get(currentSlug)?.id;

  const handleNodeClick = useCallback(
    (node: NeuralNode) => {
      if (node.type === 'post') {
        if (node.slug && node.slug !== currentSlug) {
          setNavigatingPostId(node.id);
          router.push(`/posts/${node.slug}`);
        }
      } else if (node.type === 'category' || node.type === 'subcategory') {
        setActiveCategory((prev) => (prev === node.id ? null : node.id));
      }
    },
    [router, currentSlug]
  );

  const handleBackgroundClick = useCallback(() => setActiveCategory(null), []);

  const onPointerDown = (edge: Edge) => (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = { edge, x: e.clientX, y: e.clientY, w: sizeRef.current.w, h: sizeRef.current.h };
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = dragRef.current;
    if (!d) return;
    const w = d.edge === 'top' ? d.w : d.w + (e.clientX - d.x);
    const h = d.edge === 'right' ? d.h : d.h + (d.y - e.clientY);
    sizeRef.current = clampSize(w, h);
    setSize(sizeRef.current);
  };

  const onPointerUp = () => {
    if (!dragRef.current) return;
    dragRef.current = null;
  };

  const handleProps = (edge: Edge) => ({
    onPointerDown: onPointerDown(edge),
    onPointerMove,
    onPointerUp,
    onPointerCancel: onPointerUp,
  });

  if (collapsed) {
    return (
      <button
        type="button"
        onClick={() => setCollapsed(false)}
        aria-label="미니맵 열기"
        title="미니맵 열기"
        className="fixed bottom-6 left-6 z-30 hidden h-10 w-10 items-center justify-center rounded-lg transition-colors hover:bg-[rgba(255,255,255,0.05)] md:flex text-[var(--neural-text-muted)] hover:text-[var(--neural-text-primary)]"
      >
        <MapIcon size={20} />
      </button>
    );
  }

  return (
    <div
      className="fixed bottom-6 left-6 z-30 hidden overflow-hidden rounded-xl md:block"
      style={{
        width: size.w,
        height: size.h,
        border: '1px solid var(--neural-line)',
        background: '#090b0f',
      }}
    >
      <NeuralNetwork
        variant="mini"
        data={graph.root}
        activeCategory={activeCategory}
        highlightedPosts={[]}
        onNodeClick={handleNodeClick}
        onBackgroundClick={handleBackgroundClick}
        tagPostLinks={tagPostLinks}
        navigatingPostId={navigatingPostId}
        currentPostId={currentNodeId}
        palette={palette}
      />
      <button
        type="button"
        onClick={() => {
          sizeRef.current = MIN_SIZE;
          setSize(MIN_SIZE);
          setCollapsed(true);
        }}
        aria-label="미니맵 접기"
        title="미니맵 접기"
        className="absolute right-2 top-2 z-20 flex h-7 w-7 items-center justify-center rounded-md transition-colors hover:bg-[rgba(255,255,255,0.08)] text-[var(--neural-text-muted)] hover:text-[var(--neural-text-primary)]"
      >
        <Minimize2 size={14} />
      </button>
      <div className="absolute inset-x-3 top-0 z-10 h-2 cursor-ns-resize touch-none" {...handleProps('top')} />
      <div className="absolute inset-y-3 right-0 z-10 w-2 cursor-ew-resize touch-none" {...handleProps('right')} />
      <div className="absolute right-0 top-0 z-10 h-3 w-3 cursor-nesw-resize touch-none" {...handleProps('corner')} />
    </div>
  );
}
