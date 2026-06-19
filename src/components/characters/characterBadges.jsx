import { Box } from "@mui/material";

export const STATUS_CONFIG = {
    alive:      { label: "ALIVE",      color: "#00f2ea" },
    dead:       { label: "DEAD",       color: "#888888" },
    deity:      { label: "DEITY",      color: "#f5c842" },
    legendary:  { label: "LEGENDARY",  color: "#ff66ff" },
    unassigned: { label: "UNASSIGNED", color: "#f97316" },
};

export const TYPE_BADGE = {
    pc:  { label: "PC",  color: "#a78bfa", border: "rgba(167,139,250,0.35)", bg: "rgba(167,139,250,0.1)" },
    npc: { label: "NPC", color: "#94a3b8", border: "rgba(148,163,184,0.3)", bg: "rgba(148,163,184,0.08)" },
};

export function CharacterStatusBadge({ status }) {
    const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.alive;
    return (
        <Box
            component="span"
            sx={{
                fontFamily: "'Fira Code', monospace",
                fontSize: "8px",
                letterSpacing: "0.08em",
                px: 0.75,
                py: 0.25,
                borderRadius: 0.5,
                border: `1px solid ${cfg.color}55`,
                color: cfg.color,
                bgcolor: `${cfg.color}14`,
            }}
        >
            {cfg.label}
        </Box>
    );
}

export function CharacterTypeBadge({ type }) {
    const t = (type || "npc").toLowerCase();
    const cfg = t === "pc" ? TYPE_BADGE.pc : TYPE_BADGE.npc;
    return (
        <Box
            component="span"
            sx={{
                fontFamily: "'Fira Code', monospace",
                fontSize: "8px",
                letterSpacing: "0.08em",
                px: 0.75,
                py: 0.25,
                borderRadius: 0.5,
                border: `1px solid ${cfg.border}`,
                color: cfg.color,
                bgcolor: cfg.bg,
            }}
        >
            {cfg.label}
        </Box>
    );
}

export function statusLineColor(status) {
    return (STATUS_CONFIG[status] || STATUS_CONFIG.alive).color;
}

export function avatarBorderSx(status) {
    const color = statusLineColor(status);
    const sx = { border: `2px solid ${color}` };
    if (status === "dead") {
        sx.filter = "grayscale(0.7)";
        sx.border = "2px solid #333344";
    }
    if (status === "deity") {
        sx.boxShadow = "0 0 10px rgba(245,200,66,0.3)";
    }
    return sx;
}
