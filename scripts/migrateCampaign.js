import admin from "firebase-admin";
import fs from "fs";
import dotenv from "dotenv";
dotenv.config();

const serviceAccount = JSON.parse(
    fs.readFileSync("./valtier-map-system-firebase-admins.json", "utf8")
);

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

const campaignJson = JSON.parse(
    fs.readFileSync("./public/data/campaign.json", "utf8")
);

const DM_UID = process.env.DM_USER_UID;

async function migrate() {
    console.log("🔥 Migrando campaña...");

    // 1️⃣ Crear campaña
    const campaignRef = await db.collection("campaigns").add({
        name: campaignJson.map.name,
        description: campaignJson.map.description,
        ownerId: DM_UID,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
    });

    const campaignId = campaignRef.id;

    // 2️⃣ Crear mapa
    const mapRef = await db.collection("maps").add({
        campaignId,
        name: campaignJson.map.name,
        description: campaignJson.map.description,
        imageUrl: campaignJson.map.image,
        width: campaignJson.map.width,
        height: campaignJson.map.height,
        unit: campaignJson.map.unit,
        metersPerPixel: campaignJson.map.metersPerPixel,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
    });

    const mapId = mapRef.id;

    // 3️⃣ Crear locations
    const locationIdMap = {};

    for (const key in campaignJson.locations) {
        const location = campaignJson.locations[key];

        const locationRef = await db.collection("locations").add({
            mapId,
            name: location.name,
            description: location.description,
            history: location.history,
            position: location.position,
            createdAt: admin.firestore.FieldValue.serverTimestamp()
        });

        locationIdMap[key] = locationRef.id;
    }

    // 4️⃣ Crear personajes desde locations
    for (const key in campaignJson.locations) {
        const location = campaignJson.locations[key];
        const locationId = locationIdMap[key];

        for (const char of location.characters) {
            await db.collection("characters").add({
                campaignId,
                locationId,
                ownerPlayerId: null,
                type: "npc",
                name: char.name,
                age: char.age,
                bio: char.bio,
                imageUrl: char.image,
                relations: {},
                createdAt: admin.firestore.FieldValue.serverTimestamp()
            });
        }
    }

    console.log("✅ Migración completa");
}

migrate();