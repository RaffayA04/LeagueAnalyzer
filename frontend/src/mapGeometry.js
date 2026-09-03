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

/**
 * Density binning for the aggregate heatmap.
 *
 * Individual dots stop reading as density somewhere past forty points — twenty
 * games is around a hundred, so the map has to bin. Eighteen cells a side is
 * the coarsest grid that still resolves a lane from the jungle beside it.
 */
export const HEAT_BINS = 18

export function binDeaths(deaths, bins = HEAT_BINS) {
  const counts = new Map()
  for (const d of deaths) {
    const bx = Math.min(bins - 1, Math.floor((d.wx / MAP_MAX) * bins))
    const by = Math.min(bins - 1, Math.floor((d.wy / MAP_MAX) * bins))
    const key = by * bins + bx
    counts.set(key, (counts.get(key) || 0) + 1)
  }
  return [...counts].map(([key, n]) => {
    const bx = key % bins
    const by = (key - bx) / bins
    return { n, ...toPercent(((bx + 0.5) / bins) * MAP_MAX, ((by + 0.5) / bins) * MAP_MAX) }
  })
}

/** Coldest to hottest. Mirrors --river through --gold to --red. */
export const HEAT_RAMP = ['#25525f', '#3a8a9c', '#4ec3d9', '#d8a343', '#e2564f']

/**
 * Peak density across a reference set, so a filtered view normalises against
 * the whole sample rather than against itself. Without this, selecting a single
 * game re-scales one death into the hottest colour on the ramp and a quiet game
 * renders as a hotspot.
 */
export const peakDensity = (deaths, bins = HEAT_BINS) =>
  Math.max(1, ...binDeaths(deaths, bins).map((c) => c.n))

/* ------------------------------------------------------------------
 * The client minimap art (public/rift.webp)
 *
 * The image is not a tight crop of the playable area — it carries a
 * decorative frame, and it pads its right and bottom edges — so world
 * coordinates map into a sub-square of it rather than the whole file.
 *
 * Calibrated by placing the four lane corners over the art. Those corners are
 * the playable square's corners by definition (mid runs world (0,0) to
 * (MAP_MAX, MAP_MAX); the river runs the other diagonal), so they fix the
 * mapping directly. All four land within 0.06% of the solved square.
 *
 * The pits were placed too and sit ~3% out, which is expected rather than
 * error: BARON_PIT above is the centroid of everything sharing that pit
 * (Baron, Herald, the Grubs), not Baron's own position, so it is deliberately
 * pulled in from the visual pit centre. Measured against Baron's real
 * coordinates the same placement is only 1.7% out.
 * ------------------------------------------------------------------ */

export const RIFT = { x: 3.32, y: 3.83, size: 86.33 }

/** World coordinate to a position on the minimap image. */
export const toRiftPercent = (x, y) => ({
  left: RIFT.x + (x / MAP_MAX) * RIFT.size,
  top: RIFT.y + (1 - y / MAP_MAX) * RIFT.size,
})

/** Heat cells, positioned against the art rather than the drawn map. */
export function binDeathsOnRift(deaths, bins = HEAT_BINS) {
  return binDeaths(deaths, bins).map((c) => {
    // binDeaths returns drawn-map percentages; re-project onto the image.
    const wx = (c.left / 100) * MAP_MAX
    const wy = (1 - c.top / 100) * MAP_MAX
    return { n: c.n, ...toRiftPercent(wx, wy) }
  })
}
