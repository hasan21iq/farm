// ============================================================
//  الواجهة: الشريط العلوي، الأزرار، النوافذ، الإشعارات، الأصوات
// ============================================================

// ------------------------------------------------------------
//  الأصوات (مولّدة بدون ملفات)
// ------------------------------------------------------------
const Sfx = (() => {
  let ac = null;
  function tone(freqs, dur = 0.12, type = 'sine', vol = 0.12) {
    if (!S || !S.settings.sound) return;
    try { ac = ac || new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return; }
    if (ac.state === 'suspended') ac.resume();
    const t0 = ac.currentTime;
    freqs.forEach((f, i) => {
      const o = ac.createOscillator(), g = ac.createGain();
      o.type = type; o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, t0 + i * dur);
      g.gain.exponentialRampToValueAtTime(vol, t0 + i * dur + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + (i + 1) * dur);
      o.connect(g).connect(ac.destination);
      o.start(t0 + i * dur); o.stop(t0 + (i + 1) * dur + 0.02);
    });
  }
  return {
    coin: () => tone([988, 1319], 0.08, 'square', 0.04),
    pop: () => tone([660], 0.07, 'sine', 0.1),
    click: () => tone([520], 0.04, 'sine', 0.05),
    good: () => tone([523, 659, 784], 0.09, 'triangle', 0.1),
    bad: () => tone([300, 200], 0.18, 'sawtooth', 0.04),
    level: () => tone([523, 659, 784, 1047], 0.1, 'triangle', 0.1),
    alert: () => tone([880, 660], 0.1, 'sine', 0.07),
    error: () => tone([220], 0.12, 'square', 0.04),
    howl: () => tone([392, 523, 587, 440], 0.22, 'sine', 0.09),
    hit: () => tone([180, 120], 0.05, 'square', 0.06),
    bang: () => tone([150, 90, 60], 0.08, 'sawtooth', 0.12),
  };
})();

// ------------------------------------------------------------
//  أدوات تنسيق
// ------------------------------------------------------------
const $ = sel => document.querySelector(sel);
const esc = s => String(s).replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
const money = n => Math.round(n).toLocaleString('en-US');

// تحويل أيام اللعبة إلى وقت حقيقي مقروء
function fmtReal(days) {
  let sec = Math.max(0, Math.round(days * GAME.DAY_MS / 1000));
  if (sec < 60) return `${sec} ث`;
  const m = Math.floor(sec / 60); sec %= 60;
  if (m < 10) return `${m}د ${sec}ث`;
  if (m < 60) return `${m} د`;
  return `${Math.floor(m / 60)}س ${m % 60}د`;
}
function fmtClock(s) {
  const h = hourOf(s);
  const hh = Math.floor(h), mm = Math.floor((h - hh) * 60 / 10) * 10;
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}
function bar(v, cls = '') {
  const col = v > 60 ? 'good' : v > 30 ? 'mid' : 'low';
  return `<div class="bar ${cls}"><i class="${col}" style="width:${clamp(v, 0, 100)}%"></i></div>`;
}
function btn(label, act, a = '', b = '', cls = '', disabled = false) {
  return `<button class="btn ${cls}" data-act="${act}" data-a="${esc(a)}" data-b="${esc(b)}" ${disabled ? 'disabled' : ''}>${label}</button>`;
}

// ------------------------------------------------------------
//  حالة الواجهة
// ------------------------------------------------------------
const UI = {
  panel: null, param: null, lastHtml: '', pressing: false,
  tabs: { animals: 'mine', sale: 'buyers' },
  crop: 'grass',
  confirm: null,
  toastCount: 0,
};

const PANELS = {};

// ------------------------------------------------------------
//  لوحة الحيوانات
// ------------------------------------------------------------
PANELS.animals = {
  title: () => '🐄 الحيوانات',
  render() {
    const tab = UI.tabs.animals;
    let h = `<div class="tabs">
      ${btn(`حيواناتي (${S.animals.length})`, 'tab', 'animals', 'mine', tab === 'mine' ? 'on' : '')}
      ${btn('🛒 سوق الحيوانات', 'tab', 'animals', 'shop', tab === 'shop' ? 'on' : '')}
    </div>`;
    const used = spaceUsed(S), cap = barnCapacity(S);
    h += `<div class="info-row">
      <div class="pill">🏠 الحظيرة: <b>${used}/${cap}</b></div>
      <div class="pill">🧹 النظافة: <b>${Math.round(S.cleanliness)}%</b></div>
    </div>`;
    if (tab === 'mine') {
      h += `<div class="row-btns">
        ${btn(`🌾 إطعام الكل`, 'feedAll', '', '', 'green')}
        ${btn(`🧹 تنظيف (${cleanCost(S)}💰)`, 'clean', '', '', S.cleanliness < 50 ? 'orange' : '')}
      </div>`;
      if (!S.animals.length) h += `<p class="empty">لا توجد حيوانات. اشترِ من السوق 🛒</p>`;
      const order = a => (a.disease ? 0 : a.hunger < 30 ? 1 : a.stage === 'large' ? 2 : 3);
      const list = [...S.animals].sort((x, y) => order(x) - order(y) || y.id - x.id);
      h += `<div class="cards">`;
      for (const a of list) {
        const T = ANIMALS[a.type];
        h += `<div class="card animal ${a.disease ? 'sick' : ''}" data-act="animal" data-a="${a.id}">
          <canvas class="portrait" data-portrait="${a.type}|${a.stage}|${a.disease ? 1 : 0}"></canvas>
          <div class="meta">
            <div class="name">${esc(a.name)} ${a.disease ? '🤒' : a.stage === 'large' ? '✅' : ''}</div>
            <div class="sub">${T.name} · ${STAGE_NAMES[a.stage]}</div>
            <div class="mini"><span>❤️</span>${bar(a.health)}</div>
            <div class="mini"><span>🌾</span>${bar(a.hunger)}</div>
            <div class="val">💰 ${money(animalValue(a))}</div>
          </div>
        </div>`;
      }
      h += `</div>`;
    } else {
      for (const [type, T] of Object.entries(ANIMALS)) {
        h += `<div class="shop-type"><div class="shop-head"><span class="big">${T.icon}</span> <b>${T.plural}</b> <small>· مساحة ${T.space} لكل حيوان</small></div>`;
        if (!S.unlocked[type]) {
          const lvlOk = S.level >= T.unlock.level;
          h += `<div class="locked">🔒 ${lvlOk ? `افتح تربية ${T.plural}` : `يُفتح في المستوى ${T.unlock.level}`}
            ${btn(`فتح (${money(T.unlock.cost)}💰)`, 'unlock', type, '', 'gold', !lvlOk || S.money < T.unlock.cost)}</div>`;
        } else {
          for (const st of STAGES) {
            const d = T.stages[st];
            const grow = st === 'small' ? d.grow + T.stages.medium.grow : st === 'medium' ? d.grow : 0;
            h += `<div class="shop-row">
              <canvas class="portrait sm" data-portrait="${type}|${st}|0"></canvas>
              <div class="meta">
                <b>${STAGE_NAMES[st]}</b>
                <small>علف ${d.feed}/يوم · ${grow ? `يكبر خلال ~${fmtReal(grow)}` : 'جاهز للبيع'} · قيمته ${money(d.sell)}</small>
              </div>
              ${btn(`${money(d.buy)}💰`, 'buy', type, st, 'gold', S.money < d.buy || spaceUsed(S) + T.space > barnCapacity(S))}
            </div>`;
          }
        }
        h += `</div>`;
      }
      h += `<p class="hint">💡 الصغير رخيص لكنه يحتاج وقتاً وعلفاً. الكبير غالٍ لكنه جاهز للبيع فوراً.</p>`;
    }
    return h;
  },
};

// ------------------------------------------------------------
//  نافذة تفاصيل حيوان
// ------------------------------------------------------------
PANELS.animal = {
  title: () => {
    const a = S.animals.find(x => x.id === UI.param);
    return a ? `${ANIMALS[a.type].icon} ${esc(a.name)}` : 'الحيوان';
  },
  render() {
    const a = S.animals.find(x => x.id === UI.param);
    if (!a) return `<p class="empty">هذا الحيوان لم يعد في المزرعة.</p>`;
    const T = ANIMALS[a.type];
    const trader = Math.round(animalValue(a) * GAME.TRADER_RATE);
    const toAdult = daysToAdult(a);
    const nx = NEXT_STAGE[a.stage];
    const stageProg = nx ? Math.round(clamp(a.stageAge / T.stages[a.stage].grow, 0, 1) * 100) : 100;
    let h = `<div class="detail">
      <canvas class="portrait xl" data-portrait="${a.type}|${a.stage}|${a.disease ? 1 : 0}"></canvas>
      <div class="status ${a.disease ? 'bad' : a.hunger < 30 ? 'warn' : 'ok'}">${animalStatus(a)}</div>
    </div>
    <table class="stats">
      <tr><td>النوع</td><td>${T.name}</td></tr>
      <tr><td>العمر</td><td>${STAGE_NAMES[a.stage]}${nx ? ` <small>(${stageProg}% نحو ${STAGE_NAMES[nx]})</small>` : ''}</td></tr>
      <tr><td>الصحة</td><td>${bar(a.health)} <small>${Math.round(a.health)}%</small></td></tr>
      <tr><td>الشبع</td><td>${bar(a.hunger)} <small>${Math.round(a.hunger)}%</small></td></tr>
      <tr><td>العمر المطلوب للبيع</td><td>${a.stage === 'large' ? '✅ جاهز للبيع' : `كبير — بعد ~${fmtReal(toAdult)}`}</td></tr>
      <tr><td>قيمة البيع</td><td><b>💰 ${money(animalValue(a))}</b> <small>(التاجر: ${money(trader)})</small></td></tr>
      <tr><td>الأكل اليومي</td><td>${T.stages[a.stage].feed} علف</td></tr>
      ${a.disease ? `<tr><td>المرض</td><td>${a.disease.diagnosed ? `${DISEASES[a.disease.id].name} — ${SEVERITY_NAMES[a.disease.severity]}` : 'غير معروف — يحتاج فحص'}</td></tr>` : ''}
    </table>
    <div class="row-btns">
      ${btn('🌾 إطعام', 'feed', a.id, '', 'green', a.hunger > 95)}`;
    if (a.disease) {
      const visit = S.vetVisits.find(v => v.animalId === a.id);
      if (a.disease.diagnosed) h += btn(`💊 علاج (${money(treatCost(S, a))}💰)`, 'treat', a.id, '', 'red');
      else if (visit) h += btn(`🚑 الطبيب قادم...`, 'noop', '', '', '', true);
      else h += btn(`🩺 اطلب الطبيب (${vetFee(S)}💰)`, 'callVet', a.id, '', 'red');
    }
    const confirming = UI.confirm === `sell-${a.id}`;
    h += btn(confirming ? `تأكيد البيع بـ ${money(trader)}؟` : `🏷️ بيع للتاجر`, 'sellTrader', a.id, '', confirming ? 'orange' : '');
    h += `</div>`;
    if (a.stage === 'large' && !a.disease) h += `<p class="hint">💡 المشترون في ساحة البيع والسفينة يدفعون أكثر من التاجر بكثير.</p>`;
    return h;
  },
};

// ------------------------------------------------------------
//  الزراعة
// ------------------------------------------------------------
PANELS.farm = {
  title: () => '🌱 الزراعة',
  render() {
    let h = `<div class="chips">`;
    for (const [k, C] of Object.entries(CROPS)) {
      const locked = S.level < C.level;
      h += `<button class="chip ${UI.crop === k ? 'on' : ''} ${locked ? 'locked' : ''}" data-act="crop" data-a="${k}" ${locked ? 'disabled' : ''}>
        <span class="big">${C.icon}</span><b>${C.name}</b>
        <small>${locked ? `🔒 مستوى ${C.level}` : `${C.seed}💰 · ${fmtReal(C.days)} · +${C.yield}`}</small>
      </button>`;
    }
    h += `</div>`;
    const C = CROPS[UI.crop];
    h += `<div class="row-btns">
      ${btn(`زراعة الكل ${C.icon}`, 'plantAll', UI.crop, '', 'green')}
      ${btn('🧺 حصاد الكل', 'harvestAll', '', '', 'gold')}
    </div>
    <div class="pill wide">🏚️ المخزن: <b>${Math.floor(feedTotal(S))}/${storageCap(S)}</b></div>
    <div class="plots">`;
    S.plots.forEach((p, i) => {
      let inner, act = 'plot';
      if (!p.crop) inner = `<span class="big faded">＋</span><small>ازرع ${C.name}</small>`;
      else if (p.withered) inner = `<span class="big">🥀</span><small>ذابل — إزالة</small>`;
      else if (p.progress >= 1) inner = `<span class="big bounce">${CROPS[p.crop].icon}</span><small><b>احصد!</b></small>`;
      else {
        const left = (1 - p.progress) * CROPS[p.crop].days / eventMods(S).crop;
        inner = `<span class="big">${CROPS[p.crop].icon}</span>${bar(p.progress * 100, 'thin')}<small>${fmtReal(left)}</small>`;
      }
      h += `<button class="plot ${p.crop && p.progress >= 1 && !p.withered ? 'ready' : ''}" data-act="${act}" data-a="${i}">${inner}</button>`;
    });
    h += `</div><p class="hint">💡 المحصول الجاهز يذبل إذا تُرك أكثر من ${fmtReal(GAME.CROP_WITHER_DAYS)}. يمكنك أيضاً اللمس على الأحواض في المزرعة مباشرة.</p>`;
    return h;
  },
};

// ------------------------------------------------------------
//  المخزن
// ------------------------------------------------------------
PANELS.storage = {
  title: () => '🏚️ مخزن العلف',
  render() {
    const total = feedTotal(S), cap = storageCap(S);
    const daily = S.animals.reduce((t, a) => t + ANIMALS[a.type].stages[a.stage].feed, 0);
    let h = `<div class="big-stat">${Math.floor(total)} <small>/ ${cap}</small></div>
      ${bar(total / cap * 100, 'thick')}
      <div class="info-row">
        <div class="pill">🍽️ الاستهلاك: <b>${daily.toFixed(1)}</b>/يوم</div>
        <div class="pill">⏳ يكفي: <b>${daily ? fmtReal(total / daily) : '∞'}</b></div>
      </div>
      <div class="feed-list">`;
    for (const k of FEED_ORDER) {
      const C = CROPS[k];
      h += `<div class="feed-item"><span class="big">${C.icon}</span><b>${C.name}</b><span>${Math.floor(S.feed[k])}</span></div>`;
    }
    h += `</div><h3>🛒 شراء علف جاهز من السوق</h3>
      <p class="hint">السعر الحالي: ${feedPrice(S)}💰 للوحدة ${eventMods(S).feedPrice > 1 ? '<b class="red">(غلاء!)</b>' : ''} — الزراعة أرخص بكثير.</p>
      <div class="row-btns">`;
    for (const n of [10, 25, 50]) h += btn(`+${n} (${n * feedPrice(S)}💰)`, 'buyFeed', n, '', 'gold', S.money < n * feedPrice(S) || cap - total < n);
    h += `</div>`;
    if (daily > 0 && total / daily < 0.5) h += `<p class="warn-box">⚠️ العلف لا يكفي! ازرع الآن أو اشترِ من السوق، وإلا ستجوع الحيوانات.</p>`;
    return h;
  },
};

// ------------------------------------------------------------
//  البيع
// ------------------------------------------------------------
function linesHtml(lines, withDelivered) {
  return lines.map(l => {
    const need = l.count - (withDelivered ? l.delivered : 0);
    const have = countSellable(S, l.type, l.stage);
    const ok = have >= need;
    return `<div class="req ${ok ? 'ok' : ''}">
      <span class="big">${ANIMALS[l.type].icon}</span>
      <span>${withDelivered ? `${l.delivered}/${l.count}` : l.count} × ${animalLabel(l.type, l.stage)}</span>
      <small>لديك ${have}</small>
      <b>${money(l.price)}💰/واحد</b>
    </div>`;
  }).join('');
}

PANELS.sale = {
  title: () => '🤝 ساحة البيع',
  render() {
    const tab = UI.tabs.sale;
    let h = `<div class="tabs">
      ${btn(`المشترون (${S.buyers.length}/${upVal(S, 'saleyard')})`, 'tab', 'sale', 'buyers', tab === 'buyers' ? 'on' : '')}
      ${btn('🏷️ التاجر (بيع سريع)', 'tab', 'sale', 'trader', tab === 'trader' ? 'on' : '')}
    </div>`;
    if (tab === 'buyers') {
      if (!S.buyers.length) h += `<p class="empty">لا يوجد مشترون الآن.<br>المشتري القادم بعد ~${fmtReal(Math.max(0, S.nextBuyerAt - S.time))}</p>`;
      for (const b of S.buyers) {
        const total = b.lines.reduce((t, l) => t + l.price * l.count, 0);
        const ok = canFulfill(S, b.lines);
        const left = clamp((b.leaveAt - S.time) / (b.leaveAt - b.arrivedAt), 0, 1) * 100;
        h += `<div class="order">
          <div class="order-head"><b>🧑‍🌾 ${esc(b.name)}</b><small>يغادر بعد ${fmtReal(b.leaveAt - S.time)}</small></div>
          ${bar(left, 'thin timer')}
          ${linesHtml(b.lines, false)}
          <div class="row-btns">
            ${btn(`بيع بـ ${money(total)}💰`, 'sellBuyer', b.id, '', 'green', !ok)}
            ${btn('رفض', 'dismiss', b.id, '', 'ghost')}
          </div>
        </div>`;
      }
      h += `<p class="hint">💡 المشترون يقبلون فقط الحيوانات السليمة (غير مريضة وصحتها فوق 40%).</p>`;
    } else {
      h += `<p class="hint">التاجر يشتري أي حيوان فوراً لكن بـ ${Math.round(GAME.TRADER_RATE * 100)}% فقط من قيمته.</p>`;
      const list = [...S.animals].sort((x, y) => animalValue(y) - animalValue(x));
      if (!list.length) h += `<p class="empty">لا توجد حيوانات</p>`;
      for (const a of list) {
        const p = Math.round(animalValue(a) * GAME.TRADER_RATE);
        const confirming = UI.confirm === `sell-${a.id}`;
        h += `<div class="shop-row">
          <canvas class="portrait sm" data-portrait="${a.type}|${a.stage}|${a.disease ? 1 : 0}"></canvas>
          <div class="meta"><b>${esc(a.name)}</b><small>${animalLabel(a.type, a.stage)} · صحة ${Math.round(a.health)}%</small></div>
          ${btn(confirming ? 'تأكيد؟' : `${money(p)}💰`, 'sellTrader', a.id, '', confirming ? 'orange' : 'gold')}
        </div>`;
      }
    }
    return h;
  },
};

// ------------------------------------------------------------
//  السفينة
// ------------------------------------------------------------
PANELS.ship = {
  title: () => '⛴️ السفينة',
  render() {
    const sh = S.ship;
    if (sh.state !== 'docked') {
      return `<div class="ship-away"><span class="huge">🌊</span>
        <p>السفينة في البحر.</p>
        <div class="big-stat">${fmtReal(sh.nextAt - S.time)}</div><p>حتى وصولها القادم</p></div>
        <p class="hint">💡 جهّز حيوانات كبيرة وسليمة قبل وصول السفينة — طلباتها كبيرة وتدفع أعلى الأسعار مع مكافأة.</p>
        <p class="hint">⚓ طوّر الميناء لتأتي السفينة أسرع وتدفع أكثر.</p>`;
    }
    let h = `<div class="order ship">
      <div class="order-head"><b>⛴️ طلب السفينة</b><small>تبحر بعد ${fmtReal(sh.leaveAt - S.time)}</small></div>
      ${bar((sh.leaveAt - S.time) * 100, 'thin timer')}`;
    sh.lines.forEach((l, i) => {
      const done = l.delivered >= l.count;
      h += linesHtml([l], true);
      h += `<div class="row-btns tight">${done ? '<span class="done">✅ تم التسليم</span>' : btn('تسليم المتوفر', 'deliver', i, '', 'green', countSellable(S, l.type, l.stage) === 0)}</div>`;
    });
    h += `<div class="bonus">🎁 مكافأة إكمال الطلب كاملاً: <b>${money(sh.bonus)}💰</b></div></div>
      <p class="hint">💡 تستطيع التسليم على دفعات. المكافأة تُصرف عند إكمال كل الطلب قبل مغادرة السفينة.</p>`;
    return h;
  },
};

// ------------------------------------------------------------
//  الطبيب
// ------------------------------------------------------------
PANELS.vet = {
  title: () => '🩺 الطبيب البيطري',
  render() {
    const sick = S.animals.filter(a => a.disease).sort((x, y) => x.health - y.health);
    let h = `<div class="info-row">
      <div class="pill">🚑 أجرة الزيارة: <b>${vetFee(S)}💰</b></div>
      <div class="pill">🏥 العيادة: مستوى ${S.upgrades.clinic}</div>
    </div>`;
    if (!sick.length) h += `<p class="empty">✅ كل الحيوانات بصحة جيدة</p>`;
    for (const a of sick) {
      const T = ANIMALS[a.type];
      const visit = S.vetVisits.find(v => v.animalId === a.id);
      let action;
      if (a.disease.diagnosed) action = btn(`💊 علاج (${money(treatCost(S, a))}💰)`, 'treat', a.id, '', 'red');
      else if (visit) action = btn(`🚑 قادم خلال ${fmtReal(visit.arriveAt - S.time)}`, 'noop', '', '', '', true);
      else action = btn(`🩺 اطلب الطبيب`, 'callVet', a.id, '', 'red');
      h += `<div class="shop-row sick">
        <canvas class="portrait sm" data-portrait="${a.type}|${a.stage}|1"></canvas>
        <div class="meta">
          <b>${esc(a.name)} <small>(${animalLabel(a.type, a.stage)})</small></b>
          <small>${a.disease.diagnosed ? `${DISEASES[a.disease.id].name} · ${SEVERITY_NAMES[a.disease.severity]}` : 'مرض غير معروف — يحتاج فحص'}</small>
          <div class="mini"><span>❤️</span>${bar(a.health)}</div>
        </div>
        ${action}
      </div>`;
    }
    const used = spaceUsed(S), cap = barnCapacity(S);
    h += `<h3>عوامل خطر المرض</h3><ul class="risks">
      <li class="${S.cleanliness < 50 ? 'bad' : ''}">🧹 النظافة: ${Math.round(S.cleanliness)}% ${S.cleanliness < 50 ? '— نظّف الحظيرة!' : ''}</li>
      <li class="${used / cap > 0.75 ? 'bad' : ''}">🏠 الازدحام: ${used}/${cap} ${used / cap > 0.75 ? '— الحظيرة مزدحمة' : ''}</li>
      <li class="${S.animals.some(a => a.hunger < 30) ? 'bad' : ''}">🌾 الجوع: ${S.animals.filter(a => a.hunger < 30).length} حيوان جائع</li>
    </ul>
    <p class="hint">💡 المرض يسوء كل ${fmtReal(GAME.DISEASE_STEP_DAYS)} بدون علاج، وكلما اشتد صار العلاج أغلى والحيوان أقرب للموت.</p>`;
    return h;
  },
};

// ------------------------------------------------------------
//  التطوير
// ------------------------------------------------------------
PANELS.upgrades = {
  title: () => '🔨 تطوير المزرعة',
  render() {
    let h = `<div class="level-box">⭐ المستوى <b>${S.level}</b> ${bar(S.xp / xpForLevel(S.level) * 100, 'thin xp')}<small>${S.xp}/${xpForLevel(S.level)} خبرة</small></div>`;
    for (const [k, U] of Object.entries(UPGRADES)) {
      const lvl = S.upgrades[k];
      const cur = U.levels[lvl], next = U.levels[lvl + 1];
      h += `<div class="upgrade">
        <span class="huge">${U.icon}</span>
        <div class="meta">
          <b>${U.name} <small>مستوى ${lvl + 1}/${U.levels.length}</small></b>
          <small>${U.desc}</small>
          <small class="now">الآن: ${U.fmt(cur.v, cur)}${next ? ` ← <b>${U.fmt(next.v, next)}</b>` : ''}</small>
        </div>
        ${next ? btn(`${money(next.cost)}💰`, 'upgrade', k, '', 'gold', S.money < next.cost) : '<span class="done">الأعلى ✔</span>'}
      </div>`;
    }
    h += `<p class="hint">💡 لفتح حيوانات جديدة اذهب إلى 🐄 الحيوانات ← سوق الحيوانات.</p>`;
    return h;
  },
};

// ------------------------------------------------------------
//  الإعدادات والسجل
// ------------------------------------------------------------
PANELS.menu = {
  title: () => '⚙️ القائمة',
  render() {
    const st = S.stats;
    let h = `<h3>📊 الإحصائيات</h3>
    <div class="stat-grid">
      <div><b>${dayNumber(S)}</b><small>اليوم</small></div>
      <div><b>${money(st.earned)}</b><small>إجمالي الأرباح</small></div>
      <div><b>${st.sold}</b><small>حيوان مُباع</small></div>
      <div><b>${st.buyers}</b><small>مشترٍ راضٍ</small></div>
      <div><b>${st.ships}</b><small>سفينة مكتملة</small></div>
      <div><b>${st.treated}</b><small>حالة علاج</small></div>
      <div><b>${st.died}</b><small>حيوان نافق</small></div>
      <div><b>${st.repelled}</b><small>مفترس مطرود</small></div>
      <div><b>${st.eaten}</b><small>ضحية مفترس</small></div>
      <div><b>${S.animals.length}</b><small>حيوان حالياً</small></div>
    </div>
    <div class="row-btns">
      ${btn(S.settings.sound ? '🔊 الصوت: يعمل' : '🔇 الصوت: مطفأ', 'sound')}
      ${btn('❓ طريقة اللعب', 'help')}
      ${btn('🧪 اختبار: هجوم مفترس', 'testRaid', '', '', 'red')}
    </div>
    <h3>📜 آخر الأحداث</h3><div class="log">`;
    for (const l of S.log.slice(0, 40)) h += `<div class="log-item ${l.k}"><small>ي${l.d} ${l.h}</small> ${esc(l.m)}</div>`;
    if (!S.log.length) h += `<p class="empty">لا توجد أحداث بعد</p>`;
    const confirming = UI.confirm === 'reset';
    h += `</div><div class="row-btns">${btn(confirming ? '⚠️ اضغط مرة أخرى لحذف كل التقدم' : '🗑️ بدء لعبة جديدة', 'reset', '', '', confirming ? 'red' : 'ghost')}</div>`;
    return h;
  },
};

PANELS.help = {
  title: () => '👋 أهلاً بك في مزرعتك!',
  render() {
    return `<div class="help">
      <p>ابدأ بمزرعة صغيرة وطوّرها لتصبح أكبر مزرعة في المنطقة!</p>
      <ul>
        <li>🐄 <b>اشترِ الحيوانات</b> صغيرة (رخيصة وتحتاج وقتاً) أو كبيرة (غالية وجاهزة للبيع).</li>
        <li>🌱 <b>ازرع العلف</b> في الحقول واحصده إلى المخزن. المس الحوض لتزرع أو تحصد.</li>
        <li>🌾 <b>أطعم الحيوانات</b> بزر "إطعام الكل". الجوع يوقف النمو ويضر الصحة.</li>
        <li>🤒 <b>المرض:</b> عندما تظهر علامة المرض اطلب الطبيب ثم عالج الحيوان قبل أن ينفق.</li>
        <li>🧹 <b>النظافة والازدحام</b> يزيدان الأمراض — نظّف الحظيرة باستمرار.</li>
        <li>🐺 <b>المفترسات</b> (ثعلب، ذئب، ضبع) تهاجم ليلاً! <b>المسها بسرعة</b> لطردها، أو استخدم 🧨 المفرقعات. طوّر السياج 🚧 واشترِ كلب حراسة 🐕 وركّب الإنارة 💡.</li>
        <li>🤝 <b>بع للمشترين</b> في ساحة البيع قبل أن يغادروا، وجهّز طلبات <b>السفينة ⛴️</b> الكبيرة.</li>
        <li>🔨 <b>طوّر</b> الحظيرة والحقول والمخزن وافتح حيوانات جديدة.</li>
        <li>🕐 يوم اللعبة = ${Math.round(GAME.DAY_MS / 60000)} دقائق. اللعبة تُحفظ تلقائياً وتعمل بدون إنترنت.</li>
        <li>👆 اسحب بإصبع لتتحرك في المزرعة، وبإصبعين للتكبير.</li>
      </ul>
      ${btn('يلا نبدأ! 🚜', 'closeHelp', '', '', 'green wide')}
    </div>`;
  },
};

PANELS.away = {
  title: () => '🌙 أثناء غيابك',
  render() {
    const d = UI.param || { days: 0, msgs: [] };
    let h = `<p>مرّ على المزرعة <b>${fmtReal(d.days)}</b> من وقت اللعب${d.capped ? ' (الحد الأقصى المحسوب)' : ''}.</p>
      <p class="hint">أثناء الإغلاق لا تظهر أمراض جديدة ولا تهاجم المفترسات ولا تنفق الحيوانات، لكنها تجوع وتكبر والمحاصيل تنمو.</p><div class="log">`;
    const msgs = d.msgs.slice(-25).reverse();
    for (const m of msgs) h += `<div class="log-item ${m.k}">${esc(m.m)}</div>`;
    if (!msgs.length) h += `<p class="empty">لم يحدث شيء مهم</p>`;
    h += `</div>${btn('متابعة', 'close', '', '', 'green wide')}`;
    return h;
  },
};

// ------------------------------------------------------------
//  فتح/إغلاق/تحديث النافذة
// ------------------------------------------------------------
function openPanel(name, param) {
  if (UI.panel !== name) $('#sheet-body').scrollTop = 0;
  UI.panel = name; UI.param = param; UI.confirm = null; UI.lastHtml = '';
  View.selected = name === 'animal' ? param : null;
  if (name === 'animal') {
    const act = View.actors.get(param);
    if (act) focusOn(act.x, act.y + (View.h / 2 - 170) / View.cam.zoom);
  }
  $('#sheet').classList.add('open');
  document.querySelectorAll('#bottombar button').forEach(b => b.classList.toggle('on', b.dataset.panel === name));
  renderPanel(true);
}

function closePanel() {
  if (UI.panel === 'help') S.tutorialDone = true;
  UI.panel = null; View.selected = null; UI.confirm = null;
  $('#sheet').classList.remove('open');
  document.querySelectorAll('#bottombar button').forEach(b => b.classList.remove('on'));
}

function renderPanel(force) {
  if (!UI.panel) return;
  if (UI.pressing && !force) return;
  const P = PANELS[UI.panel];
  const html = P.render();
  $('#sheet-title').innerHTML = P.title();
  if (html === UI.lastHtml) return;
  UI.lastHtml = html;
  const body = $('#sheet-body');
  const st = body.scrollTop;
  body.innerHTML = html;
  body.scrollTop = st;
  body.querySelectorAll('canvas[data-portrait]').forEach(cv => {
    const [type, stage, sick] = cv.dataset.portrait.split('|');
    animalPortrait(cv, type, stage, sick === '1');
  });
}

// ------------------------------------------------------------
//  الأفعال من الأزرار
// ------------------------------------------------------------
const ACTIONS = {
  tab: (p, t) => { UI.tabs[p] = t; },
  animal: id => { openPanel('animal', +id); return 'nav'; },
  buy: (t, st) => actBuyAnimal(t, st),
  unlock: t => actUnlock(t),
  feed: id => actFeed(+id),
  feedAll: () => actFeedAll(),
  clean: () => actClean(),
  sellTrader: id => {
    if (UI.confirm !== `sell-${id}`) { UI.confirm = `sell-${id}`; return; }
    UI.confirm = null;
    const r = actSellTrader(+id);
    if (r.ok && UI.panel === 'animal') closePanel();
    return r;
  },
  crop: k => { UI.crop = k; },
  plot: i => plotAction(+i),
  plantAll: k => actPlantAll(k),
  harvestAll: () => actHarvestAll(),
  buyFeed: n => actBuyFeed(+n),
  callVet: id => actCallVet(+id),
  treat: id => actTreat(+id),
  sellBuyer: id => actSellBuyer(+id),
  dismiss: id => actDismissBuyer(+id),
  deliver: i => actShipDeliver(+i),
  upgrade: k => actUpgrade(k),
  firecracker: () => actFirecracker(),
  // زر اختبار: يستدعي مفترساً فوراً بدون انتظار الليل
  testRaid: () => {
    if (!S.animals.length) return fail('لا توجد حيوانات ليهاجمها المفترس');
    spawnRaid(S);
    closePanel();
    setTimeout(focusRaid, 50);
    return 'nav';
  },
  sound: () => { S.settings.sound = !S.settings.sound; },
  help: () => { openPanel('help'); return 'nav'; },
  closeHelp: () => { S.tutorialDone = true; closePanel(); return 'nav'; },
  close: () => { closePanel(); return 'nav'; },
  reset: () => {
    if (UI.confirm !== 'reset') { UI.confirm = 'reset'; return; }
    resetGame(); View.actors.clear(); View.bgKey = ''; closePanel();
    toast('بدأت مزرعة جديدة 🌱', 'good');
    openPanel('help');
    return 'nav';
  },
  noop: () => {},
};

function plotAction(i) {
  const p = S.plots[i];
  if (!p) return;
  if (!p.crop) return actPlant(i, UI.crop);
  if (p.withered || p.progress >= 1) return actHarvest(i);
  return fail(`${CROPS[p.crop].name} ينضج بعد ${fmtReal((1 - p.progress) * CROPS[p.crop].days / eventMods(S).crop)}`);
}

function runAction(name, a, b) {
  const fn = ACTIONS[name];
  if (!fn) return;
  if (!name.startsWith('sellTrader') && name !== 'reset') UI.confirm = null;
  const r = fn(a, b);
  if (r && r !== 'nav') {
    if (r.msg) toast(r.msg, r.ok ? 'good' : 'bad');
    if (r.ok) Sfx.click(); else Sfx.error();
    saveGame();
  } else if (r !== 'nav') Sfx.click();
  updateHud();
  renderPanel(true);
}

// ------------------------------------------------------------
//  الإشعارات والشريط العلوي
// ------------------------------------------------------------
function toast(msg, kind = 'info') {
  const box = $('#toasts');
  const el = document.createElement('div');
  el.className = `toast ${kind}`;
  el.textContent = msg;
  box.prepend(el);
  while (box.children.length > 4) box.lastChild.remove();
  setTimeout(() => el.classList.add('out'), 3200);
  setTimeout(() => el.remove(), 3700);
}

function logMsg(msg, kind) {
  S.log.unshift({ m: msg, k: kind, d: dayNumber(S), h: fmtClock(S) });
  if (S.log.length > 60) S.log.length = 60;
}

function onNotify(msg, kind) {
  logMsg(msg, kind);
  if (kind === 'day') return;
  toast(msg, { good: 'good', level: 'gold', bad: 'bad', dead: 'bad', sick: 'bad', raid: 'bad', event: 'gold', ship: 'blue', buyer: 'blue', vet: 'blue' }[kind] || 'info');
  if (['sick', 'bad', 'ship', 'buyer', 'event', 'raid'].includes(kind)) Sfx.alert();
}

function updateHud() {
  $('#hud-money').textContent = money(S.money);
  const ft = feedTotal(S), cap = storageCap(S);
  $('#hud-feed').textContent = `${Math.floor(ft)}/${cap}`;
  $('#hud-feed').parentElement.classList.toggle('warn', S.animals.length > 0 && ft < 5);
  $('#hud-clock').textContent = `${isNight(S) ? '🌙' : '☀️'} يوم ${dayNumber(S)} · ${fmtClock(S)}`;
  $('#hud-level').textContent = S.level;
  $('#hud-xp').style.width = `${S.xp / xpForLevel(S.level) * 100}%`;
  const evEl = $('#event');
  if (S.event && S.time < S.event.until) {
    const ev = EVENTS.find(e => e.id === S.event.id);
    evEl.innerHTML = `${ev.icon} <b>${ev.name}</b> · ${fmtReal(S.event.until - S.time)}`;
    evEl.title = ev.desc;
    evEl.classList.add('show');
  } else evEl.classList.remove('show');
  updateRaidAlert();

  // شارات الأزرار
  const sick = S.animals.filter(a => a.disease).length;
  const hungry = S.animals.filter(a => a.hunger < 30).length;
  const ready = S.plots.filter(p => p.crop && (p.progress >= 1 || p.withered)).length;
  const buyersOk = S.buyers.filter(b => canFulfill(S, b.lines)).length;
  setBadge('animals', hungry, 'orange');
  setBadge('farm', ready, 'green');
  setBadge('storage', ft < 5 && S.animals.length ? '!' : 0, 'red');
  setBadge('sale', S.buyers.length, buyersOk ? 'green' : 'blue');
  setBadge('ship', S.ship.state === 'docked' ? '!' : 0, 'blue');
  setBadge('vet', sick, 'red');
  const canUp = Object.entries(UPGRADES).some(([k, U]) => U.levels[S.upgrades[k] + 1] && S.money >= U.levels[S.upgrades[k] + 1].cost);
  setBadge('upgrades', canUp ? '↑' : 0, 'gold');
  const qf = $('#quick-feed');
  qf.classList.toggle('pulse', hungry > 0);
  qf.querySelector('.badge').textContent = hungry || '';
  qf.querySelector('.badge').style.display = hungry ? '' : 'none';
}

// تنبيه الهجوم: المس النص للانتقال إلى المفترس
const RAID_PHASE_TEXT = { approach: 'يقترب من الحظيرة', fence: 'عند السياج!', inside: 'داخل الحظيرة!' };
function updateRaidAlert() {
  const el = $('#raid');
  const r = activeRaids(S)[0];
  el.classList.toggle('show', !!r);
  if (!r) return;
  const P = PREDATORS[r.type];
  el.querySelector('.txt').textContent = `${P.icon} ${P.name} ${RAID_PHASE_TEXT[r.phase]} المسه لطرده 👆`;
  el.querySelector('.fc b').textContent = GAME.FIRECRACKER_COST;
  el.querySelector('.fc').disabled = S.money < GAME.FIRECRACKER_COST;
}

function focusRaid() {
  const r = activeRaids(S)[0];
  const p = r && View.preds.get(r.id);
  if (!p) return;
  closePanel();
  focusOn(Math.max(p.x, View.w / 2 / View.cam.zoom - 60), p.y);
}

function setBadge(panel, val, color) {
  const b = document.querySelector(`#bottombar [data-panel="${panel}"] .badge`);
  if (!b) return;
  b.textContent = val || '';
  b.className = `badge ${color}`;
  b.style.display = val ? '' : 'none';
}

// ------------------------------------------------------------
//  التهيئة
// ------------------------------------------------------------
function initUI() {
  Bus.notify = onNotify;
  document.querySelectorAll('#bottombar button').forEach(b => {
    b.addEventListener('click', () => {
      Sfx.click();
      if (UI.panel === b.dataset.panel) closePanel(); else openPanel(b.dataset.panel);
    });
  });
  $('#sheet-close').addEventListener('click', closePanel);
  $('#menu-btn').addEventListener('click', () => openPanel('menu'));
  $('#hud-money').parentElement.addEventListener('click', () => openPanel('upgrades'));
  $('#hud-feed').parentElement.addEventListener('click', () => openPanel('storage'));
  $('#quick-feed').addEventListener('click', () => runAction('feedAll'));
  $('#raid').addEventListener('click', e => {
    if (e.target.closest('.fc')) runAction('firecracker'); else focusRaid();
  });
  const body = $('#sheet-body');
  body.addEventListener('pointerdown', () => { UI.pressing = true; });
  window.addEventListener('pointerup', () => { UI.pressing = false; });
  window.addEventListener('pointercancel', () => { UI.pressing = false; });
  body.addEventListener('click', e => {
    const el = e.target.closest('[data-act]');
    if (!el || el.disabled) return;
    runAction(el.dataset.act, el.dataset.a, el.dataset.b);
  });
  // سحب النافذة للأسفل لإغلاقها
  const head = $('#sheet-head');
  let sy = null;
  head.addEventListener('pointerdown', e => { sy = e.clientY; });
  window.addEventListener('pointerup', e => { if (sy !== null && e.clientY - sy > 60) closePanel(); sy = null; });
}
