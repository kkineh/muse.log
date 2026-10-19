'use client';

import { forwardRef, useEffect, useImperativeHandle, useRef, type MutableRefObject } from 'react';
import type { NeuralNode } from '@/lib/neural-graph-builder';
import { hexA, type NeuralPalette } from '@/lib/neural-palettes';
import { FIELD_H, FIELD_W } from '@/lib/neural-field';

export interface SignalLayerHandle {
  emit: (x: number, y: number) => void;
}

interface SignalLink {
  source: string;
  target: string;
  depth: number;
  isTagLink?: boolean;
}

interface NeuralFiberLayerProps {
  nodes: NeuralNode[];
  links: SignalLink[];
  transformRef: MutableRefObject<{ x: number; y: number; k: number }>;
  palette: NeuralPalette;
}

// 가지 구조 (월드 px)
const CELL_W = 1200;
const CELL_H = 800;
const SOMAS_MIN = 9;
const SOMAS_EXTRA = 3;
const MIN_SOMA_DIST = 95;
const TRUNK_MAX_DIST = 720;
const CELL_BUDGET = 6; // 한 프레임에 새로 만드는 셀 수

// 전파
const SPEED_TRUNK = 200;
const SPEED_BRANCH = 140;
const FIBER_DECAY = 0.85;
const MIN_POWER = 0.2;
const MARGIN = 720;

// 그리기
const BASE_ALPHA = 0.04;
const SKIP_SIDE_ZOOM = 0.28; // 이 배율 아래에서는 곁가지의 곁가지와 말단 돌기를 그리지 않음
const SKIP_DENDRITE_ZOOM = 0.15; // 이 배율 아래에서는 수상돌기도 그리지 않음

// 노드(박스)로 전파
const NODE_TOUCH = 16;
const DOT_HOP = 0.7;
const EDGE_HOP = 1.0;
const NODE_HOPS = 2;
const DECAY = 0.9;
const AUTO_MIN_MS = 4000;
const AUTO_MAX_MS = 7000;
const nextAutoDelay = () => AUTO_MIN_MS + Math.random() * (AUTO_MAX_MS - AUTO_MIN_MS);

interface FNode {
  id: number;
  x: number;
  y: number;
  kind: 0 | 1 | 2; // 세포체, 분기점, 말단
  adj: FEdge[];
  r: number;
  lit: number;
  flash: number;
}

interface FEdge {
  a: FNode;
  b: FNode;
  pts: Float32Array;
  cum: Float32Array;
  len: number;
  cls: 0 | 1 | 2; // 줄기, 수상돌기·1차 곁가지, 2차 곁가지
  w: number;
  lit: number;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

interface Cell {
  somas: FNode[];
  edges: FEdge[];
  tips: FNode[];
}

interface Pulse {
  e: FEdge;
  fwd: boolean;
  t0: number;
  dur: number;
  p: number;
}

interface FWave {
  toNodes: boolean;
  seen: Set<number>;
  seenBox: Set<string>;
  touched: Set<string>;
}

interface SNode {
  id: string;
  x: number;
  y: number;
  hw: number;
  hh: number;
  color: string;
}

function mulberry32(seed: number) {
  let s = seed >>> 0;
  return () => {
    s += 0x6d2b79f5;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const hash2 = (a: number, b: number) => (Math.imul(a, 73856093) ^ Math.imul(b, 19349663) ^ 0x9e3779b9) >>> 0;

function nodeColor(n: NeuralNode, palette: NeuralPalette): string {
  const depth = n.level || 3;
  if (depth === 1) return palette.cat;
  if (depth === 2) return palette.sub;
  if (depth === 3 && n.type === 'subcategory') return palette.sub3;
  return '#ffffff';
}

const rgba = hexA;

function glow(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string, a: number) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, rgba(color, a));
  g.addColorStop(1, rgba(color, 0));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

function roundRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function borderSegment(A: SNode, B: SNode) {
  const dx = B.x - A.x;
  const dy = B.y - A.y;
  const frac = (n: SNode) =>
    Math.min(dx === 0 ? Infinity : n.hw / Math.abs(dx), dy === 0 ? Infinity : n.hh / Math.abs(dy));
  const sa = frac(A);
  const sb = frac(B);
  if (sa + sb >= 1) return null;
  return { x1: A.x + dx * sa, y1: A.y + dy * sa, x2: B.x - dx * sb, y2: B.y - dy * sb };
}

const edgeKey = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);

function pointAt(e: FEdge, s: number, fwd: boolean): [number, number] {
  const d = fwd ? s : e.len - s;
  const n = e.cum.length;
  let i = 1;
  while (i < n - 1 && e.cum[i] < d) i++;
  const a = e.cum[i - 1];
  const b = e.cum[i];
  const u = b > a ? (d - a) / (b - a) : 0;
  const px = e.pts[(i - 1) * 2];
  const py = e.pts[(i - 1) * 2 + 1];
  return [px + (e.pts[i * 2] - px) * u, py + (e.pts[i * 2 + 1] - py) * u];
}

export const NeuralFiberLayer = forwardRef<SignalLayerHandle, NeuralFiberLayerProps>(function NeuralFiberLayer(
  { nodes, links, transformRef, palette },
  ref
) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const propsRef = useRef({ nodes, links, palette });
  const emitRef = useRef<(x: number, y: number) => void>(() => {});

  useEffect(() => {
    propsRef.current = { nodes, links, palette };
  });

  useImperativeHandle(ref, () => ({ emit: (x, y) => emitRef.current(x, y) }), []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let w = 0;
    let h = 0;
    const tr = { x: 0, y: 0, k: 1 };
    const SESSION = Math.floor(Math.random() * 2147483647);

    // ---------- 가지 구조: 월드를 셀로 나눠 필요한 셀만 한 번씩 무작위로 만든다 ----------
    const CX_MIN = Math.floor(-FIELD_W / 2 / CELL_W);
    const CX_MAX = Math.floor((FIELD_W / 2 - 1) / CELL_W);
    const CY_MIN = Math.floor(-FIELD_H / 2 / CELL_H);
    const CY_MAX = Math.floor((FIELD_H / 2 - 1) / CELL_H);
    const cellKey = (cx: number, cy: number) => (cy + 32768) * 65536 + (cx + 32768);
    let nextId = 1e12;

    const somaCache = new Map<number, FNode[]>();
    const somasOf = (cx: number, cy: number): FNode[] => {
      if (cx < CX_MIN || cx > CX_MAX || cy < CY_MIN || cy > CY_MAX) return [];
      const key = cellKey(cx, cy);
      const cached = somaCache.get(key);
      if (cached) return cached;
      const rnd = mulberry32(hash2(cx, cy) ^ SESSION);
      const n = SOMAS_MIN + Math.floor(rnd() * (SOMAS_EXTRA + 1));
      const out: FNode[] = [];
      let guard = 0;
      while (out.length < n && guard++ < 60) {
        const x = (cx + 0.04 + rnd() * 0.92) * CELL_W;
        const y = (cy + 0.05 + rnd() * 0.9) * CELL_H;
        if (out.some((s) => Math.hypot(s.x - x, s.y - y) < MIN_SOMA_DIST)) continue;
        out.push({ id: key * 16 + out.length, x, y, kind: 0, adj: [], r: 2.7 + rnd() * 1.0, lit: 0, flash: 0 });
      }
      somaCache.set(key, out);
      return out;
    };

    const trunkDone = new Set<string>();
    const cells = new Map<number, Cell>();

    const buildCell = (cx: number, cy: number): Cell => {
      const cell: Cell = { somas: somasOf(cx, cy), edges: [], tips: [] };
      const mkEdge = (a: FNode, b: FNode, flat: number[], cls: 0 | 1 | 2, wd: number) => {
        const pts = new Float32Array(flat);
        const n = pts.length / 2;
        const cum = new Float32Array(n);
        let x0 = Infinity;
        let y0 = Infinity;
        let x1 = -Infinity;
        let y1 = -Infinity;
        for (let i = 0; i < n; i++) {
          if (i > 0) cum[i] = cum[i - 1] + Math.hypot(pts[i * 2] - pts[i * 2 - 2], pts[i * 2 + 1] - pts[i * 2 - 1]);
          x0 = Math.min(x0, pts[i * 2]);
          x1 = Math.max(x1, pts[i * 2]);
          y0 = Math.min(y0, pts[i * 2 + 1]);
          y1 = Math.max(y1, pts[i * 2 + 1]);
        }
        const e: FEdge = { a, b, pts, cum, len: cum[n - 1], cls, w: wd, lit: 0, x0, y0, x1, y1 };
        a.adj.push(e);
        b.adj.push(e);
        cell.edges.push(e);
      };
      // 중점 변위로 꺾인 번개 모양 경로
      const jag = (rnd: () => number, ax: number, ay: number, bx: number, by: number, off: number, depth: number) => {
        const out = [ax, ay];
        const rec = (x0: number, y0: number, x1: number, y1: number, o: number, d: number) => {
          if (d === 0) {
            out.push(x1, y1);
            return;
          }
          const mx = (x0 + x1) / 2 - (y1 - y0) * (rnd() - 0.5) * o;
          const my = (y0 + y1) / 2 + (x1 - x0) * (rnd() - 0.5) * o;
          rec(x0, y0, mx, my, o * 0.66, d - 1);
          rec(mx, my, x1, y1, o * 0.66, d - 1);
        };
        rec(ax, ay, bx, by, off, depth);
        return out;
      };
      const branch = (rnd: () => number, from: FNode, depthLeft: number, len: number, wd: number) => {
        const ang = rnd() * Math.PI * 2;
        const L = len * (0.6 + rnd() * 0.7);
        const flat = jag(rnd, from.x, from.y, from.x + Math.cos(ang) * L, from.y + Math.sin(ang) * L, 0.5, 4);
        chain(rnd, from, flat, null, depthLeft === 2 ? 1 : 2, wd, depthLeft - 1, len * 0.55, 0.42);
      };
      // 경로를 분기점에서 나눠 간선으로 만들고, 분기점마다 곁가지를 낸다
      const chain = (
        rnd: () => number,
        start: FNode,
        flat: number[],
        end: FNode | null,
        cls: 0 | 1 | 2,
        wd: number,
        depthLeft: number,
        subLen: number,
        attachProb: number
      ) => {
        const n = flat.length / 2;
        let node = start;
        let segStart = 0;
        const junctions: FNode[] = [];
        for (let i = 1; i < n - 1; i++) {
          if (depthLeft > 0 && i % 3 === 1 && rnd() < attachProb) {
            const j: FNode = { id: nextId++, x: flat[i * 2], y: flat[i * 2 + 1], kind: 1, adj: [], r: 0, lit: 0, flash: 0 };
            mkEdge(node, j, flat.slice(segStart * 2, i * 2 + 2), cls, wd);
            node = j;
            segStart = i;
            junctions.push(j);
          }
        }
        let last = end;
        if (!last) {
          last = { id: nextId++, x: flat[(n - 1) * 2], y: flat[(n - 1) * 2 + 1], kind: 2, adj: [], r: 0, lit: 0, flash: 0 };
          cell.tips.push(last);
        }
        mkEdge(node, last, flat.slice(segStart * 2), cls, wd);
        junctions.forEach((j) => branch(rnd, j, depthLeft, subLen, wd));
      };

      cell.somas.forEach((s, si) => {
        // 가까운 세포체 2~3개와 번개 줄기로 연결
        const near: FNode[] = [];
        for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) near.push(...somasOf(cx + ox, cy + oy));
        const k = 2 + ((s.id ^ si) & 1);
        near
          .filter((t) => t !== s && Math.hypot(t.x - s.x, t.y - s.y) <= TRUNK_MAX_DIST)
          .sort((p, q) => Math.hypot(p.x - s.x, p.y - s.y) - Math.hypot(q.x - s.x, q.y - s.y))
          .slice(0, k)
          .forEach((t) => {
            const lo = Math.min(s.id, t.id);
            const hi = Math.max(s.id, t.id);
            const pk = lo + '|' + hi;
            if (trunkDone.has(pk)) return;
            trunkDone.add(pk);
            const rnd = mulberry32(hash2(lo % 2147483647, hi % 2147483647) ^ SESSION);
            const flat = jag(rnd, s.x, s.y, t.x, t.y, 0.55, 5);
            chain(rnd, s, flat, t, 0, 1.5, 2, 90, 0.5);
          });
        // 수상돌기
        const rnd = mulberry32(hash2(s.id % 2147483647, 7) ^ SESSION);
        const d = 2 + Math.floor(rnd() * 3);
        for (let i = 0; i < d; i++) branch(rnd, s, 2, 85, 1.2);
      });
      return cell;
    };

    // ---------- 신호 상태 ----------
    const queue: { node: FNode; at: number; p: number; w: FWave }[] = [];
    const pulses: Pulse[] = [];
    const litEdges = new Set<FEdge>();
    const litNodes = new Set<FNode>();
    const acts: { id: string; at: number; power: number; hops: number; w: FWave }[] = [];
    const dsigs: { wx: number; wy: number; id: string; t0: number; p: number }[] = [];
    const sigs: { a: string; b: string; t0: number; p: number }[] = [];
    const lit = new Map<string, number>();
    const litE = new Map<string, number>();
    let snodes = new Map<string, SNode>();
    let adj = new Map<string, string[]>();
    let edgeColor = new Map<string, string>();
    let k = 1;
    let sig = propsRef.current.palette.signal;
    let dotColor = propsRef.current.palette.dot;
    let nextAuto = performance.now() + nextAutoDelay();
    let last = performance.now();
    let raf = 0;

    const refreshGraph = () => {
      const { nodes: ns, links: ls, palette: pal } = propsRef.current;
      const t = transformRef.current;
      sig = pal.signal;
      dotColor = pal.dot;
      k = t.k;
      tr.x = t.x;
      tr.y = t.y;
      tr.k = t.k;
      snodes = new Map(
        ns.map((n) => [
          n.id,
          {
            id: n.id,
            x: t.x + (n.x || 0) * t.k,
            y: t.y + (n.y || 0) * t.k,
            hw: ((n.w || 60) / 2) * t.k,
            hh: ((n.h || 28) / 2) * t.k,
            color: nodeColor(n, pal),
          },
        ])
      );
      adj = new Map();
      edgeColor = new Map();
      for (const l of ls) {
        if (l.isTagLink) continue;
        (adj.get(l.source) ?? adj.set(l.source, []).get(l.source)!).push(l.target);
        (adj.get(l.target) ?? adj.set(l.target, []).get(l.target)!).push(l.source);
        edgeColor.set(edgeKey(l.source, l.target), l.depth === 3 ? pal.sub3 : pal.cat);
      }
    };

    const cellRange = () => {
      const x0 = Math.floor((-tr.x / tr.k - MARGIN) / CELL_W);
      const x1 = Math.floor(((w - tr.x) / tr.k + MARGIN) / CELL_W);
      const y0 = Math.floor((-tr.y / tr.k - MARGIN) / CELL_H);
      const y1 = Math.floor(((h - tr.y) / tr.k + MARGIN) / CELL_H);
      return {
        cx0: Math.max(CX_MIN, x0),
        cx1: Math.min(CX_MAX, x1),
        cy0: Math.max(CY_MIN, y0),
        cy1: Math.min(CY_MAX, y1),
      };
    };

    const visibleCells = (budget: number): Cell[] => {
      const { cx0, cx1, cy0, cy1 } = cellRange();
      const out: Cell[] = [];
      let left = budget;
      for (let cy = cy0; cy <= cy1; cy++) {
        for (let cx = cx0; cx <= cx1; cx++) {
          const key = cellKey(cx, cy);
          let c = cells.get(key);
          if (!c && left > 0) {
            c = buildCell(cx, cy);
            cells.set(key, c);
            left--;
          }
          if (c) out.push(c);
        }
      }
      return out;
    };

    const visibleSomas = (): { s: FNode; x: number; y: number }[] => {
      const out: { s: FNode; x: number; y: number }[] = [];
      for (const c of visibleCells(0)) {
        for (const s of c.somas) {
          const x = tr.x + s.x * tr.k;
          const y = tr.y + s.y * tr.k;
          if (x >= 0 && x <= w && y >= 0 && y <= h) out.push({ s, x, y });
        }
      }
      return out;
    };

    const fireSoma = (s: FNode, now: number, toNodes: boolean) => {
      queue.push({ node: s, at: now, p: 1, w: { toNodes, seen: new Set(), seenBox: new Set(), touched: new Set() } });
    };

    // 클릭이나 자동 발화는 항상 세포체에서 시작한다
    const emit = (x: number, y: number, now: number) => {
      refreshGraph();
      const list = visibleSomas();
      if (!list.length) return;
      let best = list[0];
      let bd = Infinity;
      for (const o of list) {
        const d = Math.hypot(o.x - x, o.y - y);
        if (d < bd) {
          bd = d;
          best = o;
        }
      }
      fireSoma(best.s, now, true);
    };
    emitRef.current = (x, y) => {
      const now = performance.now();
      emit(x, y, now);
      nextAuto = now + nextAutoDelay();
    };

    // 가지가 노드 박스에 닿으면 그 노드로 전파 (닿는 지점까지 이동하는 시간 뒤에)
    const touchBoxes = (e: FEdge, fwd: boolean, now: number, speed: number, p: number, wv: FWave) => {
      snodes.forEach((n) => {
        if (wv.touched.has(n.id)) return;
        const lim = NODE_TOUCH * tr.k;
        const bx0 = tr.x + e.x0 * tr.k;
        const bx1 = tr.x + e.x1 * tr.k;
        const by0 = tr.y + e.y0 * tr.k;
        const by1 = tr.y + e.y1 * tr.k;
        if (bx1 < n.x - n.hw - lim || bx0 > n.x + n.hw + lim || by1 < n.y - n.hh - lim || by0 > n.y + n.hh + lim) return;
        const count = e.cum.length;
        for (let j = 0; j < count; j++) {
          const i = fwd ? j : count - 1 - j;
          const px = tr.x + e.pts[i * 2] * tr.k;
          const py = tr.y + e.pts[i * 2 + 1] * tr.k;
          const dist = Math.hypot(Math.max(Math.abs(n.x - px) - n.hw, 0), Math.max(Math.abs(n.y - py) - n.hh, 0));
          if (dist > lim) continue;
          const s = fwd ? e.cum[i] : e.len - e.cum[i];
          const t0 = now + (s / speed) * 1000;
          wv.touched.add(n.id);
          dsigs.push({ wx: e.pts[i * 2], wy: e.pts[i * 2 + 1], id: n.id, t0, p });
          acts.push({ id: n.id, at: t0 + DOT_HOP * 1000, power: p * 0.9, hops: NODE_HOPS, w: wv });
          return;
        }
      });
    };

    const resize = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const frame = (nowMs: number) => {
      const dt = Math.min(0.05, (nowMs - last) / 1000);
      last = nowMs;
      refreshGraph();
      const vis = visibleCells(CELL_BUDGET);
      if (!reduceMotion && nowMs >= nextAuto) {
        const list = visibleSomas();
        if (list.length) fireSoma(list[Math.floor(Math.random() * list.length)].s, nowMs, false);
        nextAuto = nowMs + nextAutoDelay();
      }

      ctx.clearRect(0, 0, w, h);

      // 세포체/분기점/말단 발화 -> 가지를 따라 전파
      for (let i = queue.length - 1; i >= 0; i--) {
        const q = queue[i];
        if (q.at > nowMs) continue;
        queue.splice(i, 1);
        const n = q.node;
        n.lit = Math.max(n.lit, q.p);
        litNodes.add(n);
        if (n.kind === 0) n.flash = Math.max(n.flash, q.p);
        if (q.w.seen.has(n.id)) continue;
        q.w.seen.add(n.id);
        const p2 = q.p * FIBER_DECAY;
        if (p2 < MIN_POWER) continue;
        for (const e of n.adj) {
          const other = e.a === n ? e.b : e.a;
          if (q.w.seen.has(other.id)) continue;
          const speed = e.cls === 0 ? SPEED_TRUNK : SPEED_BRANCH;
          const dur = (e.len / speed) * 1000;
          const fwd = e.a === n;
          pulses.push({ e, fwd, t0: nowMs, dur, p: p2 });
          e.lit = Math.max(e.lit, p2);
          litEdges.add(e);
          queue.push({ node: other, at: nowMs + dur, p: p2, w: q.w });
          if (q.w.toNodes) touchBoxes(e, fwd, nowMs, speed, p2, q.w);
        }
      }
      // 노드 발화 -> 시냅스를 따라 몇 단계 전파
      for (let i = acts.length - 1; i >= 0; i--) {
        const a = acts[i];
        if (a.at > nowMs) continue;
        acts.splice(i, 1);
        if (a.w.seenBox.has(a.id)) continue;
        a.w.seenBox.add(a.id);
        lit.set(a.id, Math.max(lit.get(a.id) ?? 0, a.power));
        if (a.hops > 0) {
          for (const nb of adj.get(a.id) ?? []) {
            if (a.w.seenBox.has(nb)) continue;
            sigs.push({ a: a.id, b: nb, t0: nowMs, p: a.power * 0.7 });
            acts.push({ id: nb, at: nowMs + EDGE_HOP * 1000, power: a.power * 0.62, hops: a.hops - 1, w: a.w });
            const ek = edgeKey(a.id, nb);
            litE.set(ek, Math.max(litE.get(ek) ?? 0, a.power));
          }
        }
      }

      // ---------- 가지 (평소엔 희미하게) ----------
      const wx0 = -tr.x / tr.k;
      const wy0 = -tr.y / tr.k;
      const wx1 = (w - tr.x) / tr.k;
      const wy1 = (h - tr.y) / tr.k;
      const stride = tr.k < 0.2 ? 2 : 1;
      const zoomW = Math.min(1, Math.max(tr.k, 0.55));
      const classes: FEdge[][] = [[], [], []];
      for (const c of vis) {
        for (const e of c.edges) {
          if (e.x1 < wx0 || e.x0 > wx1 || e.y1 < wy0 || e.y0 > wy1) continue;
          if (e.cls === 2 && tr.k < SKIP_SIDE_ZOOM) continue;
          if (e.cls === 1 && tr.k < SKIP_DENDRITE_ZOOM) continue;
          classes[e.cls].push(e);
        }
      }
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      const classAlpha = [1, 0.75, 0.55];
      const classWidth = [0.95, 0.75, 0.6];
      for (let cl = 0; cl < 3; cl++) {
        if (!classes[cl].length) continue;
        ctx.strokeStyle = rgba(sig, BASE_ALPHA * classAlpha[cl]);
        ctx.lineWidth = Math.max(0.5, classWidth[cl] * zoomW);
        ctx.beginPath();
        for (const e of classes[cl]) {
          const n = e.cum.length;
          ctx.moveTo(tr.x + e.pts[0] * tr.k, tr.y + e.pts[1] * tr.k);
          for (let i = stride; i < n - 1; i += stride) ctx.lineTo(tr.x + e.pts[i * 2] * tr.k, tr.y + e.pts[i * 2 + 1] * tr.k);
          ctx.lineTo(tr.x + e.pts[(n - 1) * 2] * tr.k, tr.y + e.pts[(n - 1) * 2 + 1] * tr.k);
        }
        ctx.stroke();
      }
      // 신호가 지나간 가지는 잠시 밝게 남는다
      litEdges.forEach((e) => {
        e.lit -= dt * 0.32;
        if (e.lit <= 0.02) {
          e.lit = 0;
          litEdges.delete(e);
          return;
        }
        ctx.strokeStyle = rgba(sig, Math.min(0.17, e.lit * 0.16));
        ctx.lineWidth = Math.max(0.6, (classWidth[e.cls] + e.lit * 0.35) * zoomW);
        ctx.beginPath();
        ctx.moveTo(tr.x + e.pts[0] * tr.k, tr.y + e.pts[1] * tr.k);
        for (let i = 1; i < e.cum.length; i++) ctx.lineTo(tr.x + e.pts[i * 2] * tr.k, tr.y + e.pts[i * 2 + 1] * tr.k);
        ctx.stroke();
      });

      // 이동하는 신호: 머리가 밝고 꼬리가 사라지는 펄스
      for (let i = pulses.length - 1; i >= 0; i--) {
        const p = pulses[i];
        const u = (nowMs - p.t0) / p.dur;
        if (u >= 1) {
          pulses.splice(i, 1);
          continue;
        }
        const s = u * p.e.len;
        const tail = 46 / Math.max(tr.k, 0.3);
        const steps = 9;
        let prev = pointAt(p.e, Math.max(0, s - tail), p.fwd);
        for (let j = 1; j <= steps; j++) {
          const q = pointAt(p.e, Math.max(0, s - tail * (1 - j / steps)), p.fwd);
          const f = j / steps;
          ctx.strokeStyle = rgba(sig, 0.3 * p.p * f * f);
          ctx.lineWidth = (0.6 + 1.7 * f) * Math.min(1, Math.max(tr.k, 0.6));
          ctx.beginPath();
          ctx.moveTo(tr.x + prev[0] * tr.k, tr.y + prev[1] * tr.k);
          ctx.lineTo(tr.x + q[0] * tr.k, tr.y + q[1] * tr.k);
          ctx.stroke();
          prev = q;
        }
        ctx.globalCompositeOperation = 'lighter';
        glow(ctx, tr.x + prev[0] * tr.k, tr.y + prev[1] * tr.k, 7, sig, 0.18 * p.p);
        ctx.globalCompositeOperation = 'source-over';
      }

      // ---------- 세포체와 말단 돌기 (평소엔 가지처럼 희미하게) ----------
      const nodeScale = Math.min(1.3, Math.max(tr.k, 0.45));
      litNodes.forEach((n) => {
        n.lit = Math.max(0, n.lit - dt * 1.1);
        n.flash = Math.max(0, n.flash - dt * 1.3);
        if (n.lit <= 0.01 && n.flash <= 0.01) litNodes.delete(n);
      });
      for (const c of vis) {
        for (const s of c.somas) {
          const x = tr.x + s.x * tr.k;
          const y = tr.y + s.y * tr.k;
          if (x < -40 || x > w + 40 || y < -40 || y > h + 40) continue;
          const f = s.flash;
          if (f > 0.03) {
            ctx.globalCompositeOperation = 'lighter';
            glow(ctx, x, y, 10 + f * 16, sig, 0.03 + f * 0.18);
            ctx.globalCompositeOperation = 'source-over';
          }
          ctx.fillStyle = rgba(dotColor, 0.07 + f * 0.23);
          ctx.beginPath();
          ctx.arc(x, y, s.r * nodeScale + f * 1.2, 0, Math.PI * 2);
          ctx.fill();
          if (f > 0.05) {
            ctx.strokeStyle = rgba(sig, f * 0.14);
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.arc(x, y, s.r * nodeScale + 4 + (1 - f) * 16, 0, Math.PI * 2);
            ctx.stroke();
          }
        }
        if (tr.k < SKIP_SIDE_ZOOM) continue;
        for (const t of c.tips) {
          const x = tr.x + t.x * tr.k;
          const y = tr.y + t.y * tr.k;
          if (x < -10 || x > w + 10 || y < -10 || y > h + 10) continue;
          ctx.fillStyle = rgba(dotColor, 0.065 + t.lit * 0.2);
          ctx.beginPath();
          ctx.arc(x, y, 1.35 * nodeScale + t.lit * 0.6, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // ---------- 노드(박스)로 가는 신호 ----------
      for (let i = dsigs.length - 1; i >= 0; i--) {
        const g = dsigs[i];
        if (nowMs < g.t0) continue;
        const u = (nowMs - g.t0) / (DOT_HOP * 1000);
        const p = snodes.get(g.id);
        if (u >= 1 || !p) {
          dsigs.splice(i, 1);
          continue;
        }
        const gx = tr.x + g.wx * tr.k;
        const gy = tr.y + g.wy * tr.k;
        const cx = p.x - gx;
        const cy = p.y - gy;
        const s = Math.min(cx === 0 ? Infinity : p.hw / Math.abs(cx), cy === 0 ? Infinity : p.hh / Math.abs(cy));
        if (s >= 1) {
          dsigs.splice(i, 1);
          continue;
        }
        const ex = p.x - cx * s;
        const ey = p.y - cy * s;
        const e = 1 - (1 - u) * (1 - u);
        const x = gx + (ex - gx) * e;
        const y = gy + (ey - gy) * e;
        const fade = 1 - u;
        ctx.strokeStyle = rgba(sig, 0.1 * g.p * fade);
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.moveTo(gx, gy);
        ctx.lineTo(ex, ey);
        ctx.stroke();
        ctx.globalCompositeOperation = 'lighter';
        glow(ctx, x, y, 6, sig, 0.5 * g.p * fade);
        ctx.globalCompositeOperation = 'source-over';
        ctx.fillStyle = `rgba(255,255,255,${0.7 * g.p * fade})`;
        ctx.beginPath();
        ctx.arc(x, y, 1.4, 0, Math.PI * 2);
        ctx.fill();
      }

      // 시냅스 하이라이트
      litE.forEach((l, key) => {
        const [a, b] = key.split('|');
        const A = snodes.get(a);
        const B = snodes.get(b);
        if (!A || !B) {
          litE.delete(key);
          return;
        }
        litE.set(key, Math.max(0, l - dt * DECAY * 0.8));
        if (l <= 0.01) {
          litE.delete(key);
          return;
        }
        const seg = borderSegment(A, B);
        if (!seg) return;
        ctx.strokeStyle = rgba(edgeColor.get(key) ?? sig, 0.35 * l);
        ctx.lineWidth = 0.8 + l * 0.4;
        ctx.beginPath();
        ctx.moveTo(seg.x1, seg.y1);
        ctx.lineTo(seg.x2, seg.y2);
        ctx.stroke();
      });

      // 시냅스를 타는 신호
      for (let i = sigs.length - 1; i >= 0; i--) {
        const s = sigs[i];
        const u = (nowMs - s.t0) / (EDGE_HOP * 1000);
        const A = snodes.get(s.a);
        const B = snodes.get(s.b);
        if (u >= 1 || !A || !B) {
          sigs.splice(i, 1);
          continue;
        }
        const seg = borderSegment(A, B);
        if (!seg) {
          sigs.splice(i, 1);
          continue;
        }
        const ease = 1 - (1 - u) * (1 - u);
        const fade = 1 - u;
        const col = edgeColor.get(edgeKey(s.a, s.b)) ?? sig;
        const at = (q: number) => ({ x: seg.x1 + (seg.x2 - seg.x1) * q, y: seg.y1 + (seg.y2 - seg.y1) * q });
        ctx.globalCompositeOperation = 'lighter';
        for (let j = 0; j < 4; j++) {
          const q = at(Math.max(0, ease - j * 0.035));
          glow(ctx, q.x, q.y, 7 - j, col, s.p * fade * (1 - j / 4) * 0.5);
        }
        ctx.globalCompositeOperation = 'source-over';
        const head = at(ease);
        ctx.fillStyle = `rgba(255,255,255,${0.7 * s.p * fade})`;
        ctx.beginPath();
        ctx.arc(head.x, head.y, 1.5, 0, Math.PI * 2);
        ctx.fill();
      }

      // 노드 점등: 박스가 살짝 밝아지기만 함
      lit.forEach((l, id) => {
        const n = snodes.get(id);
        if (!n) {
          lit.delete(id);
          return;
        }
        lit.set(id, Math.max(0, l - dt * DECAY));
        if (l <= 0.01) {
          lit.delete(id);
          return;
        }
        roundRectPath(ctx, n.x - n.hw, n.y - n.hh, n.hw * 2, n.hh * 2, 8 * k);
        ctx.fillStyle = rgba(n.color, 0.14 * l);
        ctx.fill();
      });

      raf = requestAnimationFrame(frame);
    };

    resize();
    window.addEventListener('resize', resize);
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
    };
  }, [transformRef]);

  return <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden />;
});
