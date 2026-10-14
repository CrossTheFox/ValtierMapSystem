import { useCallback, useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import { Box, Dialog } from "@mui/material";
import { serverTimestamp } from "firebase/firestore";
import { listOwnedLores, createPrincipalLore } from "../../firebase/services/loreService";
import { createCampaignDoc } from "../../firebase/services/campaignService";
import { linkCampaignToLore } from "../../firebase/services/campaignLoreLink";
import { setSelectedCampaign } from "../store/worldSlice";
import { useAccessibleCampaigns } from "../hooks/useAccessibleCampaigns";
import { slugify } from "../utils/wikiSlug";
import { UI_COLORS } from "../constants/uiColors";
import { TYPO } from "../constants/designSystem";
import { CYBER_SCROLL_STYLE } from "../constants/cyberScrollStyle";
import {
    ARCHIVE_BORDER,
    ARCHIVE_BTN_SX,
    ARCHIVE_BTN_PRI_SX,
    ARCHIVE_SPIN_SX,
    ARCHIVE_TOPNAV_SX,
} from "../constants/archiveChrome";
import { ArchiveBrand } from "../components/wiki/ArchiveChrome";
import ArchiveExitMenu from "../components/wiki/ArchiveExitMenu";
import { StyledWrapper } from "../styles/LandingPageStyles";
import CyberPattern from "../components/animations/CyberPattern";
import { CyberTitle, CyberText } from "../components/customs/CustomTexts";

const BORDER = ARCHIVE_BORDER;
const PLACEHOLDER = "#888";
const btnSx = ARCHIVE_BTN_SX;
const btnPriSx = ARCHIVE_BTN_PRI_SX;

const inputSx = {
    width: "100%",
    boxSizing: "border-box",
    background: "rgba(0, 0, 0, .35)",
    border: `1px solid ${BORDER}`,
    borderRadius: "4px",
    color: UI_COLORS.textPrimary,
    padding: "7px 10px",
    outline: "none",
    colorScheme: "dark",
    fontFamily: TYPO.body,
    fontSize: "13.5px",
    "&::placeholder": { color: PLACEHOLDER },
    "&:focus": { borderColor: UI_COLORS.anomaly },
};

const fldSx = {
    display: "flex",
    flexDirection: "column",
    gap: "6px",
    mt: "12px",
    fontSize: "12px",
    color: UI_COLORS.textSecondary,
};

const sectionTitleSx = {
    fontFamily: TYPO.title,
    fontWeight: "bold",
    fontSize: "13px",
    letterSpacing: "0.14em",
    textTransform: "uppercase",
    color: UI_COLORS.accent,
    textShadow: `0 0 10px ${UI_COLORS.accent}88`,
    m: 0,
};

const panelSx = {
    p: { xs: "16px", md: "20px 22px" },
    background: "rgba(10, 10, 15, .95)",
    border: `1px solid ${UI_COLORS.accent}33`,
    borderRadius: "10px",
    boxShadow: `0 15px 25px rgba(0, 0, 0, .6), 0 0 10px ${UI_COLORS.accent}22`,
    backdropFilter: "blur(10px)",
};

const runningBorderBtnStyle = {
    width: "100%",
    marginTop: 0,
    padding: "15px 20px",
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-start",
    textAlign: "left",
    height: "auto",
};

const hubButtonsSx = {
    "& .submit-btn:focus-visible": { outline: `2px solid ${UI_COLORS.anomaly}`, outlineOffset: "1px" },
    "& .submit-btn.is-new:not(:hover)": {
        background: "rgba(255, 102, 255, .1)",
        borderRadius: "5px",
        boxShadow: `0 0 10px ${UI_COLORS.accent}55`,
    },
};

const countSx = { fontFamily: TYPO.mono, fontSize: "11px", color: PLACEHOLDER };

const emptySx = { color: UI_COLORS.textSecondary, fontSize: "14px", lineHeight: 1.6, py: 2 };

const spinSx = ARCHIVE_SPIN_SX;

function formatEdited(iso) {
    if (!iso) return "";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleDateString("es-CL", { day: "numeric", month: "short", year: "numeric" });
}

function Loading({ label }) {
    return (
        <Box sx={emptySx}>
            <Box component="span" sx={spinSx} />
            {label}
        </Box>
    );
}

function SectionHeader({ title, count, action = null }) {
    return (
        <Box sx={{ display: "flex", alignItems: "center", gap: "10px", pb: "10px", borderBottom: `1px solid ${BORDER}` }}>
            <Box component="h2" sx={sectionTitleSx}>{title}</Box>
            {count != null && <Box component="span" sx={countSx}>{count}</Box>}
            <Box sx={{ flex: 1 }} />
            {action}
        </Box>
    );
}

function LoreCard({ lore, highlighted, onOpen }) {
    const edited = formatEdited(lore.updated_at || lore.created_at);
    const linked = (Array.isArray(lore.linked_campaigns) ? lore.linked_campaigns : []).filter((row) => row?.id);
    const mesa = linked.length ? linked.map((row) => row.name || "Mesa").join(", ") : "sin campaña";
    const meta = [
        lore.present_year != null ? `${lore.present_year} D.Z.` : null,
        edited ? `editado ${edited}` : null,
    ].filter(Boolean).join(" · ");
    return (
        <button
            type="button"
            className={highlighted ? "submit-btn is-new" : "submit-btn"}
            onClick={() => onOpen(lore)}
            style={runningBorderBtnStyle}
        >
            <span /><span /><span /><span />
            <CyberTitle sx={{ fontSize: "1.1rem", mb: 0.5, maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {lore.name}
            </CyberTitle>
            {lore.summary && (
                <CyberText sx={{ fontSize: "13px", lineHeight: 1.5, color: UI_COLORS.textSecondary, maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {lore.summary}
                </CyberText>
            )}
            <CyberText sx={{ ...countSx, lineHeight: 1.5, mt: "4px" }}>
                {meta ? `${meta} · ` : ""}principal · {mesa}
            </CyberText>
        </button>
    );
}

function CampaignCard({ campaign, onEnter }) {
    return (
        <button type="button" className="submit-btn" onClick={() => onEnter(campaign)} style={runningBorderBtnStyle}>
            <span /><span /><span /><span />
            <CyberTitle sx={{ fontSize: "1.1rem", mb: 0.5 }}>
                {campaign.name?.toUpperCase() || "UNKNOWN_DATA"}
            </CyberTitle>
            <CyberText variant="caption" sx={{ opacity: 0.5, letterSpacing: "2px" }}>
                REF_ID: {campaign.id.substring(0, 12).toUpperCase()}
            </CyberText>
        </button>
    );
}

function NewMesaDialog({ open, onClose, onCreate }) {
    const [name, setName] = useState("");
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    const canSave = name.trim() !== "" && !saving;
    const submit = async (ev) => {
        ev.preventDefault();
        if (!canSave) return;
        setSaving(true);
        setError("");
        try {
            await onCreate({ name: name.trim() });
            setName("");
        } catch (err) {
            console.error("createCampaignDoc:", err);
            setError(err?.message || "No se pudo crear la mesa.");
        } finally {
            setSaving(false);
        }
    };
    return (
        <Dialog
            open={open}
            onClose={saving ? undefined : onClose}
            PaperProps={{
                sx: {
                    width: 460,
                    maxWidth: "calc(100vw - 32px)",
                    m: 2,
                    p: "16px 18px",
                    borderRadius: "8px",
                    background: "rgba(14, 14, 22, .97)",
                    backgroundImage: "none",
                    border: "1px solid rgba(0, 242, 234, .35)",
                    boxShadow: "0 20px 50px rgba(0, 0, 0, .65)",
                    color: UI_COLORS.textPrimary,
                    fontFamily: TYPO.body,
                    fontSize: "13.5px",
                },
            }}
        >
            <Box component="form" onSubmit={submit}>
                <CyberTitle sx={{ fontSize: "1.05rem", mb: 0.5 }}>Nueva mesa</CyberTitle>
                <CyberText sx={{ fontSize: "13px", color: UI_COLORS.textSecondary, mb: 1 }}>
                    Crea la mesa y su Lore local. El Lore nace sin copia de otro mundo.
                </CyberText>
                <Box component="label" sx={fldSx}>
                    Nombre
                    <Box component="input" value={name} onChange={(ev) => setName(ev.target.value)} sx={inputSx} autoFocus />
                </Box>
                {error && <Box sx={{ color: "#ff8095", fontSize: "12.5px", mt: 1 }}>{error}</Box>}
                <Box sx={{ display: "flex", justifyContent: "flex-end", gap: 1, mt: 2 }}>
                    <Box component="button" type="button" onClick={onClose} disabled={saving} sx={btnSx}>Cancelar</Box>
                    <Box component="button" type="submit" disabled={!canSave} sx={btnPriSx}>{saving ? "Creando…" : "Crear mesa"}</Box>
                </Box>
            </Box>
        </Dialog>
    );
}

function NewLoreDialog({ open, onClose, onCreate, takenSlugs }) {
    const [saving, setSaving] = useState(false);
    return (
        <Dialog
            open={open}
            onClose={saving ? undefined : onClose}
            PaperProps={{
                sx: {
                    width: 460,
                    maxWidth: "calc(100vw - 32px)",
                    maxHeight: "86%",
                    m: 2,
                    p: "16px 18px",
                    borderRadius: "8px",
                    background: "rgba(14, 14, 22, .97)",
                    backgroundImage: "none",
                    border: "1px solid rgba(0, 242, 234, .35)",
                    boxShadow: "0 20px 50px rgba(0, 0, 0, .65)",
                    color: UI_COLORS.textPrimary,
                    fontFamily: TYPO.body,
                    fontSize: "13.5px",
                    ...CYBER_SCROLL_STYLE,
                },
            }}
        >
            <NewLoreForm onClose={onClose} onCreate={onCreate} takenSlugs={takenSlugs} saving={saving} setSaving={setSaving} />
        </Dialog>
    );
}

function NewLoreForm({ onClose, onCreate, takenSlugs, saving, setSaving }) {
    const [name, setName] = useState("");
    const [slug, setSlug] = useState("");
    const [slugTouched, setSlugTouched] = useState(false);
    const [summary, setSummary] = useState("");
    const [presentYear, setPresentYear] = useState("");
    const [error, setError] = useState("");

    const effectiveSlug = slugTouched ? slugify(slug) : slugify(name);
    const slugTaken = effectiveSlug !== "" && takenSlugs.includes(effectiveSlug);
    const yearText = presentYear.trim();
    const yearValid = yearText === "" || /^-?\d+$/.test(yearText);
    const canSave = name.trim() !== "" && effectiveSlug !== "" && !slugTaken && yearValid && !saving;

    const submit = async (ev) => {
        ev.preventDefault();
        if (!canSave) return;
        setSaving(true);
        setError("");
        try {
            await onCreate({
                name: name.trim(),
                slug: effectiveSlug,
                summary: summary.trim(),
                presentYear: yearText === "" ? null : Number(yearText),
            });
        } catch (err) {
            console.error("createPrincipalLore:", err);
            setError(err?.code === "permission-denied"
                ? "Firestore rechazó la escritura. Las reglas de lores/ todavía no están desplegadas."
                : (err?.message || "No se pudo crear el Lore."));
        } finally {
            setSaving(false);
        }
    };

    return (
        <Box component="form" onSubmit={submit}>
            <Box sx={{ display: "flex", alignItems: "center", mb: "14px" }}>
                <Box sx={{ fontSize: "15px", fontWeight: 600 }}>Nuevo Lore</Box>
            </Box>
            <Box sx={{ color: UI_COLORS.textSecondary, fontSize: "12.5px" }}>
                Un Lore principal existe sin campaña. Solo tú lo ves.
            </Box>

            <Box component="label" sx={fldSx}>
                Nombre
                <Box component="input" autoFocus value={name} onChange={(e) => setName(e.target.value)} sx={inputSx} placeholder="El mundo que vas a escribir" />
            </Box>
            <Box component="label" sx={fldSx}>
                Slug
                <Box
                    component="input"
                    value={slugTouched ? slug : effectiveSlug}
                    onChange={(e) => { setSlugTouched(true); setSlug(e.target.value); }}
                    sx={{ ...inputSx, fontFamily: TYPO.mono, fontSize: "12.5px" }}
                    placeholder="se-arma-desde-el-nombre"
                />
                {slugTaken && (
                    <Box component="span" sx={{ color: "#ff8095" }}>Ya tienes un Lore con ese slug.</Box>
                )}
            </Box>
            <Box component="label" sx={fldSx}>
                Resumen
                <Box component="textarea" rows={3} value={summary} onChange={(e) => setSummary(e.target.value)} sx={{ ...inputSx, resize: "vertical", ...CYBER_SCROLL_STYLE }} />
            </Box>
            <Box component="label" sx={fldSx}>
                Año presente (D.Z.)
                <Box
                    component="input"
                    inputMode="numeric"
                    value={presentYear}
                    onChange={(e) => setPresentYear(e.target.value)}
                    sx={{ ...inputSx, width: 120, fontFamily: TYPO.mono }}
                    placeholder="opcional"
                />
                {!yearValid && <Box component="span" sx={{ color: "#ff8095" }}>Tiene que ser un año entero.</Box>}
            </Box>

            {error && <Box sx={{ mt: "12px", color: "#ff8095", fontSize: "12.5px" }}>{error}</Box>}

            <Box sx={{ display: "flex", justifyContent: "flex-end", gap: "8px", mt: "16px" }}>
                <Box component="button" type="button" onClick={onClose} disabled={saving} sx={btnSx}>Cancelar</Box>
                <Box component="button" type="submit" disabled={!canSave} sx={btnPriSx}>
                    {saving && <Box component="span" sx={spinSx} />}
                    Crear Lore
                </Box>
            </Box>
        </Box>
    );
}

/**
 * Post-login hub: the user's principal Lores (library) and the tables they can enter.
 * Entering a table keeps going through /map.
 */
export default function LibraryHubPage() {
    const dispatch = useDispatch();
    const navigate = useNavigate();
    const nickname = useSelector((s) => s.player.profile?.nickname);
    const [mesaRefresh, setMesaRefresh] = useState(0);
    const { campaigns, loading: campaignsLoading, error: campaignsError, uid } = useAccessibleCampaigns(mesaRefresh);

    const [lores, setLores] = useState([]);
    const [loresLoading, setLoresLoading] = useState(true);
    const [loresError, setLoresError] = useState(null);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [mesaOpen, setMesaOpen] = useState(false);
    const [justCreatedId, setJustCreatedId] = useState(null);

    useEffect(() => {
        const previous = document.title;
        document.title = "◈ ARCHIVE · Biblioteca";
        return () => {
            document.title = previous;
        };
    }, []);

    const loadLores = useCallback(async () => {
        if (!uid) return;
        setLoresLoading(true);
        setLoresError(null);
        try {
            const rows = await listOwnedLores(uid);
            rows.sort((a, b) => String(b.updated_at || "").localeCompare(String(a.updated_at || "")));
            setLores(rows);
        } catch (err) {
            console.error("listOwnedLores:", err);
            setLores([]);
            setLoresError(err?.code === "permission-denied"
                ? "Firestore rechazó la lectura. Las reglas de lores/ todavía no están desplegadas."
                : (err?.message || "No se pudieron cargar tus Lores."));
        } finally {
            setLoresLoading(false);
        }
    }, [uid]);

    useEffect(() => {
        loadLores();
    }, [loadLores]);

    const principals = useMemo(() => lores.filter((l) => !l.source_lore_id), [lores]);
    const takenSlugs = useMemo(() => lores.map((l) => l.slug).filter(Boolean), [lores]);

    const handleCreate = async (data) => {
        const id = await createPrincipalLore(uid, data);
        setDialogOpen(false);
        setJustCreatedId(id);
        await loadLores();
    };

    const handleCreateMesa = async ({ name }) => {
        const base = slugify(name) || "mesa";
        let slug = `${base}-lore`;
        if (takenSlugs.includes(slug)) slug = `${slug}-${Date.now().toString(36)}`;
        const ref = await createCampaignDoc({
            name,
            description: "",
            ownerId: uid,
            mapIds: [],
            playerIds: uid ? [uid] : [],
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
        });
        const loreId = await createPrincipalLore(uid, {
            name,
            slug,
            summary: "",
            presentYear: null,
        });
        await linkCampaignToLore(ref.id, name, loreId);
        setMesaOpen(false);
        setMesaRefresh((n) => n + 1);
        setJustCreatedId(loreId);
        await loadLores();
    };

    const openLore = (lore) => navigate(`/archive?loreId=${encodeURIComponent(lore.id)}`);

    const enterCampaign = (camp) => {
        dispatch(setSelectedCampaign({ id: camp.id, name: camp.name }));
        navigate("/map");
    };

    const newLoreButton = (label) => (
        <Box component="button" type="button" onClick={() => setDialogOpen(true)} disabled={!uid} sx={btnPriSx}>
            {label}
        </Box>
    );

    return (
        <Box sx={hubButtonsSx}>
            <StyledWrapper accent={UI_COLORS.accent}>
                <CyberPattern />
                <Box
                    sx={{
                        position: "relative",
                        zIndex: 1,
                        width: "100%",
                        height: "100%",
                        display: "flex",
                        flexDirection: "column",
                        color: UI_COLORS.textPrimary,
                        fontFamily: TYPO.body,
                        fontSize: "13.5px",
                        lineHeight: 1.5,
                    }}
                >
                    <Box
                        component="header"
                        sx={{ ...ARCHIVE_TOPNAV_SX, backdropFilter: "blur(10px)" }}
                    >
                        <ArchiveBrand />
                        <Box sx={{ ...countSx, color: UI_COLORS.textSecondary }}>biblioteca</Box>
                        <Box sx={{ flex: 1 }} />
                        {nickname && <Box sx={{ ...countSx, color: UI_COLORS.textSecondary }}>{nickname}</Box>}
                        <ArchiveExitMenu showLibrary={false} />
                    </Box>

                    <Box sx={{ flex: 1, minHeight: 0, overflow: "auto", ...CYBER_SCROLL_STYLE }}>
                        <Box
                            component="main"
                            sx={{
                                maxWidth: 1100,
                                mx: "auto",
                                p: { xs: "20px 16px", md: "28px 28px" },
                                display: "grid",
                                gridTemplateColumns: { xs: "minmax(0, 1fr)", md: "minmax(0, 1fr) minmax(0, 1fr)" },
                                gap: { xs: "28px", md: "32px" },
                                alignItems: "start",
                            }}
                        >
                            <Box component="section" aria-labelledby="hub-lores" sx={panelSx}>
                                <SectionHeader
                                    title={<span id="hub-lores">Lores</span>}
                                    count={loresLoading || loresError ? null : principals.length}
                                    action={principals.length > 0 ? newLoreButton("Nuevo Lore") : null}
                                />
                                <Box sx={{ display: "flex", flexDirection: "column", gap: "14px", mt: "14px" }}>
                                    {loresLoading && <Loading label="Cargando tus Lores…" />}
                                    {!loresLoading && loresError && (
                                        <Box sx={{ ...emptySx, color: "#ff8095" }}>{loresError}</Box>
                                    )}
                                    {!loresLoading && !loresError && principals.length === 0 && (
                                        <Box sx={emptySx}>
                                            Todavía no tienes Lores. Un Lore es el mundo escrito y existe sin campaña.
                                            <button
                                                type="button"
                                                className="submit-btn"
                                                onClick={() => setDialogOpen(true)}
                                                disabled={!uid}
                                                style={{ ...runningBorderBtnStyle, marginTop: 12, alignItems: "center" }}
                                            >
                                                <span /><span /><span /><span />
                                                <CyberTitle component="span" sx={{ fontSize: "1rem" }}>Crear el primero</CyberTitle>
                                            </button>
                                        </Box>
                                    )}
                                    {!loresLoading && !loresError && principals.map((lore) => (
                                        <LoreCard key={lore.id} lore={lore} highlighted={lore.id === justCreatedId} onOpen={openLore} />
                                    ))}
                                </Box>
                            </Box>

                            <Box component="section" aria-labelledby="hub-mesas" sx={panelSx}>
                                <SectionHeader
                                    title={<span id="hub-mesas">Mesas</span>}
                                    count={campaignsLoading || campaignsError ? null : campaigns.length}
                                    action={uid ? (
                                        <Box component="button" type="button" onClick={() => setMesaOpen(true)} sx={btnPriSx}>
                                            Nueva mesa
                                        </Box>
                                    ) : null}
                                />
                                <Box sx={{ display: "flex", flexDirection: "column", gap: "14px", mt: "14px" }}>
                                    {campaignsLoading && <Loading label="Cargando mesas…" />}
                                    {!campaignsLoading && campaignsError && (
                                        <Box sx={{ ...emptySx, color: "#ff8095" }}>{campaignsError}</Box>
                                    )}
                                    {!campaignsLoading && !campaignsError && campaigns.length === 0 && (
                                        <Box sx={emptySx}>Todavía no tienes mesas. Crear una también crea su Lore local.</Box>
                                    )}
                                    {!campaignsLoading && !campaignsError && campaigns.map((camp) => (
                                        <CampaignCard key={camp.id} campaign={camp} onEnter={enterCampaign} />
                                    ))}
                                </Box>
                            </Box>
                        </Box>
                    </Box>

                    <NewLoreDialog
                        open={dialogOpen}
                        onClose={() => setDialogOpen(false)}
                        onCreate={handleCreate}
                        takenSlugs={takenSlugs}
                    />
                    <NewMesaDialog
                        open={mesaOpen}
                        onClose={() => setMesaOpen(false)}
                        onCreate={handleCreateMesa}
                    />
                </Box>
            </StyledWrapper>
        </Box>
    );
}
