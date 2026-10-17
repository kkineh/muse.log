import { useEffect, useState, useRef, type RefObject } from 'react';
import * as d3 from 'd3-force';
import * as d3Zoom from 'd3-zoom';
import * as d3Selection from 'd3-selection';
import type { NeuralNode } from '@/lib/neural-graph-builder';

export interface UseD3ForceSimulationOptions {
  width?: number;
  height?: number;
  centerX?: number;
  centerY?: number;
  fitToView?: boolean;
  minZoom?: number;
}

export interface DragHandlers {
  onDragStart: (nodeId: string) => void;
  onDrag: (nodeId: string, x: number, y: number) => void;
  onDragEnd: (nodeId: string) => void;
}

export interface ZoomTransform {
  x: number;
  y: number;
  k: number;
}

export interface UseD3ForceSimulationReturn {
  nodes: NeuralNode[];
  simulation: d3.Simulation<NeuralNode, undefined> | null;
  dragHandlers: DragHandlers;
  transform: ZoomTransform;
  fitted: boolean;
}

interface D3Link {
  source: string;
  target: string;
  depth: number;
  isTagLink?: boolean;
}

/**
 * D3 force simulation + d3.zoom() bound directly to SVG.
 * Force operates in (0,0)-centered space; consumer translates by (W/2, H/2).
 * Zoom/pan is handled by D3 (non-passive wheel listener, smooth inertia).
 */
export function useD3ForceSimulation(
  initialNodes: NeuralNode[],
  links: D3Link[],
  svgRef: RefObject<SVGSVGElement | null>,
  gRef: RefObject<SVGGElement | null>,
  options: UseD3ForceSimulationOptions = {}
): UseD3ForceSimulationReturn {
  const { centerX = 0, centerY = 0, fitToView = false, minZoom = 0.3 } = options;

  const [nodes, setNodes] = useState<NeuralNode[]>(initialNodes);
  const [transform, setTransform] = useState<ZoomTransform>({ x: 0, y: 0, k: 1 });
  const simulationRef = useRef<d3.Simulation<NeuralNode, undefined> | null>(null);
  const rafRef = useRef<number | null>(null);
  const nodesRef = useRef<NeuralNode[]>(initialNodes);
  const fitRef = useRef<() => void>(() => {});
  const [fitted, setFitted] = useState(!fitToView);

  // Force simulation
  useEffect(() => {
    const clonedNodes = initialNodes.map((node) => ({ ...node }));

    clonedNodes.forEach((node) => {
      if (node.x === undefined || node.y === undefined) {
        node.x = (node.position?.x || 0) + centerX;
        node.y = (node.position?.y || 0) + centerY;
      }
    });

    // Clone links — d3.forceLink mutates .source/.target from string to object refs
    const clonedLinks = links.map((l) => ({ ...l }));

    const simulation = d3
      .forceSimulation<NeuralNode>(clonedNodes)
      .force(
        'link',
        d3
          .forceLink<NeuralNode, D3Link>(clonedLinks)
          .id((d) => d.id)
          .distance((d) => d.isTagLink ? 200 : (d.depth === 1 ? 120 : d.depth === 2 ? 100 : 80))
          .strength((d) => d.isTagLink ? 0.1 : 0.6)
      )
      .force(
        'charge',
        d3.forceManyBody<NeuralNode>().strength((d) =>
          d.level === 1 ? -600 : d.level === 2 ? -300 : -150
        )
      )
      .force(
        'collide',
        d3.forceCollide<NeuralNode>().radius((d) => d.r || 20).strength(0.8)
      )
      .force(
        'radial',
        d3.forceRadial<NeuralNode>(280, centerX, centerY)
          .strength((d) => (d.level === 1 ? 0.5 : 0))
      )
      .force('center', d3.forceCenter(centerX, centerY).strength(0.03))
      .alphaDecay(0.025)
      .velocityDecay(0.35);

    simulationRef.current = simulation;

    let lastUpdate = 0;
    const throttleInterval = 1000 / 60;

    const onTick = () => {
      const now = Date.now();
      if (now - lastUpdate >= throttleInterval) {
        lastUpdate = now;
        nodesRef.current = clonedNodes;
        setNodes([...clonedNodes]);
      }
      if (simulation.alpha() > simulation.alphaMin()) {
        rafRef.current = requestAnimationFrame(onTick);
      }
    };

    simulation.on('tick', () => {
      if (!rafRef.current) {
        rafRef.current = requestAnimationFrame(onTick);
      }
    });

    // 미니맵: 첫 화면부터 정착된 배치로 보이도록 시뮬레이션을 미리 끝까지 돌린다
    if (fitToView) {
      simulation.stop();
      const ticks = Math.ceil(Math.log(simulation.alphaMin()) / Math.log(1 - simulation.alphaDecay()));
      for (let i = 0; i < ticks; i++) simulation.tick();
      nodesRef.current = clonedNodes;
      setNodes([...clonedNodes]);
    }

    simulation.on('end', () => {
      nodesRef.current = clonedNodes;
      setNodes([...clonedNodes]);
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    });

    return () => {
      simulation.stop();
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [initialNodes, links, centerX, centerY, fitToView]);

  // D3 zoom — bound directly to SVG element (non-passive, smooth)
  useEffect(() => {
    const svgEl = svgRef.current;
    const gEl = gRef.current;
    if (!svgEl || !gEl) return;

    const svg = d3Selection.select(svgEl);
    const g = d3Selection.select(gEl);

    const W = svgEl.clientWidth || window.innerWidth;
    const H = svgEl.clientHeight || window.innerHeight;

    // Set initial transform to center the (0,0)-based graph
    const initialTransform = d3Zoom.zoomIdentity.translate(W / 2, H / 2);

    const zoom = d3Zoom.zoom<SVGSVGElement, unknown>()
      .scaleExtent([minZoom, 2.5])
      .on('zoom', (e) => {
        g.attr('transform', e.transform.toString());
        setTransform({ x: e.transform.x, y: e.transform.y, k: e.transform.k });
      });

    svg.call(zoom);
    svg.call(zoom.transform, initialTransform);

    // 컨테이너 안에 그래프 전체가 들어오도록 줌/위치를 맞춘다 (미니맵 전용)
    fitRef.current = () => {
      const ns = nodesRef.current;
      const cw = svgEl.clientWidth;
      const ch = svgEl.clientHeight;
      if (!ns.length || !cw || !ch) return;
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for (const n of ns) {
        const hw = (n.w || 60) / 2;
        const hh = (n.h || 28) / 2;
        x0 = Math.min(x0, (n.x || 0) - hw);
        x1 = Math.max(x1, (n.x || 0) + hw);
        y0 = Math.min(y0, (n.y || 0) - hh);
        y1 = Math.max(y1, (n.y || 0) + hh);
      }
      const pad = 16;
      const k = Math.min(2.5, Math.max(minZoom, Math.min((cw - pad * 2) / (x1 - x0), (ch - pad * 2) / (y1 - y0))));
      svg.call(
        zoom.transform,
        d3Zoom.zoomIdentity.translate(cw / 2 - ((x0 + x1) / 2) * k, ch / 2 - ((y0 + y1) / 2) * k).scale(k)
      );
    };
    if (fitToView) {
      fitRef.current();
      setFitted(true);
    }

    // Update on resize
    const onResize = () => {
      if (fitToView) return;
      const nW = window.innerWidth;
      const nH = window.innerHeight;
      svgEl.setAttribute('width', String(nW));
      svgEl.setAttribute('height', String(nH));
      // Re-center
      const newTransform = d3Zoom.zoomIdentity.translate(nW / 2, nH / 2);
      svg.call(zoom.transform, newTransform);
    };
    window.addEventListener('resize', onResize);

    let resizeObserver: ResizeObserver | undefined;
    if (fitToView && svgEl.parentElement) {
      resizeObserver = new ResizeObserver(() => fitRef.current());
      resizeObserver.observe(svgEl.parentElement);
    }

    return () => {
      svg.on('.zoom', null);
      window.removeEventListener('resize', onResize);
      resizeObserver?.disconnect();
    };
  }, [svgRef, gRef, fitToView, minZoom]);

  // Drag handlers
  const dragHandlers: DragHandlers = {
    onDragStart: (nodeId: string) => {
      const simulation = simulationRef.current;
      if (!simulation) return;
      simulation.alphaTarget(0.15).restart();
      const node = nodesRef.current.find((n) => n.id === nodeId);
      if (node) { node.fx = node.x; node.fy = node.y; }
    },
    onDrag: (nodeId: string, x: number, y: number) => {
      const node = nodesRef.current.find((n) => n.id === nodeId);
      if (node) {
        node.fx = x;
        node.fy = y;
        setNodes([...nodesRef.current]);
      }
    },
    onDragEnd: (nodeId: string) => {
      const simulation = simulationRef.current;
      if (!simulation) return;
      simulation.alphaTarget(0);
      const node = nodesRef.current.find((n) => n.id === nodeId);
      if (node && node.level !== 1) {
        node.fx = null;
        node.fy = null;
      }
    },
  };

  return {
    nodes,
    simulation: simulationRef.current,
    dragHandlers,
    transform,
    fitted,
  };
}
