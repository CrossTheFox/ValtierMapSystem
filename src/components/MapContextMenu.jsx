import { useEffect, useRef } from "react";
import { useSelector, useDispatch } from "react-redux";
import styled from "@emotion/styled";
import {
    closeContextMenu,
    openLocation,
    setMeasurePointA,
    setMeasurePointB,
    clearMeasureTool,
} from "../store/uiSlice";
import { resolveCellSize, snapToGridCenter } from "../utils/gridMath";

const CYAN = "#00f2ea";
const PINK = "#ff66ff";

export default function MapContextMenu() {
    const dispatch = useDispatch();
    const { contextMenu, measureTool } = useSelector((s) => s.ui);
    const map = useSelector((s) => s.world.map);
    const gridConfig = useSelector((s) => s.world.gridConfig);
    const menuRef = useRef(null);
    const isMeasuring = !!measureTool.pointA;

    const snapWorld = (x, y, label) => {
        if (gridConfig?.snap === false) {
            return { x, y, label };
        }
        const cell = resolveCellSize(map, gridConfig);
        const snapped = snapToGridCenter(x, y, cell);
        return {
            x: snapped.x,
            y: snapped.y,
            label: label?.startsWith("(")
                ? `(${Math.round(snapped.x)}, ${Math.round(snapped.y)})`
                : label,
        };
    };

    // Close on outside click (ignore right-clicks to allow new menus to open)
    useEffect(() => {
        if (!contextMenu.open) return;

        const handler = (e) => {
            if (e.button === 2) return; // new right-click handled by PIXI, let it through
            if (menuRef.current && !menuRef.current.contains(e.target)) {
                dispatch(closeContextMenu());
            }
        };

        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, [contextMenu.open, dispatch]);

    if (!contextMenu.open) return null;

    const pointLabel = contextMenu.location?.name
        ? contextMenu.location.name.toUpperCase()
        : `(${Math.round(contextMenu.worldX)}, ${Math.round(contextMenu.worldY)})`;

    const handleViewLocation = () => {
        dispatch(openLocation(contextMenu.location));
        dispatch(closeContextMenu());
    };

    const handleMeasureFrom = () => {
        dispatch(setMeasurePointA(snapWorld(contextMenu.worldX, contextMenu.worldY, pointLabel)));
        dispatch(closeContextMenu());
    };

    const handleMeasureTo = () => {
        dispatch(setMeasurePointB(snapWorld(contextMenu.worldX, contextMenu.worldY, pointLabel)));
        dispatch(closeContextMenu());
    };

    const handleCancel = () => {
        dispatch(clearMeasureTool());
        dispatch(closeContextMenu());
    };

    // Clamp menu to stay inside the viewport
    const menuW = 220;
    const menuH = contextMenu.type === "location" ? 160 : 120;
    const x = Math.min(contextMenu.screenX, window.innerWidth - menuW - 8);
    const y = Math.min(contextMenu.screenY, window.innerHeight - menuH - 8);

    return (
        <>
            {/* Invisible backdrop — closes menu on any non-right click outside */}
            <div
                style={{ position: "fixed", inset: 0, zIndex: 1999, pointerEvents: "none" }}
            />
            <StyledMenu ref={menuRef} style={{ left: x, top: y }}>
                <div className="menu-header">
                    {contextMenu.type === "location" ? "◉ LOCATION" : "◉ MAP_POINT"}
                    <span className="menu-label">{pointLabel}</span>
                </div>

                {contextMenu.type === "location" && (
                    <button className="menu-item" onClick={handleViewLocation}>
                        <span className="item-icon">⬡</span>
                        VIEW_LOCATION
                    </button>
                )}

                {!isMeasuring ? (
                    <button className="menu-item measure" onClick={handleMeasureFrom}>
                        <span className="item-icon">⊢</span>
                        MEASURE_FROM_HERE
                    </button>
                ) : (
                    <>
                        <div className="measuring-hint">
                            <span className="item-icon">◈</span>
                            FROM: {measureTool.pointA?.label}
                        </div>
                        <button className="menu-item measure" onClick={handleMeasureTo}>
                            <span className="item-icon">⊣</span>
                            SET_ENDPOINT_HERE
                        </button>
                        <button className="menu-item cancel" onClick={handleCancel}>
                            <span className="item-icon">✕</span>
                            CANCEL_MEASUREMENT
                        </button>
                    </>
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
    max-width: 190px;
  }

  .measuring-hint {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 7px 12px 6px;
    font-family: "Fira Code", monospace;
    font-size: 0.65rem;
    color: ${CYAN}bb;
    letter-spacing: 1px;
    border-bottom: 1px solid ${CYAN}22;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    text-transform: uppercase;
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
    color: rgba(255, 255, 255, 0.85);
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

    &.cancel {
      color: rgba(255, 80, 80, 0.8);
      &:hover {
        background: rgba(255, 50, 50, 0.1);
        border-left-color: #ff4d4d;
        color: #ff4d4d;
      }
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
