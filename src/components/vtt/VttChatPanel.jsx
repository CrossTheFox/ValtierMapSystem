import { useState, useEffect, useRef, useMemo } from "react";
import {
    Box, Paper, TextField, IconButton, Stack, Chip, Avatar, Autocomplete,
} from "@mui/material";
import SendIcon from "@mui/icons-material/Send";
import CloseIcon from "@mui/icons-material/Close";
import ChatIcon from "@mui/icons-material/Chat";
import { useDispatch, useSelector } from "react-redux";
import { CyberTitle, CyberText } from "../customs/CustomTexts";
import { UI_COLORS } from "../../constants/uiColors";
import { CYBER_SCROLL_STYLE } from "../../constants/cyberScrollStyle";
import GlossaryTextRenderer from "../shared/GlossaryTextRenderer";
import {
    sendChatMessage,
    CHAT_MESSAGE_TYPES,
} from "../../../firebase/services/chatService";
import { useAssetUrl } from "../../hooks/useAssetUrl";
import { listCampaignCharacters } from "../../utils/characterCombat";
import { setActiveCharacterId, persistActiveCharacter } from "../../store/playerSlice";

const MSG_BODY_SX = {
    fontSize: "0.8rem",
    color: UI_COLORS.textPrimary,
    lineHeight: 1.45,
};

const fieldSx = {
    "& .MuiOutlinedInput-root": {
        color: UI_COLORS.textPrimary,
        bgcolor: "rgba(0,0,0,0.35)",
        "& fieldset": { borderColor: UI_COLORS.border },
        "&:hover fieldset": { borderColor: `${UI_COLORS.anomaly}66` },
        "&.Mui-focused fieldset": { borderColor: UI_COLORS.anomaly },
    },
    "& input": {
        fontSize: "0.8rem",
        color: UI_COLORS.textPrimary,
        "&::placeholder": { color: UI_COLORS.textSecondary, opacity: 1 },
    },
};

/** Resuelve Storage / local / https desde la caché global (precargada al iniciar). */
function ChatAvatar({ path, name, accent, size = 26 }) {
    const src = useAssetUrl(path || null);

    return (
        <Avatar
            src={src || undefined}
            alt={name}
            imgProps={{
                decoding: "sync",
                loading: "eager",
            }}
            sx={{
                width: size,
                height: size,
                mt: size >= 26 ? 0.15 : 0,
                fontSize: size >= 26 ? "0.65rem" : "0.6rem",
                bgcolor: `${accent}33`,
                border: `1px solid ${accent}66`,
                color: accent,
            }}
        >
            {(name || "?").slice(0, 1).toUpperCase()}
        </Avatar>
    );
}

function ChatMessage({ msg, glossaryEntities, avatarByCharacterId }) {
    if (msg.type === CHAT_MESSAGE_TYPES.DICE) {
        return (
            <Box
                sx={{
                    mb: 0.75,
                    px: 1,
                    py: 0.65,
                    borderLeft: `3px solid ${UI_COLORS.anomaly}`,
                    bgcolor: "rgba(0,0,0,0.35)",
                    borderRadius: "0 4px 4px 0",
                }}
            >
                <CyberText sx={{ fontSize: "0.6rem", color: UI_COLORS.textSecondary, letterSpacing: 0.5 }}>
                    {msg.characterName || msg.senderName} · DADO
                </CyberText>
                <CyberText sx={{ fontSize: "0.82rem", color: UI_COLORS.anomaly }}>
                    {msg.diceFormula} → <strong style={{ color: "#fff" }}>{msg.diceResult?.total}</strong>
                    {msg.diceResult?.rolls?.length > 0 && (
                        <span style={{ color: UI_COLORS.textSecondary, fontSize: "0.72rem" }}>
                            {" "}[{msg.diceResult.rolls.join(", ")}
                            {msg.diceResult.mode === "highest"
                                ? " · máx"
                                : msg.diceResult.mode === "lowest"
                                    ? " · mín"
                                    : msg.diceResult.mod
                                        ? ` ${msg.diceResult.mod >= 0 ? "+" : ""}${msg.diceResult.mod}`
                                        : ""}]
                        </span>
                    )}
                </CyberText>
            </Box>
        );
    }

    if (msg.type === CHAT_MESSAGE_TYPES.ABILITY) {
        return (
            <Box
                sx={{
                    mb: 0.75,
                    px: 1,
                    py: 0.75,
                    border: `1px solid ${UI_COLORS.accent}55`,
                    borderLeft: `3px solid ${UI_COLORS.accent}`,
                    bgcolor: "rgba(0,0,0,0.4)",
                    borderRadius: "0 4px 4px 0",
                }}
            >
                <CyberText sx={{ fontSize: "0.6rem", color: UI_COLORS.textSecondary }}>
                    {msg.characterName || msg.senderName} · HABILIDAD
                </CyberText>
                <CyberTitle sx={{ fontSize: "0.75rem", color: UI_COLORS.accent, my: 0.35 }}>
                    {msg.abilityLabel}
                </CyberTitle>
                {msg.text && (
                    <GlossaryTextRenderer
                        text={msg.text}
                        entities={glossaryEntities}
                        sx={MSG_BODY_SX}
                    />
                )}
            </Box>
        );
    }

    if (msg.isOOC) {
        return (
            <Box
                sx={{
                    mb: 0.6,
                    px: 1,
                    py: 0.5,
                    borderLeft: `3px solid ${UI_COLORS.border}`,
                    bgcolor: "rgba(255,255,255,0.04)",
                    borderRadius: "0 4px 4px 0",
                }}
            >
                <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mb: 0.25 }}>
                    <Chip
                        label="OOC"
                        size="small"
                        sx={{
                            height: 16,
                            fontSize: "0.5rem",
                            letterSpacing: 1,
                            bgcolor: `${UI_COLORS.textSecondary}22`,
                            color: UI_COLORS.textSecondary,
                        }}
                    />
                    <CyberText sx={{ fontSize: "0.6rem", color: UI_COLORS.textSecondary }}>
                        {msg.senderName}
                    </CyberText>
                </Stack>
                <CyberText
                    sx={{
                        fontSize: "0.78rem",
                        color: "rgba(255,255,255,0.78)",
                        fontStyle: "italic",
                        lineHeight: 1.4,
                    }}
                >
                    {msg.text}
                </CyberText>
            </Box>
        );
    }

    const accent = UI_COLORS.anomaly;
    const displayName = msg.characterName || msg.senderName;
    const livePath = msg.characterId ? avatarByCharacterId?.get(msg.characterId) : null;
    const avatarPath = livePath || msg.characterAvatarUrl;

    return (
        <Box sx={{ mb: 0.7, display: "flex", gap: 0.75, alignItems: "flex-start" }}>
            <ChatAvatar
                path={avatarPath}
                name={displayName}
                accent={accent}
            />
            <Box
                sx={{
                    flex: 1,
                    minWidth: 0,
                    px: 1,
                    py: 0.45,
                    borderLeft: `3px solid ${accent}`,
                    bgcolor: "rgba(0,0,0,0.35)",
                    borderRadius: "0 4px 4px 0",
                }}
            >
                <CyberText
                    sx={{
                        fontSize: "0.62rem",
                        color: accent,
                        fontWeight: 700,
                        letterSpacing: 0.4,
                        mb: 0.15,
                    }}
                >
                    {displayName}
                    {msg.characterName && msg.senderName && msg.characterName !== msg.senderName && (
                        <span style={{ color: UI_COLORS.textSecondary, fontWeight: 400 }}>
                            {" "}· {msg.senderName}
                        </span>
                    )}
                </CyberText>
                <GlossaryTextRenderer
                    text={msg.text}
                    entities={glossaryEntities}
                    sx={MSG_BODY_SX}
                />
            </Box>
        </Box>
    );
}

/**
 * Chat panel for the right dock. Visibility controlled by parent (`open`).
 */
export default function VttChatPanel({
    open = false,
    onClose,
    messages = [],
    glossaryEntities = [],
}) {
    const dispatch = useDispatch();
    const [text, setText] = useState("");
    const scrollRef = useRef(null);

    const campaignId = useSelector((s) => s.world.selectedCampaignId);
    const profile = useSelector((s) => s.player.profile);
    const locations = useSelector((s) => s.world.locations);
    const charactersById = useSelector((s) => s.world.charactersById ?? {});
    const sheetCharacters = useSelector((s) => s.characters.list);

    const allCharactersById = useMemo(() => {
        const byId = new Map();
        // Sheet first; world roster overwrites (fresher imageUrl / placement).
        (sheetCharacters || []).forEach((c) => { if (c?.id) byId.set(c.id, c); });
        listCampaignCharacters(charactersById, locations).forEach((c) => {
            if (c?.id) byId.set(c.id, c);
        });
        return byId;
    }, [charactersById, locations, sheetCharacters]);

    const avatarByCharacterId = useMemo(() => {
        const map = new Map();
        allCharactersById.forEach((c, id) => {
            const path = c.tokenImageUrl || c.imageUrl;
            if (path) map.set(id, path);
        });
        return map;
    }, [allCharactersById]);

    const myCharacters = useMemo(() => {
        const all = [...allCharactersById.values()];
        const ownedIds = new Set(profile?.characterIds || []);
        const owned = all.filter(
            (c) => ownedIds.has(c.id) || c.ownerPlayerId === profile?.uid,
        );
        if (owned.length) {
            return owned.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
        }
        // Fallback: non-NPC roster if ownership links are missing
        return all
            .filter((c) => !c.isNpc && !c.isEnemy)
            .sort((a, b) => (a.name || "").localeCompare(b.name || ""));
    }, [allCharactersById, profile]);

    const activeCharacter = useMemo(() => {
        const id = profile?.activeCharacterId;
        if (!id) return myCharacters[0] || null;
        return myCharacters.find((c) => c.id === id) || myCharacters[0] || null;
    }, [profile?.activeCharacterId, myCharacters]);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages, open]);

    if (!open) return null;

    const handleSelectCharacter = (char) => {
        if (!char?.id) return;
        dispatch(setActiveCharacterId(char.id));
        if (profile?.uid) {
            dispatch(persistActiveCharacter({ uid: profile.uid, characterId: char.id }));
        }
    };

    const handleSend = async () => {
        const raw = text.trim();
        if (!raw || !campaignId) return;

        const isOOC = raw.startsWith("/");
        const body = isOOC ? raw.replace(/^\/\s*/, "").trim() : raw;
        if (!body) return;

        if (isOOC) {
            await sendChatMessage(campaignId, {
                type: CHAT_MESSAGE_TYPES.TEXT,
                text: body,
                senderId: profile?.uid,
                senderName: profile?.nickname ?? "Jugador",
                isOOC: true,
            });
        } else {
            await sendChatMessage(campaignId, {
                type: CHAT_MESSAGE_TYPES.TEXT,
                text: body,
                senderId: profile?.uid,
                senderName: profile?.nickname ?? "Jugador",
                characterId: activeCharacter?.id ?? null,
                characterName: activeCharacter?.name ?? null,
                characterAvatarUrl: activeCharacter?.tokenImageUrl || activeCharacter?.imageUrl || null,
                isOOC: false,
            });
        }
        setText("");
    };

    const placeholder = activeCharacter
        ? `Como ${activeCharacter.name}… (/ para OOC)`
        : "Mensaje… (/ para OOC)";

    return (
        <Paper
            elevation={0}
            data-no-token-drop
            sx={{
                flex: 1,
                minHeight: 0,
                width: "100%",
                bgcolor: `${UI_COLORS.backgroundSecondary}f2`,
                border: `1px solid ${UI_COLORS.border}`,
                borderRadius: 1,
                display: "flex",
                flexDirection: "column",
                overflow: "hidden",
                pointerEvents: "auto",
            }}
        >
            <Box
                sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: 1,
                    px: 1.25,
                    py: 0.6,
                    borderBottom: `1px solid ${UI_COLORS.border}`,
                    flexShrink: 0,
                }}
            >
                <ChatIcon sx={{ fontSize: "1rem", color: UI_COLORS.anomaly }} />
                <CyberTitle sx={{ fontSize: "0.68rem", color: UI_COLORS.anomaly, letterSpacing: 2, flex: 1 }}>
                    CHAT
                </CyberTitle>
                <IconButton
                    size="small"
                    onClick={onClose}
                    sx={{ color: UI_COLORS.textSecondary, p: 0.25 }}
                    aria-label="Cerrar chat"
                >
                    <CloseIcon sx={{ fontSize: "1rem" }} />
                </IconButton>
            </Box>

            <Box
                ref={scrollRef}
                sx={{
                    flex: 1,
                    minHeight: 0,
                    overflowY: "auto",
                    px: 1.25,
                    py: 1,
                    ...CYBER_SCROLL_STYLE,
                }}
            >
                {messages.map((m) => (
                    <ChatMessage
                        key={m.id}
                        msg={m}
                        glossaryEntities={glossaryEntities}
                        avatarByCharacterId={avatarByCharacterId}
                    />
                ))}
            </Box>

            <Box
                sx={{
                    px: 1,
                    py: 0.65,
                    borderTop: `1px solid ${UI_COLORS.border}`,
                    bgcolor: "rgba(0,0,0,0.25)",
                    flexShrink: 0,
                }}
            >
                <CyberText sx={{ fontSize: "0.52rem", color: UI_COLORS.textSecondary, mb: 0.4, letterSpacing: 0.6 }}>
                    HABLANDO COMO
                </CyberText>
                <Autocomplete
                    size="small"
                    options={myCharacters}
                    value={activeCharacter}
                    onChange={(_, char) => handleSelectCharacter(char)}
                    getOptionLabel={(c) => c?.name || c?.id || ""}
                    isOptionEqualToValue={(a, b) => a?.id === b?.id}
                    disableClearable
                    noOptionsText="Sin personajes"
                    slotProps={{
                        paper: {
                            sx: {
                                bgcolor: UI_COLORS.backgroundSecondary,
                                border: `1px solid ${UI_COLORS.border}`,
                                "& .MuiAutocomplete-option": {
                                    fontSize: "0.78rem",
                                    color: UI_COLORS.textPrimary,
                                },
                            },
                        },
                    }}
                    renderOption={(props, option) => (
                        <Box component="li" {...props} key={option.id} sx={{ display: "flex", gap: 1, alignItems: "center" }}>
                            <ChatAvatar
                                path={option.tokenImageUrl || option.imageUrl}
                                name={option.name}
                                accent={UI_COLORS.anomaly}
                                size={22}
                            />
                            <span>{option.name}</span>
                        </Box>
                    )}
                    renderInput={(params) => (
                        <TextField
                            {...params}
                            placeholder="Buscar personaje…"
                            sx={{
                                ...fieldSx,
                                "& input": { ...fieldSx["& input"], fontSize: "0.75rem", py: 0.5 },
                            }}
                        />
                    )}
                />
            </Box>

            <Stack direction="row" spacing={0.5} sx={{ px: 1, py: 1, flexShrink: 0 }}>
                <TextField
                    size="small"
                    fullWidth
                    placeholder={placeholder}
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            handleSend();
                        }
                    }}
                    sx={fieldSx}
                />
                <IconButton
                    size="small"
                    onClick={handleSend}
                    disabled={!text.trim()}
                    sx={{ color: UI_COLORS.accent }}
                >
                    <SendIcon fontSize="small" />
                </IconButton>
            </Stack>
        </Paper>
    );
}
