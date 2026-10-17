'use client';

import { useMemo, useRef, useEffect, useCallback, useState } from 'react';
import * as d3Selection from 'd3-selection';
import * as d3Drag from 'd3-drag';
import { useD3ForceSimulation } from '@/hooks/useD3ForceSimulation';
import { NeuralSignalLayer, type SignalLayerHandle } from './NeuralSignalLayer';
import { flattenNeuralGraph } from '@/lib/neural-graph-builder';
import type { NeuralNode } from '@/lib/neural-graph-builder';

interface NeuralNetworkProps {
  data: NeuralNode;
  activeCategory: string | null;
  highlightedPosts: string[];
  onNodeClick: (node: NeuralNode) => void;
  onBackgroundClick: () => void;
  tagPostLinks?: { source: string; target: string; sharedCount: number }[];
  navigatingPostId?: string | null;
}

export function NeuralNetwork({
  data,
  activeCategory,
  highlightedPosts,
  onNodeClick,
  onBackgroundClick,
  tagPostLinks,
  navigatingPostId,
}: NeuralNetworkProps) {
  const { initialNodes, links } = useMemo(() => {
    const flatNodes = flattenNeuralGraph(data);

    const linkList: { source: string; target: string; depth: number; isTagLink?: boolean; sharedCount?: number }[] = [];

    const buildLinks = (node: NeuralNode) => {
      if (node.children) {
        node.children.forEach((child) => {
          if (node.type !== 'root') {
            linkList.push({
              source: node.id,
              target: child.id,
              depth: child.level || 1,
            });
          }
          buildLinks(child);
        });
      }
    };
    buildLinks(data);

    // Add tag-based post-to-post links
    if (tagPostLinks) {
      const nodeIds = new Set(flatNodes.map(n => n.id));
      for (const tl of tagPostLinks) {
        if (nodeIds.has(tl.source) && nodeIds.has(tl.target)) {
          linkList.push({
            source: tl.source,
            target: tl.target,
            depth: 3,
            isTagLink: true,
            sharedCount: tl.sharedCount,
          });
        }
      }
    }

    return { initialNodes: flatNodes, links: linkList };
  }, [data, tagPostLinks]);

  const svgRef = useRef<SVGSVGElement>(null);
  const gRef = useRef<SVGGElement>(null);
  const nodesGRef = useRef<SVGGElement>(null);
  const signalRef = useRef<SignalLayerHandle>(null);

  const {
    nodes: allNodes,
    dragHandlers,
    transform,
  } = useD3ForceSimulation(initialNodes, links, svgRef, gRef, {
    centerX: 0,
    centerY: 0,
  });

  // Store callbacks in refs so D3 drag can access latest versions
  const onNodeClickRef = useRef(onNodeClick);
  useEffect(() => { onNodeClickRef.current = onNodeClick; }, [onNodeClick]);

  // Bind D3 drag to node <g> elements — this prevents zoom interference
  useEffect(() => {
    const nodesG = nodesGRef.current;
    if (!nodesG || allNodes.length === 0) return;

    const nodeById = new Map(allNodes.map(n => [n.id, n]));

    // Select each node <g>, bind its data, and apply d3.drag
    d3Selection.select(nodesG)
      .selectAll<SVGGElement, unknown>('g.neural-node')
      .each(function () {
        const el = d3Selection.select<SVGGElement, NeuralNode>(this);
        const nodeId = this.getAttribute('data-node-id');
        if (!nodeId) return;
        const node = nodeById.get(nodeId);
        if (!node) return;

        // Bind datum
        el.datum(node);

        // Apply D3 drag
        el.call(
          d3Drag.drag<SVGGElement, NeuralNode>()
            .on('start', (_event, d) => dragHandlers.onDragStart(d.id))
            .on('drag', (event, d) => dragHandlers.onDrag(d.id, event.x, event.y))
            .on('end', (_event, d) => dragHandlers.onDragEnd(d.id))
        );

        // Click — D3 drag already filters out drag gestures
        el.on('click', (event) => {
          event.stopPropagation();
          onNodeClickRef.current(node);
        });
      });
  }, [allNodes, dragHandlers]);

  // --- Active/dimmed logic ---
  const activeSet = useMemo(() => {
    if (!activeCategory) return null;
    const set = new Set<string>();
    set.add(activeCategory);

    const addDescendants = (nodeId: string) => {
      const node = allNodes.find((n) => n.id === nodeId);
      if (node?.children) {
        node.children.forEach((child) => {
          set.add(child.id);
          addDescendants(child.id);
        });
      }
    };
    const addAncestors = (nodeId: string) => {
      links.forEach((l) => {
        if (!l.isTagLink && l.target === nodeId && !set.has(l.source)) {
          set.add(l.source);
          addAncestors(l.source);
        }
      });
    };

    addDescendants(activeCategory);
    addAncestors(activeCategory);
    return set;
  }, [activeCategory, allNodes, links]);

  const blinkingSet = useMemo(() => {
    if (!navigatingPostId) return null;
    const set = new Set<string>();
    set.add(navigatingPostId);
    const addAncestors = (nodeId: string) => {
      links.forEach((l) => {
        if (!l.isTagLink && l.target === nodeId && !set.has(l.source)) {
          set.add(l.source);
          addAncestors(l.source);
        }
      });
    };
    addAncestors(navigatingPostId);
    return set;
  }, [navigatingPostId, links]);

  const isNodeActive = useCallback(
    (nodeId: string) => {
      if (highlightedPosts.includes(nodeId)) return true;
      return activeSet?.has(nodeId) ?? false;
    },
    [activeSet, highlightedPosts]
  );

  const isNodeDimmed = useCallback(
    (nodeId: string) => {
      if (!activeCategory) return false;
      if (highlightedPosts.includes(nodeId)) return false;
      return !activeSet?.has(nodeId);
    },
    [activeCategory, activeSet, highlightedPosts]
  );

  const isLinkDimmed = useCallback(
    (source: string, target: string) => {
      if (!activeCategory) return false;
      return !(activeSet?.has(source) && activeSet?.has(target));
    },
    [activeCategory, activeSet]
  );

  const isLinkActive = useCallback(
    (source: string, target: string) => {
      if (!activeSet) return false;
      return activeSet.has(source) && activeSet.has(target);
    },
    [activeSet]
  );

  const nodeMap = useMemo(() => new Map(allNodes.map((n) => [n.id, n])), [allNodes]);

  const [windowSize, setWindowSize] = useState({ w: 1920, h: 1080 });
  useEffect(() => {
    setWindowSize({ w: window.innerWidth, h: window.innerHeight });
    const onResize = () => setWindowSize({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  return (
    <div className="fixed inset-0 overflow-hidden">
      <svg
        ref={svgRef}
        className="absolute inset-0 w-full h-full"
        width={windowSize.w}
        height={windowSize.h}
        onClick={(e) => {
          onBackgroundClick();
          signalRef.current?.emit(e.clientX, e.clientY);
        }}
      >
        <g ref={gRef}>
          {/* SVG filter for tag link glow */}
          <defs>
            <filter id="tag-link-glow-1" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="1.5" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <filter id="tag-link-glow-2" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="4" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <filter id="tag-link-glow-3" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="6" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="blur" />
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Edges */}
          {links.map((link) => {
            const src = nodeMap.get(link.source);
            const tgt = nodeMap.get(link.target);
            if (!src || !tgt) return null;

            const active = isLinkActive(link.source, link.target);
            const dimmed = isLinkDimmed(link.source, link.target);
            const isTagLink = !!link.isTagLink;

            let edgeStroke: string;
            let edgeWidth: number;
            let glowFilter: string | undefined;

            const sharedCount = link.sharedCount || 1;
            if (isTagLink) {
              edgeStroke = '#ffffff';
              edgeWidth = 0.7;
              glowFilter = dimmed ? undefined
                : sharedCount >= 3 ? 'url(#tag-link-glow-3)'
                : sharedCount >= 2 ? 'url(#tag-link-glow-2)'
                : 'url(#tag-link-glow-1)';
            } else {
              edgeStroke = link.depth === 3 ? '#fde047' : '#00FFC8';
              edgeWidth = link.depth === 1 ? 1.5 : link.depth === 2 ? 1 : 0.7;
            }

            return (
              <line
                key={`${link.source}-${link.target}${isTagLink ? '-tag' : ''}`}
                x1={src.x || 0}
                y1={src.y || 0}
                x2={tgt.x || 0}
                y2={tgt.y || 0}
                stroke={edgeStroke}
                strokeWidth={edgeWidth}
                strokeDasharray="3 3"
                opacity={dimmed ? 0.05 : active ? 0.7 : isTagLink ? Math.min(0.8, 0.08 + sharedCount * 0.3) : 0.25}
                filter={glowFilter}
                className="transition-opacity duration-300"
              />
            );
          })}

          {/* Nodes — D3 drag is bound via useEffect, not React pointer handlers */}
          <g ref={nodesGRef}>
            {allNodes.map((node) => {
              const x = node.x || 0;
              const y = node.y || 0;
              const w = node.w || 60;
              const h = node.h || 28;
              const depth = node.level || 3;

              const active = isNodeActive(node.id);
              const dimmed = isNodeDimmed(node.id);
              const highlighted = highlightedPosts.includes(node.id);
              const blinking = blinkingSet?.has(node.id) ?? false;

              let fill: string, stroke: string, strokeWidth: number;
              let labelFill: string, fontSize: number, fontWeight: number;

              if (depth === 1) {
                fill = 'rgba(0,255,200,0.12)';
                stroke = 'rgba(0,255,200,0.7)';
                strokeWidth = 1.5;
                labelFill = '#00FFC8';
                fontSize = 13;
                fontWeight = 500;
              } else if (depth === 2) {
                fill = 'rgba(167,139,250,0.1)';
                stroke = 'rgba(167,139,250,0.6)';
                strokeWidth = 1;
                labelFill = '#c4b5fd';
                fontSize = 11;
                fontWeight = 400;
              } else if (depth === 3 && node.type === 'subcategory') {
                fill = 'rgba(250,204,21,0.1)';
                stroke = 'rgba(250,204,21,0.6)';
                strokeWidth = 1;
                labelFill = '#fde047';
                fontSize = 10;
                fontWeight = 400;
              } else {
                fill = 'rgba(255,255,255,0.06)';
                stroke = 'rgba(255,255,255,0.25)';
                strokeWidth = 0.8;
                labelFill = '#b0bec5';
                fontSize = 10;
                fontWeight = 300;
              }

              const glowColor =
                depth === 1
                  ? '#00FFC8'
                  : depth === 2
                    ? '#a78bfa'
                    : depth === 3 && node.type === 'subcategory'
                      ? '#facc15'
                      : '#fff';
              const glowFilter =
                active || highlighted || blinking
                  ? `drop-shadow(0 0 8px ${glowColor})`
                  : undefined;

              return (
                <g
                  key={node.id}
                  className="neural-node cursor-pointer"
                  data-node-id={node.id}
                  transform={`translate(${x},${y})`}
                  opacity={dimmed && !blinking ? 0.15 : 1}
                  style={{ transition: 'opacity 0.3s' }}
                >
                  {/* Opaque background to hide lines behind node */}
                  <rect
                    width={w + 2}
                    height={h + 2}
                    x={-(w + 2) / 2}
                    y={-(h + 2) / 2}
                    rx={8}
                    ry={8}
                    fill="#080B10"
                  />
                  <rect
                    width={w}
                    height={h}
                    x={-w / 2}
                    y={-h / 2}
                    rx={8}
                    ry={8}
                    fill={fill}
                    stroke={blinking ? glowColor : stroke}
                    strokeWidth={active || highlighted || blinking ? 2 : strokeWidth}
                    filter={glowFilter}
                  >
                    {blinking && (
                      <animate attributeName="opacity" values="0.5;0.15;0.5" dur="1.2s" repeatCount="indefinite" />
                    )}
                  </rect>
                  {depth === 1 && (
                    <circle
                      r={3}
                      cx={-w / 2 + 12}
                      cy={0}
                      fill="#00FFC8"
                      filter="drop-shadow(0 0 4px #00FFC8)"
                    />
                  )}
                  <text
                    x={depth === 1 ? 6 : 0}
                    fill={labelFill}
                    fontSize={fontSize}
                    fontWeight={fontWeight}
                    fontFamily="'Noto Sans KR', sans-serif"
                    textAnchor="middle"
                    style={{ pointerEvents: 'none', userSelect: 'none' }}
                  >
                    {node.lines && node.lines.length > 1 ? (
                      node.lines.map((line, i) => {
                        const lineHeight = fontSize + 4;
                        const totalHeight = node.lines!.length * lineHeight;
                        const startY = -totalHeight / 2 + lineHeight / 2;
                        return (
                          <tspan
                            key={i}
                            x={depth === 1 ? 6 : 0}
                            y={startY + i * lineHeight}
                            dominantBaseline="middle"
                          >
                            {line}
                          </tspan>
                        );
                      })
                    ) : (
                      <tspan dominantBaseline="middle" y={0}>{node.label}</tspan>
                    )}
                  </text>

                  {highlighted && (
                    <rect
                      width={w + 8}
                      height={h + 8}
                      x={-(w + 8) / 2}
                      y={-(h + 8) / 2}
                      rx={10}
                      ry={10}
                      fill="none"
                      stroke={depth === 1 ? '#00FFC8' : depth === 2 ? '#a78bfa' : '#fff'}
                      strokeWidth={1.5}
                    >
                      <animate attributeName="opacity" values="0.6;0;0.6" dur="1.5s" repeatCount="indefinite" />
                    </rect>
                  )}

                </g>
              );
            })}
          </g>
        </g>
      </svg>

      {/* Vignette */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse at center, transparent 0%, rgba(8, 11, 16, 0.82) 65%, rgba(8, 11, 16, 0.98) 100%)',
        }}
      />

      <NeuralSignalLayer ref={signalRef} nodes={allNodes} links={links} transform={transform} />
    </div>
  );
}
