/**
 * setupEvalCampaign.mjs
 *
 * Crea (o reutiliza) la campaña piloto de evaluación Lab IA y siembra el wiki Aldermar.
 *
 * Uso:
 *   npm run setup:eval-campaign
 *   npm run setup:eval-campaign -- --dry-run
 *   npm run setup:eval-campaign -- --ownerId=OTHER_UID
 *   npm run setup:eval-campaign -- --name=PILOTO-EVAL-IA --skip-seed
 *
 * Requisitos: valtier-map-system-firebase-admins.json en la raíz.
 */

import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore, FieldValue, Timestamp } from "firebase-admin/firestore";
import { readFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import * as evalManifest from "./data/evalWikiSeed.mjs";
import { parseSeedArgs, runWikiSeed } from "./lib/wikiSeedRunner.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

const DEFAULT_OWNER_ID = "ZmK4TxrcQFfGkMVmuJoJ8IHG7Bb2";
const DEFAULT_NAME = "PILOTO-EVAL-IA";

const args = parseSeedArgs();
const OWNER_ID = String(args.ownerId || DEFAULT_OWNER_ID);
const CAMPAIGN_NAME = String(args.name || DEFAULT_NAME);
const DRY_RUN = Boolean(args["dry-run"]);
const SKIP_SEED = Boolean(args["skip-seed"]);
const FORCE_NEW = Boolean(args["force-new"]);

function initAdmin() {
    const saPath =
        process.env.GOOGLE_APPLICATION_CREDENTIALS ||
        join(root, "valtier-map-system-firebase-admins.json");
    if (!existsSync(saPath)) {
        console.error(`ERROR: Service account no encontrado: ${saPath}`);
        process.exit(1);
    }
    if (!getApps().length) {
        initializeApp({ credential: cert(JSON.parse(readFileSync(saPath, "utf8"))) });
    }
    return getFirestore();
}

async function findExistingCampaign(db) {
    const snap = await db
        .collection("campaigns")
        .where("name", "==", CAMPAIGN_NAME)
        .limit(5)
        .get();

    if (snap.empty) return null;

    const owned = snap.docs.find((d) => d.data().ownerId === OWNER_ID);
    return owned || snap.docs[0];
}

async function ensureCampaign(db) {
    if (!FORCE_NEW) {
        const existing = await findExistingCampaign(db);
        if (existing) {
            console.log(`[campaign] Reutilizando existente: ${existing.id} (${CAMPAIGN_NAME})`);
            if (!DRY_RUN) {
                await existing.ref.set(
                    {
                        ownerId: OWNER_ID,
                        playerIds: FieldValue.arrayUnion(OWNER_ID),
                        description:
                            existing.data().description ||
                            "Evaluación Lab IA · Reino de Aldermar (no mesa)",
                        updatedAt: Timestamp.now(),
                    },
                    { merge: true }
                );
            }
            return existing.id;
        }
    }

    const payload = {
        name: CAMPAIGN_NAME,
        description: "Evaluación Lab IA · Reino de Aldermar (no mesa)",
        ownerId: OWNER_ID,
        mapIds: [],
        playerIds: [OWNER_ID],
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
    };

    if (DRY_RUN) {
        console.log("[campaign] DRY CREATE", payload);
        return "dry-campaign-id";
    }

    const ref = await db.collection("campaigns").add(payload);
    console.log(`[campaign] Creada: ${ref.id}`);
    return ref.id;
}

async function ensurePlayerAccess(db, campaignId) {
    const playerRef = db.collection("players").doc(OWNER_ID);
    const snap = await playerRef.get();

    if (!snap.exists) {
        console.error(
            `[player] ERROR: no existe players/${OWNER_ID}. Crea el DM antes (scripts/createDM.js).`
        );
        process.exit(1);
    }

    const data = snap.data() || {};
    if (data.role !== "dm") {
        console.warn(`[player] role actual="${data.role}" — forzando role=dm`);
    }

    console.log(
        `[player] ${data.nickname || OWNER_ID} → campaignIds += ${campaignId}`
    );

    if (DRY_RUN) return;

    await playerRef.set(
        {
            uid: OWNER_ID,
            role: "dm",
            campaignIds: FieldValue.arrayUnion(campaignId),
            updatedAt: Timestamp.now(),
        },
        { merge: true }
    );
}

async function main() {
    console.log("\n══ setup:eval-campaign ══");
    console.log(`ownerId : ${OWNER_ID}`);
    console.log(`name    : ${CAMPAIGN_NAME}`);
    console.log(`dry-run : ${DRY_RUN}`);
    console.log(`seed    : ${SKIP_SEED ? "skip" : "aldermar"}\n`);

    const db = initAdmin();
    const campaignId = await ensureCampaign(db);
    await ensurePlayerAccess(db, campaignId);

    if (SKIP_SEED) {
        console.log("\n[seed] Omitido (--skip-seed).");
    } else if (DRY_RUN) {
        console.log("\n[seed] DRY — no se escribe wiki. Ejecuta sin --dry-run para sembrar.");
    } else {
        console.log("\n[seed] Sembrando wiki Aldermar…");
        await runWikiSeed({
            manifest: evalManifest,
            seedActor: "seed-eval-wiki",
            args: {
                campaignId,
                ...(args["strict-relations"] ? { "strict-relations": true } : {}),
                ...(args["no-purge"] ? { "no-purge": true } : {}),
            },
            serviceAccountCandidates: [
                join(root, "valtier-map-system-firebase-admins.json"),
            ],
        });
    }

    console.log("\n══ listo ══");
    console.log(`campaignId = ${campaignId}`);
    console.log(`Login como DM → selecciona "${CAMPAIGN_NAME}" → Archive → Elara.`);
    console.log(
        `Reset entre testers:\n  npm run seed-eval-wiki -- --campaignId=${campaignId}\n`
    );
}

main().catch((err) => {
    console.error("[setup:eval-campaign] Fatal:", err);
    process.exit(1);
});
