import type {
  Point,
  Viewport
} from '../types/canvas.types'

export function worldToScreen(
  point: Point,
  viewport: Viewport,
): Point {
  return {
    x: point.x * viewport.zoom + viewport.x,
    y: point.y * viewport.zoom + viewport.y,
  }
}

export function screenToWorld(
  point: Point,
  viewport: Viewport,
): Point {
  return {
    x: (point.x - viewport.x) / viewport.zoom,
    y: (point.y - viewport.y) / viewport.zoom,
  }
}
