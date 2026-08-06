import { useEffect, useState } from 'react'
import DeathAnalysis from './components/DeathAnalysis'
import { findPlayer, findMatches, findParticipantId, findAnalysis } from './api'
import { toDeaths } from './stats'

// Screens 1 and 2 were not part of the design file, so they are deliberately
// plain — enough to reach the analysis screen, which is the designed one.
export default function App() {
  const [stage, setStage] = useState('search') // search | matches | analysis
  const [busy, setBusy] = useState(null)
  const [error, setError] = useState(null)

  const [riotId, setRiotId] = useState('')
  const [player, setPlayer] = useState(null)
  const [matchIds, setMatchIds] = useState([])
  const [matchId, setMatchId] = useState(null)
  const [deaths, setDeaths] = useState([])
  const [objectives, setObjectives] = useState([])

  async function onSearch(e) {
    e.preventDefault()
    const [gameName, tagLine] = riotId.split('#')
    if (!gameName || !tagLine) {
      setError('Enter a full Riot ID, including the tag — for example Raffay#NA1.')
      return
    }
    setError(null)
    setBusy('Looking up that Riot ID')
    try {
      const found = await findPlayer(gameName.trim(), tagLine.trim())
      if (!found?.puuid) throw new Error('not found')
      setPlayer(found)
      setBusy('Fetching recent matches')
      const list = await findMatches(found.puuid)
      setMatchIds(list?.matchIds ?? [])
      setStage('matches')
    } catch (err) {
      setError(
        err?.status === 404 || err?.message === 'not found'
          ? `No player found for "${riotId}". Check the spelling and the tag after the #.`
          : (err?.message ?? 'Something went wrong.'),
      )
    } finally {
      setBusy(null)
    }
  }

  async function onPickMatch(id) {
    setError(null)
    setMatchId(id)
    setBusy('Finding you in this match')
    try {
      const { participantId } = await findParticipantId(id, player.puuid)
      setBusy('Reconstructing the timeline')
      const analysis = await findAnalysis(id, participantId)
      setDeaths(toDeaths(analysis.deaths ?? []))
      setObjectives(analysis.objectives ?? [])
      setStage('analysis')
    } catch (err) {
      setError(err?.message ?? 'Could not analyze that match.')
      setMatchId(null)
    } finally {
      setBusy(null)
    }
  }

  function reset() {
    setStage('search')
    setPlayer(null)
    setMatchIds([])
    setMatchId(null)
    setDeaths([])
    setObjectives([])
    setError(null)
  }

  if (stage === 'analysis') {
    return (
      <div className="shell">
        <DeathAnalysis deaths={deaths} objectives={objectives} matchId={matchId} player={player} />
        <p style={{ marginTop: 20 }}>
          <button type="button" className="btn-quiet" onClick={() => setStage('matches')}>
            ← Pick another match
          </button>
        </p>
      </div>
    )
  }

  if (stage === 'matches') {
    return (
      <div className="entry">
        <h1>Recent matches</h1>
        <p className="lede">
          {player.gameName}#{player.tagLine} — your {matchIds.length} most recent games. Riot only
          gives us match IDs here, so there is nothing else to show until one is opened.
        </p>
        {busy ? (
          <Busy what={busy} />
        ) : (
          <div className="matches">
            {matchIds.map((id, i) => (
              <button key={id} type="button" className="match-btn" onClick={() => onPickMatch(id)}>
                <span>{id}</span>
                <span className="n">{i === 0 ? 'most recent' : `#${i + 1}`}</span>
              </button>
            ))}
          </div>
        )}
        {error && <div className="notice">{error}</div>}
        <p style={{ marginTop: 24 }}>
          <button type="button" className="btn-quiet" onClick={reset}>
            ← Search a different player
          </button>
        </p>
      </div>
    )
  }

  return (
    <div className="entry">
      <h1>
        LEAGUE<span style={{ color: 'var(--blue)' }}>ANALYZER</span>
      </h1>
      <p className="lede">
        Where you died last game, and what was happening on the map when you did.
      </p>
      <form className="field" onSubmit={onSearch}>
        <input
          value={riotId}
          onChange={(e) => setRiotId(e.target.value)}
          placeholder="Riot ID, e.g. Raffay#NA1"
          aria-label="Riot ID"
          autoFocus
        />
        <button type="submit" className="btn" disabled={!!busy}>
          {busy ? 'Working…' : 'Analyze'}
        </button>
      </form>
      {busy && <Busy what={busy} />}
      {error && <div className="notice">{error}</div>}
    </div>
  )
}

/**
 * A silent spinner during a 60-second cold start reads as a broken site. This
 * escalates its explanation the longer the wait runs, so a slow first request
 * looks like a known tradeoff rather than a hang.
 */
function Busy({ what }) {
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    setElapsed(0)
    const id = setInterval(() => setElapsed((e) => e + 1), 1000)
    return () => clearInterval(id)
  }, [what])

  let why = "Riot's timeline is about 1.2 MB, so this takes a moment."
  if (elapsed >= 20) {
    why = 'Still waking up. A cold start takes about a minute — it stays fast afterwards.'
  } else if (elapsed >= 5) {
    why = 'The server sleeps when idle on free hosting, so the first request has to wake it.'
  }

  return (
    <div className="loading">
      <span className="what">{what}…</span>
      <span className="why">{why}</span>
      <span className="skel" />
      {elapsed >= 5 && <span className="why elapsed">{elapsed}s</span>}
    </div>
  )
}
