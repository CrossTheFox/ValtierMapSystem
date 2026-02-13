import { useEffect } from "react";
import * as PIXI from "pixi.js";
import { useApplication } from "@pixi/react";
import { GlowFilter } from "pixi-filters";
import { RENDER_LAYERS } from "../constants/renderLayers";

export default function PixiMagicFrame() {
    const { app } = useApplication();

    useEffect(() => {
        if (!app) return;

        const frame = new PIXI.Container();
        frame.name = "MagicFrame";
        frame.zIndex = RENDER_LAYERS.UI;

        const margin = 24;
        const innerMargin = 40;
        const radius = 28;

        const drawFrame = () => {
            frame.removeChildren();

            const w = app.screen.width;
            const h = app.screen.height;

            /* =========================
               OUTER BORDER
            ========================= */
            const outer = new PIXI.Graphics();
            outer.lineStyle(4, 0xff3cac, 1);
            outer.drawRoundedRect(
                margin,
                margin,
                w - margin * 2,
                h - margin * 2,
                radius
            );

            outer.filters = [
                new GlowFilter({
                    color: 0xff3cac,
                    distance: 10,
                    outerStrength: 1.5,
                }),
            ];

            /* =========================
               INNER BORDER
            ========================= */
            const inner = new PIXI.Graphics();
            inner.lineStyle(2, 0xff9ad5, 0.9);
            inner.drawRoundedRect(
                innerMargin,
                innerMargin,
                w - innerMargin * 2,
                h - innerMargin * 2,
                radius - 8
            );

            /* =========================
               CORNER RUNES
            ========================= */
            const createRune = (x, y, rotation = 0) => {
                const rune = new PIXI.Graphics();
                rune.beginFill(0xff1493);
                rune.drawPolygon([
                    0, -10,
                    10, 0,
                    0, 10,
                    -10, 0,
                ]);
                rune.endFill();
                rune.x = x;
                rune.y = y;
                rune.rotation = rotation;

                rune.filters = [
                    new GlowFilter({
                        color: 0xff1493,
                        distance: 8,
                        outerStrength: 2,
                    }),
                ];

                return rune;
            };

            /* =========================
               GEMS (DIAMONDS)
            ========================= */
            const createGem = (x, y) => {
                const gem = new PIXI.Graphics();
                gem.beginFill(0xff00ff);
                gem.drawPolygon([
                    0, -12,
                    10, 0,
                    0, 12,
                    -10, 0,
                ]);
                gem.endFill();
                gem.x = x;
                gem.y = y;

                gem.filters = [
                    new GlowFilter({
                        color: 0xff00ff,
                        distance: 14,
                        outerStrength: 3,
                    }),
                ];

                return gem;
            };

            frame.addChild(
                outer,
                inner,

                // Corners
                createRune(margin, margin, Math.PI / 4),
                createRune(w - margin, margin, Math.PI / 4),
                createRune(margin, h - margin, Math.PI / 4),
                createRune(w - margin, h - margin, Math.PI / 4),

                // Side gems
                createGem(w / 2, margin),
                createGem(w / 2, h - margin),
                createGem(margin, h / 2),
                createGem(w - margin, h / 2)
            );
        };

        drawFrame();
        app.stage.addChild(frame);

        app.renderer.on("resize", drawFrame);

        return () => {
            app.renderer.off("resize", drawFrame);
            frame.destroy({ children: true });
        };
    }, [app]);

    return null;
}
