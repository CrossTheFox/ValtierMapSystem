import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
    ITEM_EFFECT_TYPES,
    ITEM_EQUIP_KIND_META,
    ITEM_EQUIP_KINDS,
    ITEM_EQUIP_NODE_META,
    ITEM_EQUIP_NODES,
    ITEM_OWNER,
    ITEM_TYPES,
    canEquipOnNode,
    emptyItem,
    isEquipped,
    maskToStore,
    normalizeItem,
    normalizeItemEffect,
} from "./campaignItems.js";
import {
    applyItemCombatOverlays,
    getActionBoon,
    sumItemStatMods,
} from "./characterItemEffects.js";

describe("campaignItems", () => {
    it("normalizes mask, owner, and effect drafts", () => {
        const it = normalizeItem({
            id: "a",
            type: "nope",
            ownerType: ITEM_OWNER.CHARACTER,
            ownerCharacterId: "pj1",
            mask: [[1, 0], [1, 1]],
            rot: 5,
            gx: 1,
            gy: 2,
            effect: { type: ITEM_EFFECT_TYPES.STAT_MOD, targetId: "vit", amount: 9 },
        });
        assert.equal(it.type, ITEM_TYPES.JUNK);
        assert.equal(it.rot, 1);
        assert.equal(it.gx, 1);
        assert.equal(it.effect.amount, 4);
        assert.equal(it.effect.targetId, "vit");
    });

    it("vault items drop character owner", () => {
        const it = emptyItem({ ownerType: ITEM_OWNER.VAULT, ownerCharacterId: "x" });
        assert.equal(it.ownerType, ITEM_OWNER.VAULT);
        assert.equal(it.ownerCharacterId, null);
    });

    it("rejects unknown effect types", () => {
        assert.equal(normalizeItemEffect({ type: "explode" }), null);
    });

    it("roundtrips tetris mask without nested arrays", () => {
        const mask = [[1, 0], [1, 0], [1, 1]];
        const store = maskToStore(mask);
        assert.equal(store.cells.some((c) => Array.isArray(c)), false);
        assert.deepEqual(store.cells, [
            { x: 0, y: 0 },
            { x: 0, y: 1 },
            { x: 0, y: 2 },
            { x: 1, y: 2 },
        ]);
        const it = normalizeItem({ id: "m", mask: store });
        assert.deepEqual(it.mask, mask);
    });

    it("non-equipable items cannot sit on any node", () => {
        const it = normalizeItem({
            id: "gun",
            equipable: false,
            equipSlots: [ITEM_EQUIP_KINDS.HANDS, ITEM_EQUIP_KINDS.HEAD],
            equippedSlot: ITEM_EQUIP_NODES.HAND_L,
        });
        assert.equal(it.equipable, false);
        assert.deepEqual(it.equipSlots, []);
        assert.equal(it.equippedSlot, null);
        assert.equal(canEquipOnNode(it, ITEM_EQUIP_NODES.HAND_L), false);
        assert.equal(isEquipped(it), false);
    });

    it("equipable items accept listed kinds including both hands", () => {
        const it = normalizeItem({
            id: "blade",
            equipable: true,
            equipSlots: [ITEM_EQUIP_KINDS.HANDS, ITEM_EQUIP_KINDS.BACK, "nope"],
            equippedSlot: ITEM_EQUIP_NODES.HAND_R,
            imageUrl: "characters/items/blade/a.png",
        });
        assert.equal(it.equipable, true);
        assert.deepEqual(it.equipSlots, [ITEM_EQUIP_KINDS.HANDS, ITEM_EQUIP_KINDS.BACK]);
        assert.equal(canEquipOnNode(it, ITEM_EQUIP_NODES.HAND_L), true);
        assert.equal(canEquipOnNode(it, ITEM_EQUIP_NODES.HAND_R), true);
        assert.equal(canEquipOnNode(it, ITEM_EQUIP_NODES.HEAD), false);
        assert.equal(canEquipOnNode(it, ITEM_EQUIP_NODES.BACK), true);
        assert.equal(isEquipped(it), true);
        assert.equal(it.imageUrl, "characters/items/blade/a.png");
    });

    it("places loadout nodes in a humanoid layout with distinct colors", () => {
        const head = ITEM_EQUIP_NODE_META[ITEM_EQUIP_NODES.HEAD];
        const chest = ITEM_EQUIP_NODE_META[ITEM_EQUIP_NODES.CHEST];
        const back = ITEM_EQUIP_NODE_META[ITEM_EQUIP_NODES.BACK];
        const handL = ITEM_EQUIP_NODE_META[ITEM_EQUIP_NODES.HAND_L];
        const handR = ITEM_EQUIP_NODE_META[ITEM_EQUIP_NODES.HAND_R];
        const legs = ITEM_EQUIP_NODE_META[ITEM_EQUIP_NODES.LEGS];
        assert.equal(chest.x, "50%");
        assert.ok(parseFloat(head.y) < parseFloat(chest.y));
        assert.ok(parseFloat(back.x) > parseFloat(chest.x));
        assert.ok(parseFloat(back.y) < parseFloat(chest.y));
        assert.ok(parseFloat(handL.x) < parseFloat(chest.x));
        assert.ok(parseFloat(handR.x) > parseFloat(chest.x));
        assert.ok(parseFloat(legs.y) > parseFloat(chest.y));
        const colors = new Set(Object.values(ITEM_EQUIP_KIND_META).map((m) => m.color));
        assert.equal(colors.size, Object.keys(ITEM_EQUIP_KIND_META).length);
        assert.equal(head.color, ITEM_EQUIP_KIND_META[ITEM_EQUIP_KINDS.HEAD].color);
    });
});

describe("characterItemEffects", () => {
    it("sums carried stat mods and ignores vault", () => {
        const items = [
            {
                ownerType: ITEM_OWNER.CHARACTER,
                ownerCharacterId: "pj",
                effect: { type: ITEM_EFFECT_TYPES.STAT_MOD, targetId: "vit", amount: 1 },
            },
            {
                ownerType: ITEM_OWNER.VAULT,
                ownerCharacterId: null,
                effect: { type: ITEM_EFFECT_TYPES.STAT_MOD, targetId: "vit", amount: 3 },
            },
        ];
        assert.equal(sumItemStatMods(items, "pj").vit, 1);
        const over = applyItemCombatOverlays({ vit: 4, hpMax: 16, speed: 4, dash: 2 }, items, "pj");
        assert.equal(over.vit, 5);
        assert.equal(over.hpMax, 20);
    });

    it("stacks action boons", () => {
        const items = [
            {
                ownerType: ITEM_OWNER.CHARACTER,
                ownerCharacterId: "pj",
                effect: { type: ITEM_EFFECT_TYPES.ACTION_BOON, targetId: "sneak", amount: 1 },
            },
            {
                ownerType: ITEM_OWNER.CHARACTER,
                ownerCharacterId: "pj",
                effect: { type: ITEM_EFFECT_TYPES.ACTION_BOON, targetId: "sneak", amount: 2 },
            },
        ];
        assert.equal(getActionBoon(items, "pj", "sneak"), 3);
        assert.equal(getActionBoon(items, "pj", "smash"), 0);
    });
});
