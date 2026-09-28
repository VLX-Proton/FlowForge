/** Snap world/CSS lengths to half-pixels for sharper rasterization under scale(). */
export function snapDisplay(
  value: number,
): number {
  return (
    Math.round(value * 2) / 2
  )
}
