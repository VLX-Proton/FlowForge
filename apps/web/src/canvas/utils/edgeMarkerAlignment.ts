/**
 * Aligns path endpoints with marker-end so the stroke stops at the arrow
 * base and the tip lands on the input port circle edge. Matches marker in EdgeLayer.
 */
const MARKER_VIEWBOX = 8
const MARKER_TIP_X = 5
const MARKER_WIDTH_STROKE_UNITS = 5
const EDGE_STROKE_WIDTH = 1.5

import { getPortConnectionInset } from '../constants/portLayout'

export function getArrowTipWorldOffset(
  zoom: number,
  strokeWidth = EDGE_STROKE_WIDTH,
): number {
  const markerScreenWidth =
    MARKER_WIDTH_STROKE_UNITS *
    strokeWidth

  const tipScreen =
    (MARKER_TIP_X / MARKER_VIEWBOX) *
    markerScreenWidth

  return tipScreen / zoom
}

/** Last cubic control point used by getEdgePath for a given port target. */
export function getEdgePathEndControl(
  startX: number,
  portX: number,
  portY: number,
) {
  const offset = Math.max(
    80,
    Math.abs(portX - startX) * 0.5,
  )

  return {
    x: portX - offset,
    y: portY,
  }
}

/** Arrow tip on port circle perimeter; path vertex at arrow base. */
export function getInputEdgeAlignment(
  portX: number,
  portY: number,
  control2X: number,
  control2Y: number,
  zoom: number,
  strokeWidth = EDGE_STROKE_WIDTH,
) {
  const dx = portX - control2X
  const dy = portY - control2Y
  const len =
    Math.hypot(dx, dy) || 1
  const ux = dx / len
  const uy = dy / len

  const faceInset =
    getPortConnectionInset('input')

  const tipX =
    portX - ux * faceInset
  const tipY =
    portY - uy * faceInset
  const inset =
    getArrowTipWorldOffset(
      zoom,
      strokeWidth,
    )

  return {
    tipX,
    tipY,
    pathEndX: tipX - ux * inset,
    pathEndY: tipY - uy * inset,
  }
}

/** @deprecated Use getInputEdgeAlignment */
export function getPathEndBeforeArrow(
  portX: number,
  portY: number,
  control2X: number,
  control2Y: number,
  zoom: number,
  strokeWidth = EDGE_STROKE_WIDTH,
) {
  const a = getInputEdgeAlignment(
    portX,
    portY,
    control2X,
    control2Y,
    zoom,
    strokeWidth,
  )

  return {
    x: a.pathEndX,
    y: a.pathEndY,
  }
}
