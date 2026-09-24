// ============================================================
//  منطق اللعبة: الحالة، المحاكاة، الحفظ، وأفعال اللاعب
// ============================================================

const rand = (a, b) => a + Math.random() * (b - a);
const randInt = (a, b) => Math.floor(rand(a, b + 1));
const pick = arr => arr[Math.floor(Math.random() * arr.length)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// قناة الإشعارات — الواجهة تستبدل هذه الدوال
const Bus = {
  notify(msg, kind) {},
  fx(type, data) {},
};

let S = null; // حالة اللعبة الحالية

// ------------------------------------------------------------
//  إنشاء لعبة جديدة
// ------------------------------------------------------------
function newGame() {
  const s = {
    version: 1,
    money: GAME.START_MONEY,
    xp: 0,
    level: 1,
    time: GAME.START_HOUR / 24,
    lastReal: Date.now(),
    animals: [],
    nextId: 1,
    feed: { grass: 20, barley: 10, corn: 0, alfalfa: 0 },
    plots: [],
    upgrades: { barn: 0, fields: 0, storage: 0, saleyard: 0, clinic: 0, feeder: 0, dock: 0 },
    unlocked: { cow: true, sheep: true },
    cleanliness: 100,
    buyers: [],
    nextBuyerAt: GAME.START_HOUR / 24 + 0.04,
    ship: { state: 'away', nextAt: GAME.FIRST_SHIP_AT, leaveAt: 0, lines: [], bonus: 0 },
    vetVisits: [],
    event: null,
    nextEventAt: GAME.FIRST_EVENT_AT,
    log: [],
    stats: { sold: 0, earned: 0, died: 0, ships: 0, buyers: 0, treated: 0 },
    settings: { sound: true },
    tutorialDone: false,
  };
  syncPlots(s);
  addAnimal(s, 'cow', 'medium', true);
  addAnimal(s, 'sheep', 'small', true);
  addAnimal(s, 'sheep', 'small', true);
  addAnimal(s, 'sheep', 'large', true);
  return s;
}

function syncPlots(s) {
  const n = upVal(s, 'fields');
  while (s.plots.length < n) s.plots.push({ crop: null, progress: 0, readyAge: 0, withered: false });
}

function addAnimal(s, type, stage, silent) {
  const a = {
    id: s.nextId++,
    type, stage,
    name: pick(ANIMAL_NAMES),
    stageAge: stage === 'large' ? 0 : rand(0, 0.2),
    hunger: 80,
    health: 100,
    disease: null,
    immuneUntil: s.time + GAME.NEW_ANIMAL_IMMUNITY,
    warned: false,
  };
  s.animals.push(a);
  if (!silent) Bus.fx('spawn', a);
  return a;
}

// ------------------------------------------------------------
//  الحفظ والتحميل
// ------------------------------------------------------------
function saveGame() {
  if (!S) return;
  S.lastReal = Date.now();
  try { localStorage.setItem(GAME.SAVE_KEY, JSON.stringify(S)); } catch (e) { console.warn('save failed', e); }
}

function loadGame() {
  try {
    const raw = localStorage.getItem(GAME.SAVE_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw);
    // ترقية الحفظ القديم: إضافة أي حقول جديدة ناقصة
    const base = newGame();
    for (const k of Object.keys(base)) if (s[k] === undefined) s[k] = base[k];
    for (const k of Object.keys(base.upgrades)) if (s.upgrades[k] === undefined) s.upgrades[k] = 0;
    for (const k of Object.keys(base.feed)) if (s.feed[k] === undefined) s.feed[k] = 0;
    for (const k of Object.keys(base.stats)) if (s.stats[k] === undefined) s.stats[k] = 0;
    s.animals = s.animals.filter(a => ANIMALS[a.type]);
    syncPlots(s);
    return s;
  } catch (e) {
    console.warn('load failed', e);
    return null;
  }
}

function resetGame() {
  localStorage.removeItem(GAME.SAVE_KEY);
  S = newGame();
  saveGame();
}

// ------------------------------------------------------------
//  قيم مساعدة
// ------------------------------------------------------------
function upLevel(s, key) { return UPGRADES[key].levels[s.upgrades[key]]; }
function upVal(s, key) { return upLevel(s, key).v; }

function eventMods(s) {
  const m = { disease: 1, vet: 1, crop: 1, buyerPrice: 1, buyerRate: 1, feedPrice: 1 };
  if (s.event && s.time < s.event.until) {
    const ev = EVENTS.find(e => e.id === s.event.id);
    if (ev) Object.assign(m, ev.mods);
  }
  return m;
}

function spaceUsed(s) { return s.animals.reduce((t, a) => t + ANIMALS[a.type].space, 0); }
function barnCapacity(s) { return upVal(s, 'barn'); }
function feedTotal(s) { return FEED_ORDER.reduce((t, k) => t + s.feed[k], 0); }
function storageCap(s) { return upVal(s, 'storage'); }
function feedPrice(s) { return Math.round(GAME.MARKET_FEED_PRICE * eventMods(s).feedPrice); }
function cleanCost(s) { return 5 + Math.round(spaceUsed(s) * 1.5); }
function dayNumber(s) { return Math.floor(s.time) + 1; }
function hourOf(s) { return (s.time % 1) * 24; }
function isNight(s) { const h = hourOf(s); return h >= 20 || h < 5.5; }

// قيمة البيع الحالية للحيوان
function animalValue(a) {
  const T = ANIMALS[a.type];
  const cur = T.stages[a.stage];
  let v = cur.sell;
  const nx = NEXT_STAGE[a.stage];
  if (nx) v += (T.stages[nx].sell - cur.sell) * clamp(a.stageAge / cur.grow, 0, 1) * 0.8;
  v *= 0.4 + 0.6 * (a.health / 100);
  if (a.disease) v *= 0.5;
  return Math.max(1, Math.round(v));
}

// الأيام المتبقية حتى يصبح كبيراً (بافتراض تغذية جيدة)
function daysToAdult(a) {
  const T = ANIMALS[a.type];
  if (a.stage === 'large') return 0;
  let d = Math.max(0, T.stages[a.stage].grow - a.stageAge);
  if (a.stage === 'small') d += T.stages.medium.grow;
  return d;
}

function growthFactor(a) {
  if (a.disease) return 0;
  if (a.hunger < 25) return 0;
  if (a.hunger < 50) return 0.5;
  return 1;
}

function animalStatus(a) {
  if (a.disease) return a.disease.diagnosed ? `مريض: ${DISEASES[a.disease.id].name}` : 'مريض — يحتاج طبيب';
  if (a.hunger <= 0) return 'يتضوّر جوعاً!';
  if (a.hunger < 30) return 'جائع';
  if (a.health < 50) return 'ضعيف';
  if (a.stage === 'large') return 'جاهز للبيع';
  if (growthFactor(a) < 1) return 'ينمو ببطء';
  return 'بصحة جيدة وينمو';
}

// هل الحيوان صالح للبيع لطلب معين
function sellable(a, type, stage) {
  return a.type === type && a.stage === stage && !a.disease && a.health >= 40;
}
function countSellable(s, type, stage) {
  return s.animals.filter(a => sellable(a, type, stage)).length;
}
function takeAnimals(s, type, stage, n) {
  const list = s.animals.filter(a => sellable(a, type, stage)).sort((x, y) => x.health - y.health).slice(0, n);
  const ids = new Set(list.map(a => a.id));
  s.animals = s.animals.filter(a => !ids.has(a.id));
  s.vetVisits = s.vetVisits.filter(v => !ids.has(v.animalId));
  return list;
}

function treatCost(s, a) {
  if (!a.disease) return 0;
  const D = DISEASES[a.disease.id];
  const T = ANIMALS[a.type];
  const c = D.cost * T.vetMult * (1 + 0.5 * (a.disease.severity - 1)) * eventMods(s).vet * (1 - upLevel(s, 'clinic').off);
  return Math.max(5, Math.round(c));
}
function vetFee(s) {
  return Math.round(GAME.VET_VISIT_FEE * eventMods(s).vet * (1 - upLevel(s, 'clinic').off));
}

// ------------------------------------------------------------
//  الخبرة والمستويات
// ------------------------------------------------------------
function addXp(s, n) {
  s.xp += n;
  while (s.xp >= xpForLevel(s.level)) {
    s.xp -= xpForLevel(s.level);
    s.level++;
    const unlocks = [];
    for (const [k, T] of Object.entries(ANIMALS)) if (T.unlock.level === s.level) unlocks.push(`${T.icon} ${T.name}`);
    for (const [k, C] of Object.entries(CROPS)) if (C.level === s.level) unlocks.push(`${C.icon} ${C.name}`);
    Bus.notify(`⭐ وصلت للمستوى ${s.level}!` + (unlocks.length ? ` متاح الآن: ${unlocks.join('، ')}` : ''), 'level');
    Bus.fx('levelup');
  }
}

function earn(s, amount, xpMul = 1) {
  s.money += amount;
  s.stats.earned += amount;
  addXp(s, Math.max(1, Math.round(amount / 10 * xpMul)));
}

// ------------------------------------------------------------
//  المحاكاة
// ------------------------------------------------------------
function simulate(s, days, offline) {
  const STEP = 0.004;
  while (days > 1e-9) {
    const dt = Math.min(STEP, days);
    step(s, dt, offline);
    days -= dt;
  }
}

function step(s, dt, offline) {
  const mods = eventMods(s);
  const prevDay = Math.floor(s.time);
  s.time += dt;
  if (Math.floor(s.time) !== prevDay && !offline) {
    Bus.notify(`☀️ بداية اليوم ${dayNumber(s)}`, 'day');
  }

  // النظافة
  const used = spaceUsed(s);
  s.cleanliness = clamp(s.cleanliness - dt * (4 + used * 1.5), 0, 100);

  // الحيوانات
  const cap = barnCapacity(s);
  const crowd = 1 + Math.max(0, used / cap - 0.75) * 3;
  const dirt = 1 + (1 - s.cleanliness / 100) * 2;
  const clinic = 1 - upVal(s, 'clinic');
  const feeder = upVal(s, 'feeder');
  const dead = [];

  for (const a of s.animals) {
    const T = ANIMALS[a.type];
    a.hunger = Math.max(0, a.hunger - GAME.HUNGER_PER_DAY * dt);
    if (feeder && a.hunger < 50) feedOne(s, a);

    let dh = 0;
    if (a.hunger <= 0) dh -= 30;
    else if (a.hunger < 20) dh -= 8;
    if (a.disease) {
      const D = DISEASES[a.disease.id];
      dh -= D.dmg * a.disease.severity;
      a.disease.prog += dt;
      if (a.disease.prog >= GAME.DISEASE_STEP_DAYS && a.disease.severity < 3) {
        a.disease.severity++;
        a.disease.prog = 0;
        if (!offline) Bus.notify(`⚠️ حالة ${T.name} (${a.name}) تسوء! اطلب الطبيب`, 'bad');
      }
    } else if (a.hunger >= 40) dh += 12;
    a.health = clamp(a.health + dh * dt, offline ? 5 : 0, 100);

    if (a.health < 30 && !a.warned) {
      a.warned = true;
      if (!offline) Bus.notify(`❗ صحة ${T.name} (${a.name}) منخفضة جداً`, 'bad');
    } else if (a.health > 45) a.warned = false;

    if (a.health <= 0) { dead.push(a); continue; }

    // النمو
    if (a.stage !== 'large') {
      a.stageAge += dt * growthFactor(a);
      const g = T.stages[a.stage].grow;
      if (a.stageAge >= g) {
        a.stage = NEXT_STAGE[a.stage];
        a.stageAge = 0;
        Bus.notify(`🎉 ${T.name} (${a.name}) ${gen(T, 'أصبح', 'أصبحت')} ${animalLabel(a.type, a.stage).split(' ')[1]}` + (a.stage === 'large' ? ` — ${gen(T, 'جاهز', 'جاهزة')} للبيع!` : ''), 'good');
      }
    }

    // ظهور المرض — لا تظهر أمراض جديدة أثناء إغلاق اللعبة
    if (!offline && !a.disease && s.time > a.immuneUntil) {
      const hungerF = a.hunger < 30 ? 1.8 : 1;
      const rate = GAME.BASE_DISEASE * T.diseaseMult * crowd * dirt * hungerF * clinic * mods.disease;
      if (Math.random() < 1 - Math.exp(-rate * dt)) infect(s, a);
    }
  }
  for (const a of dead) {
    s.animals = s.animals.filter(x => x !== a);
    s.vetVisits = s.vetVisits.filter(v => v.animalId !== a.id);
    s.stats.died++;
    const T = ANIMALS[a.type];
    Bus.notify(`💀 ${gen(T, 'نفق', 'نفقت')} ${T.name} (${a.name}) — ` + (a.disease ? 'لم يُعالج في الوقت المناسب' : 'بسبب الجوع'), 'dead');
    Bus.fx('death', a);
  }

  // المحاصيل
  for (const p of s.plots) {
    if (!p.crop || p.withered) continue;
    const C = CROPS[p.crop];
    if (p.progress < 1) {
      p.progress = Math.min(1, p.progress + dt / C.days * mods.crop);
      if (p.progress >= 1) p.readyAge = 0;
    } else if (!offline) {
      p.readyAge += dt;
      if (p.readyAge > GAME.CROP_WITHER_DAYS) {
        p.withered = true;
        Bus.notify(`🥀 ذبل محصول ${C.name} لأنه لم يُحصد`, 'bad');
      }
    }
  }

  // زيارات الطبيب
  for (const v of [...s.vetVisits]) {
    if (!v.arrived && s.time >= v.arriveAt) {
      v.arrived = true;
      const a = s.animals.find(x => x.id === v.animalId);
      if (a && a.disease) {
        a.disease.diagnosed = true;
        Bus.notify(`🩺 الطبيب شخّص ${ANIMALS[a.type].name} (${a.name}): ${DISEASES[a.disease.id].name} — ${SEVERITY_NAMES[a.disease.severity]}`, 'vet');
        Bus.fx('vetArrived', a);
      }
    }
    if (v.arrived && s.time > v.arriveAt + 0.5) s.vetVisits = s.vetVisits.filter(x => x !== v);
  }

  // المشترون
  for (const b of [...s.buyers]) {
    if (s.time >= b.leaveAt) {
      s.buyers = s.buyers.filter(x => x !== b);
      if (!offline) Bus.notify(`🚶 ${b.name} غادر ساحة البيع بدون شراء`, 'info');
    }
  }
  if (s.buyers.length < upVal(s, 'saleyard') && s.time >= s.nextBuyerAt) {
    spawnBuyer(s);
    s.nextBuyerAt = s.time + rand(0.18, 0.45) / mods.buyerRate;
  } else if (s.buyers.length >= upVal(s, 'saleyard')) {
    s.nextBuyerAt = Math.max(s.nextBuyerAt, s.time + 0.05);
  }

  // السفينة
  const sh = s.ship;
  if (sh.state === 'away' && s.time >= sh.nextAt) {
    shipArrive(s);
  } else if (sh.state === 'docked' && s.time >= sh.leaveAt) {
    sh.state = 'away';
    sh.nextAt = s.time + upVal(s, 'dock');
    Bus.notify('⛴️ أبحرت السفينة. ستعود لاحقاً بطلب جديد', 'info');
  }

  // الأحداث
  if (s.event && s.time >= s.event.until) s.event = null;
  if (!s.event && s.time >= s.nextEventAt) {
    const ev = pick(EVENTS);
    s.event = { id: ev.id, until: s.time + 1 };
    s.nextEventAt = s.time + rand(1.8, 3.2);
    Bus.notify(`${ev.icon} ${ev.name}: ${ev.desc}`, 'event');
  }
}

function infect(s, a) {
  const options = Object.entries(DISEASES).filter(([id, D]) =>
    (!D.only || D.only.includes(a.type)) && (!D.not || !D.not.includes(a.type)));
  const total = options.reduce((t, [, D]) => t + D.weight, 0);
  let r = Math.random() * total;
  let chosen = options[0][0];
  for (const [id, D] of options) { r -= D.weight; if (r <= 0) { chosen = id; break; } }
  a.disease = { id: chosen, severity: 1, prog: 0, diagnosed: false };
  Bus.notify(`🤒 ${ANIMALS[a.type].name} (${a.name}) ${gen(ANIMALS[a.type], 'مريض ويحتاج', 'مريضة وتحتاج')} طبيب!`, 'sick');
  Bus.fx('sick', a);
}

// ------------------------------------------------------------
//  توليد الطلبات
// ------------------------------------------------------------
function orderTypes(s) {
  const types = Object.keys(ANIMALS).filter(t => s.unlocked[t]);
  const owned = new Set(s.animals.map(a => a.type));
  const weighted = [];
  for (const t of types) for (let i = 0; i < (owned.has(t) ? 3 : 1); i++) weighted.push(t);
  return { types, weighted };
}

function genLines(s, nLines, countFn, stageFn) {
  const { types, weighted } = orderTypes(s);
  nLines = Math.min(nLines, types.length);
  const lines = [];
  const used = new Set();
  let guard = 0;
  while (lines.length < nLines && guard++ < 50) {
    const type = pick(weighted);
    if (used.has(type)) continue;
    used.add(type);
    const mult = type === 'chicken' ? 3 : 1;
    lines.push({ type, stage: stageFn(), count: countFn() * mult, delivered: 0 });
  }
  return lines;
}

function spawnBuyer(s) {
  const mods = eventMods(s);
  const nLines = Math.random() < 0.3 + s.level * 0.05 ? 2 : 1;
  const lines = genLines(s, nLines,
    () => randInt(1, 1 + Math.floor(s.level * 0.6)),
    () => (Math.random() < 0.8 ? 'large' : 'medium'));
  const mult = rand(1.1, 1.4) * (1 + upLevel(s, 'saleyard').bonus) * mods.buyerPrice;
  for (const l of lines) l.price = Math.round(ANIMALS[l.type].stages[l.stage].sell * mult);
  const wait = rand(0.7, 1.2);
  const b = {
    id: s.nextId++,
    name: pick(BUYER_NAMES),
    lines,
    arrivedAt: s.time,
    leaveAt: s.time + wait,
    look: { robe: pick(['#f4f1ea', '#d9cbb2', '#8c9aa8', '#6b7a5a', '#e7dcc6']), head: pick(['#ffffff', '#d64545', '#2d2d2d']), skin: pick(['#e0b48a', '#c99470', '#a8764f']) },
  };
  s.buyers.push(b);
  Bus.notify(`🧑‍🌾 وصل ${b.name} إلى ساحة البيع ويطلب: ${linesText(lines)}`, 'buyer');
}

function shipArrive(s) {
  const sh = s.ship;
  const lvl = s.level;
  sh.state = 'docked';
  sh.leaveAt = s.time + 1;
  sh.lines = genLines(s, Math.random() < 0.5 ? 2 : 3,
    () => randInt(1, 3) + Math.floor((lvl - 1) * 0.6),
    () => (Math.random() < 0.85 ? 'large' : 'medium'));
  const mult = rand(1.3, 1.55) * (1 + upLevel(s, 'dock').bonus);
  for (const l of sh.lines) l.price = Math.round(ANIMALS[l.type].stages[l.stage].sell * mult);
  sh.bonus = Math.round((100 + 80 * lvl) * (1 + upLevel(s, 'dock').bonus));
  Bus.notify(`⛴️ وصلت السفينة وتطلب: ${linesText(sh.lines)}`, 'ship');
  Bus.fx('ship');
}

// "بقرة كبيرة" / "خروف متوسط" حسب جنس الاسم
function gen(T, m, f) { return T.fem ? f : m; }

function animalLabel(type, stage) {
  const T = ANIMALS[type];
  return `${T.name} ${STAGE_NAMES[stage]}${T.fem ? 'ة' : ''}`;
}

function linesText(lines) {
  return lines.map(l => `${l.count - (l.delivered || 0)} × ${animalLabel(l.type, l.stage)}`).join(' + ');
}

// ------------------------------------------------------------
//  أفعال اللاعب — كل دالة تعيد {ok, msg}
// ------------------------------------------------------------
const fail = msg => ({ ok: false, msg });
const done = msg => ({ ok: true, msg });

function actBuyAnimal(type, stage) {
  const T = ANIMALS[type];
  if (!S.unlocked[type]) return fail('هذا الحيوان غير متاح بعد');
  const price = T.stages[stage].buy;
  if (S.money < price) return fail('لا يوجد مال كافٍ');
  if (spaceUsed(S) + T.space > barnCapacity(S)) return fail('الحظيرة ممتلئة — طوّر الحظيرة أولاً');
  S.money -= price;
  const a = addAnimal(S, type, stage);
  addXp(S, 2);
  return done(`اشتريت ${T.name} ${STAGE_NAMES[stage]} (${a.name})`);
}

function actUnlock(type) {
  const T = ANIMALS[type];
  if (S.unlocked[type]) return fail('متاح مسبقاً');
  if (S.level < T.unlock.level) return fail(`يتطلب المستوى ${T.unlock.level}`);
  if (S.money < T.unlock.cost) return fail('لا يوجد مال كافٍ');
  S.money -= T.unlock.cost;
  S.unlocked[type] = true;
  addXp(S, 20);
  return done(`🔓 أصبح بإمكانك تربية ${T.plural}!`);
}

function actSellTrader(id) {
  const a = S.animals.find(x => x.id === id);
  if (!a) return fail('الحيوان غير موجود');
  const price = Math.round(animalValue(a) * GAME.TRADER_RATE);
  S.animals = S.animals.filter(x => x !== a);
  S.vetVisits = S.vetVisits.filter(v => v.animalId !== id);
  earn(S, price, 0.5);
  S.stats.sold++;
  Bus.fx('money', { amount: price, at: 'pen' });
  return done(`بعت ${ANIMALS[a.type].name} للتاجر بـ ${price}`);
}

// إطعام حيوان واحد من المخزن، يعيد الكمية المستهلكة
function feedOne(s, a) {
  const need = ANIMALS[a.type].stages[a.stage].feed * (100 - a.hunger) / 100;
  if (need <= 0.01) return 0;
  let got = 0;
  for (const k of FEED_ORDER) {
    const take = Math.min(s.feed[k], need - got);
    if (take > 0) { s.feed[k] -= take; got += take; }
    if (got >= need - 1e-6) break;
  }
  for (const k of FEED_ORDER) if (s.feed[k] < 1e-6) s.feed[k] = 0;
  a.hunger = Math.min(100, a.hunger + got / ANIMALS[a.type].stages[a.stage].feed * 100);
  return got;
}

function actFeed(id) {
  const a = S.animals.find(x => x.id === id);
  if (!a) return fail('الحيوان غير موجود');
  if (a.hunger > 95) return fail('الحيوان شبعان');
  if (feedTotal(S) < 0.05) return fail('المخزن فارغ! ازرع علفاً أو اشترِ من السوق');
  const used = feedOne(S, a);
  Bus.fx('feed', a);
  return done(`أطعمت ${a.name} (${used.toFixed(1)} علف)`);
}

function actFeedAll() {
  const hungry = S.animals.filter(a => a.hunger < 95).sort((x, y) => x.hunger - y.hunger);
  if (!hungry.length) return fail('كل الحيوانات شبعانة 😊');
  if (feedTotal(S) < 0.05) return fail('المخزن فارغ! ازرع علفاً أو اشترِ من السوق');
  let used = 0, fed = 0;
  for (const a of hungry) {
    if (feedTotal(S) < 0.05) break;
    used += feedOne(S, a);
    fed++;
    Bus.fx('feed', a);
  }
  const left = hungry.length - fed;
  return done(`أطعمت ${fed} حيوان (${used.toFixed(1)} علف)` + (left ? ` — ${left} بقي جائعاً، العلف نفد!` : ''));
}

function actClean() {
  const c = cleanCost(S);
  if (S.cleanliness > 90) return fail('الحظيرة نظيفة');
  if (S.money < c) return fail('لا يوجد مال كافٍ');
  S.money -= c;
  S.cleanliness = 100;
  addXp(S, 1);
  Bus.fx('clean');
  return done('🧹 نظّفت الحظيرة');
}

function actPlant(i, crop) {
  const p = S.plots[i];
  const C = CROPS[crop];
  if (!p) return fail('');
  if (p.crop) return fail('الحوض مزروع');
  if (S.level < C.level) return fail(`يتطلب المستوى ${C.level}`);
  if (S.money < C.seed) return fail('لا يوجد مال كافٍ للبذور');
  S.money -= C.seed;
  Object.assign(p, { crop, progress: 0, readyAge: 0, withered: false });
  return done(`زرعت ${C.name}`);
}

function actPlantAll(crop) {
  const C = CROPS[crop];
  if (S.level < C.level) return fail(`يتطلب المستوى ${C.level}`);
  let n = 0;
  S.plots.forEach((p, i) => {
    if (!p.crop && S.money >= C.seed) { actPlant(i, crop); n++; }
  });
  if (!n) return fail(S.plots.some(p => !p.crop) ? 'لا يوجد مال كافٍ' : 'لا توجد أحواض فارغة');
  return done(`زرعت ${n} أحواض ${C.name}`);
}

function actHarvest(i, silent) {
  const p = S.plots[i];
  if (!p || !p.crop) return fail('');
  if (p.withered) {
    Object.assign(p, { crop: null, progress: 0, withered: false });
    return done('أزلت المحصول الذابل');
  }
  if (p.progress < 1) return fail('المحصول لم ينضج بعد');
  const C = CROPS[p.crop];
  const free = storageCap(S) - feedTotal(S);
  if (free < 1) return fail('المخزن ممتلئ! طوّر المخزن');
  const amount = Math.min(C.yield, Math.floor(free));
  S.feed[p.crop] += amount;
  Object.assign(p, { crop: null, progress: 0, withered: false });
  addXp(S, 1);
  Bus.fx('harvest', { i, amount });
  return done(`حصدت ${amount} ${C.name}` + (amount < C.yield ? ' (المخزن امتلأ)' : ''));
}

function actHarvestAll() {
  let n = 0, full = false;
  S.plots.forEach((p, i) => {
    if (p.crop && (p.progress >= 1 || p.withered)) {
      const r = actHarvest(i);
      if (r.ok) n++; else full = true;
    }
  });
  if (!n) return fail(full ? 'المخزن ممتلئ!' : 'لا يوجد محصول جاهز');
  return done(`حصدت ${n} أحواض` + (full ? ' — المخزن امتلأ' : ''));
}

function actBuyFeed(amount) {
  const price = feedPrice(S) * amount;
  const free = storageCap(S) - feedTotal(S);
  if (free < amount) return fail('لا توجد مساحة كافية في المخزن');
  if (S.money < price) return fail('لا يوجد مال كافٍ');
  S.money -= price;
  S.feed.grass += amount;
  return done(`اشتريت ${amount} علف بـ ${price}`);
}

function actCallVet(id) {
  const a = S.animals.find(x => x.id === id);
  if (!a || !a.disease) return fail('الحيوان ليس مريضاً');
  if (a.disease.diagnosed) return fail('تم التشخيص — يمكنك العلاج الآن');
  if (S.vetVisits.some(v => v.animalId === id)) return fail('الطبيب في الطريق');
  const fee = vetFee(S);
  if (S.money < fee) return fail('لا يوجد مال كافٍ لأجرة الطبيب');
  S.money -= fee;
  S.vetVisits.push({ animalId: id, arriveAt: S.time + GAME.VET_TRAVEL_DAYS, arrived: false });
  Bus.fx('vetCalled', a);
  return done(`🚑 الطبيب في الطريق (${fee})`);
}

function actTreat(id) {
  const a = S.animals.find(x => x.id === id);
  if (!a || !a.disease) return fail('الحيوان ليس مريضاً');
  if (!a.disease.diagnosed) return fail('اطلب الطبيب للفحص أولاً');
  const c = treatCost(S, a);
  if (S.money < c) return fail('لا يوجد مال كافٍ للعلاج');
  S.money -= c;
  const name = DISEASES[a.disease.id].name;
  a.disease = null;
  a.health = Math.min(100, a.health + 20);
  a.immuneUntil = S.time + 1;
  S.vetVisits = S.vetVisits.filter(v => v.animalId !== id);
  S.stats.treated++;
  addXp(S, 5);
  Bus.fx('treated', a);
  return done(`💊 تم علاج ${a.name} من ${name}`);
}

function canFulfill(s, lines) {
  return lines.every(l => countSellable(s, l.type, l.stage) >= l.count - (l.delivered || 0));
}

function actSellBuyer(bid) {
  const b = S.buyers.find(x => x.id === bid);
  if (!b) return fail('المشتري غادر');
  if (!canFulfill(S, b.lines)) return fail('لا تملك كل الحيوانات المطلوبة (كبيرة وسليمة)');
  let total = 0;
  for (const l of b.lines) { takeAnimals(S, l.type, l.stage, l.count); total += l.price * l.count; S.stats.sold += l.count; }
  S.buyers = S.buyers.filter(x => x !== b);
  S.stats.buyers++;
  earn(S, total);
  Bus.fx('money', { amount: total, at: 'saleyard' });
  return done(`🤝 بعت لـ ${b.name} بـ ${total}`);
}

function actDismissBuyer(bid) {
  S.buyers = S.buyers.filter(x => x.id !== bid);
  return done('اعتذرت من المشتري');
}

function actShipDeliver(idx) {
  const sh = S.ship;
  if (sh.state !== 'docked') return fail('السفينة غير موجودة');
  const l = sh.lines[idx];
  const need = l.count - l.delivered;
  if (need <= 0) return fail('تم تسليم هذا الطلب');
  const have = countSellable(S, l.type, l.stage);
  if (!have) return fail(`لا تملك ${ANIMALS[l.type].plural} ${l.stage === 'large' ? 'كبيرة' : 'متوسطة'} سليمة`);
  const n = Math.min(have, need);
  takeAnimals(S, l.type, l.stage, n);
  l.delivered += n;
  S.stats.sold += n;
  let total = n * l.price;
  let msg = `⛴️ سلّمت ${n} ${ANIMALS[l.type].plural} بـ ${total}`;
  if (sh.lines.every(x => x.delivered >= x.count)) {
    total += sh.bonus;
    S.stats.ships++;
    msg += ` + مكافأة ${sh.bonus}! السفينة أبحرت راضية`;
    sh.state = 'away';
    sh.nextAt = S.time + upVal(S, 'dock');
  }
  earn(S, total);
  Bus.fx('money', { amount: total, at: 'dock' });
  return done(msg);
}

function actUpgrade(key) {
  const U = UPGRADES[key];
  const lvl = S.upgrades[key];
  if (lvl >= U.levels.length - 1) return fail('وصلت لأعلى مستوى');
  const cost = U.levels[lvl + 1].cost;
  if (S.money < cost) return fail('لا يوجد مال كافٍ');
  S.money -= cost;
  S.upgrades[key]++;
  if (key === 'fields') syncPlots(S);
  addXp(S, Math.round(cost / 25));
  Bus.fx('upgrade', key);
  return done(`🔨 تم تطوير ${U.name}`);
}
