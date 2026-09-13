import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Box, IconButton } from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import { CyberTitle } from "../customs/CustomTexts";
import { UI_COLORS } from "../../constants/uiColors";
import { Z_INDEX } from "../../constants/designSystem";
import { VTT_HUD } from "../../constants/vttHudTokens";
import { useCharacterSpotlight } from "../../hooks/useCharacterSpotlight";
import { useAssetUrl } from "../../hooks/useAssetUrl";
import { resolveCharacterSpotlightPath } from "../../utils/resolveCharacterSpotlightMedia";

const FADE_MS = 840;
const FADE_MS_REDUCED = 240;

function fadeDurationMs() {
    if (typeof window === "undefined") return FADE_MS;
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? FADE_MS_REDUCED
        : FADE_MS;
}

function cancelOpacityAnimations(el) {
    el.getAnimations?.().forEach((anim) => anim.cancel());
}

function armHidden(el) {
    if (!el) return;
    cancelOpacityAnimations(el);
    el.style.opacity = "0";
    el.style.pointerEvents = "none";
}

/** WAAPI fade — not blocked by MUI `transition: none !important` in sx. */
function animateOpacity(el, from, to, { onDone } = {}) {
    if (!el) return null;
    cancelOpacityAnimations(el);
    el.style.opacity = String(from);

    if (from === to) {
        onDone?.();
        return null;
    }

    const duration = fadeDurationMs();
    const anim = el.animate(
        [{ opacity: from }, { opacity: to }],
        { duration, easing: "ease", fill: "forwards" },
    );

    anim.onfinish = () => {
        el.style.opacity = String(to);
        onDone?.();
    };

    return anim;
}

/**
 * Full-screen DM character reveal — Roll20-style banner spotlight for all players.
 * Shell stays mounted; fade in/out uses Web Animations API (imperative, reliable).
 */
export default function CharacterSpotlightOverlay() {
    const { spotlight, isActive, dismiss } = useCharacterSpotlight();
    const [displayed, setDisplayed] = useState(null);
    const rootRef = useRef(null);
    const closingRef = useRef(false);
    const enterAnimRef = useRef(null);
    const exitAnimRef = useRef(null);

    const mediaPath = displayed ? resolveCharacterSpotlightPath(displayed) : null;
    const imageUrl = useAssetUrl(mediaPath);
    const name = (displayed?.characterName || "PERSONAJE").toUpperCase();

    useLayoutEffect(() => {
        const el = rootRef.current;
        if (!el) return undefined;

        if (!isActive || !spotlight?.id) {
            if (!closingRef.current) {
                enterAnimRef.current?.cancel();
                enterAnimRef.current = null;
                setDisplayed(null);
                armHidden(el);
            }
            return undefined;
        }

        closingRef.current = false;
        setDisplayed(spotlight);
        armHidden(el);
        el.style.pointerEvents = "auto";
        return undefined;
    }, [isActive, spotlight?.id]);

    useEffect(() => {
        const el = rootRef.current;
        if (!el || !displayed?.id || closingRef.current) return undefined;

        enterAnimRef.current?.cancel();
        el.style.opacity = "0";

        const raf = requestAnimationFrame(() => {
            enterAnimRef.current = animateOpacity(el, 0, 1);
        });

        return () => {
            cancelAnimationFrame(raf);
            enterAnimRef.current?.cancel();
            enterAnimRef.current = null;
        };
    }, [displayed?.id]);

    const fadeOutAndDismiss = useCallback(() => {
        const el = rootRef.current;
        if (closingRef.current || !el || !displayed) return;
        closingRef.current = true;
        enterAnimRef.current?.cancel();
        enterAnimRef.current = null;

        const currentOpacity = Number.parseFloat(getComputedStyle(el).opacity) || 1;
        exitAnimRef.current?.cancel();
        exitAnimRef.current = animateOpacity(el, currentOpacity, 0, {
            onDone: () => {
                dismiss();
                setDisplayed(null);
                closingRef.current = false;
                exitAnimRef.current = null;
                armHidden(el);
            },
        });
    }, [dismiss, displayed]);

    useEffect(() => {
        if (!displayed) return undefined;
        const onKey = (e) => {
            if (e.code === "Escape") {
                e.preventDefault();
                fadeOutAndDismiss();
            }
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [displayed, fadeOutAndDismiss]);

    useEffect(() => () => {
        enterAnimRef.current?.cancel();
        exitAnimRef.current?.cancel();
    }, []);

    const handleBackdropClick = useCallback((e) => {
        if (e.target === e.currentTarget) fadeOutAndDismiss();
    }, [fadeOutAndDismiss]);

    return (
        <Box
            ref={rootRef}
            role="dialog"
            aria-hidden={!displayed}
            aria-label={displayed ? `Mostrar personaje: ${name}` : undefined}
            aria-modal={Boolean(displayed)}
            onClick={handleBackdropClick}
            sx={{
                position: "fixed",
                inset: 0,
                zIndex: Z_INDEX.characterSpotlight,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                bgcolor: "rgba(4,4,8,0.88)",
                backdropFilter: "blur(8px)",
                WebkitBackdropFilter: "blur(8px)",
                pointerEvents: "none",
            }}
        >
            {displayed ? (
                <>
                    <IconButton
                        onClick={fadeOutAndDismiss}
                        aria-label="Cerrar"
                        sx={{
                            position: "absolute",
                            top: 16,
                            right: 16,
                            color: UI_COLORS.textPrimary,
                            border: `1px solid ${VTT_HUD.glassBorder}`,
                            bgcolor: "rgba(10,10,15,0.85)",
                            "&:hover": {
                                color: UI_COLORS.accent,
                                borderColor: UI_COLORS.accent,
                                bgcolor: `${UI_COLORS.accent}18`,
                            },
                        }}
                    >
                        <CloseIcon />
                    </IconButton>

                    <Box
                        sx={{
                            position: "relative",
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            gap: 2,
                            px: 2,
                            maxWidth: "96vw",
                        }}
                    >
                        <Box
                            sx={{
                                position: "relative",
                                p: "3px",
                                clipPath: "polygon(0 0, calc(100% - 18px) 0, 100% 18px, 100% 100%, 18px 100%, 0 calc(100% - 18px))",
                                background: `linear-gradient(135deg, ${UI_COLORS.accent}, ${UI_COLORS.anomaly}, ${UI_COLORS.accent})`,
                                boxShadow: `0 0 32px ${UI_COLORS.accentGlow}, 0 0 16px ${UI_COLORS.anomaly}33`,
                            }}
                        >
                            <Box
                                sx={{
                                    position: "relative",
                                    bgcolor: "rgba(8,8,14,0.98)",
                                    clipPath: "polygon(0 0, calc(100% - 16px) 0, 100% 16px, 100% 100%, 16px 100%, 0 calc(100% - 16px))",
                                    overflow: "hidden",
                                    minWidth: imageUrl ? undefined : "min(92vw, 960px)",
                                    minHeight: imageUrl ? undefined : "min(40vh, 400px)",
                                }}
                            >
                                {imageUrl ? (
                                    <Box
                                        component="img"
                                        src={imageUrl}
                                        alt={name}
                                        sx={{
                                            display: "block",
                                            maxWidth: "min(92vw, 960px)",
                                            maxHeight: "78vh",
                                            width: "auto",
                                            height: "auto",
                                            objectFit: "contain",
                                        }}
                                    />
                                ) : mediaPath ? (
                                    <Box
                                        sx={{
                                            width: "min(92vw, 960px)",
                                            height: "min(78vh, 640px)",
                                        }}
                                    />
                                ) : (
                                    <Box
                                        sx={{
                                            width: "min(92vw, 960px)",
                                            height: "min(40vh, 400px)",
                                            display: "grid",
                                            placeItems: "center",
                                            fontFamily: "Orbitron, sans-serif",
                                            fontSize: "0.85rem",
                                            color: UI_COLORS.textSecondary,
                                            letterSpacing: "0.18em",
                                        }}
                                    >
                                        SIN IMAGEN
                                    </Box>
                                )}
                            </Box>
                        </Box>

                        <CyberTitle
                            sx={{
                                fontSize: "clamp(0.75rem, 2vw, 1.1rem)",
                                letterSpacing: "0.22em",
                                color: UI_COLORS.textPrimary,
                                textAlign: "center",
                                textShadow: `0 0 18px ${UI_COLORS.anomaly}88`,
                            }}
                        >
                            {name}
                        </CyberTitle>
                    </Box>
                </>
            ) : null}
        </Box>
    );
}
