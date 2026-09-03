import { splitAt, thresholdSweep } from '../stats'

/**
 * Win rate above and below a death-count line you can move.
 *
 * The line is draggable rather than fixed because the question is not "what
 * happens at six" but "where does it start to matter" — a single fixed cut can
 * only ever answer one of those. The sweep behind it shows every other cut at
 * once, so the shape is visible instead of asserted.
 *
 * What it deliberately does not do is find the biggest gap for you. With around
 * ten candidate thresholds and twenty games, the largest gap is nearly always
 * available by chance; auto-selecting it would manufacture the finding. The
 * default sits on six because that was the hypothesis going in.
 */
export default function ThresholdSplit({ games, k, onChange }) {
  const sweep = thresholdSweep(games)
  const split = splitAt(games, k)
  const max = sweep.length || 1

  return (
    <div className="split-panel">
      <div className="split-head">
        <h3>Deaths against result</h3>
        <label className="split-control">
          <span className="lbl">Split at</span>
          <input
            type="range"
            min="1"
            max={max}
            value={k}
            onChange={(e) => onChange(Number(e.target.value))}
            aria-label={`Death threshold, currently ${k}`}
          />
          <output className="k">{k}</output>
          <span className="lbl">deaths</span>
        </label>
      </div>

      <div className="tracks">
        <Track
          label={`Under ${k}`}
          tone="good"
          bucket={split.below}
        />
        <Track
          label={`${k} or more`}
          tone="bad"
          bucket={split.above}
        />
      </div>

      <Sweep sweep={sweep} k={k} onChange={onChange} />

      <p className="split-note">
        {split.gap === null ? (
          <>One side of this line has no games in it, so there is nothing to compare yet.</>
        ) : (
          <>
            A <b>{Math.abs(split.gap)}-point</b> {split.gap >= 0 ? 'drop' : 'rise'} at this line,
            on {split.below.n} games against {split.above.n}.
            {split.thin ? (
              <> Too few on one side to read as a rate — that is {Math.min(split.below.n, split.above.n)} game
                {Math.min(split.below.n, split.above.n) === 1 ? '' : 's'}, not a trend.</>
            ) : (
              <> One flipped result moves these by about{' '}
                {Math.round(100 / Math.min(split.below.n, split.above.n))} points, so treat it as a signal
                to watch rather than a settled rate.</>
            )}
          </>
        )}
      </p>
    </div>
  )
}

function Track({ label, tone, bucket }) {
  const pct = bucket.pct ?? 0
  return (
    <div className={`track-row ${tone}`}>
      <span className="lab">
        {label} <span className="n">n={bucket.n}</span>
      </span>
      <span className="track" role="img" aria-label={`${bucket.wins} of ${bucket.n} won`}>
        {bucket.n > 0 && (
          <>
            <span className="seg w" style={{ width: `${pct}%` }} />
            <span className="seg l" style={{ width: `${100 - pct}%` }} />
          </>
        )}
      </span>
      <span className="out">{bucket.pct === null ? '—' : `${bucket.pct}%`}</span>
    </div>
  )
}

/** Every threshold at once: the gap between the two buckets at each cut. */
function Sweep({ sweep, k, onChange }) {
  const usable = sweep.filter((s) => s.gap !== null)
  if (usable.length < 2) return null
  const peak = Math.max(...usable.map((s) => Math.abs(s.gap)), 1)

  return (
    <div className="sweep">
      <span className="sweep-cap">Gap at every threshold</span>
      <div className="sweep-bars">
        {sweep.map((s) => {
          const h = s.gap === null ? 0 : (Math.abs(s.gap) / peak) * 100
          return (
            <button
              key={s.k}
              type="button"
              className={`sweep-bar${s.k === k ? ' on' : ''}${s.thin ? ' thin' : ''}`}
              onClick={() => onChange(s.k)}
              title={
                s.gap === null
                  ? `${s.k}: one side empty`
                  : `${s.k}+ deaths — ${s.gap} point gap (n=${s.below.n} vs ${s.above.n})${s.thin ? ', thin' : ''}`
              }
              aria-label={`Set threshold to ${s.k} deaths`}
            >
              <span className="col">
                <span className="fill" style={{ height: `${h}%` }} />
              </span>
              <em>{s.k}</em>
            </button>
          )
        })}
      </div>
      <span className="sweep-note">
        Hollow bars have fewer than five games on one side. Nothing here is auto-selected —
        a biggest gap will always exist somewhere.
      </span>
    </div>
  )
}
