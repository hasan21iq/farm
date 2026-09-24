// ============================================================
//  الرسم: المزرعة، الحيوانات، الناس، الكاميرا، والتأثيرات
// ============================================================

const WORLD_W = 1400, WORLD_H = 1060;
const BG_SCALE = 1.5;

const View = {
  canvas: null, ctx: null, dpr: 1, w: 0, h: 0,
  cam: { x: 440, y: 440, zoom: 0.8 },
  actors: new Map(),
  floaters: [], particles: [],
  t: 0, bg: null, bgKey: '', selected: null,
  clouds: [],
  onTap: null,
};

// ------------------------------------------------------------
//  أدوات رسم عامة
// ------------------------------------------------------------
function seeded(seed) {
  let x = seed >>> 0;
  return () => { x = (x * 1664525 + 1013904223) >>> 0; return x / 4294967296; };
}
function hexToRgb(h) { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
function rgbToHex(r, g, b) { return '#' + [r, g, b].map(v => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0')).join(''); }
const _colorCache = new Map();
function mix(a, b, t) {
  const k = a + b + t;
  if (_colorCache.has(k)) return _colorCache.get(k);
  const A = hexToRgb(a), B = hexToRgb(b);
  const r = rgbToHex(A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t);
  _colorCache.set(k, r);
  return r;
}
function shade(c, amt) { return amt < 0 ? mix(c, '#000000', -amt) : mix(c, '#ffffff', amt); }

function rr(c, x, y, w, h, r) {
  c.beginPath();
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r);
  c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + w, y, r);
  c.closePath();
}
function ell(c, x, y, rx, ry, rot = 0) { c.beginPath(); c.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), rot, 0, Math.PI * 2); }
function fillEll(c, x, y, rx, ry, col, rot) { ell(c, x, y, rx, ry, rot); c.fillStyle = col; c.fill(); }
function shadow(c, x, y, rx, ry) { fillEll(c, x, y, rx, ry, 'rgba(40,60,20,0.22)'); }

function sign(c, x, y, text, color = '#7a5230') {
  c.font = 'bold 15px Tahoma, "Segoe UI", sans-serif';
  const w = c.measureText(text).width + 18;
  c.fillStyle = '#5d3f22';
  c.fillRect(x - 2, y + 10, 4, 18);
  rr(c, x - w / 2, y - 12, w, 24, 5);
  c.fillStyle = color; c.fill();
  c.strokeStyle = 'rgba(0,0,0,0.25)'; c.lineWidth = 1.5; c.stroke();
  c.fillStyle = '#fff8e8';
  c.textAlign = 'center'; c.textBaseline = 'middle';
  c.fillText(text, x, y + 1);
}

// ------------------------------------------------------------
//  تخطيط المزرعة (يتغير مع التطوير)
// ------------------------------------------------------------
function layout(s) {
  const b = s.upgrades.barn;
  const pen = { x: 90, y: 215, w: 360 + b * 70, h: 250 + b * 45 };
  const barn = { x: pen.x + 12, y: pen.y + 6, w: 120, h: 96 };
  const trough = { x: pen.x + pen.w - 105, y: pen.y + pen.h - 42, w: 80, h: 24 };
  const plots = [];
  for (let i = 0; i < 16; i++) {
    const col = i % 8, row = Math.floor(i / 8);
    plots.push({ x: 90 + col * 84, y: 775 + row * 90, w: 72, h: 72 });
  }
  return {
    pen, barn, trough, plots,
    storage: { x: 965, y: 745, w: 170, h: 120 },
    clinic: { x: 1175, y: 760, w: 165, h: 110 },
    saleyard: { x: 925, y: 215, w: 420, h: 250 },
    dock: { x: 560, y: 55, w: 46, h: 140 },
    shipPos: { x: 740, y: 110 },
  };
}

function inRect(x, y, r, m = 0) { return x >= r.x - m && x <= r.x + r.w + m && y >= r.y - m && y <= r.y + r.h + m; }

function randomPenPoint(L) {
  const p = L.pen;
  for (let i = 0; i < 30; i++) {
    const x = rand(p.x + 25, p.x + p.w - 25);
    const y = rand(p.y + 30, p.y + p.h - 18);
    if (!inRect(x, y, L.barn, 22) && !inRect(x, y, L.trough, 14)) return { x, y };
  }
  return { x: p.x + p.w / 2, y: p.y + p.h / 2 };
}

// ------------------------------------------------------------
//  الخلفية الثابتة (تُرسم مرة واحدة عند تغيّر التخطيط)
// ------------------------------------------------------------
function buildBackground(s) {
  const L = layout(s);
  const cv = document.createElement('canvas');
  cv.width = WORLD_W * BG_SCALE; cv.height = WORLD_H * BG_SCALE;
  const c = cv.getContext('2d');
  c.scale(BG_SCALE, BG_SCALE);
  const R = seeded(1234);

  // عشب
  const g = c.createLinearGradient(0, 0, 0, WORLD_H);
  g.addColorStop(0, '#9ed36f'); g.addColorStop(1, '#86c25c');
  c.fillStyle = g; c.fillRect(0, 0, WORLD_W, WORLD_H);
  for (let i = 0; i < 900; i++) {
    const x = R() * WORLD_W, y = 150 + R() * (WORLD_H - 150);
    c.strokeStyle = R() < 0.5 ? 'rgba(70,130,40,0.35)' : 'rgba(190,230,140,0.4)';
    c.lineWidth = 1.4;
    c.beginPath(); c.moveTo(x, y); c.lineTo(x - 2, y - 5); c.moveTo(x + 2, y); c.lineTo(x + 3, y - 6); c.stroke();
  }
  for (let i = 0; i < 70; i++) {
    const x = R() * WORLD_W, y = 180 + R() * (WORLD_H - 180);
    fillEll(c, x, y, 2.4, 2.4, pick2(R, ['#ffffff', '#ffe15a', '#ff9ec0', '#b9a4ff']));
  }

  // البحر والشاطئ
  c.fillStyle = '#f0dca6';
  c.beginPath(); c.moveTo(0, 0); c.lineTo(WORLD_W, 0); c.lineTo(WORLD_W, 175);
  for (let x = WORLD_W; x >= 0; x -= 40) c.lineTo(x, 172 + Math.sin(x * 0.02) * 6);
  c.lineTo(0, 172); c.closePath(); c.fill();
  const sea = c.createLinearGradient(0, 0, 0, 150);
  sea.addColorStop(0, '#3f8fd0'); sea.addColorStop(1, '#6cc0e8');
  c.fillStyle = sea;
  c.beginPath(); c.moveTo(0, 0); c.lineTo(WORLD_W, 0); c.lineTo(WORLD_W, 140);
  for (let x = WORLD_W; x >= 0; x -= 30) c.lineTo(x, 140 + Math.sin(x * 0.03) * 7);
  c.lineTo(0, 140); c.closePath(); c.fill();

  // الطرق الترابية
  c.strokeStyle = '#d9bf8a'; c.lineCap = 'round'; c.lineJoin = 'round'; c.lineWidth = 34;
  c.beginPath();
  c.moveTo(L.pen.x + L.pen.w, L.pen.y + L.pen.h * 0.5); c.lineTo(870, L.pen.y + L.pen.h * 0.5);
  c.moveTo(870, 190); c.lineTo(870, 990);
  c.moveTo(80, 730); c.lineTo(1350, 730);
  c.moveTo(583, 190); c.lineTo(870, 190);
  c.moveTo(870, 340); c.lineTo(925, 340);
  c.stroke();
  c.strokeStyle = 'rgba(160,120,70,0.25)'; c.lineWidth = 2;
  for (let i = 0; i < 160; i++) {
    const onV = R() < 0.4;
    const x = onV ? 858 + R() * 24 : 90 + R() * 1250, y = onV ? 200 + R() * 740 : 718 + R() * 24;
    fillEll(c, x, y, 1.5, 1, 'rgba(150,110,60,0.35)');
  }

  // أرضية الحظيرة
  const P = L.pen;
  rr(c, P.x, P.y, P.w, P.h, 10);
  c.fillStyle = '#b9cc7c'; c.fill();
  for (let i = 0; i < P.w * P.h / 700; i++) fillEll(c, P.x + 8 + R() * (P.w - 16), P.y + 8 + R() * (P.h - 16), 3, 1.6, 'rgba(140,120,60,0.25)');
  // السياج
  fence(c, P.x, P.y, P.w, P.h, { gate: 'right' });

  // ساحة البيع
  const Y = L.saleyard;
  rr(c, Y.x, Y.y, Y.w, Y.h, 12);
  c.fillStyle = '#e8d3a2'; c.fill();
  for (let i = 0; i < 90; i++) fillEll(c, Y.x + 10 + R() * (Y.w - 20), Y.y + 10 + R() * (Y.h - 20), 2, 1.2, 'rgba(170,130,80,0.3)');
  fence(c, Y.x, Y.y, Y.w, Y.h, { gate: 'left' });

  // الحقول
  const n = upVal(s, 'fields');
  const nextN = s.upgrades.fields < UPGRADES.fields.levels.length - 1 ? UPGRADES.fields.levels[s.upgrades.fields + 1].v : n;
  L.plots.forEach((p, i) => {
    if (i < n) {
      rr(c, p.x, p.y, p.w, p.h, 8); c.fillStyle = '#8b5a3a'; c.fill();
      c.strokeStyle = '#6e4329'; c.lineWidth = 3; c.stroke();
      c.strokeStyle = 'rgba(60,35,20,0.35)'; c.lineWidth = 2;
      for (let k = 1; k < 4; k++) { c.beginPath(); c.moveTo(p.x + 6, p.y + k * p.h / 4); c.lineTo(p.x + p.w - 6, p.y + k * p.h / 4); c.stroke(); }
    } else if (i < nextN) {
      c.setLineDash([6, 6]);
      rr(c, p.x, p.y, p.w, p.h, 8); c.strokeStyle = 'rgba(90,60,30,0.45)'; c.lineWidth = 2; c.stroke();
      c.setLineDash([]);
      c.font = '20px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.globalAlpha = 0.6;
      c.fillText('🔒', p.x + p.w / 2, p.y + p.h / 2); c.globalAlpha = 1;
    }
  });

  // الرصيف
  const D = L.dock;
  c.fillStyle = '#6b4a2d';
  for (let k = 0; k < 5; k++) c.fillRect(D.x + 4, D.y + k * 30 + 10, 5, 22), c.fillRect(D.x + D.w - 9, D.y + k * 30 + 10, 5, 22);
  c.fillStyle = '#a57a4c'; c.fillRect(D.x, D.y, D.w, D.h);
  c.strokeStyle = '#7d5634'; c.lineWidth = 2;
  for (let y = D.y + 10; y < D.y + D.h; y += 10) { c.beginPath(); c.moveTo(D.x, y); c.lineTo(D.x + D.w, y); c.stroke(); }

  // الأشجار على الأطراف
  const trees = [];
  for (let y = 240; y < 1000; y += 70) trees.push([35 + R() * 20, y + R() * 20]);
  for (let x = 120; x < 1380; x += 90) trees.push([x + R() * 30, 1025 + R() * 15]);
  for (let y = 520; y < 700; y += 80) trees.push([1370 - R() * 20, y]);
  trees.push([1000, 560], [1080, 610], [1250, 540], [1300, 640], [930, 600]);
  trees.sort((a, b) => a[1] - b[1]).forEach(([x, y]) => tree(c, x, y, 0.8 + R() * 0.4, R));
  // صخور وشجيرات
  const busy = [L.pen, L.saleyard, L.storage, L.clinic, { x: 80, y: 700, w: 1280, h: 60 }, { x: 80, y: 765, w: 690, h: 190 }, { x: 850, y: 180, w: 40, h: 820 }];
  for (let i = 0; i < 40; i++) {
    const x = 60 + R() * 1300, y = 480 + R() * 520;
    if (!busy.some(r => inRect(x, y, r, 18))) bush(c, x, y, R);
  }

  return cv;
}
function pick2(R, arr) { return arr[Math.floor(R() * arr.length)]; }

function fence(c, x, y, w, h, opt) {
  c.strokeStyle = '#8a5d36'; c.lineWidth = 4; c.lineCap = 'round';
  const gateY = y + h * 0.5;
  const rails = (x1, y1, x2, y2) => {
    for (const off of [-10, -2]) { c.beginPath(); c.moveTo(x1, y1 + off); c.lineTo(x2, y2 + off); c.stroke(); }
  };
  rails(x, y, x + w, y);
  rails(x, y + h, x + w, y + h);
  if (opt.gate === 'right') { rails(x, y, x, y + h); rails(x + w, y, x + w, gateY - 22); rails(x + w, gateY + 22, x + w, y + h); }
  else { rails(x + w, y, x + w, y + h); rails(x, y, x, gateY - 22); rails(x, gateY + 22, x, y + h); }
  c.fillStyle = '#6f4527';
  const post = (px, py) => { c.fillRect(px - 3, py - 16, 6, 18); };
  for (let px = x; px <= x + w; px += 40) { post(px, y); post(px, y + h); }
  for (let py = y; py <= y + h; py += 40) { post(x, py); post(x + w, py); }
}

function tree(c, x, y, s, R) {
  shadow(c, x + 6, y + 2, 26 * s, 9 * s);
  c.fillStyle = '#7a5233'; c.fillRect(x - 4 * s, y - 26 * s, 8 * s, 28 * s);
  const greens = ['#4f9a3c', '#5aa844', '#66b44c'];
  fillEll(c, x, y - 42 * s, 26 * s, 24 * s, greens[0]);
  fillEll(c, x - 13 * s, y - 34 * s, 17 * s, 15 * s, greens[1]);
  fillEll(c, x + 13 * s, y - 36 * s, 17 * s, 15 * s, greens[1]);
  fillEll(c, x - 4 * s, y - 52 * s, 15 * s, 12 * s, greens[2]);
  if (R() < 0.4) for (let i = 0; i < 4; i++) fillEll(c, x - 14 * s + R() * 28 * s, y - 50 * s + R() * 24 * s, 2.6 * s, 2.6 * s, '#e0463a');
}
function bush(c, x, y, R) {
  if (R() < 0.35) { fillEll(c, x, y, 9, 6, '#a3a39a'); fillEll(c, x - 2, y - 2, 6, 3.5, '#c4c4bb'); return; }
  fillEll(c, x, y, 12, 8, '#5aa844'); fillEll(c, x - 6, y - 3, 7, 6, '#6cbc50'); fillEll(c, x + 6, y - 3, 7, 6, '#6cbc50');
}

// ------------------------------------------------------------
//  المباني
// ------------------------------------------------------------
function drawBarn(c, r, night) {
  const x = r.x, y = r.y, w = r.w, h = r.h;
  shadow(c, x + w / 2 + 6, y + h + 2, w * 0.55, 10);
  c.fillStyle = '#c8453b'; c.fillRect(x, y + 34, w, h - 34);
  c.fillStyle = '#8e2b25';
  c.beginPath(); c.moveTo(x - 8, y + 38); c.lineTo(x + 16, y + 6); c.lineTo(x + w / 2, y - 8); c.lineTo(x + w - 16, y + 6); c.lineTo(x + w + 8, y + 38); c.closePath(); c.fill();
  c.strokeStyle = '#fff4e6'; c.lineWidth = 3;
  c.beginPath(); c.moveTo(x - 8, y + 38); c.lineTo(x + 16, y + 6); c.lineTo(x + w / 2, y - 8); c.lineTo(x + w - 16, y + 6); c.lineTo(x + w + 8, y + 38); c.stroke();
  const dw = 44, dx = x + w / 2 - dw / 2, dy = y + h - 48;
  c.fillStyle = '#7a2620'; c.fillRect(dx, dy, dw, 48);
  c.strokeStyle = '#fff4e6'; c.lineWidth = 3; c.strokeRect(dx, dy, dw, 48);
  c.beginPath(); c.moveTo(dx, dy); c.lineTo(dx + dw, dy + 48); c.moveTo(dx + dw, dy); c.lineTo(dx, dy + 48); c.stroke();
  c.fillStyle = night ? '#ffd76a' : '#3b2a22';
  rr(c, x + w / 2 - 10, y + 14, 20, 16, 3); c.fill();
  c.strokeStyle = '#fff4e6'; c.lineWidth = 2; c.stroke();
  // كومة قش
  fillEll(c, x + w + 2, y + h - 6, 16, 9, '#e5c253'); fillEll(c, x + w + 4, y + h - 12, 11, 7, '#f0d06a');
}

function drawTrough(c, r, filled) {
  shadow(c, r.x + r.w / 2, r.y + r.h + 2, r.w * 0.55, 6);
  c.fillStyle = '#7d5634'; c.fillRect(r.x + 4, r.y + r.h - 4, 6, 8); c.fillRect(r.x + r.w - 10, r.y + r.h - 4, 6, 8);
  rr(c, r.x, r.y, r.w, r.h, 4); c.fillStyle = '#9a6b40'; c.fill();
  c.strokeStyle = '#6b4526'; c.lineWidth = 2; c.stroke();
  if (filled) { fillEll(c, r.x + r.w / 2, r.y + 5, r.w * 0.42, 6, '#d9b64c'); fillEll(c, r.x + r.w / 2 - 12, r.y + 3, 12, 4, '#ecce65'); }
}

function drawStorage(c, r, ratio, night) {
  const { x, y, w, h } = r;
  shadow(c, x + w / 2 + 8, y + h + 2, w * 0.6, 10);
  // صومعة
  const sx = x + w - 34, sw = 44;
  c.fillStyle = '#c3c8ce'; c.fillRect(sx, y - 10, sw, h + 10);
  c.fillStyle = '#a9b0b8'; c.fillRect(sx + sw - 10, y - 10, 10, h + 10);
  fillEll(c, sx + sw / 2, y - 10, sw / 2, 14, '#8f98a3');
  c.fillStyle = 'rgba(0,0,0,0.15)'; c.fillRect(sx + 6, y + 6, 8, h - 12);
  c.fillStyle = '#e8c24f'; const fh = (h - 16) * ratio; c.fillRect(sx + 6, y + h - 6 - fh, 8, fh);
  // مستودع
  c.fillStyle = '#b98b5a'; c.fillRect(x, y + 30, w - 34, h - 30);
  c.strokeStyle = 'rgba(90,60,30,0.3)'; c.lineWidth = 2;
  for (let px = x + 10; px < x + w - 34; px += 12) { c.beginPath(); c.moveTo(px, y + 32); c.lineTo(px, y + h); c.stroke(); }
  c.fillStyle = '#7a5436';
  c.beginPath(); c.moveTo(x - 8, y + 34); c.lineTo(x + (w - 34) / 2, y + 2); c.lineTo(x + w - 26, y + 34); c.closePath(); c.fill();
  c.fillStyle = '#5c3d24'; c.fillRect(x + 30, y + h - 44, 50, 44);
  c.fillStyle = night ? '#ffd76a' : '#4a3020';
  c.fillRect(x + 90, y + 50, 20, 16);
  sign(c, x + (w - 34) / 2, y + h + 22, 'المخزن');
}

function drawClinic(c, r, night) {
  const { x, y, w, h } = r;
  shadow(c, x + w / 2 + 8, y + h + 2, w * 0.58, 10);
  c.fillStyle = '#f4f6f5'; c.fillRect(x, y + 22, w, h - 22);
  c.fillStyle = '#3a9d8f';
  c.beginPath(); c.moveTo(x - 8, y + 26); c.lineTo(x + 20, y - 4); c.lineTo(x + w - 20, y - 4); c.lineTo(x + w + 8, y + 26); c.closePath(); c.fill();
  // صليب أخضر
  const cx = x + w / 2, cy = y + 44;
  c.fillStyle = '#2fae62'; c.fillRect(cx - 5, cy - 14, 10, 28); c.fillRect(cx - 14, cy - 5, 28, 10);
  c.fillStyle = night ? '#ffe28a' : '#9fd3e8';
  c.fillRect(x + 16, y + 38, 26, 20); c.fillRect(x + w - 42, y + 38, 26, 20);
  c.fillStyle = '#6a7d86'; c.fillRect(cx - 16, y + h - 36, 32, 36);
  sign(c, x + w / 2, y + h + 22, 'الطبيب البيطري', '#2f7f74');
}

function drawStall(c, Y, night) {
  const x = Y.x + Y.w - 150, y = Y.y + 30;
  shadow(c, x + 60, y + 78, 70, 8);
  c.fillStyle = '#8a5d36'; c.fillRect(x + 4, y + 20, 5, 58); c.fillRect(x + 111, y + 20, 5, 58);
  c.fillStyle = '#a97b4f'; c.fillRect(x, y + 52, 120, 26);
  for (let i = 0; i < 6; i++) {
    c.fillStyle = i % 2 ? '#fff4e0' : '#e0533d';
    c.beginPath(); c.moveTo(x - 6 + i * 22, y + 20); c.lineTo(x - 6 + (i + 1) * 22, y + 20); c.lineTo(x - 6 + (i + 1) * 22, y + 4); c.lineTo(x - 6 + i * 22, y + 4); c.fill();
    c.beginPath(); c.arc(x + 5 + i * 22, y + 20, 11, 0, Math.PI); c.fill();
  }
  sign(c, Y.x + Y.w / 2 - 70, Y.y + 22, 'ساحة البيع', '#b0442f');
}

// ------------------------------------------------------------
//  الحيوانات
// ------------------------------------------------------------
function drawAnimalShape(c, type, p) {
  const L = ANIMALS[type].look;
  if (L.kind === 'chicken') drawChicken(c, L, p); else drawQuad(c, L, p);
}

function drawQuad(c, L, p) {
  const { rx, ry, lh, lw } = L;
  const lift = p.lying ? lh * 0.85 : 0;
  const by = -(lh + ry * 0.55) + lift;
  const sw = p.moving ? Math.sin(p.phase) * 5 : 0;
  const body = p.sick ? mix(L.body, '#a9c46c', 0.4) : L.body;
  const headC = p.sick ? mix(L.head, '#a9c46c', 0.35) : L.head;

  shadow(c, 0, 1, rx * 1.05, ry * 0.4);
  if (!p.lying) legs(c, [[-rx * 0.55 + 4, -sw], [rx * 0.55 + 4, sw]], by, L, shade(L.leg, -0.2));

  // الذيل
  const tw = Math.sin(p.t * 3 + p.seed) * 3;
  c.strokeStyle = shade(body, -0.25); c.lineWidth = Math.max(2, lw * 0.5); c.lineCap = 'round';
  c.beginPath(); c.moveTo(-rx + 3, by - ry * 0.3);
  c.quadraticCurveTo(-rx - 7, by, -rx - 4 + tw, by + ry * 0.75); c.stroke();

  // الجسم
  if (L.wool) {
    fillEll(c, 0, by, rx, ry, shade(body, -0.08));
    for (let k = 0; k < 12; k++) {
      const a = (k / 12) * Math.PI * 2;
      fillEll(c, Math.cos(a) * rx * 0.78, by + Math.sin(a) * ry * 0.7, ry * 0.45, ry * 0.42, body);
    }
    fillEll(c, 0, by - ry * 0.1, rx * 0.75, ry * 0.7, body);
    fillEll(c, -rx * 0.2, by - ry * 0.35, rx * 0.35, ry * 0.25, shade(body, 0.4));
  } else {
    ell(c, 0, by, rx, ry); c.fillStyle = body; c.fill();
    if (L.spots) {
      c.save(); ell(c, 0, by, rx, ry); c.clip();
      const sp = L.spots;
      fillEll(c, -rx * 0.35, by - ry * 0.3, rx * 0.3, ry * 0.45, sp, 0.3);
      fillEll(c, rx * 0.3, by + ry * 0.25, rx * 0.22, ry * 0.35, sp, -0.4);
      fillEll(c, -rx * 0.75, by + ry * 0.4, rx * 0.18, ry * 0.3, sp);
      c.restore();
    }
    fillEll(c, -rx * 0.1, by - ry * 0.45, rx * 0.55, ry * 0.2, 'rgba(255,255,255,0.18)');
    ell(c, 0, by, rx, ry); c.strokeStyle = 'rgba(0,0,0,0.18)'; c.lineWidth = 1.2; c.stroke();
  }
  if (!p.lying) legs(c, [[-rx * 0.55, sw], [rx * 0.55, -sw]], by, L, L.leg);

  // الرأس
  const hs = ry * 0.72;
  const g = p.graze && !p.lying ? 1 : 0;
  const hx = rx * 0.95 + g * 5;
  const hy = (by - ry * 0.6) * (1 - g) + g * (-hs * 0.9) + (p.lying ? 2 : 0);
  c.strokeStyle = L.wool ? shade(body, -0.05) : body; c.lineWidth = ry * 0.9; c.lineCap = 'round';
  c.beginPath(); c.moveTo(rx * 0.55, by - ry * 0.15); c.lineTo(hx, hy); c.stroke();
  const ef = Math.sin(p.t * 2.2 + p.seed * 3) > 0.92 ? 0.5 : 0;
  fillEll(c, hx - hs * 0.35, hy - hs * 0.55, hs * 0.5, hs * 0.22, L.ear, -0.5 - ef);
  if (L.horns === 'small') {
    c.strokeStyle = '#e8dcc0'; c.lineWidth = 3;
    c.beginPath(); c.moveTo(hx, hy - hs * 0.6); c.quadraticCurveTo(hx + 2, hy - hs * 1.3, hx + 6, hy - hs * 1.25); c.stroke();
  } else if (L.horns === 'back') {
    c.strokeStyle = '#6b5a48'; c.lineWidth = 3;
    c.beginPath(); c.moveTo(hx + 2, hy - hs * 0.6); c.quadraticCurveTo(hx - 2, hy - hs * 1.6, hx - 9, hy - hs * 1.2); c.stroke();
  } else if (L.horns === 'big') {
    c.strokeStyle = '#2b2626'; c.lineWidth = 4.5;
    c.beginPath(); c.moveTo(hx + 3, hy - hs * 0.5); c.quadraticCurveTo(hx - 16, hy - hs * 0.9, hx - 12, hy - hs * 1.7); c.stroke();
  }
  fillEll(c, hx + hs * 0.25, hy, hs, hs * 0.72, headC);
  if (L.wool) fillEll(c, hx + hs * 0.05, hy - hs * 0.6, hs * 0.55, hs * 0.35, body);
  fillEll(c, hx + hs * 0.95, hy + hs * 0.22, hs * 0.5, hs * 0.45, L.muzzle);
  fillEll(c, hx + hs * 1.12, hy + hs * 0.12, 1.3, 1.1, 'rgba(0,0,0,0.5)');
  if (L.beard) { c.fillStyle = shade(L.head, 0.35); c.beginPath(); c.moveTo(hx + hs * 0.7, hy + hs * 0.55); c.lineTo(hx + hs * 1, hy + hs * 0.6); c.lineTo(hx + hs * 0.75, hy + hs * 1.3); c.fill(); }
  if (p.lying && p.night) {
    c.strokeStyle = '#222'; c.lineWidth = 1.2;
    c.beginPath(); c.moveTo(hx + hs * 0.3, hy - hs * 0.15); c.lineTo(hx + hs * 0.6, hy - hs * 0.15); c.stroke();
  } else {
    fillEll(c, hx + hs * 0.45, hy - hs * 0.18, Math.max(1.6, hs * 0.16), Math.max(1.6, hs * 0.16), '#1d1a18');
    fillEll(c, hx + hs * 0.5, hy - hs * 0.24, 0.8, 0.8, '#ffffff');
  }
}

function legs(c, xs, by, L, col) {
  c.lineCap = 'round'; c.lineWidth = L.lw;
  for (const [x, s] of xs) {
    c.strokeStyle = col;
    c.beginPath(); c.moveTo(x, by + L.ry * 0.3); c.lineTo(x + s, -L.lw * 0.4); c.stroke();
    c.strokeStyle = L.hoof;
    c.beginPath(); c.moveTo(x + s * 0.93, -3); c.lineTo(x + s, -L.lw * 0.4); c.stroke();
  }
}

function drawChicken(c, L, p) {
  const hop = p.moving ? Math.abs(Math.sin(p.phase)) * 3 : 0;
  const by = -12 - hop + (p.lying ? 6 : 0);
  const body = p.sick ? mix(L.body, '#a9c46c', 0.4) : L.body;
  const sw = p.moving ? Math.sin(p.phase) * 3 : 0;
  shadow(c, 0, 1, 10, 3.5);
  if (!p.lying) {
    c.strokeStyle = L.leg; c.lineWidth = 2; c.lineCap = 'round';
    c.beginPath(); c.moveTo(-2, by + 6); c.lineTo(-3 + sw, 0); c.moveTo(3, by + 6); c.lineTo(3 - sw, 0); c.stroke();
  }
  c.fillStyle = shade(body, -0.12);
  c.beginPath(); c.moveTo(-6, by - 2); c.lineTo(-16, by - 12); c.lineTo(-14, by + 2); c.closePath(); c.fill();
  fillEll(c, 0, by, 10.5, 8.5, body);
  ell(c, 0, by, 10.5, 8.5); c.strokeStyle = 'rgba(0,0,0,0.15)'; c.lineWidth = 1; c.stroke();
  fillEll(c, -1.5, by + 1, 6, 4.5, L.wing, -0.2);
  const g = p.graze && !p.lying ? 1 : 0;
  const hx = 8 + g * 3, hy = by - 8 + g * 10;
  fillEll(c, hx, hy, 5.2, 5.2, body);
  fillEll(c, hx - 1, hy - 5.5, 2, 2, L.comb); fillEll(c, hx + 1.5, hy - 5.8, 2, 2, L.comb);
  c.fillStyle = L.beak; c.beginPath(); c.moveTo(hx + 4.5, hy - 1); c.lineTo(hx + 9, hy + 0.5); c.lineTo(hx + 4.5, hy + 2); c.fill();
  fillEll(c, hx + 4, hy + 3.2, 1.3, 2, L.comb);
  if (p.lying && p.night) { c.strokeStyle = '#222'; c.lineWidth = 1; c.beginPath(); c.moveTo(hx + 0.5, hy - 1); c.lineTo(hx + 3, hy - 1); c.stroke(); }
  else fillEll(c, hx + 1.8, hy - 1.2, 1.2, 1.2, '#1d1a18');
}

// صورة الحيوان داخل النوافذ
function animalPortrait(canvas, type, stage, sick) {
  const c = canvas.getContext('2d');
  const d = window.devicePixelRatio || 1;
  const w = canvas.clientWidth || 120, h = canvas.clientHeight || 90;
  canvas.width = w * d; canvas.height = h * d;
  c.setTransform(d, 0, 0, d, 0, 0);
  c.clearRect(0, 0, w, h);
  const L = ANIMALS[type].look;
  const base = L.kind === 'chicken' ? 30 : (L.rx + L.lh) * 1.6;
  const sc = Math.min(w, h * 1.3) / base * 0.85 * (0.75 + 0.25 * ANIMALS[type].stages[stage].size);
  c.save(); c.translate(w / 2 - 4, h * 0.86); c.scale(sc, sc);
  drawAnimalShape(c, type, { phase: 0, moving: false, t: 0, seed: 1, sick, graze: false, lying: false });
  c.restore();
}

// ------------------------------------------------------------
//  الأشخاص
// ------------------------------------------------------------
function drawPerson(c, look, t, opts = {}) {
  const sway = Math.sin(t * 2 + (opts.seed || 0)) * 1.2;
  const walk = opts.walking ? Math.sin(t * 10) * 3 : 0;
  shadow(c, 0, 1, 11, 4);
  c.strokeStyle = '#3a2d25'; c.lineWidth = 4; c.lineCap = 'round';
  c.beginPath(); c.moveTo(-4, -10); c.lineTo(-4 + walk, 0); c.moveTo(4, -10); c.lineTo(4 - walk, 0); c.stroke();
  c.fillStyle = look.robe;
  c.beginPath(); c.moveTo(-8, -36); c.lineTo(8, -36); c.lineTo(11 + sway * 0.3, -7); c.lineTo(-11 + sway * 0.3, -7); c.closePath(); c.fill();
  c.strokeStyle = 'rgba(0,0,0,0.2)'; c.lineWidth = 1; c.stroke();
  if (opts.vet) {
    c.strokeStyle = '#2d5d7c'; c.lineWidth = 1.6;
    c.beginPath(); c.moveTo(-4, -35); c.quadraticCurveTo(0, -24, 4, -35); c.stroke();
    c.fillStyle = '#6b3d24'; rr(c, 9, -20, 11, 9, 2); c.fill();
  }
  fillEll(c, 0, -43, 7.5, 7.5, look.skin);
  if (opts.vet) {
    c.fillStyle = '#2fae62'; c.beginPath(); c.arc(0, -46, 7.8, Math.PI, 0); c.fill();
  } else {
    c.fillStyle = look.head;
    c.beginPath(); c.arc(0, -45, 8.5, Math.PI, 0); c.lineTo(9, -34); c.lineTo(5, -38); c.lineTo(-5, -38); c.lineTo(-9, -34); c.closePath(); c.fill();
    c.strokeStyle = '#1f1f1f'; c.lineWidth = 2.2; c.beginPath(); c.ellipse(0, -48, 7.5, 2.2, 0, 0, Math.PI * 2); c.stroke();
  }
  fillEll(c, 2.5, -43, 1.1, 1.1, '#1d1a18'); fillEll(c, -2.5, -43, 1.1, 1.1, '#1d1a18');
}

function drawShip(c, x, y, t) {
  const bob = Math.sin(t * 1.4) * 2;
  c.save(); c.translate(x, y + bob);
  fillEll(c, 0, 16, 120, 10, 'rgba(255,255,255,0.35)');
  c.fillStyle = '#2f4f7a';
  c.beginPath(); c.moveTo(-120, -8); c.lineTo(125, -8); c.lineTo(100, 18); c.lineTo(-105, 18); c.closePath(); c.fill();
  c.fillStyle = '#c8453b'; c.fillRect(-110, 10, 212, 5);
  c.fillStyle = '#ffffff'; c.fillRect(-117, -8, 240, 4);
  const cols = ['#e0533d', '#f2b33d', '#3a9d8f', '#6a7bd0', '#e07a3d'];
  for (let i = 0; i < 5; i++) { c.fillStyle = cols[i]; c.fillRect(-60 + i * 30, -30, 27, 22); c.fillStyle = 'rgba(0,0,0,0.15)'; c.fillRect(-60 + i * 30, -30, 27, 3); }
  c.fillStyle = '#f4f6f5'; c.fillRect(-105, -52, 40, 44);
  c.fillStyle = '#5a8fb8'; c.fillRect(-100, -46, 30, 8);
  c.fillStyle = '#d64545'; c.fillRect(-95, -70, 12, 18);
  for (let i = 0; i < 3; i++) fillEll(c, -89 - i * 8 + Math.sin(t + i) * 2, -78 - i * 10, 6 + i * 2, 5 + i * 2, `rgba(220,220,220,${0.6 - i * 0.15})`);
  c.fillStyle = '#fff'; c.font = 'bold 11px Tahoma'; c.textAlign = 'center'; c.fillText('FARM EXPRESS', 10, 6);
  c.restore();
}

// ------------------------------------------------------------
//  المحاصيل
// ------------------------------------------------------------
function drawPlot(c, p, r, t) {
  if (!p.crop) return;
  const C = CROPS[p.crop];
  const pr = p.progress;
  for (let i = 0; i < 9; i++) {
    const px = r.x + 14 + (i % 3) * 22, py = r.y + 22 + Math.floor(i / 3) * 21;
    const sway = Math.sin(t * 2 + i) * 1.2;
    if (p.withered) {
      c.strokeStyle = '#8a6a3c'; c.lineWidth = 2;
      c.beginPath(); c.moveTo(px, py); c.quadraticCurveTo(px + 3, py - 6, px + 7, py - 3); c.stroke();
      continue;
    }
    const col = pr >= 1 ? C.ripe : mix(C.color, C.ripe, pr * 0.3);
    const hgt = 4 + pr * 14;
    if (p.crop === 'grass' || pr < 0.25) {
      c.strokeStyle = C.color; c.lineWidth = 2; c.lineCap = 'round';
      c.beginPath();
      c.moveTo(px, py); c.lineTo(px - 3 + sway, py - hgt * 0.8);
      c.moveTo(px, py); c.lineTo(px + sway, py - hgt);
      c.moveTo(px, py); c.lineTo(px + 3 + sway, py - hgt * 0.75);
      c.stroke();
      if (p.crop === 'grass' && pr >= 1) fillEll(c, px + sway, py - hgt, 1.6, 1.6, '#c7f07c');
    } else if (p.crop === 'barley') {
      c.strokeStyle = C.color; c.lineWidth = 1.6;
      c.beginPath(); c.moveTo(px, py); c.lineTo(px + sway, py - hgt); c.moveTo(px + 3, py); c.lineTo(px + 3 + sway, py - hgt * 0.85); c.stroke();
      fillEll(c, px + sway, py - hgt - 3, 2, 4.5, col); fillEll(c, px + 3 + sway, py - hgt * 0.85 - 3, 2, 4, col);
    } else if (p.crop === 'corn') {
      c.strokeStyle = '#4f9a3c'; c.lineWidth = 2.4;
      c.beginPath(); c.moveTo(px, py); c.lineTo(px + sway, py - hgt * 1.25); c.stroke();
      c.strokeStyle = '#66b44c'; c.lineWidth = 2;
      c.beginPath(); c.moveTo(px, py - hgt * 0.5); c.quadraticCurveTo(px - 6, py - hgt * 0.6, px - 8 + sway, py - hgt * 0.3); c.stroke();
      c.beginPath(); c.moveTo(px, py - hgt * 0.7); c.quadraticCurveTo(px + 6, py - hgt * 0.8, px + 8 + sway, py - hgt * 0.5); c.stroke();
      if (pr > 0.6) fillEll(c, px + 2 + sway, py - hgt * 0.8, 2.4, 4.5, col);
    } else {
      fillEll(c, px + sway * 0.5, py - hgt * 0.4, 4 + pr * 3, 3 + pr * 3, C.color);
      if (pr >= 0.8) { fillEll(c, px - 2 + sway, py - hgt * 0.6, 1.8, 1.8, C.ripe); fillEll(c, px + 3 + sway, py - hgt * 0.5, 1.8, 1.8, C.ripe); }
    }
  }
  if (p.withered) return;
  if (pr < 1) {
    rr(c, r.x + 8, r.y + r.h - 9, r.w - 16, 6, 3); c.fillStyle = 'rgba(0,0,0,0.35)'; c.fill();
    rr(c, r.x + 8, r.y + r.h - 9, (r.w - 16) * pr, 6, 3); c.fillStyle = '#9be15d'; c.fill();
  } else {
    const b = Math.sin(t * 4) * 3;
    fillEll(c, r.x + r.w / 2, r.y - 8 + b, 12, 12, '#fffbe8');
    c.font = '14px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText(C.icon, r.x + r.w / 2, r.y - 7 + b);
  }
}

// ------------------------------------------------------------
//  الممثلون (حركة الحيوانات)
// ------------------------------------------------------------
function syncActors(s, L) {
  const ids = new Set();
  for (const a of s.animals) {
    ids.add(a.id);
    if (!View.actors.has(a.id)) {
      const p = randomPenPoint(L);
      View.actors.set(a.id, { x: p.x, y: p.y, tx: p.x, ty: p.y, state: 'idle', timer: rand(0, 3), phase: 0, facing: Math.random() < 0.5 ? 1 : -1, seed: Math.random() * 10, pop: 0 });
    }
  }
  for (const id of [...View.actors.keys()]) if (!ids.has(id)) View.actors.delete(id);
}

function updateActors(s, L, dt, night) {
  for (const a of s.animals) {
    const act = View.actors.get(a.id);
    if (!act) continue;
    act.pop = Math.min(1, act.pop + dt * 3);
    // إبقاء الحيوان داخل الحظيرة إذا تغيّر حجمها
    if (!inRect(act.x, act.y, L.pen, -10)) { const p = randomPenPoint(L); act.x = p.x; act.y = p.y; act.state = 'idle'; }
    if (night) { act.state = 'sleep'; act.moving = false; continue; }
    if (act.state === 'sleep') { act.state = 'idle'; act.timer = rand(0, 2); }
    const T = ANIMALS[a.type];
    let speed = T.look.speed * (a.disease ? 0.45 : 1) * (a.hunger < 20 ? 0.6 : 1);
    if (act.state === 'walk') {
      const dx = act.tx - act.x, dy = act.ty - act.y;
      const d = Math.hypot(dx, dy);
      if (d < 2) { act.state = Math.random() < 0.55 ? 'graze' : 'idle'; act.timer = rand(1.5, 5); act.moving = false; }
      else {
        const m = Math.min(d, speed * dt);
        act.x += dx / d * m; act.y += dy / d * m;
        if (Math.abs(dx) > 1) act.facing = dx > 0 ? 1 : -1;
        act.phase += dt * speed * 0.45;
        act.moving = true;
      }
    } else {
      act.moving = false;
      act.timer -= dt;
      if (act.timer <= 0) {
        const p = Math.random() < 0.2 && s.feed && feedTotal(s) > 0
          ? { x: L.trough.x + rand(0, L.trough.w), y: L.trough.y + L.trough.h + 12 }
          : randomPenPoint(L);
        act.tx = p.x; act.ty = p.y; act.state = 'walk';
      }
    }
  }
}

// ------------------------------------------------------------
//  التأثيرات
// ------------------------------------------------------------
function floatText(x, y, text, color = '#ffd84a') {
  View.floaters.push({ x, y, text, color, life: 1.8 });
}
function burst(x, y, kind, n = 8) {
  for (let i = 0; i < n; i++) {
    View.particles.push({ x, y, vx: rand(-40, 40), vy: rand(-80, -30), life: rand(0.7, 1.2), kind });
  }
}

function handleFx(type, data) {
  const L = layout(S);
  const actorPos = a => { const act = View.actors.get(a.id); return act ? act : { x: L.pen.x + L.pen.w / 2, y: L.pen.y + L.pen.h / 2 }; };
  if (type === 'money') {
    const at = data.at === 'saleyard' ? { x: L.saleyard.x + 200, y: L.saleyard.y + 120 }
      : data.at === 'dock' ? { x: L.shipPos.x, y: L.shipPos.y + 40 } : { x: L.pen.x + L.pen.w / 2, y: L.pen.y + 60 };
    floatText(at.x, at.y, `+${data.amount} 💰`);
    burst(at.x, at.y, 'coin', 12);
    Sfx.coin();
  } else if (type === 'feed') { const p = actorPos(data); burst(p.x, p.y - 30, 'heart', 3); }
  else if (type === 'harvest') { const r = L.plots[data.i]; floatText(r.x + 36, r.y + 10, `+${data.amount} 🌾`, '#fff3a8'); burst(r.x + 36, r.y + 30, 'leaf', 8); Sfx.pop(); }
  else if (type === 'sick') { const p = actorPos(data); burst(p.x, p.y - 30, 'bad', 6); }
  else if (type === 'treated') { const p = actorPos(data); floatText(p.x, p.y - 40, 'شُفي! ✨', '#b8ffb0'); burst(p.x, p.y - 30, 'star', 10); Sfx.good(); }
  else if (type === 'death') { const p = actorPos(data); floatText(p.x, p.y - 30, '💀', '#fff'); Sfx.bad(); }
  else if (type === 'clean') { burst(L.pen.x + L.pen.w / 2, L.pen.y + L.pen.h / 2, 'star', 20); Sfx.good(); }
  else if (type === 'levelup') { Sfx.level(); }
  else if (type === 'upgrade') { View.bgKey = ''; Sfx.level(); }
  else if (type === 'spawn') { Sfx.pop(); }
}

// ------------------------------------------------------------
//  الإطار الرئيسي للرسم
// ------------------------------------------------------------
function dayDarkness(h) {
  if (h >= 6.5 && h < 18) return 0;
  if (h >= 18 && h < 20.5) return (h - 18) / 2.5 * 0.55;
  if (h >= 5 && h < 6.5) return (1 - (h - 5) / 1.5) * 0.55;
  return 0.55;
}

function renderFrame(s, dt) {
  const c = View.ctx;
  View.t += dt;
  const t = View.t;
  const L = layout(s);
  const key = `${s.upgrades.barn}-${s.upgrades.fields}`;
  if (View.bgKey !== key) { View.bg = buildBackground(s); View.bgKey = key; }
  const night = isNight(s);
  const hour = hourOf(s);

  syncActors(s, L);
  updateActors(s, L, dt, night);

  c.setTransform(View.dpr, 0, 0, View.dpr, 0, 0);
  c.fillStyle = '#5da7d8'; c.fillRect(0, 0, View.w, View.h);
  const z = View.cam.zoom;
  c.save();
  c.translate(View.w / 2, View.h / 2);
  c.scale(z, z);
  c.translate(-View.cam.x, -View.cam.y);

  // ما وراء حدود العالم: بحر في الأعلى وعشب في الباقي
  c.fillStyle = '#86c25c'; c.fillRect(-1000, 170, WORLD_W + 2000, WORLD_H + 1000);
  c.fillStyle = '#f0dca6'; c.fillRect(-1000, 138, WORLD_W + 2000, 34);
  c.fillStyle = '#5aa6dc'; c.fillRect(-1000, -1000, WORLD_W + 2000, 1140);
  c.drawImage(View.bg, 0, 0, WORLD_W, WORLD_H);

  // أمواج
  c.strokeStyle = 'rgba(255,255,255,0.45)'; c.lineWidth = 2;
  for (let i = 0; i < 14; i++) {
    const wx = ((i * 137 + t * 12) % (WORLD_W + 100)) - 50, wy = 30 + (i * 53) % 90;
    c.beginPath(); c.arc(wx, wy, 10, Math.PI * 1.15, Math.PI * 1.85); c.stroke();
  }

  // السفينة
  const sh = s.ship;
  if (sh.state === 'docked') drawShip(c, L.shipPos.x, L.shipPos.y, t);
  else {
    const eta = sh.nextAt - s.time;
    if (eta < 0.12) drawShip(c, L.shipPos.x - (eta / 0.12) * 900, L.shipPos.y - 20 + (1 - eta / 0.12) * 20, t);
  }

  // المحاصيل
  s.plots.forEach((p, i) => drawPlot(c, p, L.plots[i], t));

  // المباني
  drawStorage(c, L.storage, Math.min(1, feedTotal(s) / storageCap(s)), night);
  drawClinic(c, L.clinic, night);
  drawStall(c, L.saleyard, night);
  drawTrough(c, L.trough, feedTotal(s) > 0);

  // ترتيب العناصر حسب العمق
  const items = [];
  items.push({ y: L.barn.y + L.barn.h, draw: () => drawBarn(c, L.barn, night) });
  for (const a of s.animals) {
    const act = View.actors.get(a.id);
    if (!act) continue;
    items.push({ y: act.y, draw: () => drawAnimalActor(c, a, act, t, night) });
  }
  s.buyers.forEach((b, i) => {
    const bx = L.saleyard.x + 60 + i * 72, by = L.saleyard.y + 165 + (i % 2) * 22;
    items.push({ y: by, draw: () => drawBuyer(c, s, b, bx, by, t) });
  });
  const vet = vetPosition(s, L);
  if (vet) items.push({ y: vet.y, draw: () => { c.save(); c.translate(vet.x, vet.y); if (vet.flip) c.scale(-1, 1); drawPerson(c, { robe: '#ffffff', skin: '#e0b48a' }, t, { vet: true, walking: vet.walking }); c.restore(); } });
  items.sort((a, b) => a.y - b.y).forEach(i => i.draw());

  // جزيئات وأرقام طائرة
  for (const p of View.particles) {
    p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 120 * dt;
    c.globalAlpha = clamp(p.life, 0, 1);
    const col = { coin: '#ffd84a', heart: '#ff6b8a', leaf: '#7fd25a', bad: '#9bbf4a', star: '#fff6a8' }[p.kind];
    if (p.kind === 'heart') { c.font = '12px sans-serif'; c.textAlign = 'center'; c.fillStyle = col; c.fillText('❤', p.x, p.y); }
    else fillEll(c, p.x, p.y, 3, 3, col);
  }
  c.globalAlpha = 1;
  View.particles = View.particles.filter(p => p.life > 0);
  c.font = 'bold 20px Tahoma, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
  for (const f of View.floaters) {
    f.life -= dt; f.y -= 28 * dt;
    c.globalAlpha = clamp(f.life, 0, 1);
    c.lineWidth = 4; c.strokeStyle = 'rgba(0,0,0,0.45)'; c.strokeText(f.text, f.x, f.y);
    c.fillStyle = f.color; c.fillText(f.text, f.x, f.y);
  }
  c.globalAlpha = 1;
  View.floaters = View.floaters.filter(f => f.life > 0);

  // غيوم
  for (const cl of View.clouds) {
    cl.x += cl.v * dt; if (cl.x > WORLD_W + 150) cl.x = -150;
    c.globalAlpha = 0.75;
    fillEll(c, cl.x, cl.y, 40 * cl.s, 16 * cl.s, '#ffffff'); fillEll(c, cl.x + 22 * cl.s, cl.y - 8 * cl.s, 26 * cl.s, 16 * cl.s, '#ffffff'); fillEll(c, cl.x - 20 * cl.s, cl.y - 5 * cl.s, 22 * cl.s, 13 * cl.s, '#ffffff');
    c.globalAlpha = 1;
  }
  c.restore();

  // الليل والغروب
  const dark = dayDarkness(hour);
  if (hour > 16.5 && hour < 19.5) {
    const k = 1 - Math.abs(hour - 18) / 1.5;
    c.fillStyle = `rgba(255,140,60,${0.14 * k})`; c.fillRect(0, 0, View.w, View.h);
  }
  if (dark > 0) {
    c.fillStyle = `rgba(15,25,70,${dark})`; c.fillRect(0, 0, View.w, View.h);
    // أضواء
    c.save(); c.translate(View.w / 2, View.h / 2); c.scale(z, z); c.translate(-View.cam.x, -View.cam.y);
    c.globalCompositeOperation = 'lighter';
    const lights = [[L.barn.x + L.barn.w / 2, L.barn.y + 22], [L.storage.x + 100, L.storage.y + 58], [L.clinic.x + 30, L.clinic.y + 48], [L.clinic.x + L.clinic.w - 30, L.clinic.y + 48], [L.saleyard.x + L.saleyard.w - 90, L.saleyard.y + 60]];
    for (const [lx, ly] of lights) {
      const gr = c.createRadialGradient(lx, ly, 2, lx, ly, 70);
      gr.addColorStop(0, `rgba(255,200,110,${dark * 0.7})`); gr.addColorStop(1, 'rgba(255,200,110,0)');
      c.fillStyle = gr; c.fillRect(lx - 70, ly - 70, 140, 140);
    }
    c.restore();
  }
}

function drawAnimalActor(c, a, act, t, night) {
  const T = ANIMALS[a.type];
  const sc = T.stages[a.stage].size * (0.6 + 0.4 * act.pop);
  const sel = View.selected === a.id;
  c.save();
  c.translate(act.x, act.y);
  if (sel) { ell(c, 0, 2, 36 * sc, 12 * sc); c.strokeStyle = '#ffe94a'; c.lineWidth = 3; c.stroke(); }
  c.scale(act.facing * sc, sc);
  drawAnimalShape(c, a.type, {
    phase: act.phase, moving: act.moving, t, seed: act.seed, sick: !!a.disease,
    graze: act.state === 'graze', lying: act.state === 'sleep', night,
  });
  c.restore();
  // فقاعة الحالة
  const top = act.y - (T.look.kind === 'chicken' ? 34 : (T.look.lh + T.look.ry * 2 + 16)) * sc - 6;
  let icon = null, bg = '#fffbe8';
  if (a.disease) { icon = '🤒'; bg = '#ffd4d0'; }
  else if (a.hunger < 30) { icon = '🌾'; bg = '#ffe9b0'; }
  else if (act.state === 'sleep') { icon = null; }
  if (icon) {
    const b = Math.sin(t * 4 + act.seed) * 2;
    fillEll(c, act.x, top + b, 12, 12, bg);
    ell(c, act.x, top + b, 12, 12); c.strokeStyle = a.disease ? '#e0443a' : '#d4a22c'; c.lineWidth = 2; c.stroke();
    c.font = '14px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(icon, act.x, top + b + 1);
  } else if (act.state === 'sleep') {
    c.font = 'bold 12px sans-serif'; c.fillStyle = 'rgba(255,255,255,0.85)'; c.textAlign = 'center';
    const zz = (t * 0.8 + act.seed) % 1;
    c.globalAlpha = 1 - zz; c.fillText('z', act.x + 10 + zz * 8, top + 6 - zz * 14); c.globalAlpha = 1;
  }
  // شريط الصحة عند المرض أو الضعف
  if (a.health < 70 || a.disease) {
    const w = 34, x = act.x - w / 2, y = act.y + 6;
    rr(c, x, y, w, 5, 2.5); c.fillStyle = 'rgba(0,0,0,0.4)'; c.fill();
    rr(c, x, y, w * a.health / 100, 5, 2.5); c.fillStyle = a.health > 50 ? '#7ad35a' : a.health > 25 ? '#f2b33d' : '#e0443a'; c.fill();
  }
}

function drawBuyer(c, s, b, x, y, t) {
  const age = s.time - b.arrivedAt;
  c.save();
  c.globalAlpha = clamp(age / 0.01, 0, 1);
  c.translate(x, y);
  drawPerson(c, b.look, t, { seed: b.id });
  const ok = canFulfill(s, b.lines);
  const bb = Math.sin(t * 3 + b.id) * 2;
  fillEll(c, 0, -68 + bb, 12, 12, ok ? '#8be07a' : '#ffffff');
  ell(c, 0, -68 + bb, 12, 12); c.strokeStyle = 'rgba(0,0,0,0.3)'; c.lineWidth = 1.5; c.stroke();
  c.fillStyle = ok ? '#1f5f14' : '#555'; c.font = 'bold 15px Tahoma'; c.textAlign = 'center'; c.textBaseline = 'middle';
  c.fillText(ok ? '$' : '…', 0, -67 + bb);
  // مؤقت الانتظار
  const left = clamp((b.leaveAt - s.time) / (b.leaveAt - b.arrivedAt), 0, 1);
  rr(c, -16, 6, 32, 5, 2.5); c.fillStyle = 'rgba(0,0,0,0.35)'; c.fill();
  rr(c, -16, 6, 32 * left, 5, 2.5); c.fillStyle = left > 0.3 ? '#f2d03d' : '#e0443a'; c.fill();
  c.restore();
}

function vetPosition(s, L) {
  const v = s.vetVisits[0];
  if (!v) return null;
  const act = View.actors.get(v.animalId);
  const door = { x: L.clinic.x + L.clinic.w / 2, y: L.clinic.y + L.clinic.h + 6 };
  const target = act ? { x: act.x + 26, y: act.y + 4 } : door;
  if (v.arrived) return { x: target.x, y: target.y, walking: false, flip: true };
  const k = clamp(1 - (v.arriveAt - s.time) / GAME.VET_TRAVEL_DAYS, 0, 1);
  return { x: door.x + (target.x - door.x) * k, y: door.y + (target.y - door.y) * k, walking: true, flip: target.x < door.x };
}

// ------------------------------------------------------------
//  الكاميرا واللمس
// ------------------------------------------------------------
function resizeView() {
  const cv = View.canvas;
  View.dpr = Math.min(window.devicePixelRatio || 1, 2.5);
  View.w = window.innerWidth; View.h = window.innerHeight;
  cv.width = View.w * View.dpr; cv.height = View.h * View.dpr;
  cv.style.width = View.w + 'px'; cv.style.height = View.h + 'px';
  clampCam();
}

function clampCam() {
  const z = View.cam.zoom;
  const hw = View.w / 2 / z, hh = View.h / 2 / z;
  const m = 60;
  View.cam.x = hw * 2 > WORLD_W + m * 2 ? WORLD_W / 2 : clamp(View.cam.x, hw - m, WORLD_W - hw + m);
  View.cam.y = hh * 2 > WORLD_H + m * 2 ? WORLD_H / 2 : clamp(View.cam.y, hh - m - 40, WORLD_H - hh + m + 60);
}

function screenToWorld(sx, sy) {
  return { x: (sx - View.w / 2) / View.cam.zoom + View.cam.x, y: (sy - View.h / 2) / View.cam.zoom + View.cam.y };
}

function zoomAt(sx, sy, factor) {
  const before = screenToWorld(sx, sy);
  View.cam.zoom = clamp(View.cam.zoom * factor, 0.35, 2);
  const after = screenToWorld(sx, sy);
  View.cam.x += before.x - after.x; View.cam.y += before.y - after.y;
  clampCam();
}

function focusOn(x, y) {
  View.cam.x = x; View.cam.y = y; clampCam();
}

function initView(canvas) {
  View.canvas = canvas;
  View.ctx = canvas.getContext('2d');
  resizeView();
  View.cam.zoom = clamp(Math.min(View.w / 540, View.h / 640), 0.45, 1.3);
  const L = layout(S);
  focusOn(L.pen.x + L.pen.w / 2 + 40, L.pen.y + L.pen.h / 2 + 60);
  for (let i = 0; i < 5; i++) View.clouds.push({ x: Math.random() * WORLD_W, y: 60 + Math.random() * 800, v: 8 + Math.random() * 10, s: 0.8 + Math.random() * 0.7 });
  window.addEventListener('resize', resizeView);

  const ptrs = new Map();
  let drag = null, pinch = null;
  canvas.addEventListener('pointerdown', e => {
    canvas.setPointerCapture(e.pointerId);
    ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (ptrs.size === 1) drag = { sx: e.clientX, sy: e.clientY, cx: View.cam.x, cy: View.cam.y, moved: false };
    else if (ptrs.size === 2) {
      const [a, b] = [...ptrs.values()];
      pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), z: View.cam.zoom };
      if (drag) drag.moved = true;
    }
  });
  canvas.addEventListener('pointermove', e => {
    if (!ptrs.has(e.pointerId)) return;
    ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (ptrs.size === 2 && pinch) {
      const [a, b] = [...ptrs.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
      zoomAt(mx, my, (pinch.z * d / pinch.d) / View.cam.zoom);
    } else if (drag && ptrs.size === 1) {
      const dx = e.clientX - drag.sx, dy = e.clientY - drag.sy;
      if (Math.hypot(dx, dy) > 8) drag.moved = true;
      if (drag.moved) {
        View.cam.x = drag.cx - dx / View.cam.zoom;
        View.cam.y = drag.cy - dy / View.cam.zoom;
        clampCam();
      }
    }
  });
  const up = e => {
    if (!ptrs.has(e.pointerId)) return;
    ptrs.delete(e.pointerId);
    if (ptrs.size < 2) pinch = null;
    if (ptrs.size === 0) {
      if (drag && !drag.moved && View.onTap) { const w = screenToWorld(e.clientX, e.clientY); View.onTap(w.x, w.y); }
      drag = null;
    } else if (ptrs.size === 1) {
      const [p] = [...ptrs.values()];
      drag = { sx: p.x, sy: p.y, cx: View.cam.x, cy: View.cam.y, moved: true };
    }
  };
  canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', up);
  canvas.addEventListener('wheel', e => { e.preventDefault(); zoomAt(e.clientX, e.clientY, e.deltaY < 0 ? 1.12 : 1 / 1.12); }, { passive: false });
}

// ما الذي لمسه اللاعب في العالم؟
function hitTest(s, x, y) {
  const L = layout(s);
  let best = null, bestD = 1e9;
  for (const a of s.animals) {
    const act = View.actors.get(a.id);
    if (!act) continue;
    const sz = ANIMALS[a.type].stages[a.stage].size;
    const cy = act.y - 18 * sz;
    const d = Math.hypot(x - act.x, (y - cy) * 1.2);
    if (d < 34 * sz + 6 && d < bestD) { best = a; bestD = d; }
  }
  if (best) return { kind: 'animal', id: best.id };
  for (let i = 0; i < s.plots.length; i++) if (inRect(x, y, L.plots[i], 4)) return { kind: 'plot', index: i };
  if (inRect(x, y, L.storage, 10)) return { kind: 'storage' };
  if (inRect(x, y, L.clinic, 10)) return { kind: 'vet' };
  if (inRect(x, y, L.barn, 6) || inRect(x, y, L.trough, 6)) return { kind: 'animals' };
  if (inRect(x, y, L.saleyard)) return { kind: 'sale' };
  if (inRect(x, y, L.dock, 10) || (y < 190 && Math.abs(x - L.shipPos.x) < 140 && s.ship.state === 'docked')) return { kind: 'ship' };
  if (inRect(x, y, L.pen)) return { kind: 'animals' };
  return null;
}
