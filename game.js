/* Stardust Clicker — MVP core logic (Vanilla JS)
 * 市場調査で抽出したコアメカニクス F1-F7 を最小構成で実装。
 */
(() => {
  "use strict";

  const SAVE_KEY = "stardust-clicker-save-v1";
  const TICK_MS = 100;                 // ゲームループ周期
  const SAVE_INTERVAL_MS = 5000;       // 自動保存周期
  const OFFLINE_CAP_SEC = 8 * 3600;    // 放置報酬の上限（8時間）
  const NEBULA_PER_BONUS = 0.02;       // ネビュラ1個あたり +2%
  const NEBULA_DIVISOR = 1e6;          // 転生獲得式の基準値

  // 自動生産ユニット定義（価格は count に対して指数上昇）
  const GENERATORS = [
    { id: "drone",   name: "探査ドローン",     icon: "🛰️", baseCost: 15,     costMul: 1.15, rate: 0.2 },
    { id: "miner",   name: "採掘ロボ",         icon: "🤖", baseCost: 120,    costMul: 1.15, rate: 1.5 },
    { id: "station", name: "宇宙ステーション", icon: "🛸", baseCost: 1300,   costMul: 1.16, rate: 9   },
    { id: "warp",    name: "ワープゲート",     icon: "🌀", baseCost: 14000,  costMul: 1.17, rate: 55  },
    { id: "dyson",   name: "ダイソン球",       icon: "☀️", baseCost: 200000, costMul: 1.18, rate: 350 },
  ];

  // クリック強化
  const CLICK_BASE_COST = 25;
  const CLICK_COST_MUL = 1.6;

  // QoL: まとめ買い / タップブースト
  const BOOST_MULT = 2;                  // ブースト中の倍率
  const BOOST_DURATION_MS = 30000;       // ブースト持続
  const BOOST_COOLDOWN_MS = 120000;      // 再使用までのクールダウン
  let boostUntil = 0;                    // ブースト終了時刻（保存しない）
  let boostCooldownUntil = 0;            // クールダウン終了時刻（保存しない）

  // ---- State ----
  let state = newState();

  function newState() {
    return {
      stardust: 0,
      totalEarned: 0,   // 今回の転生周期での累計（転生獲得計算用）
      clickLevel: 0,
      generators: GENERATORS.map((g) => ({ id: g.id, count: 0 })),
      nebula: 0,
      buyMode: 1,        // 1 | 10 | "max"
      lastSeen: Date.now(),
    };
  }

  // ---- 派生値 ----
  function nebulaMultiplier() { return 1 + state.nebula * NEBULA_PER_BONUS; }
  function boostActive() { return Date.now() < boostUntil; }
  function boostMultiplier() { return boostActive() ? BOOST_MULT : 1; }
  function globalMultiplier() { return nebulaMultiplier() * boostMultiplier(); }

  function perClick() { return (1 + state.clickLevel) * globalMultiplier(); }
  function clickCost() { return Math.floor(CLICK_BASE_COST * Math.pow(CLICK_COST_MUL, state.clickLevel)); }

  // i 番目のユニットを現在の所持数から n 個買うときの合計コスト（等比数列の和）
  function genCostN(i, n) {
    const def = GENERATORS[i];
    const mul = def.costMul;
    const first = def.baseCost * Math.pow(mul, state.generators[i].count);
    return Math.floor((first * (Math.pow(mul, n) - 1)) / (mul - 1));
  }

  // 現在の所持スターダストで i 番目を最大何個買えるか
  function maxAffordable(i) {
    const def = GENERATORS[i];
    const mul = def.costMul;
    const first = def.baseCost * Math.pow(mul, state.generators[i].count);
    const n = Math.floor(Math.log(1 + (state.stardust * (mul - 1)) / first) / Math.log(mul));
    return Math.max(0, n);
  }

  // 現在の buyMode に応じた「購入数」と「合計コスト」
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
    return raw * globalMultiplier();
  }

  function nebulaGain() {
    return Math.floor(Math.sqrt(state.totalEarned / NEBULA_DIVISOR));
  }

  // ---- 数値の桁表記 ----
  const SUFFIX = ["", "K", "M", "B", "T", "Qa", "Qi", "Sx", "Sp", "Oc", "No", "Dc"];
  function fmt(n) {
    if (n < 1000) return Number.isInteger(n) ? String(n) : n.toFixed(1);
    let tier = Math.floor(Math.log10(n) / 3);
    if (tier >= SUFFIX.length) tier = SUFFIX.length - 1;
    const scaled = n / Math.pow(10, tier * 3);
    return scaled.toFixed(2) + SUFFIX[tier];
  }

  // ---- 資源の獲得 ----
  function earn(amount) {
    state.stardust += amount;
    state.totalEarned += amount;
  }

  // ---- DOM ----
  const el = (id) => document.getElementById(id);
  const dom = {
    stardust: el("stardust"),
    perSecond: el("perSecond"),
    tapButton: el("tapButton"),
    floaters: el("floaters"),
    perClick: el("perClick"),
    clickLevel: el("clickLevel"),
    clickCost: el("clickCost"),
    clickUpgrade: el("clickUpgrade"),
    generators: el("generators"),
    nebula: el("nebula"),
    nebulaBonus: el("nebulaBonus"),
    nebulaGain: el("nebulaGain"),
    prestigeButton: el("prestigeButton"),
    prestigeHint: el("prestigeHint"),
    saveStatus: el("saveStatus"),
    boostButton: el("boostButton"),
  };

  // 生成: 自動生産ユニットのカード
  function buildGeneratorCards() {
    dom.generators.innerHTML = "";
    GENERATORS.forEach((def, i) => {
      const card = document.createElement("div");
      card.className = "gen-card";
      card.innerHTML = `
        <div class="gen-icon">${def.icon}</div>
        <div class="gen-body">
          <div class="gen-name">${def.name}<span class="gen-count" data-count="${i}">×0</span></div>
          <div class="gen-desc">毎秒 +${fmt(def.rate)} / 個</div>
        </div>
        <div class="gen-cost" data-cost="${i}">${fmt(def.baseCost)}</div>`;
      card.addEventListener("click", () => buyGenerator(i));
      dom.generators.appendChild(card);
    });
  }

  // ---- アクション ----
  function tap(clientX, clientY) {
    const gain = perClick();
    earn(gain);
    spawnFloater(`+${fmt(gain)}`, clientX, clientY);
    render();
  }

  function buyClickUpgrade() {
    const cost = clickCost();
    if (state.stardust < cost) return;
    state.stardust -= cost;
    state.clickLevel += 1;
    render();
  }

  function buyGenerator(i) {
    const { n, cost } = buyPlan(i);
    if (n < 1 || state.stardust < cost) return;
    state.stardust -= cost;
    state.generators[i].count += n;
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
    boostUntil = now + BOOST_DURATION_MS;
    boostCooldownUntil = boostUntil + BOOST_COOLDOWN_MS;
    render();
  }

  function doPrestige() {
    const gain = nebulaGain();
    if (gain <= 0) return;
    if (!confirm(`転生して ${gain} ネビュラを獲得しますか？\n（スターダストと所持ユニットはリセットされます）`)) return;
    const keptNebula = state.nebula + gain;
    state = newState();
    state.nebula = keptNebula;
    save();
    render();
  }

  function wipe() {
    if (!confirm("セーブデータを完全に消去します。よろしいですか？")) return;
    localStorage.removeItem(SAVE_KEY);
    state = newState();
    render();
  }

  // ---- フローティング演出 ----
  function spawnFloater(text, clientX, clientY) {
    const rect = dom.floaters.getBoundingClientRect();
    const f = document.createElement("div");
    f.className = "floater";
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

    // 自動生産（まとめ買い対応）
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

    renderBoost();

    // 転生
    dom.nebula.textContent = fmt(state.nebula);
    dom.nebulaBonus.textContent = (state.nebula * NEBULA_PER_BONUS * 100).toFixed(0);
    const gain = nebulaGain();
    dom.nebulaGain.textContent = fmt(gain);
    dom.prestigeButton.disabled = gain <= 0;
    dom.prestigeHint.textContent =
      gain <= 0 ? `次のネビュラまで累計 ${fmt(NEBULA_DIVISOR * Math.pow(state.nebula + 1, 2))} の獲得が必要` : "";
  }

  function renderBoost() {
    const now = Date.now();
    const btn = dom.boostButton;
    if (!btn) return;
    if (now < boostUntil) {
      const s = Math.ceil((boostUntil - now) / 1000);
      btn.textContent = `⚡ ブースト中 x${BOOST_MULT}（残り${s}秒）`;
      btn.className = "boost active";
      btn.disabled = true;
    } else if (now < boostCooldownUntil) {
      const s = Math.ceil((boostCooldownUntil - now) / 1000);
      btn.textContent = `⏳ クールダウン（${s}秒）`;
      btn.className = "boost cooldown";
      btn.disabled = true;
    } else {
      btn.textContent = `⚡ ブースト（x${BOOST_MULT} / ${BOOST_DURATION_MS / 1000}秒）`;
      btn.className = "boost";
      btn.disabled = false;
    }
  }

  // ---- ゲームループ ----
  let acc = 0;
  function loop() {
    const inc = perSecond() * (TICK_MS / 1000);
    if (inc > 0) earn(inc);
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
    } catch (e) {
      dom.saveStatus.textContent = "保存失敗";
    }
  }

  function load() {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return false;
    try {
      const data = JSON.parse(raw);
      state = Object.assign(newState(), data);
      // ジェネレータ定義の追加に備えてマージ
      state.generators = GENERATORS.map((g) => {
        const found = (data.generators || []).find((x) => x.id === g.id);
        return { id: g.id, count: found ? found.count : 0 };
      });
      return true;
    } catch (e) {
      return false;
    }
  }

  function applyOfflineEarnings() {
    const now = Date.now();
    const dt = Math.min((now - (state.lastSeen || now)) / 1000, OFFLINE_CAP_SEC);
    if (dt < 5) return; // 5秒未満は無視
    const earned = perSecond() * dt;
    if (earned <= 0) return;
    earn(earned);
    showWelcome(earned, dt);
  }

  function showWelcome(earned, dt) {
    el("offlineEarned").textContent = fmt(Math.floor(earned));
    const mins = Math.floor(dt / 60);
    const hrs = Math.floor(mins / 60);
    el("offlineTime").textContent =
      `離席時間: ${hrs > 0 ? hrs + "時間" : ""}${mins % 60}分（上限8時間）`;
    el("welcomeModal").classList.remove("hidden");
  }

  // ---- イベント結線 ----
  function bind() {
    // タップ（pointer で PC/スマホ両対応）
    dom.tapButton.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      tap(e.clientX, e.clientY);
    });
    dom.clickUpgrade.addEventListener("click", buyClickUpgrade);
    dom.prestigeButton.addEventListener("click", doPrestige);
    dom.boostButton.addEventListener("click", activateBoost);

    // まとめ買いモード
    document.querySelectorAll(".bm").forEach((b) => {
      b.addEventListener("click", () => {
        const m = b.dataset.mode === "max" ? "max" : Number(b.dataset.mode);
        setBuyMode(m);
      });
    });
    el("wipeButton").addEventListener("click", wipe);
    el("welcomeClose").addEventListener("click", () =>
      el("welcomeModal").classList.add("hidden"));

    // タブ切り替え
    document.querySelectorAll(".tab").forEach((tab) => {
      tab.addEventListener("click", () => {
        document.querySelectorAll(".tab").forEach((t) => t.classList.remove("active"));
        tab.classList.add("active");
        const name = tab.dataset.tab;
        el("tab-shop").classList.toggle("hidden", name !== "shop");
        el("tab-prestige").classList.toggle("hidden", name !== "prestige");
      });
    });

    // 離脱時に保存
    document.addEventListener("visibilitychange", () => { if (document.hidden) save(); });
    window.addEventListener("beforeunload", save);
  }

  // ---- 起動 ----
  function init() {
    buildGeneratorCards();
    load();
    bind();
    setBuyMode(state.buyMode || 1);
    applyOfflineEarnings();
    render();
    setInterval(loop, TICK_MS);

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("sw.js").catch(() => {});
    }
  }

  document.addEventListener("DOMContentLoaded", init);
})();
