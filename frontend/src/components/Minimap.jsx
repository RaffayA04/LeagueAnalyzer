import {
  LANE_DEPTH, BASE_DEPTH, MID_HALF, RIVER_HALF,
  BARON_PIT, DRAGON_PIT, REGION_LABELS, HEAT_BINS, HEAT_RAMP, RIFT,
  asPct, toPercent, bandStyle, pitStyle, binDeaths, toRiftPercent,
} from '../mapGeometry'

// Drawn rather than using Riot's minimap art, which is licensed.
//
// Painting order is the reverse of the classifier's check order — jungle, river,
// mid, lanes, bases, pits — so whatever sits on top is also what wins the
// classification. Mid painting over the river is what splits the river into two
// arms, exactly as the ordering in ZoneClassifier does.
//
// The heat layer sits above the regions but below the labels, so region names
// stay readable over a hot cell.

const lane = asPct(LANE_DEPTH)
const base = asPct(BASE_DEPTH)

function Heat({ deaths, peak, project, scale }) {
  const cells = binDeaths(deaths, HEAT_BINS).map((c) => {
    if (project === toPercent) return c
    // Re-project the bin centre through the image calibration.
    const wx = (c.left / 100) * 14870
    const wy = (1 - c.top / 100) * 14870
    return { n: c.n, ...project(wx, wy) }
  })
  const size = (100 / HEAT_BINS) * scale
  return (
    <div className="m-heat">
      {cells.map((c, i) => {
        const f = Math.min(1, c.n / peak)
        const colour = HEAT_RAMP[Math.min(HEAT_RAMP.length - 1, Math.round(f * (HEAT_RAMP.length - 1)))]
        // Cells grow as well as brighten. Brightness alone saturates early and
        // a busy lane stops being distinguishable from a single hot pit.
        const span = size * (2.1 + f * 1.9)
        return (
          <span
            key={i}
            className="m-cell"
            style={{
              left: `${c.left}%`,
              top: `${c.top}%`,
              width: `${span}%`,
              height: `${span}%`,
              opacity: 0.5 + f * 0.5,
              background: `radial-gradient(circle, ${colour} 0%, transparent 70%)`,
            }}
          />
        )
      })}
    </div>
  )
}

export default function Minimap({
  deaths, hover, filter, showLabels, pulse, heat, heatPeak, decorative, art,
  onHover, onLeave, onSelect,
}) {
  // `art` swaps the drawn regions for the client minimap image. Dots are then
  // positioned through the image calibration instead of the drawn geometry, so
  // a dot still cannot disagree with the terrain it sits on.
  const project = art ? toRiftPercent : toPercent
  const heatScale = art ? RIFT.size / 100 : 1

  if (art) {
    return (
      <div className={`map art${heat ? ' heat' : ''}`} aria-hidden={decorative ? 'true' : undefined}>
        <img className="map-art" src="/rift.webp" alt="" draggable="false" />
        {heat && deaths.length > 0 && (
          <Heat deaths={deaths} peak={heatPeak || 1} project={project} scale={heatScale} />
        )}
        {deaths.map((d, i) => {
          const hot = hover === i
          const dim = filter && d[filter.k] !== filter.v
          const { left, top } = project(d.wx, d.wy)
          const Tag = decorative ? 'span' : 'button'
          return (
            <Tag
              key={`${d.t}-${i}`}
              type={decorative ? undefined : 'button'}
              className={`death${dim ? ' dim' : ''}${hot ? ' hot' : ''}${d.obj ? ' obj' : ''}`}
              aria-label={decorative ? undefined : `${d.t}, ${d.zone}, killed by ${d.killer}`}
              onMouseEnter={decorative ? undefined : () => onHover?.(i)}
              onMouseLeave={decorative ? undefined : onLeave}
              onFocus={decorative ? undefined : () => onHover?.(i)}
              onBlur={decorative ? undefined : onLeave}
              onClick={decorative ? undefined : () => onSelect?.(i)}
              style={{
                left: `${left}%`,
                top: `${top}%`,
                transform: `translate(-50%,-50%)${hot ? ' scale(1.5)' : ''}`,
                zIndex: hot ? 5 : 2,
                animation: d.obj && pulse && !dim && !hot ? 'objPulse 2.4s ease-out infinite' : 'none',
              }}
            />
          )
        })}
      </div>
    )
  }

  return (
    // Decorative: the landing page draws this behind its own copy, where 100+
    // focusable dots would be 100+ tab stops before the search field.
    <div className={`map${heat ? ' heat' : ''}`} aria-hidden={decorative ? 'true' : undefined}>
      <div className="m-river" style={bandStyle(RIVER_HALF, 45)} />
      <div className="m-mid" style={bandStyle(MID_HALF, -45)} />

      {/* Outer lanes: an L each, together a ring around the jungle. */}
      <div className="m-lane" style={{ left: 0, top: 0, width: `${lane}%`, height: '100%' }} />
      <div className="m-lane" style={{ left: 0, top: 0, width: '100%', height: `${lane}%` }} />
      <div className="m-lane" style={{ right: 0, top: 0, width: `${lane}%`, height: '100%' }} />
      <div className="m-lane" style={{ left: 0, bottom: 0, width: '100%', height: `${lane}%` }} />

      <div className="m-base blue" style={{ left: 0, bottom: 0, width: `${base}%`, height: `${base}%` }} />
      <div className="m-base red" style={{ right: 0, top: 0, width: `${base}%`, height: `${base}%` }} />

      <div className="m-pit" style={pitStyle(BARON_PIT)} />
      <div className="m-pit" style={pitStyle(DRAGON_PIT)} />

      {heat && deaths.length > 0 && <Heat deaths={deaths} peak={heatPeak || 1} project={toPercent} scale={1} />}

      {showLabels &&
        REGION_LABELS.map((l) => {
          const { left, top } = toPercent(l.x, l.y)
          return (
            <span key={l.text} className="zone-label" style={{ left: `${left}%`, top: `${top}%` }}>
              {l.text}
            </span>
          )
        })}

      {deaths.map((d, i) => {
        const hot = hover === i
        const dim = filter && d[filter.k] !== filter.v
        // Plotted from raw world coordinates, the same numbers the map is built
        // from, so a dot and its region can never disagree.
        const { left, top } = toPercent(d.wx, d.wy)
        const Tag = decorative ? 'span' : 'button'
        return (
          <Tag
            key={`${d.t}-${i}`}
            type={decorative ? undefined : 'button'}
            className={`death${dim ? ' dim' : ''}${hot ? ' hot' : ''}${d.obj ? ' obj' : ''}`}
            aria-label={decorative ? undefined : `${d.t}, ${d.zone}, killed by ${d.killer}`}
            onMouseEnter={decorative ? undefined : () => onHover?.(i)}
            onMouseLeave={decorative ? undefined : onLeave}
            onFocus={decorative ? undefined : () => onHover?.(i)}
            onBlur={decorative ? undefined : onLeave}
            onClick={decorative ? undefined : () => onSelect?.(i)}
            style={{
              left: `${left}%`,
              top: `${top}%`,
              transform: `translate(-50%,-50%)${hot ? ' scale(1.5)' : ''}`,
              zIndex: hot ? 5 : 2,
              animation: d.obj && pulse && !dim && !hot ? 'objPulse 2.4s ease-out infinite' : 'none',
            }}
          />
        )
      })}
    </div>
  )
}
