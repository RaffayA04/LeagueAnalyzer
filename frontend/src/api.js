// In dev, vite proxies /api to localhost:8080 so this stays relative.
// In production set VITE_API_BASE to the deployed backend's origin.
const BASE = import.meta.env.VITE_API_BASE ?? ''

class ApiError extends Error {
  constructor(message, status) {
    super(message)
    this.status = status
  }
}

async function get(path) {
  let res
  try {
    res = await fetch(`${BASE}${path}`)
  } catch {
    throw new ApiError("Couldn't reach the server. Is the backend running?", 0)
  }
  if (!res.ok) {
    throw new ApiError(`Request failed (${res.status})`, res.status)
  }
  return res.json()
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
