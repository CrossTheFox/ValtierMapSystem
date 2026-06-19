import React, { useEffect, useState, useMemo } from "react";
import { Box, CircularProgress, Stack, Paper } from "@mui/material";
import { CyberTitle, CyberText } from "../../../customs/CustomTexts";
import { UI_COLORS } from "../../../../constants/uiColors";
import { getAbilitiesByIds } from "../../../../../firebase/services/characterService";
import { getClaseDocsByIds, getAbilityKeysForClase } from "../../../../../firebase/services/classService";
import { buildTreeData } from "./skillMatrixUtils";

const laneColor = (arch) => {
    const a = (arch || "").toLowerCase();
    if (a === "wright") return UI_COLORS.anomaly;
    if (a === "stalwart") return "#ff4466";
    if (a === "vagabond") return "#ffcc00";
    if (a === "mendicant") return "#55ffaa";
    return UI_COLORS.accent;
};

const MiniDiamond = ({ label, hot, accent }) => (
    <Box
        sx={{
            width: 40,
            height: 40,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            border: `2px solid ${hot ? accent : "#2a2a3d"}`,
            transform: "rotate(45deg)",
            bgcolor: hot ? `${accent}22` : "rgba(0,0,0,0.35)",
            boxShadow: hot ? `0 0 12px ${accent}55` : "none",
            mx: "auto",
        }}
    >
        <CyberTitle sx={{ transform: "rotate(-45deg)", fontSize: "0.5rem", textAlign: "center", lineHeight: 1 }}>
            {(label || "").slice(0, 3).toUpperCase()}
        </CyberTitle>
    </Box>
);

function MiniLane({ title, accent, treeData, checkUnlocked }) {
    if (!treeData) {
        return (
            <Paper elevation={0} sx={{ p: 2, flex: 1, minWidth: 140, bgcolor: "rgba(0,0,0,0.2)", border: `1px solid ${UI_COLORS.border}` }}>
                <CyberText sx={{ color: "rgba(255,255,255,0.5)", fontSize: "0.75rem" }}>Vacío</CyberText>
            </Paper>
        );
    }

    return (
        <Paper
            elevation={0}
            sx={{
                flex: 1,
                minWidth: 160,
                p: 1.5,
                bgcolor: "rgba(0,0,0,0.28)",
                border: `1px solid ${accent}44`,
                borderTop: `3px solid ${accent}`,
                borderRadius: 1,
            }}
        >
            <CyberTitle sx={{ fontSize: "0.75rem", color: accent, mb: 1.5, letterSpacing: 1 }}>{title}</CyberTitle>
            <Stack spacing={1.25} alignItems="stretch">
                {treeData.limitBreak ? (
                    <Box>
                        <CyberText sx={{ fontSize: "0.6rem", color: "#ff0055", mb: 0.5 }}>LB</CyberText>
                        <MiniDiamond label={treeData.limitBreak.label} hot={checkUnlocked(treeData.limitBreak.key)} accent="#ff0055" />
                    </Box>
                ) : null}
                {treeData.traits.length ? (
                    <Box>
                        <CyberText sx={{ fontSize: "0.6rem", color: "#ff66ff", mb: 0.5 }}>TR</CyberText>
                        <Stack spacing={0.75}>
                            {treeData.traits.map((t) => (
                                <MiniDiamond key={t.id} label={t.label} hot={checkUnlocked(t.key)} accent="#ff00ff" />
                            ))}
                        </Stack>
                    </Box>
                ) : null}
                {treeData.abilities.length ? (
                    <Box>
                        <CyberText sx={{ fontSize: "0.6rem", color: accent, mb: 0.5 }}>ACT</CyberText>
                        <Stack spacing={0.75}>
                            {treeData.abilities.map((a) => (
                                <MiniDiamond key={a.id} label={a.label} hot={checkUnlocked(a.key)} accent={accent} />
                            ))}
                        </Stack>
                    </Box>
                ) : null}
            </Stack>
        </Paper>
    );
}

export default function SkillMatrixTriLane({ character }) {
    const [loading, setLoading] = useState(true);
    const [lanes, setLanes] = useState(/** @type {Array<{ id: string, title: string, arch: string, keys: string[] }>} */ ([]));
    const [byKey, setByKey] = useState(/** @type {Record<string, unknown>} */ ({}));

    const assigned = character?.assignedClassIds;
    const assignedKey = Array.isArray(assigned) ? assigned.join(",") : "";

    useEffect(() => {
        let cancelled = false;

        async function run() {
            if (!Array.isArray(assigned) || assigned.length === 0) {
                setLanes([]);
                setByKey({});
                setLoading(false);
                return;
            }

            setLoading(true);
            try {
                const meta = await getClaseDocsByIds(assigned);
                const metaById = Object.fromEntries(meta.map((m) => [m.id, m]));
                const laneDefs = [];

                for (const id of assigned) {
                    const keys = await getAbilityKeysForClase(id);
                    const m = metaById[id] || {};
                    laneDefs.push({
                        id,
                        title: (m.displayName || id).toUpperCase(),
                        arch: m.classArchetype || "wright",
                        keys,
                    });
                }

                const uniq = [...new Set(laneDefs.flatMap((l) => l.keys))];
                const abs = uniq.length ? await getAbilitiesByIds(uniq) : [];
                const map = Object.fromEntries(abs.map((a) => [a.key || a.id, a]));

                if (!cancelled) {
                    setLanes(laneDefs);
                    setByKey(map);
                    setLoading(false);
                }
            } catch {
                if (!cancelled) {
                    setLanes([]);
                    setByKey({});
                    setLoading(false);
                }
            }
        }

        run();
        return () => {
            cancelled = true;
        };
    }, [character?.id, assignedKey]);

    const unlocked = character?.unlockedAbilities;
    const checkUnlocked = (key) => unlocked?.includes(key);

    const laneTrees = useMemo(() => {
        return lanes.map((lane) => {
            const abs = lane.keys.map((k) => byKey[k]).filter(Boolean);
            return buildTreeData(abs, unlocked);
        });
    }, [lanes, byKey, unlocked]);

    if (loading) return <CircularProgress sx={{ display: "block", m: "auto", color: UI_COLORS.accent }} />;

    if (!lanes.length) {
        return (
            <Box sx={{ py: 2 }}>
                <CyberText sx={{ fontSize: "0.72rem", color: UI_COLORS.anomaly, letterSpacing: 2, mb: 2, display: "block" }}>
                    // PROPUESTA C — TRES RAÍLES (requiere `assignedClassIds` en el personaje)
                </CyberText>
                <CyberText sx={{ color: "rgba(255,255,255,0.6)", textAlign: "center", py: 3 }}>
                    Este personaje aún no tiene clases asignadas en Firestore. Tras el seed verás hasta 3 columnas (job primario + stubs).
                </CyberText>
            </Box>
        );
    }

    return (
        <Box sx={{ py: 2 }}>
            <CyberText sx={{ fontSize: "0.72rem", color: UI_COLORS.anomaly, letterSpacing: 2, mb: 2, display: "block" }}>
                // PROPUESTA C — UNA COLUMNA POR CLASE (multiclass ICON)
            </CyberText>
            <Stack direction={{ xs: "column", md: "row" }} spacing={2} alignItems="stretch">
                {lanes.map((lane, i) => (
                    <MiniLane
                        key={lane.id}
                        title={lane.title}
                        accent={laneColor(lane.arch)}
                        treeData={laneTrees[i]}
                        checkUnlocked={checkUnlocked}
                    />
                ))}
            </Stack>
        </Box>
    );
}
