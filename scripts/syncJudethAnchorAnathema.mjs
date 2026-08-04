/**
 * Sync Judeth Kalain → job Anchor/Anathema:
 * - Create/update clase with ZARC-GEMS + Special Mechanic
 * - Keep only Anchor, Anathema, LB (+ traits / upgrades of those)
 * - Refresh ability content to match Roll20 cards (VTT formula syntax)
 *
 * Usage:
 *   node scripts/syncJudethAnchorAnathema.mjs
 *   node scripts/syncJudethAnchorAnathema.mjs --dry-run
 */
import admin from "firebase-admin";
import fs from "fs";
import path from "path";

const DEFAULT_SA = path.resolve(process.cwd(), "valtier-map-system-firebase-admins.json");
const CHARACTER_ID = "GWTUlgDn7lpaoe4hQYHb";
const CAMPAIGN_ID = "RfY23gcG7No5HcGddo1j";
const CLASS_ID = "class_judeth_anchor_anathema";

const KEEP_KEYS = Object.freeze([
    "judeth-kalain-class-root",
    "judeth-trait-gems-channeling",
    "judeth-trait-into-the-abyss",
    "judeth-trait-alternate-ending",
    "judeth-ability-anchor",
    "judeth-anchor-up-trazo",
    "judeth-anchor-up-cerrojo",
    "judeth-anchor-ma-retorno",
    "judeth-ability-anathema",
    "judeth-anathema-up-ruidofondo",
    "judeth-anathema-up-canal",
    "judeth-anathema-ma-umbral",
    "judeth-lb-consumo-paralelo",
    "judeth-lb-up-doble-turno",
    "judeth-lb-up-precio-leve",
    "judeth-lb-ma-circuito-cerrado",
]);

const JOB_DESCRIPTION = `Esta maga no controla la magia que fluye por su cuerpo.
Para no autodestruirse, divide la canalización en gemas y los dispara mediante dos revólveres arcanotécnicos: Anchor y Anathema.

Cada orbe impone una elección:
— Reducir el flujo para ganar estabilidad
— Forzar el flujo para ganar poder`;

const SPECIAL_MECHANIC = {
    name: "ZARC-GEMS",
    text: `Cada habilidad/ataque consume 1 o más Gemas Z-Arcana (ZARC-GEMS), cargado en uno de dos modos:

ANCHOR
— La Magia se estabiliza.
— Daño sostenido, controlado, efectos conocidos.
— Riesgo bajo

ANATHEMA
— La Magia se sobrecarga.
— Daño aumentado, pero descontrolado, efectos adversos.
— Riesgo alto.

El jugador declara el modo al cargar las gemas, no al disparar.`,
};

const ANCHOR_CONTENT = `Light: [1d[@{damage-die}]+@{fray}]
Heavy: [2d[@{damage-die}]+@{fray}]
Miss: [@{fray}]

Efecto: Cada Gema consumida otorga +1 Boon al ataque (máx. 2). Con la 3ª gema el ataque obtiene Divine y realiza [@{fray}] de daño adicional.

Narrativo: Cada gema consumida aumenta la estabilidad/control del hechizo lanzado, pero disminuye su efectividad/alcance.`;

const ANATHEMA_CONTENT = `Light: [2d[@{damage-die}]]
Heavy: [3d[@{damage-die}]]
Miss: [1d[@{damage-die}]]

Efecto: Cada ⌊Gema/2⌋ consumida otorga +[@{fray}] al daño. Con 10 Gemas consumidas el daño es Divine y el ataque no puede esquivarse.

Riesgo: Cuando la habilidad se resuelve, lanza [1d6] por cada Gema consumida. Todo dado ≤4 es un efecto adverso (DM) o [1d[@{damage-die}]] de daño Divine al aliado más cercano al objetivo (incluyéndote).

Narrativo: Cada Gema consumida aumenta la efectividad/alcance, pero disminuye su estabilidad/control.`;

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

    const clasePayload = {
        campaignId: CAMPAIGN_ID,
        displayName: "Anchor/Anathema",
        classArchetype: "wright",
        description: JOB_DESCRIPTION,
        classResource: { name: "ZARC-GEMS", min: 0, max: 10 },
        specialMechanic: SPECIAL_MECHANIC,
        combatStats: {
            vit: 8,
            defense: 14,
            speed: 8,
            fray: 3,
            damageDie: 8,
            armor: 0,
            vigor: 0,
        },
        status: "active",
        sourceCharacterId: CHARACTER_ID,
        updatedAt: now,
    };

    console.log(dryRun ? "[dry-run] clase" : "Upsert clase", CLASS_ID);
    if (!dryRun) {
        const ref = db.collection("clases").doc(CLASS_ID);
        const snap = await ref.get();
        if (snap.exists) await ref.update(clasePayload);
        else await ref.set({ ...clasePayload, createdAt: now });
    }

    for (const key of KEEP_KEYS) {
        if (!dryRun) {
            await db.collection("clases").doc(CLASS_ID).collection("abilities").doc(key).set(
                { abilityKey: key, linkedAt: now },
                { merge: true },
            );
        }
    }
    console.log(`Linked ${KEEP_KEYS.length} abilities to clase`);

    const abilityPatches = {
        "judeth-ability-anchor": {
            label: "ANCHOR",
            type: "ability",
            abilityKind: "attack",
            cost: "1–3 Z-Gems · 1|2 Actions",
            content: ANCHOR_CONTENT,
            tagKeys: ["true-strike"],
            campaignId: CAMPAIGN_ID,
            updatedAt: now,
        },
        "judeth-ability-anathema": {
            label: "ANATHEMA",
            type: "ability",
            abilityKind: "attack",
            cost: "4–10 Z-Gems · 1/2 Actions",
            content: ANATHEMA_CONTENT,
            tagKeys: ["divine"],
            campaignId: CAMPAIGN_ID,
            updatedAt: now,
        },
        "judeth-kalain-class-root": {
            label: "Wright — Anchor / Anathema",
            type: "class_root",
            content: JOB_DESCRIPTION,
            updatedAt: now,
        },
    };

    for (const [id, patch] of Object.entries(abilityPatches)) {
        console.log(dryRun ? "[dry-run] ability" : "Patch ability", id);
        if (!dryRun) {
            await db.collection("abilities").doc(id).set({ key: id, ...patch }, { merge: true });
        }
    }

    const charPatch = {
        assignedClassIds: [CLASS_ID],
        activeClassId: CLASS_ID,
        allAbilities: [...KEEP_KEYS],
        unlockedAbilities: [...KEEP_KEYS],
        loadout: ["judeth-ability-anchor", "judeth-ability-anathema"],
        "iconSheet.jobDisplayName": "Anchor / Anathema",
        "iconSheet.tactical.customResource": {
            key: "zarcGems",
            label: "ZARC-GEMS",
            current: 2,
            max: 10,
        },
        updatedAt: now,
    };

    console.log(dryRun ? "[dry-run] character" : "Patch character", CHARACTER_ID);
    if (!dryRun) {
        await db.collection("characters").doc(CHARACTER_ID).update(charPatch);
    }

    console.log("Done.");
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
