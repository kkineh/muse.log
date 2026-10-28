'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { FaCircleUser, FaGithub, FaLinkedin } from 'react-icons/fa6';
import { MdEmail } from 'react-icons/md';
import { Settings } from 'lucide-react';
import Link from 'next/link';
import { GITHUB_URL, LINKEDIN_URL, MAIL_URL } from '@/lib/social-links';
import { NeuralNetwork } from './NeuralNetwork';
import { CenterCard } from './CenterCard';
import { NEURAL_PALETTES } from '@/lib/neural-palettes';
import { useNeuralPalette } from '@/hooks/useNeuralPalette';
import type { NeuralGraphData, NeuralNode } from '@/lib/neural-graph-builder';

const SOCIAL_LINKS = [
  { label: 'About', href: '/about', Icon: FaCircleUser, external: false },
  { label: 'GitHub', href: GITHUB_URL, Icon: FaGithub, external: true },
  { label: 'LinkedIn', href: LINKEDIN_URL, Icon: FaLinkedin, external: true },
  { label: 'Email', href: MAIL_URL, Icon: MdEmail, external: false },
  { label: 'Admin', href: '/admin', Icon: Settings, external: false },
];

const ICON_LINK_CLASS =
  'flex h-8 w-8 items-center justify-center rounded-lg transition-colors hover:bg-[rgba(255,255,255,0.05)] hover:text-[var(--neural-text-primary)]';

interface NeuralHomePageProps {
  initialGraph: NeuralGraphData;
  tagPostLinks?: { source: string; target: string; sharedCount: number }[];
}

export function NeuralHomePage({ initialGraph, tagPostLinks }: NeuralHomePageProps) {
  const router = useRouter();
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [highlightedPosts, setHighlightedPosts] = useState<string[]>([]);
  const [isChatCollapsed, setIsChatCollapsed] = useState(true);
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

      <div className="fixed bottom-[84px] right-4 z-30 flex items-center gap-1 md:bottom-[55px] md:right-8">
        {SOCIAL_LINKS.map(({ label, href, Icon, external }) =>
          href.startsWith('/') ? (
            <Link
              key={label}
              href={href}
              aria-label={label}
              className={ICON_LINK_CLASS}
              style={{ color: 'var(--neural-text-muted)' }}
            >
              <Icon size={16} />
            </Link>
          ) : (
            <a
              key={label}
              href={href}
              {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
              aria-label={label}
              className={ICON_LINK_CLASS}
              style={{ color: 'var(--neural-text-muted)' }}
            >
              <Icon size={16} />
            </a>
          )
        )}
      </div>
    </div>
  );
}
