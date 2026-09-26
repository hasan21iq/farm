// اختبار سريع لمنطق اللعبة بدون متصفح: لاعب آلي بسيط
const fs = require('fs'), vm = require('vm');
const ctx = { console, Math, JSON, Date, localStorage: { _d: {}, getItem(k) { return this._d[k] || null; }, setItem(k, v) { this._d[k] = v; }, removeItem(k) { delete this._d[k]; } } };
vm.createContext(ctx);
for (const f of ['js/config.js', 'js/game.js']) vm.runInContext(fs.readFileSync(f, 'utf8'), ctx, { filename: f });
const DEFEND = process.argv[2] !== 'nodefend'; // node tools/simtest.js nodefend — بدون طرد المفترسات
ctx.DEFEND = DEFEND;
vm.runInContext(`
  const counts = {};
  Bus.notify = (m, k) => { counts[k] = (counts[k] || 0) + 1; };
  S = newGame();
  const dt = 0.01;
  for (let i = 0; i < 1500; i++) { // 15 يوم
    simulate(S, dt, false);
    if (i % 5 === 0) {
      actHarvestAll(); actPlantAll(S.level >= 2 ? 'corn' : 'barley');
      actFeedAll();
      if (S.cleanliness < 50) actClean();
      for (const a of S.animals) if (a.disease) { a.disease.diagnosed ? actTreat(a.id) : actCallVet(a.id); }
      for (const b of [...S.buyers]) actSellBuyer(b.id);
      if (S.ship.state === 'docked') S.ship.lines.forEach((l, j) => actShipDeliver(j));
      if (S.money > 300 && spaceUsed(S) + 1 <= barnCapacity(S)) actBuyAnimal('sheep', 'small');
      if (DEFEND) for (const r of activeRaids(S)) for (let k = 0; k < 30; k++) actHitPredator(r.id);
      if (S.money > 500 && spaceUsed(S) + 2 <= barnCapacity(S)) actBuyAnimal('cow', 'small');
      for (const k of ['fields', 'barn', 'storage', 'saleyard', 'fence', 'dog', 'lights']) { const U = UPGRADES[k]; const n = U.levels[S.upgrades[k] + 1]; if (n && S.money > n.cost * 1.5) actUpgrade(k); }
    }
    if (i % 300 === 299) console.log('day', dayNumber(S), 'money', Math.round(S.money), 'lvl', S.level, 'animals', S.animals.length, 'feed', Math.round(feedTotal(S)), 'up', JSON.stringify(S.upgrades));
  }
  console.log('events', JSON.stringify(counts));
  console.log('stats', JSON.stringify(S.stats));
  // اختبار الحفظ والتحميل
  saveGame(); const L = loadGame(); console.log('save/load ok', L.animals.length === S.animals.length, L.money === S.money);
  // اختبار وقت الإغلاق
  const before = S.animals.length; S.animals.forEach(a => a.hunger = 0);
  simulate(S, 2, true); console.log('offline deaths', before - S.animals.length, 'min health', Math.min(...S.animals.map(a => a.health)));
`, ctx);
