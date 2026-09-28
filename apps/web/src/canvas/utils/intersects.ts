export interface Rect {
  left: number
  top: number
  right: number
  bottom: number
}

export function intersects(
  a: Rect,
  b: Rect,
) {
  return !(
    a.right < b.left ||
    a.left > b.right ||
    a.bottom < b.top ||
    a.top > b.bottom
  )
}