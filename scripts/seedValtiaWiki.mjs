/**
 * seedValtiaWiki.mjs
 *
 * Idempotent seed of Valtia-01 narrative wiki entities + relations into Firestore.
 *
 * Prerequisites:
 *   - Firebase Admin service account JSON at project root:
 *       valtier-map-system-firebase-admins.json  (preferred)
 *       or serviceAccount.json
 *   - Or set GOOGLE_APPLICATION_CREDENTIALS=/path/to/key.json
 *
 * Usage:
 *   npm run seed-valtia-wiki:dry          # preview, no writes
 *   npm run seed-valtia-wiki              # upload to Firestore
 *   npm run seed-valtia-wiki -- --campaignId=OTHER_ID
 *   npm run seed-valtia-wiki -- --only=locacion,personaje
 *   npm run seed-valtia-wiki -- --skip-relations
 *   npm run seed-valtia-wiki -- --strict-relations   # abort on invalid relation in manifest
 *   npm run seed-valtia-wiki -- --no-purge           # skip deleting stale docs (legacy mode)
 */

import { join, dirname } from "path";
import { fileURLToPath } from "url";
import * as manifest from "./data/valtiaWikiSeed.mjs";
import { parseSeedArgs, runWikiSeed } from "./lib/wikiSeedRunner.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

const args = parseSeedArgs();

runWikiSeed({
    manifest,
    seedActor: "seed-valtia-wiki",
    args,
    serviceAccountCandidates: [
        join(root, "valtier-map-system-firebase-admins.json"),
    ],
}).catch((err) => {
    console.error("[seed-valtia] Fatal:", err);
    process.exit(1);
});
