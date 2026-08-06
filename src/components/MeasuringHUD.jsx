import { useEffect } from "react";
import { useSelector, useDispatch } from "react-redux";
import styled from "@emotion/styled";
import { clearRulerDraft, clearDrawDraft, setRulerMode, setDrawMode } from "../store/uiSlice";
import { UI_COLORS } from "../constants/uiColors";

const CYAN = UI_COLORS.anomaly || "#00f2ea";
const PINK = UI_COLORS.accent || "#ff66ff";

export default function MeasuringHUD() {
    const dispatch = useDispatch();
    const rulerTool = useSelector((s) => s.ui.rulerTool);
    const drawTool = useSelector((s) => s.ui.drawTool);
    const rulerActive = !!rulerTool?.active;
    const drawActive = !!drawTool?.active;
    const draftCount = Array.isArray(rulerTool?.draftPoints) ? rulerTool.draftPoints.length : 0;
    const hasDrawDraft = Boolean(
        drawTool?.draftPoint
        || (Array.isArray(drawTool?.draftParts) && drawTool.draftParts.length > 0)
        || (Array.isArray(drawTool?.draftPaths) && drawTool.draftPaths.length > 0)
        || (Array.isArray(drawTool?.draftPath) && drawTool.draftPath.length > 0),
    );
    const active = rulerActive || drawActive;
    const accent = drawActive ? PINK : CYAN;

    useEffect(() => {
        if (!active) return;
        const canvas = document.querySelector("canvas");
        if (!canvas) return;
        const prev = canvas.style.cursor;
        canvas.style.cursor = "crosshair";
        return () => {
            canvas.style.cursor = prev;
        };
    }, [active]);

    if (!active) return null;

    const shape = drawTool?.shape || "circle";
    const shapeHint = shape === "freehand"
        ? "LMB vértices en grilla · clic en extremo cierra · Ctrl encadena · RMB cancela"
        : shape === "circle"
            ? "LMB centro → borde · marca N sq · redondo/casillas · RMB cancela"
            : "LMB esquina · 2º clic cierra · Ctrl encadena · RMB cancela";

    return (
        <StyledHUD $accent={accent}>
            <div className="hud-badge">
                {rulerActive ? "◈ RULER_MODE" : `◈ DRAW_${String(shape).toUpperCase()}`}
            </div>

            <div className="hud-body">
                <div className="hud-instructions">
                    {rulerActive ? (
                        draftCount === 0 ? (
                            <span className="key-hint">
                                <span className="key">LMB</span>
                                1ER NODO (GRILLA)
                            </span>
                        ) : (
                            <span className="key-hint">
                                <span className="key">LMB</span>
                                CIERRA ·
                                <span className="key">CTRL+LMB</span>
                                ZIGZAG ·
                                <span className="key">RMB</span>
                                CANCELA
                            </span>
                        )
                    ) : (
                        <span className="key-hint">{shapeHint}</span>
                    )}
                </div>
            </div>

            <button
                type="button"
                className="hud-cancel-btn"
                onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (rulerActive) {
                        dispatch(clearRulerDraft());
                        dispatch(setRulerMode(false));
                    }
                    if (drawActive) {
                        dispatch(clearDrawDraft());
                        dispatch(setDrawMode(false));
                    }
                }}
                title={rulerActive ? "Salir del modo regla" : "Salir del modo figuras"}
                aria-label="Salir del modo dibujo"
            >
                ✕
            </button>
        </StyledHUD>
    );
}

const StyledHUD = styled.div`
  position: fixed;
  top: 20px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 1500;
  pointer-events: auto;

  display: flex;
  align-items: center;
  gap: 12px;

  background: rgba(4, 4, 8, 0.95);
  border: 1px solid ${(p) => p.$accent};
  box-shadow: 0 0 20px ${(p) => p.$accent}44, inset 0 0 12px ${(p) => p.$accent}0a;
  padding: 8px 14px 8px 12px;
  clip-path: polygon(0 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%);
  animation: hudAppear 0.2s cubic-bezier(0.2, 0, 0.2, 1);

  .hud-badge {
    font-family: "Orbitron", sans-serif;
    font-size: 0.55rem;
    letter-spacing: 0.14em;
    color: ${(p) => p.$accent};
  }

  .hud-body {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .hud-instructions {
    display: flex;
    align-items: center;
    gap: 8px;
    font-family: "Fira Code", monospace;
    font-size: 0.65rem;
    color: ${UI_COLORS.textPrimary};
    letter-spacing: 0.04em;
  }

  .key-hint {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    flex-wrap: wrap;
  }

  .key {
    display: inline-block;
    padding: 1px 5px;
    border: 1px solid ${(p) => p.$accent}66;
    border-radius: 2px;
    color: ${(p) => p.$accent};
    font-size: 0.58rem;
  }

  .hud-cancel-btn {
    width: 26px;
    height: 26px;
    border-radius: 4px;
    border: 1px solid ${UI_COLORS.accent}66;
    background: transparent;
    color: ${UI_COLORS.accent};
    cursor: pointer;
    font-size: 0.85rem;
    line-height: 1;
    &:hover {
      background: ${UI_COLORS.accent}18;
    }
  }

  @keyframes hudAppear {
    from { opacity: 0; transform: translate(-50%, -8px); }
    to { opacity: 1; transform: translate(-50%, 0); }
  }

  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }
`;
