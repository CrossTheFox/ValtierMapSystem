import { useEffect } from "react";
import { useSelector, useDispatch } from "react-redux";
import styled from "@emotion/styled";
import { clearRulerDraft, setRulerMode } from "../store/uiSlice";
import { UI_COLORS } from "../constants/uiColors";

const CYAN = UI_COLORS.anomaly || "#00f2ea";

export default function MeasuringHUD() {
    const dispatch = useDispatch();
    const rulerTool = useSelector((s) => s.ui.rulerTool);
    const active = !!rulerTool?.active;
    const hasDraft = !!rulerTool?.draftA;

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

    return (
        <StyledHUD>
            <div className="hud-badge">◈ RULER_MODE</div>

            <div className="hud-body">
                <div className="hud-instructions">
                    {!hasDraft ? (
                        <span className="key-hint">
                            <span className="key">LMB</span>
                            1ER NODO (GRILLA)
                        </span>
                    ) : (
                        <span className="key-hint">
                            <span className="key">LMB</span>
                            2DO NODO · SE GUARDA PARA TODOS
                        </span>
                    )}
                </div>
            </div>

            <button
                type="button"
                className="hud-cancel-btn"
                onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    dispatch(clearRulerDraft());
                    dispatch(setRulerMode(false));
                }}
                title="Salir del modo regla"
                aria-label="Salir del modo regla"
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
  border: 1px solid ${CYAN};
  box-shadow: 0 0 20px ${CYAN}44, inset 0 0 12px ${CYAN}0a;
  padding: 8px 14px 8px 12px;
  clip-path: polygon(0 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%);
  animation: hudAppear 0.2s cubic-bezier(0.2, 0, 0.2, 1);

  .hud-badge {
    font-family: "Orbitron", sans-serif;
    font-size: 0.55rem;
    letter-spacing: 0.14em;
    color: ${CYAN};
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
  }

  .key {
    display: inline-block;
    padding: 1px 5px;
    border: 1px solid ${CYAN}66;
    border-radius: 2px;
    color: ${CYAN};
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
