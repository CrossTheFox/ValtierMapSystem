/**
 * seedEvalWiki.mjs
 *
 * Idempotent seed of generic fantasy wiki (Reino de Aldermar) for Lab IA evaluation.
 *
 * Prerequisites:
 *   - Firebase Admin JSON at project root:
 *       valtier-map-system-firebase-admins.json  (preferred)
 *       or serviceAccount.json
 *   - Or GOOGLE_APPLICATION_CREDENTIALS=/path/to/key.json
 *
 * Usage:
 *   npm run seed-eval-wiki:dry -- --campaignId=YOUR_CAMPAIGN_ID
 *   npm run seed-eval-wiki -- --campaignId=YOUR_CAMPAIGN_ID
 *   npm run seed-eval-wiki -- --campaignId=ID --strict-relations
 *   npm run seed-eval-wiki -- --campaignId=ID --no-purge
 */

import { join, dirname } from "path";
import { fileURLToPath } from "url";
import * as manifest from "./data/evalWikiSeed.mjs";
import { parseSeedArgs, runWikiSeed } from "./lib/wikiSeedRunner.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

const args = parseSeedArgs();

runWikiSeed({
    manifest,
    seedActor: "seed-eval-wiki",
    args,
    serviceAccountCandidates: [
        join(root, "valtier-map-system-firebase-admins.json"),
    ],
}).catch((err) => {
    console.error("[seed-eval] Fatal:", err);
    process.exit(1);
});
