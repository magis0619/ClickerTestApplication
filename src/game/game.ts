import { Battle } from "./engine.ts";
import {
  ENEMIES,
  STAGE_COUNT,
  SKILLS,
  effectiveSkill,
  upgradeCost,
  STAGE_HEAL_RATIO,
  PLAYER_MAX_HP,
  PLAYER_MAX_EN,
} from "./data.ts";
import { loadSave, writeSave } from "./save.ts";
import type { Screen, SaveData, Skill } from "./types.ts";

/**
 * ゲーム全体の進行管理。
 * ダンジョン（複数ステージ）・報酬・スキル育成・敗北を1つの状態機械で扱う。
 */
export class Game {
  save: SaveData;
  screen: Screen = "battle";
  /** 現在のステージ番号（0始まり） */
  stageIndex = 0;
  /** ステージ間で引き継ぐプレイヤーHP */
  playerHp = PLAYER_MAX_HP;
  battle: Battle;
  /** 直近で得た霊片（報酬画面表示用） */
  lastReward = 0;

  constructor() {
    this.save = loadSave();
    this.battle = this.makeBattle();
  }

  private makeBattle(): Battle {
    return new Battle(ENEMIES[this.stageIndex], this.playerHp, PLAYER_MAX_EN);
  }

  /** 現在の強化レベルを反映した実効スキル一覧 */
  effectiveSkills(): Skill[] {
    return SKILLS.map((s) => effectiveSkill(s, this.skillLevel(s.id)));
  }

  skillLevel(id: string): number {
    return this.save.skillLevels[id] ?? 1;
  }

  costFor(id: string): number {
    return upgradeCost(this.skillLevel(id));
  }

  canUpgrade(id: string): boolean {
    return this.save.shards >= this.costFor(id);
  }

  upgrade(id: string): boolean {
    if (!this.canUpgrade(id)) return false;
    this.save.shards -= this.costFor(id);
    this.save.skillLevels[id] = this.skillLevel(id) + 1;
    writeSave(this.save);
    return true;
  }

  update(dt: number): void {
    this.battle.update(dt);
    if (this.screen !== "battle") return;
    if (this.battle.phase === "won") this.onWin();
    else if (this.battle.phase === "lost") this.onLose();
  }

  private onWin(): void {
    const enemy = ENEMIES[this.stageIndex];
    this.lastReward = enemy.reward;
    this.save.shards += enemy.reward;
    const stageNum = this.stageIndex + 1;
    if (stageNum > this.save.bestStage) this.save.bestStage = stageNum;
    // HPを引き継ぎつつ一定割合回復
    this.playerHp = Math.min(
      PLAYER_MAX_HP,
      this.battle.playerHp + Math.round(PLAYER_MAX_HP * STAGE_HEAL_RATIO),
    );
    writeSave(this.save);
    this.screen = stageNum >= STAGE_COUNT ? "clear" : "reward";
  }

  private onLose(): void {
    this.screen = "gameover";
  }

  /** 報酬画面 → 次ステージへ */
  next(): void {
    if (this.screen !== "reward") return;
    this.stageIndex += 1;
    this.battle = this.makeBattle();
    this.screen = "battle";
  }

  /** ダンジョンを最初からやり直し（育成・霊片は保持） */
  restartRun(): void {
    this.stageIndex = 0;
    this.playerHp = PLAYER_MAX_HP;
    this.battle = this.makeBattle();
    this.screen = "battle";
  }
}
