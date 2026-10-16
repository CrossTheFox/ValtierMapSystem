import { useEffect, useMemo, useState } from "react";
import { Box, IconButton, Popover } from "@mui/material";
import { keyframes } from "@emotion/react";
import SettingsIcon from "@mui/icons-material/Settings";
import { getAuth } from "firebase/auth";
import { useSelector } from "react-redux";
import { getCampaignsByOwner } from "../../../firebase/services/campaignService";
import { listOwnedLores } from "../../../firebase/services/loreService";
import { linkCampaignToLore, unlinkCampaignFromLore } from "../../../firebase/services/campaignLoreLink";
import { seedCampaignIntoLore } from "../../../firebase/services/loreCampaignSeed";
import { UI_COLORS } from "../../constants/uiColors";
import { TYPO } from "../../constants/designSystem";
import { CYBER_SCROLL_STYLE } from "../../constants/cyberScrollStyle";
import { VTT_HUD } from "../../constants/vttHudTokens";
import CyberTooltip from "../customs/CyberTooltip";

const VALTIA_ZERO_ONE = "RfY23gcG7No5HcGddo1j";

const seedSweep = keyframes`
    0% { transform: translateX(-70%); }
    100% { transform: translateX(180%); }
`;

const fieldSx = {
    color: UI_COLORS.textPrimary,
    background: "#16161f",
    border: "1px solid rgba(255,255,255,0.16)",
    borderRadius: "4px",
    fontFamily: TYPO.body,
    fontSize: "13px",
    padding: "6px 8px",
    colorScheme: "dark",
    "& option": { background: "#16161f", color: "#ffffff" },
};

/**
 * DM settings for annexing a mesa to a Lore.
 * Each campaign shows the Lore it already has. Annexing writes the link and
 * then creates personaje, lugar and organización fichas, with a meter under the row.
 */
export default function ArchiveLoreGear({ loreId = "", campaignId = "", linkedIds = [] }) {
    const profileUid = useSelector((s) => s.player.profile?.uid || null);
    const uid = profileUid || getAuth().currentUser?.uid || null;
    const [anchor, setAnchor] = useState(null);
    const [campaigns, setCampaigns] = useState([]);
    const [lores, setLores] = useState([]);
    const [pickByCampaign, setPickByCampaign] = useState({});
    const [busyId, setBusyId] = useState("");
    const [progress, setProgress] = useState(null);
    const [error, setError] = useState("");

    useEffect(() => {
        if (!anchor || !uid) return undefined;
        let cancel = false;
        Promise.all([getCampaignsByOwner(uid), listOwnedLores(uid)])
            .then(([camps, owned]) => {
                if (cancel) return;
                setCampaigns(camps
                    .filter((row) => row.id !== VALTIA_ZERO_ONE)
                    .sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""), "es")));
                setLores(owned.filter((row) => !row.source_lore_id));
            })
            .catch((err) => {
                if (!cancel) setError(err?.message || "No se pudieron cargar las campañas.");
            });
        return () => { cancel = true; };
    }, [anchor, uid]);

    const listedCampaigns = useMemo(
        () => (campaignId ? campaigns.filter((row) => row.id === campaignId) : campaigns),
        [campaigns, campaignId],
    );
    const loreName = useMemo(() => {
        const map = new Map(lores.map((row) => [row.id, row.name || "Lore"]));
        return (id) => map.get(id) || (id ? "Lore anexado" : "Sin Lore");
    }, [lores]);
    const activeLore = loreId || campaigns.find((row) => row.id === campaignId)?.primary_lore_id || "";

    const annex = async (camp) => {
        const targetLore = activeLore || pickByCampaign[camp.id] || "";
        if (!targetLore || busyId) return;
        if (camp.primary_lore_id && camp.primary_lore_id !== targetLore) {
            const ok = window.confirm(`«${camp.name || "Esa campaña"}» ya tiene otro Lore. ¿Pasarla a este?`);
            if (!ok) return;
        }
        setBusyId(camp.id);
        setError("");
        setProgress({ id: camp.id, done: 0, total: 0, label: "Anexando…" });
        try {
            await linkCampaignToLore(camp.id, camp.name || "Mesa", targetLore);
            setCampaigns((rows) => rows.map((row) => (
                row.id === camp.id ? { ...row, primary_lore_id: targetLore } : row
            )));
            await seedCampaignIntoLore(targetLore, camp.id, (next) => {
                setProgress({ id: camp.id, ...next });
            });
        } catch (err) {
            setError(err?.message || "No se pudo anexar la campaña.");
            setProgress(null);
        } finally {
            setBusyId("");
        }
    };

    const unlink = async (camp) => {
        const from = camp.primary_lore_id;
        if (!from || busyId) return;
        if (!window.confirm("¿Desenlazar? Las fichas se quedan en el Lore.")) return;
        setBusyId(camp.id);
        setError("");
        try {
            await unlinkCampaignFromLore(camp.id, from);
            setCampaigns((rows) => rows.map((row) => (
                row.id === camp.id ? { ...row, primary_lore_id: "" } : row
            )));
        } catch (err) {
            setError(err?.message || "No se pudo desenlazar.");
        } finally {
            setBusyId("");
        }
    };

    return (
        <>
            <CyberTooltip title="Configuración del Lore" placement="bottom">
                <IconButton
                    size="small"
                    aria-label="Configuración del Lore"
                    onClick={(e) => setAnchor(e.currentTarget)}
                    sx={{
                        width: VTT_HUD.hudBtnSize,
                        height: VTT_HUD.hudBtnSize,
                        borderRadius: "3px",
                        color: anchor ? UI_COLORS.anomaly : UI_COLORS.textSecondary,
                        border: `1px solid ${anchor ? UI_COLORS.anomaly : UI_COLORS.border}`,
                        bgcolor: "rgba(10,10,15,0.9)",
                        "&:hover": { color: UI_COLORS.accent, borderColor: UI_COLORS.accent },
                    }}
                >
                    <SettingsIcon sx={{ fontSize: "1.05rem" }} />
                </IconButton>
            </CyberTooltip>
            <Popover
                open={Boolean(anchor)}
                anchorEl={anchor}
                onClose={() => { if (!busyId) setAnchor(null); }}
                anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
                transformOrigin={{ vertical: "top", horizontal: "right" }}
                slotProps={{
                    paper: {
                        sx: {
                            mt: 0.75,
                            width: 360,
                            maxWidth: "calc(100vw - 24px)",
                            maxHeight: "70vh",
                            p: "14px",
                            color: UI_COLORS.textPrimary,
                            bgcolor: "rgba(10,10,16,0.97)",
                            backgroundImage: "none",
                            border: `1px solid ${UI_COLORS.border}`,
                            borderRadius: "8px",
                            boxShadow: "0 18px 48px rgba(0,0,0,.55)",
                            ...CYBER_SCROLL_STYLE,
                        },
                    },
                }}
            >
                <Box sx={{ fontFamily: TYPO.title, fontSize: "11px", letterSpacing: "0.16em", color: UI_COLORS.accent, mb: 0.5 }}>
                    {campaignId ? "ANEXAR" : "ANEXAR CAMPAÑA"}
                </Box>
                <Box sx={{ fontFamily: TYPO.body, fontSize: "12.5px", color: UI_COLORS.textSecondary, mb: 1.5 }}>
                    {campaignId
                        ? "Anexar esta mesa al Lore abierto. Si ya tiene otro, se te pide confirmación."
                        : "Cada mesa muestra el Lore que ya tiene. Si no tiene, se anexa y se crean sus fichas."}
                </Box>
                <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
                    {listedCampaigns.length === 0 && (
                        <Box sx={{ color: UI_COLORS.textSecondary, fontSize: "13px" }}>
                            {campaignId ? "Esta mesa no está entre las que creaste." : "No tienes campañas creadas."}
                        </Box>
                    )}
                    {listedCampaigns.map((camp) => {
                        const attached = camp.primary_lore_id || "";
                        const here = Boolean(activeLore && (attached === activeLore || (loreId && linkedIds.includes(camp.id))));
                        const canAnnex = !attached || (Boolean(activeLore) && attached !== activeLore);
                        const metering = progress?.id === camp.id;
                        const needsPick = !activeLore && !attached;
                        return (
                            <Box key={camp.id}>
                                <Box
                                    component="button"
                                    type="button"
                                    disabled={Boolean(busyId) || here || !canAnnex || (needsPick && !pickByCampaign[camp.id])}
                                    onClick={() => annex(camp)}
                                    sx={{
                                        width: "100%",
                                        textAlign: "left",
                                        cursor: "pointer",
                                        color: UI_COLORS.textPrimary,
                                        background: "rgba(8,8,14,0.9)",
                                        border: `1px solid ${here ? UI_COLORS.anomaly : UI_COLORS.border}`,
                                        borderRadius: "4px",
                                        px: 1.25,
                                        py: 1,
                                        fontFamily: TYPO.body,
                                        "&:hover:not(:disabled)": { borderColor: UI_COLORS.accent },
                                        "&:disabled": { cursor: "default", opacity: here ? 1 : 0.55 },
                                    }}
                                >
                                    <Box sx={{ fontSize: "14px" }}>{camp.name || "Campaña"}</Box>
                                    <Box sx={{ fontSize: "12px", color: UI_COLORS.textSecondary, mt: 0.25 }}>
                                        {here ? "Anexada a este Lore" : (campaignId ? "Anexar" : loreName(attached))}
                                    </Box>
                                </Box>
                                {needsPick && (
                                    <Box
                                        component="select"
                                        aria-label={`Lore para ${camp.name || "la campaña"}`}
                                        value={pickByCampaign[camp.id] || ""}
                                        onChange={(ev) => setPickByCampaign((prev) => ({ ...prev, [camp.id]: ev.target.value }))}
                                        sx={{ ...fieldSx, width: "100%", mt: 0.75 }}
                                    >
                                        <option value="">Elegir Lore</option>
                                        {lores.map((lore) => (
                                            <option key={lore.id} value={lore.id}>{lore.name}</option>
                                        ))}
                                    </Box>
                                )}
                                {metering && <SeedMeter done={progress.done} total={progress.total} label={progress.label} />}
                                {here && (
                                    <Box
                                        component="button"
                                        type="button"
                                        onClick={() => unlink({ ...camp, primary_lore_id: attached || activeLore })}
                                        disabled={Boolean(busyId)}
                                        sx={{ mt: 0.5, color: UI_COLORS.textSecondary, background: "transparent", border: 0, cursor: "pointer", fontSize: "12px", fontFamily: TYPO.body }}
                                    >
                                        Desenlazar
                                    </Box>
                                )}
                            </Box>
                        );
                    })}
                </Box>
                {error && <Box sx={{ mt: 1.25, color: "#ff8095", fontSize: "12.5px" }}>{error}</Box>}
            </Popover>
        </>
    );
}

function SeedMeter({ done, total, label }) {
    const pct = total > 0 ? Math.round((done / total) * 100) : 8;
    return (
        <Box sx={{ mt: 0.75 }} aria-live="polite">
            <Box
                sx={{
                    position: "relative",
                    height: 4,
                    borderRadius: "2px",
                    overflow: "hidden",
                    bgcolor: "rgba(255,255,255,0.08)",
                }}
            >
                <Box
                    sx={{
                        height: "100%",
                        width: `${pct}%`,
                        borderRadius: "2px",
                        background: UI_COLORS.anomaly,
                        boxShadow: `0 0 10px ${UI_COLORS.anomaly}`,
                        transition: "width .25s ease",
                    }}
                />
                <Box
                    sx={{
                        position: "absolute",
                        inset: 0,
                        width: "40%",
                        background: "linear-gradient(90deg, transparent, rgba(255,255,255,.55), transparent)",
                        animation: `${seedSweep} 1.1s linear infinite`,
                    }}
                />
            </Box>
            <Box sx={{ mt: 0.5, fontFamily: TYPO.mono, fontSize: "11px", color: UI_COLORS.anomaly }}>
                {total ? `${done}/${total} · ${label}` : label}
            </Box>
        </Box>
    );
}
