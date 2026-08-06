/**
 * Create player Odette + character Caelum (Weaver of Odds / Mendicant).
 *
 * - Auth user: Odette / valtia01 → odette@valtia.com
 * - Job + Special Mechanic MOMENTUM (class resource MOMENTUM, max 3)
 * - Traits: REALITY LOADER, SUCCOR, REALITY PAYBACK, STATISTICAL WARRIOR
 * - Abilities: STABILIZE REALITY, STABILIZATION DOME, DESTRUCTION DOME
 * - Bond: The Elder · Power: LONG MEMORY
 *
 * Usage:
 *   node scripts/seedCaelumWeaverOfOdds.mjs
 *   node scripts/seedCaelumWeaverOfOdds.mjs --dry-run
 */
import admin from "firebase-admin";
import fs from "fs";
import path from "path";

const DEFAULT_SA = path.resolve(process.cwd(), "valtier-map-system-firebase-admins.json");

const NICKNAME = "Odette";
const EMAIL = "odette@valtia.com";
/** Same password as alexdinosaurio (shared table password). */
const PASSWORD = "valtia01";

const CAMPAIGN_ID = "RfY23gcG7No5HcGddo1j";
/** Same map location as other Valtia PCs (Judeth / Zymthe / Nyssara). */
const LOCATION_ID = "Fix7rFHl62MV4HSpzc3F";
const CLASS_ID = "class_caelum_weaver_of_odds";
const CHAR_NAME = "Caelum";

const ABILITY_KEYS = Object.freeze([
    "caelum-class-root",
    "caelum-trait-reality-loader",
    "caelum-trait-succor",
    "caelum-trait-reality-payback",
    "caelum-trait-statistical-warrior",
    "caelum-ability-stabilize-reality",
    "caelum-ability-stabilization-dome",
    "caelum-ability-destruction-dome",
]);

const JOB_DESCRIPTION = `Has alcanzado un entendimiento tal de la realidad que puedes reordenar las probabilidades microscópicas del mundo: fluctuaciones mágicas, comportamiento de las almas y coincidencias físicas. Puedes influir eventos triviales con facilidad.`;

const SPECIAL_MECHANIC = {
    name: "MOMENTUM",
    text: `Durante una escena o combate puedes alterar probabilidades. Una alteración es un **Interrupt**; por ahora puedes hacer máximo **3** y puedes hacer más de 1 interrupt por turno.

*(Interrupt: Acción que puedes tomar cuando desees, dentro o fuera de tu turno.)*`,
};

const STABILIZE_REALITY = `*La mejor manera de evitar que esto explote es dándole unos nanais a la realidad...*

1|2 Actions

**Disminuyes** **-2 Momentum** por cada acción gastada (1 o 2 acciones).`;

const STABILIZATION_DOME = `**Range 2** · 2 Actions · **Blast 4**

*Mejor actuar donde uno sabe donde no habrán sorpresas*

**Creas un área de Blast 4** donde el aumento de Momentum se reduce en 1 y puedes elegir si el **Backlash** lo sufres tú o un aliado. El domo dura **3 rondas**.

**Effect:** Aliados dentro del domo obtienen **Cover**.`;

const DESTRUCTION_DOME = `**Range 4** · 2 Actions · **Blast 4**

*A veces es también buena idea desestabilizar un poco las cosas para el enemigo*

Enemigos en el área quedan **Dazed+** y **Vulnerable+** mientras estén dentro del área. El domo dura **3 rondas**.

**Effect:** Si tienes **1 Stabilization Dome** y un **Destruction Dome**, puedes redirigir un **Backlash** hacia el **Destruction Dome**, a cambio de que ambos domos se destruyan.`;

const BOND_ELDER = {
    name: "The Elder",
    archetype: "The Elder",
    description:
        "You've been around a long time – maybe too long. You've seen a lot of what Arden Eld has to offer – the good and the bad. The adventuring life, with its threats, challenges, and its wandering lifestyle, are something you would perhaps want put behind you, but you have a little more work to do before you can put your gear away for good. There are people out there who need you.",
    specialAbility:
        "At the start of a session, choose another character to watch over. The first time in the session that character would take a burden, you can intervene and choose to take that burden instead if you have one free. If you do, regain all effort and clear all strain.",
    secondWind:
        "You can regain all effort when you manage to avoid confrontation or violence through your actions.",
    ideals: [],
    notes: "",
};

const LONG_MEMORY = {
    name: "LONG MEMORY",
    frequency: "Pasiva",
    description:
        "Gain +1d on rolls to gather information about any event that happened in your lifetime.",
};

function parseArgs(argv) {
    return { dryRun: argv.includes("--dry-run") };
}

function initAdmin() {
    if (admin.apps.length) return;
    const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS || DEFAULT_SA;
    if (!fs.existsSync(credPath)) {
        throw new Error(`Service account not found: ${credPath}`);
    }
    admin.initializeApp({ credential: admin.credential.cert(JSON.parse(fs.readFileSync(credPath, "utf8"))) });
}

async function ensureOdetteUser(dryRun) {
    const auth = admin.auth();
    try {
        const existing = await auth.getUserByEmail(EMAIL);
        console.log(`Auth user already exists: ${EMAIL} → ${existing.uid}`);
        return existing.uid;
    } catch (err) {
        if (err?.code !== "auth/user-not-found") throw err;
    }

    if (dryRun) {
        console.log(`[dry-run] Would create Auth user ${EMAIL}`);
        return "DRY_RUN_UID";
    }

    const user = await auth.createUser({
        email: EMAIL,
        password: PASSWORD,
        displayName: NICKNAME,
        emailVerified: true,
        disabled: false,
    });
    console.log(`Created Auth user ${EMAIL} → ${user.uid}`);
    return user.uid;
}

async function main() {
    const { dryRun } = parseArgs(process.argv);
    initAdmin();
    const db = admin.firestore();
    const now = admin.firestore.FieldValue.serverTimestamp();

    const existingChar = await db
        .collection("characters")
        .where("name", "==", CHAR_NAME)
        .where("campaignId", "==", CAMPAIGN_ID)
        .get();
    if (!existingChar.empty) {
        console.error(
            `${CHAR_NAME} already exists: ${existingChar.docs.map((d) => d.id).join(", ")}. Abort.`,
        );
        process.exit(1);
    }

    const ownerUid = await ensureOdetteUser(dryRun);

    const clasePayload = {
        campaignId: CAMPAIGN_ID,
        displayName: "Weaver of Odds",
        classArchetype: "mendicant",
        description: JOB_DESCRIPTION,
        specialMechanic: SPECIAL_MECHANIC,
        classResource: { name: "MOMENTUM", min: 0, max: 3 },
        combatStats: {
            vit: 10,
            defense: 15,
            speed: 8,
            fray: 3,
            damageDie: 6,
            armor: 0,
            vigor: 0,
        },
        status: "active",
        updatedAt: now,
    };

    const abilities = {
        "caelum-class-root": {
            key: "caelum-class-root",
            label: "Mendicant — Weaver of Odds",
            type: "class_root",
            abilityKind: "standard",
            content: JOB_DESCRIPTION,
            cost: "",
            tagKeys: [],
            campaignId: CAMPAIGN_ID,
            updatedAt: now,
        },
        "caelum-trait-reality-loader": {
            key: "caelum-trait-reality-loader",
            label: "REALITY LOADER",
            type: "trait",
            abilityKind: "standard",
            traitCategory: "positive_effects",
            content:
                "Si realizas una alteración que acumule **+3 Momentum**, puedes reducirlo en **-1 Momentum** a cambio de que el siguiente ataque contra ti tenga **+1 Boon** o sufras inmediatamente **6 Divine Damage**.",
            cost: "",
            tagKeys: [],
            campaignId: CAMPAIGN_ID,
            updatedAt: now,
        },
        "caelum-trait-succor": {
            key: "caelum-trait-succor",
            label: "SUCCOR",
            type: "trait",
            abilityKind: "standard",
            traitCategory: "positive_effects",
            content: "Puedes hacer **Rescue** en **Range 6**.",
            cost: "",
            tagKeys: ["rescue"],
            campaignId: CAMPAIGN_ID,
            updatedAt: now,
        },
        "caelum-trait-reality-payback": {
            key: "caelum-trait-reality-payback",
            label: "REALITY PAYBACK",
            type: "trait",
            abilityKind: "standard",
            traitCategory: "positive_effects",
            content:
                "1 vez por combate puedes ignorar un **Backlash**, pero la siguiente alteración duplicará el Momentum ganado.",
            cost: "",
            tagKeys: [],
            campaignId: CAMPAIGN_ID,
            updatedAt: now,
        },
        "caelum-trait-statistical-warrior": {
            key: "caelum-trait-statistical-warrior",
            label: "STATISTICAL WARRIOR",
            type: "trait",
            abilityKind: "standard",
            traitCategory: "positive_effects",
            content:
                "- Mientras tengas **>4 Momentum**, aliados adyacentes a ti tienen **+1 Boon** en ataques y Saves.\n- Mientras tengas **>8 Momentum**, el área anterior pasa a ser **Aura 4**.",
            cost: "",
            tagKeys: ["aura"],
            campaignId: CAMPAIGN_ID,
            updatedAt: now,
        },
        "caelum-ability-stabilize-reality": {
            key: "caelum-ability-stabilize-reality",
            label: "STABILIZE REALITY",
            type: "ability",
            abilityKind: "standard",
            content: STABILIZE_REALITY,
            cost: "General · 1|2 Actions",
            tagKeys: [],
            campaignId: CAMPAIGN_ID,
            updatedAt: now,
        },
        "caelum-ability-stabilization-dome": {
            key: "caelum-ability-stabilization-dome",
            label: "STABILIZATION DOME",
            type: "ability",
            abilityKind: "standard",
            content: STABILIZATION_DOME,
            cost: "Mendicant · 2 Actions · Range 2 · Blast 4",
            tagKeys: ["blast", "cover"],
            campaignId: CAMPAIGN_ID,
            updatedAt: now,
        },
        "caelum-ability-destruction-dome": {
            key: "caelum-ability-destruction-dome",
            label: "DESTRUCTION DOME",
            type: "ability",
            abilityKind: "standard",
            content: DESTRUCTION_DOME,
            cost: "Mendicant · 2 Actions · Range 4 · Blast 4",
            tagKeys: ["blast", "dazed", "vulnerable"],
            campaignId: CAMPAIGN_ID,
            updatedAt: now,
        },
    };

    const charRef = db.collection("characters").doc();
    const charPayload = {
        name: CHAR_NAME,
        age: 0,
        bio: JOB_DESCRIPTION,
        type: "player",
        status: "active",
        imageUrl: "",
        isLocked: false,
        unlockGoal: "",
        campaignId: CAMPAIGN_ID,
        locationId: LOCATION_ID,
        ownerPlayerId: ownerUid,
        controlledByPlayerIds: [ownerUid],
        assignedClassIds: [CLASS_ID],
        activeClassId: CLASS_ID,
        allAbilities: [...ABILITY_KEYS],
        unlockedAbilities: [...ABILITY_KEYS],
        loadout: [
            "caelum-ability-stabilize-reality",
            "caelum-ability-stabilization-dome",
            "caelum-ability-destruction-dome",
        ],
        vit: 10,
        combatOverrides: {
            vit: 10,
            defense: 15,
            speed: 8,
            fray: 3,
            damageDie: 6,
            armor: 0,
            vigor: 0,
        },
        stats: {
            charm: 1,
            command: 0,
            endure: 0,
            excel: 2,
            sense: 0,
            smash: 0,
            sneak: 0,
            study: 2,
            tinker: 1,
            traverse: 0,
        },
        bond: BOND_ELDER,
        bondPowers: [LONG_MEMORY],
        iconSheet: {
            source: "seed",
            kin: "",
            culture: "",
            pronouns: "",
            narrativeLevel: 0,
            chapter: "I",
            iconClass: "mendicant",
            jobDisplayName: "Weaver of Odds",
            narrativePoolsInitial: {
                effort: { current: 0, max: 3 },
                strain: { current: 0, max: 5 },
            },
            tactical: {
                customResource: {
                    key: "momentum",
                    label: "MOMENTUM",
                    current: 0,
                    max: 3,
                },
                dust: 0,
                resolvePersonal: null,
                resolveParty: null,
                traits: [
                    { title: "REALITY LOADER", body: abilities["caelum-trait-reality-loader"].content },
                    { title: "SUCCOR", body: abilities["caelum-trait-succor"].content },
                    { title: "REALITY PAYBACK", body: abilities["caelum-trait-reality-payback"].content },
                    {
                        title: "STATISTICAL WARRIOR",
                        body: abilities["caelum-trait-statistical-warrior"].content,
                    },
                ],
            },
        },
        relations: {},
        createdAt: now,
        updatedAt: now,
    };

    const playerPayload = {
        uid: ownerUid,
        nickname: NICKNAME,
        role: "player",
        bio: "",
        imageUrl: "",
        relations: {},
        characterIds: [charRef.id],
        activeCharacterId: charRef.id,
        campaignIds: admin.firestore.FieldValue.arrayUnion(CAMPAIGN_ID),
        updatedAt: now,
    };

    console.log(dryRun ? "[dry-run]" : "Seed", {
        characterId: charRef.id,
        classId: CLASS_ID,
        ownerUid,
        nickname: NICKNAME,
        email: EMAIL,
        character: CHAR_NAME,
        abilities: ABILITY_KEYS.length,
    });

    if (dryRun) {
        console.log(
            JSON.stringify(
                { clasePayload, abilities, charPayload, playerPayload: { ...playerPayload, uid: ownerUid } },
                null,
                2,
            ),
        );
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

    const playerRef = db.collection("players").doc(ownerUid);
    const playerSnap = await playerRef.get();
    if (playerSnap.exists) {
        const prevIds = Array.isArray(playerSnap.data()?.characterIds)
            ? playerSnap.data().characterIds
            : [];
        batch.set(
            playerRef,
            {
                nickname: NICKNAME,
                role: "player",
                characterIds: [...new Set([...prevIds, charRef.id])],
                activeCharacterId: charRef.id,
                campaignIds: admin.firestore.FieldValue.arrayUnion(CAMPAIGN_ID),
                updatedAt: now,
            },
            { merge: true },
        );
    } else {
        batch.set(playerRef, {
            ...playerPayload,
            createdAt: now,
        });
    }

    batch.set(
        db.collection("campaigns").doc(CAMPAIGN_ID),
        {
            playerIds: admin.firestore.FieldValue.arrayUnion(ownerUid),
            updatedAt: now,
        },
        { merge: true },
    );

    await batch.commit();
    console.log(`OK: ${CHAR_NAME} ${charRef.id} → Odette ${ownerUid} (${EMAIL})`);
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
