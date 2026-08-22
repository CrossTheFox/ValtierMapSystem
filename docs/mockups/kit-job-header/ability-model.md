# Kit Ability model (Draft A+)

Source of truth for the character KIT dossier and future React/Firestore wiring.  
Visual mockup **body B2 + headers:** [`index.html`](./index.html) `#dossier` (xl preview: [`dossier-viewport.html`](./dossier-viewport.html)).  
Visual mockup **chat C2:** [`index.html`](./index.html) `#chat`.  
Headers lab (histórico): [`meta-chips-proposals.html`](./meta-chips-proposals.html).  
Body/chat lab (histórico — no iterar): [`ability-body-proposals.html`](./ability-body-proposals.html).  
Conditions / tags: [`conditions-and-tags.md`](./conditions-and-tags.md).  
**Phase 01 decisions:** [`../../architecture/phase-01-dossier-kit/DECISION-LOG.md`](../../architecture/phase-01-dossier-kit/DECISION-LOG.md) (I1 source=job, I5 cyber-sel, G1 one C2 post, G9 disable/delete).

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

Locked mockup: [`index.html`](./index.html) `#dossier` (lab: [`meta-chips-proposals.html`](./meta-chips-proposals.html)).

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

type DieExpr = string; // formula: "[damageDie]+[fray]", "2[damageDie]", "2d8"

interface DamagePacket {
  formula: string; // macros in [] + literals (2d8, +1). Typical Light: "[damageDie]+[fray]"; Heavy: "2[damageDie]"
}

/**
 * Optional attack block (hasAttack).
 * - autoHit: no d20, no miss; crit only if an effect/upgrade grants it
 * - rolled toHit: d20 vs Defense + boons/curses; nat 20 applies Heavy packet
 * - Heavy is an independent formula (not 2× Light). Crit-as-double is runtime, not on the card.
 */
interface AbilityAttack {
  autoHit?: boolean;
  toHit?: { boons?: number; curses?: number } | null;
  damageOnHit?: DamagePacket | null;   // Light
  damageOnMiss?: DamagePacket | null;  // ignored when autoHit
  damageOnCrit?: DamagePacket | null;  // Heavy (independent formula)
  damageAoe?: DamagePacket | null;     // optional; EDIT +AoE toggles this
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
  kind?: EffectKind; // data only — not edited on the card
  lane?: "hit" | "plain" | "mech"; // 3-click: ON HIT → MECH → NONE
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
| **Header** | Kind mark toggles ATK/STD (≤2). Source stays **job** in v1 (ZAR deferred). Cost/range/AoE/`traitMode`/DIE/RES use **cyber-sel** when EDIT (**never cycle**). |
| **Body (expanded)** | Flavor → attack block (if ATK) → effects → T1/T2/Mastery. **Identity stays in header only** (see Body fields). |
| **Create** | `+` only with kitEdit ON (fixed slot). New ability always enters loadout (may exceed 6 → warning). No `+` on LB. |

## Body fields (play + edit)

Body lab: [`ability-body-proposals.html`](./ability-body-proposals.html) — **B2 Packet tickets** locked.  
Headers copied from [`index.html`](./index.html) `#dossier` Vertical Micro **3·6·1·2**. Body does **not** repeat KIND/SRC/cost/range/AoE/tags.

**Body order (locked):** 1. Flavor (`description`) · 2. Attack damage if `hasAttack` · 3. Effects · 4. Upgrades.

VIEW never shows a ROLLED label. VIEW formulas substitute `[]` tokens without rolling: `[damageDie]` → character die (`d6`), `[fray]` → Fray number, `[mechanicResource]` → class resource or 0. EDIT keeps the raw formula. AUTOHIT chip sits **on the same row** as Light/Heavy (VIEW only if autohit). LB body uses tighter padding (chat-like).

### Play / macro = one `launchToChat`

Header **Play** and hotbar **macros** call the **same** function (today `launchAbility` in [`AbilityHotbar.jsx`](../../../src/components/vtt/AbilityHotbar.jsx); target name `launchToChat`). Same path for trait / mech / LB (mech = ability-lite from `clases.specialMechanic`). No per-field ROLL buttons in the body.

```
Play or macro
  → hasAttack && !autoHit?  AttackBoonDialog (+1/+2/−1/−2 exclusive) → TIRAR
  → else                    launch immediately
  → resolve ALL dice (d20, Light, Miss, Heavy, AoE, `[]` in effect text) as one bundle
  → LOCAL d20 animation if rolled attack (do NOT persist CHAT_MESSAGE_TYPES.DICE)
  → ONE chat post (ABILITY): C2 card + resolved numbers
```

Autohit / Standard: skip the popover. Combat d20 + boons/curses — **not** narrative `actionDiceRoll.js` (Nd6).

Body VIEW shows **formulas** (italic label + large value). Chat shows **resolved numbers** (Attack / Light Damage / Heavy Damage / Miss).

### Surfaces

| Surface | `hasAttack` | Attack block | Effects | Upgrades |
|---------|-------------|--------------|---------|----------|
| Loadout ability | `true` / `false` | yes / hidden | 0…N | T1, T2 (both unlockable), Mastery |
| Limit Break | same | same | 0…N | **Mastery only** (Chapter Ultimate) |

`hasAttack` toggles in the **header** (ATK\|STD). If STD, attack block hides in body; `attack` data may remain on the object.

### `.fld` contract (VIEW / EDIT)

One DOM slot per datum — **not** separate `playBody` vs `studioBody` trees.

| Mode | Chrome |
|------|--------|
| **VIEW** | Border `rgba(255,255,255,0.12)`; label muted; value white. Attack accent `#ff8a3d`; data `#00f2ea`. |
| **EDIT** | Same grid/size; border cyan or magenta; fill `rgba(0,242,234,0.06)`; value becomes control (cyber-sel / toggle / textarea). |
| **Selected** | `.is-selected` cyan ring (click-to-edit within EDIT). |

Play on the header stays active in EDIT (playtest). Dark UI: explicit white text; cyber scrollbar on panels.

### Typography (body)

Closer to the card title, one or two steps smaller:

| Role | Size |
|------|------|
| Ability title (header) | ~0.86rem Orbitron |
| Flavor / effect prose | ~0.92–1rem Fira Sans |
| Attack numbers / formulas | ~1.02rem bold (Fira Code) |
| Attack labels (Light Damage, …) | ~0.38rem Orbitron |
| EDIT controls | one step up from previous micro; still dark + white text |

### Flavor

| Field | VIEW | EDIT |
|-------|------|------|
| `description` | Prose paragraph | Same cell → textarea |

Narrative only — no mechanics in flavor.

### Effects (`AbilityEffect[]`)

One row/card per effect. Macros `[]` in `text` are resolved inside `launchAbility` (same as damage formulas).

| Field | VIEW | EDIT | Notes |
|-------|------|------|-------|
| lane | ON HIT / NONE / MECH | **3-click chip** (ON HIT → MECH → NONE) | orange / unlabeled / violet. **Same row** as `text` (talent VIEW density). |
| `text` | prose; `[]` shown as resolved chips | textarea **on the same row** as the lane chip | |
| `statusCode` + `statusTarget` | optional chip | header tag / body text | not a kind select |

`kind` stays on the data object if present, but is **not** edited on the card. `rule: "grantCrit"` on an effect enables crit on **autohit** attacks (table homebrew).

EDIT: **+ EFFECT** under the effect list. Each effect row has a **×** at the top-right (same chrome as AoE remove) that deletes that effect. Macro helper is a **column to the right** of the card (overlays content below; does not add a row under the body).

### Attack block (`AbilityAttack`) — conditional visibility

Only when `hasAttack === true`. **No d20 cell** in the body. Autohit is a **toggle chip** (≤2) on the **same row** as the damage tickets.

Damage is **one row**: [AUTOHIT?] · Light · Heavy · Miss? · AoE?

```
hasAttack?
  no  → flavor + effects + upgrades
  yes → chip AUTOHIT only if autoHit (VIEW never shows ROLLED); chip shares the ticket row
        Light (DoH) · Heavy (independent formula) · Miss (DoM, hidden if autohit)
        AoE ticket only if damageAoe is set (EDIT: click + AoE to add/remove)
```

| Card label | Field | VIEW | EDIT |
|------------|-------|------|------|
| (chip) | `autoHit` | AUTOHIT / (omitted if rolled) | toggle chip on the ticket row |
| Light | `damageOnHit.formula` | tokens resolved (`d6+2`) | macro input |
| Heavy | `damageOnCrit.formula` | independent (`2d6`) | macro input. **Not** 2× Light |
| Miss | `damageOnMiss.formula` | resolved | hidden if autohit |
| AoE | `damageAoe` | pattern code + formula; **only if set** | `+ AoE` ghost ticket |

**Pierce is a header tag**, not a per-packet flag.

**Heavy ≠ crítico.** Typical Heavy is `2[damageDie]` (sometimes `+[fray]` or another die). Crit-as-double of the applied packet is **not shown or calculated on the card**. Chat still applies Light on HIT and Heavy on CRIT.

Session boons/curses (+1/+2/−1/−2) are chosen in **AttackBoonDialog** at Play time.

**Resolve (table, inside `launchAbility`):** rolled → d20 vs Defense; miss → Miss formula; hit → Light; nat 20 → Heavy formula. Autohit → Light only; crit only if `grantCrit` after talent merge. AoE applies `damageAoe`. Each `[]` in effect text is rolled in the same bundle.

### `DamagePacket` (shared widget)

`{ formula: string }`.

Tokens inside `[]`: `[damageDie]` · `[fray]` · `[mechanicResource]`. Literals outside: `2d8`, `+1`, `2[damageDie]`.

| Mode | UI |
|------|-----|
| VIEW | Substitute tokens, do not roll (`d6+2`, `2d6`) |
| EDIT | Same cell → formula `<input>`. Right-side helper column inserts tokens |

Same `.fld` / `.pkt` footprint in both modes.

### Upgrades

Full-width bottom row: **3 equal columns** (T1 · T2 · M). LB keeps T1/T2 disabled; **M only** is editable.

Each slot is **expand/collapse** (▸/▾) and lists its `mods[]`. `detail` sits in the slot body at the same type size as flavor/effects. Unlock **level / AP** is **display-only** at the **top-right** (`L2`) — not authored on this card (job progression owns it).

**ON/OFF is lab-only** in this mockup (preview merge). It is **not** in the final KIT chrome; owned talents come from character progression.

| Surface | VIEW | EDIT |
|---------|------|------|
| Loadout | T1 left · `L#` right; label + detail at body size; expand → mods; owned = cyan, M = gold | label + detail; `L#` read-only top-right; lab ON/OFF only |
| LB | T1/T2 dimmed · M slot | same |

**Merge rules (unlocked only):** `append_effect` adds rows with a **left T1/T2/M rail** (same chrome as the trait-mode rail: ~32px column, Orbitron badge, cyan for talents / gold for M) · `patch_attack` updates tickets (badge on packet) · `set_fields` / `add_tags` update header chips · `prose_only` is display-only in the expand panel.

Chat posts show resolved merged effects/damage. Upgrade-sourced effects use a left T1/T2/M rail; patched damage tickets get a corner badge. No footer chip list.

RES cost for LB stays in **header** (`RES N`), not body.

### Body layout (B2 locked)

Winner = **B2 Packet tickets**. B1 strip / B3 grouped / B2 split retired.

| ID | Chrome |
|----|--------|
| **B2** | Flavor full width, then ticket row (AUTOHIT chip + Light/Heavy/Miss/AoE). AoE dashed cyan. Effect left-rail. Upgrades row T1/T2/M at 1/3 each. EDIT: 3-click lane chip; × to remove an effect; macro helper as a right column overlay. |

Narrow (LB span 3): same row, tighter padding (chat-like), tickets stay in one row.

### Chat card (launch bundle)

Dock width **340px** (`VTT_RIGHT_DOCK`). One post per Play/macro. Locked card = **C2 Strip**. Must show:

- Ability **name** · **range** · **AoE** · expandable **tags** (same purple tag-btn)
- Flavor prose **without** a FLAVOR label
- Attack roll in a **static band** (not expandable): **HIT / MISS / CRIT** + total on the left; **die faces** on the right (d20 + boon/curse chips). Band color follows the **raw d20 only**: nat 1 red, nat 20 gold, otherwise attack orange.
- **Autohit:** the band is the word `Autohit` only (no total, no dice). Same orange as a normal roll. `grantCrit` does not change the band; Heavy still sits in the strip.
- Light / Heavy / Miss / AoE totals (Miss hidden on autohit). Same standard label color (no live/dim). AoE column keeps cyan dashed chrome. Click a ticket to expand that packet's calc underneath.
- **LB:** gold card chrome, badge `LB`, star mark, `RES N` chip. Attack band still uses the nat 1/20/orange rule.
- Effect text + resolved effect dice. Effects added by an unlocked talent/mastery get a left **T1/T2/M rail** (not a tag next to the label). Patched damage tickets get a corner T1/T2/M badge.

Port B2 + C2 into React after review: body → `DossierKitView.jsx`; chat → `VttChatPanel.jsx` `AbilityChatCard` (replace, do not fork). Share formula util, `KIT_SVG` (cross/pulse/LB star), and `.fx-rail`. Do not paint C2 in PixiJS.

### Cyber selects

No native `<select>` (Windows paints a white list). Use `.cyber-sel` trigger+panel matching React `cyberMenuPaperSx` / `cyberMenuItemSx`: dark `#12121a`, white Fira Code, magenta hover/selected, cyber scrollbar.

- **Multi-option → cyber-sel always:** actionCost, range, aoe, traitMode, plate DIE, RES, tag-add. **No cycle.**
- **Binary → toggle/chip:** ATK\|STD, autohit, pin. JOB\|ZAR deferred (source = job).
- **3 states → 3-click chip (not sel):** effect lane ON HIT / MECH / NONE.

### Bench + over-6

Bench lives **under Loadout**, **collapsed by default** (click `BENCH · INACTIVE` to expand). Inactive abilities render as gray `.card.inactive`. EDIT ENABLE/DISABLE moves ids (`loadout[]` only — **disable ≠ delete**). Delete catalog = remove `abilities/{key}` + unlink. Body `×` deletes an **effect row**, not the ability. If `loadout.length > 6`: rail `.over`, `OVER 6` label, danger pips — **does not block** add/enable.

LB rail: READY → gold `--lb`; LOCKED → `--lb-locked`.

Blanks: ability `{ title: "NEW ABILITY", hasAttack: false, actionCost: 1, source: "job", tags: [], effects: [], talents: [], mastery: null }`; ATK adds `attack: { autoHit: false, toHit: { boons: 0 }, damageOnHit: { formula: "[damageDie]+[fray]" }, damageOnMiss: { formula: "[fray]" }, damageOnCrit: { formula: "2[damageDie]" } }`. Trait `{ title: "NEW TRAIT", traitMode: "passive", body: "" }`.

**Job ownership:** `traits`, `abilities`, and `lb` belong to `jobs[activeJobId]`. Plate job control switches the catalog. React mapping: `clases/{jobId}` + `clases/{jobId}/abilities/{id}`. ICON play: traits+LB from **primary** job; abilities may mix — this mockup authors **per job**, not a mixed triptych.

## Resolve sketch

Triggered only by **Play** or **macro** → `launchToChat` (one chat post).

1. If rolled attack (`hasAttack && !autoHit`): AttackBoonDialog picks session boons/curses (+1/+2/−1/−2 exclusive), then continue.
2. Merge unlocked talent + mastery **ops** onto a working copy.
3. If `hasAttack`:
   - **autoHit** → apply Light (no miss). Crit only if `rule: "grantCrit"` (or similar) is present after merge (applies Heavy formula).
   - **else** → roll d20 + boons/curses vs Defense; miss → Miss formula; hit → Light; nat 20 → Heavy formula.
4. Run `effects[]`; each `[]` in effect text is rolled in the **same** bundle.
5. Post one chat card: title, flavor, resolved Attack / Light / Heavy / Miss, effects.

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
    { "id": "e1", "lane": "plain", "kind": "move", "label": "SETUP", "text": "Dash 2, then attack." },
    { "id": "e2", "lane": "hit", "kind": "status", "label": "ON HIT", "text": "Mark the target. [damageDie]", "statusCode": "MRK", "statusTarget": "target" }
  ],
  "attack": {
    "autoHit": false,
    "toHit": { "boons": 0 },
    "damageOnHit": { "formula": "[damageDie]+[fray]" },
    "damageOnMiss": { "formula": "[fray]" },
    "damageOnCrit": { "formula": "2[damageDie]" }
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
      { "op": "patch_attack", "patch": { "damageOnHit": { "formula": "[damageDie]+[fray]+1" } } }
    ]
  }
}
```
