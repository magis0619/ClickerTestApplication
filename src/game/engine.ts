import type { Skill, EnemyDef, GuardResult, BattlePhase, SfxEvent, WeaponInstance, WeaponMods, LastSkill, ComboDef } from "./types.ts";
import {
  matchCombo,
  FLOAT_TTL,
  GUARD_BADGE_MS,
  WEAKNESS,
  WEAKNESS_MULTIPLIER,
  PLAYER_MAX_HP,
  PLAYER_MAX_EN,
  CHARGE_MULT,
  REST_EN_RECOVER,
  GUARD_EN_RECOVER,
  JUST_EN_RECOVER,
  PERFECT_EN_RECOVER,
  GUARD_WINDOW_MS,
  JUST_WINDOW_MS,
  PERFECT_WINDOW_MS,
  GUARD_DAMAGE_MULT,
  JUST_DAMAGE_MULT,
  PERFECT_HP_RECOVER,
  HITSTOP_MS,
  SLOWMO_MS,
  SLOWMO_SCALE,
  WHITE_FLASH_MS,
  PERFECT_FLINCH_MS,
  PERFECT_BREAK_BONUS,
  BREAK_TURNS,
  BREAK_CRIT_MULT,
  rollEnemyDrop,
} from "./data.ts";

/** 敵撃破アニメ（ノックバック→フェードアウト）の長さ */
export const DEATH_ANIM_MS = 720;

export interface FloatText {
  text: string;
  color: string;
  ttl: number;
  /** 生成時の寿命(ms)。フェード・出現アニメの基準に使う */
  max: number;
  /** 出現位置（enemyの場合はインデックス） */
  anchor: "player" | "center" | number;
  rise: number;
}

/** 戦闘中の敵1体の状態 */
export class EnemyState {
  def: EnemyDef;
  hp: number;
  breakGauge = 0;
  /** ブレイク残りターン数（プレイヤーの行動ごとに減少）。>0でブレイク中 */
  breakTurns = 0;
  /** 攻撃までの残りカウント。プレイヤーの行動ごとに1減り、0で予兆へ */
  count: number;
  /** 予兆（!）の残り時間(ms)。>0 の間だけガード可能、0で着弾 */
  telegraphT = 0;
  /** 被弾フラッシュ演出の残り時間(ms) */
  hitFlash = 0;
  /** 撃破アニメの残り時間(ms)。>0 の間は撃破演出を描画 */
  deathT = 0;
  /** 撃破ノックバックの向き(-1/+1) */
  deathDir = 1;
  /** パーフェクトで弾かれた怯み演出の残り時間(ms) */
  flinchT = 0;
  /** 登場アニメ（横からスライドイン）の残り時間(ms) */
  spawnT = 420;
  /** アニメ位相（個体ごとに揺れをずらす） */
  phase = Math.random() * Math.PI * 2;
  /** 攻撃モーション（着弾時に前へ踏み込む）の残り時間(ms) */
  atkAnimT = 0;
  /** 撃破時に確定したドロップ（宝箱の色＝レアリティ表示に使う） */
  drop?: WeaponInstance;

  constructor(def: EnemyDef) {
    this.def = def;
    this.hp = def.maxHp;
    this.count = def.countStart;
  }

  get alive(): boolean {
    return this.hp > 0;
  }
  /** 撃破アニメ中（まだ画面に残して演出する） */
  get dying(): boolean {
    return this.hp <= 0 && this.deathT > 0;
  }
  get isBroken(): boolean {
    return this.breakTurns > 0;
  }
  /** 予兆中（!が出て着弾を待っている）か。この間だけガードが成立する */
  get inTelegraph(): boolean {
    return this.alive && !this.isBroken && this.flinchT <= 0 && this.telegraphT > 0;
  }
  /**
   * 緊張度 0..1。予兆中のみ立ち上がり、着弾が近いほど高い。
   * 震え・赤点滅の強さに使う。
   */
  get danger(): number {
    if (!this.inTelegraph) return 0;
    return Math.max(0, Math.min(1, 1 - this.telegraphT / this.def.telegraphMs));
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
  /** プレイヤーの被弾リアクション（のけぞり＋フラッシュ）残り時間(ms) */
  playerHitT = 0;
  /** ヒットストップ（一瞬の静止）残り時間(ms)。>0 の間ゲーム進行を凍結 */
  hitstopT = 0;
  /** スローモーション残り時間(ms)。>0 の間ゲーム進行を遅くする */
  slowT = 0;
  /** 画面ホワイトアウト残り時間(ms) */
  whiteFlashT = 0;
  /** パーフェクト弾きエフェクトの残り時間(ms) */
  perfectFxT = 0;
  /** パーフェクト弾きエフェクトを出す敵インデックス */
  perfectFxIndex = -1;
  /** 効果音イベントのキュー（mainが毎フレーム回収して鳴らす） */
  sfx: SfxEvent[] = [];
  /** 「集中」発動中：次の行動のEN消費をなくす */
  freeNextEn = false;
  /** 直近に発動したスキル（連携＝コンボ判定に使う） */
  lastSkill: LastSkill | null = null;
  /** 決着後の経過時間(ms)。リザルト演出の出現アニメに使う */
  resultT = 0;
  /** 全滅後、撃破アニメ完了を待ってからwonにするためのフラグ */
  private winPending = false;

  constructor(
    defs: EnemyDef[],
    startHp: number = PLAYER_MAX_HP,
    startEn: number = PLAYER_MAX_EN,
  ) {
    this.enemies = defs.map((d) => new EnemyState(d));
    this.playerHp = Math.max(1, Math.min(PLAYER_MAX_HP, startHp));
    this.playerEn = Math.max(0, Math.min(PLAYER_MAX_EN, startEn));
  }

  /** 撃破した敵が落としたドロップ一覧（リザルト用） */
  collectedDrops(): WeaponInstance[] {
    return this.enemies.flatMap((e) => (e.drop ? [e.drop] : []));
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

  /** スキル使用。成功でtrue。mods=装備武器のステータス（攻撃力・会心・ブレイク） */
  useSkill(skill: Skill, mods?: WeaponMods): boolean {
    if (this.phase !== "fighting") return false;
    const free = this.freeNextEn; // 「集中」発動中はEN消費なし
    const cost = free ? 0 : skill.enCost;
    if (this.playerEn < cost) {
      this.pushFloat("ENが足りない", "#ffcc55", "player");
      return false;
    }
    // 連携判定：直近スキル → 今のスキル の並びで成立するか
    const cls = mods?.weapon;
    const combo = cls ? matchCombo(this.lastSkill, skill.kind, cls) : undefined;

    this.playerEn -= cost;
    this.freeNextEn = false; // 消費（集中はこの後に再セット）

    switch (skill.kind) {
      case "charge":
        this.charge = CHARGE_MULT;
        this.pushFloat("ためる！", "#ffd35f", "player");
        break;
      case "focus":
        this.freeNextEn = true;
        this.pushFloat("集中！ 次の行動EN0", "#9fd9ff", "player");
        break;
      case "attack":
        this.performAttack(skill, mods, combo);
        break;
    }

    // 直近スキルを記録（次の連携判定に使う）
    this.lastSkill = cls ? { kind: skill.kind, cls } : null;

    this.advanceCounts(); // 行動したので敵カウントを進める
    this.checkWin();
    return true;
  }

  /** 攻撃スキルを実行：対象数ぶんの敵に、ヒット数ぶん攻撃する。combo成立時は追撃を足す */
  private performAttack(skill: Skill, mods?: WeaponMods, combo?: ComboDef): void {
    const targets = this.pickTargets(skill.targets);
    for (const e of targets) {
      for (let h = 0; h < skill.hits; h++) {
        if (!e.alive) break;
        this.hitOne(e, skill, mods);
      }
    }
    // 連携成立：現在の対象へ追撃（チャージ倍率が乗ったまま追加で殴る）
    if (combo) {
      const t = this.target;
      const idx = t ? this.enemies.indexOf(t) : -1;
      if (t && t.alive) {
        for (let i = 0; i < combo.bonusHits; i++) {
          if (!t.alive) break;
          this.hitOne(t, skill, mods);
        }
      }
      this.pushFloat(`${combo.name}！`, "#ffd35f", idx >= 0 ? idx : "player");
      this.sfx.push("just");
      this.shake(170, 3);
      this.lungeT = 240;
    }
    this.consumeCharge();
    this.lungeT = Math.max(this.lungeT, 200);
  }

  /** 攻撃対象を選ぶ：現在のターゲット＋（足りなければ）他の生存敵を左から補う */
  private pickTargets(n: number): EnemyState[] {
    const out: EnemyState[] = [];
    const t = this.target;
    if (t) out.push(t);
    for (const e of this.enemies) {
      if (out.length >= n) break;
      if (e.alive && !out.includes(e)) out.push(e);
    }
    return out.slice(0, n);
  }

  /** 休憩：ENを回復（攻撃はしない） */
  rest(): void {
    if (this.phase !== "fighting") return;
    const before = this.playerEn;
    this.playerEn = Math.min(PLAYER_MAX_EN, this.playerEn + REST_EN_RECOVER);
    this.pushFloat(`休憩 +${Math.round(this.playerEn - before)}EN`, "#88ddff", "player");
    this.lastSkill = null; // 休憩で連携チェーンは途切れる
    this.advanceCounts(); // 休憩も「行動」なので敵カウントを進める
  }

  /**
   * プレイヤーの行動ごとに敵の状態を1ターン進める。
   * ・ブレイク中：残りターンを減らし、0で待ちターンへ復帰
   * ・通常：攻撃カウントを1減らす（0で「攻撃準備完了」＝待機）
   * 予兆中・怯み中・既に準備完了の敵は進めない。
   */
  private advanceCounts(): void {
    for (const e of this.enemies) {
      if (!e.alive) continue;
      if (e.breakTurns > 0) {
        e.breakTurns -= 1;
        if (e.breakTurns <= 0) e.count = e.def.countStart; // 元の待ちターンに戻る
        continue;
      }
      if (e.flinchT > 0 || e.telegraphT > 0 || e.count <= 0) continue;
      e.count -= 1;
      if (e.count < 0) e.count = 0;
    }
  }

  /**
   * 攻撃準備完了(count<=0)の敵を「左から順に」1体ずつ予兆させる。
   * 同時に複数体が準備完了でも、予兆は常に1体だけ＝順番に攻撃させる。
   */
  private startNextTelegraph(): void {
    if (this.enemies.some((e) => e.telegraphT > 0)) return; // 既に1体予兆中
    for (const e of this.enemies) {
      if (!e.alive || e.isBroken || e.flinchT > 0) continue;
      if (e.count <= 0) {
        e.telegraphT = e.def.telegraphMs; // 予兆開始（! が出る）
        this.sfx.push("warn");
        return;
      }
    }
  }

  /** 予兆の決着後、カウントを開始値に戻す */
  private endTelegraph(e: EnemyState): void {
    e.telegraphT = 0;
    e.count = e.def.countStart;
  }

  /** ガード：予兆中の最も着弾が近い敵の攻撃を受け止める。判定結果を返す */
  guard(): GuardResult {
    if (this.phase !== "fighting") return "none";
    // 予兆中の敵のうち、最も着弾が近い（telegraphTが小さい）ものを対象に
    const targets = this.enemies.filter((e) => e.inTelegraph);
    if (targets.length === 0) {
      this.setGuard("none");
      return "none";
    }
    targets.sort((a, b) => a.telegraphT - b.telegraphT);
    const e = targets[0];
    const diff = e.telegraphT; // 着弾までの残り時間
    let result: GuardResult;
    if (diff <= PERFECT_WINDOW_MS) result = "perfect";
    else if (diff <= JUST_WINDOW_MS) result = "just";
    else if (diff <= GUARD_WINDOW_MS) result = "guard";
    else {
      this.setGuard("none"); // まだ早い
      return "none";
    }
    if (result !== "perfect") e.atkAnimT = 300; // 弾かれない攻撃は踏み込みモーション
    this.resolveEnemyHit(e, result);
    this.endTelegraph(e); // 受け止めたのでカウントを戻す
    return result;
  }

  // ===== 内部処理 =====

  private consumeCharge(): void {
    this.charge = 1;
  }

  /** 1ヒットぶんのダメージ処理。攻撃力は武器本体(mods)、スキルは倍率・会心・ブレイクを担う */
  private hitOne(e: EnemyState, skill: Skill, mods?: WeaponMods): void {
    const atk = mods?.attack ?? 1;
    let dmg = atk;
    const weak = mods ? WEAKNESS[e.def.kind] === mods.weapon : false;
    if (weak) dmg *= WEAKNESS_MULTIPLIER;
    if (e.isBroken) dmg *= BREAK_CRIT_MULT;
    if (this.charge > 1) dmg *= this.charge;
    // 会心＝武器の会心率＋スキルの加算。発生で skill.critMult 倍
    const critChance = ((mods?.critChance ?? 0) + skill.critAdd) / 100;
    const crit = critChance > 0 && Math.random() < critChance;
    if (crit) dmg *= skill.critMult;
    dmg = Math.round(dmg);

    const wasAlive = e.alive;
    e.hp = Math.max(0, e.hp - dmg);
    e.hitFlash = 260;
    const idx = this.enemies.indexOf(e);
    const tag = crit ? " 会心!" : this.charge > 1 ? " 渾身!" : weak ? " 弱点!" : e.isBroken ? " 会心!" : "";
    this.pushFloat(`${dmg}${tag}`, weak || e.isBroken || this.charge > 1 || crit ? "#ff5577" : "#ffffff", idx);

    if (!e.isBroken) {
      e.breakGauge += (mods?.breakPower ?? 0) * skill.breakMult;
      if (e.breakGauge >= e.def.breakThreshold) {
        e.breakTurns = BREAK_TURNS;
        e.breakGauge = 0;
        e.telegraphT = 0; // 予兆中ならキャンセル
        this.pushFloat("BREAK!!", "#ffdd44", idx);
        this.sfx.push("break");
      }
    }

    // 撃破：ただ消さず、ノックバック＋フェードの撃破演出を始動
    if (wasAlive && e.hp <= 0) this.killEnemy(e, idx);
  }

  /** 敵を撃破：ノックバック・フェード・ドロップ（宝箱）演出を開始する */
  private killEnemy(e: EnemyState, idx: number): void {
    e.deathT = DEATH_ANIM_MS;
    e.deathDir = 1; // プレイヤーは左、敵は右向きなので右奥へ吹き飛ぶ
    e.breakTurns = 0;
    e.flinchT = 0;
    e.drop = rollEnemyDrop(e.def); // 率で武器ドロップ（外れあり）
    this.pushFloat(e.drop ? "ドロップ!" : "撃破!", "#ffd35f", idx);
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
        // 一瞬の静止→ホワイトアウト→スロー＋弾きエフェクト＋軽い揺れ
        this.hitstopT = HITSTOP_MS;
        this.whiteFlashT = WHITE_FLASH_MS;
        this.slowT = SLOWMO_MS;
        this.perfectFxT = 360;
        this.perfectFxIndex = idx;
        this.shake(180, 4);
        this.pushFloat(`+${PERFECT_HP_RECOVER}HP +${PERFECT_EN_RECOVER}EN`, "#66ffaa", "player");
        // 敵を怯ませる：カウントを戻し、ブレイクゲージも溜める
        e.flinchT = PERFECT_FLINCH_MS;
        if (!e.isBroken) {
          e.breakGauge += PERFECT_BREAK_BONUS;
          if (e.breakGauge >= e.def.breakThreshold) {
            e.breakTurns = BREAK_TURNS;
            e.breakGauge = 0;
            this.pushFloat("BREAK!!", "#ffdd44", idx);
          }
        }
        this.sfx.push("perfect");
        break;
      }
      case "just":
        // 中間：そこそこ軽減＋EN中回復。PERFECT専用演出は付けない
        dmg = Math.max(1, Math.round(dmg * JUST_DAMAGE_MULT));
        this.playerEn = Math.min(PLAYER_MAX_EN, this.playerEn + JUST_EN_RECOVER);
        this.pushFloat(`JUST -${dmg}`, "#88ddff", "player");
        this.playerHp = Math.max(0, this.playerHp - dmg);
        this.shake(140, 3);
        this.sfx.push("just");
        break;
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
    // パーフェクト以外は被弾＝のけぞり演出（生身ガードも軽く反応）
    if (guard !== "perfect") this.playerHitT = guard === "none" ? 320 : 220;
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
    // ホワイトアウトは実時間で減衰させる
    if (this.whiteFlashT > 0) this.whiteFlashT = Math.max(0, this.whiteFlashT - dtMs);

    // ヒットストップ中はゲーム進行を凍結（パーフェクトの一瞬の溜め）。
    if (this.hitstopT > 0) {
      this.hitstopT -= dtMs;
      return;
    }

    // スローモーション：以降の進行を遅い時間で動かす
    if (this.slowT > 0) {
      this.slowT = Math.max(0, this.slowT - dtMs);
      dtMs = dtMs * SLOWMO_SCALE;
    }

    for (const f of this.floats) {
      f.ttl -= dtMs;
      f.rise += dtMs * 0.03;
    }
    this.floats = this.floats.filter((f) => f.ttl > 0);
    if (this.lastGuardTtl > 0) this.lastGuardTtl -= dtMs;
    if (this.shakeT > 0) this.shakeT -= dtMs;
    if (this.lungeT > 0) this.lungeT -= dtMs;
    if (this.playerHitT > 0) this.playerHitT -= dtMs;
    if (this.perfectFxT > 0) this.perfectFxT -= dtMs;
    for (const e of this.enemies) {
      if (e.hitFlash > 0) e.hitFlash -= dtMs;
      if (e.flinchT > 0) e.flinchT -= dtMs;
      if (e.deathT > 0) e.deathT = Math.max(0, e.deathT - dtMs);
      if (e.spawnT > 0) e.spawnT = Math.max(0, e.spawnT - dtMs);
      if (e.atkAnimT > 0) e.atkAnimT = Math.max(0, e.atkAnimT - dtMs);
    }

    if (this.phase !== "fighting") {
      this.resultT += dtMs; // リザルト演出の出現アニメ用
      return;
    }

    // 全滅していたら、撃破アニメ完了を待って勝利確定
    if (this.winPending) {
      if (this.enemies.every((e) => e.deathT <= 0)) {
        this.phase = "won";
      }
      return;
    }

    // 予兆中の敵だけ時間で進み、0になったら着弾（ガードされなければフルダメージ）
    // ブレイクはターン制なので時間では減らさない。
    for (const e of this.enemies) {
      if (!e.alive || e.isBroken) continue;
      if (e.telegraphT > 0) {
        e.telegraphT -= dtMs;
        if (e.telegraphT <= 0) {
          e.telegraphT = 0;
          e.atkAnimT = 300; // 攻撃の踏み込みモーション
          this.resolveEnemyHit(e, "none");
          this.endTelegraph(e);
          if (this.phase !== "fighting") return;
        }
      }
    }

    // 攻撃準備完了の敵を左から1体ずつ予兆させる（同時攻撃を順番に）
    this.startNextTelegraph();

    this.checkWin();
  }

  private setGuard(result: GuardResult): void {
    this.lastGuard = result;
    this.lastGuardTtl = GUARD_BADGE_MS;
  }

  private pushFloat(text: string, color: string, anchor: FloatText["anchor"]): void {
    this.floats.push({ text, color, ttl: FLOAT_TTL, max: FLOAT_TTL, anchor, rise: 0 });
  }

  /** ウェーブ開始など、画面中央に大きく告知する */
  announce(text: string, color: string): void {
    this.floats.push({ text, color, ttl: 1600, max: 1600, anchor: "center", rise: 0 });
    this.whiteFlashT = 120;
  }
}
