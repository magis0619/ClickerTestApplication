/* Stardust Clicker — core logic (Vanilla JS)
 * 市場調査で抽出したコアメカニクス F1-F7 + QoL(F8 まとめ買い / F9 ブースト)
 * + 実績(F10) / デイリーボーナス(F11) / 演出強化(F12) / 恒久アップグレード(F13)
 */
(() => {
  "use strict";

  const SAVE_KEY = "stardust-clicker-save-v1";
  const TICK_MS = 100;
  const SAVE_INTERVAL_MS = 5000;
  const OFFLINE_CAP_SEC = 8 * 3600;
  const NEBULA_PER_BONUS = 0.02;   // 累計ネビュラ1個あたり +2%
  const NEBULA_DIVISOR = 1e6;
  const ACH_PER_BONUS = 0.01;      // 実績1個あたり +1%
  const CRIT_CHANCE = 0.05;        // タップ時のクリティカル率
  const CRIT_MULT = 7;
  const DAY_MS = 86400000;

  // ---- 独自アイコン（インラインSVG。絵文字を置き換え） ----
  const ICONS = {
    stardust: `<svg viewBox="0 0 24 24"><path fill="#ffd24a" d="M12 2l2.9 6.3 6.9.7-5.1 4.7 1.4 6.8L12 17.8 5.9 21.2l1.4-6.8L2.2 9.7l6.9-.7z"/></svg>`,
    tapStar: `<svg viewBox="0 0 100 100"><defs><radialGradient id="tsg" cx="38%" cy="30%" r="72%"><stop offset="0%" stop-color="#fff7df"/><stop offset="45%" stop-color="#ffd24a"/><stop offset="100%" stop-color="#ff8a18"/></radialGradient></defs><path fill="url(#tsg)" d="M50 6l11 26 28 3-21 19 6 28-24-15-24 15 6-28L11 35l28-3z"/><circle cx="40" cy="33" r="6.5" fill="#fff" opacity=".75"/></svg>`,
    drone: `<svg viewBox="0 0 24 24"><g fill="#7aa2ff"><rect x="10" y="9" width="4" height="6" rx="1"/><rect x="2" y="10" width="6" height="4" rx="1"/><rect x="16" y="10" width="6" height="4" rx="1"/></g><circle cx="12" cy="6" r="2" fill="#ffd24a"/><rect x="11.4" y="7.5" width="1.2" height="2" fill="#7aa2ff"/></svg>`,
    miner: `<svg viewBox="0 0 24 24"><rect x="5" y="7" width="14" height="11" rx="3" fill="#9aa6d6"/><circle cx="9.5" cy="12.5" r="1.8" fill="#0b1026"/><circle cx="14.5" cy="12.5" r="1.8" fill="#0b1026"/><rect x="11.2" y="3.5" width="1.6" height="3" fill="#9aa6d6"/><circle cx="12" cy="3" r="1.6" fill="#ffd24a"/></svg>`,
    station: `<svg viewBox="0 0 24 24"><ellipse cx="12" cy="14" rx="9" ry="3.4" fill="#7aa2ff"/><path d="M7.2 13a4.8 3.6 0 019.6 0z" fill="#cfe0ff"/><circle cx="6" cy="14.2" r="1" fill="#ffd24a"/><circle cx="12" cy="15" r="1" fill="#ffd24a"/><circle cx="18" cy="14.2" r="1" fill="#ffd24a"/></svg>`,
    warp: `<svg viewBox="0 0 24 24"><g fill="none" stroke="#b388ff" stroke-width="2"><circle cx="12" cy="12" r="9" opacity=".35"/><circle cx="12" cy="12" r="5.6" opacity=".7"/></g><circle cx="12" cy="12" r="2.3" fill="#b388ff"/></svg>`,
    dyson: `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="6" fill="#ffb02e"/><g stroke="#ffd24a" stroke-width="1.6" stroke-linecap="round"><line x1="12" y1="1.8" x2="12" y2="4.4"/><line x1="12" y1="19.6" x2="12" y2="22.2"/><line x1="1.8" y1="12" x2="4.4" y2="12"/><line x1="19.6" y1="12" x2="22.2" y2="12"/><line x1="4.7" y1="4.7" x2="6.5" y2="6.5"/><line x1="17.5" y1="17.5" x2="19.3" y2="19.3"/><line x1="19.3" y1="4.7" x2="17.5" y2="6.5"/><line x1="6.5" y1="17.5" x2="4.7" y2="19.3"/></g></svg>`,
    click: `<svg viewBox="0 0 24 24"><path fill="#ffd24a" d="M6 3l13 7-5.4 1.6L17 18.4l-3 1.5-3.2-6.2L7 17.2z"/></svg>`,
    prod: `<svg viewBox="0 0 24 24"><g fill="#9aa6d6"><circle cx="12" cy="12" r="3.4"/><rect x="11" y="2" width="2" height="4" rx="1"/><rect x="11" y="18" width="2" height="4" rx="1"/><rect x="2" y="11" width="4" height="2" rx="1"/><rect x="18" y="11" width="4" height="2" rx="1"/><rect x="4.4" y="4.4" width="2" height="4" rx="1" transform="rotate(-45 5.4 6.4)"/><rect x="17.6" y="15.6" width="2" height="4" rx="1" transform="rotate(-45 18.6 17.6)"/><rect x="15.6" y="4.4" width="2" height="4" rx="1" transform="rotate(45 16.6 6.4)"/><rect x="4.4" y="15.6" width="2" height="4" rx="1" transform="rotate(45 5.4 17.6)"/></g><circle cx="12" cy="12" r="1.3" fill="#131a3a"/></svg>`,
    boost: `<svg viewBox="0 0 24 24"><path fill="#ff8a3d" d="M13 2L4 14h6l-1 8 9-12h-6z"/></svg>`,
    idle: `<svg viewBox="0 0 24 24"><path fill="#9aa6d6" d="M20 14.5A8 8 0 119.5 4 6.5 6.5 0 0020 14.5z"/><text x="13.5" y="9.5" font-size="6.5" fill="#ffd24a" font-family="sans-serif" font-weight="700">z</text></svg>`,
    medal: `<svg viewBox="0 0 24 24"><path d="M8 2l2.2 6H6z" fill="#7aa2ff"/><path d="M16 2l-2.2 6H18z" fill="#7aa2ff"/><circle cx="12" cy="15" r="6" fill="#ffd24a"/><circle cx="12" cy="15" r="3.3" fill="#ffb02e"/></svg>`,
    trophy: `<svg viewBox="0 0 24 24"><path fill="#ffd24a" d="M7 4h10v3a5 5 0 01-10 0z"/><path fill="#ffd24a" d="M5 5H3v1a3 3 0 003 3V7H5zm14 0v2h-1v2a3 3 0 003-3V5z"/><rect x="11" y="11" width="2" height="4" fill="#ffd24a"/><rect x="8" y="15" width="8" height="2" rx="1" fill="#ffb02e"/><rect x="9" y="18" width="6" height="2" rx="1" fill="#ffd24a"/></svg>`,
    nebula: `<svg viewBox="0 0 24 24"><g fill="none" stroke="#b388ff" stroke-width="2" stroke-linecap="round"><path d="M12 5c4 0 7 3 7 7"/><path d="M12 19c-4 0-7-3-7-7"/></g><circle cx="12" cy="12" r="2.2" fill="#fff"/><circle cx="19" cy="12" r="1" fill="#ffd24a"/><circle cx="5" cy="12" r="1" fill="#7aa2ff"/></svg>`,
    gift: `<svg viewBox="0 0 24 24"><rect x="4" y="10" width="16" height="10" rx="1.5" fill="#ff6b6b"/><rect x="4" y="6.8" width="16" height="3.6" rx="1.2" fill="#ff8a8a"/><rect x="11" y="6.8" width="2" height="13.2" fill="#ffd24a"/><path d="M12 6.8C11 4 7.2 4 7.2 6S11 6.8 12 6.8zm0 0C13 4 16.8 4 16.8 6S13 6.8 12 6.8z" fill="#ffd24a"/></svg>`,
    sound: `<svg viewBox="0 0 24 24"><path fill="#eaeeff" d="M4 9v6h4l5 4V5L8 9z"/><path fill="none" stroke="#eaeeff" stroke-width="1.6" stroke-linecap="round" d="M16 9.2a4 4 0 010 5.6"/></svg>`,
    vibe: `<svg viewBox="0 0 24 24"><rect x="8" y="4" width="8" height="16" rx="2" fill="#eaeeff"/><rect x="9.6" y="6" width="4.8" height="9.5" fill="#131a3a"/><g stroke="#eaeeff" stroke-width="1.4" stroke-linecap="round"><line x1="4.5" y1="9.5" x2="4.5" y2="14.5"/><line x1="19.5" y1="9.5" x2="19.5" y2="14.5"/></g></svg>`,
  };
  function applyStaticIcons() {
    document.querySelectorAll("[data-icon]").forEach((e) => { e.innerHTML = ICONS[e.dataset.icon] || ""; });
  }

  const GENERATORS = [
    { id: "drone",   name: "探査ドローン",     baseCost: 15,     costMul: 1.15, rate: 0.2 },
    { id: "miner",   name: "採掘ロボ",         baseCost: 120,    costMul: 1.15, rate: 1.5 },
    { id: "station", name: "宇宙ステーション", baseCost: 1300,   costMul: 1.16, rate: 9   },
    { id: "warp",    name: "ワープゲート",     baseCost: 14000,  costMul: 1.17, rate: 55  },
    { id: "dyson",   name: "ダイソン球",       baseCost: 200000, costMul: 1.18, rate: 350 },
  ];

  const CLICK_BASE_COST = 25;
  const CLICK_COST_MUL = 1.6;

  // 恒久アップグレード（ネビュラで購入）
  const UPGRADES = [
    { id: "click", name: "クリック増幅", desc: (l) => `タップ獲得 +${l * 50}%`,   max: 10, cost: (l) => 1 + l },
    { id: "prod",  name: "生産加速",     desc: (l) => `自動生産 +${l * 25}%`,     max: 10, cost: (l) => 1 + l },
    { id: "boost", name: "ブースト強化", desc: (l) => `ブースト +${l * 5}秒 / CD -${l * 5}秒`, max: 6, cost: (l) => 2 + l * 2 },
    { id: "idle",  name: "放置の達人",   desc: (l) => `放置上限 +${l}時間 / 効率 +${l * 10}%`, max: 8, cost: (l) => 2 + l * 2 },
  ];

  // ブースト
  const BOOST_MULT = 2;
  const BOOST_DURATION_MS = 30000;
  const BOOST_COOLDOWN_MS = 120000;
  let boostUntil = 0;
  let boostCooldownUntil = 0;

  // 実績（check は state を受け取り、達成なら true）
  // prog: 現在値と目標値 [cur, target] を返す（達成率バー用）
  const ACHIEVEMENTS = [
    { id: "tap50",     name: "はじめの一歩",     desc: "タップ",        prog: (s) => [s.lifetime.taps, 50] },
    { id: "tap1000",   name: "連打マスター",     desc: "タップ",        prog: (s) => [s.lifetime.taps, 1000] },
    { id: "earn1k",    name: "塵も積もれば",     desc: "累計獲得",      prog: (s) => [s.lifetime.earned, 1000] },
    { id: "earn1m",    name: "スターダスト長者", desc: "累計獲得",      prog: (s) => [s.lifetime.earned, 1e6] },
    { id: "earn1b",    name: "銀河の支配者",     desc: "累計獲得",      prog: (s) => [s.lifetime.earned, 1e9] },
    { id: "gen10",     name: "自動化の芽",       desc: "ユニット合計",  prog: (s) => [totalGens(s), 10] },
    { id: "gen100",    name: "量産体制",         desc: "ユニット合計",  prog: (s) => [totalGens(s), 100] },
    { id: "dyson1",    name: "恒星をその手に",   desc: "ダイソン球",    prog: (s) => [countById(s, "dyson"), 1] },
    { id: "boost1",    name: "加速装置",         desc: "ブースト使用",  prog: (s) => [s.lifetime.boostUsed ? 1 : 0, 1] },
    { id: "prestige1", name: "生まれ変わり",     desc: "転生回数",      prog: (s) => [s.lifetime.prestiges, 1] },
    { id: "prestige5", name: "輪廻の探究者",     desc: "転生回数",      prog: (s) => [s.lifetime.prestiges, 5] },
  ];
  // 達成判定は prog の cur >= target で統一
  function achDone(a, s) { const [c, t] = a.prog(s); return c >= t; }

  // ---- State ----
  let state = newState();

  function newRun() {
    return {
      stardust: 0,
      runEarned: 0,
      clickLevel: 0,
      generators: GENERATORS.map((g) => ({ id: g.id, count: 0 })),
    };
  }

  function newState() {
    return Object.assign(newRun(), {
      nebula: 0,          // 使用可能なネビュラ
      nebulaEarned: 0,    // 累計獲得ネビュラ（恒久ボーナスの基準）
      upgrades: { click: 0, prod: 0, boost: 0, idle: 0 },
      achievements: {},
      lifetime: { earned: 0, taps: 0, prestiges: 0, boostUsed: false },
      daily: { lastClaimDay: -1, streak: 0 },
      settings: { sound: true, vibe: true },
      buyMode: 1,
      lastSeen: Date.now(),
    });
  }

  // ---- 補助 ----
  function totalGens(s) { return s.generators.reduce((a, g) => a + g.count, 0); }
  function countById(s, id) { const g = s.generators.find((x) => x.id === id); return g ? g.count : 0; }
  function upLevel(id) { return state.upgrades[id] || 0; }
  function achUnlockedCount() { return Object.keys(state.achievements).length; }

  // ---- 倍率 ----
  function nebulaMultiplier() { return 1 + state.nebulaEarned * NEBULA_PER_BONUS; }
  function achievementMultiplier() { return 1 + achUnlockedCount() * ACH_PER_BONUS; }
  function boostActive() { return Date.now() < boostUntil; }
  function boostMultiplier() { return boostActive() ? BOOST_MULT : 1; }
  function globalMultiplier() { return nebulaMultiplier() * achievementMultiplier() * boostMultiplier(); }

  function clickUpgradeMult() { return 1 + upLevel("click") * 0.5; }
  function prodUpgradeMult() { return 1 + upLevel("prod") * 0.25; }
  function boostDuration() { return BOOST_DURATION_MS + upLevel("boost") * 5000; }
  function boostCooldown() { return Math.max(30000, BOOST_COOLDOWN_MS - upLevel("boost") * 5000); }
  function offlineCapSec() { return OFFLINE_CAP_SEC + upLevel("idle") * 3600; }
  function offlineRate() { return 1 + upLevel("idle") * 0.1; }

  function perClick() { return (1 + state.clickLevel) * clickUpgradeMult() * globalMultiplier(); }
  function clickCost() { return Math.floor(CLICK_BASE_COST * Math.pow(CLICK_COST_MUL, state.clickLevel)); }

  function genCostN(i, n) {
    const def = GENERATORS[i];
    const mul = def.costMul;
    const first = def.baseCost * Math.pow(mul, state.generators[i].count);
    return Math.floor((first * (Math.pow(mul, n) - 1)) / (mul - 1));
  }
  function maxAffordable(i) {
    const def = GENERATORS[i];
    const mul = def.costMul;
    const first = def.baseCost * Math.pow(mul, state.generators[i].count);
    const n = Math.floor(Math.log(1 + (state.stardust * (mul - 1)) / first) / Math.log(mul));
    return Math.max(0, n);
  }
  function buyPlan(i) {
    if (state.buyMode === "max") {
      const n = maxAffordable(i);
      return { n, cost: genCostN(i, Math.max(1, n)) };
    }
    const n = state.buyMode;
    return { n, cost: genCostN(i, n) };
  }

  function perSecond() {
    let raw = 0;
    GENERATORS.forEach((def, i) => { raw += def.rate * state.generators[i].count; });
    return raw * prodUpgradeMult() * globalMultiplier();
  }

  function nebulaGain() { return Math.floor(Math.sqrt(state.runEarned / NEBULA_DIVISOR)); }

  // ---- 桁表記 ----
  const SUFFIX = ["", "K", "M", "B", "T", "Qa", "Qi", "Sx", "Sp", "Oc", "No", "Dc"];
  function fmt(n) {
    if (n < 1000) return Number.isInteger(n) ? String(n) : n.toFixed(1);
    let tier = Math.floor(Math.log10(n) / 3);
    if (tier >= SUFFIX.length) tier = SUFFIX.length - 1;
    return (n / Math.pow(10, tier * 3)).toFixed(2) + SUFFIX[tier];
  }

  function earn(amount) {
    state.stardust += amount;
    state.runEarned += amount;
    state.lifetime.earned += amount;
  }

  // ---- 演出（効果音 / 触覚 / トースト） ----
  let audioCtx = null;
  function beep(freq, dur = 0.06, type = "sine", gain = 0.04) {
    if (!state.settings.sound) return;
    try {
      audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const g = audioCtx.createGain();
      osc.type = type; osc.frequency.value = freq;
      g.gain.value = gain;
      osc.connect(g); g.connect(audioCtx.destination);
      const t = audioCtx.currentTime;
      g.gain.setValueAtTime(gain, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      osc.start(t); osc.stop(t + dur);
    } catch (e) { /* noop */ }
  }
  function vibrate(ms) {
    if (state.settings.vibe && navigator.vibrate) navigator.vibrate(ms);
  }
  let toastTimer = null;
  function toast(msg) {
    const t = el("toast");
    t.textContent = msg;
    t.classList.remove("hidden");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.add("hidden"), 2600);
  }

  // ---- DOM ----
  const el = (id) => document.getElementById(id);
  let dom = {};

  function buildGeneratorCards() {
    dom.generators.innerHTML = "";
    GENERATORS.forEach((def, i) => {
      const card = document.createElement("div");
      card.className = "gen-card";
      card.innerHTML = `
        <div class="gen-icon">${ICONS[def.id]}</div>
        <div class="gen-body">
          <div class="gen-name">${def.name}<span class="gen-count" data-count="${i}">×0</span></div>
          <div class="gen-desc">毎秒 +${fmt(def.rate)} / 個</div>
        </div>
        <div class="gen-cost" data-cost="${i}">${fmt(def.baseCost)}</div>`;
      card.addEventListener("click", () => buyGenerator(i));
      dom.generators.appendChild(card);
    });
  }

  function buildUpgradeCards() {
    dom.upgrades.innerHTML = "";
    UPGRADES.forEach((u) => {
      const card = document.createElement("div");
      card.className = "gen-card";
      card.innerHTML = `
        <div class="gen-icon">${ICONS[u.id]}</div>
        <div class="gen-body">
          <div class="gen-name">${u.name}<span class="gen-count" data-uplv="${u.id}">Lv.0</span></div>
          <div class="gen-desc" data-updesc="${u.id}"></div>
        </div>
        <div class="gen-cost" data-upcost="${u.id}"><span class="cost-ico">${ICONS.nebula}</span>1</div>`;
      card.addEventListener("click", () => buyUpgrade(u.id));
      dom.upgrades.appendChild(card);
    });
  }

  function buildAchievementCards() {
    dom.achievements.innerHTML = "";
    el("achTotal").textContent = ACHIEVEMENTS.length;
    ACHIEVEMENTS.forEach((a) => {
      const card = document.createElement("div");
      card.className = "ach-card locked";
      card.dataset.ach = a.id;
      card.innerHTML = `
        <div class="ach-icon">${ICONS.medal}</div>
        <div class="ach-body">
          <div class="ach-name">${a.name}</div>
          <div class="ach-prog">
            <div class="ach-bar"><span data-achbar="${a.id}"></span></div>
            <div class="ach-count" data-achcount="${a.id}"></div>
          </div>
        </div>`;
      dom.achievements.appendChild(card);
    });
  }

  // ---- アクション ----
  function tap(clientX, clientY) {
    state.lifetime.taps += 1;
    const crit = Math.random() < CRIT_CHANCE;
    let gain = perClick();
    if (crit) gain *= CRIT_MULT;
    earn(gain);
    spawnFloater((crit ? "CRIT +" : "+") + fmt(gain), clientX, clientY, crit);
    spawnParticles(clientX, clientY, crit ? 14 : 6, crit ? "#fff" : "#ffd24a");
    bumpStardust();
    beep(crit ? 880 : 660, crit ? 0.1 : 0.05, crit ? "square" : "sine", crit ? 0.06 : 0.035);
    vibrate(crit ? 25 : 8);
    checkAchievements();
    render();
  }

  function buyClickUpgrade() {
    const cost = clickCost();
    if (state.stardust < cost) return;
    state.stardust -= cost;
    state.clickLevel += 1;
    flashEl(dom.clickUpgrade);
    beep(520, 0.06, "triangle");
    render();
  }

  function buyGenerator(i) {
    const { n, cost } = buyPlan(i);
    if (n < 1 || state.stardust < cost) return;
    state.stardust -= cost;
    state.generators[i].count += n;
    const card = dom.generators.querySelector(`[data-cost="${i}"]`);
    flashEl(card && card.closest(".gen-card"));
    beep(440, 0.06, "triangle");
    checkAchievements();
    render();
  }

  function buyUpgrade(id) {
    const def = UPGRADES.find((u) => u.id === id);
    const lv = upLevel(id);
    if (lv >= def.max) return;
    const cost = def.cost(lv);
    if (state.nebula < cost) return;
    state.nebula -= cost;
    state.upgrades[id] = lv + 1;
    const card = dom.upgrades.querySelector(`[data-upcost="${id}"]`);
    flashEl(card && card.closest(".gen-card"));
    beep(700, 0.08, "triangle");
    toast(`${def.name} Lv.${lv + 1}！`);
    render();
  }

  function setBuyMode(mode) {
    state.buyMode = mode;
    document.querySelectorAll(".bm").forEach((b) =>
      b.classList.toggle("active", String(b.dataset.mode) === String(mode)));
    render();
  }

  function activateBoost() {
    const now = Date.now();
    if (now < boostUntil || now < boostCooldownUntil) return;
    boostUntil = now + boostDuration();
    boostCooldownUntil = boostUntil + boostCooldown();
    state.lifetime.boostUsed = true;
    beep(990, 0.18, "sawtooth", 0.05);
    checkAchievements();
    render();
  }

  function doPrestige() {
    const gain = nebulaGain();
    if (gain <= 0) return;
    if (!confirm(`転生して ${gain} ネビュラを獲得しますか？\n（スターダスト・ユニット・クリック強化はリセットされます。ネビュラ/強化/実績は保持）`)) return;
    state.nebula += gain;
    state.nebulaEarned += gain;
    state.lifetime.prestiges += 1;
    Object.assign(state, newRun());
    beep(300, 0.3, "sine", 0.06);
    checkAchievements();
    save();
    render();
  }

  function wipe() {
    if (!confirm("セーブデータを完全に消去します。よろしいですか？")) return;
    localStorage.removeItem(SAVE_KEY);
    state = newState();
    buildGeneratorCards();
    render();
  }

  // ---- 実績判定 ----
  function checkAchievements() {
    ACHIEVEMENTS.forEach((a) => {
      if (!state.achievements[a.id] && achDone(a, state)) {
        state.achievements[a.id] = true;
        toast(`実績解除: ${a.name}（全生産 +1%）`);
        beep(784, 0.12, "square", 0.05);
        setTimeout(() => beep(1047, 0.14, "square", 0.05), 90);
        burst(window.innerWidth / 2, window.innerHeight * 0.4, 18);
      }
    });
  }

  // ---- デイリーボーナス ----
  function todayIndex() { return Math.floor(Date.now() / DAY_MS); }
  function dailyAvailable() { return state.daily.lastClaimDay !== todayIndex(); }
  function claimDaily() {
    if (!dailyAvailable()) return;
    const today = todayIndex();
    state.daily.streak = state.daily.lastClaimDay === today - 1 ? state.daily.streak + 1 : 1;
    state.daily.lastClaimDay = today;
    const mult = Math.min(state.daily.streak, 7);
    const reward = Math.max(100, perSecond() * 1800) * mult; // 30分相当 × 連続日数(最大7)
    earn(reward);
    bumpStardust();
    burst(window.innerWidth / 2, window.innerHeight * 0.35, 20);
    toast(`デイリー ${state.daily.streak}日目: +${fmt(reward)}（×${mult}）`);
    beep(660, 0.1, "triangle"); setTimeout(() => beep(880, 0.12, "triangle"), 90);
    render();
  }

  // ---- 演出: 数値ポップ / パーティクル / フラッシュ ----
  function bumpStardust() {
    const e = dom.stardust;
    e.classList.remove("bump"); void e.offsetWidth; e.classList.add("bump");
  }
  function flashEl(elem) {
    if (!elem) return;
    elem.classList.remove("bought"); void elem.offsetWidth; elem.classList.add("bought");
    setTimeout(() => elem.classList.remove("bought"), 320);
  }
  function spawnParticles(clientX, clientY, n = 8, color = "#ffd24a") {
    const rect = dom.floaters.getBoundingClientRect();
    const x = (clientX ?? rect.left + rect.width / 2) - rect.left;
    const y = (clientY ?? rect.top + rect.height / 2) - rect.top;
    for (let i = 0; i < n; i++) {
      const p = document.createElement("div");
      p.className = "particle";
      const ang = Math.random() * Math.PI * 2;
      const dist = 30 + Math.random() * 50;
      p.style.left = `${x}px`; p.style.top = `${y}px`;
      p.style.background = color;
      p.style.setProperty("--dx", `${Math.cos(ang) * dist}px`);
      p.style.setProperty("--dy", `${Math.sin(ang) * dist}px`);
      dom.floaters.appendChild(p);
      setTimeout(() => p.remove(), 700);
    }
  }
  // 画面座標で大きめのバースト（実績解除・転生用）
  function burst(pageX, pageY, n = 16) {
    const rect = dom.floaters.getBoundingClientRect();
    spawnParticles(pageX, pageY, n, "#ffd24a");
    // floaters は tap-area 内なので、画面中央付近で出すために一時要素を body に
    for (let i = 0; i < n; i++) {
      const p = document.createElement("div");
      p.className = "particle burst";
      const ang = Math.random() * Math.PI * 2;
      const dist = 40 + Math.random() * 70;
      p.style.left = `${pageX}px`; p.style.top = `${pageY}px`;
      p.style.setProperty("--dx", `${Math.cos(ang) * dist}px`);
      p.style.setProperty("--dy", `${Math.sin(ang) * dist}px`);
      document.body.appendChild(p);
      setTimeout(() => p.remove(), 800);
    }
  }

  // ---- 演出: フローティング ----
  function spawnFloater(text, clientX, clientY, crit) {
    const rect = dom.floaters.getBoundingClientRect();
    const f = document.createElement("div");
    f.className = "floater" + (crit ? " crit" : "");
    f.textContent = text;
    const x = (clientX ?? rect.left + rect.width / 2) - rect.left;
    const y = (clientY ?? rect.top + rect.height / 2) - rect.top;
    f.style.left = `${x - 16 + (Math.random() * 24 - 12)}px`;
    f.style.top = `${y - 10}px`;
    dom.floaters.appendChild(f);
    setTimeout(() => f.remove(), 900);
  }

  // ---- 描画 ----
  function render() {
    dom.stardust.textContent = fmt(Math.floor(state.stardust));
    dom.perSecond.textContent = `毎秒 ${fmt(perSecond())}`;

    // クリック強化
    dom.perClick.textContent = fmt(perClick());
    dom.clickLevel.textContent = `Lv.${state.clickLevel}`;
    const cCost = clickCost();
    dom.clickCost.textContent = fmt(cCost);
    dom.clickUpgrade.classList.toggle("affordable", state.stardust >= cCost);

    // 自動生産（まとめ買い）
    GENERATORS.forEach((def, i) => {
      const { n, cost } = buyPlan(i);
      const affordable = n >= 1 && state.stardust >= cost;
      const countEl = dom.generators.querySelector(`[data-count="${i}"]`);
      const costEl = dom.generators.querySelector(`[data-cost="${i}"]`);
      if (countEl) countEl.textContent = `×${state.generators[i].count}`;
      if (costEl) {
        const qty = state.buyMode === "max" ? (n >= 1 ? `×${n}  ` : "×0  ") : "";
        costEl.textContent = qty + fmt(cost);
        costEl.classList.toggle("cant", !affordable);
      }
      const card = costEl && costEl.closest(".gen-card");
      if (card) card.classList.toggle("affordable", affordable);
    });

    // 恒久アップグレード
    el("upNebula").textContent = fmt(state.nebula);
    UPGRADES.forEach((u) => {
      const lv = upLevel(u.id);
      const lvEl = dom.upgrades.querySelector(`[data-uplv="${u.id}"]`);
      const descEl = dom.upgrades.querySelector(`[data-updesc="${u.id}"]`);
      const costEl = dom.upgrades.querySelector(`[data-upcost="${u.id}"]`);
      if (lvEl) lvEl.textContent = `Lv.${lv}/${u.max}`;
      if (descEl) descEl.textContent = u.desc(lv);
      const maxed = lv >= u.max;
      const cost = maxed ? 0 : u.cost(lv);
      if (costEl) {
        costEl.innerHTML = maxed ? "MAX" : `<span class="cost-ico">${ICONS.nebula}</span>${fmt(cost)}`;
        costEl.classList.toggle("cant", !maxed && state.nebula < cost);
      }
      const card = costEl && costEl.closest(".gen-card");
      if (card) card.classList.toggle("affordable", !maxed && state.nebula >= cost);
    });

    // 実績（達成率バー付き）
    const unlocked = achUnlockedCount();
    el("achCount").textContent = unlocked;
    el("achBonus").textContent = (unlocked * ACH_PER_BONUS * 100).toFixed(0);
    ACHIEVEMENTS.forEach((a) => {
      const done = !!state.achievements[a.id];
      const card = dom.achievements.querySelector(`[data-ach="${a.id}"]`);
      if (card) card.classList.toggle("locked", !done);
      const [curRaw, target] = a.prog(state);
      const cur = Math.min(curRaw, target);
      const bar = dom.achievements.querySelector(`[data-achbar="${a.id}"]`);
      const cnt = dom.achievements.querySelector(`[data-achcount="${a.id}"]`);
      if (bar) bar.style.width = `${Math.min(100, (curRaw / target) * 100)}%`;
      if (cnt) cnt.textContent = done
        ? `${a.desc}：達成 ✓`
        : `${a.desc} ${fmt(Math.floor(cur))}/${fmt(target)}`;
    });

    // 転生
    dom.nebula.textContent = fmt(state.nebula);
    dom.nebulaBonus.textContent = (state.nebulaEarned * NEBULA_PER_BONUS * 100).toFixed(0);
    const gain = nebulaGain();
    dom.nebulaGain.textContent = fmt(gain);
    dom.prestigeButton.disabled = gain <= 0;
    dom.prestigeHint.textContent =
      gain <= 0 ? `次のネビュラまで累計 ${fmt(NEBULA_DIVISOR * Math.pow(nebulaGain() + 1, 2))} の獲得が必要` : "";

    // デイリー / 設定表示
    el("dailyBanner").classList.toggle("hidden", !dailyAvailable());
    el("soundToggle").classList.toggle("off", !state.settings.sound);
    el("vibeToggle").classList.toggle("off", !state.settings.vibe);

    renderBoost();
  }

  function renderBoost() {
    const now = Date.now();
    const btn = dom.boostButton;
    if (!btn) return;
    dom.tapButton.classList.toggle("boosting", now < boostUntil);
    const ic = `<span class="btn-ico">${ICONS.boost}</span>`;
    if (now < boostUntil) {
      btn.innerHTML = `${ic}ブースト中 x${BOOST_MULT}（残り${Math.ceil((boostUntil - now) / 1000)}秒）`;
      btn.className = "boost active"; btn.disabled = true;
    } else if (now < boostCooldownUntil) {
      btn.innerHTML = `${ic}クールダウン（${Math.ceil((boostCooldownUntil - now) / 1000)}秒）`;
      btn.className = "boost cooldown"; btn.disabled = true;
    } else {
      btn.innerHTML = `${ic}ブースト（x${BOOST_MULT} / ${boostDuration() / 1000}秒）`;
      btn.className = "boost"; btn.disabled = false;
    }
  }

  // ---- ループ ----
  let acc = 0;
  function loop() {
    const inc = perSecond() * (TICK_MS / 1000);
    if (inc > 0) earn(inc);
    checkAchievements();
    render();
    acc += TICK_MS;
    if (acc >= SAVE_INTERVAL_MS) { acc = 0; save(); }
  }

  // ---- セーブ / ロード ----
  function save() {
    state.lastSeen = Date.now();
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(state));
      dom.saveStatus.textContent = `保存済 ${new Date().toLocaleTimeString("ja-JP")}`;
    } catch (e) { dom.saveStatus.textContent = "保存失敗"; }
  }

  function load() {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return;
    let data;
    try { data = JSON.parse(raw); } catch (e) { return; }
    state = Object.assign(newState(), data);
    // 旧バージョンからの移行・欠損補完
    state.upgrades = Object.assign({ click: 0, prod: 0, boost: 0, idle: 0 }, data.upgrades);
    state.achievements = data.achievements || {};
    state.lifetime = Object.assign({ earned: 0, taps: 0, prestiges: 0, boostUsed: false }, data.lifetime);
    state.daily = Object.assign({ lastClaimDay: -1, streak: 0 }, data.daily);
    state.settings = Object.assign({ sound: true, vibe: true }, data.settings);
    if (data.runEarned == null && data.totalEarned != null) state.runEarned = data.totalEarned;
    if (data.nebulaEarned == null) state.nebulaEarned = data.nebula || 0;
    if (!data.lifetime && data.totalEarned != null) state.lifetime.earned = data.totalEarned;
    state.generators = GENERATORS.map((g) => {
      const found = (data.generators || []).find((x) => x.id === g.id);
      return { id: g.id, count: found ? found.count : 0 };
    });
  }

  function applyOfflineEarnings() {
    const now = Date.now();
    const dt = Math.min((now - (state.lastSeen || now)) / 1000, offlineCapSec());
    if (dt < 5) return;
    const earned = perSecond() * dt * offlineRate();
    if (earned <= 0) return;
    earn(earned);
    el("offlineEarned").textContent = fmt(Math.floor(earned));
    const mins = Math.floor(dt / 60);
    el("offlineTime").textContent = `離席 ${Math.floor(mins / 60)}時間${mins % 60}分（上限${offlineCapSec() / 3600}時間 / 効率${(offlineRate() * 100).toFixed(0)}%）`;
    el("welcomeModal").classList.remove("hidden");
  }

  // ---- イベント結線 ----
  function bind() {
    dom.tapButton.addEventListener("pointerdown", (e) => { e.preventDefault(); tap(e.clientX, e.clientY); });
    dom.clickUpgrade.addEventListener("click", buyClickUpgrade);
    dom.prestigeButton.addEventListener("click", doPrestige);
    dom.boostButton.addEventListener("click", activateBoost);
    el("dailyBanner").addEventListener("click", claimDaily);
    el("wipeButton").addEventListener("click", wipe);
    el("welcomeClose").addEventListener("click", () => el("welcomeModal").classList.add("hidden"));

    el("soundToggle").addEventListener("click", () => { state.settings.sound = !state.settings.sound; if (state.settings.sound) beep(660); render(); });
    el("vibeToggle").addEventListener("click", () => { state.settings.vibe = !state.settings.vibe; vibrate(15); render(); });

    document.querySelectorAll(".bm").forEach((b) => {
      b.addEventListener("click", () => setBuyMode(b.dataset.mode === "max" ? "max" : Number(b.dataset.mode)));
    });

    document.querySelectorAll(".tab").forEach((tab) => {
      tab.addEventListener("click", () => {
        document.querySelectorAll(".tab").forEach((t) => t.classList.remove("active"));
        tab.classList.add("active");
        const name = tab.dataset.tab;
        ["shop", "upgrades", "achievements", "prestige"].forEach((n) =>
          el("tab-" + n).classList.toggle("hidden", n !== name));
      });
    });

    document.addEventListener("visibilitychange", () => { if (document.hidden) save(); });
    window.addEventListener("beforeunload", save);
  }

  // ---- 起動 ----
  function init() {
    dom = {
      stardust: el("stardust"), perSecond: el("perSecond"), tapButton: el("tapButton"),
      floaters: el("floaters"), perClick: el("perClick"), clickLevel: el("clickLevel"),
      clickCost: el("clickCost"), clickUpgrade: el("clickUpgrade"), generators: el("generators"),
      upgrades: el("upgrades"), achievements: el("achievements"),
      nebula: el("nebula"), nebulaBonus: el("nebulaBonus"), nebulaGain: el("nebulaGain"),
      prestigeButton: el("prestigeButton"), prestigeHint: el("prestigeHint"),
      saveStatus: el("saveStatus"), boostButton: el("boostButton"),
    };
    applyStaticIcons();
    el("dailyBanner").innerHTML = `<span class="btn-ico">${ICONS.gift}</span>デイリーボーナスを受け取る`;
    el("soundToggle").innerHTML = ICONS.sound;
    el("vibeToggle").innerHTML = ICONS.vibe;
    buildGeneratorCards();
    buildUpgradeCards();
    buildAchievementCards();
    load();
    bind();
    setBuyMode(state.buyMode || 1);
    applyOfflineEarnings();
    checkAchievements();
    render();
    setInterval(loop, TICK_MS);

    if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
  }

  document.addEventListener("DOMContentLoaded", init);
})();
