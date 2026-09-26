// ============================================================
//  الرسم: المزرعة، الحيوانات، الناس، الكاميرا، والتأثيرات
// ============================================================

const WORLD_W = 1400, WORLD_H = 1060;
const BG_SCALE = 1.5;

const View = {
  canvas: null, ctx: null, dpr: 1, w: 0, h: 0,
  cam: { x: 440, y: 440, zoom: 0.8 },
  actors: new Map(),
  preds: new Map(), dogs: [],
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
    helipad: { x: 1040, y: 512, w: 150, h: 136 },
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
  if (s.upgrades.helipad) { c.moveTo(870, 580); c.lineTo(1040, 580); }
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
  fence(c, P.x, P.y, P.w, P.h, { gate: 'right', level: s.upgrades.fence });

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

  // مهبط الهليكوبتر
  drawHelipad(c, L.helipad, s.upgrades.helipad > 0);

  // الأشجار على الأطراف
  const trees = [];
  for (let y = 240; y < 1000; y += 70) trees.push([35 + R() * 20, y + R() * 20]);
  for (let x = 120; x < 1380; x += 90) trees.push([x + R() * 30, 1025 + R() * 15]);
  for (let y = 520; y < 700; y += 80) trees.push([1370 - R() * 20, y]);
  trees.push([985, 540], [1250, 540], [1300, 640], [930, 610]);
  trees.sort((a, b) => a[1] - b[1]).forEach(([x, y]) => tree(c, x, y, 0.8 + R() * 0.4, R));
  // صخور وشجيرات
  const busy = [L.pen, L.saleyard, L.storage, L.clinic, L.helipad, { x: 80, y: 700, w: 1280, h: 60 }, { x: 80, y: 765, w: 690, h: 190 }, { x: 850, y: 180, w: 40, h: 820 }];
  for (let i = 0; i < 40; i++) {
    const x = 60 + R() * 1300, y = 480 + R() * 520;
    if (!busy.some(r => inRect(x, y, r, 18))) bush(c, x, y, R);
  }

  return cv;
}
function pick2(R, arr) { return arr[Math.floor(R() * arr.length)]; }

// level: 0 خشب | 1 + شبك معدني | 2 + قاعدة حجرية | 3 + أعمدة حديد
function fence(c, x, y, w, h, opt) {
  const lvl = opt.level || 0;
  const gateY = y + h * 0.5;
  const segs = [[x, y, x + w, y], [x, y + h, x + w, y + h]];
  if (opt.gate === 'right') segs.push([x, y, x, y + h], [x + w, y, x + w, gateY - 22], [x + w, gateY + 22, x + w, y + h]);
  else segs.push([x + w, y, x + w, y + h], [x, y, x, gateY - 22], [x, gateY + 22, x, y + h]);
  const along = (step, fn) => {
    for (const [x1, y1, x2, y2] of segs) {
      const n = Math.max(1, Math.round(Math.hypot(x2 - x1, y2 - y1) / step));
      for (let i = 0; i <= n; i++) fn(x1 + (x2 - x1) * i / n, y1 + (y2 - y1) * i / n, i);
    }
  };
  if (lvl >= 2) along(11, (px, py, i) => fillEll(c, px, py - 1, 7, 5, i % 2 ? '#9a9890' : '#b8b5ab'));
  c.strokeStyle = '#8a5d36'; c.lineWidth = 4; c.lineCap = 'round';
  for (const [x1, y1, x2, y2] of segs) {
    for (const off of [-10, -2]) { c.beginPath(); c.moveTo(x1, y1 + off); c.lineTo(x2, y2 + off); c.stroke(); }
  }
  if (lvl >= 1) {
    c.strokeStyle = 'rgba(110,120,130,0.75)'; c.lineWidth = 1.2;
    c.beginPath();
    along(7, (px, py) => { c.moveTo(px, py - 22); c.lineTo(px, py - 2); });
    for (const [x1, y1, x2, y2] of segs) { c.moveTo(x1, y1 - 22); c.lineTo(x2, y2 - 22); }
    c.stroke();
  }
  c.fillStyle = lvl >= 3 ? '#4a4f55' : '#6f4527';
  const ph = lvl >= 1 ? 24 : 16;
  const post = (px, py) => { c.fillRect(px - 3, py - ph, 6, ph + 2); };
  for (let px = x; px <= x + w; px += 40) { post(px, y); post(px, y + h); }
  for (let py = y; py <= y + h; py += 40) { post(x, py); post(x + w, py); }
}

function tree(c, x, y, s, R) {
  shadow(c, x + 8 * s, y + 2, 30 * s, 10 * s);
  c.beginPath(); c.moveTo(x - 5 * s, y + 1); c.lineTo(x - 3.5 * s, y - 30 * s); c.lineTo(x + 3.5 * s, y - 30 * s); c.lineTo(x + 5 * s, y + 1); c.closePath();
  c.fillStyle = '#7a5233'; c.fill(); c.strokeStyle = OUTLINE; c.lineWidth = 1.8; c.stroke();
  const leaves = [[x, y - 44 * s, 27 * s, 24 * s], [x - 15 * s, y - 34 * s, 17 * s, 15 * s], [x + 15 * s, y - 36 * s, 17 * s, 15 * s], [x - 3 * s, y - 58 * s, 17 * s, 13 * s]];
  const g = c.createLinearGradient(0, y - 72 * s, 0, y - 18 * s);
  g.addColorStop(0, '#7cc75a'); g.addColorStop(1, '#3f8a34');
  blob(c, leaves, g, 'rgba(30,60,20,0.55)', 2.4);
  fillEll(c, x - 8 * s, y - 56 * s, 10 * s, 6 * s, 'rgba(255,255,255,0.18)');
  c.strokeStyle = 'rgba(30,70,20,0.35)'; c.lineWidth = 1.3;
  for (let i = 0; i < 4; i++) { const a = R() * 6.28; c.beginPath(); c.arc(x + Math.cos(a) * 12 * s, y - 42 * s + Math.sin(a) * 10 * s, 5 * s, 0.3, 2.6); c.stroke(); }
  if (R() < 0.4) for (let i = 0; i < 4; i++) blob(c, [[x - 14 * s + R() * 28 * s, y - 52 * s + R() * 24 * s, 2.8 * s, 2.8 * s]], '#e0463a', 'rgba(90,20,10,0.5)', 1);
}
function bush(c, x, y, R) {
  if (R() < 0.35) {
    blob(c, [[x, y, 9, 6], [x + 6, y + 1, 5, 4]], '#b3b3a8', 'rgba(60,60,50,0.45)', 1.6);
    fillEll(c, x - 2, y - 2, 5, 2.5, 'rgba(255,255,255,0.35)');
    return;
  }
  blob(c, [[x, y, 12, 8], [x - 6, y - 3, 7, 6], [x + 6, y - 3, 7, 6]], '#62b04a', 'rgba(30,60,20,0.5)', 1.8);
  fillEll(c, x - 4, y - 5, 4, 2.2, 'rgba(255,255,255,0.25)');
  if (R() < 0.5) for (let i = 0; i < 3; i++) fillEll(c, x - 7 + R() * 14, y - 5 + R() * 6, 1.8, 1.8, pick2(R, ['#fff', '#ffe15a', '#ff9ec0']));
}

// ------------------------------------------------------------
//  المباني
// ------------------------------------------------------------
function drawHelipad(c, r, built) {
  const cx = r.x + r.w / 2, cy = r.y + r.h / 2;
  if (!built) {
    c.setLineDash([8, 7]);
    ell(c, cx, cy, 62, 52); c.strokeStyle = 'rgba(80,80,80,0.45)'; c.lineWidth = 3; c.stroke();
    c.setLineDash([]);
    c.font = '26px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.globalAlpha = 0.6;
    c.fillText('🔒', cx, cy - 6); c.globalAlpha = 1;
    c.font = 'bold 13px Tahoma, sans-serif'; c.fillStyle = 'rgba(60,60,60,0.7)';
    c.fillText('مهبط هليكوبتر', cx, cy + 22);
    return;
  }
  shadow(c, cx + 4, cy + 6, 70, 58);
  fillEll(c, cx, cy, 68, 57, '#6f7479');
  fillEll(c, cx, cy, 62, 51, '#8a9096');
  ell(c, cx, cy, 52, 42); c.strokeStyle = '#f5d04a'; c.lineWidth = 4; c.stroke();
  // حرف H
  c.fillStyle = '#ffffff';
  c.fillRect(cx - 22, cy - 22, 9, 44); c.fillRect(cx + 13, cy - 22, 9, 44); c.fillRect(cx - 13, cy - 4, 26, 8);
  // أضواء حول المهبط
  for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; fillEll(c, cx + Math.cos(a) * 65, cy + Math.sin(a) * 54, 3, 3, '#ffb13b'); }
  // كم الريح
  c.fillStyle = '#6b6b6b'; c.fillRect(r.x + r.w - 6, r.y - 18, 3, 40);
  c.fillStyle = '#ff7a2f';
  c.beginPath(); c.moveTo(r.x + r.w - 3, r.y - 18); c.lineTo(r.x + r.w + 22, r.y - 13); c.lineTo(r.x + r.w + 22, r.y - 8); c.lineTo(r.x + r.w - 3, r.y - 6); c.closePath(); c.fill();
  c.fillStyle = '#ffffff'; c.fillRect(r.x + r.w + 6, r.y - 16, 5, 9);
  sign(c, cx, r.y + r.h + 18, 'مهبط الهليكوبتر', '#46607a');
}

function drawHelicopter(c, x, y, t, lift) {
  // lift: 0 = على الأرض، 1 = عالياً في السماء
  const hover = lift > 0 ? Math.sin(t * 5) * 1.5 : 0;
  const sy = y - lift * 260 + hover;
  // الظل على المهبط يصغر كلما ارتفعت
  shadow(c, x, y + 26, 60 * (1 - lift * 0.6), 14 * (1 - lift * 0.6));
  c.save(); c.translate(x, sy);
  // الذيل
  c.fillStyle = '#c8453b';
  c.beginPath(); c.moveTo(20, -18); c.lineTo(92, -26); c.lineTo(92, -18); c.lineTo(20, -6); c.closePath(); c.fill();
  c.fillStyle = '#a3362e'; c.fillRect(86, -40, 8, 22);
  // مروحة الذيل
  const ta = t * 30;
  c.strokeStyle = 'rgba(40,40,40,0.8)'; c.lineWidth = 3;
  c.beginPath(); c.moveTo(90 + Math.cos(ta) * 12, -29 + Math.sin(ta) * 12); c.lineTo(90 - Math.cos(ta) * 12, -29 - Math.sin(ta) * 12); c.stroke();
  // الزلاجات
  c.strokeStyle = '#3b3f44'; c.lineWidth = 3.5; c.lineCap = 'round';
  c.beginPath(); c.moveTo(-42, 22); c.lineTo(34, 22); c.moveTo(-26, 6); c.lineTo(-30, 22); c.moveTo(16, 6); c.lineTo(20, 22); c.stroke();
  // الجسم
  fillEll(c, -6, -10, 40, 22, '#e0533d');
  fillEll(c, -10, -18, 30, 10, 'rgba(255,255,255,0.18)');
  // الزجاج
  c.fillStyle = '#9fd3e8';
  c.beginPath(); c.moveTo(-44, -12); c.quadraticCurveTo(-40, -30, -18, -30); c.lineTo(-18, -8); c.closePath(); c.fill();
  c.fillStyle = 'rgba(255,255,255,0.5)'; c.fillRect(-32, -26, 6, 10);
  c.fillStyle = '#b8e0f0'; c.fillRect(-10, -24, 16, 12);
  c.fillStyle = '#fff'; c.font = 'bold 9px Tahoma'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('VIP', 20, -4);
  // المروحة الرئيسية
  c.fillStyle = '#3b3f44'; c.fillRect(-10, -38, 8, 8);
  const spin = t * 22, len = 78;
  c.strokeStyle = 'rgba(50,50,50,0.85)'; c.lineWidth = 4;
  for (let k = 0; k < 2; k++) {
    const dx = Math.cos(spin + k * Math.PI / 2) * len;
    c.beginPath(); c.moveTo(-6 - dx, -38); c.lineTo(-6 + dx, -38); c.stroke();
  }
  ell(c, -6, -38, len, 7); c.fillStyle = 'rgba(200,200,200,0.18)'; c.fill();
  c.restore();
}

function polyPath(c, pts) { c.beginPath(); c.moveTo(pts[0][0], pts[0][1]); for (const q of pts.slice(1)) c.lineTo(q[0], q[1]); c.closePath(); }
function fillOut(c, fill, lw = 2) { c.fillStyle = fill; c.fill(); c.strokeStyle = OUTLINE; c.lineWidth = lw; c.lineJoin = 'round'; c.stroke(); }
function windowBox(c, x, y, w, h, night) {
  rr(c, x, y, w, h, 3); fillOut(c, night ? '#ffd76a' : '#9fd3e8', 1.6);
  if (!night) { c.fillStyle = 'rgba(255,255,255,0.5)'; c.fillRect(x + 3, y + 3, w * 0.3, h - 6); }
  c.strokeStyle = '#fff'; c.lineWidth = 2;
  c.beginPath(); c.moveTo(x + w / 2, y + 1); c.lineTo(x + w / 2, y + h - 1); c.moveTo(x + 1, y + h / 2); c.lineTo(x + w - 1, y + h / 2); c.stroke();
}

function drawBarn(c, r, night) {
  const x = r.x, y = r.y, w = r.w, h = r.h;
  shadow(c, x + w / 2 + 10, y + h + 3, w * 0.62, 12);
  // الجدار مع ألواح خشبية
  c.fillStyle = '#c8453b'; c.fillRect(x, y + 34, w, h - 34);
  c.strokeStyle = 'rgba(90,20,15,0.3)'; c.lineWidth = 1.5;
  for (let px = x + 9; px < x + w; px += 9) { c.beginPath(); c.moveTo(px, y + 36); c.lineTo(px, y + h); c.stroke(); }
  const wg = c.createLinearGradient(x, 0, x + w, 0); wg.addColorStop(0, 'rgba(255,255,255,0.1)'); wg.addColorStop(1, 'rgba(0,0,0,0.15)');
  c.fillStyle = wg; c.fillRect(x, y + 34, w, h - 34);
  c.strokeStyle = OUTLINE; c.lineWidth = 2; c.strokeRect(x, y + 34, w, h - 34);
  // السقف
  const roof = [[x - 10, y + 40], [x + 14, y + 5], [x + w / 2, y - 10], [x + w - 14, y + 5], [x + w + 10, y + 40]];
  polyPath(c, roof); fillOut(c, '#8e2b25', 2.2);
  c.save(); polyPath(c, roof); c.clip();
  c.strokeStyle = 'rgba(0,0,0,0.18)'; c.lineWidth = 1.5;
  for (let yy = y - 6; yy < y + 40; yy += 7) { c.beginPath(); c.moveTo(x - 10, yy); c.lineTo(x + w + 10, yy); c.stroke(); }
  c.restore();
  c.strokeStyle = '#fff4e6'; c.lineWidth = 3.5; c.lineJoin = 'round';
  c.beginPath(); roof.forEach((q, i) => (i ? c.lineTo(q[0], q[1]) : c.moveTo(q[0], q[1]))); c.stroke();
  // الباب
  const dw = 46, dx = x + w / 2 - dw / 2, dy = y + h - 50;
  c.fillStyle = '#6e211b'; c.fillRect(dx, dy, dw, 50);
  c.strokeStyle = '#fff4e6'; c.lineWidth = 3.5; c.strokeRect(dx, dy, dw, 50);
  c.beginPath(); c.moveTo(dx, dy); c.lineTo(dx + dw, dy + 50); c.moveTo(dx + dw, dy); c.lineTo(dx, dy + 50); c.moveTo(dx + dw / 2, dy); c.lineTo(dx + dw / 2, dy + 50); c.stroke();
  c.strokeStyle = OUTLINE; c.lineWidth = 1.2; c.strokeRect(dx - 2, dy - 2, dw + 4, 52);
  windowBox(c, x + w / 2 - 11, y + 13, 22, 17, night);
  // بالات قش
  for (const [bx, by2, bw] of [[x + w - 2, y + h - 16, 26], [x + w + 12, y + h - 30, 22]]) {
    rr(c, bx, by2, bw, 16, 4); fillOut(c, '#e5c253', 1.6);
    c.strokeStyle = 'rgba(150,110,30,0.6)'; c.lineWidth = 1.2;
    c.beginPath(); c.moveTo(bx + bw * 0.3, by2 + 1); c.lineTo(bx + bw * 0.3, by2 + 15); c.moveTo(bx + bw * 0.7, by2 + 1); c.lineTo(bx + bw * 0.7, by2 + 15); c.stroke();
  }
}

function drawTrough(c, r, filled) {
  shadow(c, r.x + r.w / 2, r.y + r.h + 2, r.w * 0.6, 7);
  rr(c, r.x + 4, r.y + r.h - 4, 7, 9, 2); fillOut(c, '#7d5634', 1.4);
  rr(c, r.x + r.w - 11, r.y + r.h - 4, 7, 9, 2); fillOut(c, '#7d5634', 1.4);
  polyPath(c, [[r.x - 3, r.y], [r.x + r.w + 3, r.y], [r.x + r.w - 3, r.y + r.h], [r.x + 3, r.y + r.h]]);
  fillOut(c, '#a8764a', 2);
  c.strokeStyle = 'rgba(80,50,25,0.4)'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(r.x + 2, r.y + r.h / 2); c.lineTo(r.x + r.w - 2, r.y + r.h / 2); c.stroke();
  if (filled) {
    blob(c, [[r.x + r.w / 2, r.y + 2, r.w * 0.44, 6], [r.x + r.w / 2 - 14, r.y - 1, 12, 5], [r.x + r.w / 2 + 12, r.y, 11, 4.5]], '#e3c25a', 'rgba(140,100,30,0.6)', 1.4);
    c.strokeStyle = 'rgba(150,110,30,0.6)'; c.lineWidth = 1;
    for (let i = 0; i < 8; i++) { const hx = r.x + 10 + i * 8; c.beginPath(); c.moveTo(hx, r.y + 2); c.lineTo(hx + 4, r.y - 3); c.stroke(); }
  }
}

function drawStorage(c, r, ratio, night) {
  const { x, y, w, h } = r;
  shadow(c, x + w / 2 + 10, y + h + 3, w * 0.66, 12);
  // صومعة
  const sx = x + w - 34, sw = 44;
  const sg = c.createLinearGradient(sx, 0, sx + sw, 0);
  sg.addColorStop(0, '#dfe3e8'); sg.addColorStop(0.45, '#c3c8ce'); sg.addColorStop(1, '#8f98a3');
  rr(c, sx, y - 10, sw, h + 10, 3); fillOut(c, sg, 2);
  c.strokeStyle = 'rgba(80,90,100,0.35)'; c.lineWidth = 1.2;
  for (let yy = y + 8; yy < y + h; yy += 16) { c.beginPath(); c.moveTo(sx + 1, yy); c.lineTo(sx + sw - 1, yy); c.stroke(); }
  blob(c, [[sx + sw / 2, y - 10, sw / 2 + 1, 15]], '#8f98a3', OUTLINE, 2);
  fillEll(c, sx + sw / 2 - 6, y - 14, 10, 5, 'rgba(255,255,255,0.35)');
  // مقياس الامتلاء
  rr(c, sx + 5, y + 6, 9, h - 12, 3); fillOut(c, 'rgba(0,0,0,0.25)', 1);
  const fh = (h - 14) * ratio;
  if (fh > 1) { rr(c, sx + 6, y + h - 7 - fh, 7, fh, 2); c.fillStyle = ratio < 0.15 ? '#e0533d' : '#f2cf3d'; c.fill(); }
  // مستودع
  const ww = w - 34;
  c.fillStyle = '#b98b5a'; c.fillRect(x, y + 30, ww, h - 30);
  c.strokeStyle = 'rgba(90,60,30,0.3)'; c.lineWidth = 1.6;
  for (let px = x + 10; px < x + ww; px += 10) { c.beginPath(); c.moveTo(px, y + 32); c.lineTo(px, y + h); c.stroke(); }
  c.strokeStyle = OUTLINE; c.lineWidth = 2; c.strokeRect(x, y + 30, ww, h - 30);
  polyPath(c, [[x - 10, y + 36], [x + ww / 2, y], [x + ww + 8, y + 36]]); fillOut(c, '#7a5436', 2.2);
  rr(c, x + 26, y + h - 48, 52, 48, 3); fillOut(c, '#5c3d24', 1.8);
  c.strokeStyle = 'rgba(0,0,0,0.3)'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(x + 52, y + h - 46); c.lineTo(x + 52, y + h); c.stroke();
  // أكياس علف حسب الكمية
  if (ratio > 0.05) for (let i = 0; i < Math.min(3, 1 + Math.floor(ratio * 3)); i++) { rr(c, x + 84 + i * 13, y + h - 18 - (i % 2) * 6, 12, 16, 4); fillOut(c, '#efe0b8', 1.3); }
  windowBox(c, x + 86, y + 44, 22, 17, night);
  sign(c, x + ww / 2, y + h + 22, 'المخزن');
}

function drawClinic(c, r, night) {
  const { x, y, w, h } = r;
  shadow(c, x + w / 2 + 10, y + h + 3, w * 0.62, 12);
  c.fillStyle = '#f4f6f5'; c.fillRect(x, y + 22, w, h - 22);
  const wg = c.createLinearGradient(x, 0, x + w, 0); wg.addColorStop(0, 'rgba(255,255,255,0)'); wg.addColorStop(1, 'rgba(0,40,60,0.1)');
  c.fillStyle = wg; c.fillRect(x, y + 22, w, h - 22);
  c.fillStyle = '#d7dfe0'; c.fillRect(x, y + h - 10, w, 10);
  c.strokeStyle = OUTLINE; c.lineWidth = 2; c.strokeRect(x, y + 22, w, h - 22);
  polyPath(c, [[x - 10, y + 27], [x + 20, y - 5], [x + w - 20, y - 5], [x + w + 10, y + 27]]); fillOut(c, '#3a9d8f', 2.2);
  c.strokeStyle = 'rgba(0,0,0,0.15)'; c.lineWidth = 1.5;
  for (let yy = y + 3; yy < y + 27; yy += 6) { c.beginPath(); c.moveTo(x - 4, yy); c.lineTo(x + w + 4, yy); c.stroke(); }
  // لافتة الصليب
  const cx = x + w / 2, cy = y + 46;
  blob(c, [[cx, cy, 17, 17]], '#ffffff', OUTLINE, 2);
  c.fillStyle = '#2fae62'; rr(c, cx - 4.5, cy - 12, 9, 24, 2); c.fill(); rr(c, cx - 12, cy - 4.5, 24, 9, 2); c.fill();
  windowBox(c, x + 14, y + 38, 28, 22, night);
  windowBox(c, x + w - 42, y + 38, 28, 22, night);
  rr(c, cx - 16, y + h - 40, 32, 40, 4); fillOut(c, '#5d8fa3', 1.8);
  fillEll(c, cx + 9, y + h - 20, 2, 2, '#f2cf3d');
  sign(c, x + w / 2, y + h + 22, 'الطبيب البيطري', '#2f7f74');
}

function drawStall(c, Y, night) {
  const x = Y.x + Y.w - 150, y = Y.y + 30;
  shadow(c, x + 60, y + 80, 76, 9);
  for (const px of [x + 4, x + 111]) { rr(c, px, y + 18, 6, 60, 2); fillOut(c, '#8a5d36', 1.4); }
  rr(c, x - 2, y + 50, 124, 28, 3); fillOut(c, '#a97b4f', 2);
  c.strokeStyle = 'rgba(80,50,25,0.35)'; c.lineWidth = 1.3; c.beginPath(); c.moveTo(x, y + 62); c.lineTo(x + 120, y + 62); c.stroke();
  // بضاعة على الطاولة
  blob(c, [[x + 22, y + 48, 8, 5], [x + 30, y + 46, 7, 5]], '#e5c253', OUTLINE, 1.2);
  blob(c, [[x + 60, y + 47, 6, 6], [x + 70, y + 47, 6, 6], [x + 65, y + 42, 6, 6]], '#e0533d', OUTLINE, 1.2);
  rr(c, x + 88, y + 38, 16, 12, 3); fillOut(c, '#7ab8d9', 1.2);
  // مظلة مخططة
  for (let i = 0; i < 6; i++) {
    c.fillStyle = i % 2 ? '#fff4e0' : '#e0533d';
    c.fillRect(x - 6 + i * 22, y + 2, 22, 18);
    c.beginPath(); c.arc(x + 5 + i * 22, y + 20, 11, 0, Math.PI); c.fill();
    c.strokeStyle = OUTLINE; c.lineWidth = 1.4; c.beginPath(); c.arc(x + 5 + i * 22, y + 20, 11, 0, Math.PI); c.stroke();
  }
  c.strokeStyle = OUTLINE; c.lineWidth = 2; c.strokeRect(x - 6, y + 2, 132, 18);
  sign(c, Y.x + Y.w / 2 - 70, Y.y + 22, 'ساحة البيع', '#b0442f');
}

// ------------------------------------------------------------
//  الحيوانات
// ------------------------------------------------------------
const OUTLINE = 'rgba(45,32,24,0.62)';

function drawAnimalShape(c, type, p) {
  const L = ANIMALS[type].look;
  if (L.kind === 'chicken') drawChicken(c, L, p); else drawQuad(c, L, p);
}

// يرسم عدة أشكال بيضوية كقطعة واحدة: الحدود أولاً ثم التعبئة
function blob(c, shapes, fill, outline = OUTLINE, lw = 2.4) {
  c.lineWidth = lw; c.strokeStyle = outline;
  for (const s of shapes) { ell(c, s[0], s[1], s[2], s[3], s[4] || 0); c.stroke(); }
  c.fillStyle = fill;
  for (const s of shapes) { ell(c, s[0], s[1], s[2], s[3], s[4] || 0); c.fill(); }
}
function blobPath(c, shapes) {
  c.beginPath();
  for (const s of shapes) c.ellipse(s[0], s[1], Math.max(0.1, s[2]), Math.max(0.1, s[3]), s[4] || 0, 0, Math.PI * 2);
}
function vgrad(c, y0, y1, col) {
  const g = c.createLinearGradient(0, y0, 0, y1);
  g.addColorStop(0, shade(col, 0.2)); g.addColorStop(0.5, col); g.addColorStop(1, shade(col, -0.22));
  return g;
}
function stroke2(c, draw, w, col) {
  c.lineCap = 'round'; c.lineJoin = 'round';
  c.strokeStyle = OUTLINE; c.lineWidth = w + 2.2; c.beginPath(); draw(); c.stroke();
  c.strokeStyle = col; c.lineWidth = w; c.beginPath(); draw(); c.stroke();
}

function leg(c, x, top, swing, L, col) {
  const w1 = L.lw * 1.4, w2 = L.lw, hh = Math.max(2.5, L.lw * 0.8);
  const bx = x + swing;
  c.beginPath();
  c.moveTo(x - w1 / 2, top); c.lineTo(x + w1 / 2, top);
  c.lineTo(bx + w2 / 2, -hh); c.lineTo(bx - w2 / 2, -hh); c.closePath();
  c.fillStyle = col; c.fill();
  c.strokeStyle = OUTLINE; c.lineWidth = 1.4; c.lineJoin = 'round'; c.stroke();
  rr(c, bx - w2 / 2 - 0.7, -hh - 0.3, w2 + 1.4, hh + 0.3, Math.min(2, hh / 2));
  c.fillStyle = L.hoof; c.fill(); c.stroke();
}

function spot(c, x, y, r, R) {
  fillEll(c, x, y, r, r * 0.75, c.fillStyle, R() * 3);
  fillEll(c, x + r * 0.55, y - r * 0.3, r * 0.55, r * 0.45, c.fillStyle, R() * 3);
  fillEll(c, x - r * 0.5, y + r * 0.35, r * 0.5, r * 0.4, c.fillStyle, R() * 3);
}

function drawQuad(c, L, p) {
  const { rx, ry, lh } = L;
  const bob = p.moving ? Math.abs(Math.sin(p.phase)) * 1.3 : 0;
  const lift = p.lying ? lh * 0.8 : 0;
  const by = -(lh + ry * 0.55) + lift - bob;
  const sw = p.moving ? Math.sin(p.phase) * 5 : 0;
  const tint = col => (p.sick ? mix(col, '#a9c46c', 0.4) : col);
  const body = tint(L.body), headC = tint(L.head);
  const legTop = by + ry * 0.2;
  const R = seeded(Math.floor(p.seed * 99991) + 7);

  shadow(c, 0, 1, rx * 1.15, ry * 0.42);
  if (!p.lying) {
    const far = shade(L.leg, -0.25);
    leg(c, -rx * 0.52 + 3, legTop, -sw, L, far);
    leg(c, rx * 0.5 + 3, legTop, sw, L, far);
    leg(c, -rx * 0.52, legTop, sw, L, tint(L.leg));
    leg(c, rx * 0.5, legTop, -sw, L, tint(L.leg));
  }

  drawTail(c, L, rx, ry, by, p, body);
  const head = headPos(L, p, rx, ry, by);
  // الرقبة قبل الجسم حتى يغطي الجسم بدايتها
  stroke2(c, () => { c.moveTo(rx * 0.45, by - ry * 0.1); c.lineTo(head.hx - head.hs * 0.15, head.hy + head.hs * 0.05); }, ry * 0.95, body);

  const parts = [[0, by, rx, ry], [-rx * 0.42, by - ry * 0.1, rx * 0.58, ry * 0.98], [rx * 0.42, by - ry * 0.02, rx * 0.56, ry * 0.92]];
  if (L.wool) woolBody(c, rx, ry, by, body, p.seed);
  else {
    blob(c, parts, vgrad(c, by - ry, by + ry, body));
    c.save(); blobPath(c, parts); c.clip();
    if (L.belly) fillEll(c, rx * 0.05, by + ry * 1.0, rx * 0.85, ry * 0.42, tint(L.belly));
    if (L.spots) {
      c.fillStyle = tint(L.spots);
      const n = 3 + Math.floor(R() * 3);
      for (let i = 0; i < n; i++) spot(c, (R() * 2 - 1) * rx * 0.9, by + (R() * 2 - 1.1) * ry * 0.75, ry * (0.28 + R() * 0.3), R);
    }
    fillEll(c, -rx * 0.12, by - ry * 0.62, rx * 0.55, ry * 0.18, 'rgba(255,255,255,0.25)');
    c.restore();
  }
  if (L.mushrooms) {
    mushroom(c, -rx * 0.45, by - ry * 0.85, ry * 0.32);
    mushroom(c, rx * 0.1, by - ry * 0.95, ry * 0.38);
  }

  if (L.udder && p.adult && !p.lying) {
    blob(c, [[-rx * 0.18, by + ry * 0.88, rx * 0.2, ry * 0.25]], '#f5aab2', OUTLINE, 1.6);
    c.strokeStyle = '#e08a94'; c.lineWidth = 1.8; c.lineCap = 'round';
    c.beginPath(); c.moveTo(-rx * 0.26, by + ry * 1.05); c.lineTo(-rx * 0.26, by + ry * 1.22);
    c.moveTo(-rx * 0.1, by + ry * 1.05); c.lineTo(-rx * 0.1, by + ry * 1.22); c.stroke();
  }
  if (p.lying) blob(c, [[rx * 0.55, -2.5, L.lw * 1.3, L.lw * 0.75], [-rx * 0.45, -2.5, L.lw * 1.3, L.lw * 0.75]], tint(L.leg), OUTLINE, 1.4);

  drawHead(c, L, p, rx, ry, by, body, headC);
}

// فطر أحمر صغير بنقاط بيضاء (لبقرة الفطر)
function mushroom(c, x, y, r) {
  c.fillStyle = '#f1e8d6';
  c.fillRect(x - r * 0.28, y - r * 0.9, r * 0.56, r * 0.9);
  c.beginPath(); c.moveTo(x - r, y - r * 0.75);
  c.quadraticCurveTo(x, y - r * 2.1, x + r, y - r * 0.75); c.closePath();
  c.fillStyle = '#e0302a'; c.fill();
  c.strokeStyle = 'rgba(0,0,0,0.25)'; c.lineWidth = 0.8; c.stroke();
  fillEll(c, x - r * 0.4, y - r * 1.05, r * 0.16, r * 0.13, '#ffffff');
  fillEll(c, x + r * 0.3, y - r * 1.2, r * 0.18, r * 0.14, '#ffffff');
  fillEll(c, x - r * 0.02, y - r * 1.4, r * 0.12, r * 0.1, '#ffffff');
}

function woolBody(c, rx, ry, by, col, seed) {
  const puffs = [];
  const n = 12;
  for (let k = 0; k < n; k++) {
    const a = (k / n) * Math.PI * 2;
    puffs.push([Math.cos(a) * rx * 0.8, by + Math.sin(a) * ry * 0.72, ry * 0.42, ry * 0.4]);
  }
  puffs.push([0, by, rx * 0.85, ry * 0.8]);
  blob(c, puffs, vgrad(c, by - ry * 1.1, by + ry * 1.1, col));
  c.strokeStyle = shade(col, -0.14); c.lineWidth = 1.1;
  for (let k = 0; k < 8; k++) {
    const a = k * 0.83 + seed;
    const x = Math.cos(a) * rx * 0.5, y = by + Math.sin(a * 1.7) * ry * 0.42;
    c.beginPath(); c.arc(x, y, ry * 0.2, Math.PI * 1.05, Math.PI * 1.95); c.stroke();
  }
  fillEll(c, -rx * 0.2, by - ry * 0.5, rx * 0.38, ry * 0.2, 'rgba(255,255,255,0.55)');
}

function drawTail(c, L, rx, ry, by, p, body) {
  const tw = Math.sin(p.t * 3 + p.seed) * 3;
  const x0 = -rx * 0.92, y0 = by - ry * 0.4;
  if (L.tail === 'nub') { blob(c, [[x0 - 2, y0 + 3, ry * 0.3, ry * 0.26]], body); return; }
  if (L.tail === 'up') {
    stroke2(c, () => { c.moveTo(x0 + 2, y0 + 2); c.quadraticCurveTo(x0 - 5, y0 - 4, x0 - 3 + tw * 0.4, y0 - 9); }, L.lw * 0.9, body);
    return;
  }
  const ex = x0 - 5 + tw, ey = by + ry * 0.95;
  stroke2(c, () => { c.moveTo(x0 + 2, y0); c.quadraticCurveTo(x0 - 8, by, ex, ey); }, 2.2, shade(body, -0.08));
  blob(c, [[ex, ey + 2, 2.8, 4.2, tw * 0.05]], L.tuft || shade(body, -0.5), OUTLINE, 1.4);
}

function ear(c, x, y, hs, L, rot, col) {
  c.save(); c.translate(x, y); c.rotate(rot);
  blob(c, [[-hs * 0.42, 0, hs * 0.5, hs * 0.22]], col, OUTLINE, 1.6);
  if (L.earIn) fillEll(c, -hs * 0.45, 0.4, hs * 0.3, hs * 0.1, L.earIn);
  c.restore();
}

function eye(c, x, y, hs, p) {
  const r = Math.max(2.1, hs * 0.2);
  const blink = (p.t * 0.55 + p.seed) % 4 < 0.12;
  if ((p.lying && p.night) || blink) {
    c.strokeStyle = '#2a1d17'; c.lineWidth = 1.5; c.lineCap = 'round';
    c.beginPath(); c.arc(x, y - r * 0.3, r * 0.8, 0.3, Math.PI - 0.3); c.stroke();
    return;
  }
  ell(c, x, y, r, r * 1.1); c.fillStyle = '#ffffff'; c.fill();
  c.strokeStyle = OUTLINE; c.lineWidth = 1; c.stroke();
  fillEll(c, x + r * 0.25, y + r * 0.12, r * 0.66, r * 0.78, '#2a1d17');
  fillEll(c, x + r * 0.42, y - r * 0.22, r * 0.28, r * 0.28, '#ffffff');
}

function drawHorns(c, L, hx, hy, hs) {
  if (L.horns === 'small') {
    stroke2(c, () => { c.moveTo(hx + hs * 0.05, hy - hs * 0.55); c.quadraticCurveTo(hx + hs * 0.05, hy - hs * 1.15, hx + hs * 0.45, hy - hs * 1.2); }, 3.2, '#efe3c4');
  } else if (L.horns === 'back') {
    stroke2(c, () => { c.moveTo(hx + hs * 0.15, hy - hs * 0.6); c.quadraticCurveTo(hx - hs * 0.2, hy - hs * 1.6, hx - hs * 0.95, hy - hs * 1.15); }, 3.4, '#7a6a58');
    c.strokeStyle = 'rgba(40,30,20,0.35)'; c.lineWidth = 1;
    for (let k = 0; k < 3; k++) { const px = hx - hs * 0.1 * k, py = hy - hs * (0.9 + k * 0.18); c.beginPath(); c.moveTo(px - 2, py); c.lineTo(px + 2, py + 1); c.stroke(); }
  } else if (L.horns === 'big') {
    const d = () => { c.moveTo(hx + hs * 0.3, hy - hs * 0.55); c.quadraticCurveTo(hx - hs * 1.5, hy - hs * 0.5, hx - hs * 1.25, hy - hs * 1.35); };
    stroke2(c, d, 5.5, '#3b3533');
    c.strokeStyle = 'rgba(255,255,255,0.18)'; c.lineWidth = 1.5; c.beginPath(); d(); c.stroke();
  }
}

function headPos(L, p, rx, ry, by) {
  const hs = ry * (L.headScale || 0.75) * (p.young ? 1.12 : 1);
  const g = p.graze && !p.lying ? 1 : 0;
  return { hs, hx: rx * 0.98 + g * 4, hy: (by - ry * 0.65) * (1 - g) + g * (-hs * 0.85) + (p.lying ? 2 : 0) };
}

function drawHead(c, L, p, rx, ry, by, body, headC) {
  const { hs, hx, hy } = headPos(L, p, rx, ry, by);
  const flick = Math.sin(p.t * 2.2 + p.seed * 3) > 0.93 ? 0.5 : 0;
  const earC = p.sick ? mix(L.ear, '#a9c46c', 0.35) : L.ear;

  // وصلة الرقبة فوق الجسم بدون حدود
  c.strokeStyle = body; c.lineWidth = ry * 0.95; c.lineCap = 'round';
  c.beginPath(); c.moveTo(rx * 0.75, by - ry * 0.25); c.lineTo(hx - hs * 0.15, hy + hs * 0.05); c.stroke();
  ear(c, hx - hs * 0.2, hy - hs * 0.42, hs, L, -0.25 - flick, shade(earC, -0.15));
  drawHorns(c, L, hx, hy, hs);
  blob(c, [[hx + hs * 0.2, hy, hs * 0.95, hs * 0.76, 0.12]], vgrad(c, hy - hs, hy + hs, headC));
  if (L.mushrooms) mushroom(c, hx - hs * 0.05, hy - hs * 0.6, hs * 0.38);
  if (L.wool) blob(c, [[hx - hs * 0.05, hy - hs * 0.62, hs * 0.55, hs * 0.36], [hx + hs * 0.3, hy - hs * 0.66, hs * 0.35, hs * 0.28]], body, OUTLINE, 1.8);
  if (L.blaze) {
    c.save(); ell(c, hx + hs * 0.2, hy, hs * 0.95, hs * 0.76, 0.12); c.clip();
    fillEll(c, hx + hs * 0.55, hy - hs * 0.35, hs * 0.5, hs * 0.2, L.blaze, 0.35); c.restore();
  }
  // الخطم
  const mx = hx + hs * 0.95, my = hy + hs * 0.28;
  blob(c, [[mx, my, hs * 0.52, hs * 0.44, 0.1]], vgrad(c, my - hs * 0.5, my + hs * 0.5, L.muzzle), OUTLINE, 1.8);
  fillEll(c, mx + hs * 0.26, my - hs * 0.06, hs * 0.08, hs * 0.12, 'rgba(60,30,30,0.6)');
  c.strokeStyle = 'rgba(60,30,30,0.5)'; c.lineWidth = 1.1; c.lineCap = 'round';
  c.beginPath(); c.moveTo(mx - hs * 0.05, my + hs * 0.26); c.quadraticCurveTo(mx + hs * 0.15, my + hs * 0.32, mx + hs * 0.3, my + hs * 0.22); c.stroke();
  if (L.beard) {
    c.fillStyle = shade(L.head, 0.35);
    c.beginPath(); c.moveTo(mx - hs * 0.3, my + hs * 0.3); c.lineTo(mx + hs * 0.1, my + hs * 0.35); c.lineTo(mx - hs * 0.15, my + hs * 1.1); c.closePath();
    c.fill(); c.strokeStyle = OUTLINE; c.lineWidth = 1.2; c.stroke();
  }
  ear(c, hx + hs * 0.02, hy - hs * 0.48, hs, L, 0.3 + flick * 0.4, earC);
  eye(c, hx + hs * 0.5, hy - hs * 0.2, hs, p);
  fillEll(c, hx + hs * 0.5, hy + hs * 0.25, hs * 0.18, hs * 0.1, 'rgba(255,120,120,0.28)');
}

function drawChicken(c, L, p) {
  const hop = p.moving ? Math.abs(Math.sin(p.phase)) * 3 : 0;
  const by = -12 - hop + (p.lying ? 6 : 0);
  const body = p.sick ? mix(L.body, '#a9c46c', 0.4) : L.body;
  const sw = p.moving ? Math.sin(p.phase) * 3 : 0;
  shadow(c, 0, 1, 11, 3.8);
  if (!p.lying) {
    c.strokeStyle = L.leg; c.lineWidth = 2.2; c.lineCap = 'round';
    for (const [x, s] of [[-2.5, sw], [3, -sw]]) {
      c.beginPath(); c.moveTo(x, by + 6); c.lineTo(x + s, -0.5);
      c.moveTo(x + s, -0.5); c.lineTo(x + s + 3, 0);
      c.moveTo(x + s, -0.5); c.lineTo(x + s - 2, 0.5);
      c.stroke();
    }
  }
  blob(c, [[-11, by - 7, 4.5, 8, -0.5], [-13.5, by - 3, 4, 7.5, -0.95], [-8.5, by - 9, 3.8, 7, -0.2]], shade(body, -0.06), OUTLINE, 1.8);
  blob(c, [[0, by, 10.5, 8.8], [4, by - 3, 7, 7]], vgrad(c, by - 10, by + 9, body), OUTLINE, 2);
  blob(c, [[-1.5, by + 1, 6.6, 4.6, -0.25]], L.wing, OUTLINE, 1.4);
  c.strokeStyle = 'rgba(80,60,40,0.3)'; c.lineWidth = 1;
  for (let k = 0; k < 3; k++) { c.beginPath(); c.arc(-5 + k * 3, by + 2.5, 2.2, 0.2, Math.PI - 0.2); c.stroke(); }
  const g = p.graze && !p.lying ? 1 : 0;
  const hx = 8 + g * 3, hy = by - 8 + g * 10;
  blob(c, [[hx - 1.5, hy - 1.5, 3, 3.1], [hx + 0.8, hy - 2.8, 3.1, 3.2], [hx + 3, hy - 1.8, 2.6, 2.8]].map(s => [s[0], s[1] - 3.6, s[2] * 0.7, s[3] * 0.75]), L.comb, OUTLINE, 1.2);
  blob(c, [[hx, hy, 5.8, 5.5]], body, OUTLINE, 1.8);
  c.fillStyle = L.beak;
  c.beginPath(); c.moveTo(hx + 4.5, hy - 1.3); c.lineTo(hx + 9.5, hy + 0.4); c.lineTo(hx + 4.5, hy + 2); c.closePath();
  c.fill(); c.strokeStyle = OUTLINE; c.lineWidth = 1.1; c.stroke();
  blob(c, [[hx + 4.2, hy + 3.6, 1.5, 2.2]], L.comb, OUTLINE, 1);
  eye(c, hx + 1.8, hy - 1, 5.5, p);
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
  drawAnimalShape(c, type, { phase: 0, moving: false, t: 1, seed: 1.7, sick, graze: false, lying: false, adult: stage === 'large', young: stage === 'small' });
  c.restore();
}

// ------------------------------------------------------------
//  الأشخاص
// ------------------------------------------------------------
function drawPerson(c, look, t, opts = {}) {
  const sway = Math.sin(t * 2 + (opts.seed || 0)) * 1.2;
  const walk = opts.walking ? Math.sin(t * 10) * 3 : 0;
  const robe = look.robe;
  shadow(c, 0, 1, 12, 4);
  // الساقان والحذاء
  stroke2(c, () => { c.moveTo(-4, -10); c.lineTo(-4 + walk, -1); c.moveTo(4, -10); c.lineTo(4 - walk, -1); }, 3.6, opts.vet ? '#3f7f6e' : '#5a4636');
  blob(c, [[-4 + walk + 1.5, -1, 3.4, 1.8], [4 - walk + 1.5, -1, 3.4, 1.8]], '#2e2520', OUTLINE, 1.2);
  // الذراع الخلفية
  stroke2(c, () => { c.moveTo(-6, -32); c.lineTo(-10 - walk * 0.6, -20); }, 3.6, shade(robe, -0.15));
  // الثوب
  polyPath(c, [[-8, -37], [8, -37], [11 + sway * 0.3, -7], [-11 + sway * 0.3, -7]]);
  const g = c.createLinearGradient(-11, 0, 11, 0); g.addColorStop(0, shade(robe, 0.12)); g.addColorStop(1, shade(robe, -0.15));
  fillOut(c, g, 1.8);
  c.strokeStyle = 'rgba(0,0,0,0.12)'; c.lineWidth = 1; c.beginPath(); c.moveTo(0, -35); c.lineTo(sway * 0.2, -9); c.stroke();
  if (opts.vet) {
    stroke2(c, () => { c.moveTo(-4, -36); c.quadraticCurveTo(0, -24, 4, -36); }, 1.4, '#2d5d7c');
    fillEll(c, 0, -25, 2, 2, '#9bb4c4');
  }
  // الذراع الأمامية واليد
  stroke2(c, () => { c.moveTo(6, -32); c.lineTo(10 + walk * 0.6, -20); }, 3.6, robe);
  blob(c, [[10 + walk * 0.6, -19, 2.3, 2.3]], look.skin, OUTLINE, 1.1);
  if (opts.vet) { rr(c, 8 + walk * 0.6, -18, 11, 9, 2); fillOut(c, '#6b3d24', 1.3); c.fillStyle = '#e0443a'; c.fillRect(12.5 + walk * 0.6, -15.5, 2, 4); c.fillRect(11.5 + walk * 0.6, -14.5, 4, 2); }
  // الرأس
  blob(c, [[0, -44, 7.6, 7.8]], look.skin, OUTLINE, 1.8);
  if (opts.vet) {
    c.beginPath(); c.arc(0, -46, 8.2, Math.PI, 0); c.closePath(); fillOut(c, '#2fae62', 1.6);
  } else {
    // غترة وعقال
    c.beginPath(); c.arc(0, -46, 9, Math.PI, 0); c.lineTo(10, -33); c.lineTo(5.5, -38); c.lineTo(-5.5, -38); c.lineTo(-10, -33); c.closePath();
    fillOut(c, look.head, 1.6);
    if (look.head === '#d64545') {
      c.strokeStyle = 'rgba(255,255,255,0.45)'; c.lineWidth = 0.9;
      for (let k = -6; k <= 6; k += 3) { c.beginPath(); c.moveTo(k, -54); c.lineTo(k + 3, -44); c.stroke(); }
    }
    c.strokeStyle = '#1f1f1f'; c.lineWidth = 2.4; c.beginPath(); c.ellipse(0, -49, 7.8, 2.3, 0, 0, Math.PI * 2); c.stroke();
  }
  // الوجه
  fillEll(c, 2.6, -43.5, 1.2, 1.4, '#1d1a18'); fillEll(c, -2.6, -43.5, 1.2, 1.4, '#1d1a18');
  fillEll(c, 4.2, -40.5, 1.6, 1, 'rgba(255,110,110,0.3)'); fillEll(c, -4.2, -40.5, 1.6, 1, 'rgba(255,110,110,0.3)');
  c.strokeStyle = 'rgba(60,30,20,0.7)'; c.lineWidth = 1; c.beginPath(); c.arc(0, -41, 2.2, 0.3, Math.PI - 0.3); c.stroke();
  if (look.beard) { c.beginPath(); c.arc(0, -41, 6, 0.1, Math.PI - 0.1); c.lineTo(-4, -37); c.quadraticCurveTo(0, -34, 4, -37); c.closePath(); c.fillStyle = look.beard; c.fill(); }
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
  const threats = s.raids.filter(r => r.phase === 'inside').map(r => View.preds.get(r.id)).filter(Boolean);
  for (const a of s.animals) {
    const act = View.actors.get(a.id);
    if (!act) continue;
    act.pop = Math.min(1, act.pop + dt * 3);
    // إبقاء الحيوان داخل الحظيرة إذا تغيّر حجمها
    if (!inRect(act.x, act.y, L.pen, -10)) { const p = randomPenPoint(L); act.x = p.x; act.y = p.y; act.state = 'idle'; }
    // الهروب من المفترس
    const th = threats.find(p => Math.hypot(p.x - act.x, p.y - act.y) < 110);
    if (th && act.state !== 'run') {
      const d = Math.hypot(act.x - th.x, act.y - th.y) || 1;
      act.tx = clamp(act.x + (act.x - th.x) / d * 100, L.pen.x + 25, L.pen.x + L.pen.w - 25);
      act.ty = clamp(act.y + (act.y - th.y) / d * 100, L.pen.y + 30, L.pen.y + L.pen.h - 18);
      act.state = 'run';
    }
    if (night && !th && act.state !== 'run') { act.state = 'sleep'; act.moving = false; continue; }
    if (act.state === 'sleep') { act.state = 'idle'; act.timer = rand(0, 2); }
    const T = ANIMALS[a.type];
    let speed = T.look.speed * (a.disease ? 0.45 : 1) * (a.hunger < 20 ? 0.6 : 1) * (act.state === 'run' ? 2.4 : 1);
    if (act.state === 'walk' || act.state === 'run') {
      const dx = act.tx - act.x, dy = act.ty - act.y;
      const d = Math.hypot(dx, dy);
      if (d < 2) { act.state = act.state === 'run' || Math.random() >= 0.55 ? 'idle' : 'graze'; act.timer = rand(1.5, 5); act.moving = false; }
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
//  الحيوانات المفترسة وكلاب الحراسة
// ------------------------------------------------------------
// المفترس يخرج من الأشجار غرب المزرعة نحو نقطة على سياج الحظيرة
function raidPath(L, r) {
  const y = L.pen.y + 50 + r.seed * (L.pen.h - 80);
  return { from: { x: -50, y: y + (r.seed - 0.5) * 240 }, fence: { x: L.pen.x - 18, y } };
}

// تحريك ممثل نحو هدف، يعيد المسافة المتبقية
function moveToward(p, tx, ty, speed, dt) {
  const dx = tx - p.x, dy = ty - p.y, d = Math.hypot(dx, dy);
  if (d < 1.5) { p.moving = false; return d; }
  const m = Math.min(d, speed * dt);
  p.x += dx / d * m; p.y += dy / d * m;
  if (Math.abs(dx) > 1) p.facing = dx > 0 ? 1 : -1;
  p.phase += dt * Math.max(speed, 20) * 0.45;
  p.moving = true;
  return d;
}

function updatePredators(s, L, dt) {
  const ids = new Set();
  for (const r of s.raids) {
    ids.add(r.id);
    const path = raidPath(L, r);
    let p = View.preds.get(r.id);
    if (!p) { p = { x: path.from.x, y: path.from.y, facing: 1, phase: 0, moving: false, hit: 0 }; View.preds.set(r.id, p); }
    p.hit = Math.max(0, p.hit - dt);
    p.attack = false; p.scratch = false;
    if (r.phase === 'approach') {
      const k = clamp(1 - (r.until - s.time) / GAME.RAID_APPROACH, 0, 1);
      moveToward(p, path.from.x + (path.fence.x - path.from.x) * k, path.from.y + (path.fence.y - path.from.y) * k, 300, dt);
    } else if (r.phase === 'fence') {
      p.scratch = moveToward(p, path.fence.x, path.fence.y, 60, dt) < 3;
      if (p.scratch) p.facing = 1;
    } else if (r.phase === 'inside') {
      const act = View.actors.get(r.targetId);
      if (act) {
        const side = p.x < act.x ? -1 : 1;
        p.attack = moveToward(p, act.x + side * 22, act.y + 2, 95, dt) < 6;
        if (p.attack) p.facing = -side;
      }
    } else {
      moveToward(p, path.from.x, path.from.y, 140, dt);
    }
  }
  for (const id of [...View.preds.keys()]) if (!ids.has(id)) View.preds.delete(id);
}

function dogHome(L, i) { return { x: L.barn.x + L.barn.w + 34 + i * 30, y: L.barn.y + L.barn.h + 16 }; }

function updateDogs(s, L, dt, night) {
  const n = s.upgrades.dog >= 3 ? 2 : s.upgrades.dog >= 1 ? 1 : 0;
  while (View.dogs.length < n) { const h = dogHome(L, View.dogs.length); View.dogs.push({ x: h.x, y: h.y, facing: 1, phase: 0, moving: false, timer: 0, tx: h.x, ty: h.y, bark: false }); }
  View.dogs.length = n;
  const targets = s.raids.filter(r => r.phase === 'fence' || r.phase === 'inside').map(r => View.preds.get(r.id)).filter(Boolean);
  View.dogs.forEach((d, i) => {
    d.bark = false;
    if (!inRect(d.x, d.y, L.pen, -6)) { const h = dogHome(L, i); d.x = h.x; d.y = h.y; }
    const pr = targets[i % Math.max(1, targets.length)];
    if (pr) {
      // الكلب يبقى داخل الحظيرة ويهاجم المفترس من خلف السياج أو داخلها
      const tx = clamp(pr.x + (i ? 14 : -14), L.pen.x + 14, L.pen.x + L.pen.w - 14);
      const ty = clamp(pr.y + (i ? 10 : 0), L.pen.y + 24, L.pen.y + L.pen.h - 10);
      d.bark = moveToward(d, tx, ty, 120, dt) < 30;
      if (d.bark) d.facing = pr.x > d.x ? 1 : -1;
      d.lying = false;
      d.timer = 0;
      return;
    }
    if (night) {
      const h = dogHome(L, i);
      moveToward(d, h.x, h.y, 40, dt);
      d.lying = !d.moving;
      return;
    }
    d.lying = false;
    d.timer -= dt;
    if (d.timer <= 0) {
      const h = dogHome(L, i);
      d.tx = clamp(h.x + rand(-60, 30), L.pen.x + 20, L.pen.x + L.pen.w - 20);
      d.ty = clamp(h.y + rand(-10, 60), L.pen.y + 30, L.pen.y + L.pen.h - 18);
      d.timer = rand(3, 7);
    }
    moveToward(d, d.tx, d.ty, 35, dt);
  });
}

function drawPredator(c, r, p, t) {
  const P = PREDATORS[r.type];
  const active = r.phase !== 'flee';
  const jig = p.scratch ? Math.sin(t * 28) * 1.8 : p.hit > 0 ? Math.sin(t * 60) * 3 : 0;
  c.save();
  c.translate(p.x + jig, p.y);
  if (active) {
    ell(c, 0, 2, 30 * P.size, 10 * P.size);
    c.strokeStyle = `rgba(230,60,50,${0.55 + 0.35 * Math.sin(t * 8)})`; c.lineWidth = 3; c.stroke();
  }
  c.scale(p.facing * P.size, P.size);
  drawQuad(c, P.look, { phase: p.phase, moving: p.moving, t, seed: r.seed * 10, sick: false, graze: p.attack && Math.sin(t * 10) > 0, lying: false });
  c.restore();
  if (!active) return;
  // شريط قوة المفترس
  const w = 38, x = p.x - w / 2, y = p.y - (P.look.lh + P.look.ry * 2 + 20) * P.size;
  rr(c, x, y, w, 6, 3); c.fillStyle = 'rgba(0,0,0,0.45)'; c.fill();
  rr(c, x, y, w * clamp(r.hp / P.hp, 0, 1), 6, 3); c.fillStyle = '#e0443a'; c.fill();
  const b = Math.sin(t * 6) * 2;
  c.font = '16px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
  c.fillText('👆', p.x + 22, y - 6 + b);
}

function drawDog(c, d, t, night) {
  c.save();
  c.translate(d.x, d.y);
  c.scale(d.facing * 0.9, 0.9);
  drawQuad(c, DOG_LOOK, { phase: d.phase, moving: d.moving, t, seed: 3, sick: false, graze: false, lying: d.lying, night });
  c.restore();
  if (d.bark && Math.sin(t * 9) > 0) {
    c.font = 'bold 13px Tahoma, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.lineWidth = 3; c.strokeStyle = 'rgba(0,0,0,0.5)'; c.strokeText('هاو!', d.x, d.y - 38);
    c.fillStyle = '#fff'; c.fillText('هاو!', d.x, d.y - 38);
  }
}

// أعمدة الإنارة حول الحظيرة (الجهة الغربية أولاً لأن المفترسات تأتي منها)
function lampSpots(s, L) {
  const lv = s.upgrades.lights, P = L.pen;
  if (!lv) return [];
  const spots = [[P.x - 6, P.y + 14], [P.x - 6, P.y + P.h - 6]];
  if (lv >= 2) spots.push([P.x - 6, P.y + P.h / 2 + 4], [P.x + P.w / 2, P.y + P.h - 6]);
  return spots;
}

function drawLamp(c, x, y, night) {
  shadow(c, x, y + 1, 7, 2.5);
  c.fillStyle = '#4a4f55'; c.fillRect(x - 2, y - 58, 4, 58);
  c.fillRect(x - 2, y - 58, 12, 3);
  fillEll(c, x + 9, y - 52, 5, 4, night ? '#fff4b0' : '#d8dde2');
  c.strokeStyle = '#2e3236'; c.lineWidth = 1; ell(c, x + 9, y - 52, 5, 4); c.stroke();
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
      : data.at === 'dock' ? { x: L.shipPos.x, y: L.shipPos.y + 40 }
      : data.at === 'helipad' ? { x: L.helipad.x + L.helipad.w / 2, y: L.helipad.y + 20 } : { x: L.pen.x + L.pen.w / 2, y: L.pen.y + 60 };
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
  else if (type === 'raid') { Sfx.howl(); }
  else if (type === 'hit') {
    const p = View.preds.get(data.id);
    if (p) { p.hit = 0.18; floatText(p.x + rand(-10, 10), p.y - 40, '💥', '#fff'); burst(p.x, p.y - 20, 'star', 4); }
    Sfx.hit();
  } else if (type === 'repel') {
    const p = View.preds.get(data.id);
    if (p) { floatText(p.x, p.y - 50, 'هرب! 💨', '#b8ffb0'); burst(p.x, p.y - 20, 'star', 12); }
    Sfx.good();
  } else if (type === 'firecracker') {
    for (const r of data) { const p = View.preds.get(r.id); if (p) { floatText(p.x, p.y - 45, '🧨💥', '#ffd84a'); burst(p.x, p.y - 20, 'coin', 16); burst(p.x, p.y - 20, 'star', 10); } }
    Sfx.bang();
  }
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
  const key = `${s.upgrades.barn}-${s.upgrades.fields}-${s.upgrades.fence}-${s.upgrades.helipad > 0}`;
  if (View.bgKey !== key) { View.bg = buildBackground(s); View.bgKey = key; }
  const night = isNight(s);
  const hour = hourOf(s);

  syncActors(s, L);
  updatePredators(s, L, dt);
  updateActors(s, L, dt, night);
  updateDogs(s, L, dt, night);

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
  const hl = s.heli, hp = L.helipad;
  if (s.upgrades.helipad) {
    // هبوط خلال أول ثوانٍ من الوصول، وإقلاع بعد المغادرة
    const HD = 0.02;
    let lift = null;
    if (hl.state === 'landed') lift = clamp(1 - (s.time - hl.arrivedAt) / HD, 0, 1);
    else if (hl.leftAt >= 0 && s.time - hl.leftAt < HD) lift = (s.time - hl.leftAt) / HD;
    if (lift !== null) items.push({ y: hp.y + hp.h / 2 + 30, draw: () => drawHelicopter(c, hp.x + hp.w / 2, hp.y + hp.h / 2 - 4, t, lift) });
  }
  for (const a of s.animals) {
    const act = View.actors.get(a.id);
    if (!act) continue;
    items.push({ y: act.y, draw: () => drawAnimalActor(c, a, act, t, night) });
  }
  s.buyers.forEach((b, i) => {
    const bx = L.saleyard.x + 60 + i * 72, by = L.saleyard.y + 165 + (i % 2) * 22;
    items.push({ y: by, draw: () => drawBuyer(c, s, b, bx, by, t) });
  });
  for (const r of s.raids) {
    const p = View.preds.get(r.id);
    if (p) items.push({ y: p.y, draw: () => drawPredator(c, r, p, t) });
  }
  for (const d of View.dogs) items.push({ y: d.y, draw: () => drawDog(c, d, t, night) });
  const lamps = lampSpots(s, L);
  for (const [lx, ly] of lamps) items.push({ y: ly, draw: () => drawLamp(c, lx, ly, night) });
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
    if (s.upgrades.helipad) lights.push([L.helipad.x + L.helipad.w / 2, L.helipad.y + L.helipad.h / 2]);
    const lamp = lamps.map(([lx, ly]) => [lx + 9, ly - 40, 130]);
    for (const [lx, ly, rad = 70] of [...lights, ...lamp]) {
      const gr = c.createRadialGradient(lx, ly, 2, lx, ly, rad);
      gr.addColorStop(0, `rgba(255,200,110,${dark * 0.7})`); gr.addColorStop(1, 'rgba(255,200,110,0)');
      c.fillStyle = gr; c.fillRect(lx - rad, ly - rad, rad * 2, rad * 2);
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
    adult: a.stage === 'large', young: a.stage === 'small',
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
  // المفترس أولاً — مساحة لمس واسعة لتسهيل طرده على الهاتف
  for (const r of s.raids) {
    const p = View.preds.get(r.id);
    if (!p || r.phase === 'flee') continue;
    const d = Math.hypot(x - p.x, y - (p.y - 16));
    if (d < 46 && d < bestD) { best = r; bestD = d; }
  }
  if (best) return { kind: 'predator', id: best.id };
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
  if (inRect(x, y, L.helipad, 10)) return { kind: 'heli' };
  if (inRect(x, y, L.dock, 10) || (y < 190 && Math.abs(x - L.shipPos.x) < 140 && s.ship.state === 'docked')) return { kind: 'ship' };
  if (inRect(x, y, L.pen)) return { kind: 'animals' };
  return null;
}
