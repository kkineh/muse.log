export interface NeuralPalette {
  name: string;
  cat: string;
  sub: string;
  sub3: string;
  signal: string;
  dot: string;
}

export const NEURAL_PALETTES: NeuralPalette[] = [
  { name: '기본 민트', cat: '#00FFC8', sub: '#A78BFA', sub3: '#FACC15', signal: '#00FFC8', dot: '#AAEBFF' },
  { name: '일렉트릭 시안', cat: '#22D3EE', sub: '#A78BFA', sub3: '#F472B6', signal: '#67E8F9', dot: '#A5F3FC' },
  { name: '스카이 블루', cat: '#38BDF8', sub: '#8B5CF6', sub3: '#FBBF24', signal: '#7DD3FC', dot: '#BAE6FD' },
  { name: '딥 블루', cat: '#3B82F6', sub: '#A78BFA', sub3: '#F472B6', signal: '#60A5FA', dot: '#BFDBFE' },
  { name: '바이올렛', cat: '#8B5CF6', sub: '#22D3EE', sub3: '#F472B6', signal: '#A78BFA', dot: '#DDD6FE' },
  { name: '라벤더 앰버', cat: '#A78BFA', sub: '#38BDF8', sub3: '#FBBF24', signal: '#C4B5FD', dot: '#E9D5FF' },
  { name: '핑크', cat: '#F472B6', sub: '#A78BFA', sub3: '#22D3EE', signal: '#F9A8D4', dot: '#FBCFE8' },
  { name: '마젠타 시안', cat: '#E879F9', sub: '#22D3EE', sub3: '#FBBF24', signal: '#F0ABFC', dot: '#F5D0FE' },
  { name: '블루 앰버 신호', cat: '#38BDF8', sub: '#A78BFA', sub3: '#F472B6', signal: '#FBBF24', dot: '#FDE68A' },
  { name: '아이스', cat: '#7DD3FC', sub: '#C4B5FD', sub3: '#F9A8D4', signal: '#FFFFFF', dot: '#E0F2FE' },
];

export function hexA(hex: string, a: number): string {
  const v = parseInt(hex.slice(1), 16);
  return `rgba(${v >> 16},${(v >> 8) & 255},${v & 255},${a})`;
}

export const PALETTE_STORAGE_KEY = 'neural-palette';
export const DEFAULT_PALETTE_INDEX = NEURAL_PALETTES.findIndex((p) => p.name === '스카이 블루');

export function applyPalette(p: NeuralPalette) {
  const root = document.documentElement.style;
  const v = parseInt(p.cat.slice(1), 16);
  root.setProperty('--accent-rgb', `${v >> 16} ${(v >> 8) & 255} ${v & 255}`);
  root.setProperty('--color-primary', p.cat);
  root.setProperty('--neural-accent', p.cat);
  root.setProperty('--neural-border-glow', p.cat);
  root.setProperty('--neural-node-cat', p.cat);
  root.setProperty('--neural-node-sub', p.sub);
}
