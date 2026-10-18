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

interface NeuralSignalLayerProps {
  nodes: NeuralNode[];
  links: SignalLink[];
  transformRef: MutableRefObject<{ x: number; y: number; k: number }>;
  palette: NeuralPalette;
}

const SPEED = 220; // 점 사이 전파 속도 (월드 px/s, 줌에 비례해 화면 속도가 바뀜)
const SEED_R = 60; // 클릭 지점에서 처음 켜지는 점의 반경 (월드 px)
const DOT_DECAY = 0.65; // 점을 한 칸 건널 때마다 줄어드는 세기
const MIN_POWER = 0.3; // 이보다 약해지면 전파가 멈춤
const NODE_TOUCH = 16; // 켜진 점이 노드 박스에 이만큼 가까우면 노드로 전파 (월드 px)
const DOT_HOP = 0.7; // 점 → 노드 이동 시간 (s)
const EDGE_HOP = 1.0; // 노드 → 노드 이동 시간 (s)
const NODE_HOPS = 2; // 노드에서 시냅스를 따라 번지는 단계 수
const DECAY = 0.9;
const AUTO_MIN_MS = 500;
const AUTO_MAX_MS = 3000;
const nextAutoDelay = () => AUTO_MIN_MS + Math.random() * (AUTO_MAX_MS - AUTO_MIN_MS);
const DOT_LINK_R = 110; // 점끼리 연결선이 생기는 최대 거리 (px)
const DOT_LINK_N = 3; // 점 하나가 이어지는 가까운 점 수
const DOT_AREA = 5600; // 점 하나당 화면 면적 (px²)

interface SNode {
  id: string;
  x: number;
  y: number;
  hw: number;
  hh: number;
  color: string;
}

interface Wave { seen: Set<string>; touched: Set<string>; seenDots: Set<number> }

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

// 두 박스의 중심을 잇는 선이 각 박스 테두리와 만나는 두 지점. 박스가 겹치면 null
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

export const NeuralSignalLayer = forwardRef<SignalLayerHandle, NeuralSignalLayerProps>(function NeuralSignalLayer(
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

    // 점은 시작할 때 월드 전체(FIELD)에 한 번만 무작위로 깔아 두고, 노드와 함께 팬/줌된다
    const N = Math.round((FIELD_W * FIELD_H) / DOT_AREA);
    const dwx = new Float32Array(N);
    const dwy = new Float32Array(N);
    const dr = new Float32Array(N);
    const da = new Float32Array(N);
    const dtw = new Float32Array(N);
    const dsp = new Float32Array(N);
    const BUCKET = 400;
    const GW = Math.ceil(FIELD_W / BUCKET);
    const GH = Math.ceil(FIELD_H / BUCKET);
    const grid: number[][] = Array.from({ length: GW * GH }, () => []);
    const gridX = (x: number) => Math.min(GW - 1, Math.max(0, Math.floor((x + FIELD_W / 2) / BUCKET)));
    const gridY = (y: number) => Math.min(GH - 1, Math.max(0, Math.floor((y + FIELD_H / 2) / BUCKET)));
    for (let i = 0; i < N; i++) {
      dwx[i] = (Math.random() - 0.5) * FIELD_W;
      dwy[i] = (Math.random() - 0.5) * FIELD_H;
      dr[i] = 0.9 + Math.random() * 0.8;
      da[i] = 0.3 + Math.random() * 0.22;
      dtw[i] = Math.random() * 6.28;
      dsp[i] = 0.3 + Math.random() * 0.6;
      grid[gridY(dwy[i]) * GW + gridX(dwx[i])].push(i);
    }
    const litDots = new Map<number, number>();
    const ALPHA_STEPS = 6;
    const alphaBuckets: number[][] = Array.from({ length: ALPHA_STEPS }, () => []);

    // 연결선 이웃은 점이 켜질 때 처음 계산한다 (가까운 DOT_LINK_N개, 거리 DOT_LINK_R 이내)
    const neighborCache = new Map<number, number[]>();
    const neighborsOf = (i: number): number[] => {
      const cached = neighborCache.get(i);
      if (cached) return cached;
      if (neighborCache.size > 20000) neighborCache.clear();
      const gx = gridX(dwx[i]);
      const gy = gridY(dwy[i]);
      const near: { j: number; d: number }[] = [];
      for (let oy = -1; oy <= 1; oy++) {
        for (let ox = -1; ox <= 1; ox++) {
          const bx = gx + ox;
          const by = gy + oy;
          if (bx < 0 || by < 0 || bx >= GW || by >= GH) continue;
          for (const j of grid[by * GW + bx]) {
            if (j === i) continue;
            const dx = dwx[j] - dwx[i];
            const dy = dwy[j] - dwy[i];
            if (Math.abs(dx) > DOT_LINK_R || Math.abs(dy) > DOT_LINK_R) continue;
            const d = Math.hypot(dx, dy);
            if (d <= DOT_LINK_R) near.push({ j, d });
          }
        }
      }
      near.sort((p, q) => p.d - q.d);
      const result = near.slice(0, DOT_LINK_N).map((o) => o.j);
      neighborCache.set(i, result);
      return result;
    };

    const tr = { x: 0, y: 0, k: 1 };
    const forEachVisibleDot = (fn: (i: number, x: number, y: number) => void) => {
      const margin = 24;
      const gx0 = gridX((-margin - tr.x) / tr.k);
      const gx1 = gridX((w + margin - tr.x) / tr.k);
      const gy0 = gridY((-margin - tr.y) / tr.k);
      const gy1 = gridY((h + margin - tr.y) / tr.k);
      for (let gy = gy0; gy <= gy1; gy++) {
        for (let gx = gx0; gx <= gx1; gx++) {
          for (const i of grid[gy * GW + gx]) {
            const x = tr.x + dwx[i] * tr.k;
            const y = tr.y + dwy[i] * tr.k;
            if (x < -margin || x > w + margin || y < -margin || y > h + margin) continue;
            fn(i, x, y);
          }
        }
      }
    };

    const lsigs: { a: number; b: number; t0: number; dur: number; p: number }[] = [];
    const dacts: { i: number; at: number; power: number; w: Wave }[] = [];
    const acts: { id: string; at: number; power: number; hops: number; w: Wave }[] = [];
    const dsigs: { x: number; y: number; id: string; t0: number; p: number }[] = [];
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

    const emit = (x: number, y: number, now: number) => {
      refreshGraph();
      const wv: Wave = { seen: new Set(), touched: new Set(), seenDots: new Set() };
      const cands: { i: number; d: number }[] = [];
      forEachVisibleDot((i, dx, dy) => cands.push({ i, d: Math.hypot(dx - x, dy - y) }));
      cands.sort((p, q) => p.d - q.d);
      const seeds = cands.filter((c) => c.d <= SEED_R * tr.k);
      (seeds.length ? seeds : cands.slice(0, 1)).forEach((c) =>
        dacts.push({ i: c.i, at: now + (c.d / (SPEED * tr.k)) * 1000, power: 1, w: wv })
      );
    };
    emitRef.current = (x, y) => {
      const now = performance.now();
      emit(x, y, now);
      nextAuto = now + nextAutoDelay();
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
      const t = nowMs / 1000;
      refreshGraph();
      if (!reduceMotion && nowMs >= nextAuto) {
        emit(Math.random() * w, Math.random() * h, nowMs);
        nextAuto = nowMs + nextAutoDelay();
      }

      ctx.clearRect(0, 0, w, h);

      // 점 발화 -> 연결선을 따라 이웃 점으로, 노드 박스에 닿으면 노드로 전파
      for (let i = dacts.length - 1; i >= 0; i--) {
        const a = dacts[i];
        if (a.at > nowMs) continue;
        dacts.splice(i, 1);
        const dx = tr.x + dwx[a.i] * tr.k;
        const dy = tr.y + dwy[a.i] * tr.k;
        litDots.set(a.i, Math.max(litDots.get(a.i) ?? 0, a.power));
        if (a.w.seenDots.has(a.i)) continue;
        a.w.seenDots.add(a.i);
        // 점 사이 연결선을 따라 다음 점으로 전파 (세기가 약해지면 멈춤)
        const nextPower = a.power * DOT_DECAY;
        if (nextPower >= MIN_POWER) {
          for (const j of neighborsOf(a.i)) {
            if (a.w.seenDots.has(j)) continue;
            const bx = tr.x + dwx[j] * tr.k;
            const by = tr.y + dwy[j] * tr.k;
            const dur = (Math.hypot(bx - dx, by - dy) / (SPEED * tr.k)) * 1000;
            lsigs.push({ a: a.i, b: j, t0: nowMs, dur, p: nextPower });
            dacts.push({ i: j, at: nowMs + dur, power: nextPower, w: a.w });
          }
        }
        // 켜진 점이 노드 박스에 닿으면 그 노드로 전파
        snodes.forEach((n) => {
          if (a.w.touched.has(n.id)) return;
          const dist = Math.hypot(Math.max(Math.abs(n.x - dx) - n.hw, 0), Math.max(Math.abs(n.y - dy) - n.hh, 0));
          if (dist > NODE_TOUCH * tr.k) return;
          a.w.touched.add(n.id);
          dsigs.push({ x: dx, y: dy, id: n.id, t0: nowMs, p: a.power });
          acts.push({ id: n.id, at: nowMs + DOT_HOP * 1000, power: a.power * 0.9, hops: NODE_HOPS, w: a.w });
        });
      }
      // 노드 발화 -> 시냅스를 따라 몇 단계 전파
      for (let i = acts.length - 1; i >= 0; i--) {
        const a = acts[i];
        if (a.at > nowMs) continue;
        acts.splice(i, 1);
        if (a.w.seen.has(a.id)) continue;
        a.w.seen.add(a.id);
        lit.set(a.id, Math.max(lit.get(a.id) ?? 0, a.power));
        if (a.hops > 0) {
          for (const nb of adj.get(a.id) ?? []) {
            if (a.w.seen.has(nb)) continue;
            sigs.push({ a: a.id, b: nb, t0: nowMs, p: a.power * 0.7 });
            acts.push({ id: nb, at: nowMs + EDGE_HOP * 1000, power: a.power * 0.62, hops: a.hops - 1, w: a.w });
            const ek = edgeKey(a.id, nb);
            litE.set(ek, Math.max(litE.get(ek) ?? 0, a.power));
          }
        }
      }

      // 켜진 점 주변에서 숨겨져 있던 점 사이 연결선이 드러남
      ctx.lineWidth = 0.7;
      litDots.forEach((l, i) => {
        const x = tr.x + dwx[i] * tr.k;
        const y = tr.y + dwy[i] * tr.k;
        for (const j of neighborsOf(i)) {
          const lj = litDots.get(j);
          if (lj !== undefined && j < i) continue;
          const lv = (l + (lj ?? 0)) / 2;
          if (lv < 0.03) continue;
          ctx.strokeStyle = rgba(sig, 0.22 * lv);
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(tr.x + dwx[j] * tr.k, tr.y + dwy[j] * tr.k);
          ctx.stroke();
        }
      });

      // 배경 점 (축소하면 점도 함께 작아지되 너무 작아지지는 않음)
      // 점이 많으므로 투명도를 몇 단계로 묶어 한 번에 그린다
      const rf = Math.min(1, Math.max(tr.k, 0.4));
      for (const bucket of alphaBuckets) bucket.length = 0;
      forEachVisibleDot((i, x, y) => {
        const l = litDots.get(i);
        if (l !== undefined && l > 0.05) {
          ctx.globalCompositeOperation = 'lighter';
          glow(ctx, x, y, 8 + l * 8, sig, l * 0.3);
          ctx.globalCompositeOperation = 'source-over';
          ctx.fillStyle = rgba(dotColor, Math.min(1, da[i] + l * 0.45));
          ctx.beginPath();
          ctx.arc(x, y, dr[i] * rf + l * 0.8, 0, Math.PI * 2);
          ctx.fill();
          return;
        }
        const tw = reduceMotion ? 1 : 0.8 + 0.2 * Math.sin(t * dsp[i] + dtw[i]);
        const idx = Math.min(ALPHA_STEPS - 1, Math.floor(((da[i] * tw) / 0.52) * ALPHA_STEPS));
        alphaBuckets[idx].push(x, y, dr[i] * rf);
      });
      alphaBuckets.forEach((bucket, idx) => {
        if (!bucket.length) return;
        ctx.fillStyle = rgba(dotColor, ((idx + 0.5) / ALPHA_STEPS) * 0.52);
        ctx.beginPath();
        for (let n = 0; n < bucket.length; n += 3) {
          const r = bucket[n + 2];
          ctx.rect(bucket[n] - r, bucket[n + 1] - r, r * 2, r * 2);
        }
        ctx.fill();
      });
      litDots.forEach((l, i) => {
        const next = l - dt * 1.1;
        if (next <= 0) litDots.delete(i);
        else litDots.set(i, next);
      });

      // 점 사이 연결선을 따라 이동하는 신호
      for (let i = lsigs.length - 1; i >= 0; i--) {
        const g = lsigs[i];
        const u = (nowMs - g.t0) / g.dur;
        if (u >= 1) { lsigs.splice(i, 1); continue; }
        const ax = tr.x + dwx[g.a] * tr.k;
        const ay = tr.y + dwy[g.a] * tr.k;
        const bx = tr.x + dwx[g.b] * tr.k;
        const by = tr.y + dwy[g.b] * tr.k;
        ctx.globalCompositeOperation = 'lighter';
        glow(ctx, ax + (bx - ax) * u, ay + (by - ay) * u, 5, sig, 0.45 * g.p);
        ctx.globalCompositeOperation = 'source-over';
      }

      // 점 -> 노드 신호
      for (let i = dsigs.length - 1; i >= 0; i--) {
        const g = dsigs[i];
        const u = (nowMs - g.t0) / (DOT_HOP * 1000);
        const p = snodes.get(g.id);
        if (u >= 1 || !p) { dsigs.splice(i, 1); continue; }
        // 박스 중심이 아니라 점에서 중심으로 향하는 선이 박스 테두리와 만나는 지점까지만 이동
        const cx = p.x - g.x;
        const cy = p.y - g.y;
        const s = Math.min(cx === 0 ? Infinity : p.hw / Math.abs(cx), cy === 0 ? Infinity : p.hh / Math.abs(cy));
        if (s >= 1) { dsigs.splice(i, 1); continue; }
        const ex = p.x - cx * s;
        const ey = p.y - cy * s;
        const e = 1 - (1 - u) * (1 - u);
        const x = g.x + (ex - g.x) * e;
        const y = g.y + (ey - g.y) * e;
        const fade = 1 - u;
        ctx.strokeStyle = rgba(sig, 0.1 * g.p * fade);
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.moveTo(g.x, g.y);
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
        if (!A || !B) { litE.delete(key); return; }
        litE.set(key, Math.max(0, l - dt * DECAY * 0.8));
        if (l <= 0.01) { litE.delete(key); return; }
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
        if (u >= 1 || !A || !B) { sigs.splice(i, 1); continue; }
        const seg = borderSegment(A, B);
        if (!seg) { sigs.splice(i, 1); continue; }
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
        if (!n) { lit.delete(id); return; }
        lit.set(id, Math.max(0, l - dt * DECAY));
        if (l <= 0.01) { lit.delete(id); return; }
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
