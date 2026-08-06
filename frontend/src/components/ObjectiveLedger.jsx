import { objectiveLabel } from '../stats'

/**
 * Every objective that fell, in order, with who took it. Without this the
 * per-death "Baron was up" flag has nowhere to land — the interesting part is
 * always who ended up with it.
 */
export default function ObjectiveLedger({ objectives }) {
  if (!objectives.length) {
    return (
      <div className="ledger">
        <span className="label">OBJECTIVES</span>
        <span className="ledger-empty">Neither team took a Baron or Drake this game.</span>
      </div>
    )
  }

  const mine = objectives.filter((o) => o.myTeam).length

  return (
    <div className="ledger">
      <div className="ledger-head">
        <span className="label">OBJECTIVES</span>
        <span className="ledger-tally">
          {mine} of {objectives.length} to your team
        </span>
      </div>
      <div className="ledger-strip">
        {objectives.map((o, i) => (
          <span
            key={`${o.timestampMs}-${i}`}
            className={`obj-chip ${o.myTeam ? 'mine' : 'theirs'}`}
            title={`${objectiveLabel(o)} taken by ${o.myTeam ? 'your team' : 'the enemy'} at ${o.timestamp}`}
          >
            <span className="obj-time">{o.timestamp}</span>
            <span className="obj-name">{objectiveLabel(o)}</span>
            <span className="obj-side">{o.myTeam ? 'YOURS' : 'ENEMY'}</span>
          </span>
        ))}
      </div>
    </div>
  )
}
