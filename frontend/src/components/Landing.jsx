import { useMemo } from 'react'
import Minimap from './Minimap'
import { DEMO_DEATHS, DEMO_GAMES, DEMO_STATS, DEMO_ACCOUNT } from '../demoData'
import { championIcon } from '../stats'

/**
 * The landing page.
 *
 * It opens on the product rather than on a description of it: a full-bleed
 * heatmap of a real account's twenty games, with the search sitting inside it.
 * Everything on this page is measured data from `demoData.js`, attributed on
 * screen as a sample — a hero built from invented coordinates would misrepresent
 * what the tool actually returns.
 */
export default function Landing({ riotId, setRiotId, onSearch, onDemo, busy, children }) {
  const objDeaths = useMemo(() => DEMO_DEATHS.filter((d) => d.obj), [])
  const s = DEMO_STATS

  return (
    <div className="landing">
      <div className="lp-stage">
        <div className="lp-bg">
          <Minimap deaths={DEMO_DEATHS} art decorative />
        </div>
        <div className="lp-scrim" />

        <div className="lp-fore">
          <div className="lp-nav">
            <span className="wordmark">
              LEAGUE<span>ANALYZER</span>
            </span>
            <span className="lp-navright">Ranked Solo · last 20 games</span>
          </div>

          <div className="lp-card">
            <h1>
              Twenty games. Every death. <em>One map.</em>
            </h1>
            <p className="lp-lede">
              Where you died across a whole ranked stretch, and whether dying more is actually
              costing you the win.
            </p>
            <form className="lp-form" onSubmit={onSearch}>
              <input
                value={riotId}
                onChange={(e) => setRiotId(e.target.value)}
                placeholder="Riot ID, e.g. LittleChaddha#NA1"
                aria-label="Riot ID"
                autoFocus
              />
              <button type="submit" className="btn" disabled={!!busy}>
                {busy ? 'Working…' : 'Analyze'}
              </button>
            </form>
            <p className="lp-demo">
              No Riot ID handy?{' '}
              <button type="button" onClick={onDemo} disabled={!!busy}>
                See it with {DEMO_ACCOUNT.gameName}#{DEMO_ACCOUNT.tagLine}
              </button>
            </p>
            {children}
          </div>
        </div>

        {/* No density layer on the landing, so no ramp to explain. Says what the
            dots actually are instead. */}
        <div className="lp-legend">
          <span>{DEMO_STATS.total} deaths</span>
          <i className="dot" />
          <span>{DEMO_STATS.critical} critical</span>
        </div>
      </div>

      <div className="lp-proof">
        <p>
          Above is one real account's last 20 ranked games — <strong>{s.total} deaths</strong>,{' '}
          <strong>{s.topZoneCount}</strong> in {s.topZone} alone. Split those games at six deaths
          and the record splits with them: <span className="win">{s.loPct}% won</span> under six
          deaths, <span className="loss">{s.hiPct}%</span> at six or more.
        </p>
      </div>

      <div className="lp-strip">
        <h2>What you get</h2>
        <div className="lp-shots">
          <figure className="lp-shot">
            <div className="lp-win">
              <Minimap deaths={objDeaths} art decorative />
            </div>
            <figcaption>
              <strong>Filter to critical deaths.</strong> {s.critical} of {s.total} happened with
              Baron or a Drake alive — a different map from the other {s.total - s.critical}.
            </figcaption>
          </figure>

          <figure className="lp-shot">
            <div className="lp-win">
              <MiniSplit s={s} />
            </div>
            <figcaption>
              <strong>Move the line yourself.</strong> Win rate above and below any death count, with
              the sample size on both sides so you can see when it is too thin to trust.
            </figcaption>
          </figure>

          <figure className="lp-shot">
            <div className="lp-win">
              <MiniRail />
            </div>
            <figcaption>
              <strong>Open any single game.</strong> Every death with its killer, its zone, and the
              objective state at that moment.
            </figcaption>
          </figure>
        </div>
      </div>
    </div>
  )
}

function MiniSplit({ s }) {
  const rows = [
    ['Under 6', s.loPct, 'win'],
    ['6 or more', s.hiPct, 'loss'],
  ]
  return (
    <div className="mini-split">
      {rows.map(([label, pct, tone]) => (
        <div className="mini-row" key={label}>
          <span className="lab">{label}</span>
          <span className="track">
            <span className="w" style={{ width: `${pct}%` }} />
            <span className="l" style={{ width: `${100 - pct}%` }} />
          </span>
          <span className={`out ${tone}`}>{pct}%</span>
        </div>
      ))}
      <span className="mini-n">
        n={s.loN} vs {s.hiN}
      </span>
    </div>
  )
}

/** Mirrors the real rail, so the preview advertises the layout that ships. */
function MiniRail() {
  return (
    <div className="mini-rail">
      {DEMO_GAMES.slice(0, 5).map((g) => (
        <span className={`mini-game${g.win ? ' w' : ' l'}`} key={g.i}>
          <span className="edge" />
          <img
            className="c-champ"
            src={championIcon(g.champion)}
            alt={g.champion}
            title={g.champion}
            loading="lazy"
            width="22"
            height="22"
          />
          <span className="c-kda">{g.kda}</span>
          <span className="c-dur">{g.duration}</span>
          <span className={`cnt${g.critical > 0 ? ' crit' : ''}`}>
            {g.critical}
            <sub>C</sub>
          </span>
        </span>
      ))}
    </div>
  )
}
