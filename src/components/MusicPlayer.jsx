import { useCallback, useEffect, useRef, useState } from "react";
import { useSelector } from "react-redux";
import {
    Box,
    IconButton,
    Slider,
    Select,
    MenuItem,
    Tooltip,
    Collapse,
} from "@mui/material";
import PlayArrowIcon   from "@mui/icons-material/PlayArrow";
import PauseIcon       from "@mui/icons-material/Pause";
import StopIcon        from "@mui/icons-material/Stop";
import VolumeUpIcon    from "@mui/icons-material/VolumeUp";
import VolumeOffIcon   from "@mui/icons-material/VolumeOff";
import MusicNoteIcon   from "@mui/icons-material/MusicNote";
import ExpandMoreIcon  from "@mui/icons-material/ExpandMore";
import HeadphonesIcon  from "@mui/icons-material/Headphones";

import { loadFirebaseAsset } from "../../firebase/services/assetLoader";
import { updateMusic, listMusicTracks } from "../../firebase/services/gameService";
import { UI_COLORS } from "../constants/uiColors";

const VOLUME_KEY = "musicPlayer_volume";

const fmt = (sec) => {
    if (!isFinite(sec) || sec < 0) return "0:00";
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${String(s).padStart(2, "0")}`;
};

const btnSx = (accent, danger = false) => ({
    p: 0.5,
    color: danger ? "#ff4d4d" : accent,
    border: `1px solid ${danger ? "#ff4d4d44" : `${accent}40`}`,
    borderRadius: 0.5,
    "&:hover": {
        bgcolor: danger ? "rgba(255,50,50,0.1)" : `${accent}18`,
        borderColor: danger ? "#ff4d4d" : accent,
    },
    "&.Mui-disabled": {
        color: "rgba(255,255,255,0.2)",
        borderColor: "rgba(255,255,255,0.1)",
    },
});

export default function MusicPlayer() {
    const music      = useSelector((s) => s.game?.music ?? null);
    const campaignId = useSelector((s) => s.world.selectedCampaignId);
    const accent     = UI_COLORS.accent || "#ff66ff";

    const audioRef    = useRef(null);
    const urlCacheRef = useRef({});

    const [tracks,        setTracks]        = useState([]);
    const [selectedPath,  setSelectedPath]  = useState("");
    const [volume,        setVolume]        = useState(() => {
        const s = localStorage.getItem(VOLUME_KEY);
        return s ? parseFloat(s) : 0.8;
    });
    const [localTime,  setLocalTime]  = useState(0);
    const [duration,   setDuration]   = useState(0);
    const [expanded,   setExpanded]   = useState(false);
    // When browser autoplay is blocked the audio won't start automatically
    const [needsGesture, setNeedsGesture] = useState(false);

    // ── Create audio element once ─────────────────────────────────
    useEffect(() => {
        const audio   = new Audio();
        audio.volume  = volume;
        audio.preload = "metadata";
        audioRef.current = audio;

        audio.addEventListener("loadedmetadata", () => setDuration(audio.duration || 0));
        audio.addEventListener("ended", () => setLocalTime(0));

        return () => {
            audio.pause();
            audio.src = "";
        };
        // volume intentionally excluded — synced in a separate effect
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // ── Volume → audio element + localStorage ─────────────────────
    useEffect(() => {
        if (audioRef.current) audioRef.current.volume = volume;
        localStorage.setItem(VOLUME_KEY, String(volume));
    }, [volume]);

    // ── Load track list from Storage ──────────────────────────────
    useEffect(() => {
        listMusicTracks()
            .then(setTracks)
            .catch(() => setTracks([]));
    }, []);

    // ── Keep selectedPath in sync with Firestore track ────────────
    useEffect(() => {
        if (music?.trackPath) setSelectedPath(music.trackPath);
    }, [music?.trackPath]);

    // ── Helper: get/cache download URL ───────────────────────────
    const getUrl = useCallback(async (path) => {
        if (!urlCacheRef.current[path]) {
            urlCacheRef.current[path] = await loadFirebaseAsset(path);
        }
        return urlCacheRef.current[path];
    }, []);

    // ── React to Firestore music changes ──────────────────────────
    // Each effect invocation gets a `cancelled` flag so that stale async
    // operations (e.g. a previous track load that finishes late) can never
    // override a newer stop/pause command.
    useEffect(() => {
        const audio = audioRef.current;
        if (!audio) return;

        let cancelled = false;

        const apply = async () => {
            // ── No music at all → reset ───────────────────────────
            if (!music) {
                audio.pause();
                audio.currentTime = 0;
                setNeedsGesture(false);
                return;
            }

            // ── Load / switch track ───────────────────────────────
            if (music.trackPath) {
                let url;
                try {
                    url = await getUrl(music.trackPath);
                } catch (err) {
                    if (!cancelled) console.error("MusicPlayer: URL fetch failed", err);
                    return;
                }
                if (cancelled) return; // status may have changed while fetching URL

                if (audio.src !== url) {
                    audio.src = url;
                    try {
                        await new Promise((resolve, reject) => {
                            const onCanPlay = () => {
                                audio.removeEventListener("canplay", onCanPlay);
                                audio.removeEventListener("error",   onError);
                                resolve();
                            };
                            const onError = () => {
                                audio.removeEventListener("canplay", onCanPlay);
                                audio.removeEventListener("error",   onError);
                                reject(new Error("Audio load error"));
                            };
                            audio.addEventListener("canplay", onCanPlay);
                            audio.addEventListener("error",   onError);
                            audio.load();
                        });
                    } catch (err) {
                        if (!cancelled) console.error("MusicPlayer: track load failed", err);
                        return;
                    }
                    if (cancelled) return; // status may have changed while track loaded
                    setDuration(isFinite(audio.duration) ? audio.duration : 0);
                }
            }

            if (cancelled) return; // final guard before touching playback state

            // ── Apply playback status ─────────────────────────────
            if (music.status === "playing") {
                const posMs  = Date.now() - (music.startedAt ?? Date.now());
                const posSec = Math.max(0, posMs / 1000);
                // Seek if more than 1.5 s off (syncs late-joiners; no glitch for the clicker)
                if (Math.abs(audio.currentTime - posSec) > 1.5) {
                    audio.currentTime = posSec;
                }
                if (audio.paused) {
                    audio.play().catch(() => { if (!cancelled) setNeedsGesture(true); });
                }
                setNeedsGesture(false);
            } else if (music.status === "paused") {
                audio.currentTime = (music.pausedAt ?? 0) / 1000;
                audio.pause();
                setNeedsGesture(false);
            } else {
                // stopped
                audio.pause();
                audio.currentTime = 0;
                setLocalTime(0);
                setNeedsGesture(false);
            }
        };

        apply();

        // Cancels any in-flight awaits when music changes again
        return () => { cancelled = true; };
    }, [music, getUrl]);

    // ── Progress bar update while playing ────────────────────────
    useEffect(() => {
        if (music?.status !== "playing") return;
        const id = setInterval(() => {
            if (audioRef.current) setLocalTime(audioRef.current.currentTime);
        }, 500);
        return () => clearInterval(id);
    }, [music?.status]);

    // ── Handlers ──────────────────────────────────────────────────
    const handlePlay = useCallback(async () => {
        if (!selectedPath || !campaignId) return;
        const trackName = tracks.find((t) => t.path === selectedPath)?.name ?? selectedPath;
        const resumeAt  = music?.status === "paused" ? (music.pausedAt ?? 0) : 0;
        await updateMusic(campaignId, {
            trackPath:  selectedPath,
            trackName,
            status:     "playing",
            startedAt:  Date.now() - resumeAt,
            pausedAt:   null,
        }).catch(console.error);
    }, [selectedPath, campaignId, tracks, music]);

    const handlePause = useCallback(async () => {
        if (!campaignId || music?.status !== "playing") return;
        const pausedAt = Math.max(0, Date.now() - (music.startedAt ?? Date.now()));
        await updateMusic(campaignId, {
            ...music,
            status:   "paused",
            pausedAt,
        }).catch(console.error);
    }, [campaignId, music]);

    const handleStop = useCallback(async () => {
        if (!campaignId) return;
        await updateMusic(campaignId, {
            ...(music ?? {}),
            status:    "stopped",
            startedAt: null,
            pausedAt:  0,
        }).catch(console.error);
    }, [campaignId, music]);

    const handleTrackSelect = useCallback(async (e) => {
        const path = e.target.value;
        setSelectedPath(path);
        if (!campaignId) return;
        const trackName = tracks.find((t) => t.path === path)?.name ?? path;
        const newStatus = music?.status === "playing" ? "playing" : "stopped";
        await updateMusic(campaignId, {
            trackPath:  path,
            trackName,
            status:     newStatus,
            startedAt:  newStatus === "playing" ? Date.now() : null,
            pausedAt:   0,
        }).catch(console.error);
    }, [campaignId, tracks, music]);

    const handleJoinAudio = useCallback(() => {
        if (!audioRef.current) return;
        audioRef.current.play()
            .then(() => setNeedsGesture(false))
            .catch(console.error);
    }, []);

    // ── Derived state ─────────────────────────────────────────────
    const isPlaying  = music?.status === "playing";
    const isPaused   = music?.status === "paused";
    const isStopped  = !music || music.status === "stopped";
    const progress   = duration > 0 ? Math.min(100, (localTime / duration) * 100) : 0;

    const statusColor = isPlaying
        ? "#00ff88"
        : isPaused
        ? accent
        : "rgba(255,255,255,0.2)";

    return (
        <Box
            sx={{
                borderBottom: `1px solid ${accent}33`,
                pb: 0.75,
                mb: 0.5,
            }}
        >
            {/* ── Compact header row ─────────────────────────────── */}
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                <MusicNoteIcon
                    sx={{ fontSize: 13, color: accent, opacity: 0.75, flexShrink: 0 }}
                />

                {/* Track name */}
                <Box
                    sx={{
                        flex: 1,
                        fontFamily: "'Fira Code', monospace",
                        fontSize:   "0.62rem",
                        letterSpacing: 0.5,
                        color: isPlaying ? "#fff" : "rgba(255,255,255,0.4)",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        userSelect: "none",
                    }}
                >
                    {music?.trackName
                        ? music.trackName.replace(/\.[^.]+$/, "")
                        : "NO_TRACK"}
                </Box>

                {/* Status dot */}
                <Box
                    sx={{
                        width:  6,
                        height: 6,
                        borderRadius: "50%",
                        bgcolor: statusColor,
                        boxShadow: isPlaying ? `0 0 6px #00ff88` : "none",
                        flexShrink: 0,
                        transition: "background-color 0.3s",
                    }}
                />

                {/* Quick play/pause in compact row */}
                {!isStopped && !expanded && (
                    isPlaying ? (
                        <IconButton size="small" onClick={handlePause} sx={{ p: 0.2, color: accent }}>
                            <PauseIcon sx={{ fontSize: 13 }} />
                        </IconButton>
                    ) : (
                        <IconButton size="small" onClick={handlePlay} sx={{ p: 0.2, color: accent }} disabled={!selectedPath}>
                            <PlayArrowIcon sx={{ fontSize: 13 }} />
                        </IconButton>
                    )
                )}

                {/* Expand toggle */}
                <IconButton
                    size="small"
                    onClick={() => setExpanded((v) => !v)}
                    sx={{ p: 0.2, color: `${accent}99` }}
                >
                    <ExpandMoreIcon
                        sx={{
                            fontSize: 14,
                            transform: expanded ? "rotate(180deg)" : "rotate(0deg)",
                            transition: "transform 0.2s ease",
                        }}
                    />
                </IconButton>
            </Box>

            {/* ── Autoplay blocked banner ────────────────────────── */}
            {needsGesture && (
                <Box
                    onClick={handleJoinAudio}
                    sx={{
                        mt: 0.5,
                        display: "flex",
                        alignItems: "center",
                        gap: 0.5,
                        cursor: "pointer",
                        color: accent,
                        fontFamily: "'Fira Code', monospace",
                        fontSize: "0.6rem",
                        letterSpacing: 0.5,
                        opacity: 0.85,
                        "&:hover": { opacity: 1 },
                    }}
                >
                    <HeadphonesIcon sx={{ fontSize: 12 }} />
                    CLICK_TO_JOIN_AUDIO
                </Box>
            )}

            {/* ── Expanded panel ─────────────────────────────────── */}
            <Collapse in={expanded} timeout="auto" unmountOnExit>
                <Box sx={{ mt: 0.75, display: "flex", flexDirection: "column", gap: 0.75 }}>

                    {/* Track selector */}
                    <Select
                        value={selectedPath}
                        onChange={handleTrackSelect}
                        displayEmpty
                        size="small"
                        sx={{
                            fontFamily: "'Fira Code', monospace",
                            fontSize:   "0.62rem",
                            color:      "rgba(255,255,255,0.85)",
                            bgcolor:    "rgba(0,0,0,0.4)",
                            "& .MuiOutlinedInput-notchedOutline": {
                                borderColor: `${accent}44`,
                            },
                            "&:hover .MuiOutlinedInput-notchedOutline": {
                                borderColor: accent,
                            },
                            "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
                                borderColor: accent,
                            },
                            "& .MuiSelect-icon": { color: accent },
                        }}
                        MenuProps={{
                            PaperProps: {
                                sx: {
                                    bgcolor: "rgba(6, 6, 14, 0.98)",
                                    border:  `1px solid ${accent}44`,
                                    boxShadow: `0 0 24px ${accent}22`,
                                    "& .MuiMenuItem-root": {
                                        fontFamily:    "'Fira Code', monospace",
                                        fontSize:      "0.65rem",
                                        color:         "rgba(255,255,255,0.85)",
                                        letterSpacing: 0.5,
                                        "&:hover": { bgcolor: `${accent}18` },
                                        "&.Mui-selected": {
                                            bgcolor: `${accent}22`,
                                            color:   accent,
                                        },
                                    },
                                },
                            },
                        }}
                    >
                        <MenuItem value="" disabled sx={{ opacity: 0.4 }}>
                            — SELECT_TRACK —
                        </MenuItem>
                        {tracks.length === 0 && (
                            <MenuItem value="" disabled sx={{ opacity: 0.4 }}>
                                NO_TRACKS_FOUND
                            </MenuItem>
                        )}
                        {tracks.map((t) => (
                            <MenuItem key={t.path} value={t.path}>
                                {t.name.replace(/\.[^.]+$/, "")}
                            </MenuItem>
                        ))}
                    </Select>

                    {/* Playback controls row */}
                    <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                        {/* Play / Pause */}
                        <Tooltip title={isPlaying ? "Pause" : "Play"} placement="top">
                            <span>
                                {isPlaying ? (
                                    <IconButton
                                        size="small"
                                        onClick={handlePause}
                                        sx={btnSx(accent)}
                                    >
                                        <PauseIcon sx={{ fontSize: 16 }} />
                                    </IconButton>
                                ) : (
                                    <IconButton
                                        size="small"
                                        onClick={handlePlay}
                                        sx={btnSx(accent)}
                                        disabled={!selectedPath}
                                    >
                                        <PlayArrowIcon sx={{ fontSize: 16 }} />
                                    </IconButton>
                                )}
                            </span>
                        </Tooltip>

                        {/* Stop */}
                        <Tooltip title="Stop" placement="top">
                            <span>
                                <IconButton
                                    size="small"
                                    onClick={handleStop}
                                    sx={btnSx(accent, true)}
                                    disabled={isStopped}
                                >
                                    <StopIcon sx={{ fontSize: 16 }} />
                                </IconButton>
                            </span>
                        </Tooltip>

                        {/* Time display */}
                        <Box
                            sx={{
                                flex:          1,
                                textAlign:     "right",
                                fontFamily:    "'Fira Code', monospace",
                                fontSize:      "0.58rem",
                                color:         `${accent}88`,
                                letterSpacing: 0.5,
                                userSelect:    "none",
                            }}
                        >
                            {fmt(localTime)} / {fmt(duration)}
                        </Box>
                    </Box>

                    {/* Progress bar (display only) */}
                    <Box
                        sx={{
                            height:       3,
                            borderRadius: 2,
                            bgcolor:      `${accent}22`,
                            overflow:     "hidden",
                            position:     "relative",
                        }}
                    >
                        <Box
                            sx={{
                                position:     "absolute",
                                left:         0,
                                top:          0,
                                height:       "100%",
                                width:        `${progress}%`,
                                bgcolor:      accent,
                                borderRadius: 2,
                                boxShadow:    `0 0 6px ${accent}88`,
                                transition:   "width 0.5s linear",
                            }}
                        />
                    </Box>

                    {/* Volume row */}
                    <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
                        <Tooltip title={volume > 0 ? "Mute" : "Unmute"} placement="top">
                            <IconButton
                                size="small"
                                onClick={() => setVolume((v) => (v > 0 ? 0 : 0.8))}
                                sx={{ p: 0.25, color: `${accent}99`, flexShrink: 0 }}
                            >
                                {volume > 0
                                    ? <VolumeUpIcon  sx={{ fontSize: 14 }} />
                                    : <VolumeOffIcon sx={{ fontSize: 14 }} />
                                }
                            </IconButton>
                        </Tooltip>

                        <Slider
                            size="small"
                            value={volume}
                            min={0}
                            max={1}
                            step={0.01}
                            onChange={(_, v) => setVolume(v)}
                            aria-label="Volume"
                            sx={{
                                color: accent,
                                py:    0,
                                "& .MuiSlider-thumb": {
                                    width:  10,
                                    height: 10,
                                    "&:hover, &.Mui-focusVisible": {
                                        boxShadow: `0 0 8px ${accent}66`,
                                    },
                                },
                                "& .MuiSlider-track": { height: 2 },
                                "& .MuiSlider-rail":  { height: 2, opacity: 0.25 },
                            }}
                        />

                        <Box
                            sx={{
                                fontFamily:    "'Fira Code', monospace",
                                fontSize:      "0.55rem",
                                color:         `${accent}66`,
                                minWidth:      24,
                                textAlign:     "right",
                                userSelect:    "none",
                            }}
                        >
                            {Math.round(volume * 100)}%
                        </Box>
                    </Box>
                </Box>
            </Collapse>
        </Box>
    );
}
