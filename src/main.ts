import "./style.css";
import { Battle } from "./game/engine.ts";
import { render } from "./render/canvas.ts";
import { SKILLS, ENEMIES, WEAPON_LABEL } from "./game/data.ts";
import type { WeaponClass } from "./game/types.ts";

const canvas = document.getElementById("screen") as HTMLCanvasElement;
const ctx = canvas.getContext("2d")!;
const controls = document.getElementById("controls") as HTMLDivElement;

let battle = new Battle(ENEMIES[0]);

// ===== コントロールUIの生成 =====
function buildControls(): void {
  controls.innerHTML = "";

  const skillWrap = document.createElement("div");
  skillWrap.className = "skills";

  const order: WeaponClass[] = ["slash", "pierce", "crush"];
  for (const weapon of order) {
    const col = document.createElement("div");
    col.className = `wclass wclass-${weapon}`;
    const label = document.createElement("div");
    label.className = "wlabel";
    label.textContent = WEAPON_LABEL[weapon];
    col.appendChild(label);

    for (const skill of SKILLS.filter((s) => s.weapon === weapon)) {
      const btn = document.createElement("button");
      btn.className = "skill-btn";
      btn.innerHTML = `<span class="sname">${skill.name}</span><span class="scost">EN ${skill.enCost}</span>`;
      btn.addEventListener("click", () => battle.useSkill(skill));
      col.appendChild(btn);
    }
    skillWrap.appendChild(col);
  }

  const actionRow = document.createElement("div");
  actionRow.className = "actions";

  const guardBtn = document.createElement("button");
  guardBtn.className = "guard-btn";
  guardBtn.textContent = "ガード (Space)";
  guardBtn.addEventListener("click", () => battle.guard());

  const resetBtn = document.createElement("button");
  resetBtn.className = "reset-btn";
  resetBtn.textContent = "もう一度";
  resetBtn.addEventListener("click", restart);

  actionRow.appendChild(guardBtn);
  actionRow.appendChild(resetBtn);

  controls.appendChild(skillWrap);
  controls.appendChild(actionRow);
}

function restart(): void {
  battle = new Battle(ENEMIES[0]);
}

// ===== キーボード操作（PC向け） =====
window.addEventListener("keydown", (e) => {
  if (e.repeat) return;
  if (e.code === "Space") {
    e.preventDefault();
    battle.guard();
    return;
  }
  if (e.key === "r") {
    restart();
    return;
  }
  const n = parseInt(e.key, 10);
  if (!Number.isNaN(n) && n >= 1 && n <= SKILLS.length) {
    battle.useSkill(SKILLS[n - 1]);
  }
});

// ===== メインループ =====
let last = performance.now();
function loop(now: number): void {
  const dt = Math.min(50, now - last); // 大きすぎるdtを抑制
  last = now;
  battle.update(dt);
  render(ctx, battle);
  requestAnimationFrame(loop);
}

buildControls();
requestAnimationFrame(loop);
