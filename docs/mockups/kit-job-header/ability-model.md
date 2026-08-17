# Kit Ability model (Draft A+)

Source of truth for the character KIT dossier and future React/Firestore wiring.  
Visual mockup: [`dossier-viewport.html`](./dossier-viewport.html) (headers lab: [`meta-chips-proposals.html`](./meta-chips-proposals.html)).  
Conditions / tags: [`conditions-and-tags.md`](./conditions-and-tags.md).

**Ruleset note:** ICON books are the **base pattern**. This VTT is a **DM-modified** table (both talents unlockable, autohit without d20, crit via effect or nat 20 on rolled to-hit). Homebrew abilities stay ICON-*similar*.

## UI color rules

| Condition | Accent |
|-----------|--------|
| `source === "zarkenity"` (non-job fuchsia) | `#ff66ff` |
| else if `hasAttack === true` | `#ff8a3d` |
| else | `#00f2ea` |
| Limit Break READY | `#ffcc33` |
| Limit Break LOCKED | `#ff3355` |

Trait **activation** chrome uses `traitMode` (not `traitCategory`):

| Mode | Color | Play |
|------|-------|------|
| passive | `#7dd3fc` | no |
| active | `#ff8a3d` | yes |
| trigger | `#ff66ff` | optional |
| interrupt | `#ff3355` | yes |

AoE chip colors (locked): Blast `#ff8a3d` · Close blast `#00f2ea` · Aura `#ff66ff` · Line `#7dd3fc` · Arc `#a78bfa` · Cross `#f5c542`.

**Priority:** source wins over attack. LB gold/red is independent of attack.

## Card header

Locked mockup: [`dossier-viewport.html`](./dossier-viewport.html) (lab: [`meta-chips-proposals.html`](./meta-chips-proposals.html)).

**Tools:** Pin · Play · chevron. Play = use/launch (not chat). Hide Play on `traitMode` passive|trigger and on locked LB.

| Surface | Layout |
|---------|--------|
| Abilities | Local 12-col **3·6·1·2**: CORE · TITLE · TAGS (tag-btn only) · TOOLS (2 cols: Pin/Play/▸). Cards **closed by default**. |
| Traits | **Category Rail**: single-row mid (name + mode chip + tag-btn) · tools. |
| LB | **Stack Compact**: closed by default; row2 chips + RES + tag-btn. |

Hover: keyword pills → glossary tip; condition chips/rows → `effect` / `hook`.

AoE `string` parse → `{ key, code, size }` (`aura 1`, `closeblast 1`, `line 1x4`, `blast 2`, `arc 3`, `xpat 1`). No Self Blast / Burst pattern.

## Types (Draft A+)

```ts
type ActionCost = 1 | 2 | "free" | "interrupt" | "superheavy";
// UI: "1 Action" | "2 Actions" | "Free" | "Interrupt" | "S.H. Action"

type DieExpr = "[D]" | `${number}d${number}` | number;

interface DamagePacket {
  die?: DieExpr;
  fray?: boolean | number; // true = character Fray
  flat?: number;
  pierce?: boolean;
  notes?: string;
}

/**
 * Optional attack block (hasAttack).
 * - autoHit: no d20, no miss; crit only if an effect/upgrade grants it
 * - rolled toHit: d20 vs Defense + boons/curses; nat 20 = crit
 * - DoC default = 2 × DoH when damageOnCrit is null and crit applies
 */
interface AbilityAttack {
  autoHit?: boolean;
  toHit?: { boons?: number; curses?: number } | null;
  damageOnHit?: DamagePacket | null;
  damageOnMiss?: DamagePacket | null; // ignored when autoHit
  damageOnCrit?: DamagePacket | null;
  notes?: string;
}

type EffectKind =
  | "text" | "status" | "damage" | "heal" | "counter"
  | "trigger" | "move" | "rule" | "resource";

interface EffectRoll {
  id: string;
  label: string;
  expr: DieExpr;
  when?: "always" | "onHit" | "onMiss" | "onCrit" | "manual";
}

interface AbilityEffect {
  id: string;
  kind: EffectKind;
  label?: string;
  text?: string;
  statusCode?: string;
  statusTarget?: "self" | "target" | "aoe";
  rolls?: EffectRoll[];
  counter?: { id: string; max?: number; start?: number };
  trigger?: string;
  rule?: string; // e.g. "grantCrit"
  resource?: { type: string; amount: number; op: "gain" | "spend" };
}

type UpgradeOp =
  | { op: "append_effect"; effect: AbilityEffect }
  | { op: "replace_effect"; effectId: string; effect: AbilityEffect }
  | { op: "empower_effect"; effectId: string; patch: Partial<AbilityEffect> }
  | { op: "patch_attack"; patch: Partial<AbilityAttack> }
  | { op: "add_tags"; tags: string[] }
  | { op: "set_fields"; patch: Partial<Pick<KitAbility, "range" | "aoe" | "actionCost">> }
  | { op: "prose_only"; detail: string };

interface AbilityUpgrade {
  id: string;
  label: string;
  level?: number;
  unlocked: boolean;
  detail?: string;
  mods: UpgradeOp[];
}

interface KitAbility {
  id: string;
  title: string;
  description: string; // narrative only
  source: "job" | "zarkenity" | string;
  hasAttack: boolean;
  actionCost: ActionCost;
  range?: string | null;
  aoe?: string | null;
  tags: string[];
  effects: AbilityEffect[]; // 0…N
  attack?: AbilityAttack | null;
  talents?: AbilityUpgrade[]; // 0…2, both may be unlocked (not ICON XOR)
  mastery?: AbilityUpgrade | null; // 0…1
}

interface KitLimitBreak {
  id: string;
  title: string;
  description: string;
  actionCost?: ActionCost;
  /** Resolve spend (LB/Ultimate). Shown as RES N in header. */
  resolveCost?: number;
  range?: string | null;
  aoe?: string | null;
  tags?: string[];
  effects: AbilityEffect[];
  mastery?: AbilityUpgrade | null;
}

interface KitTrait {
  id: string;
  title: string;
  body: string;
  traitMode: "passive" | "active" | "trigger" | "interrupt";
  actionCost?: ActionCost;
  range?: string | null;
  aoe?: string | null;
  tags?: string[];
}

/** Authoring catalog. Character sheet shows one job at a time. */
interface KitJob {
  id: string;
  label: string;
  traits: KitTrait[];
  abilities: KitAbility[];
  lb: KitLimitBreak; // one per job; mastery = Chapter Ultimate. No second LB.
  loadoutIds: string[]; // expedition max 6; rest = bench
}
```

## Limit Break header (narrow col)

LB spends **Actions + Resolve**.

- **Row 1:** title + Pin / Play / chevron (same row; divider before tools)
- **Row 2:** Action cost · range/AoE chips · `RES N` · **tag-btn** (all keyword tags in vertical pop)

Effect rolls live on effect rows only (not duplicated next to description).

## Ability header (loadout)

Locked layout: local 12-col **3·6·1·2**. CORE chips **left**. Keyword tags always in tag-btn; tools get 2 cols so Pin/Play don’t crush the tag icon.

## Edit vs view (KIT UX)

Single **EDIT** on the Loadout rail (`state.kitEdit`). Traits/LB have no separate EDIT. Fixed `.rail-add-slot` (22px) next to EDIT (and on Traits) so `+` never jumps layout.

| Mode | Behavior |
|------|----------|
| **OFF (play)** | Cards **closed by default**; click header to open. Body = gamified view. No `+`, no click-to-edit. Pin / Play / chevron stay. |
| **ON (author)** | Body = KIT studio. `+` appears in reserved slots on Traits/Loadout. Click-to-edit. ENABLE/DISABLE moves ids ↔ bench. |

Headers (Vertical Micro / Category Rail / Stack Compact) stay in both modes.

| Surface | Notes |
|---------|-------|
| **Header** | Kind mark toggles ATK/STD (≤2). Source JOB/ZAR toggle. Cost/range/AoE/`traitMode` use **cyber Select** when EDIT (never cycle). |
| **Studio body** | 12-col: flavor · identity · effect rows · attack matrix · T1/T2/Mastery. |
| **Create** | `+` only with kitEdit ON (fixed slot). New ability always enters loadout (may exceed 6 → warning). No `+` on LB. |

### Cyber selects

No native `<select>` (Windows paints a white list). Use `.cyber-sel` trigger+panel matching React `cyberMenuPaperSx` / `cyberMenuItemSx`: dark `#12121a`, white Fira Code, magenta hover/selected, cyber scrollbar.

- **>2 options → Select:** actionCost, range, aoe, traitMode, effect kind/label, packet die, plate DIE, tag-add.
- **≤2 → toggle/chip:** ATK\|STD, JOB\|ZAR, autohit, unlocked, pin.

### Bench + over-6

Bench lives **under Loadout**, **collapsed by default** (click `BENCH · INACTIVE` to expand). Inactive abilities render as gray `.card.inactive`. EDIT ENABLE/DISABLE moves ids. If `loadout.length > 6`: rail `.over`, `OVER 6` label, danger pips — **does not block** add/enable.

LB rail: READY → gold `--lb`; LOCKED → `--lb-locked`.

Blanks: ability `{ title: "NEW ABILITY", hasAttack: false, actionCost: 1, source: "job", tags: [], effects: [], talents: [], mastery: null }`; ATK adds `attack: { autoHit: false, toHit: { boons: 0 }, damageOnHit: { die: "[D]", fray: true }, damageOnMiss: { fray: true }, damageOnCrit: null }`. Trait `{ title: "NEW TRAIT", traitMode: "passive", body: "" }`.

**Job ownership:** `traits`, `abilities`, and `lb` belong to `jobs[activeJobId]`. Plate job control switches the catalog. React mapping: `clases/{jobId}` + `clases/{jobId}/abilities/{id}`. ICON play: traits+LB from **primary** job; abilities may mix — this mockup authors **per job**, not a mixed triptych.

## Resolve sketch

1. Merge unlocked talent + mastery **ops** onto a working copy.
2. If `hasAttack`:
   - **autoHit** → apply DoH (no miss). Crit only if `rule: "grantCrit"` (or similar) is present after merge.
   - **else** → roll d20 + boons/curses vs Defense; miss → DoM; hit → DoH; nat 20 → DoC (or 2× DoH).
3. Run `effects[]` (status, triggers, counters, extra rolls by `when`).
4. Manual / chat: KIT buttons post roll stubs (mockup toasts; React later).

Do **not** conflate with narrative `actionDiceRoll.js` (Nd6 keep highest).

## Loadout

- Owned abilities: many; **active loadout soft-max 6** (over-6 warns, does not block).
- Bench under Loadout column: gray inactive ability cards (not LB column SWAP chips).
- LB separate column; no talent slots on LB (mastery / Ultimate only).

## Rejected

- **Draft B** unified `rolls[]` pool (awkward hit/miss branching).
- Hard **ICON talent XOR** (table allows both T1 and T2 unlocked).

## Example (attack + ops)

```json
{
  "id": "a1",
  "title": "ANCHOR SPIKE",
  "description": "Drive a lattice spike into a foe and mark them for the ward.",
  "source": "job",
  "hasAttack": true,
  "actionCost": 1,
  "range": "1",
  "aoe": null,
  "tags": ["mark", "rush"],
  "effects": [
    { "id": "e1", "kind": "move", "label": "SETUP", "text": "Dash 2, then attack." },
    { "id": "e2", "kind": "status", "label": "ON HIT", "text": "Mark the target.", "statusCode": "MRK", "statusTarget": "target" }
  ],
  "attack": {
    "autoHit": false,
    "toHit": { "boons": 0 },
    "damageOnHit": { "die": "[D]", "fray": true },
    "damageOnMiss": { "fray": true },
    "damageOnCrit": null
  },
  "talents": [
    {
      "id": "a1-t0",
      "label": "Spike Chain",
      "level": 2,
      "unlocked": true,
      "mods": [
        { "op": "append_effect", "effect": { "id": "e3", "kind": "move", "text": "After the attack, Rush 1." } }
      ]
    }
  ],
  "mastery": {
    "id": "a1-m",
    "label": "Worldspike",
    "level": 6,
    "unlocked": false,
    "mods": [
      { "op": "patch_attack", "patch": { "damageOnHit": { "die": "[D]", "fray": true, "flat": 1 } } }
    ]
  }
}
```
