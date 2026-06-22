import type { Skill, EnemyDef, GuardResult, BattlePhase } from "./types.ts";
import {
  WEAKNESS,
  WEAKNESS_MULTIPLIER,
  PLAYER_MAX_HP,
  PLAYER_MAX_EN,
  CHARGE_MULT,
  REST_EN_RECOVER,
  GUARD_EN_RECOVER,
  JUST_EN_RECOVER,
  PARRY_EN_RECOVER,
  GUARD_WINDOW_MS,
  JUST_WINDOW_MS,
  PARRY_WINDOW_MS,
  GUARD_DAMAGE_MULT,
  JUST_DAMAGE_MULT,
  PARRY_HP_RECOVER,
  BREAK_DURATION_MS,
  BREAK_CRIT_MULT,
} from "./data.ts";

export interface FloatText {
  text: string;
  color: string;
  ttl: number;
  /** 出現位置（enemyの場合はインデックス） */
  anchor: "player" | "center" | number;
  rise: number;
}

/** 戦闘中の敵1体の状態 */
export class EnemyState {
  def: EnemyDef;
  hp: number;
  breakGauge = 0;
  breakRemain = 0;
  /** 次の攻撃までの残り時間(ms) */
  atkTimer: number;

  constructor(def: EnemyDef) {
    this.def = def;
    this.hp = def.maxHp;
    this.atkTimer = def.intervalMs;
  }

  get alive(): boolean {
    return this.hp > 0;
  }
  get isBroken(): boolean {
    return this.breakRemain > 0;
  }
  /** 予兆中（着弾までtelegraph時間以内）か */
  get inTelegraph(): boolean {
    return this.alive && !this.isBroken && this.atkTimer <= this.def.telegraphMs;
  }
  /** 頭上に出す攻撃カウント（秒）。予兆中は0扱い */
  get count(): number {
    return Math.max(0, Math.ceil((this.atkTimer - this.def.telegraphMs) / 1000));
  }
}

export class Battle {
  phase: BattlePhase = "fighting";
  playerHp: number;
  playerEn: number;
  /** ためる中の倍率（1なら通常） */
  charge = 1;

  enemies: EnemyState[];
  targetIndex = 0;

  floats: FloatText[] = [];
  lastGuard: GuardResult = "none";
  lastGuardTtl = 0;

  constructor(defs: EnemyDef[], startHp: number = PLAYER_MAX_HP, startEn: number = PLAYER_MAX_EN) {
    this.enemies = defs.map((d) => new EnemyState(d));
    this.playerHp = Math.max(1, Math.min(PLAYER_MAX_HP, startHp));
    this.playerEn = Math.max(0, Math.min(PLAYER_MAX_EN, startEn));
  }

  get aliveEnemies(): EnemyState[] {
    return this.enemies.filter((e) => e.alive);
  }

  /** 現在の攻撃対象（死亡していれば自動で次へ） */
  get target(): EnemyState | null {
    const t = this.enemies[this.targetIndex];
    if (t && t.alive) return t;
    const next = this.aliveEnemies[0];
    if (next) this.targetIndex = this.enemies.indexOf(next);
    return next ?? null;
  }

  selectTarget(i: number): void {
    if (this.enemies[i]?.alive) this.targetIndex = i;
  }

  // ===== プレイヤー行動 =====

  /** スキル使用。成功でtrue */
  useSkill(skill: Skill): boolean {
    if (this.phase !== "fighting") return false;
    if (this.playerEn < skill.enCost) {
      this.pushFloat("ENが足りない", "#ffcc55", "player");
      return false;
    }
    this.playerEn -= skill.enCost;

    switch (skill.kind) {
      case "charge":
        this.charge = CHARGE_MULT;
        this.pushFloat("ためる！", "#ffd35f", "player");
        break;
      case "heal": {
        const before = this.playerHp;
        this.playerHp = Math.min(PLAYER_MAX_HP, this.playerHp + skill.heal);
        this.pushFloat(`+${this.playerHp - before} HP`, "#66ffaa", "player");
        break;
      }
      case "aoe":
        for (const e of this.aliveEnemies) this.hitEnemy(e, skill);
        this.consumeCharge();
        break;
      case "attack": {
        const t = this.target;
        if (t) this.hitEnemy(t, skill);
        this.consumeCharge();
        break;
      }
    }

    this.checkWin();
    return true;
  }

  /** 休憩：ENを回復（攻撃はしない） */
  rest(): void {
    if (this.phase !== "fighting") return;
    const before = this.playerEn;
    this.playerEn = Math.min(PLAYER_MAX_EN, this.playerEn + REST_EN_RECOVER);
    this.pushFloat(`休憩 +${Math.round(this.playerEn - before)}EN`, "#88ddff", "player");
  }

  /** ガード：予兆中の最も着弾が近い敵の攻撃を受け止める */
  guard(): void {
    if (this.phase !== "fighting") return;
    // 予兆中の敵のうち、最も着弾が近い（atkTimerが小さい）ものを対象に
    const targets = this.enemies.filter((e) => e.inTelegraph);
    if (targets.length === 0) {
      this.setGuard("none");
      return;
    }
    targets.sort((a, b) => a.atkTimer - b.atkTimer);
    const e = targets[0];
    const diff = e.atkTimer; // 着弾までの残り時間
    let result: GuardResult;
    if (diff <= PARRY_WINDOW_MS) result = "parry";
    else if (diff <= JUST_WINDOW_MS) result = "just";
    else if (diff <= GUARD_WINDOW_MS) result = "guard";
    else {
      this.setGuard("none"); // まだ早い
      return;
    }
    this.resolveEnemyHit(e, result);
    e.atkTimer = e.def.intervalMs; // 受け止めたので再充填
  }

  // ===== 内部処理 =====

  private consumeCharge(): void {
    this.charge = 1;
  }

  private hitEnemy(e: EnemyState, skill: Skill): void {
    let dmg = skill.power;
    const weak = WEAKNESS[e.def.kind] === skill.weapon;
    if (weak) dmg *= WEAKNESS_MULTIPLIER;
    if (e.isBroken) dmg *= BREAK_CRIT_MULT;
    if (this.charge > 1) dmg *= this.charge;
    dmg = Math.round(dmg);

    e.hp = Math.max(0, e.hp - dmg);
    const idx = this.enemies.indexOf(e);
    const tag = this.charge > 1 ? " 渾身!" : weak ? " 弱点!" : e.isBroken ? " 会心!" : "";
    this.pushFloat(`${dmg}${tag}`, weak || e.isBroken || this.charge > 1 ? "#ff5577" : "#ffffff", idx);

    if (!e.isBroken) {
      e.breakGauge += skill.breakPower;
      if (e.breakGauge >= e.def.breakThreshold) {
        e.breakRemain = BREAK_DURATION_MS;
        e.breakGauge = 0;
        this.pushFloat("BREAK!!", "#ffdd44", idx);
      }
    }
  }

  private resolveEnemyHit(e: EnemyState, guard: GuardResult): void {
    let dmg = e.def.attack;
    this.setGuard(guard);
    switch (guard) {
      case "parry":
        dmg = 0;
        this.playerHp = Math.min(PLAYER_MAX_HP, this.playerHp + PARRY_HP_RECOVER);
        this.playerEn = Math.min(PLAYER_MAX_EN, this.playerEn + PARRY_EN_RECOVER);
        this.pushFloat(`PARRY! +${PARRY_HP_RECOVER}HP +${PARRY_EN_RECOVER}EN`, "#66ffaa", "player");
        break;
      case "just":
        dmg = Math.round(dmg * JUST_DAMAGE_MULT);
        this.playerEn = Math.min(PLAYER_MAX_EN, this.playerEn + JUST_EN_RECOVER);
        this.pushFloat(`JUST! +${JUST_EN_RECOVER}EN`, "#88ddff", "player");
        break;
      case "guard":
        dmg = Math.round(dmg * GUARD_DAMAGE_MULT);
        this.playerEn = Math.min(PLAYER_MAX_EN, this.playerEn + GUARD_EN_RECOVER);
        this.pushFloat(`GUARD ${dmg} +${GUARD_EN_RECOVER}EN`, "#cccccc", "player");
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

  private checkWin(): void {
    if (this.phase === "fighting" && this.aliveEnemies.length === 0) {
      this.phase = "won";
      this.pushFloat("STAGE CLEAR", "#66ddff", "center");
    }
  }

  update(dtMs: number): void {
    for (const f of this.floats) {
      f.ttl -= dtMs;
      f.rise += dtMs * 0.03;
    }
    this.floats = this.floats.filter((f) => f.ttl > 0);
    if (this.lastGuardTtl > 0) this.lastGuardTtl -= dtMs;

    if (this.phase !== "fighting") return;

    for (const e of this.enemies) {
      if (!e.alive) continue;
      if (e.breakRemain > 0) {
        e.breakRemain = Math.max(0, e.breakRemain - dtMs);
        continue; // ブレイク中は攻撃しない
      }
      e.atkTimer -= dtMs;
      if (e.atkTimer <= 0) {
        this.resolveEnemyHit(e, "none"); // ガードされなければフルダメージ
        e.atkTimer = e.def.intervalMs;
        if (this.phase !== "fighting") return;
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
