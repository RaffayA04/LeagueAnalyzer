// The map is drawn in CSS rather than using Riot's minimap art: the two
// diagonals (mid along one, river along the other) plus the lane rails are
// enough to place a death, and there is no asset licensing to worry about.

const ZONE_LABELS = [
  { text: 'TOP LANE', style: { left: '10.5%', top: '10.5%' } },
  { text: 'BOT LANE', style: { right: '10.5%', bottom: '10.5%' } },
  { text: 'RIVER', style: { left: '22%', top: '18%' } },
  { text: 'MID', style: { left: '68%', top: '27%' } },
  { text: 'BARON', style: { left: '39%', top: '23%', transform: 'translateX(-50%)' } },
  { text: 'DRAKE', style: { left: '61%', top: '73%', transform: 'translateX(-50%)' } },
  { text: 'BLUE TOP JGL', jgl: true, style: { left: '22%', top: '38%' } },
  { text: 'BLUE BOT JGL', jgl: true, style: { left: '38%', top: '76%' } },
  { text: 'RED TOP JGL', jgl: true, style: { left: '50%', top: '22%' } },
  { text: 'RED BOT JGL', jgl: true, style: { left: '66%', top: '58%' } },
]

// pixelX / pixelY arrive on a 512-square, so dividing by 5.12 gives a percentage.
const PCT = 5.12

export default function Minimap({ deaths, hover, filter, showLabels, pulse, onHover, onLeave, onSelect }) {
  return (
    <div className="map">
      <div className="river" />
      <div className="mid" />
      <div className="base blue" />
      <div className="base red" />
      <div className="lane top-v" />
      <div className="lane top-h" />
      <div className="lane bot-v" />
      <div className="lane bot-h" />
      <div className="pit" style={{ left: '39%', top: '29%' }} />
      <div className="pit" style={{ left: '61%', top: '68%' }} />

      {showLabels &&
        ZONE_LABELS.map((l) => (
          <span key={l.text} className={`zone-label${l.jgl ? ' jgl' : ''}`} style={l.style}>
            {l.text}
          </span>
        ))}

      {deaths.map((d, i) => {
        const hot = hover === i
        const dim = filter && d[filter.k] !== filter.v
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
              left: `${d.x / PCT}%`,
              top: `${d.y / PCT}%`,
              background: dim ? '#D9C7C2' : '#C24540',
              transform: `translate(-50%,-50%)${hot ? ' scale(1.5)' : ''}`,
              zIndex: hot ? 5 : 1,
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
