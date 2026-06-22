import type { Skill, EnemyDef, GuardResult, BattlePhase } from "./types.ts";
import {
  WEAKNESS,
  WEAKNESS_MULTIPLIER,
  PLAYER_MAX_HP,
  PLAYER_MAX_EN,
  EN_REGEN_PER_SEC,
  GUARD_WINDOW_MS,
  JUST_WINDOW_MS,
  PARRY_WINDOW_MS,
  GUARD_DAMAGE_MULT,
  JUST_DAMAGE_MULT,
  JUST_EN_RECOVER,
  PARRY_HP_RECOVER,
  BREAK_DURATION_MS,
  BREAK_CRIT_MULT,
  BREAK_EN_RECOVER,
} from "./data.ts";

/** 画面に一瞬表示される演出テキスト */
export interface FloatText {
  text: string;
  color: string;
  /** 残り表示時間(ms) */
  ttl: number;
  /** 出現位置（"player" | "enemy" | "center"） */
  anchor: "player" | "enemy" | "center";
  /** 上方向への移動量蓄積 */
  rise: number;
}

/** 進行中の敵攻撃（予兆） */
interface PendingAttack {
  /** 予兆開始からの経過(ms) */
  elapsed: number;
  /** 着弾までの時間(ms) */
  landAt: number;
  /** すでにガード入力を受け付けたか */
  resolved: boolean;
}

export class Battle {
  phase: BattlePhase = "fighting";

  playerHp = PLAYER_MAX_HP;
  playerEn = PLAYER_MAX_EN;

  enemy: EnemyDef;
  enemyHp: number;
  /** ブレイク蓄積量 */
  breakGauge = 0;
  /** ブレイク残り時間(ms)。0なら非ブレイク */
  breakRemain = 0;

  /** 次の敵攻撃までのカウントダウン(ms) */
  private nextAttackIn: number;
  pending: PendingAttack | null = null;

  floats: FloatText[] = [];
  /** 直近のガード結果（HUD表示用） */
  lastGuard: GuardResult = "none";
  lastGuardTtl = 0;

  constructor(enemy: EnemyDef, startHp: number = PLAYER_MAX_HP, startEn: number = PLAYER_MAX_EN) {
    this.enemy = enemy;
    this.enemyHp = enemy.maxHp;
    this.nextAttackIn = enemy.intervalMs;
    this.playerHp = Math.max(1, Math.min(PLAYER_MAX_HP, startHp));
    this.playerEn = Math.max(0, Math.min(PLAYER_MAX_EN, startEn));
  }

  get isBroken(): boolean {
    return this.breakRemain > 0;
  }

  /** スキル使用（プレイヤー攻撃）。成功したらtrue */
  useSkill(skill: Skill): boolean {
    if (this.phase !== "fighting") return false;
    if (this.playerEn < skill.enCost) {
      this.pushFloat("ENが足りない", "#ffcc55", "player");
      return false;
    }
    this.playerEn -= skill.enCost;

    // ダメージ計算：弱点補正 → ブレイク中の会心補正
    let dmg = skill.power;
    const weak = WEAKNESS[this.enemy.kind] === skill.weapon;
    if (weak) dmg *= WEAKNESS_MULTIPLIER;

    if (this.isBroken) {
      dmg *= BREAK_CRIT_MULT;
      this.playerEn = Math.min(PLAYER_MAX_EN, this.playerEn + BREAK_EN_RECOVER);
    }
    dmg = Math.round(dmg);

    this.enemyHp = Math.max(0, this.enemyHp - dmg);

    // 演出
    const label = weak ? `${dmg} 弱点!` : this.isBroken ? `${dmg} 会心!` : `${dmg}`;
    this.pushFloat(label, weak || this.isBroken ? "#ff5577" : "#ffffff", "enemy");

    // ブレイク蓄積（ブレイク中は蓄積しない）
    if (!this.isBroken) {
      this.breakGauge += skill.breakPower;
      if (this.breakGauge >= this.enemy.breakThreshold) {
        this.triggerBreak();
      }
    }

    if (this.enemyHp <= 0) {
      this.phase = "won";
      this.pushFloat("BATTLE WON", "#66ddff", "center");
    }
    return true;
  }

  private triggerBreak(): void {
    this.breakRemain = BREAK_DURATION_MS;
    this.breakGauge = 0;
    this.pending = null; // ブレイク中は敵の攻撃を中断
    this.pushFloat("BREAK!!", "#ffdd44", "enemy");
  }

  /** プレイヤーのガード入力 */
  guard(): void {
    if (this.phase !== "fighting") return;
    if (!this.pending || this.pending.resolved) {
      // 空振りガード（軽いペナルティはなし、ただし演出のみ）
      this.setGuard("none");
      return;
    }
    const diff = Math.abs(this.pending.landAt - this.pending.elapsed);
    let result: GuardResult;
    if (diff <= PARRY_WINDOW_MS) result = "parry";
    else if (diff <= JUST_WINDOW_MS) result = "just";
    else if (diff <= GUARD_WINDOW_MS) result = "guard";
    else result = "none";

    if (result === "none") {
      // 早すぎ／遅すぎ：判定は確定させず空振り扱い（着弾でフルダメージ）
      this.setGuard("none");
      return;
    }

    // ガード成立：着弾を即時解決
    this.resolveEnemyHit(result);
    this.pending.resolved = true;
    this.pending = null;
    this.nextAttackIn = this.enemy.intervalMs;
  }

  /** 敵の攻撃が着弾したときの処理 */
  private resolveEnemyHit(guard: GuardResult): void {
    let dmg = this.enemy.attack;
    this.setGuard(guard);

    switch (guard) {
      case "parry":
        dmg = 0;
        this.playerHp = Math.min(PLAYER_MAX_HP, this.playerHp + PARRY_HP_RECOVER);
        this.pushFloat(`PARRY! +${PARRY_HP_RECOVER}HP`, "#66ffaa", "player");
        break;
      case "just":
        dmg = Math.round(dmg * JUST_DAMAGE_MULT);
        this.playerEn = Math.min(PLAYER_MAX_EN, this.playerEn + JUST_EN_RECOVER);
        this.pushFloat(`JUST! +${JUST_EN_RECOVER}EN`, "#88ddff", "player");
        break;
      case "guard":
        dmg = Math.round(dmg * GUARD_DAMAGE_MULT);
        this.pushFloat(`GUARD ${dmg}`, "#cccccc", "player");
        break;
      case "none":
        this.pushFloat(`${dmg}`, "#ff5555", "player");
        break;
    }

    if (dmg > 0) {
      this.playerHp = Math.max(0, this.playerHp - dmg);
      if (this.playerHp <= 0) {
        this.phase = "lost";
        this.pushFloat("DEFEATED", "#ff5555", "center");
      }
    }
  }

  update(dtMs: number): void {
    // 演出の更新
    for (const f of this.floats) {
      f.ttl -= dtMs;
      f.rise += dtMs * 0.03;
    }
    this.floats = this.floats.filter((f) => f.ttl > 0);
    if (this.lastGuardTtl > 0) this.lastGuardTtl -= dtMs;

    if (this.phase !== "fighting") return;

    // EN自然回復
    this.playerEn = Math.min(PLAYER_MAX_EN, this.playerEn + (EN_REGEN_PER_SEC * dtMs) / 1000);

    // ブレイク継続時間
    if (this.breakRemain > 0) {
      this.breakRemain = Math.max(0, this.breakRemain - dtMs);
      return; // ブレイク中は敵は動かない
    }

    // 敵の攻撃進行
    if (this.pending) {
      this.pending.elapsed += dtMs;
      if (this.pending.elapsed >= this.pending.landAt && !this.pending.resolved) {
        // 時間切れ：ガード入力なし → フルダメージ
        this.resolveEnemyHit("none");
        this.pending.resolved = true;
        this.pending = null;
        this.nextAttackIn = this.enemy.intervalMs;
      }
    } else {
      this.nextAttackIn -= dtMs;
      if (this.nextAttackIn <= 0) {
        this.pending = { elapsed: 0, landAt: this.enemy.telegraphMs, resolved: false };
      }
    }
  }

  private setGuard(result: GuardResult): void {
    this.lastGuard = result;
    this.lastGuardTtl = 700;
  }

  private pushFloat(text: string, color: string, anchor: FloatText["anchor"]): void {
    this.floats.push({ text, color, ttl: 900, anchor, rise: 0 });
  }
}
