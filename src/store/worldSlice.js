import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import { db } from "../../firebase/firebaseConfig";
import { collection, query, where, getDocs } from "firebase/firestore";
import { loadTexture, preloadImage, loadFirebaseAsset } from "../../firebase/services/assetLoader";

function serializeFirestore(doc) {
    const data = doc.data();

    const clean = {};

    for (const key in data) {
        const value = data[key];

        if (value?.seconds !== undefined && value?.nanoseconds !== undefined) {
            clean[key] = value.toDate().toISOString();
        } else {
            clean[key] = value;
        }
    }

    return clean;
}

export const preloadWorldAssets = createAsyncThunk(
    "world/preloadAssets",
    async (worldData) => {
        const { map, locations } = worldData;
        const promises = [];

        // 1. Precarga del Mapa
        if (map?.imageUrl) {
            promises.push(
                (async () => {
                    const url = await loadFirebaseAsset(map.imageUrl);
                    await preloadImage(url);
                    await loadTexture(map.imageUrl);
                })()
            );
        }

        // 2. Precarga de todos los Personajes
        // Convertimos el objeto de locations a array y recorremos sus personajes
        Object.values(locations).forEach(location => {
            location.characters.forEach(char => {
                if (char.imageUrl) {
                    promises.push(
                        (async () => {
                            // Esto descarga la URL de Firebase, la guarda en assetCache
                            // y fuerza al navegador a descargar el archivo
                            const url = await loadFirebaseAsset(char.imageUrl);
                            await preloadImage(url); 
                        })()
                    );
                }
            });
        });

        await Promise.all(promises);
    }
);

export const loadWorld = createAsyncThunk(
    "world/load",
    async (campaignId) => {
        // 1️⃣ Obtener mapa
        const mapsSnapshot = await getDocs(
            query(collection(db, "maps"), where("campaignId", "==", campaignId))
        );

        if (mapsSnapshot.empty) {
            throw new Error("No map found for campaign");
        }

        const mapDoc = mapsSnapshot.docs[0];
        const map = { id: mapDoc.id, ...serializeFirestore(mapDoc) };
        const mapId = mapDoc.id;

        // 2️⃣ Obtener locations
        const locationsSnapshot = await getDocs(
            query(collection(db, "locations"), where("mapId", "==", mapId))
        );

        const locations = {};
        locationsSnapshot.forEach((doc) => {
            locations[doc.id] = {
                id: doc.id,
                ...serializeFirestore(doc),
                characters: []
            };
        });

        // 3️⃣ Obtener personajes
        const charactersSnapshot = await getDocs(
            query(collection(db, "characters"), where("campaignId", "==", campaignId))
        );

        charactersSnapshot.forEach((doc) => {
            const character = { id: doc.id, ...serializeFirestore(doc) };

            if (locations[character.locationId]) {
                locations[character.locationId].characters.push(character);
            }
        });

        return {
            map,
            locations
        };
    }
);

const worldSlice = createSlice({
    name: "world",
    initialState: {
        map: null,
        locations: {},
        worldStatus: "idle",
        assetsStatus: "idle",
        error: null,
    },
    reducers: {},
    extraReducers: (builder) => {
        builder
            .addCase(loadWorld.pending, (state) => {
                state.worldStatus = "loading";
            })
            .addCase(loadWorld.fulfilled, (state, action) => {
                state.worldStatus = "succeeded";
                state.map = action.payload.map;
                state.locations = action.payload.locations;
            })
            .addCase(loadWorld.rejected, (state, action) => {
                state.worldStatus = "failed";
                state.error = action.error.message;
            })
            .addCase(preloadWorldAssets.pending, (state) => {
                state.assetsStatus = "loading";
            })
            .addCase(preloadWorldAssets.fulfilled, (state) => {
                state.assetsStatus = "succeeded";
            })
            .addCase(preloadWorldAssets.rejected, (state, action) => {
                state.assetsStatus = "failed";
                state.error = action.error.message;
            })
    },
});

export default worldSlice.reducer;