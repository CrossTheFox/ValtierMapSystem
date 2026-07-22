import { useEffect, useRef } from "react";
import * as PIXI from "pixi.js";
import { useSelector } from "react-redux";
import { useViewport } from "../context/ViewportContext";
import { RENDER_LAYERS } from "../constants/renderLayers";
import {
    DEFAULT_GRID_CELL_PX,
    resolveGridDimensions,
} from "../utils/gridMath";

export { DEFAULT_GRID_CELL_PX };

const GRID_COLOR = 0x2a2a3d;
const GRID_ALPHA = 0.55;

export default function GridLayer() {
    const viewport = useViewport();
    const map = useSelector((s) => s.world.map);
    const gridConfig = useSelector((s) => s.world.gridConfig);

    const layerRef = useRef(null);

    useEffect(() => {
        if (!viewport || !map || !gridConfig?.visible) return;

        const { cellSize, columns, rows } = resolveGridDimensions(map, gridConfig);
        const layer = new PIXI.Graphics();
        layer.label = "GridLayer";
        layer.zIndex = RENDER_LAYERS.GRID;
        layer.eventMode = "none";

        layer.setStrokeStyle({ width: 1, color: GRID_COLOR, alpha: GRID_ALPHA });

        for (let c = 0; c <= columns; c++) {
            const x = c * cellSize;
            layer.moveTo(x, 0);
            layer.lineTo(x, rows * cellSize);
        }
        for (let r = 0; r <= rows; r++) {
            const y = r * cellSize;
            layer.moveTo(0, y);
            layer.lineTo(columns * cellSize, y);
        }
        layer.stroke();

        viewport.addChild(layer);
        layerRef.current = layer;

        return () => {
            layer.destroy({ children: true });
            layerRef.current = null;
        };
    }, [viewport, map, gridConfig]);

    return null;
}
