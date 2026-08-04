/**
 * Crea la colección `clases` con subcolección `abilities` (refs por doc id = abilityKey),
 * añade clases stub de prueba + habilidades mínimas en `abilities`,
 * y asigna `assignedClassIds` al personaje de prueba.
 *
 * Uso: node scripts/seedClasesMultiJobTest.mjs
 */
import admin from "firebase-admin";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");

const CHARACTER_ID = "QolP584GexvFMOpun8t6";

const PRIMARY_CLASS_ID = "class_oni_wright_primary";
const STUB_VAGABOND_ID = "class_test_vagabond";
const STUB_MENDICANT_ID = "class_test_mendicant";

const serviceAccountPath = path.join(ROOT, "valtier-map-system-firebase-admins.json");

if (!fs.existsSync(serviceAccountPath)) {
    console.error("Missing service account:", serviceAccountPath);
    process.exit(1);
}

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(JSON.parse(fs.readFileSync(serviceAccountPath, "utf8"))),
    });
}

const db = admin.firestore();

async function fetchAbilitiesByKeys(keys) {
    const out = [];
    for (let i = 0; i < keys.length; i += 10) {
        const chunk = keys.slice(i, i + 10);
        const snap = await db.collection("abilities").where(admin.firestore.FieldPath.documentId(), "in", chunk).get();
        snap.docs.forEach((d) => out.push({ id: d.id, ...d.data() }));
    }
    return out;
}

function batchSetAbilityEntry(batch, classId, abilityKey, extra = {}) {
    const ref = db.collection("clases").doc(classId).collection("abilities").doc(abilityKey);
    batch.set(ref, { abilityKey, ...extra });
}

async function main() {
    const charRef = db.collection("characters").doc(CHARACTER_ID);
    const charSnap = await charRef.get();
    if (!charSnap.exists) {
        console.error("Character not found:", CHARACTER_ID);
        process.exit(1);
    }
    const ch = charSnap.data();
    const allKeys = Array.isArray(ch.allAbilities) && ch.allAbilities.length ? ch.allAbilities : ch.unlockedAbilities || [];
    if (!allKeys.length) {
        console.error("Character has no allAbilities/unlockedAbilities; cannot infer primary class.");
        process.exit(1);
    }

    const abs = await fetchAbilitiesByKeys(allKeys);
    const classRoot = abs.find((a) => a.type === "class_root");
    const primaryLabel = classRoot?.label || "PRIMARY JOB";
    const primaryArchetype = classRoot?.classArchetype || classRoot?.archetype || "wright";

    const MAX_BATCH = 450;
    let batch = db.batch();
    let ops = 0;

    const commitIfNeeded = async (force = false) => {
        if (!force && ops < MAX_BATCH) return;
        if (ops === 0) return;
        await batch.commit();
        batch = db.batch();
        ops = 0;
    };

    const enqueue = (fn) => {
        fn(batch);
        ops += 1;
    };

    // --- Primary class doc ---
    const primaryRef = db.collection("clases").doc(PRIMARY_CLASS_ID);
    enqueue((b) =>
        b.set(primaryRef, {
            displayName: primaryLabel,
            classArchetype: typeof primaryArchetype === "string" ? primaryArchetype.toLowerCase() : "wright",
            rootAbilityKey: classRoot?.key || classRoot?.id || null,
            campaignId: ch.campaignId || null,
            isTestData: false,
            sourceCharacterId: CHARACTER_ID,
            combatStats: {
                vit: 4,
                defense: 8,
                speed: 4,
                fray: 1,
                damageDie: 6,
                armor: 0,
                vigor: 0,
            },
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        })
    );

    for (const k of allKeys) {
        await commitIfNeeded();
        enqueue((b) => batchSetAbilityEntry(b, PRIMARY_CLASS_ID, k, { slot: "full_tree" }));
    }

    // --- Stub abilities (global) for fake jobs ---
    const stubAbs = [
        {
            key: "_stub_vaga_root",
            doc: {
                key: "_stub_vaga_root",
                type: "class_root",
                label: "FOOL",
                content: "Clase de prueba (multiclass UI).",
                classArchetype: "vagabond",
            },
        },
        {
            key: "_stub_vaga_trait",
            doc: {
                key: "_stub_vaga_trait",
                type: "trait",
                label: "Test Trait",
                content: "Módulo pasivo de prueba.",
                parentId: "_stub_vaga_root",
            },
        },
        {
            key: "_stub_vaga_strike",
            doc: {
                key: "_stub_vaga_strike",
                type: "ability",
                label: "Test Strike",
                content:
                    "Ataque de prueba. Daño: [1d[@{damage-die}]+@{fray}].",
                parentId: "_stub_vaga_root",
                classArchetype: "vagabond",
            },
        },
        {
            key: "_stub_mend_root",
            doc: {
                key: "_stub_mend_root",
                type: "class_root",
                label: "CHANTER",
                content: "Clase de prueba (multiclass UI).",
                classArchetype: "mendicant",
            },
        },
        {
            key: "_stub_mend_trait",
            doc: {
                key: "_stub_mend_trait",
                type: "trait",
                label: "Test Aura",
                content: "Aura de prueba.",
                parentId: "_stub_mend_root",
            },
        },
    ];

    for (const { key, doc } of stubAbs) {
        await commitIfNeeded();
        enqueue((b) =>
            b.set(db.collection("abilities").doc(key), {
                ...doc,
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            })
        );
    }

    // --- Stub class: Vagabond ---
    await commitIfNeeded();
    enqueue((b) =>
        b.set(db.collection("clases").doc(STUB_VAGABOND_ID), {
            displayName: "FOOL (stub)",
            classArchetype: "vagabond",
            campaignId: ch.campaignId || null,
            isTestData: true,
            combatStats: {
                vit: 4,
                defense: 12,
                speed: 5,
                fray: 1,
                damageDie: 8,
                armor: 0,
                vigor: 0,
            },
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        })
    );
    enqueue((b) => batchSetAbilityEntry(b, STUB_VAGABOND_ID, "_stub_vaga_root"));
    enqueue((b) => batchSetAbilityEntry(b, STUB_VAGABOND_ID, "_stub_vaga_trait"));
    enqueue((b) => batchSetAbilityEntry(b, STUB_VAGABOND_ID, "_stub_vaga_strike"));

    // --- Stub class: Mendicant ---
    await commitIfNeeded();
    enqueue((b) =>
        b.set(db.collection("clases").doc(STUB_MENDICANT_ID), {
            displayName: "CHANTER (stub)",
            classArchetype: "mendicant",
            campaignId: ch.campaignId || null,
            isTestData: true,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        })
    );
    enqueue((b) => batchSetAbilityEntry(b, STUB_MENDICANT_ID, "_stub_mend_root"));
    enqueue((b) => batchSetAbilityEntry(b, STUB_MENDICANT_ID, "_stub_mend_trait"));

    // --- Character: ordered jobs (primary first) ---
    await commitIfNeeded();
    enqueue((b) =>
        b.update(charRef, {
            assignedClassIds: [PRIMARY_CLASS_ID, STUB_VAGABOND_ID, STUB_MENDICANT_ID],
            activeClassId: PRIMARY_CLASS_ID,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        })
    );

    await commitIfNeeded(true);
    console.log("OK: clases + subcolección abilities + stubs + character.assignedClassIds");
    console.log("  primary:", PRIMARY_CLASS_ID, `(${primaryLabel})`);
    console.log("  +", STUB_VAGABOND_ID, STUB_MENDICANT_ID);
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
