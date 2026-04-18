import { useEffect } from "react";
import { useSelector, useDispatch } from "react-redux";
import styled from "@emotion/styled";
import { clearMeasureTool } from "../store/uiSlice";
import { UI_COLORS } from "../constants/uiColors";

const CYAN = UI_COLORS.anomaly || "#00f2ea";

export default function MeasuringHUD() {
    const dispatch = useDispatch();
    const { measureTool } = useSelector((s) => s.ui);
    const isMeasuring = !!measureTool.pointA && !measureTool.pointB;

    // Crosshair cursor on the canvas while measuring
    useEffect(() => {
        if (!isMeasuring) return;
        const canvas = document.querySelector("canvas");
        if (!canvas) return;
        const prev = canvas.style.cursor;
        canvas.style.cursor = "crosshair";
        return () => {
            canvas.style.cursor = prev;
        };
    }, [isMeasuring]);

    if (!isMeasuring) return null;

    return (
        <StyledHUD>
            <div className="hud-badge">◈ MEASURING_MODE</div>

            <div className="hud-body">
                <div className="hud-origin">
                    <span className="hud-dim">FROM</span>
                    <span className="hud-value">{measureTool.pointA?.label}</span>
                </div>

                <div className="hud-instructions">
                    <span className="key-hint">
                        <span className="key">LMB</span>
                        SET ENDPOINT
                    </span>
                    <span className="sep">·</span>
                    <span className="key-hint cancel-hint">
                        <span className="key cancel-key">RMB</span>
                        CANCEL
                    </span>
                </div>
            </div>

            <button
                className="hud-cancel-btn"
                onClick={() => dispatch(clearMeasureTool())}
                title="Cancel measurement"
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
    font-family: "Fira Code", monospace;
    font-size: 0.65rem;
    font-weight: 700;
    color: ${CYAN};
    letter-spacing: 3px;
    text-transform: uppercase;
    white-space: nowrap;
    animation: blink 1.4s step-start infinite;
  }

  .hud-body {
    display: flex;
    flex-direction: column;
    gap: 3px;
    border-left: 1px solid ${CYAN}44;
    padding-left: 12px;
  }

  .hud-origin {
    display: flex;
    align-items: center;
    gap: 6px;
    font-family: "Fira Code", monospace;
    font-size: 0.7rem;
  }

  .hud-dim {
    color: ${CYAN}88;
    font-size: 0.6rem;
    letter-spacing: 1px;
  }

  .hud-value {
    color: #fff;
    font-weight: 600;
    max-width: 200px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .hud-instructions {
    display: flex;
    align-items: center;
    gap: 8px;
    font-family: "Fira Code", monospace;
    font-size: 0.62rem;
    color: rgba(255, 255, 255, 0.5);
    letter-spacing: 0.5px;
  }

  .key-hint {
    display: flex;
    align-items: center;
    gap: 5px;
  }

  .key {
    padding: 1px 5px;
    background: ${CYAN}22;
    border: 1px solid ${CYAN}88;
    border-radius: 2px;
    color: ${CYAN};
    font-size: 0.6rem;
    font-weight: 700;
  }

  .cancel-hint { color: rgba(255, 100, 100, 0.6); }
  .cancel-key  { background: rgba(255,50,50,0.15); border-color: #ff6666aa; color: #ff8888; }

  .sep { color: ${CYAN}44; font-size: 1rem; }

  .hud-cancel-btn {
    background: transparent;
    border: 1px solid rgba(255, 80, 80, 0.5);
    color: rgba(255, 80, 80, 0.7);
    border-radius: 2px;
    width: 24px;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    font-size: 0.75rem;
    transition: background 0.15s, color 0.15s;
    flex-shrink: 0;

    &:hover {
      background: rgba(255, 50, 50, 0.2);
      color: #ff5555;
      border-color: #ff5555;
    }
  }

  @keyframes hudAppear {
    from { opacity: 0; transform: translateX(-50%) translateY(-8px); }
    to   { opacity: 1; transform: translateX(-50%) translateY(0); }
  }

  @keyframes blink {
    0%, 100% { opacity: 1; }
    50%       { opacity: 0.45; }
  }
`;
