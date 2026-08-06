/** Flattens the API's AnalyzedDeath shape into what the screen renders. */
export function toDeaths(analysis) {
  return analysis.map((a) => {
    const d = a.death
    const o = a.objectives ?? {}
    return {
      t: d.timestamp,
      zone: d.zone,
      killer: d.killerChampion,
      assists: d.assistChampions,
      x: d.pixelX,
      y: d.pixelY,
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

const NTH = ['first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth', 'tenth']

/** The single line under the summary cards. Changes with hover and filter. */
export function coachLine(deaths, summary, hover, filter) {
  if (hover != null && deaths[hover]) {
    const d = deaths[hover]
    const zone = d.zone.toLowerCase()
    if (d.obj === 'baron') {
      return `At ${d.t} you died in the ${zone} while Baron was up — the fight your team couldn't afford to lose a member in.`
    }
    if (d.obj === 'drake') {
      return `At ${d.t} you died in the ${zone} while the Drake was up — right when the map mattered most.`
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
