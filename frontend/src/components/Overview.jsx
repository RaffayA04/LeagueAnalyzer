import { useMemo, useState } from 'react'
import Minimap from './Minimap'
import ThresholdSplit from './ThresholdSplit'
import { overviewSummary, topChampion, splashUrl } from '../stats'
import { peakDensity } from '../mapGeometry'

/**
 * The twenty-game screen: where you die across a whole ranked stretch, and
 * whether dying more actually costs you games.
 *
 * The rail is a filter, not a menu. Selecting a game narrows the heatmap in
 * place so the aggregate stays on screen as the baseline you are comparing
 * against; opening the full per-game breakdown is a separate, explicit action.
 */
export default function Overview({ overview, player, onOpenGame, onBack }) {
  const [selected, setSelected] = useState(null)
  const [objOnly, setObjOnly] = useState(false)
  // Off by default: the client art carries its own contrast, and a full-strength
  // density wash erases the terrain the dots are supposed to be read against.
  const [density, setDensity] = useState(false)
  const [threshold, setThreshold] = useState(6)

  const summary = useMemo(() => overviewSummary(overview), [overview])

  // The champion this stretch of games was actually played on. Data Dragon is
  // hotlinked rather than bundled: the art is Riot's and changes per patch.
  const splash = useMemo(() => splashUrl(topChampion(overview.games)), [overview.games])

  // Normalise the heat against every death, not against what is on screen, so
  // filtering to one game reads as sparse instead of re-scaling itself hot.
  const peak = useMemo(() => peakDensity(overview.deaths), [overview.deaths])

  const shown = useMemo(() => {
    let d = overview.deaths
    if (selected !== null) d = d.filter((x) => x.game === selected)
    if (objOnly) d = d.filter((x) => x.obj)
    return d
  }, [overview.deaths, selected, objOnly])

  const game = selected === null ? null : overview.games[selected]
  const playable = overview.games.filter((g) => g.ok)

  return (
    <div className="console">
      {splash && (
        <div
          className="c-ambient"
          style={{ backgroundImage: `url(${splash})` }}
          aria-hidden="true"
        />
      )}
      <header className="c-head">
        <button type="button" className="c-back" onClick={onBack} aria-label="Search a different player">
          <span aria-hidden="true">←</span>
        </button>
        <span className="c-id">
          {player.gameName} <span className="tag">#{player.tagLine}</span>
        </span>
        <div className="c-readouts">
          <Readout k="Games" v={summary.games} />
          <Readout k="Record" v={`${summary.wins}–${summary.losses}`} tone="cy" />
          <Readout k="Deaths" v={summary.totalDeaths} />
          <Readout k="Per game" v={summary.perGame} />
          <Readout k="Hot zone" v={summary.topZone ? summary.topZone[0] : '—'} tone="rd" />
          <Readout k="Obj. live" v={summary.objectiveDeaths} tone="am" />
        </div>
      </header>

      {summary.missing > 0 && (
        <p className="c-shortfall">
          {summary.games} of {overview.requested} ranked games analyzed.{' '}
          {summary.missing} could not be read from Riot, so {summary.missing === 1 ? 'its' : 'their'}{' '}
          deaths are not on this map.
        </p>
      )}

      <div className="c-cols">
        <aside className="c-rail">
          <div className="c-rail-head">
            <h3>{game ? `${game.champion} · ${game.duration}` : `All ${playable.length} games`}</h3>
            {selected === null ? (
              <span className="c-hint">select to filter</span>
            ) : (
              <button type="button" className="c-clear" onClick={() => setSelected(null)}>
                clear
              </button>
            )}
          </div>

          {game && (
            <button type="button" className="c-open" onClick={() => onOpenGame(game)}>
              Open full analysis <span aria-hidden="true">→</span>
            </button>
          )}

          <div className="c-games">
            {overview.games.map((g) => (
              <button
                key={g.matchId}
                type="button"
                className={`c-game${g.win ? ' w' : ' l'}${g.deaths >= threshold ? ' hi' : ''}${g.ok ? '' : ' dead'}`}
                aria-pressed={selected === g.i}
                disabled={!g.ok}
                onClick={() => setSelected((s) => (s === g.i ? null : g.i))}
              >
                <span className="edge" />
                <span className="who">
                  <span className="ch">{g.ok ? g.champion : 'Unavailable'}</span>
                  <span className="kd">{g.ok ? `${g.kda} · ${g.duration}` : g.status.toLowerCase().replace(/_/g, ' ')}</span>
                </span>
                <span className="cnt">
                  {g.ok ? g.deaths : '—'}
                  {g.ok && <sub>D</sub>}
                </span>
              </button>
            ))}
          </div>
        </aside>

        <section className="c-view">
          <div className="c-mapzone">
            <div className="c-mapbox">
              <Minimap deaths={shown} art heat={density} heatPeak={peak} />
              <div className="c-maplegend">
                <label className="c-toggle">
                  <input
                    type="checkbox"
                    checked={density}
                    onChange={(e) => setDensity(e.target.checked)}
                  />
                  <span>Density</span>
                </label>
                {density && (
                  <span className="ramp">
                    Sparse <span className="bar" /> Dense
                  </span>
                )}
                <label className="c-toggle">
                  <input
                    type="checkbox"
                    checked={objOnly}
                    onChange={(e) => setObjOnly(e.target.checked)}
                  />
                  <span>Baron or Drake up</span>
                </label>
                <span className="c-count">
                  {shown.length} {shown.length === 1 ? 'death' : 'deaths'}
                  {selected === null ? ` across ${playable.length} games` : ' in this game'}
                </span>
              </div>
            </div>
          </div>

          <ThresholdSplit games={overview.games} k={threshold} onChange={setThreshold} />
        </section>
      </div>
    </div>
  )
}

function Readout({ k, v, tone }) {
  return (
    <span className="c-ro">
      <span className="k">{k}</span>
      <span className={`v${tone ? ' ' + tone : ''}`}>{v}</span>
    </span>
  )
}
