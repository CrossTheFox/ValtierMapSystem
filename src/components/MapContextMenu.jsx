import { useEffect, useRef } from "react";
import { useSelector, useDispatch } from "react-redux";
import styled from "@emotion/styled";
import {
    closeContextMenu,
    openLocation,
    showSnackbar,
} from "../store/uiSlice";
import { snapWorldToGridPoint } from "../utils/gridMath";
import {
    publishMapPing,
    updateTokenConditions,
    updateTokenVisibility,
} from "../../firebase/services/gameService";
import { UI_COLORS } from "../constants/uiColors";
import { TOKEN_CONDITIONS, normalizeTokenConditions } from "../constants/tokenConditions";
import { canControlToken, isDmRole } from "../utils/tokenControl";

const CYAN = UI_COLORS.anomaly || "#00f2ea";

export default function MapContextMenu() {
    const dispatch = useDispatch();
    const contextMenu = useSelector((s) => s.ui.contextMenu);
    const map = useSelector((s) => s.world.map);
    const mapId = useSelector((s) => s.world.activeMapId ?? s.world.map?.id);
    const campaignId = useSelector((s) => s.world.selectedCampaignId);
    const gridConfig = useSelector((s) => s.world.gridConfig);
    const profile = useSelector((s) => s.player.profile);
    const tokenPositions = useSelector((s) => s.game.tokenPositions ?? {});
    const charactersById = useSelector((s) => s.world.charactersById ?? {});
    const menuRef = useRef(null);

    useEffect(() => {
        if (!contextMenu.open) return;

        const handler = (e) => {
            if (e.button === 2) return;
            if (menuRef.current && !menuRef.current.contains(e.target)) {
                dispatch(closeContextMenu());
            }
        };

        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, [contextMenu.open, dispatch]);

    if (!contextMenu.open) return null;

    const isToken = contextMenu.type === "token" && contextMenu.tokenId;
    const tokenId = contextMenu.tokenId;
    const pos = isToken && mapId ? tokenPositions[mapId]?.[tokenId] : null;
    const char = isToken ? charactersById[tokenId] : null;
    const canEdit = isToken && canControlToken(char || { id: tokenId }, profile);
    const isDM = isDmRole(profile?.role);
    const conditions = normalizeTokenConditions(pos?.conditions);
    const isHidden = pos?.visible === false;

    const pointLabel = isToken
        ? (contextMenu.tokenName || tokenId || "TOKEN").toUpperCase()
        : contextMenu.location?.name
            ? contextMenu.location.name.toUpperCase()
            : `(${Math.round(contextMenu.worldX)}, ${Math.round(contextMenu.worldY)})`;

    const handleViewLocation = () => {
        dispatch(openLocation(contextMenu.location));
        dispatch(closeContextMenu());
    };

    const handlePing = () => {
        if (!campaignId || !mapId) {
            dispatch(showSnackbar({ message: "Sin campaña/mapa activo", severity: "warning" }));
            dispatch(closeContextMenu());
            return;
        }
        const point = snapWorldToGridPoint(
            contextMenu.worldX,
            contextMenu.worldY,
            map,
            gridConfig,
        );
        dispatch(closeContextMenu());
        publishMapPing(campaignId, {
            mapId,
            x: point.x,
            y: point.y,
            col: point.col,
            row: point.row,
            createdBy: profile?.uid ?? null,
            createdByName: profile?.nickname ?? null,
        }).catch((err) => {
            console.error(err);
            dispatch(showSnackbar({ message: "No se pudo publicar el ping", severity: "error" }));
        });
    };

    const handleToggleCondition = (key) => {
        if (!campaignId || !mapId || !tokenId || !pos) return;
        const next = conditions.includes(key)
            ? conditions.filter((k) => k !== key)
            : [...conditions, key];
        updateTokenConditions(campaignId, mapId, tokenId, next, pos).catch((err) => {
            console.error(err);
            dispatch(showSnackbar({ message: "No se pudo actualizar condición", severity: "error" }));
        });
    };

    const handleToggleVisibility = () => {
        if (!campaignId || !mapId || !tokenId || !pos || !isDM) return;
        updateTokenVisibility(campaignId, mapId, tokenId, isHidden, pos).catch((err) => {
            console.error(err);
            dispatch(showSnackbar({ message: "No se pudo cambiar visibilidad", severity: "error" }));
        });
    };

    const menuW = 240;
    const menuH = isToken ? 280 : contextMenu.type === "location" ? 140 : 100;
    const x = Math.min(contextMenu.screenX, window.innerWidth - menuW - 8);
    const y = Math.min(contextMenu.screenY, window.innerHeight - menuH - 8);

    return (
        <>
            <div
                style={{ position: "fixed", inset: 0, zIndex: 1999, pointerEvents: "none" }}
            />
            <StyledMenu ref={menuRef} style={{ left: x, top: y }}>
                <div className="menu-header">
                    {isToken ? "◉ TOKEN" : contextMenu.type === "location" ? "◉ LOCATION" : "◉ MAP_POINT"}
                    <span className="menu-label">{pointLabel}</span>
                </div>

                {contextMenu.type === "location" && (
                    <button type="button" className="menu-item" onClick={handleViewLocation}>
                        <span className="item-icon">⬡</span>
                        VIEW_LOCATION
                    </button>
                )}

                {!isToken && (
                    <button type="button" className="menu-item ping" onClick={handlePing}>
                        <span className="item-icon">◎</span>
                        HACER_PING
                    </button>
                )}

                {isToken && canEdit && (
                    <>
                        <div className="menu-section">CONDICIONES</div>
                        {TOKEN_CONDITIONS.map((c) => {
                            const on = conditions.includes(c.key);
                            return (
                                <button
                                    key={c.key}
                                    type="button"
                                    className={`menu-item cond ${on ? "active" : ""}`}
                                    onClick={() => handleToggleCondition(c.key)}
                                >
                                    <span className="item-icon">{on ? "▣" : "□"}</span>
                                    {c.label.toUpperCase()}
                                </button>
                            );
                        })}
                    </>
                )}

                {isToken && isDM && (
                    <button type="button" className="menu-item ping" onClick={handleToggleVisibility}>
                        <span className="item-icon">{isHidden ? "◎" : "◌"}</span>
                        {isHidden ? "MOSTRAR_A_JUGADORES" : "OCULTAR_A_JUGADORES"}
                    </button>
                )}
            </StyledMenu>
        </>
    );
}

const StyledMenu = styled.div`
  position: fixed;
  z-index: 2000;
  pointer-events: auto;
  min-width: 220px;
  max-height: min(420px, calc(100vh - 24px));
  overflow-y: auto;
  background: rgba(4, 4, 8, 0.97);
  border: 1px solid ${CYAN};
  box-shadow: 0 0 24px ${CYAN}44, 0 0 6px ${CYAN}22, inset 0 0 20px ${CYAN}08;
  clip-path: polygon(0 0, 100% 0, 100% calc(100% - 14px), calc(100% - 14px) 100%, 0 100%);
  animation: menuAppear 0.1s cubic-bezier(0.2, 0, 0.2, 1);
  user-select: none;

  .menu-header {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 8px 12px 7px;
    font-family: "Fira Code", monospace;
    font-size: 0.6rem;
    color: ${CYAN};
    opacity: 0.7;
    letter-spacing: 2px;
    border-bottom: 1px solid ${CYAN}33;
    text-transform: uppercase;
  }

  .menu-label {
    font-size: 0.7rem;
    opacity: 1;
    color: #fff;
    letter-spacing: 1px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 210px;
  }

  .menu-section {
    padding: 6px 12px 2px;
    font-family: "Fira Code", monospace;
    font-size: 0.52rem;
    letter-spacing: 0.14em;
    color: ${UI_COLORS.textSecondary};
  }

  .menu-item {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    padding: 10px 12px;
    background: transparent;
    border: none;
    border-left: 2px solid transparent;
    color: ${UI_COLORS.textPrimary};
    font-family: "Fira Code", monospace;
    font-size: 0.75rem;
    text-align: left;
    cursor: pointer;
    text-transform: uppercase;
    letter-spacing: 1px;
    transition: background 0.12s, border-color 0.12s, color 0.12s, padding-left 0.12s;

    .item-icon {
      font-size: 0.85rem;
      opacity: 0.7;
      flex-shrink: 0;
    }

    &:hover {
      background: ${CYAN}18;
      border-left-color: ${CYAN};
      color: ${CYAN};
      padding-left: 16px;
    }

    &.active {
      color: ${UI_COLORS.accent};
      border-left-color: ${UI_COLORS.accent};
      background: ${UI_COLORS.accent}12;
    }

    &.ping:hover {
      color: ${UI_COLORS.accent};
      border-left-color: ${UI_COLORS.accent};
      background: ${UI_COLORS.accent}14;
    }

    &.cond {
      padding: 7px 12px;
      font-size: 0.68rem;
    }
  }

  @keyframes menuAppear {
    from {
      opacity: 0;
      transform: scale(0.94) translateY(-6px);
    }
    to {
      opacity: 1;
      transform: scale(1) translateY(0);
    }
  }
`;
