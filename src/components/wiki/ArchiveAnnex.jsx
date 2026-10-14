import { useEffect, useMemo, useRef, useState } from "react";
import { Box } from "@mui/material";
import { doc, onSnapshot } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { useSelector } from "react-redux";
import { db } from "../../../firebase/firebaseConfig";
import { getCampaignsByOwner } from "../../../firebase/services/campaignService";
import { listOwnedLores, subscribeLore } from "../../../firebase/services/loreService";
import {
    campaignPrimaryLoreId,
    linkCampaignToLore,
    unlinkCampaignFromLore,
} from "../../../firebase/services/campaignLoreLink";
import { UI_COLORS } from "../../constants/uiColors";
import { TYPO } from "../../constants/designSystem";

const VALTIA_ZERO_ONE = "RfY23gcG7No5HcGddo1j";

const barSx = {
    flex: "none",
    display: "flex",
    alignItems: "center",
    gap: "8px",
    flexWrap: "wrap",
    px: "14px",
    py: "8px",
    color: UI_COLORS.textPrimary,
    background: "#0d0d14",
    borderBottom: `1px solid rgba(255,255,255,0.08)`,
    fontFamily: TYPO.body,
    fontSize: "13px",
};

const fieldSx = {
    color: UI_COLORS.textPrimary,
    background: "#16161f",
    border: "1px solid rgba(255,255,255,0.16)",
    borderRadius: "6px",
    font: "inherit",
    padding: "6px 10px",
    colorScheme: "dark",
    "& option": { background: "#16161f", color: "#ffffff" },
};

const chipSx = {
    display: "inline-flex",
    alignItems: "center",
    gap: "6px",
    px: "8px",
    py: "4px",
    borderRadius: "6px",
    border: "1px solid rgba(255,255,255,0.16)",
    color: UI_COLORS.textPrimary,
    background: "#16161f",
    "& button": {
        color: UI_COLORS.textPrimary,
        background: "transparent",
        border: "none",
        padding: 0,
        cursor: "pointer",
        font: "inherit",
    },
};

/**
 * Annex a Lore to a campaign the signed-in user created, from either seat.
 * `seat="campaign"` picks one of the user's Lores for this mesa.
 * `seat="lore"` picks one of the user's campaigns for this Lore.
 */
export default function ArchiveAnnex({
    seat,
    campaignId = "",
    campaignName = "",
    loreId = "",
    canEdit = true,
    onLinked,
}) {
    const profileUid = useSelector((s) => s.player.profile?.uid || null);
    const uid = profileUid || getAuth().currentUser?.uid || null;
    const [ownerId, setOwnerId] = useState("");
    const [primaryLoreId, setPrimaryLoreId] = useState("");
    const [linkReady, setLinkReady] = useState(seat !== "campaign");
    const [lores, setLores] = useState([]);
    const [campaigns, setCampaigns] = useState([]);
    const [linked, setLinked] = useState([]);
    const [pick, setPick] = useState("");
    const [error, setError] = useState("");
    const [busy, setBusy] = useState(false);
    const [listed, setListed] = useState(false);
    const onLinkedRef = useRef(onLinked);
    onLinkedRef.current = onLinked;

    useEffect(() => {
        if (seat !== "campaign" || !campaignId) return undefined;
        setLinkReady(false);
        return onSnapshot(doc(db, "campaigns", campaignId), (snap) => {
            const data = snap.exists() ? snap.data() : {};
            setOwnerId(data.ownerId || "");
            setPrimaryLoreId(data.primary_lore_id || "");
            setLinkReady(true);
        }, () => setLinkReady(true));
    }, [seat, campaignId]);

    useEffect(() => {
        if (seat !== "lore" || !loreId) return undefined;
        return subscribeLore(loreId, (lore) => {
            const rows = (Array.isArray(lore?.linked_campaigns) ? lore.linked_campaigns : [])
                .filter((row) => row?.id)
                .map((row) => ({ id: String(row.id), name: row.name || "Mesa" }));
            setLinked(rows);
            onLinkedRef.current?.(rows);
        }, () => {});
    }, [seat, loreId]);

    const isOwner = seat !== "campaign" || (!!uid && ownerId === uid);
    const locked = campaignId === VALTIA_ZERO_ONE;
    const showEditor = canEdit && isOwner && !locked && linkReady;

    useEffect(() => {
        if (!uid || !showEditor) return undefined;
        let cancel = false;
        setListed(false);
        const load = seat === "campaign"
            ? listOwnedLores(uid).then((rows) => { if (!cancel) setLores(rows); })
            : getCampaignsByOwner(uid).then((rows) => {
                if (cancel) return;
                setCampaigns(rows
                    .filter((row) => row.id !== VALTIA_ZERO_ONE)
                    .sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""), "es")));
            });
        load.catch(() => {
            if (!cancel) {
                setLores([]);
                setCampaigns([]);
            }
        }).finally(() => {
            if (!cancel) setListed(true);
        });
        return () => { cancel = true; };
    }, [uid, showEditor, seat]);

    const loreName = useMemo(
        () => lores.find((lore) => lore.id === primaryLoreId)?.name || "",
        [lores, primaryLoreId],
    );
    const freeCampaigns = campaigns.filter((row) => !linked.some((link) => link.id === row.id));

    const linkLore = async () => {
        if (!pick || busy) return;
        setBusy(true);
        setError("");
        try {
            await linkCampaignToLore(campaignId, campaignName, pick);
            setPick("");
        } catch (err) {
            setError(err?.message || "No se pudo anexar el Lore.");
        } finally {
            setBusy(false);
        }
    };

    const linkCampaign = async () => {
        if (!pick || busy) return;
        const camp = campaigns.find((row) => row.id === pick);
        setBusy(true);
        setError("");
        try {
            const current = await campaignPrimaryLoreId(pick);
            if (current && current !== loreId) {
                const ok = window.confirm(`«${camp?.name || "Esa campaña"}» ya tiene otro Lore. ¿Pasarla a este? El tiempo de esa mesa pasa a ser este Lore.`);
                if (!ok) return;
            }
            await linkCampaignToLore(pick, camp?.name || "Mesa", loreId);
            setPick("");
        } catch (err) {
            setError(err?.message || "No se pudo anexar la campaña.");
        } finally {
            setBusy(false);
        }
    };

    const unlink = async (id, fromLoreId) => {
        if (busy) return;
        if (!window.confirm("¿Desenlazar? El tiempo sigue en el Lore. Las actas se quedan en la mesa.")) return;
        setBusy(true);
        setError("");
        try {
            await unlinkCampaignFromLore(id, fromLoreId);
        } catch (err) {
            setError(err?.message || "No se pudo desenlazar.");
        } finally {
            setBusy(false);
        }
    };

    if (seat === "campaign" && (!linkReady || !isOwner || locked)) return null;

    return (
        <Box sx={barSx}>
            {seat === "campaign" ? (
                <>
                    <span>Lore de la mesa</span>
                    {primaryLoreId ? (
                        <>
                            <b>{loreName || "Lore enlazado"}</b>
                            {showEditor && (
                                <Box component="button" type="button" onClick={() => unlink(campaignId, primaryLoreId)} disabled={busy} sx={fieldSx}>
                                    Desenlazar
                                </Box>
                            )}
                        </>
                    ) : showEditor ? (
                        <>
                            <Box component="select" aria-label="Lore" value={pick} onChange={(ev) => setPick(ev.target.value)} sx={fieldSx}>
                                <option value="">Elige un Lore tuyo</option>
                                {lores.map((lore) => (
                                    <option key={lore.id} value={lore.id}>{lore.name || "Sin título"}</option>
                                ))}
                            </Box>
                            <Box component="button" type="button" onClick={linkLore} disabled={!pick || busy} sx={fieldSx}>
                                {busy ? "Anexando…" : "Anexar"}
                            </Box>
                            {listed && !lores.length && <span style={{ color: UI_COLORS.textSecondary }}>No tienes Lores para anexar.</span>}
                        </>
                    ) : (
                        <span style={{ color: UI_COLORS.textSecondary }}>Esta mesa no tiene un Lore anexado.</span>
                    )}
                </>
            ) : (
                <>
                    <span>Campañas tuyas</span>
                    {linked.map((row) => (
                        <Box key={row.id} sx={chipSx}>
                            <span>{row.name}</span>
                            {showEditor && (
                                <button type="button" aria-label={`Desenlazar ${row.name}`} onClick={() => unlink(row.id, loreId)} disabled={busy}>×</button>
                            )}
                        </Box>
                    ))}
                    {showEditor && (
                        <>
                            <Box component="select" aria-label="Campaña" value={pick} onChange={(ev) => setPick(ev.target.value)} sx={fieldSx}>
                                <option value="">Anexar una campaña que creaste</option>
                                {freeCampaigns.map((row) => (
                                    <option key={row.id} value={row.id}>{row.name || "Sin título"}</option>
                                ))}
                            </Box>
                            <Box component="button" type="button" onClick={linkCampaign} disabled={!pick || busy} sx={fieldSx}>
                                {busy ? "Anexando…" : "Anexar"}
                            </Box>
                            {listed && !campaigns.length && <span style={{ color: UI_COLORS.textSecondary }}>No tienes campañas creadas por ti.</span>}
                        </>
                    )}
                    {!linked.length && !showEditor && (
                        <span style={{ color: UI_COLORS.textSecondary }}>Ninguna campaña anexada.</span>
                    )}
                </>
            )}
            {error && <span style={{ color: "#ffb3c0" }}>{error}</span>}
        </Box>
    );
}
