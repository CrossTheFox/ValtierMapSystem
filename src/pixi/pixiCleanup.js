import gsap from "gsap";

/** Stop GSAP tweens on a display object and its descendants. */
export function killGsapDeep(target) {
    if (!target) return;
    gsap.killTweensOf(target);
    if (target.scale) gsap.killTweensOf(target.scale);
    for (const child of target.children ?? []) {
        killGsapDeep(child);
    }
}

/** Kill tweens then destroy if not already destroyed. */
export function safeDestroy(displayObject, options = { children: true }) {
    if (!displayObject || displayObject.destroyed) return;
    killGsapDeep(displayObject);
    displayObject.destroy(options);
}
