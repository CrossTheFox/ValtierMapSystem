import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import { db } from "../../firebase/firebaseConfig";
import {
    collection,
    query,
    where,
    orderBy,
    onSnapshot,
    doc,
} from "firebase/firestore";
import {
    updateCampaignNarrativeSettings,
    normalizeNarrativeArcs,
} from "../../firebase/services/campaignNarrativeService";
import {
    listWikiEntities,
    createWikiEntity,
    updateWikiEntity,
    deleteWikiEntity,
} from "../../firebase/services/wikiEntityService";
import {
    listAllRelations,
    listRelationsForEntity,
    createWikiRelation,
    updateWikiRelation as updateWikiRelationDoc,
    deleteWikiRelation,
} from "../../firebase/services/wikiRelationService";

// ── Realtime subscription registry (outside Redux, intentionally) ────────────
// Holds active Firestore unsubscribe functions per campaignId.
const _unsubscribers = {};

function _clearUnsubs(campaignId) {
    if (_unsubscribers[campaignId]) {
        _unsubscribers[campaignId].forEach((fn) => fn());
        delete _unsubscribers[campaignId];
    }
}

function serializeDoc(snap) {
    const data = snap.data();
    const clean = {};
    for (const key in data) {
        const v = data[key];
        if (v?.seconds !== undefined && v?.nanoseconds !== undefined) {
            clean[key] = v.toDate().toISOString();
        } else {
            clean[key] = v;
        }
    }
    return { id: snap.id, ...clean };
}

/**
 * Start real-time listeners for wikiEntities + entityRelations.
 * Dispatches `setEntities` / `setRelations` / `upsertEntityLocal` / `removeEntityLocal`
 * as Firestore pushes changes.
 */
export const startWikiSync = createAsyncThunk(
    "wiki/startSync",
    async ({ campaignId, role }, { dispatch }) => {
        // Clear existing listeners for this campaign (idempotent)
        _clearUnsubs(campaignId);

        const entitiesRef = collection(db, "campaigns", campaignId, "wikiEntities");
        const relationsRef = collection(db, "campaigns", campaignId, "entityRelations");

        const entitiesQuery =
            role === "player"
                ? query(entitiesRef, where("visibility", "==", "players"), orderBy("title"))
                : query(entitiesRef, orderBy("title"));

        const unsubEntities = onSnapshot(entitiesQuery, (snap) => {
            const entities = snap.docs.map(serializeDoc);
            dispatch(setEntities({ entities, campaignId }));
        });

        const unsubRelations = onSnapshot(relationsRef, (snap) => {
            const relations = snap.docs.map(serializeDoc);
            dispatch(setRelations(relations));
        });

        const campaignDocRef = doc(db, "campaigns", campaignId);
        const unsubCampaign = onSnapshot(campaignDocRef, (snap) => {
            if (!snap.exists()) {
                dispatch(setNarrativeSettings({
                    narrativeDate: null,
                    narrativeCalendar: null,
                    aiRules: null,
                    aiGeneration: null,
                    narrativeArcs: [],
                    activeNarrativeArcId: null,
                }));
                return;
            }
            const data = snap.data();
            dispatch(setNarrativeSettings({
                narrativeDate: data.narrativeDate ?? null,
                narrativeCalendar: data.narrativeCalendar ?? null,
                aiRules: data.aiRules ?? null,
                aiGeneration: data.aiGeneration ?? null,
                narrativeArcs: normalizeNarrativeArcs(data.narrativeArcs),
                activeNarrativeArcId: data.activeNarrativeArcId ?? null,
            }));
        });

        _unsubscribers[campaignId] = [unsubEntities, unsubRelations, unsubCampaign];

        return campaignId;
    }
);

/** Stop real-time listeners for a campaign. */
export function stopWikiSync(campaignId) {
    _clearUnsubs(campaignId);
}

// ── Async thunks ────────────────────────────────────────────────────────────

// Accepts either a plain campaignId string (legacy) or { campaignId, role }
export const fetchWikiEntities = createAsyncThunk(
    "wiki/fetchEntities",
    async (arg) => {
        const { campaignId, role } =
            typeof arg === "string" ? { campaignId: arg, role: undefined } : arg;
        const opts = role === "player" ? { role: "player" } : {};
        return listWikiEntities(campaignId, opts);
    }
);

export const fetchWikiRelations = createAsyncThunk(
    "wiki/fetchRelations",
    async (campaignId) => {
        return listAllRelations(campaignId);
    }
);

export const fetchEntityRelations = createAsyncThunk(
    "wiki/fetchEntityRelations",
    async ({ campaignId, entityId }) => {
        return listRelationsForEntity(campaignId, entityId);
    }
);

export const saveWikiEntity = createAsyncThunk(
    "wiki/saveEntity",
    async ({ campaignId, entityId, data, uid }) => {
        if (entityId) {
            return updateWikiEntity(campaignId, entityId, data, uid);
        }
        return createWikiEntity(campaignId, data, uid);
    }
);

export const removeWikiEntity = createAsyncThunk(
    "wiki/removeEntity",
    async ({ campaignId, entityId }) => {
        await deleteWikiEntity(campaignId, entityId);
        return entityId;
    }
);

export const addWikiRelation = createAsyncThunk(
    "wiki/addRelation",
    async ({ campaignId, data, uid }) => {
        return createWikiRelation(campaignId, data, uid);
    }
);

export const updateWikiRelation = createAsyncThunk(
    "wiki/updateRelation",
    async ({ campaignId, relationId, data }) => {
        const payload = await updateWikiRelationDoc(campaignId, relationId, data);
        return { id: relationId, ...payload };
    }
);

export const removeWikiRelation = createAsyncThunk(
    "wiki/removeRelation",
    async ({ campaignId, relationId }) => {
        await deleteWikiRelation(campaignId, relationId);
        return relationId;
    }
);

export const saveCampaignNarrativeDate = createAsyncThunk(
    "wiki/saveCampaignNarrativeDate",
    async ({ campaignId, narrativeDate, narrativeCalendar, uid }) => {
        await updateCampaignNarrativeSettings(
            campaignId,
            { narrativeDate, narrativeCalendar },
            uid
        );
        return { narrativeDate, narrativeCalendar };
    }
);

export const saveCampaignNarrativeArcs = createAsyncThunk(
    "wiki/saveCampaignNarrativeArcs",
    async ({ campaignId, narrativeArcs, activeNarrativeArcId, uid }) => {
        const normalized = normalizeNarrativeArcs(narrativeArcs);
        const patch = { narrativeArcs: normalized };
        if (activeNarrativeArcId !== undefined) {
            patch.activeNarrativeArcId = activeNarrativeArcId || null;
        }
        await updateCampaignNarrativeSettings(campaignId, patch, uid);
        return {
            narrativeArcs: normalized,
            activeNarrativeArcId:
                activeNarrativeArcId !== undefined ? (activeNarrativeArcId || null) : undefined,
        };
    }
);

export const saveCampaignAiRules = createAsyncThunk(
    "wiki/saveCampaignAiRules",
    async ({ campaignId, aiRules, uid }) => {
        await updateCampaignNarrativeSettings(campaignId, { aiRules }, uid);
        return { aiRules };
    }
);

export const saveCampaignAiConfig = createAsyncThunk(
    "wiki/saveCampaignAiConfig",
    async ({ campaignId, aiRules, aiGeneration, uid }) => {
        await updateCampaignNarrativeSettings(
            campaignId,
            { aiRules, aiGeneration },
            uid
        );
        return { aiRules, aiGeneration };
    }
);

// ── Slice ────────────────────────────────────────────────────────────────────

const wikiSlice = createSlice({
    name: "wiki",
    initialState: {
        entities: [],           // wikiEntity[]
        relations: [],          // wikiRelation[]
        entityRelations: [],    // relations for selected entity
        status: "idle",         // "idle" | "loading" | "succeeded" | "failed"
        relationsStatus: "idle",
        error: null,
        loadedCampaignId: null,
        syncActive: false,
        narrativeSettings: {
            narrativeDate: null,
            narrativeCalendar: null,
            aiRules: null,
            aiGeneration: null,
            narrativeArcs: [],
            activeNarrativeArcId: null,
        },
    },
    reducers: {
        resetWiki(state) {
            state.entities = [];
            state.relations = [];
            state.entityRelations = [];
            state.status = "idle";
            state.relationsStatus = "idle";
            state.loadedCampaignId = null;
            state.syncActive = false;
            state.narrativeSettings = {
                narrativeDate: null,
                narrativeCalendar: null,
                aiRules: null,
                aiGeneration: null,
                narrativeArcs: [],
                activeNarrativeArcId: null,
            };
        },
        setNarrativeSettings(state, action) {
            state.narrativeSettings = {
                narrativeDate: action.payload.narrativeDate ?? null,
                narrativeCalendar: action.payload.narrativeCalendar ?? null,
                aiRules: action.payload.aiRules ?? null,
                aiGeneration: action.payload.aiGeneration ?? null,
                narrativeArcs: normalizeNarrativeArcs(action.payload.narrativeArcs),
                activeNarrativeArcId: action.payload.activeNarrativeArcId ?? null,
            };
        },
        setEntities(state, action) {
            state.entities = action.payload.entities;
            state.loadedCampaignId = action.payload.campaignId;
            state.status = "succeeded";
        },
        setRelations(state, action) {
            state.relations = action.payload;
            state.relationsStatus = "succeeded";
        },
        upsertEntityLocal(state, action) {
            const entity = action.payload;
            const idx = state.entities.findIndex((e) => e.id === entity.id);
            if (idx !== -1) {
                state.entities[idx] = { ...state.entities[idx], ...entity };
            } else {
                state.entities.push(entity);
            }
        },
        removeEntityLocal(state, action) {
            state.entities = state.entities.filter((e) => e.id !== action.payload);
        },
    },
    extraReducers: (builder) => {
        builder
            // startWikiSync
            .addCase(startWikiSync.pending, (state) => {
                state.status = "loading";
                state.relationsStatus = "loading";
            })
            .addCase(startWikiSync.fulfilled, (state) => {
                state.syncActive = true;
            })
            // fetchWikiEntities (kept for one-shot fallback)
            .addCase(fetchWikiEntities.pending, (state) => {
                state.status = "loading";
            })
            .addCase(fetchWikiEntities.fulfilled, (state, action) => {
                state.status = "succeeded";
                state.entities = action.payload;
                const arg = action.meta.arg;
                state.loadedCampaignId = typeof arg === "string" ? arg : arg.campaignId;
            })
            .addCase(fetchWikiEntities.rejected, (state, action) => {
                state.status = "failed";
                state.error = action.error.message;
            })
            // fetchWikiRelations
            .addCase(fetchWikiRelations.pending, (state) => {
                state.relationsStatus = "loading";
            })
            .addCase(fetchWikiRelations.fulfilled, (state, action) => {
                state.relationsStatus = "succeeded";
                state.relations = action.payload;
            })
            .addCase(fetchWikiRelations.rejected, (state, action) => {
                state.relationsStatus = "failed";
                state.error = action.error.message;
            })
            // fetchEntityRelations
            .addCase(fetchEntityRelations.fulfilled, (state, action) => {
                state.entityRelations = action.payload;
            })
            // saveWikiEntity
            .addCase(saveWikiEntity.fulfilled, (state, action) => {
                const entity = action.payload;
                const idx = state.entities.findIndex((e) => e.id === entity.id);
                if (idx !== -1) {
                    state.entities[idx] = { ...state.entities[idx], ...entity };
                } else {
                    state.entities.push(entity);
                }
            })
            // removeWikiEntity
            .addCase(removeWikiEntity.fulfilled, (state, action) => {
                state.entities = state.entities.filter((e) => e.id !== action.payload);
            })
            // addWikiRelation
            .addCase(addWikiRelation.fulfilled, (state, action) => {
                state.relations.push(action.payload);
                state.entityRelations.push(action.payload);
            })
            // updateWikiRelation
            .addCase(updateWikiRelation.fulfilled, (state, action) => {
                const patch = action.payload;
                const merge = (list) => {
                    const idx = list.findIndex((r) => r.id === patch.id);
                    if (idx === -1) return;
                    list[idx] = { ...list[idx], ...patch };
                };
                merge(state.relations);
                merge(state.entityRelations);
            })
            // removeWikiRelation
            .addCase(removeWikiRelation.fulfilled, (state, action) => {
                state.relations = state.relations.filter((r) => r.id !== action.payload);
                state.entityRelations = state.entityRelations.filter((r) => r.id !== action.payload);
            })
            .addCase(saveCampaignNarrativeDate.fulfilled, (state, action) => {
                state.narrativeSettings = {
                    ...state.narrativeSettings,
                    narrativeDate: action.payload.narrativeDate,
                    narrativeCalendar: action.payload.narrativeCalendar,
                };
            })
            .addCase(saveCampaignNarrativeArcs.fulfilled, (state, action) => {
                state.narrativeSettings = {
                    ...state.narrativeSettings,
                    narrativeArcs: action.payload.narrativeArcs,
                    ...(action.payload.activeNarrativeArcId !== undefined
                        ? { activeNarrativeArcId: action.payload.activeNarrativeArcId }
                        : {}),
                };
            })
            .addCase(saveCampaignAiRules.fulfilled, (state, action) => {
                state.narrativeSettings = {
                    ...state.narrativeSettings,
                    aiRules: action.payload.aiRules,
                };
            })
            .addCase(saveCampaignAiConfig.fulfilled, (state, action) => {
                state.narrativeSettings = {
                    ...state.narrativeSettings,
                    aiRules: action.payload.aiRules,
                    aiGeneration: action.payload.aiGeneration,
                };
            });
    },
});

export const {
    resetWiki,
    setEntities,
    setRelations,
    setNarrativeSettings,
    upsertEntityLocal,
    removeEntityLocal,
} = wikiSlice.actions;
export default wikiSlice.reducer;
