# LeagueAnalyzer

**Finds out where and why a League of Legends player is dying, by replaying the match timeline and reconstructing what was happening on the map at the moment of each death.**

Most stats sites tell you *that* you died 8 times. LeagueAnalyzer tells you that you died in the Baron pit at 27:15 while Baron was alive and the enemy team held two dragons — which is the difference between a number and a reason.

Spring Boot REST backend (Java 17) with a React frontend.

---

## What it does today

Given a Riot ID, it resolves the account, pulls recent matches, and for any match produces a per-death breakdown containing:

- **When** — timestamp in both `mm:ss` and raw milliseconds
- **Who** — the killing champion and every assisting champion, resolved from participant IDs to names
- **Where** — raw in-game coordinates, pixel coordinates for a 512×512 minimap, and a named map region
- **What was at stake** — whether Baron and Dragon were alive at that instant, which team took each of them last, and whether that team was yours

That last group is the point of the project. Location alone is reporting; location plus objective state is the beginning of coaching.

---

## Example response

`GET /api/analysis/NA1_5123456789/3`

```json
[
  {
    "death": {
      "timestamp": "27:15",
      "timestampMs": 1635000,
      "killerChampion": "LeeSin",
      "assistChampions": "Ahri, Thresh",
      "x": 2900,
      "y": 11200,
      "pixelX": 103,
      "pixelY": 129,
      "zone": "Baron Pit"
    },
    "objectives": {
      "baronAlive": true,
      "dragonAlive": true,
      "lastBaronTakenBy": null,
      "lastDragonTakenBy": 200,
      "myTeamTookLastBaron": false,
      "myTeamTookLastDragon": false
    }
  }
]
```

Read that as: *you died in the Baron pit while Baron was up, with the enemy team holding the last two dragons.* A heatmap alone would have shown a dot near Baron and told you nothing.

---

## Architecture

```
Controller  ──►  Service / Analyzer  ──►  RiotApiClient  ──►  Riot API
```

| Component | Responsibility |
|---|---|
| `RiotApiClient` | The only class that talks to Riot. Returns **raw JSON strings**, not deserialized objects. |
| `SummonerService` | Resolves a Riot ID to a PUUID and match list; parses into typed `record` responses. |
| `MatchAnalysisService` | Joins death events with objective state. This is what produces the coaching output. |
| `TimeAnalyzer` | Walks every timeline frame, filters `CHAMPION_KILL` events for the target participant, resolves killer/assist IDs to champion names. |
| `ObjectiveAnalyzer` | Reconstructs Baron/Dragon state at an arbitrary timestamp from `ELITE_MONSTER_KILL` events. |
| `MapCoordinateConverter` | World coordinates → minimap pixels. |
| `ZoneClassifier` | World coordinates → named map region. |

**A deliberate decision worth explaining:** Riot's timeline payloads are large and deeply nested, and only a handful of fields matter here. Rather than mapping full POJOs for every Riot schema, the client returns raw JSON and analyzers navigate it with Jackson `JsonNode` trees, pulling only what they need. This keeps the code resilient to Riot adding fields — schema changes elsewhere in the payload don't break parsing — at the cost of losing compile-time type safety on Riot's side. Internal DTOs *are* typed: everything crossing an API boundary is a Java `record`.

### Two problems that were harder than they look

**Coordinate conversion.** Riot's world space runs roughly −120 to 14,870 on X and −120 to 14,980 on Y, with the origin at the **bottom-left**. Image coordinates put the origin at the **top-left**. Converting a death position to a minimap pixel means normalizing against the world bounds and then inverting the Y axis — miss the inversion and every death renders mirrored across the horizontal, which looks plausible enough to ship by accident.

**Objective state is not in the data.** Riot's timeline records objective *kills*, not objective *availability*. Answering "was Baron alive when this player died?" requires simulating the spawn/respawn cycle: Baron spawns at 25:00 and respawns 6 minutes after each kill; Dragon spawns at 5:00 and respawns 5 minutes after each kill. `ObjectiveAnalyzer` walks the kill list forward, advancing the next-spawn time on each kill, and answers availability for any timestamp. Dragon soul is handled as a terminating condition — once a team takes its fourth elemental drake, elementals stop spawning for the rest of the game and `dragonAlive` is false from that point on. Elder Dragon runs on its own separate timer and is deliberately out of scope.

---

## API

| Method | Endpoint | Returns |
|---|---|---|
| `GET` | `/` | Health check |
| `GET` | `/api/player/{gameName}/{tagLine}` | `SummonerResponse` — puuid, gameName, tagLine |
| `GET` | `/api/player/matches/{puuid}` | `MatchListResponse` — typed match ID list |
| `GET` | `/api/matches/{puuid}` | Raw Riot match ID JSON |
| `GET` | `/api/match/{matchId}` | Raw Riot match detail JSON |
| `GET` | `/api/timeline/{matchId}` | Raw Riot timeline JSON |
| `GET` | `/api/deaths/{matchId}/{participantId}` | `List<DeathEvent>` — location and killer only |
| `GET` | `/api/analysis/{matchId}/{participantId}` | `List<AnalyzedDeath>` — **deaths + objective context** |

`/api/analysis` is the endpoint that matters; `/api/deaths` is the layer beneath it.

### Map regions

`ZoneClassifier` resolves a coordinate to one of twelve regions: Baron Pit, Dragon Pit, Blue Base, Red Base, Top Lane, Mid Lane, Bot Lane, River, and the four jungle quadrants (Blue Top, Blue Bot, Red Top, Red Bot).

The classifier is built on the map's two diagonals rather than a patchwork of boxes:

```
mid lane   runs along   x == y
the river  runs along   x + y == 14870      (the perpendicular diagonal)
```

Both are confirmed against fixed landmarks — Baron spawns at `(5007, 10471)` and Dragon at `(9857, 4422)`, and both sit on the river diagonal. Those two lines also cut the remaining space into the four jungle quadrants: the river separates blue's half from red's, the mid diagonal separates the top side from the bottom.

Checks are ordered and **the first match wins**: pits → bases → lanes → river → mid → jungle. Where mid crosses the river at the map's centre, river wins, which matches the real map.

Both outer lanes are **L-shaped** — top runs up the left edge *and* across the top; bot runs along the bottom *and* up the right edge. `LANE_DEPTH` and `BASE_DEPTH` are tuning constants rather than derived facts: because the two L-shapes wrap the whole perimeter, lane depth trades directly against jungle area.

An earlier version had mid and the river swapped, used a Baron Pit box that excluded Baron's own spawn, and left roughly a quarter of the map unclassified. `ZoneClassifierTest` now pins the landmark positions and sweeps a grid to assert **no playable coordinate returns "Unknown"**.

---

## Running it

Requires **Java 17**, Maven, and Node. The backend and frontend run as two processes.

**Backend** — from `backend/`:

```bash
cd backend
mvn spring-boot:run          # http://localhost:8080
mvn test                     # run tests
mvn clean package            # build the executable jar
```

**Frontend** — from `frontend/`, in a second terminal:

```bash
cd frontend
npm install                  # first run only
npm run dev                  # http://localhost:5173
npm run build                # static bundle into dist/
```

Open `http://localhost:5173`. In development Vite proxies `/api` to the backend, so the browser sees a single origin.

### Required configuration

`src/main/resources/application.properties` is **gitignored and absent from a fresh clone**. The app will not start without it, because `RiotApiClient` injects `${riot.api.key}`. Create it:

```properties
riot.api.key=RGAPI-your-key-here
```

**Riot development API keys expire every 24 hours.** If requests start failing after they were working, refresh the key at [developer.riotgames.com](https://developer.riotgames.com) before debugging anything else.

Prefer the system `mvn` over `./mvnw` — the wrapper's `maven-wrapper.properties` is currently misplaced in the source tree rather than beside `mvnw`.

### Deploying

The dev proxy hides cross-origin requests; a deployed frontend does not get that. Two settings are required, and forgetting either produces a frontend that silently renders nothing against a perfectly healthy backend:

```properties
# backend — who is allowed to call the API
frontend.origins=https://your-frontend-url
```

```bash
# frontend — where the API lives
VITE_API_BASE=https://your-backend-url
```

---

## Known limitations

Stated plainly, because they're real and they shape what comes next.

- **Match lookups are hardcoded to the 10 most recent games** (`start=0&count=10`). No pagination, no date filtering.
- **Region is hardcoded to `americas`.** Players on other regional routing hosts won't resolve.
- **No caching and no rate-limit handling.** Analyzing a single match costs 2 Riot calls; analyzing 10 costs 20–30. Development keys throttle almost immediately at that volume, so multi-match analysis is blocked until a caching layer exists.
- **No persistence.** Every request re-fetches from Riot. Nothing is stored between runs.
- **Errors are swallowed.** `SummonerService` returns `null` and `TimeAnalyzer` returns an empty list when parsing fails, so a failure is currently indistinguishable from a legitimately empty result. This needs real error propagation.
- **Test coverage is uneven.** The analyzers are covered against a real committed timeline fixture; the client, services, and controllers are not tested at all.
- **The match picker shows raw match IDs.** Riot's match-list endpoint returns nothing but IDs, so champion, queue type, and K/D/A would each cost an extra match-detail call. That belongs behind a summary endpoint once caching exists.
- **The frontend resolves participant IDs the expensive way.** `/api/analysis` is keyed by participant number, so the browser fetches full match detail just to map a PUUID to a participant.

---

## Roadmap

**Phase 1 — First real coaching insight** ✅ *Complete*
Objective context analyzer. Deaths joined with Baron/Dragon state at the moment they happened.

**Phase 2 — Visualization primitive**
Death heatmap over the minimap, using the pixel coordinates already produced.

**Phase 3 — Foundation for scale**
PostgreSQL persistence, plus a caching and rate-limit layer in front of the Riot client. Nothing past Phase 2 is possible without it — multi-match analysis is entirely blocked on this.

**Phase 4 — Core product**
Mistake detection engine, then an LLM-driven coach reading the structured analysis output.

**Phase 5 — Frontend** *In progress*
Player search, match picker, and the per-match death analysis are built: a CSS-drawn minimap plotting each death, hover linking the map to the list in both directions, and killer/zone filters. Heatmap rendering and coaching display follow their backend phases.

**Phase 6 — Replay rendering** *(separate track, deliberately deferred)*
`.rofl` processing and GPU clip generation. Coaching does not depend on rendered video, which is why this sits last rather than blocking the product.

Full detail in [`PRD.md`](PRD.md).

---

## Tech stack

**Backend** — Java 17 · Spring Boot 3.4.1 · Maven · Jackson · `RestTemplate` · JUnit 5 · Riot Games API
**Frontend** — React 18 · Vite · plain CSS (no UI framework)
