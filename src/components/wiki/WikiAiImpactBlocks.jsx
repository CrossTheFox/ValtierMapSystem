/**
 * Editable AI impact blocks shown under the standard narrative body on a ficha.
 * Data: top-level entity.aiImpactBlocks[] (newest first).
 * Narrative prose is editable; relation sync rows are read-only metadata.
 */

import { useState, useCallback } from "react";
import { Box } from "@mui/material";
import { useDispatch, useSelector } from "react-redux";
import { saveWikiEntity } from "../../store/wikiSlice";
import { showSnackbar } from "../../store/uiSlice";
import { isDmRole } from "../../utils/tokenControl";
import {
    getAiImpactBlocks,
    withRemovedAiImpactBlock,
    withUpdatedAiImpactBlock,
} from "../../utils/aiImpactBlocks";
import AiImpactBlockList from "./AiImpactBlockList";

/**
 * @param {{
 *   entity: object,
 *   canManage?: boolean,
 *   compact?: boolean,
 *   layout?: "cards"|"continuation",
 * }} props
 */
export default function WikiAiImpactBlocks({ entity, canManage = false, compact = false, layout = "cards" }) {
    const dispatch = useDispatch();
    const campaignId = useSelector((s) => s.world.selectedCampaignId);
    const uid = useSelector((s) => s.player.profile?.uid);
    const viewerIsDm = useSelector((s) => isDmRole(s.player.profile?.role));
    const liveEntity = useSelector((s) =>
        entity?.id ? (s.wiki.entities ?? []).find((e) => e.id === entity.id) : null
    ) ?? entity;

    const [saving, setSaving] = useState(false);
    const blocks = getAiImpactBlocks(liveEntity);
    const continuation = layout === "continuation";

    const persist = useCallback(async (patch) => {
        if (!campaignId || !liveEntity?.id) return;
        setSaving(true);
        try {
            await dispatch(saveWikiEntity({
                campaignId,
                entityId: liveEntity.id,
                uid,
                data: patch,
            })).unwrap();
        } catch (err) {
            dispatch(showSnackbar({
                message: `No se pudo actualizar el bloque IA: ${err.message}`,
                severity: "error",
            }));
        } finally {
            setSaving(false);
        }
    }, [campaignId, liveEntity?.id, uid, dispatch]);

    const handleSaveBody = useCallback(async (blockId, body) => {
        await persist(withUpdatedAiImpactBlock(liveEntity, blockId, body));
    }, [persist, liveEntity]);

    const handleDelete = useCallback(async (blockId) => {
        await persist(withRemovedAiImpactBlock(liveEntity, blockId));
    }, [persist, liveEntity]);

    const visible = (blocks || []).some((block) => viewerIsDm || canManage || !block.dmOnly);
    if (continuation && !visible) return null;

    return (
        <Box sx={{ mt: continuation ? 0 : (compact ? 1.5 : 2) }}>
            <AiImpactBlockList
                blocks={blocks}
                viewerIsDm={viewerIsDm || canManage}
                canManage={canManage && Boolean(campaignId && liveEntity?.id)}
                saving={saving}
                onSaveBody={handleSaveBody}
                onDelete={handleDelete}
                layout={layout}
                hint={continuation ? null : "Historial de eventos. La prosa se edita; los cambios quedan como registro. Los bloques NEURAL LAB son decisiones aceptadas por el DM en el Neural Lab."}
                emptyText={continuation ? null : (canManage
                    ? "Aún no hay impactos aplicados desde el Lab IA o el Neural Lab."
                    : "Cuando el DM aplique un evento narrativo, verás aquí cómo te afectó.")}
            />
        </Box>
    );
}
