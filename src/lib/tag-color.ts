// 기본 민트(#00ffc8)와 거의 같은 값은 테마색을 따라가게 한다 (색 선택기로 살짝 어긋난 값 포함)
function isLegacyMint(c: string): boolean {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(c);
  if (!m) return false;
  const [r, g, b] = [m[1], m[2], m[3]].map((h) => parseInt(h, 16));
  return r <= 24 && g >= 232 && Math.abs(b - 200) <= 24;
}

export const tagColor = (c: string) => (isLegacyMint(c) ? 'var(--neural-accent)' : c);

export const tagMix = (c: string, pct: number) => `color-mix(in srgb, ${tagColor(c)} ${pct}%, transparent)`;
