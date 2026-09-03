// In dev, vite proxies /api to localhost:8080 so this stays relative.
// In production set VITE_API_BASE to the deployed backend's origin.
const BASE = import.meta.env.VITE_API_BASE ?? ''

class ApiError extends Error {
  constructor(message, status) {
    super(message)
    this.status = status
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// The backend runs on a paid instance that does not sleep, so there is no
// cold start to wait out. Redeploys and transient upstream blips can still
// return 502/503/504 for a few seconds, so a short retry stays worthwhile —
// but it is measured in seconds now, not the ~90s a free-tier wake needed.
// Keep this bounded: a long retry turns a genuinely dead backend into a hang.
const TRANSIENT = new Set([502, 503, 504])
const MAX_WAIT_MS = 20_000

async function get(path) {
  const started = Date.now()
  let attempt = 0

  while (true) {
    attempt++
    let res
    try {
      res = await fetch(`${BASE}${path}`)
    } catch {
      if (Date.now() - started < MAX_WAIT_MS) {
        await sleep(Math.min(1000 * attempt, 5000))
        continue
      }
      throw new ApiError("Couldn't reach the server. Check your connection and try again.", 0)
    }

    if (res.ok) return res.json()

    if (TRANSIENT.has(res.status) && Date.now() - started < MAX_WAIT_MS) {
      await sleep(Math.min(1000 * attempt, 5000))
      continue
    }

    // 404 from the player lookup is a real answer, not a transient failure.
    throw new ApiError(`Request failed (${res.status})`, res.status)
  }
}

export function findPlayer(gameName, tagLine) {
  return get(`/api/player/${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}`)
}

export function findMatches(puuid) {
  return get(`/api/player/matches/${encodeURIComponent(puuid)}`)
}

export function findAnalysis(matchId, participantId) {
  return get(`/api/analysis/${encodeURIComponent(matchId)}/${participantId}`)
}

/**
 * Every ranked game the overview screen needs, in one request.
 *
 * This used to be three calls per game from the browser — match detail to map
 * puuid to a participant number, then the analysis itself. Twenty games that
 * way was sixty round trips; the backend now resolves the participant itself.
 */
export function findOverview(puuid, count = 20) {
  return get(`/api/overview/${encodeURIComponent(puuid)}?count=${count}`)
}

/**
 * The analysis endpoint is keyed by participant id (1-10), but we only know the
 * player's puuid. Match details carries the mapping, so we resolve it here.
 *
 * Still used by the single-match deep dive reached from the rail. The overview
 * no longer needs it.
 */
export async function findParticipantId(matchId, puuid) {
  const match = await get(`/api/match/${encodeURIComponent(matchId)}`)
  const participants = match?.info?.participants ?? []
  const me = participants.find((p) => p.puuid === puuid)
  if (!me) throw new ApiError('That player is not in this match.', 404)
  return { participantId: me.participantId, champion: me.championName }
}

export { ApiError }
