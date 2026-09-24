// ============================================================
//  نقطة البداية: التحميل، الحلقة الرئيسية، الحفظ التلقائي
// ============================================================

// حساب ما حدث أثناء إغلاق اللعبة
function catchUp(elapsedMs) {
  const full = elapsedMs / GAME.DAY_MS;
  const days = Math.min(full, GAME.OFFLINE_CAP_DAYS);
  if (days <= 0) return null;
  const msgs = [];
  const realNotify = Bus.notify, realFx = Bus.fx;
  Bus.notify = (m, k) => { msgs.push({ m, k }); if (S.log) logMsg(m, k); };
  Bus.fx = () => {};
  simulate(S, days, true);
  Bus.notify = realNotify; Bus.fx = realFx;
  return { days, msgs: msgs.filter(m => m.k !== 'day'), capped: full > days };
}

function handleWorldTap(x, y) {
  const hit = hitTest(S, x, y);
  if (!hit) { if (UI.panel && UI.panel !== 'help') closePanel(); return; }
  if (hit.kind === 'animal') openPanel('animal', hit.id);
  else if (hit.kind === 'plot') runAction('plot', hit.index);
  else if (hit.kind === 'storage') openPanel('storage');
  else if (hit.kind === 'vet') openPanel('vet');
  else if (hit.kind === 'animals') openPanel('animals');
  else if (hit.kind === 'sale') openPanel('sale');
  else if (hit.kind === 'ship') openPanel('ship');
}

let lastFrame = performance.now();
let hudTimer = 0, panelTimer = 0;

function frame(now) {
  const dt = Math.min(0.1, (now - lastFrame) / 1000);
  lastFrame = now;

  const real = Date.now();
  const elapsed = real - S.lastReal;
  S.lastReal = real;
  if (elapsed > 5000) {
    // عودة بعد إخفاء التبويب أو قفل الشاشة
    const r = catchUp(elapsed);
    if (r && elapsed > 30000) openPanel('away', r);
  } else if (elapsed > 0) {
    simulate(S, elapsed / GAME.DAY_MS, false);
  }

  renderFrame(S, dt);

  hudTimer += dt; panelTimer += dt;
  if (hudTimer > 0.25) { hudTimer = 0; updateHud(); }
  if (panelTimer > 1) { panelTimer = 0; renderPanel(false); }
  requestAnimationFrame(frame);
}

function boot() {
  S = loadGame();
  let away = null;
  if (!S) S = newGame();
  else away = catchUp(Date.now() - S.lastReal);
  S.lastReal = Date.now();

  initUI();
  initView(document.getElementById('world'));
  View.onTap = handleWorldTap;
  Bus.fx = handleFx;
  updateHud();

  if (!S.tutorialDone) openPanel('help');
  else if (away && away.days > 0.02) openPanel('away', away);

  setInterval(saveGame, 5000);
  document.addEventListener('visibilitychange', () => { if (document.hidden) saveGame(); });
  window.addEventListener('pagehide', saveGame);
  window.addEventListener('beforeunload', saveGame);

  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
  document.getElementById('loading').remove();
  requestAnimationFrame(t => { lastFrame = t; frame(t); });
}

window.addEventListener('load', boot);
