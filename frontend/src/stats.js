/** Flattens the API's AnalyzedDeath shape into what the screen renders. */
export function toDeaths(analysis) {
  return analysis.map((a) => {
    const d = a.death
    const o = a.objectives ?? {}
    return {
      t: d.timestamp,
      tMs: d.timestampMs,
      zone: d.zone,
      killer: d.killerChampion,
      assists: d.assistChampions,
      // Pixel coords are kept for any consumer plotting onto a 512px image.
      x: d.pixelX,
      y: d.pixelY,
      // World coords are what the minimap plots from — the same numbers the map
      // itself is built out of, so a dot and its region cannot disagree.
      wx: d.x,
      wy: d.y,
      // Baron outranks Drake when both happen to be up.
      obj: o.baronAlive ? 'baron' : o.dragonAlive ? 'drake' : null,
      objTakenByMyTeam: o.baronAlive ? o.myTeamTookLastBaron : o.myTeamTookLastDragon,
    }
  })
}

function countBy(deaths, key) {
  const counts = {}
  for (const d of deaths) counts[d[key]] = (counts[d[key]] || 0) + 1
  return counts
}

function topOf(counts) {
  const entries = Object.entries(counts).sort((a, b) => b[1] - a[1])
  return entries.length ? { name: entries[0][0], count: entries[0][1] } : null
}

/** Longest run of consecutive deaths that all happened in the same zone. */
function longestStreak(deaths, zone) {
  let best = { len: 0, from: null, to: null }
  let run = 0
  let start = null
  deaths.forEach((d, i) => {
    if (d.zone === zone) {
      if (run === 0) start = i
      run++
      if (run > best.len) best = { len: run, from: deaths[start].t, to: d.t }
    } else {
      run = 0
    }
  })
  return best
}

export function summarize(deaths) {
  const total = deaths.length
  if (!total) return { total: 0 }

  const zones = countBy(deaths, 'zone')
  const killers = countBy(deaths, 'killer')
  const topZone = topOf(zones)
  const topKiller = topOf(killers)

  const killerDeaths = deaths.filter((d) => d.killer === topKiller.name)
  const objDeaths = deaths.filter((d) => d.obj)
  const notable = objDeaths.find((d) => d.obj === 'baron') ?? objDeaths[0] ?? null

  return {
    total,
    zones,
    killers,
    topZone,
    topKiller,
    topKillerFirst: killerDeaths[0]?.t,
    topKillerLast: killerDeaths[killerDeaths.length - 1]?.t,
    streak: longestStreak(deaths, topZone.name),
    objCount: objDeaths.length,
    notable,
  }
}

/** Chips exist only for values that repeat — a one-off filter is noise. */
export function buildChips(summary) {
  if (!summary.total) return []
  const repeated = (counts) => Object.entries(counts).filter(([, n]) => n > 1).sort((a, b) => b[1] - a[1])
  return [
    ...repeated(summary.killers).map(([v, n]) => ({ k: 'killer', v, n, isZone: false })),
    ...repeated(summary.zones).map(([v, n]) => ({ k: 'zone', v, n, isZone: true })),
  ]
}

const DRAKE_NAMES = {
  HEXTECH_DRAGON: 'Hextech Drake',
  CHEMTECH_DRAGON: 'Chemtech Drake',
  AIR_DRAGON: 'Cloud Drake',
  EARTH_DRAGON: 'Mountain Drake',
  FIRE_DRAGON: 'Infernal Drake',
  WATER_DRAGON: 'Ocean Drake',
  ELDER_DRAGON: 'Elder Dragon',
}

export function objectiveLabel(o) {
  if (o.monster === 'BARON_NASHOR') return 'Baron'
  return DRAKE_NAMES[o.subType] ?? 'Drake'
}

/** Short form for tight spaces like the death rows. */
export function objectiveShort(o) {
  if (o.monster === 'BARON_NASHOR') return 'Baron'
  return o.subType === 'ELDER_DRAGON' ? 'Elder' : 'Drake'
}

/**
 * The objective of this kind that fell next after a death. This is the link the
 * per-death flags cannot make: "Baron was up when you died" only matters once
 * you know who ended up taking it.
 */
export function nextObjectiveAfter(objectives, monster, timeMs) {
  return objectives.find((o) => o.monster === monster && o.timestampMs > timeMs) ?? null
}

function gap(fromMs, toMs) {
  const s = Math.round((toMs - fromMs) / 1000)
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  const r = s % 60
  return r ? `${m}m ${r}s` : `${m}m`
}

const NTH = ['first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth', 'tenth']

/** The single line under the summary cards. Changes with hover and filter. */
export function coachLine(deaths, summary, hover, filter, objectives = []) {
  if (hover != null && deaths[hover]) {
    const d = deaths[hover]
    const zone = d.zone.toLowerCase()

    if (d.obj) {
      const monster = d.obj === 'baron' ? 'BARON_NASHOR' : 'DRAGON'
      const name = d.obj === 'baron' ? 'Baron' : 'the Drake'
      const next = nextObjectiveAfter(objectives, monster, d.tMs)

      if (next) {
        const who = next.myTeam ? 'your team took it' : 'the enemy took it'
        return `At ${d.t} you died in the ${zone} with ${name} up — ${who} ${gap(d.tMs, next.timestampMs)} later.`
      }
      return `At ${d.t} you died in the ${zone} with ${name} up — though neither team ended up taking it.`
    }
    const nth = deaths.filter((x, i) => x.killer === d.killer && i <= hover).length
    return `At ${d.t}, ${d.killer}'s ${NTH[nth - 1] ?? `${nth}th`} kill on you — ${d.zone}.`
  }

  if (filter) {
    const n = deaths.filter((d) => d[filter.k] === filter.v).length
    return filter.k === 'killer'
      ? `${filter.v} killed you ${n} ${n === 1 ? 'time' : 'times'} this game. Hover a death for the moment-by-moment context.`
      : `${n} of your ${summary.total} deaths were in ${filter.v}. Hover a death for context.`
  }

  if (!summary.total) return 'No deaths in this game. Nothing to review here.'
  const { total, topZone, topKiller } = summary
  return (
    `You died ${total} ${total === 1 ? 'time' : 'times'}, ` +
    `${topZone.count} ${topZone.count === 1 ? 'death was' : 'deaths were'} at ${topZone.name}. ` +
    `${topKiller.name} killed you ${topKiller.count} ${topKiller.count === 1 ? 'time' : 'times'}.`
  )
}

export function headline(summary) {
  if (!summary.total) return 'You did not die once this game.'
  const { total, topZone, topKiller } = summary
  return {
    total,
    zoneCount: topZone.count,
    zoneName: topZone.name,
    killerName: topKiller.name,
    killerCount: topKiller.count,
  }
}

/* ------------------------------------------------------------------
 * Twenty-game overview
 *
 * Everything below reduces the /api/overview payload. It lives here, not on
 * the backend, for the same reason the rest of this file does: the rule for
 * what counts as a high-death game should exist once, in one language.
 * ------------------------------------------------------------------ */

const mmss = (ms) => {
  const s = Math.round(ms / 1000)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

/** Flattens the overview payload into the shapes the screen renders. */
export function toOverview(payload) {
  const games = (payload?.games ?? []).map((g, i) => ({
    i,
    matchId: g.matchId,
    status: g.status,
    ok: g.status === 'OK',
    champion: g.championName,
    win: g.win,
    kills: g.kills,
    // The scoreboard's death count, which is authoritative. Kept separate from
    // deathEvents.length: the timeline is what we plot, and if the two ever
    // disagree the stat should follow the scoreboard rather than our parse.
    deaths: g.deaths,
    assists: g.assists,
    kda: `${g.kills}/${g.deaths}/${g.assists}`,
    durationMs: g.gameDurationMs,
    duration: mmss(g.gameDurationMs),
    objectives: g.objectives ?? [],
    deathEvents: toDeaths(g.deathEvents ?? []),
  }))

  // Every death across every game, tagged with the game it came from. The
  // heatmap bins these; the rail filters them by `game`.
  const deaths = games.flatMap((g) => g.deathEvents.map((d) => ({ ...d, game: g.i })))

  return {
    puuid: payload?.puuid,
    requested: payload?.requested ?? 0,
    analyzed: payload?.analyzed ?? 0,
    games,
    deaths,
    plotted: deaths.length,
  }
}

/** Games per side below which a percentage is not a rate. */
export const MIN_BUCKET = 5

function rate(games) {
  const n = games.length
  const wins = games.filter((g) => g.win).length
  // null, not 0 — an empty bucket has no win rate, and rendering 0% would
  // read as "you lost them all".
  return { n, wins, losses: n - wins, pct: n ? Math.round((wins / n) * 100) : null }
}

/** Games split at a death-count threshold: fewer than `k`, and `k` or more. */
export function splitAt(games, k) {
  const ok = games.filter((g) => g.ok)
  const below = rate(ok.filter((g) => g.deaths < k))
  const above = rate(ok.filter((g) => g.deaths >= k))
  return {
    k,
    below,
    above,
    gap: below.pct === null || above.pct === null ? null : below.pct - above.pct,
    // Under five games a side, a "win rate" is a tally wearing a percent sign:
    // at n=3 the only possible values are 0, 33, 67 and 100. The screen still
    // shows the split, but says plainly that it is too thin to read.
    thin: below.n < MIN_BUCKET || above.n < MIN_BUCKET,
  }
}

/**
 * The split evaluated at every possible threshold — the response curve behind
 * the draggable line.
 *
 * Deliberately does NOT return a "best" cut. With ~10 candidate thresholds and
 * 20 games, the largest gap is nearly always findable by chance; a tool that
 * auto-selected it would be manufacturing the insight rather than measuring it.
 * The default threshold is chosen up front, and this only shows the shape.
 */
export function thresholdSweep(games) {
  const ok = games.filter((g) => g.ok)
  if (!ok.length) return []
  const max = Math.max(...ok.map((g) => g.deaths))
  const points = []
  for (let k = 1; k <= Math.max(max, 1); k++) points.push(splitAt(games, k))
  return points
}

/** Zones ranked by how many deaths happened in each. */
export function zoneRanking(deaths) {
  const counts = {}
  for (const d of deaths) counts[d.zone] = (counts[d.zone] || 0) + 1
  return Object.entries(counts).sort((a, b) => b[1] - a[1])
}

/** Deaths bucketed by game phase, in minutes. */
export function phaseCounts(deaths) {
  const phases = { early: 0, mid: 0, late: 0 }
  for (const d of deaths) {
    const min = d.tMs / 60000
    if (min < 14) phases.early++
    else if (min < 25) phases.mid++
    else phases.late++
  }
  return phases
}

/** The header readouts. */
export function overviewSummary(o) {
  const ok = o.games.filter((g) => g.ok)
  const wins = ok.filter((g) => g.win).length
  const zones = zoneRanking(o.deaths)
  return {
    games: ok.length,
    wins,
    losses: ok.length - wins,
    totalDeaths: o.deaths.length,
    perGame: ok.length ? (o.deaths.length / ok.length).toFixed(1) : '0.0',
    topZone: zones[0] ?? null,
    zones,
    objectiveDeaths: o.deaths.filter((d) => d.obj).length,
    phases: phaseCounts(o.deaths),
    // Surfaced rather than hidden: a heatmap that claims twenty games has to
    // say when it only has seventeen.
    missing: o.requested - ok.length,
  }
}

/**
 * Splash art URL for a champion, from Riot's Data Dragon CDN.
 *
 * Match-V5's `championName` is already Data Dragon's key for almost every
 * champion (it returns the internal name — "MonkeyKing", not "Wukong"), so this
 * is close to identity. The strip is a guard against the few names that carry
 * punctuation, and against anything unexpected reaching a URL.
 *
 * Data Dragon only serves default splashes, so a player who exclusively plays a
 * skin will see art they may not recognise as theirs.
 */
export function splashUrl(championName) {
  if (!championName) return null
  const key = championName.replace(/[^A-Za-z0-9]/g, '')
  return `https://ddragon.leagueoflegends.com/cdn/img/champion/splash/${key}_0.jpg`
}

/** The champion a player used most across the overview. */
export function topChampion(games) {
  const counts = {}
  for (const g of games) if (g.ok && g.champion) counts[g.champion] = (counts[g.champion] || 0) + 1
  const ranked = Object.entries(counts).sort((a, b) => b[1] - a[1])
  return ranked.length ? ranked[0][0] : null
}
