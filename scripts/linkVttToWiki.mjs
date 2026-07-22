/**
 * linkVttToWiki.mjs
 *
 * Fuzzy-match VTT tokens/locations to wiki entities and create 1:1 annex links.
 *
 * Usage:
 *   npm run link:vtt-wiki:dry
 *   npm run link:vtt-wiki
 *   node scripts/linkVttToWiki.mjs --campaignId=OTHER_ID --dry
 */

import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { readFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { SEED_CAMPAIGN_ID } from "./data/valtiaWikiSeed.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));

const args = Object.fromEntries(
    process.argv.slice(2).map((a) => {
        const [k, v] = a.replace(/^--/, "").split("=");
        return [k, v ?? true];
    })
);

const CAMPAIGN_ID = args.campaignId || SEED_CAMPAIGN_ID;
const DRY_RUN = Boolean(args.dry || args["dry-run"]);
const APPLY = Boolean(args.apply) || (!DRY_RUN && !args.dry);
const MIN_SCORE = Number(args.minScore || 0.72);

function initAdmin() {
    const candidates = [
        join(__dirname, "..", "valtier-map-system-firebase-admins.json"),
        join(__dirname, "..", "serviceAccount.json"),
    ];
    const keyPath = candidates.find((p) => existsSync(p));
    if (keyPath) {
        const serviceAccount = JSON.parse(readFileSync(keyPath, "utf8"));
        initializeApp({ credential: cert(serviceAccount) });
    } else {
        initializeApp();
    }
    return getFirestore();
}

function normalizeName(value = "") {
    return value
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/^(el|la|los|las)\s+/i, "")
        .replace(/[^a-z0-9\s-]/g, "")
        .trim()
        .replace(/\s+/g, " ");
}

function slugify(text = "") {
    return normalizeName(text).replace(/\s+/g, "-");
}

function levenshtein(a, b) {
    const m = a.length;
    const n = b.length;
    const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;
    for (let i = 1; i <= m; i++) {
        for (let j = 1; j <= n; j++) {
            const cost = a[i - 1] === b[j - 1] ? 0 : 1;
            dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
        }
    }
    return dp[m][n];
}

function similarity(a, b) {
    if (!a || !b) return 0;
    if (a === b) return 1;
    const dist = levenshtein(a, b);
    const maxLen = Math.max(a.length, b.length);
    return maxLen === 0 ? 0 : 1 - dist / maxLen;
}

function scoreMatch(vttName, wikiEntity) {
    const vttNorm = normalizeName(vttName);
    const titleNorm = normalizeName(wikiEntity.title || "");
    const slugNorm = normalizeName((wikiEntity.slug || "").replace(/-/g, " "));

    if (!vttNorm || !titleNorm) return 0;

    if (vttNorm === titleNorm) return 1;
    if (vttNorm.includes(slugNorm) && slugNorm.length >= 3) return 0.95;
    if (titleNorm.includes(vttNorm) || vttNorm.includes(titleNorm)) return 0.9;

    const titleSim = similarity(vttNorm, titleNorm);
    const slugSim = slugNorm ? similarity(vttNorm, slugNorm) : 0;
    const firstToken = vttNorm.split(" ")[0];
    const firstTokenSim = firstToken.length >= 4 ? similarity(firstToken, slugNorm.replace(/\s+/g, "")) : 0;

    return Math.max(titleSim, slugSim, firstTokenSim);
}

async function loadVttCharacters(db, campaignId) {
    const snap = await db.collection("characters").where("campaignId", "==", campaignId).get();
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

async function loadVttLocations(db, campaignId) {
    const mapsSnap = await db.collection("maps").where("campaignId", "==", campaignId).get();
    const mapIds = mapsSnap.docs.map((d) => d.id);
    if (!mapIds.length) return [];

    const locSnap = await db.collection("locations").where("mapId", "in", mapIds.slice(0, 10)).get();
    return locSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

async function loadWikiEntities(db, campaignId) {
    const snap = await db
        .collection("campaigns")
        .doc(campaignId)
        .collection("wikiEntities")
        .get();
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

async function clearStaleWikiLinks(db, campaignId, field, vttId, keepWikiId, uid) {
    const snap = await db
        .collection("campaigns")
        .doc(campaignId)
        .collection("wikiEntities")
        .where(field, "==", vttId)
        .get();

    for (const doc of snap.docs) {
        if (doc.id !== keepWikiId) {
            await doc.ref.update({
                [field]: null,
                updatedAt: new Date().toISOString(),
                updatedBy: uid,
            });
        }
    }
}

async function applyCharacterLink(db, campaignId, wikiEntity, character, uid) {
    await clearStaleWikiLinks(db, campaignId, "linkedVttCharacterId", character.id, wikiEntity.id, uid);
    const updates = {
        linkedVttCharacterId: character.id,
        updatedAt: new Date().toISOString(),
        updatedBy: uid,
    };
    if (!wikiEntity.imageUrl && character.imageUrl) {
        updates.imageUrl = character.imageUrl;
    }
    await db.collection("campaigns").doc(campaignId).collection("wikiEntities").doc(wikiEntity.id).update(updates);
}

async function applyLocationLink(db, campaignId, wikiEntity, location, uid) {
    await clearStaleWikiLinks(db, campaignId, "linkedVttLocationId", location.id, wikiEntity.id, uid);
    const updates = {
        linkedVttLocationId: location.id,
        updatedAt: new Date().toISOString(),
        updatedBy: uid,
    };
    if (!wikiEntity.imageUrl && location.imageUrl) {
        updates.imageUrl = location.imageUrl;
    }
    await db.collection("campaigns").doc(campaignId).collection("wikiEntities").doc(wikiEntity.id).update(updates);
}

function matchVttToWiki(vttItems, wikiItems, linkField) {
    const report = {
        linked: [],
        skipped_already_linked: [],
        ambiguous: [],
        unmatched_vtt: [],
        unmatched_wiki: [],
    };

    const usedWikiIds = new Set();
    const wikiById = Object.fromEntries(wikiItems.map((w) => [w.id, w]));

    for (const vtt of vttItems) {
        const already = wikiItems.find((w) => w[linkField] === vtt.id);
        if (already) {
            report.skipped_already_linked.push({
                vttId: vtt.id,
                vttName: vtt.name,
                wikiId: already.id,
                wikiTitle: already.title,
            });
            usedWikiIds.add(already.id);
            continue;
        }

        const scored = wikiItems
            .filter((w) => !usedWikiIds.has(w.id) && !w[linkField])
            .map((w) => ({
                wiki: w,
                score: scoreMatch(vtt.name, w),
            }))
            .filter((x) => x.score >= MIN_SCORE)
            .sort((a, b) => b.score - a.score);

        if (scored.length === 0) {
            report.unmatched_vtt.push({ vttId: vtt.id, vttName: vtt.name });
            continue;
        }

        const best = scored[0];
        const second = scored[1];
        if (second && best.score - second.score < 0.08) {
            report.ambiguous.push({
                vttId: vtt.id,
                vttName: vtt.name,
                candidates: scored.slice(0, 3).map((s) => ({
                    wikiId: s.wiki.id,
                    wikiTitle: s.wiki.title,
                    slug: s.wiki.slug,
                    score: Number(s.score.toFixed(3)),
                })),
            });
            continue;
        }

        report.linked.push({
            vttId: vtt.id,
            vttName: vtt.name,
            wikiId: best.wiki.id,
            wikiTitle: best.wiki.title,
            slug: best.wiki.slug,
            score: Number(best.score.toFixed(3)),
        });
        usedWikiIds.add(best.wiki.id);
    }

    for (const w of wikiItems) {
        if (!w[linkField] && !usedWikiIds.has(w.id)) {
            report.unmatched_wiki.push({
                wikiId: w.id,
                wikiTitle: w.title,
                slug: w.slug,
            });
        }
    }

    return report;
}

async function main() {
    const db = initAdmin();
    const uid = "link-vtt-wiki-script";

    console.log(`Campaign: ${CAMPAIGN_ID}`);
    console.log(`Mode: ${APPLY ? "APPLY" : "DRY"}`);
    console.log(`Min score: ${MIN_SCORE}\n`);

    const [characters, locations, wikiEntities] = await Promise.all([
        loadVttCharacters(db, CAMPAIGN_ID),
        loadVttLocations(db, CAMPAIGN_ID),
        loadWikiEntities(db, CAMPAIGN_ID),
    ]);

    const wikiPersonajes = wikiEntities.filter((e) => e.entityType === "personaje");
    const wikiLocaciones = wikiEntities.filter((e) => e.entityType === "locacion");

    const charReport = matchVttToWiki(characters, wikiPersonajes, "linkedVttCharacterId");
    const locReport = matchVttToWiki(locations, wikiLocaciones, "linkedVttLocationId");

    const report = {
        campaignId: CAMPAIGN_ID,
        dryRun: !APPLY,
        characters: charReport,
        locations: locReport,
    };

    console.log(JSON.stringify(report, null, 2));

    if (!APPLY) {
        console.log("\nDry run complete. Re-run with --apply to write links.");
        return;
    }

    for (const item of charReport.linked) {
        const wiki = wikiPersonajes.find((w) => w.id === item.wikiId);
        const character = characters.find((c) => c.id === item.vttId);
        if (wiki && character) {
            await applyCharacterLink(db, CAMPAIGN_ID, wiki, character, uid);
        }
    }

    for (const item of locReport.linked) {
        const wiki = wikiLocaciones.find((w) => w.id === item.wikiId);
        const location = locations.find((l) => l.id === item.vttId);
        if (wiki && location) {
            await applyLocationLink(db, CAMPAIGN_ID, wiki, location, uid);
        }
    }

    console.log(`\nApplied ${charReport.linked.length} character links and ${locReport.linked.length} location links.`);
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
