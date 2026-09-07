export type ScreenRect = { x: number; y: number; width: number; height: number };
export function overlapArea(a: ScreenRect, b: ScreenRect) {
  return Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x))
    * Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y));
}
/** Keep the preferred position when clear; otherwise try adjacent obstacle edges and viewport corners. */
export function placeOverlay(preferred: ScreenRect, viewport: { width: number; height: number }, bodies: ScreenRect[], placed: ScreenRect[]) {
  const candidates = [{ x: preferred.x, y: preferred.y }];
  for (const obstacle of [...bodies, ...placed]) {
    for (const x of [obstacle.x - preferred.width, obstacle.x + obstacle.width]) candidates.push({ x, y: preferred.y });
    for (const y of [obstacle.y - preferred.height, obstacle.y + obstacle.height]) candidates.push({ x: preferred.x, y });
  }
  for (const x of [0, viewport.width - preferred.width]) for (const y of [0, viewport.height - preferred.height]) candidates.push({ x, y });
  const options = candidates.map(p => {
    const rect = { ...preferred, x: Math.max(0, Math.min(viewport.width - preferred.width, p.x)), y: Math.max(0, Math.min(viewport.height - preferred.height, p.y)) };
    return { rect, bodyOverlap: bodies.reduce((sum, body) => sum + overlapArea(rect, body), 0),
      labelOverlap: placed.reduce((sum, label) => sum + overlapArea(rect, label), 0), distance: (rect.x - preferred.x) ** 2 + (rect.y - preferred.y) ** 2 };
  });
  options.sort((a, b) => a.bodyOverlap - b.bodyOverlap || a.labelOverlap - b.labelOverlap || a.distance - b.distance);
  return options[0].rect;
}
