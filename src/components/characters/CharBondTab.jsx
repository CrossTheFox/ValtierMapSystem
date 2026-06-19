import { Box, Stack, Divider, Paper, Grid } from "@mui/material";

import { CyberTitle, CyberText } from "../customs/CustomTexts";
import { emptyBond } from "../../constants/statSystem";
import { UI_COLORS } from "../../constants/uiColors";

const TXT = { color: "rgba(255,255,255,0.92)" };
const TXT_MUTED = { color: "rgba(255,255,255,0.55)" };

export default function CharBondTab({ character }) {
    const b = character?.bond && typeof character.bond === "object" ? character.bond : emptyBond();
    const list = Array.isArray(character?.bondPowers) ? character.bondPowers : [];

    return (
        <Grid container sx={{ p: { xs: 2, sm: 3 } }}>
            <Grid size={{ xs: 12, md: 8 }} sx={{ pr: { md: 2 }, borderRight: { md: `1px solid ${UI_COLORS.border}` } }}>
                <Stack spacing={2.5}>
                    <Box>
                        <CyberText sx={{ ...TXT_MUTED, fontSize: "0.58rem", letterSpacing: "0.14em", mb: 0.75, display: "block" }}>
                            BOND NAME
                        </CyberText>
                        <CyberTitle sx={{ fontSize: "1rem", letterSpacing: "0.1em", color: UI_COLORS.accent }}>
                            {(b.name || "—").toUpperCase()}
                        </CyberTitle>
                    </Box>
                    {b.archetype && (
                        <Box>
                            <CyberText sx={{ ...TXT_MUTED, fontSize: "0.58rem", letterSpacing: "0.14em", mb: 0.75, display: "block" }}>
                                ARQUETIPO
                            </CyberText>
                            <CyberText sx={{ ...TXT, lineHeight: 1.6, fontSize: "0.85rem" }}>{b.archetype}</CyberText>
                        </Box>
                    )}
                    {b.description && (
                        <Box>
                            <CyberText sx={{ ...TXT_MUTED, fontSize: "0.58rem", letterSpacing: "0.14em", mb: 0.75, display: "block" }}>
                                DESCRIPCIÓN
                            </CyberText>
                            <CyberText sx={{ ...TXT, lineHeight: 1.6, fontSize: "0.85rem" }}>{b.description}</CyberText>
                        </Box>
                    )}
                    {b.ideals?.length > 0 && (
                        <Box>
                            <CyberText sx={{ ...TXT_MUTED, fontSize: "0.58rem", letterSpacing: "0.14em", mb: 0.75, display: "block" }}>
                                IDEALS
                            </CyberText>
                            <Box sx={{ pl: 1.5, borderLeft: `2px solid ${UI_COLORS.border}` }}>
                                <Stack spacing={0.75}>
                                    {b.ideals.map((line, i) => (
                                        <CyberText key={i} sx={{ ...TXT, lineHeight: 1.55, fontSize: "0.85rem" }}>
                                            {line}
                                        </CyberText>
                                    ))}
                                </Stack>
                            </Box>
                        </Box>
                    )}
                    {b.notes && (
                        <Box>
                            <CyberText sx={{ ...TXT_MUTED, fontSize: "0.58rem", letterSpacing: "0.14em", mb: 0.75, display: "block" }}>
                                NOTES
                            </CyberText>
                            <CyberText sx={{ ...TXT, lineHeight: 1.6, fontSize: "0.85rem" }}>{b.notes}</CyberText>
                        </Box>
                    )}
                    {!b.name && !b.description && !b.ideals?.length && (
                        <CyberText sx={{ ...TXT_MUTED, fontSize: "0.85rem" }}>No bond data on this character.</CyberText>
                    )}
                </Stack>
            </Grid>
            <Grid size={{ xs: 12, md: 4 }} sx={{ pl: { md: 2 }, pt: { xs: 2, md: 0 } }}>
                <Stack spacing={2}>
                    <Box>
                        <CyberText sx={{ ...TXT_MUTED, fontSize: "0.58rem", letterSpacing: "0.14em", mb: 0.75, display: "block" }}>
                            SPECIAL ABILITY
                        </CyberText>
                        <CyberText sx={{ ...TXT, lineHeight: 1.55, fontSize: "0.85rem" }}>
                            {b.specialAbility || "—"}
                        </CyberText>
                    </Box>
                    <Box>
                        <CyberText sx={{ ...TXT_MUTED, fontSize: "0.58rem", letterSpacing: "0.14em", mb: 0.75, display: "block" }}>
                            SECOND WIND
                        </CyberText>
                        <CyberText sx={{ ...TXT, lineHeight: 1.55, fontSize: "0.85rem" }}>
                            {b.secondWind || "—"}
                        </CyberText>
                    </Box>
                    <Divider sx={{ borderColor: UI_COLORS.border }} />
                    <Box>
                        <CyberText sx={{ color: UI_COLORS.accent, letterSpacing: "0.12em", fontSize: "0.72rem", mb: 1.25, display: "block" }}>
                            {"// BOND POWERS"}
                        </CyberText>
                        {list.length === 0 ? (
                            <CyberText sx={{ ...TXT_MUTED, fontSize: "0.85rem" }}>No bond powers.</CyberText>
                        ) : (
                            <Stack spacing={1.25}>
                                {list.map((p, idx) => (
                                    <Paper
                                        key={p.id || p.key || idx}
                                        elevation={0}
                                        sx={{
                                            p: 1.5,
                                            bgcolor: "rgba(255,255,255,0.02)",
                                            border: `1px solid ${UI_COLORS.border}`,
                                            borderRadius: 1,
                                        }}
                                    >
                                        <Box sx={{ display: "flex", justifyContent: "space-between", gap: 1, mb: 0.5, flexWrap: "wrap" }}>
                                            <CyberTitle sx={{ fontSize: "0.75rem", color: UI_COLORS.accent }}>
                                                {(p.name || p.label || `POWER_${idx + 1}`).toUpperCase()}
                                            </CyberTitle>
                                            {p.frequency && (
                                                <CyberText sx={{ fontSize: "0.62rem", color: UI_COLORS.anomaly }}>{p.frequency}</CyberText>
                                            )}
                                        </Box>
                                        {(p.description || p.content) && (
                                            <CyberText sx={{ ...TXT, lineHeight: 1.5, fontSize: "0.8rem" }}>
                                                {p.description || p.content}
                                            </CyberText>
                                        )}
                                    </Paper>
                                ))}
                            </Stack>
                        )}
                    </Box>
                </Stack>
            </Grid>
        </Grid>
    );
}
