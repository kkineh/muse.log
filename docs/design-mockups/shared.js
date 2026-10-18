window.Muse = (function () {
  const PALETTE = ['#00FFC8', '#A78BFA', '#38BDF8', '#F472B6', '#FBBF24'];
  const FONT = '"Pretendard","Apple SD Gothic Neo","Noto Sans KR",system-ui,sans-serif';
  const RAW = [
    ['IT / 개발', [
      ['Frontend', [['타입스크립트 제네릭이 갑자기 이해된 날', 'typescript-generics'], ['AI 코드 어시스턴트 6개월 후기', 'ai-code-assistant-review'], ['React 19 액션 패턴 실험', 'react-19-actions']]],
      ['Backend', [['Docker 없이 살 수 없는 이유', 'docker-essential']]],
      ['DevOps', [['CI/CD 파이프라인 자동화 여정', 'cicd-automation']]],
    ]],
    ['아이디어', [
      ['사고법', [['생각을 소유하는 것과 떠내려가는 것', 'owning-thoughts'], ['두 번째 뇌 구축 방법론', 'second-brain']]],
      ['프로덕트', [['MVP에서 배운 것들', 'mvp-lessons']]],
    ]],
    ['주식', [
      ['투자철학', [['손실을 기록하는 것의 의미', 'recording-losses']]],
      ['종목리뷰', [['ETF 포트폴리오 1년 결산', 'etf-portfolio-review']]],
    ]],
    ['생활', [
      ['일상', [['새벽 4시의 고요함에 대하여', 'dawn-silence']]],
      ['건강', [['러닝 100일 후 달라진 것들', 'running-100-days']]],
    ]],
    ['관계', [
      ['인간관계', [['가까운 사람에게 더 차가워지는 이유', 'cold-to-close-ones'], ['거리의 미학', 'aesthetics-of-distance']]],
    ]],
  ];
  const LINKS = [
    ['typescript-generics', 'ai-code-assistant-review'], ['typescript-generics', 'react-19-actions'],
    ['ai-code-assistant-review', 'second-brain'], ['docker-essential', 'cicd-automation'],
    ['owning-thoughts', 'second-brain'], ['owning-thoughts', 'dawn-silence'],
    ['recording-losses', 'etf-portfolio-review'], ['recording-losses', 'cold-to-close-ones'],
    ['cold-to-close-ones', 'aesthetics-of-distance'], ['running-100-days', 'dawn-silence'],
    ['mvp-lessons', 'ai-code-assistant-review'], ['etf-portfolio-review', 'owning-thoughts'],
  ];

  // ---- graph (unit layout: outermost ring = 1) ----
  const nodes = [], byId = {}, edges = [];
  function add(n) { nodes.push(n); byId[n.id] = n; return n; }
  add({ id: 'root', type: 'root', label: 'muse.log', ci: -1, ux: 0, uy: 0, ang: 0, rad: 0 });
  RAW.forEach((c, i) => {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / RAW.length;
    const cat = add({ id: 'c' + i, type: 'cat', label: c[0], ci: i, parent: 'root', ang: a, rad: 0.36 });
    edges.push({ a: 'root', b: cat.id, k: 'tree' });
    c[1].forEach((s, j) => {
      const sa = a + (j - (c[1].length - 1) / 2) * 0.4;
      const sub = add({ id: 's' + i + '_' + j, type: 'sub', label: s[0], ci: i, parent: cat.id, ang: sa, rad: 0.62 });
      edges.push({ a: cat.id, b: sub.id, k: 'tree' });
      s[1].forEach((p, m) => {
        const pa = sa + (m - (s[1].length - 1) / 2) * 0.15;
        const post = add({ id: 'p_' + p[1], type: 'post', label: p[0], slug: p[1], ci: i, parent: sub.id, ang: pa, rad: 0.92 });
        edges.push({ a: sub.id, b: post.id, k: 'tree' });
      });
    });
  });
  nodes.forEach((n) => { n.ux = Math.cos(n.ang) * n.rad; n.uy = Math.sin(n.ang) * n.rad; });
  LINKS.forEach(([a, b]) => edges.push({ a: 'p_' + a, b: 'p_' + b, k: 'tag' }));
  const adj = {};
  nodes.forEach((n) => (adj[n.id] = []));
  edges.forEach((e) => { adj[e.a].push(e.b); adj[e.b].push(e.a); });

  // ---- helpers ----
  function rng(seed) {
    let s = seed >>> 0;
    return function () {
      s += 0x6d2b79f5; let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function rgba(hex, a) {
    const n = parseInt(hex.slice(1), 16);
    return 'rgba(' + (n >> 16) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')';
  }
  function colorOf(n) { return n.ci < 0 ? '#FFFFFF' : PALETTE[n.ci % PALETTE.length]; }
  function short(s, n) { return s.length > n ? s.slice(0, n - 1) + '…' : s; }
  function glow(ctx, x, y, r, color, a) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, rgba(color, a));
    g.addColorStop(1, rgba(color, 0));
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(x, y, r, 0, 6.2832); ctx.fill();
  }
  function sparkle(ctx, x, y, r, color, a) {
    ctx.save(); ctx.translate(x, y);
    ctx.strokeStyle = rgba(color, a); ctx.lineWidth = 1; ctx.beginPath();
    ctx.moveTo(-r, 0); ctx.lineTo(r, 0); ctx.moveTo(0, -r); ctx.lineTo(0, r); ctx.stroke();
    ctx.restore();
  }
  function rr(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }
  function stars(n, seed) {
    const r = rng(seed), out = [];
    for (let i = 0; i < n; i++) out.push({ x: r(), y: r(), z: r(), r: 0.4 + r() * 1.1, tw: r() * 6.28, sp: 0.5 + r() * 1.5 });
    return out;
  }
  function drawStars(S, list, o) {
    o = o || {};
    const { ctx, W, H, mouse, t } = S, par = o.parallax == null ? 24 : o.parallax;
    for (const s of list) {
      const x = (((s.x * W - mouse.nx * par * (0.3 + s.z)) % W) + W) % W;
      const y = (((s.y * H - mouse.ny * par * (0.3 + s.z)) % H) + H) % H;
      const a = (0.25 + 0.55 * s.z) * (0.65 + 0.35 * Math.sin(t * s.sp + s.tw)) * (o.alpha == null ? 1 : o.alpha);
      ctx.fillStyle = 'rgba(' + (o.rgb || '220,235,255') + ',' + a + ')';
      ctx.beginPath(); ctx.arc(x, y, s.r * (0.6 + s.z * 0.8), 0, 6.2832); ctx.fill();
    }
  }
  function fit(S) {
    const ry = S.H * 0.44;
    return { cx: S.W / 2, cy: S.H / 2, ry, rx: Math.min(S.W * 0.44, ry * 1.55) };
  }
  function nearest(list, mx, my, maxD, get) {
    let best = null, bd = maxD;
    for (const it of list) {
      const p = get ? get(it) : it;
      if (!p) continue;
      const d = Math.hypot(p.x - mx, p.y - my) - (p.r || 0);
      if (d < bd) { bd = d; best = it; }
    }
    return best;
  }

  // ---- shell ----
  function init(o) {
    const body = document.body;
    body.style.cssText = 'margin:0;background:' + (o.bg || '#05070c') + ';overflow:hidden;font-family:' + FONT + ';color:#F0F0F0;';
    const canvas = document.createElement('canvas');
    canvas.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;display:block;';
    body.appendChild(canvas);
    const ctx = canvas.getContext('2d');
    const S = { canvas, ctx, W: 0, H: 0, dpr: 1, t: 0, mouse: { x: innerWidth / 2, y: innerHeight / 2, nx: 0, ny: 0, down: false }, clicks: [], hover: null };
    function resize() {
      S.dpr = Math.min(2, window.devicePixelRatio || 1);
      S.W = innerWidth; S.H = innerHeight;
      canvas.width = S.W * S.dpr; canvas.height = S.H * S.dpr;
      if (S.onResize) S.onResize();
    }
    addEventListener('resize', resize); resize();
    canvas.addEventListener('mousemove', (e) => {
      const m = S.mouse; m.x = e.clientX; m.y = e.clientY;
      m.nx = (e.clientX / S.W - 0.5) * 2; m.ny = (e.clientY / S.H - 0.5) * 2;
    });
    canvas.addEventListener('mousedown', () => (S.mouse.down = true));
    addEventListener('mouseup', () => (S.mouse.down = false));
    canvas.addEventListener('click', (e) => S.clicks.forEach((f) => f(e.clientX, e.clientY)));
    S.onClick = (f) => S.clicks.push(f);

    const ui = document.createElement('div');
    ui.innerHTML =
      '<style>.mq{position:fixed;z-index:5;font-size:12px;letter-spacing:.02em}' +
      '.mq-tag{left:20px;top:18px;pointer-events:none}.mq-tag a{pointer-events:auto;color:#7a8696;text-decoration:none}.mq-tag a:hover{color:#fff}' +
      '.mq-tag b{display:block;font-size:15px;margin-top:6px;color:#fff;font-weight:600}.mq-tag span{display:block;margin-top:3px;color:#7a8696;max-width:340px;line-height:1.5}' +
      '.mq-hint{left:20px;bottom:18px;color:#5b6676;pointer-events:none}' +
      '.mq-fab{right:24px;bottom:24px;width:50px;height:50px;border-radius:50%;border:1px solid rgba(0,255,200,.4);background:rgba(10,14,22,.85);color:#00FFC8;cursor:pointer;display:flex;align-items:center;justify-content:center;box-shadow:0 0 24px rgba(0,255,200,.18);backdrop-filter:blur(8px)}' +
      '.mq-fab:hover{box-shadow:0 0 32px rgba(0,255,200,.35)}' +
      '.mq-panel{right:24px;bottom:86px;width:300px;padding:16px;border-radius:14px;border:1px solid rgba(0,255,200,.25);background:rgba(10,14,22,.92);backdrop-filter:blur(10px);display:none;font-size:13px;color:#94a3b8;line-height:1.6}' +
      '.mq-panel.open{display:block}.mq-toast{left:50%;bottom:28px;transform:translateX(-50%);padding:8px 14px;border-radius:999px;background:rgba(10,14,22,.9);border:1px solid rgba(255,255,255,.14);color:#e5e7eb;opacity:0;transition:opacity .25s;pointer-events:none}' +
      '.mq-toast.on{opacity:1}</style>' +
      '<div class="mq mq-tag"><a href="index.html">← 목업 목록</a><b>' + o.no + ' · ' + o.title + '</b><span>' + o.note + '</span></div>' +
      '<div class="mq mq-hint">' + (o.hint || '') + '</div>' +
      '<div class="mq mq-panel" id="mqp">채팅은 기본값이 닫힘입니다. 버튼을 누르면 열립니다.</div>' +
      '<button class="mq mq-fab" id="mqf" aria-label="채팅 열기"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a8 8 0 0 1-11.6 7.1L3 21l1.9-5.4A8 8 0 1 1 21 12z"/></svg></button>' +
      '<div class="mq mq-toast" id="mqt"></div>';
    body.appendChild(ui);
    document.getElementById('mqf').onclick = () => document.getElementById('mqp').classList.toggle('open');
    let tt;
    S.toast = (msg) => {
      const el = document.getElementById('mqt'); el.textContent = msg; el.classList.add('on');
      clearTimeout(tt); tt = setTimeout(() => el.classList.remove('on'), 1800);
    };
    S.go = (n) => S.toast('→ /posts/' + n.slug);
    S.cursor = (on) => (canvas.style.cursor = on ? 'pointer' : 'default');
    S.loop = (fn) => {
      let last = performance.now();
      function f(now) {
        const dt = Math.min(0.05, (now - last) / 1000); last = now; S.t += dt;
        S.ctx.setTransform(S.dpr, 0, 0, S.dpr, 0, 0);
        fn(S.t, dt);
        requestAnimationFrame(f);
      }
      requestAnimationFrame(f);
    };
    return S;
  }

  return { PALETTE, FONT, RAW, nodes, byId, edges, adj, rng, rgba, colorOf, short, glow, sparkle, rr, stars, drawStars, fit, nearest, init };
})();
