import * as PIXI from "pixi.js";
import gsap from "gsap";
import { RENDER_LAYERS } from "../constants/renderLayers";

export function createPixiTooltip({
    text,
    maxWidth = 160,
    backgroundColor = 0x1e1e2f,
    textColor = 0xffffff,
    borderRadius = 8,
    paddingX = 12,
    paddingY = 8,
}) {
    const container = new PIXI.Container();
    container.alpha = 0;
    container.y = -80; // posición base (arriba del icono)
    container.zIndex = RENDER_LAYERS.UI;

    const textStyle = new PIXI.TextStyle({
        fontSize: 12,
        fill: textColor,
        wordWrap: true,
        wordWrapWidth: maxWidth,
        align: "center",
    });

    const label = new PIXI.Text(text, textStyle);
    label.anchor.set(0.5);

    const bg = new PIXI.Graphics();
    bg.beginFill(backgroundColor, 0.9);
    bg.drawRoundedRect(
        -label.width / 2 - paddingX,
        -label.height / 2 - paddingY,
        label.width + paddingX * 2,
        label.height + paddingY * 2,
        borderRadius
    );
    bg.endFill();

    container.addChild(bg, label);

    return {
        container,

        show() {
            gsap.killTweensOf(container);
            gsap.to(container, {
                alpha: 1,
                y: -100,
                duration: 0.25,
                ease: "power2.out",
            });
        },

        hide() {
            gsap.killTweensOf(container);
            gsap.to(container, {
                alpha: 0,
                y: -80,
                duration: 0.2,
                ease: "power2.in",
            });
        },

        destroy() {
            container.destroy({ children: true });
        },
    };
}
