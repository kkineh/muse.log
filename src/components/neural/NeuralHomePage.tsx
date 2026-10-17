'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { NeuralNetwork } from './NeuralNetwork';
import { CenterCard } from './CenterCard';
import { NEURAL_PALETTES } from '@/lib/neural-palettes';
import { useNeuralPalette } from '@/hooks/useNeuralPalette';
import { useSessionStorage } from '@/hooks/useSessionStorage';
import type { NeuralGraphData, NeuralNode } from '@/lib/neural-graph-builder';

interface NeuralHomePageProps {
  initialGraph: NeuralGraphData;
  tagPostLinks?: { source: string; target: string; sharedCount: number }[];
}

export function NeuralHomePage({ initialGraph, tagPostLinks }: NeuralHomePageProps) {
  const router = useRouter();
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [highlightedPosts, setHighlightedPosts] = useState<string[]>([]);
  const [isChatCollapsed, setIsChatCollapsed] = useSessionStorage('chat-collapsed', true);
  const palette = NEURAL_PALETTES[useNeuralPalette()];
  const [navigatingPostId, setNavigatingPostId] = useState<string | null>(null);

  const handleNodeClick = useCallback((node: NeuralNode) => {
    if (node.type === 'post') {
      if (node.slug) {
        setNavigatingPostId(node.id);
        router.push(`/posts/${node.slug}`);
      }
    } else if (node.type === 'category' || node.type === 'subcategory') {
      setActiveCategory(prev => prev === node.id ? null : node.id);
    }
  }, [router]);

  const handleSlugClick = useCallback((slug: string) => {
    router.push(`/posts/${slug}`);
  }, [router]);

  const handleHighlightPosts = useCallback((slugs: string[]) => {
    const nodeIds: string[] = [];
    slugs.forEach((slug) => {
      const node = initialGraph.postMap.get(slug);
      if (node) {
        nodeIds.push(node.id);
      }
    });
    setHighlightedPosts(nodeIds);

    setTimeout(() => {
      setHighlightedPosts([]);
    }, 5000);
  }, [initialGraph.postMap]);

  const handleBackgroundClick = useCallback(() => {
    setActiveCategory(null);
  }, []);

  return (
    <div className="relative min-h-screen w-full overflow-hidden neural-bg">
      <NeuralNetwork
        data={initialGraph.root}
        activeCategory={activeCategory}
        highlightedPosts={highlightedPosts}
        onNodeClick={handleNodeClick}
        onBackgroundClick={handleBackgroundClick}
        tagPostLinks={tagPostLinks}
        navigatingPostId={navigatingPostId}
        palette={palette}
      />

      <CenterCard
        onSlugClick={handleSlugClick}
        onHighlightPosts={handleHighlightPosts}
        isCollapsed={isChatCollapsed}
        onCollapse={() => setIsChatCollapsed(true)}
        onExpand={() => setIsChatCollapsed(false)}
      />
    </div>
  );
}
