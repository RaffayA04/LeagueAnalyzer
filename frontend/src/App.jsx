import { useEffect, useState } from 'react'
import DeathAnalysis from './components/DeathAnalysis'
import Overview from './components/Overview'
import Landing from './components/Landing'
import { findPlayer, findOverview, findParticipantId, findAnalysis } from './api'
import { toDeaths, toOverview } from './stats'
import { DEMO_ACCOUNT } from './demoData'

/**
 * Riot ID -> twenty-game overview -> a single game, opened from the rail.
 *
 * The match picker used to sit between the search and any analysis, which meant
 * choosing a game before there was anything to choose it on. It now lives
 * inside the overview, where each game already carries its champion, result and
 * death count — and where the aggregate stays on screen as the comparison.
 */
export default function App() {
  const [stage, setStage] = useState('search') // search | overview | analysis
  const [busy, setBusy] = useState(null)
  const [error, setError] = useState(null)

  const [riotId, setRiotId] = useState('')
  const [player, setPlayer] = useState(null)
  const [overview, setOverview] = useState(null)
  const [matchId, setMatchId] = useState(null)
  const [deaths, setDeaths] = useState([])
  const [objectives, setObjectives] = useState([])

  function onSearch(e) {
    e.preventDefault()
    const [gameName, tagLine] = riotId.split('#')
    if (!gameName || !tagLine) {
      setError('Enter a full Riot ID, including the tag — for example LittleChaddha#NA1.')
      return
    }
    return analyze(gameName.trim(), tagLine.trim(), riotId)
  }

  /** The landing page's one-click demo. A visitor who has never played still
   *  needs to be able to see the product work. */
  function onDemo() {
    const label = `${DEMO_ACCOUNT.gameName}#${DEMO_ACCOUNT.tagLine}`
    setRiotId(label)
    return analyze(DEMO_ACCOUNT.gameName, DEMO_ACCOUNT.tagLine, label)
  }

  async function analyze(gameName, tagLine, label) {
    setError(null)
    setBusy('Looking up that Riot ID')
    try {
      const found = await findPlayer(gameName, tagLine)
      if (!found?.puuid) throw new Error('not found')
      setPlayer(found)
      setBusy('Reading your last 20 ranked games')
      const payload = await findOverview(found.puuid, 20)
      const built = toOverview(payload)
      if (!built.games.length) {
        setError(`No ranked solo games found for "${label}". This screen only reads Ranked Solo/Duo.`)
        return
      }
      setOverview(built)
      setStage('overview')
    } catch (err) {
      setError(
        err?.status === 404 || err?.message === 'not found'
          ? `No player found for "${label}". Check the spelling and the tag after the #.`
          : (err?.message ?? 'Something went wrong.'),
      )
    } finally {
      setBusy(null)
    }
  }

  /**
   * The deep dive. The overview already knows the match, but /api/analysis is
   * keyed by participant number, so that still has to be resolved. The per-game
   * screen is unchanged — this is the same analysis it always rendered.
   */
  async function onOpenGame(game) {
    setError(null)
    setMatchId(game.matchId)
    setBusy('Opening that game')
    try {
      const { participantId } = await findParticipantId(game.matchId, player.puuid)
      const analysis = await findAnalysis(game.matchId, participantId)
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
    // The control says "search a different player", so leaving the old Riot ID
    // in the field contradicts it.
    setRiotId('')
    setPlayer(null)
    setOverview(null)
    setMatchId(null)
    setDeaths([])
    setObjectives([])
    setError(null)
  }

  if (stage === 'analysis') {
    return (
      <div className="shell">
        <DeathAnalysis
          deaths={deaths}
          objectives={objectives}
          matchId={matchId}
          player={player}
          onBack={() => setStage('overview')}
        />
      </div>
    )
  }

  if (stage === 'overview') {
    return (
      <div className="shell">
        {busy && <Busy what={busy} />}
        {error && <div className="notice">{error}</div>}
        <Overview overview={overview} player={player} onOpenGame={onOpenGame} onBack={reset} />
      </div>
    )
  }

  return (
    <Landing
      riotId={riotId}
      setRiotId={setRiotId}
      onSearch={onSearch}
      onDemo={onDemo}
      busy={busy}
    >
      {busy && <Busy what={busy} />}
      {error && <div className="notice">{error}</div>}
    </Landing>
  )
}

/**
 * A silent spinner reads as a broken site, so this always says what it is
 * waiting on. Twenty games is forty Riot calls on a cold cache — measured at
 * ~2.8s — so the copy names that rather than apologising for the host.
 */
function Busy({ what }) {
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    setElapsed(0)
    const id = setInterval(() => setElapsed((e) => e + 1), 1000)
    return () => clearInterval(id)
  }, [what])

  let why = 'Twenty games is forty requests to Riot, so this takes a moment.'
  if (elapsed >= 6) why = "Still fetching from Riot's API — hang tight."

  return (
    <div className="loading">
      <span className="what">{what}…</span>
      <span className="why">{why}</span>
      <span className="skel" />
      {elapsed >= 3 && <span className="why elapsed">{elapsed}s</span>}
    </div>
  )
}
