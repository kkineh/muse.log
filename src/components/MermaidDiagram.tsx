'use client';

import { useEffect, useRef, useState } from 'react';

interface MermaidDiagramProps {
  chart: string;
}

export default function MermaidDiagram({ chart }: MermaidDiagramProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!ref.current) return;

    const render = async () => {
      try {
        const mermaid = (await import('mermaid')).default;
        const css = getComputedStyle(document.documentElement);
        const accent = css.getPropertyValue('--neural-accent').trim() || '#38BDF8';
        const sub = css.getPropertyValue('--neural-node-sub').trim() || '#8B5CF6';
        const accentRgb = (css.getPropertyValue('--accent-rgb').trim() || '56 189 248').split(' ').join(',');
        mermaid.initialize({
          startOnLoad: false,
          theme: 'base',
          wrap: true,
          flowchart: { useMaxWidth: true, htmlLabels: true },
          themeVariables: {
            primaryColor: '#0a0e16',
            primaryTextColor: '#E2E8F0',
            primaryBorderColor: accent,
            lineColor: sub,
            secondaryColor: '#0a0e16',
            tertiaryColor: '#0a0e16',
            background: '#080B10',
            mainBkg: '#0a0e16',
            nodeBorder: accent,
            clusterBkg: `rgba(${accentRgb},0.03)`,
            titleColor: '#6B7280',
            edgeLabelBackground: '#0a0e16',
            fontFamily: 'IBM Plex Mono, monospace',
            fontSize: '13px',
          },
        });

        const id = `mermaid-${Math.random().toString(36).slice(2)}`;
        const { svg } = await mermaid.render(id, chart.trim());
        if (ref.current) {
          ref.current.innerHTML = svg;
          setError(null);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Mermaid 렌더링 실패');
      }
    };

    render();
  }, [chart]);

  if (error) {
    return <pre className="mermaid-error">{error}</pre>;
  }

  return <div ref={ref} className="mermaid-container" />;
}
