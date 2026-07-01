// ===== 進捗データ（実績・デイリー・チュートリアル）。セーブとは別枠で永続化 =====
import { slotSuffix } from "./slot.ts";

export interface Progress {
  /** 受け取り済みの実績ID */
  claimed: string[];
  /** 累計パーフェクトガード回数 */
  perfectsTotal: number;
  /** 累計撃破数 */
  killsTotal: number;
  /** ノーダメージでクリアした回数 */
  flawlessClears: number;
  /** ランクSでクリアした累計回数 */
  rankSClears: number;
  /** 乱入ボスを討伐した累計回数 */
  ambushWins: number;
  /** デイリーを最後に受け取った日付（YYYY-MM-DD） */
  dailyLast: string;
  /** デイリー連続受け取り日数 */
  dailyStreak: number;
  /** デイリーミッションの対象日（YYYY-MM-DD。日が変わると進捗リセット） */
  missionDay: string;
  /** 当日のミッション進捗（ミッションID → 進捗値） */
  missionProg: Record<string, number>;
  /** 当日に受け取り済みのミッションID */
  missionClaimed: string[];
  /** 初回チュートリアルを見たか */
  tutorialDone: boolean;
}

const KEY = "astral-warden-progress-v1" + slotSuffix();
const DEFAULTS: Progress = {
  claimed: [], perfectsTotal: 0, killsTotal: 0, flawlessClears: 0,
  rankSClears: 0, ambushWins: 0,
  dailyLast: "", dailyStreak: 0,
  missionDay: "", missionProg: {}, missionClaimed: [],
  tutorialDone: false,
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
      rankSClears: p.rankSClears ?? 0,
      ambushWins: p.ambushWins ?? 0,
      dailyLast: typeof p.dailyLast === "string" ? p.dailyLast : "",
      dailyStreak: p.dailyStreak ?? 0,
      missionDay: typeof p.missionDay === "string" ? p.missionDay : "",
      missionProg: p.missionProg && typeof p.missionProg === "object" ? p.missionProg : {},
      missionClaimed: Array.isArray(p.missionClaimed) ? p.missionClaimed : [],
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

// ===== デイリーミッション（毎日リセット・進捗達成で報酬） =====
export interface DailyMission {
  id: string; name: string; goal: number; reward: number;
}
export const DAILY_MISSIONS: DailyMission[] = [
  { id: "dm_clear", name: "ダンジョンを3回クリア", goal: 3, reward: 150 },
  { id: "dm_perfect", name: "パーフェクトガードを8回", goal: 8, reward: 150 },
  { id: "dm_kill", name: "敵を30体撃破", goal: 30, reward: 120 },
  { id: "dm_rank", name: "ランクA以上で1回クリア", goal: 1, reward: 200 },
];

/** 日付が変わっていたらミッション進捗をリセットする */
function ensureMissionDay(): void {
  const today = todayStr();
  if (progress.missionDay !== today) {
    progress.missionDay = today;
    progress.missionProg = {};
    progress.missionClaimed = [];
    saveProgress();
  }
}
/** ミッション進捗を加算（上限はgoal）。日替わりは内部で処理 */
export function addMissionProgress(id: string, n = 1): void {
  ensureMissionDay();
  const m = DAILY_MISSIONS.find((x) => x.id === id);
  if (!m || n <= 0) return;
  const cur = progress.missionProg[id] ?? 0;
  if (cur >= m.goal) return;
  progress.missionProg[id] = Math.min(m.goal, cur + n);
  saveProgress();
}
/** 当日のミッション進捗値 */
export function missionProgress(id: string): number {
  ensureMissionDay();
  return progress.missionProg[id] ?? 0;
}
/** 受け取り可能か（達成済みかつ未受領） */
export function missionClaimable(id: string): boolean {
  const m = DAILY_MISSIONS.find((x) => x.id === id);
  if (!m) return false;
  return missionProgress(id) >= m.goal && !progress.missionClaimed.includes(id);
}
/** ミッション報酬を受け取る。受け取ったゴールド額を返す（不可時0） */
export function claimMission(id: string): number {
  if (!missionClaimable(id)) return 0;
  const m = DAILY_MISSIONS.find((x) => x.id === id)!;
  progress.missionClaimed.push(id);
  saveProgress();
  return m.reward;
}
/** 受け取り可能なミッションが1つでもあるか（ホームの通知用） */
export function missionsAvailable(): boolean {
  return DAILY_MISSIONS.some((m) => missionClaimable(m.id));
}

// ===== 実績 =====
export interface AchCtx {
  bestStage: number; bestFloor: number; invCount: number;
  perfects: number; kills: number; flawless: number;
  rankS: number; ambushWins: number; totalStars: number; streak: number;
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
  { id: "rank_s_first", name: "完全勝利", desc: "ランクSでクリア", goal: 1, reward: 400, cur: (c) => c.rankS },
  { id: "rank_s_10", name: "至高の守人", desc: "ランクSを10回達成", goal: 10, reward: 1200, cur: (c) => c.rankS },
  { id: "ambush_slayer", name: "次元の裂け目を断つ", desc: "乱入レアボスを討伐", goal: 1, reward: 800, cur: (c) => c.ambushWins },
  { id: "star_master", name: "星集めの達人", desc: "攻略スターを合計30個獲得", goal: 30, reward: 1000, cur: (c) => c.totalStars },
  { id: "daily7", name: "皆勤賞", desc: "デイリーを7日連続で受け取る", goal: 7, reward: 700, cur: (c) => c.streak },
];
