// ============================================================
//  إعدادات اللعبة والتوازن — كل الأرقام هنا لسهولة التعديل
// ============================================================

const GAME = {
  DAY_MS: 240000,            // مدة يوم اللعبة بالميلي ثانية الحقيقية (4 دقائق)
  START_HOUR: 7,
  START_MONEY: 500,
  OFFLINE_CAP_DAYS: 2,       // أقصى وقت يُحسب أثناء إغلاق اللعبة (أيام لعبة)
  SAVE_KEY: 'animalFarm.save.v1',
  VET_VISIT_FEE: 25,         // أجرة حضور الطبيب
  VET_TRAVEL_DAYS: 0.02,     // وقت وصول الطبيب (~5 ثواني)
  MARKET_FEED_PRICE: 5,      // سعر وحدة العلف الجاهز من السوق
  TRADER_RATE: 0.7,          // التاجر يشتري بـ 70% من القيمة
  BASE_DISEASE: 0.04,        // احتمال المرض لكل حيوان في اليوم
  DISEASE_STEP_DAYS: 1,      // كل يوم بدون علاج يزيد المرض درجة
  NEW_ANIMAL_IMMUNITY: 0.5,
  CROP_WITHER_DAYS: 1.5,     // المحصول الجاهز يذبل إذا لم يُحصد
  HUNGER_PER_DAY: 100,
  FIRST_SHIP_AT: 1.5,
  FIRST_EVENT_AT: 2.2,
  FIRST_RAID_AT: 2.8,        // أول هجوم لحيوان مفترس (ليلة اليوم الثالث)
  RAID_APPROACH: 0.042,      // وقت اقتراب المفترس من السياج (~10 ثواني)
  RAID_BITE_DELAY: 0.008,    // وقت وصوله للفريسة بعد دخول الحظيرة
  RAID_FLEE: 0.017,          // وقت هروبه خارج المزرعة
  DOG_BITE_MULT: 0.6,        // وجود الكلب يشتّت المفترس ويقلل ضرره
  FIRECRACKER_COST: 30,
  FIRECRACKER_DMG: 5,
};

const STAGES = ['small', 'medium', 'large'];
const STAGE_NAMES = { small: 'صغير', medium: 'متوسط', large: 'كبير' };
const NEXT_STAGE = { small: 'medium', medium: 'large', large: null };

// ------------------------------------------------------------
//  الحيوانات — لإضافة حيوان جديد يكفي إضافة عنصر هنا
//  buy: سعر الشراء | sell: قيمة البيع الأساسية | feed: وحدات علف لكل وجبة كاملة (يوم)
//  grow: أيام لعبة للانتقال للعمر التالي | size: حجم الرسم
// ------------------------------------------------------------
const ANIMALS = {
  cow: {
    name: 'بقرة', plural: 'أبقار', fem: true, icon: '🐄', space: 2, vetMult: 1.5, diseaseMult: 1,
    unlock: { level: 1, cost: 0 },
    stages: {
      small:  { buy: 120, sell: 70,  feed: 2, grow: 2.5, size: 0.62 },
      medium: { buy: 260, sell: 200, feed: 3, grow: 2.5, size: 0.82 },
      large:  { buy: 560, sell: 480, feed: 4, grow: 0,   size: 1 },
    },
    look: { kind: 'quad', rx: 26, ry: 15, lh: 15, lw: 5, body: '#f7f2e8', spots: '#3a3230',
      head: '#f7f2e8', muzzle: '#f2b8b0', leg: '#e9e1d2', hoof: '#4a3b33', horns: 'small', ear: '#e9ddd0', speed: 22 },
  },
  sheep: {
    name: 'خروف', plural: 'أغنام', icon: '🐑', space: 1, vetMult: 1, diseaseMult: 1.1,
    unlock: { level: 1, cost: 0 },
    stages: {
      small:  { buy: 50,  sell: 30,  feed: 1,   grow: 1.5, size: 0.62 },
      medium: { buy: 110, sell: 85,  feed: 1.5, grow: 1.5, size: 0.82 },
      large:  { buy: 230, sell: 200, feed: 2,   grow: 0,   size: 1 },
    },
    look: { kind: 'quad', wool: true, rx: 19, ry: 13, lh: 10, lw: 4, body: '#fbf8f1', head: '#4a3f3a',
      muzzle: '#5a4d47', leg: '#4a3f3a', hoof: '#2a2220', ear: '#4a3f3a', speed: 20 },
  },
  chicken: {
    name: 'دجاجة', plural: 'دجاج', fem: true, icon: '🐔', space: 0.5, vetMult: 0.4, diseaseMult: 1.2,
    unlock: { level: 2, cost: 300 },
    stages: {
      small:  { buy: 15, sell: 8,  feed: 0.3, grow: 1, size: 0.6 },
      medium: { buy: 35, sell: 25, feed: 0.4, grow: 1, size: 0.8 },
      large:  { buy: 70, sell: 60, feed: 0.5, grow: 0, size: 1 },
    },
    look: { kind: 'chicken', body: '#fffdf7', wing: '#efe6d6', comb: '#e0443a', beak: '#f2b33d', leg: '#e89a3c', speed: 30 },
  },
  goat: {
    name: 'ماعز', plural: 'ماعز', icon: '🐐', space: 1, vetMult: 1.1, diseaseMult: 0.9,
    unlock: { level: 3, cost: 800 },
    stages: {
      small:  { buy: 70,  sell: 40,  feed: 1,   grow: 1.5, size: 0.62 },
      medium: { buy: 150, sell: 115, feed: 1.5, grow: 2,   size: 0.82 },
      large:  { buy: 300, sell: 260, feed: 2,   grow: 0,   size: 1 },
    },
    look: { kind: 'quad', rx: 18, ry: 11, lh: 14, lw: 3.5, body: '#a8795a', spots: '#f1e6d8', head: '#a8795a',
      muzzle: '#8a6048', leg: '#8e644a', hoof: '#2e2420', horns: 'back', beard: true, ear: '#8e644a', speed: 26 },
  },
  buffalo: {
    name: 'جاموسة', plural: 'جواميس', fem: true, icon: '🐃', space: 2, vetMult: 1.8, diseaseMult: 0.8,
    unlock: { level: 5, cost: 2500 },
    stages: {
      small:  { buy: 200, sell: 120, feed: 3, grow: 3, size: 0.62 },
      medium: { buy: 450, sell: 350, feed: 4, grow: 3, size: 0.82 },
      large:  { buy: 950, sell: 820, feed: 5, grow: 0, size: 1 },
    },
    look: { kind: 'quad', rx: 29, ry: 16, lh: 14, lw: 6, body: '#4b4747', head: '#4b4747', muzzle: '#6b6262',
      leg: '#403c3c', hoof: '#1e1b1b', horns: 'big', ear: '#3c3838', speed: 17 },
  },
};

// ------------------------------------------------------------
//  المحاصيل (علف)
// ------------------------------------------------------------
const CROPS = {
  grass:   { name: 'عشب',  icon: '🌿', seed: 3,  days: 0.25, yield: 4,  level: 1, color: '#6fbf4a', ripe: '#8fd35a' },
  barley:  { name: 'شعير', icon: '🌾', seed: 8,  days: 0.5,  yield: 9,  level: 1, color: '#9cc24a', ripe: '#e3c35a' },
  corn:    { name: 'ذرة',  icon: '🌽', seed: 18, days: 1.0,  yield: 22, level: 2, color: '#5fae45', ripe: '#f2cf3d' },
  alfalfa: { name: 'برسيم', icon: '☘️', seed: 30, days: 1.5,  yield: 40, level: 4, color: '#3f9e46', ripe: '#b38fe0' },
};
const FEED_ORDER = ['grass', 'barley', 'corn', 'alfalfa'];

// ------------------------------------------------------------
//  الأمراض
// ------------------------------------------------------------
const DISEASES = {
  fever:     { name: 'حمّى', dmg: 12, cost: 40, weight: 5 },
  diarrhea:  { name: 'إسهال', dmg: 16, cost: 60, weight: 4 },
  mange:     { name: 'جَرَب', dmg: 10, cost: 50, weight: 3, only: ['sheep', 'goat'] },
  pneumonia: { name: 'التهاب رئوي', dmg: 22, cost: 110, weight: 2 },
  fmd:       { name: 'الحمّى القلاعية', dmg: 28, cost: 180, weight: 1, not: ['chicken'] },
  birdflu:   { name: 'إنفلونزا الطيور', dmg: 30, cost: 30, weight: 3, only: ['chicken'] },
};
const SEVERITY_NAMES = ['', 'خفيف', 'متوسط', 'شديد'];

// ------------------------------------------------------------
//  الحيوانات المفترسة — تهاجم ليلاً
//  hp: عدد اللمسات لطرده | bite: ضرر الصحة لكل يوم على الفريسة
//  fence: مضاعف وقت كسر السياج | prey: فرائسه المفضلة (null = أي حيوان)
//  maxStage: أكبر عمر يستطيع افتراسه (الدجاج فريسة دائماً) | bounty: مكافأة طرده
// ------------------------------------------------------------
const PREDATORS = {
  fox: {
    name: 'ثعلب', the: 'الثعلب', icon: '🦊', level: 1, weight: 5, hp: 8, bite: 2000, fence: 1.2, bounty: 20,
    prey: ['chicken', 'sheep', 'goat'], maxStage: 'small', size: 0.85,
    look: { kind: 'quad', rx: 17, ry: 9, lh: 10, lw: 3, body: '#d8712d', head: '#d8712d', muzzle: '#f4e7d7',
      leg: '#4a2a1a', hoof: '#2a1a10', ear: '#9c4a18' },
  },
  wolf: {
    name: 'ذئب', the: 'الذئب', icon: '🐺', level: 3, weight: 4, hp: 15, bite: 2400, fence: 0.9, bounty: 50,
    prey: ['sheep', 'goat', 'chicken'], maxStage: 'medium', size: 1,
    look: { kind: 'quad', rx: 22, ry: 11, lh: 14, lw: 4, body: '#7d7f86', head: '#7d7f86', muzzle: '#cfcfcf',
      leg: '#5f6168', hoof: '#2e2f33', ear: '#4f5158' },
  },
  hyena: {
    name: 'ضبع', the: 'الضبع', icon: '🐾', level: 5, weight: 2, hp: 25, bite: 3000, fence: 0.7, bounty: 90,
    prey: null, maxStage: 'large', size: 1.05,
    look: { kind: 'quad', rx: 22, ry: 12, lh: 15, lw: 4.5, body: '#b99a6a', spots: '#5b4630', head: '#9c7f55',
      muzzle: '#4a3a2a', leg: '#8a6f48', hoof: '#2e2418', ear: '#6b5436' },
  },
};
const DOG_LOOK = { kind: 'quad', rx: 17, ry: 10, lh: 12, lw: 3.5, body: '#c8a06a', spots: '#6b4a2d', head: '#c8a06a',
  muzzle: '#e9d6b8', leg: '#b28a58', hoof: '#3a2a1a', ear: '#6b4a2d' };

// ------------------------------------------------------------
//  التطويرات — levels[0] هي البداية
// ------------------------------------------------------------
const UPGRADES = {
  barn: {
    name: 'الحظيرة', icon: '🏠', desc: 'مساحة أكبر لتربية حيوانات أكثر',
    levels: [{ v: 10 }, { v: 16, cost: 400 }, { v: 24, cost: 900 }, { v: 36, cost: 1800 }, { v: 50, cost: 3500 }, { v: 70, cost: 6500 }],
    fmt: v => `سعة ${v} وحدة`,
  },
  fields: {
    name: 'الحقول', icon: '🌱', desc: 'أحواض زراعة إضافية للعلف',
    levels: [{ v: 3 }, { v: 5, cost: 250 }, { v: 8, cost: 600 }, { v: 12, cost: 1300 }, { v: 16, cost: 2600 }],
    fmt: v => `${v} أحواض`,
  },
  storage: {
    name: 'مخزن العلف', icon: '🏚️', desc: 'تخزين كمية أكبر من العلف',
    levels: [{ v: 60 }, { v: 120, cost: 200 }, { v: 250, cost: 500 }, { v: 500, cost: 1100 }, { v: 1000, cost: 2400 }],
    fmt: v => `سعة ${v} علف`,
  },
  saleyard: {
    name: 'ساحة البيع', icon: '🤝', desc: 'مشترون أكثر في نفس الوقت وأسعار أفضل',
    levels: [{ v: 1, bonus: 0 }, { v: 2, bonus: 0.05, cost: 350 }, { v: 3, bonus: 0.1, cost: 900 }, { v: 4, bonus: 0.15, cost: 2000 }],
    fmt: (v, l) => `${v} مشترين · +${Math.round(l.bonus * 100)}% سعر`,
  },
  clinic: {
    name: 'العيادة البيطرية', icon: '🏥', desc: 'أمراض أقل وعلاج أرخص',
    levels: [{ v: 0, off: 0 }, { v: 0.2, off: 0.1, cost: 300 }, { v: 0.35, off: 0.2, cost: 800 }, { v: 0.5, off: 0.3, cost: 1800 }],
    fmt: (v, l) => `-${Math.round(v * 100)}% أمراض · -${Math.round(l.off * 100)}% علاج`,
  },
  feeder: {
    name: 'المعلف الآلي', icon: '⚙️', desc: 'يطعم الحيوانات تلقائياً من المخزن عندما تجوع',
    levels: [{ v: 0 }, { v: 1, cost: 700 }],
    fmt: v => (v ? 'يعمل' : 'غير موجود'),
  },
  dock: {
    name: 'الميناء', icon: '⚓', desc: 'السفن تأتي أسرع وتدفع أكثر',
    levels: [{ v: 3, bonus: 0 }, { v: 2.5, bonus: 0.1, cost: 600 }, { v: 2, bonus: 0.2, cost: 1500 }],
    fmt: (v, l) => `كل ${v} يوم · +${Math.round(l.bonus * 100)}% مكافأة`,
  },
  fence: {
    name: 'السياج', icon: '🚧', desc: 'يؤخّر الحيوانات المفترسة قبل أن تدخل الحظيرة',
    levels: [{ v: 0.0125 }, { v: 0.035, cost: 350 }, { v: 0.065, cost: 900 }, { v: 0.11, cost: 2000 }],
    fmt: v => `يصمد ~${Math.round(v * GAME.DAY_MS / 1000)} ثانية`,
  },
  dog: {
    name: 'كلب الحراسة', icon: '🐕', desc: 'ينبح ويهاجم المفترس تلقائياً ويشتّته عن الفريسة',
    levels: [{ v: 0 }, { v: 150, cost: 450, label: 'كلب حراسة' }, { v: 270, cost: 1100, label: 'كلب مدرّب' }, { v: 440, cost: 2400, label: 'كلبا حراسة' }],
    fmt: (v, l) => (v ? l.label : 'لا يوجد'),
  },
  lights: {
    name: 'الإنارة الليلية', icon: '💡', desc: 'كشافات حول الحظيرة تُبعد المفترسات',
    levels: [{ v: 1 }, { v: 0.7, cost: 400 }, { v: 0.45, cost: 1200 }],
    fmt: v => (v >= 1 ? 'لا توجد' : `-${Math.round((1 - v) * 100)}% هجمات`),
  },
};

// ------------------------------------------------------------
//  الأحداث العشوائية
// ------------------------------------------------------------
const EVENTS = [
  { id: 'epidemic', icon: '🦠', name: 'موجة أمراض', desc: 'احتمال المرض مضاعف اليوم — نظّف الحظيرة!', mods: { disease: 2 } },
  { id: 'vetPrice', icon: '💉', name: 'غلاء العلاج', desc: 'تكاليف الطبيب والعلاج أعلى بـ 50%', mods: { vet: 1.5 } },
  { id: 'drought', icon: '☀️', name: 'جفاف', desc: 'المحاصيل تنمو ببطء اليوم', mods: { crop: 0.6 } },
  { id: 'rain', icon: '🌧️', name: 'أمطار خير', desc: 'المحاصيل تنمو أسرع اليوم', mods: { crop: 1.5 } },
  { id: 'festival', icon: '🎉', name: 'موسم العيد', desc: 'مشترون أكثر ويدفعون أعلى', mods: { buyerPrice: 1.2, buyerRate: 1.8 } },
  { id: 'feedPrice', icon: '📈', name: 'غلاء العلف', desc: 'سعر العلف في السوق مضاعف', mods: { feedPrice: 2 } },
  { id: 'calm', icon: '🍃', name: 'جو معتدل', desc: 'الحيوانات أقل عرضة للمرض اليوم', mods: { disease: 0.5 } },
  { id: 'wolves', icon: '🐺', name: 'موسم الذئاب', desc: 'المفترسات تهاجم أكثر — احمِ الحظيرة!', mods: { raid: 2.5 } },
];

const BUYER_NAMES = ['أبو علي', 'حجي كريم', 'أم محمد', 'سالم', 'أبو حسين', 'جاسم', 'أم زينب', 'حمزة', 'أبو مصطفى', 'عباس', 'ستار', 'أبو يوسف', 'نوري', 'حيدر', 'أم عباس'];
const ANIMAL_NAMES = ['زهرة', 'لولو', 'نجمة', 'سكّر', 'قمر', 'بندق', 'فلّة', 'غيمة', 'عسل', 'ريحانة', 'ظريف', 'نمر', 'فستق', 'شمسة', 'كرملة', 'بسبوسة', 'مرجان', 'لؤلؤة', 'ياسمين', 'توتة'];

// الخبرة المطلوبة للمستوى التالي
function xpForLevel(level) { return Math.round(80 * Math.pow(level, 1.5)); }
