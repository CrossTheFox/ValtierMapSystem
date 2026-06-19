import { useState } from "react";
import { Box, IconButton, Tooltip } from "@mui/material";
import EditIcon from "@mui/icons-material/Edit";
import CheckIcon from "@mui/icons-material/Check";
import CloseIcon from "@mui/icons-material/Close";
import TodayIcon from "@mui/icons-material/Today";
import { useDispatch } from "react-redux";
import { CyberText } from "../customs/CustomTexts";
import { UI_COLORS } from "../../constants/uiColors";
import WikiDateInput from "./WikiDateInput";
import { saveCampaignNarrativeDate } from "../../store/wikiSlice";
import { TIMELINE_CALENDAR } from "../../utils/wikiTimeline";

/**
 * Control DM para editar la fecha presente de la campaña (Firestore campaigns/{id}).
 */
export default function WikiCampaignNarrativeDateControl({
    campaignId,
    uid,
    narrativeDate,
    calendar = TIMELINE_CALENDAR.DZ,
    presentLabel,
}) {
    const dispatch = useDispatch();
    const [editing, setEditing] = useState(false);
    const [draftDate, setDraftDate] = useState(narrativeDate || "");
    const [saving, setSaving] = useState(false);

    const startEdit = () => {
        setDraftDate(narrativeDate || "");
        setEditing(true);
    };

    const cancel = () => {
        setDraftDate(narrativeDate || "");
        setEditing(false);
    };

    const save = async () => {
        if (!draftDate.trim() || !campaignId) return;
        setSaving(true);
        try {
            await dispatch(
                saveCampaignNarrativeDate({
                    campaignId,
                    narrativeDate: draftDate.trim(),
                    narrativeCalendar: calendar,
                    uid,
                })
            ).unwrap();
            setEditing(false);
        } catch (err) {
            console.error("Error guardando fecha narrativa:", err);
        } finally {
            setSaving(false);
        }
    };

    if (editing) {
        return (
            <Box sx={{ display: "flex", alignItems: "flex-start", gap: 0.75, flexWrap: "wrap" }}>
                <WikiDateInput value={draftDate} onChange={setDraftDate} required />
                <Box sx={{ display: "flex", gap: 0.25, pt: 0.5 }}>
                    <Tooltip title="Guardar fecha presente">
                        <span>
                            <IconButton
                                size="small"
                                onClick={save}
                                disabled={saving || !draftDate.trim()}
                                sx={{ color: UI_COLORS.anomaly }}
                            >
                                <CheckIcon sx={{ fontSize: "1rem" }} />
                            </IconButton>
                        </span>
                    </Tooltip>
                    <Tooltip title="Cancelar">
                        <IconButton size="small" onClick={cancel} sx={{ color: UI_COLORS.textSecondary }}>
                            <CloseIcon sx={{ fontSize: "1rem" }} />
                        </IconButton>
                    </Tooltip>
                </Box>
            </Box>
        );
    }

    return (
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
            <TodayIcon sx={{ fontSize: "0.9rem", color: UI_COLORS.anomaly }} />
            <CyberText sx={{ fontSize: "0.65rem", color: UI_COLORS.anomaly, letterSpacing: 0.5 }}>
                Ahora: {presentLabel || "Sin fecha"}
            </CyberText>
            <Tooltip title="Editar fecha presente de la campaña">
                <IconButton size="small" onClick={startEdit} sx={{ color: UI_COLORS.textSecondary, p: 0.25 }}>
                    <EditIcon sx={{ fontSize: "0.85rem" }} />
                </IconButton>
            </Tooltip>
        </Box>
    );
}
