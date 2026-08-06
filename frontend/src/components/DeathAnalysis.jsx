import { useMemo, useState } from 'react'
import Minimap from './Minimap'
import { summarize, buildChips, coachLine } from '../stats'

export default function DeathAnalysis({ deaths, matchId, player }) {
  const [hover, setHover] = useState(null)
  const [filter, setFilter] = useState(null)

  const summary = useMemo(() => summarize(deaths), [deaths])
  const chips = useMemo(() => buildChips(summary), [summary])
  const coach = coachLine(deaths, summary, hover, filter)

  const clearHover = () => setHover(null)
  const toggleHover = (i) => setHover((h) => (h === i ? null : i))
  const toggleFilter = (c) =>
    setFilter((f) => (f && f.k === c.k && f.v === c.v ? null : { k: c.k, v: c.v }))

  const matching = filter ? deaths.filter((d) => d[filter.k] === filter.v).length : deaths.length
  const shown = filter
    ? `SHOWING ${matching} OF ${summary.total} — ${filter.v.toUpperCase()}`
    : `${summary.total} ${summary.total === 1 ? 'DEATH' : 'DEATHS'} · CHRONOLOGICAL`

  return (
    <div className="panel">
      <div className="topbar">
        <div className="topbar-meta">
          <span className="wordmark">
            LEAGUE<span>ANALYZER</span>
          </span>
          <span className="match-id">{matchId}</span>
        </div>
        <span className="who">
          {player.gameName} <span className="tag">#{player.tagLine}</span>
        </span>
      </div>

      <div className="body">
        <div className="left">
          <h1 className="headline">
            {summary.total === 0 ? (
              'You did not die once this game.'
            ) : (
              <>
                You died{' '}
                <span className="count">
                  {summary.total} {summary.total === 1 ? 'time' : 'times'}
                </span>
                . <Lead summary={summary} />
              </>
            )}
          </h1>

          {summary.total > 0 && (
            <div className="cards">
              <div className="card">
                <span className="label">WHERE</span>
                <span className="text">
                  {summary.topZone.name} accounts for{' '}
                  <strong>
                    {summary.topZone.count} of {summary.total}
                  </strong>{' '}
                  deaths
                  {summary.streak.len > 2 && (
                    <> — a {numberWord(summary.streak.len)}-death stretch between {summary.streak.from} and {summary.streak.to}</>
                  )}
                  .
                </span>
              </div>

              <div className="card">
                <span className="label">WHO</span>
                <span className="text">
                  <strong className="killer">{summary.topKiller.name}</strong> killed you{' '}
                  {summary.topKiller.count} {summary.topKiller.count === 1 ? 'time' : 'times'}
                  {summary.topKiller.count > 1 && (
                    <> — first at {summary.topKillerFirst}, last at {summary.topKillerLast}</>
                  )}
                  .
                </span>
              </div>

              <div className="card">
                <span className="label obj">OBJECTIVES</span>
                <span className="text">
                  {summary.objCount === 0 ? (
                    <>No deaths happened while Baron or Drake was up.</>
                  ) : (
                    <>
                      {summary.objCount} {summary.objCount === 1 ? 'death came' : 'deaths came'} while an
                      objective was up — including the {summary.notable.zone.toLowerCase()} at{' '}
                      <strong>
                        {summary.notable.t} with {summary.notable.obj === 'baron' ? 'Baron' : 'Drake'} alive
                      </strong>
                      .
                    </>
                  )}
                </span>
              </div>
            </div>
          )}

          <div className="coach">
            <span className="dot" />
            <span className="text">{coach}</span>
          </div>
        </div>

        <div className="map-wrap">
          <Minimap
            deaths={deaths}
            hover={hover}
            filter={filter}
            showLabels
            pulse
            onHover={setHover}
            onLeave={clearHover}
            onSelect={toggleHover}
          />
        </div>
      </div>

      {summary.total > 0 && (
        <div className="list-section">
          <div className="chips">
            <span className="label">ALL DEATHS</span>
            {chips.map((c) => {
              const active = filter && filter.k === c.k && filter.v === c.v
              return (
                <button
                  key={`${c.k}-${c.v}`}
                  type="button"
                  className={`chip ${c.k === 'zone' ? 'zone' : 'killer'}`}
                  aria-pressed={active ? 'true' : 'false'}
                  onClick={() => toggleFilter(c)}
                >
                  {c.v} ×{c.n}
                </button>
              )
            })}
            <span className="shown">{shown}</span>
          </div>

          <div className="rows">
            {deaths.map((d, i) => {
              const hot = hover === i
              const dim = filter && d[filter.k] !== filter.v
              return (
                <button
                  key={`${d.t}-${i}`}
                  type="button"
                  className="row"
                  onMouseEnter={() => setHover(i)}
                  onMouseLeave={clearHover}
                  onFocus={() => setHover(i)}
                  onBlur={clearHover}
                  onClick={() => toggleHover(i)}
                  style={{ opacity: dim ? 0.35 : 1, background: hot ? 'var(--hover)' : 'transparent' }}
                >
                  <span className="t">{d.t}</span>
                  <span className="what">
                    <span className="zone-cell">{d.zone}</span>
                    <span className="sep"> · </span>
                    <span className="by">
                      <span className="by-word">by </span>
                      <strong>{d.killer}</strong>
                    </span>
                  </span>
                  {d.obj && <span className="obj">{d.obj === 'baron' ? 'BARON' : 'DRAKE'}</span>}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

/**
 * Leads with whichever pattern is actually there. A "top zone" of 2 out of 8
 * while every other zone has 1 is a tie, not a cluster — claiming it as the
 * headline insight would invent a pattern the data does not support.
 */
function isPattern(count, total) {
  return count >= 3 || count / total >= 0.34
}

function Lead({ summary }) {
  const { total, topZone, topKiller } = summary
  const zone = isPattern(topZone.count, total)
  const killer = isPattern(topKiller.count, total)

  if (zone && killer) {
    return (
      <>
        {capitalize(numberWord(topZone.count))} of them on {topZone.name} — and {topKiller.name} was
        there for {numberWord(topKiller.count)}.
      </>
    )
  }
  if (killer) {
    return (
      <>
        {topKiller.name} was responsible for {numberWord(topKiller.count)} of them.
      </>
    )
  }
  if (zone) {
    return (
      <>
        {capitalize(numberWord(topZone.count))} of them on {topZone.name}.
      </>
    )
  }
  return <>No single killer or location stands out — they were spread across the map.</>
}

const WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten']
function numberWord(n) {
  return WORDS[n] ?? String(n)
}
function capitalize(s) {
  return s.charAt(0).toUpperCase() + s.slice(1)
}
