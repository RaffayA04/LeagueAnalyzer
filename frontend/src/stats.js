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
  if (o.monster === 'BARON_NASHOR') return 'BARON'
  return o.subType === 'ELDER_DRAGON' ? 'ELDER' : 'DRAKE'
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
  return `${summary.topZone.count} of your ${summary.total} deaths were on ${summary.topZone.name}, and ${summary.topKiller.name} was the killer in ${summary.topKiller.count}. Hover any death to see what was happening.`
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
