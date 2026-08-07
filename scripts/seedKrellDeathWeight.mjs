/**
 * Create player tommyrabbit + character Krell de Rokk (Death Weight / Stalwart).
 *
 * - Auth user: tommyrabbit / valtia01 → tommyrabbit@valtia.com
 * - Bond: The Outsider · Power: GAIA COMPASS · +2 Traverse
 * - Job + Special Mechanic AIR ANCHOR (class resource ANCHORS)
 * - Traits: DEAD WEIGHT, FORTIFY, AIRLOCK, TETHER
 * - Abilities: DROP ANCHOR, CHAIN HAUL
 *
 * Usage:
 *   node scripts/seedKrellDeathWeight.mjs
 *   node scripts/seedKrellDeathWeight.mjs --dry-run
 */
import admin from "firebase-admin";
import fs from "fs";
import path from "path";

const DEFAULT_SA = path.resolve(process.cwd(), "valtier-map-system-firebase-admins.json");

const NICKNAME = "tommyrabbit";
const EMAIL = "tommyrabbit@valtia.com";
/** Same password as alexdinosaurio (shared table password). */
const PASSWORD = "valtia01";

const CAMPAIGN_ID = "RfY23gcG7No5HcGddo1j";
const LOCATION_ID = "Fix7rFHl62MV4HSpzc3F";
const CLASS_ID = "class_krell_death_weight";
const CHAR_NAME = "Krell de Rokk";

const ABILITY_KEYS = Object.freeze([
    "krell-class-root",
    "krell-trait-dead-weight",
    "krell-trait-fortify",
    "krell-trait-airlock",
    "krell-trait-tether",
    "krell-ability-drop-anchor",
    "krell-ability-chain-haul",
]);

const JOB_DESCRIPTION = `Portas un **ancla Zarken**: tecnología hecha para mantener navíos voladores fijos *en el aire*. Para cualquiera más es un peso absurdo; para ti es manejable, casi natural. A voluntad puedes **anclarla al aire** — no se sabe cómo: simplemente se queda ahí, inamovible, como si el vacío hubiera aprendido a tener suelo. Eres el punto muerto del campo de batalla: donde clavas el ancla, el mundo deja de moverse.`;

const SPECIAL_MECHANIC = {
    name: "AIR ANCHOR",
    text: `Puedes plantar hasta **1 Air Anchor** en el mapa (incluye espacios vacíos / “en el aire”). El ancla es **inamovible** hasta que la **recuperas** (1 Action, Range 6) o se destruye.

- El espacio del ancla y los adyacentes tienen **Rampart**.
- Quienes **Collide** contra el ancla sufren [@{fray}] y terminan el movimiento.
- Solo puede haber **1** ancla activa a la vez (si plantas otra, la anterior se suelta).

El “cómo se ancla” es opaco: simplemente lo hace.`,
};

const DROP_ANCHOR = `*El vacío aprende a pesar.*

1 Action · Range 6

Plantas o **reubicas** tu **Air Anchor** en un espacio a Range 6 (puede ser un espacio vacío). Ganas **1 ANCHOR**.

**Effect:** Hasta el inicio de tu siguiente turno, tú y aliados en **Range 2** del ancla pueden tratar ese espacio como suelo sólido (pueden terminar movimiento ahí aunque esté “en el aire”).

**Recall:** Si ya tenías un ancla, puedes recuperarla a Range 6 como parte de esta habilidad sin gastar acción extra.`;

const CHAIN_HAUL = `**Range 1–4** · 1|2 Actions · Melee/Thrown

Attack: [1d20]
Light: [1d[@{damage-die}]+@{fray}]
Heavy: [2d[@{damage-die}]+@{fray}]
Miss: [@{fray}]

*El eslabón tira hacia el punto muerto.*

Puedes hacer **Rush 3** antes o después (hacia tu **Air Anchor** si está plantada).

**Effect:** **Shove** al objetivo **hacia tu Air Anchor** (o en la dirección que elijas si no hay ancla) por casillas iguales a las acciones gastadas (1 o 2). Si el objetivo **Collide** con el ancla u otro obstáculo, recibe [@{fray}] adicional (**Divine** si el ancla está plantada “en el aire”).`;

const BOND_OUTSIDER = {
    name: "The Outsider",
    archetype: "The Outsider",
    description:
        "You are unique, strange, or from somewhere far away — a monastery, a hermit village, or the sea floor. You bring a perspective no one else at the table has, and the world keeps reminding you that you do not quite belong… yet.",
    specialAbility: "You gain +1d to set characters up.",
    secondWind:
        "Regain all effort when you spend a scene trying not to use your unique talents or abilities.",
    ideals: [
        "I addressed challenges with my unique perspective, talents, or culture",
        "I expressed heritage, background, or beliefs through my actions",
        "I made a new friend, or deepened an existing friendship",
    ],
    notes: "Outsider's kit · loose gear TBD · may later add gear from other party Bonds.",
};

const GAIA_COMPASS = {
    name: "GAIA COMPASS",
    frequency: "Pasiva",
    description:
        "You have a knack for navigation. You always know the distance and direction of the nearest (I) village (II) town (III) settlement of any kind. You can sense dungeons within a few miles, and get a bad feeling when one is about to surface.",
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

async function ensureTommyrabbitUser(dryRun) {
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

    const ownerUid = await ensureTommyrabbitUser(dryRun);

    const clasePayload = {
        campaignId: CAMPAIGN_ID,
        displayName: "Death Weight",
        classArchetype: "stalwart",
        description: JOB_DESCRIPTION,
        specialMechanic: SPECIAL_MECHANIC,
        classResource: { name: "ANCHORS", min: 0, max: 1 },
        combatStats: {
            vit: 10,
            defense: 14,
            speed: 6,
            fray: 4,
            damageDie: 8,
            armor: 2,
            vigor: 0,
        },
        status: "active",
        updatedAt: now,
    };

    const abilities = {
        "krell-class-root": {
            key: "krell-class-root",
            label: "Stalwart — Death Weight",
            type: "class_root",
            abilityKind: "standard",
            content: JOB_DESCRIPTION,
            cost: "",
            tagKeys: [],
            campaignId: CAMPAIGN_ID,
            updatedAt: now,
        },
        "krell-trait-dead-weight": {
            key: "krell-trait-dead-weight",
            label: "DEAD WEIGHT",
            type: "trait",
            abilityKind: "standard",
            traitCategory: "positive_effects",
            content:
                "Para ti el ancla es liviana. Enemigos que intenten **Shove**, **Rush** o moverte a ti o a tu **Air Anchor** plantada tienen **-1d**. Si un enemigo termina un movimiento en el espacio de tu ancla, **Collide** automáticamente.",
            cost: "",
            tagKeys: [],
            campaignId: CAMPAIGN_ID,
            updatedAt: now,
        },
        "krell-trait-fortify": {
            key: "krell-trait-fortify",
            label: "FORTIFY",
            type: "trait",
            abilityKind: "standard",
            traitCategory: "positive_effects",
            content:
                "Los espacios adyacentes a ti tienen **Rampart**. Ganas **Vigilance +1** al final de tu turno.",
            cost: "",
            tagKeys: ["fortify", "rampart", "vigilance"],
            campaignId: CAMPAIGN_ID,
            updatedAt: now,
        },
        "krell-trait-airlock": {
            key: "krell-trait-airlock",
            label: "AIRLOCK",
            type: "trait",
            abilityKind: "standard",
            traitCategory: "positive_effects",
            content:
                "Mientras tu **Air Anchor** esté plantada, tú (y aliados en **Range 1** del ancla) no caen ni son empujados “fuera del mapa” / al vacío: el ancla **fija** esa zona como suelo válido.",
            cost: "",
            tagKeys: [],
            campaignId: CAMPAIGN_ID,
            updatedAt: now,
        },
        "krell-trait-tether": {
            key: "krell-trait-tether",
            label: "TETHER",
            type: "trait",
            abilityKind: "standard",
            traitCategory: "positive_effects",
            content:
                "1 vez por ronda, cuando un enemigo a **Range 3** de tu **Air Anchor** se mueve o es movido, puedes **Shove 1** hacia el ancla (sin acción).",
            cost: "",
            tagKeys: ["shove"],
            campaignId: CAMPAIGN_ID,
            updatedAt: now,
        },
        "krell-ability-drop-anchor": {
            key: "krell-ability-drop-anchor",
            label: "DROP ANCHOR",
            type: "ability",
            abilityKind: "standard",
            content: DROP_ANCHOR,
            cost: "Stalwart · 1 Action · Range 6",
            tagKeys: ["rampart"],
            campaignId: CAMPAIGN_ID,
            updatedAt: now,
        },
        "krell-ability-chain-haul": {
            key: "krell-ability-chain-haul",
            label: "CHAIN HAUL",
            type: "ability",
            abilityKind: "attack",
            content: CHAIN_HAUL,
            cost: "Stalwart · 1|2 Actions · Range 1–4",
            tagKeys: ["rush", "shove", "collide"],
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
        loadout: ["krell-ability-drop-anchor", "krell-ability-chain-haul"],
        vit: 10,
        combatOverrides: {
            vit: 10,
            defense: 14,
            speed: 6,
            fray: 4,
            damageDie: 8,
            armor: 2,
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
            traverse: 2,
        },
        bond: BOND_OUTSIDER,
        bondPowers: [GAIA_COMPASS],
        iconSheet: {
            source: "seed",
            kin: "",
            culture: "",
            pronouns: "",
            narrativeLevel: 0,
            chapter: "I",
            iconClass: "stalwart",
            jobDisplayName: "Death Weight",
            narrativePoolsInitial: {
                effort: { current: 0, max: 3 },
                strain: { current: 0, max: 5 },
            },
            tactical: {
                customResource: {
                    key: "anchors",
                    label: "ANCHORS",
                    current: 0,
                    max: 1,
                },
                dust: 0,
                resolvePersonal: null,
                resolveParty: null,
                traits: [
                    { title: "DEAD WEIGHT", body: abilities["krell-trait-dead-weight"].content },
                    { title: "FORTIFY", body: abilities["krell-trait-fortify"].content },
                    { title: "AIRLOCK", body: abilities["krell-trait-airlock"].content },
                    { title: "TETHER", body: abilities["krell-trait-tether"].content },
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
    console.log(`OK: ${CHAR_NAME} ${charRef.id} → tommyrabbit ${ownerUid} (${EMAIL})`);
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
