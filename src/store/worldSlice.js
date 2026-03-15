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

        if (map?.imageUrl) {
            promises.push(
                (async () => {
                    try {
                        const url = await loadFirebaseAsset(map.imageUrl);
                        await preloadImage(url);
                        await loadTexture(map.imageUrl);
                    } catch (err) {
                        console.warn("No se pudo cargar el mapa base, saltando...", err);
                    }
                })()
            );
        }

        Object.values(locations).forEach(location => {
            location.characters.forEach(char => {
                if (char.imageUrl) {
                    promises.push(
                        (async () => {
                            try {
                                const url = await loadFirebaseAsset(char.imageUrl);
                                await preloadImage(url);

                            } catch (err) {
                                console.warn(`Asset faltante para ${char.name || 'personaje'}: ${char.imageUrl}`);
                            }
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
    reducers: {
        updateLocationInState: (state, action) => {
            const { id, data } = action.payload;
            if (state.locations[id]) {
                state.locations[id] = { ...state.locations[id], ...data };
            }
        },
        updateCharacterInState: (state, action) => {
            const { id, locationId, data } = action.payload;
            const location = state.locations[locationId];
            
            if (location && location.characters) {
                const charIndex = location.characters.findIndex(c => c.id === id);
                if (charIndex !== -1) {
                    // Actualización inmutable del array de personajes
                    location.characters[charIndex] = {
                        ...location.characters[charIndex],
                        ...data
                    };
                }
            }
        }
    },
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

export const { updateLocationInState, updateCharacterInState } = worldSlice.actions;
export default worldSlice.reducer;