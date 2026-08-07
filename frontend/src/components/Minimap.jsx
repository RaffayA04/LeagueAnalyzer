import {
  LANE_DEPTH, BASE_DEPTH, MID_HALF, RIVER_HALF,
  BARON_PIT, DRAGON_PIT, REGION_LABELS,
  asPct, toPercent, bandStyle, pitStyle,
} from '../mapGeometry'

// Drawn rather than using Riot's minimap art, which is licensed.
//
// Painting order is the reverse of the classifier's check order — jungle, river,
// mid, lanes, bases, pits — so whatever sits on top is also what wins the
// classification. Mid painting over the river is what splits the river into two
// arms, exactly as the ordering in ZoneClassifier does.

const lane = asPct(LANE_DEPTH)
const base = asPct(BASE_DEPTH)

export default function Minimap({ deaths, hover, filter, showLabels, pulse, onHover, onLeave, onSelect }) {
  return (
    <div className="map">
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
        return (
          <button
            key={`${d.t}-${i}`}
            type="button"
            className="death"
            aria-label={`${d.t}, ${d.zone}, killed by ${d.killer}`}
            onMouseEnter={() => onHover(i)}
            onMouseLeave={onLeave}
            onFocus={() => onHover(i)}
            onBlur={onLeave}
            onClick={() => onSelect(i)}
            style={{
              left: `${left}%`,
              top: `${top}%`,
              background: dim ? '#D9C7C2' : '#C24540',
              transform: `translate(-50%,-50%)${hot ? ' scale(1.5)' : ''}`,
              zIndex: hot ? 5 : 2,
              opacity: dim ? 0.6 : 1,
              boxShadow: hot
                ? '0 0 0 2px #1C2126'
                : d.obj
                  ? '0 0 0 2px #A87E2F'
                  : '0 0 0 1px rgba(194,69,64,.35)',
              animation: d.obj && pulse && !dim && !hot ? 'objPulse 2.4s ease-out infinite' : 'none',
            }}
          />
        )
      })}
    </div>
  )
}
