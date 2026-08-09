import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import { db } from "../../firebase/firebaseConfig";
import { collection, query, where, getDocs, doc, getDoc } from "firebase/firestore";
import {
    warmCharacterAssets,
    warmAsset,
} from "../../firebase/services/assetLoader";
import { getMapsByCampaign, updateMapDoc } from "../../firebase/services/mapService";
import {
    DEFAULT_LOCAL_GRID_VISIBLE,
    DEFAULT_MAP_GRID_CONFIG,
    mergeGridConfig,
    normalizeMapGridConfig,
} from "../constants/gridConfig";
import { createEmptyTableMap } from "../constants/emptyTableMap";

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

/** Campaign-wide roster (includes characters with null locationId). */
async function loadCampaignCharacters(campaignId) {
    /** @type {Record<string, object>} */
    const charactersById = {};
    if (!campaignId) return charactersById;

    const charactersSnapshot = await getDocs(
        query(collection(db, "characters"), where("campaignId", "==", campaignId))
    );

    charactersSnapshot.forEach((charDoc) => {
        const character = { id: charDoc.id, ...serializeFirestore(charDoc) };
        character.stats = character.stats || {};
        character.bondPowers = Array.isArray(character.bondPowers) ? character.bondPowers : [];
        character.bond = character.bond ?? null;
        charactersById[character.id] = character;
    });

    return charactersById;
}

async function loadLocationsForMap(mapId, campaignId) {
    const locationsSnapshot = await getDocs(
        query(collection(db, "locations"), where("mapId", "==", mapId))
    );

    const locations = {};
    locationsSnapshot.forEach((locDoc) => {
        locations[locDoc.id] = {
            id: locDoc.id,
            ...serializeFirestore(locDoc),
            characters: [],
        };
    });

    const charactersById = await loadCampaignCharacters(campaignId);

    Object.values(charactersById).forEach((character) => {
        if (locations[character.locationId]) {
            locations[character.locationId].characters.push(character);
        }
    });

    return { locations, charactersById };
}

export const preloadWorldAssets = createAsyncThunk(
    "world/preloadAssets",
    async (worldData) => {
        const { map, locations } = worldData;
        const promises = [];

        if (map?.imageUrl) {
            promises.push(
                warmAsset(map.imageUrl, { pixi: true }).then((url) => {
                    if (!url) console.warn("No se pudo cargar el mapa base");
                })
            );
        }

        const chars = worldData.charactersById
            ? Object.values(worldData.charactersById)
            : Object.values(locations || {}).flatMap((loc) => loc.characters ?? []);

        // Decode all character portraits/tokens before UI mounts (DOM + PIXI).
        promises.push(warmCharacterAssets(chars, { pixi: true }));

        await Promise.all(promises);
    }
);

export const loadWorld = createAsyncThunk(
    "world/load",
    async (campaignId) => {
        const maps = await getMapsByCampaign(campaignId);
        const campaignSnap = await getDoc(doc(db, "campaigns", campaignId));
        const campaignData = campaignSnap.exists() ? campaignSnap.data() : {};
        const campaignName = campaignData.name ?? null;
        const rulesSystem = campaignData.rulesSystem || "icon";

        if (!maps.length) {
            const placeholder = createEmptyTableMap(campaignId);
            // Still load the campaign roster — eval / empty-table campaigns have no maps
            // but characters (and dossier / RED) must remain available.
            const charactersById = await loadCampaignCharacters(campaignId);
            return {
                maps: [],
                map: placeholder,
                activeMapId: null,
                locations: {},
                charactersById,
                campaignName,
                rulesSystem,
            };
        }

        const map = maps[0];
        const mapId = map.id;
        const { locations, charactersById } = await loadLocationsForMap(mapId, campaignId);

        return {
            maps,
            map,
            activeMapId: mapId,
            locations,
            charactersById,
            campaignName,
            rulesSystem,
        };
    }
);

export const switchMap = createAsyncThunk(
    "world/switchMap",
    async ({ mapId, campaignId }, { getState }) => {
        const state = getState();
        const maps = state.world.maps ?? [];
        const map = maps.find((m) => m.id === mapId);
        if (!map) throw new Error("Map not found");

        const { locations, charactersById } = await loadLocationsForMap(mapId, campaignId);

        // Soft-warm (no assetsStatus gate): new map + any missing character images.
        await Promise.all([
            map?.imageUrl ? warmAsset(map.imageUrl, { pixi: true }) : null,
            warmCharacterAssets(Object.values(charactersById || {}), { pixi: true }),
        ]);

        return { map, activeMapId: mapId, locations, charactersById };
    }
);

const worldSlice = createSlice({
    name: "world",
    initialState: {
        selectedCampaignId: null,
        selectedCampaignName: null,
        rulesSystem: "icon",
        maps: [],
        map: null,
        activeMapId: null,
        locations: {},
        /** Campaign-wide character roster (includes tokens with null locationId). */
        charactersById: {},
        gridConfig: {
            visible: DEFAULT_LOCAL_GRID_VISIBLE,
            ...DEFAULT_MAP_GRID_CONFIG,
        },
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
            state.maps = [];
            state.activeMapId = null;
            state.locations = {};
            state.charactersById = {};
            state.worldStatus = "idle";
            state.selectedCampaignId = null;
            state.selectedCampaignName = null;
            state.rulesSystem = "icon";
        },
        setGridConfig: (state, action) => {
            state.gridConfig = { ...state.gridConfig, ...action.payload };
        },
        /** Apply shared map grid rules from Firestore without clobbering local `visible`. */
        applyMapGridConfig: (state, action) => {
            const visible = state.gridConfig?.visible !== false;
            state.gridConfig = mergeGridConfig(action.payload, visible);
            const mapId = state.activeMapId ?? state.map?.id;
            if (mapId && state.map?.id === mapId) {
                state.map = {
                    ...state.map,
                    gridConfig: normalizeMapGridConfig(action.payload),
                };
            }
            const idx = state.maps.findIndex((m) => m.id === mapId);
            if (idx !== -1) {
                state.maps[idx] = {
                    ...state.maps[idx],
                    gridConfig: normalizeMapGridConfig(action.payload),
                };
            }
        },
        updateLocationInState: (state, action) => {
            const { id, data } = action.payload;
            if (state.locations[id]) {
                state.locations[id] = { ...state.locations[id], ...data };
            }
        },
        updateCharacterInState: (state, action) => {
            const { id, locationId, data } = action.payload;
            if (!id || !data) return;

            const mergeChar = (prev) => {
                const base = prev || { id };
                const next = { ...base, ...data };
                if (data.stats) {
                    next.stats = { ...(base.stats || {}), ...data.stats };
                } else if (base.stats) {
                    next.stats = base.stats;
                }
                if (data.bond) {
                    next.bond = { ...(base.bond || {}), ...data.bond };
                } else if (base.bond) {
                    next.bond = base.bond;
                }
                return next;
            };

            state.charactersById[id] = mergeChar(state.charactersById[id]);
            const locId = locationId || state.charactersById[id]?.locationId;
            const location = locId ? state.locations[locId] : null;

            if (location && location.characters) {
                const charIndex = location.characters.findIndex((c) => c.id === id);
                if (charIndex !== -1) {
                    location.characters[charIndex] = mergeChar(location.characters[charIndex]);
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
            if (!char?.id) return;

            state.charactersById[char.id] = {
                ...(state.charactersById[char.id] || {}),
                ...char,
            };

            // Only touch locations that actually hold this character (avoids
            // re-rendering unrelated map markers on every character sync).
            for (const loc of Object.values(state.locations)) {
                if (loc.id === char.locationId) continue;
                if (!loc.characters?.some((c) => c.id === char.id)) continue;
                loc.characters = loc.characters.filter((c) => c.id !== char.id);
            }

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
            }
        },

        // Eliminar Personaje
        removeCharacterRealtime: (state, action) => {
            const { id, locationId } = action.payload;
            if (id && state.charactersById[id]) {
                delete state.charactersById[id];
            }
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
                state.maps = action.payload.maps;
                state.map = action.payload.map;
                state.activeMapId = action.payload.activeMapId;
                state.locations = action.payload.locations;
                state.charactersById = action.payload.charactersById || {};
                state.gridConfig = mergeGridConfig(
                    action.payload.map?.gridConfig,
                    state.gridConfig?.visible !== false,
                );
                if (action.payload.campaignName) {
                    state.selectedCampaignName = action.payload.campaignName;
                }
                if (action.payload.rulesSystem) {
                    state.rulesSystem = action.payload.rulesSystem;
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
            .addCase(switchMap.pending, (state) => {
                state.worldStatus = "loading";
            })
            .addCase(switchMap.fulfilled, (state, action) => {
                state.worldStatus = "succeeded";
                state.map = action.payload.map;
                state.activeMapId = action.payload.activeMapId;
                state.locations = action.payload.locations;
                state.charactersById = action.payload.charactersById || {};
                state.gridConfig = mergeGridConfig(
                    action.payload.map?.gridConfig,
                    state.gridConfig?.visible !== false,
                );
            })
            .addCase(switchMap.rejected, (state, action) => {
                state.worldStatus = "failed";
                state.error = action.error.message;
            })
            .addCase(persistMapGridConfig.fulfilled, (state, action) => {
                const { mapId, gridConfig } = action.payload;
                const visible = state.gridConfig?.visible !== false;
                if ((state.activeMapId ?? state.map?.id) === mapId) {
                    state.gridConfig = mergeGridConfig(gridConfig, visible);
                    if (state.map) {
                        state.map = { ...state.map, gridConfig };
                    }
                }
                const idx = state.maps.findIndex((m) => m.id === mapId);
                if (idx !== -1) {
                    state.maps[idx] = { ...state.maps[idx], gridConfig };
                }
            })
    },
});

/** Persist shared grid rules on the map doc (DM). `visible` stays local. */
export const persistMapGridConfig = createAsyncThunk(
    "world/persistMapGridConfig",
    async ({ mapId, partial }, { getState }) => {
        if (!mapId) throw new Error("mapId required");
        const state = getState();
        const current = normalizeMapGridConfig(
            state.world.map?.id === mapId
                ? state.world.gridConfig
                : state.world.maps.find((m) => m.id === mapId)?.gridConfig,
        );
        const next = normalizeMapGridConfig({ ...current, ...partial });
        await updateMapDoc(mapId, { gridConfig: next });
        return { mapId, gridConfig: next };
    },
);

export const { 
    updateLocationInState, 
    updateCharacterInState, 
    setLore,
    setSelectedCampaign,
    resetWorldState,
    setGridConfig,
    applyMapGridConfig,
    upsertLocationRealtime,
    removeLocationRealtime,
    upsertCharacterRealtime,
    removeCharacterRealtime
} = worldSlice.actions;
export default worldSlice.reducer;