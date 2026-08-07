/**
 * Map geometry, mirrored from the backend's ZoneClassifier.
 *
 * The minimap used to be drawn from percentages placed by eye, while death dots
 * were placed by maths — so a death in the Baron pit rendered about 20px away
 * from the drawn pit. Everything on the map is now derived from these constants
 * instead, which means the drawing cannot disagree with the classification.
 *
 * Keep in step with ZoneClassifier.java.
 */

export const MAP_MAX = 14870

export const LANE_DEPTH = 1700
export const BASE_DEPTH = 2800
export const MID_HALF = 800
export const RIVER_HALF = 700
export const PIT_HALF = 700

export const BARON_PIT = { x: 4900, y: 10180 }
// Reflected through the map centre — the Rift is 180-degree symmetric.
export const DRAGON_PIT = { x: MAP_MAX - BARON_PIT.x, y: MAP_MAX - BARON_PIT.y }

/** A world-space distance as a percentage of the map's width. */
export const asPct = (world) => (world / MAP_MAX) * 100

/** World coordinate to a position on the square map. Y is flipped: Riot's origin is bottom-left. */
export const toPercent = (x, y) => ({
  left: (x / MAP_MAX) * 100,
  top: (1 - y / MAP_MAX) * 100,
})

/**
 * Visual thickness of a diagonal band, as a percentage of the map.
 *
 * The classifier bounds these bands by |x - y| or |x + y - MAP_MAX|, which is not
 * a perpendicular distance — the true perpendicular half-thickness is that over
 * root two. So the full drawn thickness is halfWidth * sqrt(2), not twice it.
 */
export const diagonalPct = (halfWidth) => (Math.SQRT2 * halfWidth) / MAP_MAX * 100

/** Centred band: half its thickness above the midline. */
export const bandStyle = (halfWidth, rotation) => {
  const thickness = diagonalPct(halfWidth)
  return {
    left: '-50%',
    width: '200%',
    height: `${thickness}%`,
    top: `calc(50% - ${thickness / 2}%)`,
    transform: `rotate(${rotation}deg)`,
  }
}

export const pitStyle = ({ x, y }) => {
  const size = asPct(PIT_HALF * 2)
  const { left, top } = toPercent(x, y)
  return { left: `${left}%`, top: `${top}%`, width: `${size}%`, height: `${size}%` }
}

/**
 * Where each region's name sits, as a world coordinate comfortably inside it.
 * Derived from the same constants so labels follow if a boundary moves.
 */
export const REGION_LABELS = [
  { text: 'TOP', x: LANE_DEPTH / 2, y: MAP_MAX * 0.62 },
  { text: 'BOT', x: MAP_MAX - LANE_DEPTH / 2, y: MAP_MAX * 0.38 },
  { text: 'MID', x: MAP_MAX * 0.72, y: MAP_MAX * 0.72 },
  { text: 'RIVER', x: MAP_MAX * 0.24, y: MAP_MAX * 0.83 },
  { text: 'BARON', x: BARON_PIT.x, y: BARON_PIT.y + PIT_HALF * 1.9 },
  { text: 'DRAKE', x: DRAGON_PIT.x, y: DRAGON_PIT.y - PIT_HALF * 1.9 },
]
