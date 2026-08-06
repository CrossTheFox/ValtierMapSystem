/**
 * Create player Alfa + character Nyssara (Soul Stealer / Vagabond).
 *
 * - Auth user: Alfa / valtia01 → alfa@valtia.com
 * - Job + Special Mechanic IMPRINT (class resource IMPRINTS)
 * - Traits: IMPRINT, KNOW THE ENEMY, PREDATOR
 * - Abilities: COPYCAT, PREDATORY ATTACK
 * - Bond power: IT'S NOTHING
 *
 * Usage:
 *   node scripts/seedNyssaraSoulStealer.mjs
 *   node scripts/seedNyssaraSoulStealer.mjs --dry-run
 */
import admin from "firebase-admin";
import fs from "fs";
import path from "path";

const DEFAULT_SA = path.resolve(process.cwd(), "valtier-map-system-firebase-admins.json");

const NICKNAME = "Alfa";
const EMAIL = "alfa@valtia.com";
/** Same password as alexdinosaurio (shared table password). */
const PASSWORD = "valtia01";

const CAMPAIGN_ID = "RfY23gcG7No5HcGddo1j";
/** Same map location as other Valtia PCs (Judeth / Zymthe). */
const LOCATION_ID = "Fix7rFHl62MV4HSpzc3F";
const CLASS_ID = "class_nyssara_soul_stealer";

const ABILITY_KEYS = Object.freeze([
    "nyssara-class-root",
    "nyssara-trait-imprint",
    "nyssara-trait-know-the-enemy",
    "nyssara-trait-predator",
    "nyssara-ability-copycat",
    "nyssara-ability-predatory-attack",
]);

const JOB_DESCRIPTION = `No usas ilusiones. No proyectas sombras falsas. Aprendes mirando, robas entendiendo y sobrevives convirtiéndote en otro. Tu cuerpo y tu alma son maleables. Puedes copiar posturas, estilos de combate, técnicas mágicas rudimentarias y patrones de movimiento porque los comprendes, no porque los falsifiques. Cuanto más profundo es lo que robas, menos tú sigues siendo.`;

const SPECIAL_MECHANIC = {
    name: "IMPRINT",
    text: `Puedes copiar, quitar o intercambiar rasgos reales de criaturas cercanas. Un Imprint puede ser una Habilidad, un Stat, Trait, Arma/Ataque, Estilo de Combate, Mecánica, Apariencia, etc.

Mueves las fichas del alma tanto tuyas como de otros a tu alrededor. Puedes mover hasta **2 Imprints** a la vez; si tomas/cambias/copias otra más, la más antigua se reemplaza.`,
};

const COPYCAT_CONTENT = `*Tu alma y la mía son meras interpretaciones de la existencia y yo puedo moverlas a mi gusto.*

Clonas la habilidad / stat / ataque / trait de un enemigo y lo vuelves tuyo ganando el **Imprint** correspondiente.

Si clonas una habilidad, obtienes **Evasion** por el resto de la ronda.

**Effect:** El daño de la habilidad pasa a ser tu daño si el tuyo es mayor; el ataque además obtiene todos los beneficios que tú tengas.`;

const PREDATORY_ATTACK_CONTENT = `**Range 1** · 1|2 Actions

Light: [1d[@{damage-die}]+@{fray}]
Heavy: [2d[@{damage-die}]+@{fray}]
Miss: [@{fray}]

El objetivo debe lanzar un **Save** o puedes hacer **Shove 4** por acción gastada en la dirección que elijas, moviéndote con él a una posición desocupada.

**Effect:** Por cada **Imprint** que tengas, el objetivo recibe [@{fray}] de daño adicional. Es **Divine** si el objetivo no tiene aliados en **Range 3**.`;

const ITS_NOTHING = {
    name: "IT'S NOTHING",
    frequency: "Pasiva",
    description:
        "During Heal Burdens, heal 2 extra ticks on a burden of your choice if nobody helps you heal burdens. Heal 1 tick on two burdens if someone does help you heal, instead of just one burden. If you do so, you can't help other people heal burdens.",
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

async function ensureAlfaUser(dryRun) {
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
        .where("name", "==", "Nyssara")
        .where("campaignId", "==", CAMPAIGN_ID)
        .get();
    if (!existingChar.empty) {
        console.error(
            `Nyssara already exists: ${existingChar.docs.map((d) => d.id).join(", ")}. Abort.`,
        );
        process.exit(1);
    }

    const ownerUid = await ensureAlfaUser(dryRun);

    const clasePayload = {
        campaignId: CAMPAIGN_ID,
        displayName: "Soul Stealer",
        classArchetype: "vagabond",
        description: JOB_DESCRIPTION,
        specialMechanic: SPECIAL_MECHANIC,
        classResource: { name: "IMPRINTS", min: 0, max: 2 },
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
        "nyssara-class-root": {
            key: "nyssara-class-root",
            label: "Vagabond — Soul Stealer",
            type: "class_root",
            abilityKind: "standard",
            content: JOB_DESCRIPTION,
            cost: "",
            tagKeys: [],
            campaignId: CAMPAIGN_ID,
            updatedAt: now,
        },
        "nyssara-trait-imprint": {
            key: "nyssara-trait-imprint",
            label: "IMPRINT",
            type: "trait",
            abilityKind: "standard",
            traitCategory: "positive_effects",
            content:
                "Al inicio de cada ronda puedes ganar un Imprint de una habilidad/ataque/trait/apariencia/etc. que hayas presenciado en algún momento del combate o de la que tengas memoria. Ganas 1 Imprint y puedes usar la copia como habilidad propia por el resto de la escena/combate.",
            cost: "",
            tagKeys: [],
            campaignId: CAMPAIGN_ID,
            updatedAt: now,
        },
        "nyssara-trait-know-the-enemy": {
            key: "nyssara-trait-know-the-enemy",
            label: "KNOW THE ENEMY",
            type: "trait",
            abilityKind: "standard",
            traitCategory: "positive_effects",
            content:
                "Si haces Imprint de un personaje, tienes +1 Boon contra el objetivo que copiaste. Si tienes 2 o más Imprints del mismo objetivo, obtienes +1D.",
            cost: "",
            tagKeys: [],
            campaignId: CAMPAIGN_ID,
            updatedAt: now,
        },
        "nyssara-trait-predator": {
            key: "nyssara-trait-predator",
            label: "PREDATOR",
            type: "trait",
            abilityKind: "standard",
            traitCategory: "positive_effects",
            content: "Tienes **Dodge+** y puedes hacer **Dash** antes/después de una habilidad.",
            cost: "",
            tagKeys: ["dodge"],
            campaignId: CAMPAIGN_ID,
            updatedAt: now,
        },
        "nyssara-ability-copycat": {
            key: "nyssara-ability-copycat",
            label: "COPYCAT",
            type: "ability",
            abilityKind: "standard",
            content: COPYCAT_CONTENT,
            cost: "Vagabond · X Actions",
            tagKeys: [],
            campaignId: CAMPAIGN_ID,
            updatedAt: now,
        },
        "nyssara-ability-predatory-attack": {
            key: "nyssara-ability-predatory-attack",
            label: "PREDATORY ATTACK",
            type: "ability",
            abilityKind: "attack",
            content: PREDATORY_ATTACK_CONTENT,
            cost: "Vagabond · 1|2 Actions · Range 1",
            tagKeys: ["shove"],
            campaignId: CAMPAIGN_ID,
            updatedAt: now,
        },
    };

    const charRef = db.collection("characters").doc();
    const charPayload = {
        name: "Nyssara",
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
        loadout: ["nyssara-ability-copycat", "nyssara-ability-predatory-attack"],
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
            charm: 2,
            command: 0,
            endure: 0,
            excel: 2,
            sense: 0,
            smash: 0,
            sneak: 2,
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
        bondPowers: [ITS_NOTHING],
        iconSheet: {
            source: "seed",
            kin: "",
            culture: "",
            pronouns: "",
            narrativeLevel: 0,
            chapter: "I",
            iconClass: "vagabond",
            jobDisplayName: "Soul Stealer",
            narrativePoolsInitial: {
                effort: { current: 0, max: 3 },
                strain: { current: 0, max: 5 },
            },
            tactical: {
                customResource: {
                    key: "imprints",
                    label: "IMPRINTS",
                    current: 0,
                    max: 2,
                },
                dust: 0,
                resolvePersonal: null,
                resolveParty: null,
                traits: [
                    { title: "IMPRINT", body: abilities["nyssara-trait-imprint"].content },
                    {
                        title: "KNOW THE ENEMY",
                        body: abilities["nyssara-trait-know-the-enemy"].content,
                    },
                    { title: "PREDATOR", body: abilities["nyssara-trait-predator"].content },
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
    console.log(`OK: Nyssara ${charRef.id} → Alfa ${ownerUid} (${EMAIL})`);
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
