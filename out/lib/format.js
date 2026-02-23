"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.bounceColor = bounceColor;
exports.fmtPct = fmtPct;
exports.fmtDuration = fmtDuration;
/**
 * Bounce rate (0–1) to color emoji.
 */
function bounceColor(rate) {
    if (rate < 0.25)
        return '🟢';
    if (rate < 0.45)
        return '🟡';
    if (rate < 0.65)
        return '🟠';
    return '🔴';
}
/**
 * Format rate (0–1) as percentage string.
 */
function fmtPct(rate) {
    return (rate * 100).toFixed(1) + '%';
}
/**
 * Format seconds as "Xm Ys" or "Ys".
 */
function fmtDuration(sec) {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return m > 0 ? `${m}m ${s}s` : `${s}s`;
}
//# sourceMappingURL=format.js.map