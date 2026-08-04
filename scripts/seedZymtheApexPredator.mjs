/**
 * Create Zymthe (Apex Predator / Vagabond) for player lizheru.
 *
 * - Job + Special Mechanic Moon Phases
 * - Traits: Quick Switch, Hunter, Hiddeous Apex
 * - Abilities: NEW MOON, FULL MOON
 * - Character owned by lizheru (UID below)
 *
 * Usage:
 *   node scripts/seedZymtheApexPredator.mjs
 *   node scripts/seedZymtheApexPredator.mjs --dry-run
 */
import admin from "firebase-admin";
import fs from "fs";
import path from "path";

const DEFAULT_SA = path.resolve(process.cwd(), "valtier-map-system-firebase-admins.json");

/** lizheru@valtia.com */
const OWNER_UID = "1YRTUqBT6nQwg2rMQUbHmWiN48Z2";
const CAMPAIGN_ID = "RfY23gcG7No5HcGddo1j";
/** Same map location as other Valtia PCs (Judeth). */
const LOCATION_ID = "Fix7rFHl62MV4HSpzc3F";
const CLASS_ID = "class_zymthe_apex_predator";

const ABILITY_KEYS = Object.freeze([
    "zymthe-class-root",
    "zymthe-trait-quick-switch",
    "zymthe-trait-hunter",
    "zymthe-trait-hiddeous-apex",
    "zymthe-ability-new-moon",
    "zymthe-ability-full-moon",
]);

const JOB_DESCRIPTION = `La supervivencia no fue fácil, pero lo lograste y llegaste hasta el tope de la cadena alimenticia. No sabes cómo, pero fuiste capaz de manipular tu magia para ayudarte a ser el Apex Predator.

Puedes manipular cómo los demás te ven, tu velocidad, tu fuerza, la naturaleza mágica de tus armas y hasta el poder de estas. No sabes exactamente qué eres, pero no te importa, solo importa que te lanzaron a los lobos y terminaste conquistando el bosque.`;

const SPECIAL_MECHANIC = {
    name: "Moon Phases",
    text: `Tienes una naturaleza mágica que te ha ayudado a subsistir, a sobrevivir y a cumplir tus objetivos. Esta naturaleza depende de tus necesidades y del entendimiento que tienes de tu poder.

Cada Moon Phase te otorga beneficios y ayudas en tus acciones, como hacerte invisible, moverte con sigilo, asesinar con precisión y letalidad o ser una máquina de diezmar legiones.

Tus armas se ven afectadas por la Moon Phase actual, al igual que tus acciones y tu forma de manipular tu magia interna.`,
};

const NEW_MOON_CONTENT = `Tus ataques son sigilosos, con una precisión letal, tus movimientos son inclusive etéreos, tus armas se imbuyen en una energía que parece anular la misma realidad.

**Switch:** Entras en Stealth hasta el inicio de tu siguiente turno y obtienes Vigor 4.

**Pasiva:** Tus ataques ganan **True Strike**, +1 Boon y +D al daño si atacas desde **Stealth**.`;

const FULL_MOON_CONTENT = `Tus ataques queman, tu cuerpo se imbuye en magia de fuego y tus heridas sanan.

**Switch:** Curas automáticamente 4 de HP y tu siguiente ataque tiene **Scorch**.

**Pasiva:** Tus ataques tienen **Piercing**, obtienes Armor 2 y enemigos que entren/terminen turno adyacente a ti sufren [@{fray}] Divine.

**Scorch:** Si el ataque da, el objetivo sufre [@{fray}] Divine al inicio de cada turno por 2 rondas.`;

function parseArgs(argv) {
    return { dryRun: argv.includes("--dry-run") };
}

function initAdmin() {
    if (admin.apps.length) return admin.firestore();
    const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS || DEFAULT_SA;
    if (!fs.existsSync(credPath)) {
        throw new Error(`Service account not found: ${credPath}`);
    }
    admin.initializeApp({ credential: admin.credential.cert(JSON.parse(fs.readFileSync(credPath, "utf8"))) });
    return admin.firestore();
}

async function main() {
    const { dryRun } = parseArgs(process.argv);
    const db = initAdmin();
    const now = admin.firestore.FieldValue.serverTimestamp();

    const existing = await db.collection("characters").where("name", "==", "Zymthe").where("campaignId", "==", CAMPAIGN_ID).get();
    if (!existing.empty) {
        console.error(`Zymthe already exists: ${existing.docs.map((d) => d.id).join(", ")}. Abort.`);
        process.exit(1);
    }

    const clasePayload = {
        campaignId: CAMPAIGN_ID,
        displayName: "Apex Predator",
        classArchetype: "vagabond",
        description: JOB_DESCRIPTION,
        specialMechanic: SPECIAL_MECHANIC,
        combatStats: {
            vit: 7,
            defense: 16,
            speed: 10,
            fray: 2,
            damageDie: 10,
            armor: 0,
            vigor: 0,
        },
        status: "active",
        updatedAt: now,
    };

    const abilities = {
        "zymthe-class-root": {
            key: "zymthe-class-root",
            label: "Vagabond — Apex Predator",
            type: "class_root",
            abilityKind: "standard",
            content: JOB_DESCRIPTION,
            cost: "",
            tagKeys: [],
            campaignId: CAMPAIGN_ID,
            updatedAt: now,
        },
        "zymthe-trait-quick-switch": {
            key: "zymthe-trait-quick-switch",
            label: "Quick Switch",
            type: "trait",
            abilityKind: "standard",
            traitCategory: "positive_effects",
            content: 'Cuando cambias de Moon Phase o la vuelves a activar, obtienes los beneficios de "Switch" listada en la habilidad.',
            cost: "",
            tagKeys: [],
            campaignId: CAMPAIGN_ID,
            updatedAt: now,
        },
        "zymthe-trait-hunter": {
            key: "zymthe-trait-hunter",
            label: "Hunter",
            type: "trait",
            abilityKind: "standard",
            traitCategory: "positive_effects",
            content: "Puedes hacer Dash antes o después de realizar un ataque o acción y tiene Dodge+.",
            cost: "",
            tagKeys: ["dodge"],
            campaignId: CAMPAIGN_ID,
            updatedAt: now,
        },
        "zymthe-trait-hiddeous-apex": {
            key: "zymthe-trait-hiddeous-apex",
            label: "Hiddeous Apex",
            type: "trait",
            abilityKind: "standard",
            traitCategory: "positive_effects",
            content: `— Si terminas turno sin enemigos adyacentes, ganas 1 Dash gratis (adicional a Hunter).
— Si terminas turno adyacente a un enemigo, obtienes Evasión.`,
            cost: "",
            tagKeys: [],
            campaignId: CAMPAIGN_ID,
            updatedAt: now,
        },
        "zymthe-ability-new-moon": {
            key: "zymthe-ability-new-moon",
            label: "NEW MOON",
            type: "ability",
            abilityKind: "standard",
            content: NEW_MOON_CONTENT,
            cost: "Void · 1 Action · Moon Stance",
            tagKeys: ["true-strike"],
            campaignId: CAMPAIGN_ID,
            updatedAt: now,
        },
        "zymthe-ability-full-moon": {
            key: "zymthe-ability-full-moon",
            label: "FULL MOON",
            type: "ability",
            abilityKind: "standard",
            content: FULL_MOON_CONTENT,
            cost: "Solar · 1 Action · Moon Stance",
            tagKeys: ["pierce"],
            campaignId: CAMPAIGN_ID,
            updatedAt: now,
        },
    };

    const charRef = db.collection("characters").doc();
    const charPayload = {
        name: "Zymthe",
        age: 0,
        bio: JOB_DESCRIPTION,
        type: "player",
        status: "active",
        imageUrl: "",
        isLocked: false,
        unlockGoal: "",
        campaignId: CAMPAIGN_ID,
        locationId: LOCATION_ID,
        ownerPlayerId: OWNER_UID,
        controlledByPlayerIds: [OWNER_UID],
        assignedClassIds: [CLASS_ID],
        activeClassId: CLASS_ID,
        allAbilities: [...ABILITY_KEYS],
        unlockedAbilities: [...ABILITY_KEYS],
        loadout: ["zymthe-ability-new-moon", "zymthe-ability-full-moon"],
        vit: 7,
        combatOverrides: {
            vit: 7,
            defense: 16,
            speed: 10,
            fray: 2,
            damageDie: 10,
            armor: 0,
            vigor: 0,
        },
        stats: {
            charm: 0,
            command: 0,
            endure: 0,
            excel: 0,
            sense: 0,
            smash: 0,
            sneak: 0,
            study: 0,
            tinker: 0,
            traverse: 0,
        },
        bond: {
            name: "",
            archetype: "",
            description: "",
            specialAbility: "",
            secondWind: "",
            ideals: [],
            notes: "",
        },
        bondPowers: [],
        iconSheet: {
            source: "seed",
            kin: "",
            culture: "",
            pronouns: "",
            narrativeLevel: 0,
            chapter: "I",
            iconClass: "vagabond",
            jobDisplayName: "Apex Predator",
            tactical: {
                customResource: null,
                dust: 0,
                resolvePersonal: null,
                resolveParty: null,
                traits: [
                    { title: "Quick Switch", body: abilities["zymthe-trait-quick-switch"].content },
                    { title: "Hunter", body: abilities["zymthe-trait-hunter"].content },
                    { title: "Hiddeous Apex", body: abilities["zymthe-trait-hiddeous-apex"].content },
                ],
            },
        },
        relations: {},
        createdAt: now,
        updatedAt: now,
    };

    console.log(dryRun ? "[dry-run]" : "Seed", {
        characterId: charRef.id,
        classId: CLASS_ID,
        ownerUid: OWNER_UID,
        abilities: ABILITY_KEYS.length,
    });

    if (dryRun) {
        console.log(JSON.stringify({ clasePayload, abilities, charPayload }, null, 2));
        return;
    }

    const batch = db.batch();

    const claseRef = db.collection("clases").doc(CLASS_ID);
    batch.set(claseRef, { ...clasePayload, createdAt: now, sourceCharacterId: charRef.id }, { merge: true });

    for (const key of ABILITY_KEYS) {
        batch.set(
            claseRef.collection("abilities").doc(key),
            { abilityKey: key, linkedAt: now },
            { merge: true },
        );
        batch.set(db.collection("abilities").doc(key), abilities[key], { merge: true });
    }

    batch.set(charRef, charPayload);

    const playerRef = db.collection("players").doc(OWNER_UID);
    const playerSnap = await playerRef.get();
    const prevIds = Array.isArray(playerSnap.data()?.characterIds) ? playerSnap.data().characterIds : [];
    const nextIds = [...new Set([...prevIds, charRef.id])];
    batch.set(
        playerRef,
        {
            characterIds: nextIds,
            activeCharacterId: charRef.id,
            campaignIds: admin.firestore.FieldValue.arrayUnion(CAMPAIGN_ID),
            updatedAt: now,
        },
        { merge: true },
    );

    const campRef = db.collection("campaigns").doc(CAMPAIGN_ID);
    batch.set(
        campRef,
        {
            playerIds: admin.firestore.FieldValue.arrayUnion(OWNER_UID),
            updatedAt: now,
        },
        { merge: true },
    );

    await batch.commit();
    console.log(`OK: Zymthe ${charRef.id} → lizheru ${OWNER_UID}`);
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
