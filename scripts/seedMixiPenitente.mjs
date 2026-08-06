/**
 * Create player Mixi + character Luminous Mixi (Penitente / Stalwart).
 *
 * - Auth user: Mixi / valtia01 → mixi@valtia.com
 * - Job + Special Mechanic CONDENAS
 * - Traits: DAMNED, FORTIFY, FULL AWARENESS, MASOCHIST
 * - Abilities: SELF-IMPOSED LIMITATION, VIOLENT COMPLIANCE
 * - Bond: The Wolf · Power: BLOOD SCENT
 *
 * Usage:
 *   node scripts/seedMixiPenitente.mjs
 *   node scripts/seedMixiPenitente.mjs --dry-run
 */
import admin from "firebase-admin";
import fs from "fs";
import path from "path";

const DEFAULT_SA = path.resolve(process.cwd(), "valtier-map-system-firebase-admins.json");

const NICKNAME = "Mixi";
const EMAIL = "mixi@valtia.com";
/** Same password as alexdinosaurio (shared table password). */
const PASSWORD = "valtia01";

const CAMPAIGN_ID = "RfY23gcG7No5HcGddo1j";
/** Same map location as other Valtia PCs. */
const LOCATION_ID = "Fix7rFHl62MV4HSpzc3F";
const CLASS_ID = "class_mixi_penitente";
const CHAR_NAME = "Luminous Mixi";

const ABILITY_KEYS = Object.freeze([
    "mixi-class-root",
    "mixi-trait-damned",
    "mixi-trait-fortify",
    "mixi-trait-full-awareness",
    "mixi-trait-masochist",
    "mixi-ability-self-imposed-limitation",
    "mixi-ability-violent-compliance",
]);

const JOB_DESCRIPTION = `Mixi vive una eterna condena por motivos que desconoce; la "Condena" le obliga a imponerse limitaciones para hacer cosas del día a día o luchar. A consecuencia de total inhabilidad con la magia o todo lo que tenga que ver con esta, posee capacidades físicas avanzadas y estas limitaciones físicas pueden inclusive trascender su propio ser.`;

const SPECIAL_MECHANIC = {
    name: "CONDENAS",
    text: `Las **Condenas** son sufrimientos autoimpuestos a cambio de poder.

Al inicio del combate elige **1 Condena**. Pueden ser:

- **Básicas:** beneficio moderado a cambio de una limitación clara (ej. +2 DEF pero mitad de velocidad).
- **Absolutas:** poder enorme a cambio de desventajas que amenazan la supervivencia (ej. DEF fija en 18 pero el daño recibido se multiplica ×4).

Las Condenas Absolutas solo se pueden activar acumulando Básicas durante el combate. Ignorarlas, minimizarlas o abusar de ellas tiene consecuencias.`,
};

const SELF_IMPOSED = `*Te encadenas a tu propia condena y obligas al mundo a respetarla.*

**Condena** · 1 Action · **Stance**

Elige 1 **Condena** activa que sufras.

**Stance:** Potencia esa **Condena** hasta el inicio de tu siguiente turno, aumentando los beneficios de la **Condena** a costa de intensificar sus efectos negativos (esta habilidad puede llevar la condena a su límite si así se decide).

**Stance:** Aumentas en **+2 Armor** rompiendo el límite de **Damned**.`;

const VIOLENT_COMPLIANCE = `**Condena** · 1 Action · Melee

Attack: [1d20]
Light: [1d[@{damage-die}]+@{fray}]
Miss: [@{fray}]

*Violent Compliance*

Puedes hacer **Rush 4** antes/después de la resolución de la habilidad.

**Effect:** El daño aumenta en [@{fray}] por cada **Condena** activa. Cada **Condena Absoluta** activa aumenta en [@{fray}*4] **Divine**.`;

const BOND_WOLF = {
    name: "The Wolf",
    archetype: "The Wolf",
    description:
        "You are a tough exterior covered in scars. Your competency makes you strong, but you also can't let anyone see where you're vulnerable. The wolf stands strong alone, but can't forget that they ultimately rely on the pack.",
    specialAbility: "You are hardened. Your 4 clock burden gives you no penalties.",
    secondWind: "Regain all effort when you fix someone else's mistakes, or someone else fixes yours.",
    ideals: [
        "I addressed challenges with precision, coldness, or intimidation",
        "I expressed my heritage, background, or beliefs through my actions",
        "I let people see a glimpse of who I am beneath my mask",
    ],
    notes: "",
};

const BLOOD_SCENT = {
    name: "BLOOD SCENT",
    frequency: "Pasiva",
    description:
        "You get a knack for tracking or intimidating anyone or anything that's wounded.",
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

async function ensureMixiUser(dryRun) {
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

    const ownerUid = await ensureMixiUser(dryRun);

    const clasePayload = {
        campaignId: CAMPAIGN_ID,
        displayName: "Penitente",
        classArchetype: "stalwart",
        description: JOB_DESCRIPTION,
        specialMechanic: SPECIAL_MECHANIC,
        classResource: { name: "CONDENAS", min: 0, max: 3 },
        combatStats: {
            vit: 10,
            defense: 12,
            speed: 8,
            fray: 4,
            damageDie: 6,
            armor: 2,
            vigor: 0,
        },
        status: "active",
        updatedAt: now,
    };

    const abilities = {
        "mixi-class-root": {
            key: "mixi-class-root",
            label: "Stalwart — Penitente",
            type: "class_root",
            abilityKind: "standard",
            content: JOB_DESCRIPTION,
            cost: "",
            tagKeys: [],
            campaignId: CAMPAIGN_ID,
            updatedAt: now,
        },
        "mixi-trait-damned": {
            key: "mixi-trait-damned",
            label: "DAMNED",
            type: "trait",
            abilityKind: "standard",
            traitCategory: "positive_effects",
            content:
                "Por combate, cada enemigo que te haga daño aumenta en **+1** tu **Armor**, con límite de **+4**. Se refresca al inicio de tu siguiente turno.",
            cost: "",
            tagKeys: [],
            campaignId: CAMPAIGN_ID,
            updatedAt: now,
        },
        "mixi-trait-fortify": {
            key: "mixi-trait-fortify",
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
        "mixi-trait-full-awareness": {
            key: "mixi-trait-full-awareness",
            label: "FULL AWARENESS",
            type: "trait",
            abilityKind: "standard",
            traitCategory: "positive_effects",
            content: "El personaje puede tener **ilimitados Stances** a la vez.",
            cost: "",
            tagKeys: ["stance"],
            campaignId: CAMPAIGN_ID,
            updatedAt: now,
        },
        "mixi-trait-masochist": {
            key: "mixi-trait-masochist",
            label: "MASOCHIST",
            type: "trait",
            abilityKind: "standard",
            traitCategory: "positive_effects",
            content:
                "1 vez por turno puedes auto-infligirte **cualquier status**. Mientras sufras de un status ganas **Vigilance +1** al final del turno. Con **2 o más** statuses realizas **Bonus Damage** con tus habilidades.",
            cost: "",
            tagKeys: ["vigilance"],
            campaignId: CAMPAIGN_ID,
            updatedAt: now,
        },
        "mixi-ability-self-imposed-limitation": {
            key: "mixi-ability-self-imposed-limitation",
            label: "SELF-IMPOSED LIMITATION",
            type: "ability",
            abilityKind: "standard",
            content: SELF_IMPOSED,
            cost: "Stalwart · Condena · 1 Action · Stance",
            tagKeys: ["stance"],
            campaignId: CAMPAIGN_ID,
            updatedAt: now,
        },
        "mixi-ability-violent-compliance": {
            key: "mixi-ability-violent-compliance",
            label: "VIOLENT COMPLIANCE",
            type: "ability",
            abilityKind: "attack",
            content: VIOLENT_COMPLIANCE,
            cost: "Stalwart · Condena · 1 Action · Melee",
            tagKeys: ["rush"],
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
            "mixi-ability-self-imposed-limitation",
            "mixi-ability-violent-compliance",
        ],
        vit: 10,
        combatOverrides: {
            vit: 10,
            defense: 12,
            speed: 8,
            fray: 4,
            damageDie: 6,
            armor: 2,
            vigor: 0,
        },
        stats: {
            charm: 0,
            command: 1,
            endure: 1,
            excel: 2,
            sense: 0,
            smash: 2,
            sneak: 0,
            study: 0,
            tinker: 0,
            traverse: 0,
        },
        bond: BOND_WOLF,
        bondPowers: [BLOOD_SCENT],
        iconSheet: {
            source: "seed",
            kin: "Garou",
            culture: "",
            pronouns: "",
            narrativeLevel: 0,
            chapter: "I",
            iconClass: "stalwart",
            jobDisplayName: "Penitente",
            narrativePoolsInitial: {
                effort: { current: 0, max: 3 },
                strain: { current: 0, max: 5 },
            },
            tactical: {
                customResource: {
                    key: "condenas",
                    label: "CONDENAS",
                    current: 0,
                    max: 3,
                },
                dust: 0,
                resolvePersonal: null,
                resolveParty: null,
                traits: [
                    { title: "DAMNED", body: abilities["mixi-trait-damned"].content },
                    { title: "FORTIFY", body: abilities["mixi-trait-fortify"].content },
                    { title: "FULL AWARENESS", body: abilities["mixi-trait-full-awareness"].content },
                    { title: "MASOCHIST", body: abilities["mixi-trait-masochist"].content },
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
    console.log(`OK: ${CHAR_NAME} ${charRef.id} → Mixi ${ownerUid} (${EMAIL})`);
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
