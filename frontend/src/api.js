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

// Free hosting sleeps after 15 minutes idle and takes ~a minute to wake. During
// that window requests either hang or come back 502/503/504, so the first call
// is retried rather than reported as a failure.
const WAKING = new Set([502, 503, 504])
const MAX_WAIT_MS = 90_000

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
      throw new ApiError("Couldn't reach the server. It may be starting up — try again in a minute.", 0)
    }

    if (res.ok) return res.json()

    if (WAKING.has(res.status) && Date.now() - started < MAX_WAIT_MS) {
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
 * The analysis endpoint is keyed by participant id (1-10), but we only know the
 * player's puuid. Match details carries the mapping, so we resolve it here.
 */
export async function findParticipantId(matchId, puuid) {
  const match = await get(`/api/match/${encodeURIComponent(matchId)}`)
  const participants = match?.info?.participants ?? []
  const me = participants.find((p) => p.puuid === puuid)
  if (!me) throw new ApiError('That player is not in this match.', 404)
  return { participantId: me.participantId, champion: me.championName }
}

export { ApiError }
