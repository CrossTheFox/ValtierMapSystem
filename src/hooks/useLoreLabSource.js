import { useEffect, useMemo, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../../firebase/firebaseConfig";
import { subscribeLoreFichas, createLoreFicha, updateLoreFicha, deleteLoreFicha } from "../../firebase/services/loreFichaService";
import {
    subscribeLoreRelaciones,
    replaceLoreRelation,
    updateLoreRelationStrength,
    deleteLoreRelation,
} from "../../firebase/services/loreRelationService";
import {
    publishLabViews,
    subscribeFichaVisibilidad,
    subscribeLabView,
    setFichaVisibility,
} from "../../firebase/services/labViewService";
import { slugify } from "../utils/wikiSlug";
import { buildPlayerEgo } from "../utils/labGraph";
import { LAB_BOARD_TYPES } from "../utils/labContainment";
import { lorePersonalityCustomFields, traitList } from "../constants/wiki/lorePersonality";

const LAB_TYPES = new Set(LAB_BOARD_TYPES);
const LAB_NEW_TITLE = {
    personaje: "Personaje",
    locacion: "Lugar",
    organizacion: "Organización",
    ideologia: "Ideología",
    especie: "Especie",
    reliquia: "Reliquia",
    evento_historico: "Acontecimiento",
    idioma: "Idioma",
};

export function fichaToLabEntity(row, characterId = null) {
    return {
        id: row.id,
        entityType: row.entity_type,
        title: row.title || "",
        summary: row.summary || "",
        body: row.body || "",
        slug: row.slug || "",
        imageUrl: row.image_url || null,
        image_url: row.image_url || null,
        linkedVttCharacterId: characterId || null,
        narrative_state: row.narrative_state || null,
        condicion: row.condicion || null,
        condicion_nota: row.condicion_nota || null,
        collective_mood: row.collective_mood || null,
        reaction_archetype: row.reaction_archetype || null,
        stress_response: row.stress_response || null,
        narrative_traits: traitList(row.narrative_traits),
        bond_notes: row.bond_notes || "",
        collective_archetype: row.collective_archetype || null,
        mesaSource: row.mesa_source || null,
        aiImpactBlocks: row.ai_impact_blocks || row.aiImpactBlocks || [],
        customFields: lorePersonalityCustomFields(row),
    };
}

export function relacionToLabEdge(row) {
    return {
        id: row.id,
        fromEntityId: row.from_ficha_id,
        toEntityId: row.to_ficha_id,
        relationType: row.relation_type,
        label: row.label || "",
        strength: row.strength ?? 0,
        from_ficha_id: row.from_ficha_id,
        to_ficha_id: row.to_ficha_id,
        relation_type: row.relation_type,
        neural_lab: row.neural_lab || null,
    };
}

function positionsOf(fichas) {
    const positions = {};
    for (const row of fichas || []) {
        const x = Number(row.layout_lab_x);
        const y = Number(row.layout_lab_y);
        if (Number.isFinite(x) && Number.isFinite(y)) positions[row.id] = { x, y };
    }
    return positions;
}

/**
 * Lore graph for the lab. Players do not subscribe fichas: they read labViews.
 * A DM preview builds the same ego locally from the full graph.
 */
export function useLoreLabSource({
    loreId: loreIdProp = null,
    campaignId = null,
    active = false,
    playerEgo = false,
    localEgo = false,
    uid = null,
    characters = [],
    egoCharacterId = null,
    publishViews = false,
}) {
    const [linkedLoreId, setLinkedLoreId] = useState("");
    const [linkReady, setLinkReady] = useState(false);
    const [fichas, setFichas] = useState(null);
    const [relaciones, setRelaciones] = useState(null);
    const [visibilityByFicha, setVisibilityByFicha] = useState({});
    const [playerView, setPlayerView] = useState(null);
    const [playerViewReady, setPlayerViewReady] = useState(false);

    useEffect(() => {
        if (loreIdProp || !campaignId || !active) return undefined;
        return onSnapshot(doc(db, "campaigns", campaignId), (snap) => {
            setLinkedLoreId(snap.exists() ? (snap.data().primary_lore_id || "") : "");
            setLinkReady(true);
        });
    }, [loreIdProp, campaignId, active]);

    const loreId = loreIdProp || linkedLoreId || "";
    const ready = Boolean(loreIdProp) || linkReady;
    const loadGraph = Boolean(active && loreId && (!playerEgo || localEgo));
    const loadPlayerView = Boolean(active && playerEgo && !localEgo && campaignId && uid);

    useEffect(() => {
        if (!loadGraph) return undefined;
        const stopF = subscribeLoreFichas(loreId, setFichas, () => setFichas([]));
        const stopR = subscribeLoreRelaciones(loreId, setRelaciones, () => setRelaciones([]));
        return () => {
            stopF();
            stopR();
        };
    }, [loadGraph, loreId]);

    useEffect(() => {
        if (!active || !campaignId || playerEgo) return undefined;
        return subscribeFichaVisibilidad(campaignId, setVisibilityByFicha, () => setVisibilityByFicha({}));
    }, [active, campaignId, playerEgo]);

    useEffect(() => {
        if (!loadPlayerView) return undefined;
        return subscribeLabView(campaignId, uid, (view) => {
            setPlayerView(view);
            setPlayerViewReady(true);
        }, () => {
            setPlayerView(null);
            setPlayerViewReady(true);
        });
    }, [loadPlayerView, campaignId, uid]);

    const characterByFicha = useMemo(() => {
        const map = new Map();
        for (const character of characters) {
            if (character?.ficha_id) map.set(character.ficha_id, character.id);
        }
        return map;
    }, [characters]);

    const graphEntities = useMemo(
        () => (fichas || []).map((row) => fichaToLabEntity(row, characterByFicha.get(row.id) || null)),
        [fichas, characterByFicha],
    );
    const graphRelations = useMemo(
        () => (relaciones || []).map(relacionToLabEdge),
        [relaciones],
    );

    const localEgoPack = useMemo(() => {
        if (!localEgo || !egoCharacterId) return null;
        const character = characters.find((row) => row.id === egoCharacterId) || null;
        if (!character?.ficha_id) return { characterId: egoCharacterId, fichaId: null, nodes: [], edges: [] };
        const own = new Set(
            characters
                .filter((row) => row.ownerPlayerId && row.ownerPlayerId === character.ownerPlayerId && row.ficha_id)
                .map((row) => row.ficha_id),
        );
        const visible = new Set(
            Object.entries(visibilityByFicha)
                .filter(([, value]) => value === "players")
                .map(([id]) => id),
        );
        const ego = buildPlayerEgo({
            fichas: fichas || [],
            relations: relaciones || [],
            focusFichaId: character.ficha_id,
            visibleFichaIds: visible,
            ownFichaIds: own,
        });
        return {
            characterId: character.id,
            characterName: character.name || "",
            fichaId: character.ficha_id,
            nodes: ego.nodes,
            edges: ego.edges,
        };
    }, [localEgo, egoCharacterId, characters, visibilityByFicha, fichas, relaciones]);

    const playerEgos = localEgo
        ? (localEgoPack ? [localEgoPack] : [])
        : (playerView?.characters || []);

    const activeEgo = playerEgo
        ? (playerEgos.find((row) => row.characterId === egoCharacterId) || playerEgos[0] || null)
        : null;

    const entities = playerEgo && !localEgo
        ? (activeEgo?.nodes || []).map((row) => fichaToLabEntity(row))
        : (playerEgo && localEgo
            ? (activeEgo?.nodes || []).map((row) => fichaToLabEntity(row, characterByFicha.get(row.id) || null))
            : graphEntities);
    const relations = playerEgo
        ? (activeEgo?.edges || []).map(relacionToLabEdge)
        : graphRelations;

    useEffect(() => {
        if (!publishViews || !campaignId || !loreId || !fichas || !relaciones) return undefined;
        const timer = setTimeout(() => {
            publishLabViews({
                campaignId,
                fichas,
                relations: relaciones,
                characters,
                visibilityByFicha,
            }).catch((err) => console.warn("[NeuralLab] no se publicó el ego", err));
        }, 400);
        return () => clearTimeout(timer);
    }, [publishViews, campaignId, loreId, fichas, relaciones, characters, visibilityByFicha]);

    const loading = loadPlayerView
        ? !playerViewReady
        : (loadGraph && (fichas == null || relaciones == null));

    const positions = useMemo(
        () => positionsOf(playerEgo ? (activeEgo?.nodes || []) : (fichas || [])),
        [playerEgo, activeEgo, fichas],
    );

    return {
        loreId,
        missingLore: Boolean(active && !loreIdProp && ready && !loreId),
        loading,
        entities,
        relations,
        relaciones: relaciones || [],
        positions,
        visibilityByFicha,
        playerEgos,
        activeEgo,
        async persistPosition(fichaId, pos) {
            if (!loreId || !fichaId || !pos) return;
            await updateLoreFicha(loreId, fichaId, {
                layout_lab_x: pos.x,
                layout_lab_y: pos.y,
            });
        },
        async commitRelation(row) {
            if (!loreId) return;
            await replaceLoreRelation(loreId, row);
        },
        async patchRelationStrength(relationId, strength) {
            if (!loreId || !relationId) return;
            await updateLoreRelationStrength(loreId, relationId, strength);
        },
        async createCard(entityType, pos = null) {
            if (!loreId || !LAB_TYPES.has(entityType)) return null;
            const title = LAB_NEW_TITLE[entityType] || "Ficha";
            const slug = `${slugify(title) || entityType}-${Date.now().toString(36)}`;
            const x = Number(pos?.x);
            const y = Number(pos?.y);
            return createLoreFicha(loreId, {
                entity_type: entityType,
                title,
                slug,
                ...(Number.isFinite(x) && Number.isFinite(y) ? { layout_lab_x: x, layout_lab_y: y } : {}),
            });
        },
        async deleteCards(fichaIds = [], relationIds = []) {
            if (!loreId) return;
            await Promise.all(relationIds.map((id) => deleteLoreRelation(loreId, id)));
            await Promise.all(fichaIds.map((id) => deleteLoreFicha(loreId, id)));
        },
        async markVisibility(fichaId, visibility) {
            if (!campaignId || !fichaId) return;
            await setFichaVisibility(campaignId, fichaId, visibility);
        },
        async patchImpact(fichaId, patch) {
            if (!loreId || !fichaId) return;
            await updateLoreFicha(loreId, fichaId, patch);
        },
    };
}
