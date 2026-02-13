export function lerpColor(from, to, t) {
    const fr = (from >> 16) & 0xff;
    const fg = (from >> 8) & 0xff;
    const fb = from & 0xff;

    const tr = (to >> 16) & 0xff;
    const tg = (to >> 8) & 0xff;
    const tb = to & 0xff;

    const r = Math.round(fr + (tr - fr) * t);
    const g = Math.round(fg + (tg - fg) * t);
    const b = Math.round(fb + (tb - fb) * t);

    return (r << 16) | (g << 8) | b;
}