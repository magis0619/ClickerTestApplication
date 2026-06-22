import type { Skill, EnemyDef, GuardResult, BattlePhase, SfxEvent } from "./types.ts";
import {
  WEAKNESS,
  WEAKNESS_MULTIPLIER,
  PLAYER_MAX_HP,
  PLAYER_MAX_EN,
  CHARGE_MULT,
  REST_EN_RECOVER,
  GUARD_EN_RECOVER,
  PERFECT_EN_RECOVER,
  GUARD_WINDOW_MS,
  PERFECT_WINDOW_MS,
  GUARD_DAMAGE_MULT,
  PERFECT_HP_RECOVER,
  HITSTOP_MS,
  PERFECT_FLINCH_MS,
  PERFECT_BREAK_BONUS,
  BREAK_DURATION_MS,
  BREAK_CRIT_MULT,
} from "./data.ts";

/** 敵撃破アニメ（ノックバック→フェードアウト）の長さ */
export const DEATH_ANIM_MS = 720;

/** カウント1つあたりの時間(ms)。countStart×これ＋telegraph が1サイクル */
export const COUNT_TICK_MS = 1000;

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
  /** 被弾フラッシュ演出の残り時間(ms) */
  hitFlash = 0;
  /** 撃破アニメの残り時間(ms)。>0 の間は撃破演出を描画 */
  deathT = 0;
  /** 撃破ノックバックの向き(-1/+1) */
  deathDir = 1;
  /** パーフェクトで弾かれた怯み演出の残り時間(ms) */
  flinchT = 0;
  /** 予兆SEを既に鳴らしたか（1回だけ鳴らすためのフラグ） */
  warned = false;

  constructor(def: EnemyDef) {
    this.def = def;
    this.hp = def.maxHp;
    this.atkTimer = this.cycleMs;
  }

  /** 攻撃1サイクルの長さ(ms)。telegraph ＋ カウント開始値ぶんの秒数 */
  get cycleMs(): number {
    return this.def.telegraphMs + this.def.countStart * COUNT_TICK_MS;
  }

  get alive(): boolean {
    return this.hp > 0;
  }
  /** 撃破アニメ中（まだ画面に残して演出する） */
  get dying(): boolean {
    return this.hp <= 0 && this.deathT > 0;
  }
  get isBroken(): boolean {
    return this.breakRemain > 0;
  }
  /** 予兆中（着弾までtelegraph時間以内）か */
  get inTelegraph(): boolean {
    return this.alive && !this.isBroken && this.flinchT <= 0 && this.atkTimer <= this.def.telegraphMs;
  }
  /** 頭上に出す攻撃カウント。予兆中は0扱い */
  get count(): number {
    return Math.max(0, Math.ceil((this.atkTimer - this.def.telegraphMs) / COUNT_TICK_MS));
  }
  /**
   * 緊張度 0..1。着弾が近いほど高い。震え・赤点滅の強さに使う。
   * カウント1あたりから立ち上がり、予兆中（着弾直前）に最大化する。
   */
  get danger(): number {
    if (!this.alive || this.isBroken || this.flinchT > 0) return 0;
    const lead = this.def.telegraphMs + 1000; // カウント1の頭から
    if (this.atkTimer > lead) return 0;
    return Math.max(0, Math.min(1, (lead - this.atkTimer) / lead));
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
  /** 画面シェイク残り時間(ms) */
  shakeT = 0;
  /** 画面シェイクの強さ(px) */
  shakeMag = 0;
  /** プレイヤーの踏み込み演出残り時間(ms) */
  lungeT = 0;
  /** ヒットストップ（一瞬の静止）残り時間(ms)。>0 の間ゲーム進行を凍結 */
  hitstopT = 0;
  /** パーフェクト弾きエフェクトの残り時間(ms) */
  perfectFxT = 0;
  /** パーフェクト弾きエフェクトを出す敵インデックス */
  perfectFxIndex = -1;
  /** 効果音イベントのキュー（mainが毎フレーム回収して鳴らす） */
  sfx: SfxEvent[] = [];
  /** 全滅後、撃破アニメ完了を待ってからwonにするためのフラグ */
  private winPending = false;

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
        this.lungeT = 200;
        break;
      case "attack": {
        const t = this.target;
        if (t) this.hitEnemy(t, skill);
        this.consumeCharge();
        this.lungeT = 200;
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

  /** ガード：予兆中の最も着弾が近い敵の攻撃を受け止める。判定結果を返す */
  guard(): GuardResult {
    if (this.phase !== "fighting") return "none";
    // 予兆中の敵のうち、最も着弾が近い（atkTimerが小さい）ものを対象に
    const targets = this.enemies.filter((e) => e.inTelegraph);
    if (targets.length === 0) {
      this.setGuard("none");
      return "none";
    }
    targets.sort((a, b) => a.atkTimer - b.atkTimer);
    const e = targets[0];
    const diff = e.atkTimer; // 着弾までの残り時間
    let result: GuardResult;
    if (diff <= PERFECT_WINDOW_MS) result = "perfect";
    else if (diff <= GUARD_WINDOW_MS) result = "guard";
    else {
      this.setGuard("none"); // まだ早い
      return "none";
    }
    this.resolveEnemyHit(e, result);
    e.atkTimer = e.cycleMs; // 受け止めたので再充填
    e.warned = false;
    return result;
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

    const wasAlive = e.alive;
    e.hp = Math.max(0, e.hp - dmg);
    e.hitFlash = 260;
    const idx = this.enemies.indexOf(e);
    const tag = this.charge > 1 ? " 渾身!" : weak ? " 弱点!" : e.isBroken ? " 会心!" : "";
    this.pushFloat(`${dmg}${tag}`, weak || e.isBroken || this.charge > 1 ? "#ff5577" : "#ffffff", idx);

    if (!e.isBroken) {
      e.breakGauge += skill.breakPower;
      if (e.breakGauge >= e.def.breakThreshold) {
        e.breakRemain = BREAK_DURATION_MS;
        e.breakGauge = 0;
        this.pushFloat("BREAK!!", "#ffdd44", idx);
        this.sfx.push("break");
      }
    }

    // 撃破：ただ消さず、ノックバック＋フェードの撃破演出を始動
    if (wasAlive && e.hp <= 0) this.killEnemy(e, idx);
  }

  /** 敵を撃破：ノックバック・フェード・ドロップ演出を開始する */
  private killEnemy(e: EnemyState, idx: number): void {
    e.deathT = DEATH_ANIM_MS;
    e.deathDir = 1; // プレイヤーは左、敵は右向きなので右奥へ吹き飛ぶ
    e.breakRemain = 0;
    e.flinchT = 0;
    this.pushFloat("撃破!", "#ffd35f", idx);
    this.shake(220, 5);
    this.sfx.push("die");
  }

  private resolveEnemyHit(e: EnemyState, guard: GuardResult): void {
    let dmg = e.def.attack;
    const idx = this.enemies.indexOf(e);
    this.setGuard(guard);
    switch (guard) {
      case "perfect": {
        // === このゲームで一番気持ちいい瞬間 ===
        dmg = 0;
        this.playerHp = Math.min(PLAYER_MAX_HP, this.playerHp + PERFECT_HP_RECOVER);
        this.playerEn = Math.min(PLAYER_MAX_EN, this.playerEn + PERFECT_EN_RECOVER);
        // ヒットストップ＋弾きエフェクト＋軽い揺れ
        this.hitstopT = HITSTOP_MS;
        this.perfectFxT = 360;
        this.perfectFxIndex = idx;
        this.shake(180, 4);
        this.pushFloat(`+${PERFECT_HP_RECOVER}HP +${PERFECT_EN_RECOVER}EN`, "#66ffaa", "player");
        // 敵を怯ませる：次の攻撃を遅らせ、ブレイクゲージも溜める
        e.flinchT = PERFECT_FLINCH_MS;
        e.atkTimer = Math.max(e.atkTimer, e.def.telegraphMs + PERFECT_FLINCH_MS);
        if (!e.isBroken) {
          e.breakGauge += PERFECT_BREAK_BONUS;
          if (e.breakGauge >= e.def.breakThreshold) {
            e.breakRemain = BREAK_DURATION_MS;
            e.breakGauge = 0;
            this.pushFloat("BREAK!!", "#ffdd44", idx);
          }
        }
        this.sfx.push("perfect");
        break;
      }
      case "guard":
        // 通常ガード：軽減はするが地味。EN回復もわずか
        dmg = Math.max(1, Math.round(dmg * GUARD_DAMAGE_MULT));
        this.playerEn = Math.min(PLAYER_MAX_EN, this.playerEn + GUARD_EN_RECOVER);
        this.pushFloat(`-${dmg}`, "#cccccc", "player");
        this.playerHp = Math.max(0, this.playerHp - dmg);
        this.shake(120, 2);
        this.sfx.push("guard");
        break;
      case "none":
        this.pushFloat(`${dmg}`, "#ff5555", "player");
        this.playerHp = Math.max(0, this.playerHp - dmg);
        this.shake(340, 7);
        this.sfx.push("hurt");
        break;
    }
    if (this.playerHp <= 0) {
      this.phase = "lost";
      this.pushFloat("DEFEATED", "#ff5555", "center");
    }
  }

  private checkWin(): void {
    // 全滅した瞬間に「STAGE CLEAR」表示。ただし撃破アニメを見せてからwonへ移す
    if (this.phase === "fighting" && this.aliveEnemies.length === 0 && !this.winPending) {
      this.winPending = true;
      this.pushFloat("STAGE CLEAR", "#66ddff", "center");
    }
  }

  /** 画面シェイクを設定（既存より強い時だけ上書き） */
  private shake(ms: number, mag: number): void {
    if (ms >= this.shakeT) { this.shakeT = ms; this.shakeMag = mag; }
  }

  update(dtMs: number): void {
    // ヒットストップ中はゲーム進行を凍結（パーフェクトの一瞬の溜め）。
    // シェイクは凍結中も効かせて衝撃を演出する。
    if (this.hitstopT > 0) {
      this.hitstopT -= dtMs;
      return;
    }

    for (const f of this.floats) {
      f.ttl -= dtMs;
      f.rise += dtMs * 0.03;
    }
    this.floats = this.floats.filter((f) => f.ttl > 0);
    if (this.lastGuardTtl > 0) this.lastGuardTtl -= dtMs;
    if (this.shakeT > 0) this.shakeT -= dtMs;
    if (this.lungeT > 0) this.lungeT -= dtMs;
    if (this.perfectFxT > 0) this.perfectFxT -= dtMs;
    for (const e of this.enemies) {
      if (e.hitFlash > 0) e.hitFlash -= dtMs;
      if (e.flinchT > 0) e.flinchT -= dtMs;
      if (e.deathT > 0) e.deathT = Math.max(0, e.deathT - dtMs);
    }

    if (this.phase !== "fighting") return;

    // 全滅していたら、撃破アニメ完了を待って勝利確定
    if (this.winPending) {
      if (this.enemies.every((e) => e.deathT <= 0)) {
        this.phase = "won";
      }
      return;
    }

    for (const e of this.enemies) {
      if (!e.alive) continue;
      if (e.breakRemain > 0) {
        e.breakRemain = Math.max(0, e.breakRemain - dtMs);
        continue; // ブレイク中は攻撃しない
      }
      if (e.flinchT > 0) continue; // 怯み中は攻撃しない
      const before = e.atkTimer;
      e.atkTimer -= dtMs;
      // 予兆に入った瞬間に1回だけ警告SE（攻撃直前のSE）
      if (!e.warned && before > e.def.telegraphMs && e.atkTimer <= e.def.telegraphMs) {
        e.warned = true;
        this.sfx.push("warn");
      }
      if (e.atkTimer <= 0) {
        this.resolveEnemyHit(e, "none"); // ガードされなければフルダメージ
        e.atkTimer = e.cycleMs;
        e.warned = false;
        if (this.phase !== "fighting") return;
      }
    }

    this.checkWin();
  }

  private setGuard(result: GuardResult): void {
    this.lastGuard = result;
    this.lastGuardTtl = 700;
  }

  private pushFloat(text: string, color: string, anchor: FloatText["anchor"]): void {
    this.floats.push({ text, color, ttl: 900, anchor, rise: 0 });
  }
}
