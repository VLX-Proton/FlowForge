export function getEdgePath(
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  curveAnchorX?: number,
  curveAnchorY?: number,
) {
  const anchorX =
    curveAnchorX ?? endX
  const anchorY =
    curveAnchorY ?? endY

  const offset =
    Math.max(
      80,
      Math.abs(anchorX - startX) * 0.5,
    )

  return `
    M ${startX} ${startY}
    C
      ${startX + offset} ${startY},
      ${anchorX - offset} ${anchorY},
      ${endX} ${endY}
  `
}
