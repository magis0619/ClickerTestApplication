// ===== 進捗データ（実績・デイリー・チュートリアル）。セーブとは別枠で永続化 =====

export interface Progress {
  /** 受け取り済みの実績ID */
  claimed: string[];
  /** 累計パーフェクトガード回数 */
  perfectsTotal: number;
  /** 累計撃破数 */
  killsTotal: number;
  /** ノーダメージでクリアした回数 */
  flawlessClears: number;
  /** デイリーを最後に受け取った日付（YYYY-MM-DD） */
  dailyLast: string;
  /** デイリー連続受け取り日数 */
  dailyStreak: number;
  /** 初回チュートリアルを見たか */
  tutorialDone: boolean;
}

const KEY = "astral-warden-progress-v1";
const DEFAULTS: Progress = {
  claimed: [], perfectsTotal: 0, killsTotal: 0, flawlessClears: 0,
  dailyLast: "", dailyStreak: 0, tutorialDone: false,
};

function load(): Progress {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULTS };
    const p = JSON.parse(raw) as Partial<Progress>;
    return {
      claimed: Array.isArray(p.claimed) ? p.claimed : [],
      perfectsTotal: p.perfectsTotal ?? 0,
      killsTotal: p.killsTotal ?? 0,
      flawlessClears: p.flawlessClears ?? 0,
      dailyLast: typeof p.dailyLast === "string" ? p.dailyLast : "",
      dailyStreak: p.dailyStreak ?? 0,
      tutorialDone: !!p.tutorialDone,
    };
  } catch {
    return { ...DEFAULTS };
  }
}

export const progress: Progress = load();
export function saveProgress(): void {
  try { localStorage.setItem(KEY, JSON.stringify(progress)); } catch { /* 無視 */ }
}

/** 今日の日付（ローカル, YYYY-MM-DD） */
export function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
/** 昨日の日付（連続判定用） */
function yesterdayStr(): string {
  const d = new Date(); d.setDate(d.getDate() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** デイリーボーナスを受け取れるか（今日まだ受け取っていない） */
export function dailyAvailable(): boolean {
  return progress.dailyLast !== todayStr();
}
/** デイリー受け取り。受け取ったゴールド額を返す（不可時は0）。連続日数も更新 */
export function claimDaily(): { gold: number; streak: number } {
  if (!dailyAvailable()) return { gold: 0, streak: progress.dailyStreak };
  progress.dailyStreak = progress.dailyLast === yesterdayStr() ? progress.dailyStreak + 1 : 1;
  progress.dailyLast = todayStr();
  const gold = 100 + Math.min(6, progress.dailyStreak - 1) * 40; // 連続で増加（上限 +240）
  saveProgress();
  return { gold, streak: progress.dailyStreak };
}

// ===== 実績 =====
export interface AchCtx {
  bestStage: number; bestFloor: number; invCount: number;
  perfects: number; kills: number; flawless: number;
}
export interface AchDef {
  id: string; name: string; desc: string; goal: number; reward: number;
  cur: (c: AchCtx) => number;
}
export const ACHIEVEMENTS: AchDef[] = [
  { id: "first_clear", name: "初陣", desc: "最初のダンジョンをクリア", goal: 1, reward: 100, cur: (c) => c.bestStage },
  { id: "world1", name: "森の覇者", desc: "ワールド1（5ダンジョン）を制覇", goal: 5, reward: 400, cur: (c) => c.bestStage },
  { id: "world3", name: "凍土到達", desc: "ワールド3まで到達", goal: 8, reward: 800, cur: (c) => c.bestStage },
  { id: "allworlds", name: "星辰の王", desc: "全ワールドを制覇", goal: 16, reward: 3000, cur: (c) => c.bestStage },
  { id: "collector", name: "収集家", desc: "武器を20個集める", goal: 20, reward: 300, cur: (c) => c.invCount },
  { id: "corridor10", name: "回廊の探究者", desc: "無限の回廊で10階到達", goal: 10, reward: 500, cur: (c) => c.bestFloor },
  { id: "perfect50", name: "完璧主義者", desc: "パーフェクトガード累計50回", goal: 50, reward: 600, cur: (c) => c.perfects },
  { id: "kills100", name: "百戦錬磨", desc: "敵を累計100体撃破", goal: 100, reward: 600, cur: (c) => c.kills },
  { id: "flawless", name: "無傷の守人", desc: "ノーダメージでクリア", goal: 1, reward: 500, cur: (c) => c.flawless },
];
