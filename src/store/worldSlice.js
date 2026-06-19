import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import { db } from "../../firebase/firebaseConfig";
import { collection, query, where, getDocs, doc, getDoc } from "firebase/firestore";
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

            character.stats = character.stats || {};
            character.bondPowers = Array.isArray(character.bondPowers) ? character.bondPowers : [];
            character.bond = character.bond ?? null;

            if (locations[character.locationId]) {
                locations[character.locationId].characters.push(character);
            }
        });

        const campaignSnap = await getDoc(doc(db, "campaigns", campaignId));

        return {
            map,
            locations,
            campaignName: campaignSnap.exists() ? campaignSnap.data().name ?? null : null,
        };
    }
);

const worldSlice = createSlice({
    name: "world",
    initialState: {
        selectedCampaignId: null,
        selectedCampaignName: null,
        map: null,
        locations: {},
        worldStatus: "idle",
        assetsStatus: "idle",
        error: null,
    },
    reducers: {
        setSelectedCampaign: (state, action) => {
            const payload = action.payload;
            if (typeof payload === "string") {
                state.selectedCampaignId = payload;
            } else {
                state.selectedCampaignId = payload.id;
                state.selectedCampaignName = payload.name ?? null;
            }
            state.worldStatus = "idle";
            state.assetsStatus = "idle";
        },
        resetWorldState: (state) => {
            state.map = null;
            state.locations = {};
            state.worldStatus = "idle";
            state.selectedCampaignId = null;
            state.selectedCampaignName = null;
        },
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
        },
        setLore(state, _action) {
            // Legacy: no-op post-migration. Lore is now in wikiEntities (entityType: cronica).
        },
        upsertLocationRealtime(state, action) {
            const location = action.payload;

            if (state.locations[location.id]) {
                state.locations[location.id] = { ...state.locations[location.id], ...location };
            } else {
                state.locations[location.id] = { ...location, characters: [] };
            }
        },
        removeLocationRealtime: (state, action) => {
            const id = action.payload;
            delete state.locations[id];
        },
        upsertCharacterRealtime: (state, action) => {
            const char = action.payload;
            
            Object.values(state.locations).forEach(loc => {
                if (loc.id !== char.locationId && loc.characters) {
                    loc.characters = loc.characters.filter(c => c.id !== char.id);
                }
            });

            const targetLocation = state.locations[char.locationId];
            
            if (targetLocation) {
                const charIndex = targetLocation.characters.findIndex(c => c.id === char.id);
                if (charIndex !== -1) {
                    targetLocation.characters[charIndex] = { 
                        ...targetLocation.characters[charIndex], 
                        ...char 
                    };
                } else {
                    targetLocation.characters.push(char);
                }
            } else {
                console.warn(`[Redux] Location ${char.locationId} no existe para el personaje ${char.name}`);
            }
        },

        // Eliminar Personaje
        removeCharacterRealtime: (state, action) => {
            const { id, locationId } = action.payload;
            const location = state.locations[locationId];
            if (location && location.characters) {
                location.characters = location.characters.filter(c => c.id !== id);
            }
        },
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
                if (action.payload.campaignName) {
                    state.selectedCampaignName = action.payload.campaignName;
                }
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

export const { 
    updateLocationInState, 
    updateCharacterInState, 
    setLore,
    setSelectedCampaign,
    resetWorldState,
    upsertLocationRealtime,
    removeLocationRealtime,
    upsertCharacterRealtime,
    removeCharacterRealtime
} = worldSlice.actions;
export default worldSlice.reducer;