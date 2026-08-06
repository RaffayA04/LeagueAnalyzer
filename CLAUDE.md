# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

LeagueAnalyzer is a Spring Boot REST backend that fetches League of Legends match data from the Riot Games API and analyzes it. It locates and classifies a player's death events on the Summoner's Rift map, and — as of Phase 1 — joins each death with the **objective state of the game at that moment** (was Baron up, was Dragon up, which team took each last). That join is the product's reason to exist: death locations alone are reporting; death locations plus objective context are the beginning of coaching.

All backend code lives under `backend/` (a single Maven module, Java 17, Spring Boot 3.4.1). The React frontend lives under `frontend/` (Vite, plain CSS, no UI framework) and consumes `GET /api/analysis/{matchId}/{participantId}`.

```bash
cd frontend
npm install
npm run dev        # http://localhost:5173, proxies /api to :8080
npm run build      # static bundle into dist/
```

The dev server proxies `/api` so the browser sees one origin. Deployed, the frontend calls the backend cross-origin — set `VITE_API_BASE` to the backend's URL and add that frontend origin to `frontend.origins` (see `config/WebConfig`), or CORS will block every request.

The product vision, roadmap, and phase sequencing live in `PRD.md` at the repo root — read it before planning new features. In short: the near-term goal is automated mistake detection and AI coaching driven by timeline analysis; rendered replay video is a deliberately deferred, separate track (not required for coaching).

`README.md` is the public-facing explanation and is kept current. If you change the architecture or the API surface, update it too.

**Current phase: Phase 1 complete** (objective context analyzer). Phase 2 is the death heatmap. Phase 3 is persistence + caching, which is a hard dependency for all multi-match work.

## Commands

Run all Maven commands from the `backend/` directory. The system `mvn` is on PATH; prefer it over `./mvnw` since the wrapper's `.mvn/wrapper/maven-wrapper.properties` is misplaced (nested under `src/main/java/.../.mvn/`, not beside `mvnw`).

```bash
cd backend
mvn spring-boot:run        # run the app on http://localhost:8080
mvn test                   # run all tests
mvn clean package          # build the executable jar into target/
mvn test -Dtest=BackendApplicationTests#contextLoads   # run a single test method
```

### Required configuration

`src/main/resources/application.properties` is **gitignored** and absent from a fresh checkout, but the app will not start without it — `RiotApiClient` injects `${riot.api.key}`. Create it with at least:

```properties
riot.api.key=RGAPI-your-key-here
```

Riot dev API keys expire every 24 hours, so a working key must be refreshed for local runs. If previously-working requests start failing, check the key before debugging anything else.

## Architecture

Request flow is a conventional layered pipeline: **Controller → Service/Analyzer → RiotApiClient → Riot API**.

### Client

- `client/RiotApiClient` — the only class that talks to Riot. Wraps a `RestTemplate` and returns **raw JSON strings** (not deserialized objects). All endpoints target the `americas` regional routing host. Match ID lookups are hardcoded to the 10 most recent matches (`start=0&count=10`).

### Services

- `service/SummonerService` — parses raw account/match-list JSON into typed `record` responses (`SummonerResponse`, `MatchListResponse`) using a Jackson `ObjectMapper`. Note: on any parse error it returns `null` (swallowed exception).
- `service/MatchAnalysisService` — **the orchestration layer, and the most important class in the project.** Fetches timeline + match detail, resolves the target participant's `teamId` from match detail (the timeline does not carry it), runs `TimeAnalyzer` and `ObjectiveAnalyzer`, and zips each `DeathEvent` with an `ObjectiveContext` into a list of `AnalyzedDeath`. Throws `IllegalArgumentException` if the participant ID isn't in the match.

### Analyzers

- `analyzer/TimeAnalyzer` — walks every timeline frame's events, filters `CHAMPION_KILL` events where the victim is the target participant, resolves killer/assist participant IDs to champion names, and builds `DeathEvent` records. Delegates coordinate and zone work to the two helpers below. Returns an **empty list** on any exception (swallowed).
- `analyzer/ObjectiveAnalyzer` — reconstructs Baron and Dragon **availability** at an arbitrary timestamp, which Riot does not provide directly. The timeline records `ELITE_MONSTER_KILL` events (kills), not availability, so this class simulates the spawn/respawn cycle:
  - Baron spawns at 25:00, respawns 6 minutes after each kill.
  - Dragon spawns at 5:00, respawns 5 minutes after each kill.
  - **Dragon soul is a terminating condition** — once a team takes its 4th elemental drake, elementals stop spawning and `wasDragonAlive` returns false for the rest of the game.
  - **Elder Dragon is deliberately excluded** (the `ELDER_DRAGON` subtype is filtered out) — it runs on a separate timer and is out of scope.
  - Also answers `lastBaronTakenBy` / `lastDragonTakenBy` (nullable — null means not yet taken) and the `myTeam*` convenience variants, which compare against the `playerTeamId` passed to the constructor.
  - **Not a Spring `@Component`** — it is constructed per match with timeline JSON and a team ID, because it holds parsed per-match state.
- `analyzer/MapCoordinateConverter` — converts Riot's in-game world coordinates (≈ −120 to 14,870 on X, −120 to 14,980 on Y) to pixel coordinates on a 512×512 minimap image, flipping the Y axis (Riot's origin is bottom-left, image origin is top-left).
- `analyzer/ZoneClassifier` — maps world (x, y) to a named region. Built on the map's two diagonals rather than a patchwork of boxes:
  - **Mid lane runs along `x == y`; the river runs along `x + y == 14870`** (the perpendicular diagonal). Both are confirmed by fixed landmark positions — Baron at (5007, 10471) and Dragon at (9857, 4422) both sit on the river diagonal. An earlier version had these two swapped, labelling mid-lane deaths as "River".
  - The two diagonals cut the remaining space into the **four jungle quadrants**: the river separates blue's half from red's, the mid diagonal separates top side from bottom.
  - Both outer lanes are **L-shaped** — top runs up the left edge *and* across the top; bot runs along the bottom *and* up the right edge. Modelling only the corner where the arms meet leaves the edges unclassified.
  - **Ordered checks, first match wins**, so tighter regions must stay above broader ones: pits → bases → lanes → river → mid → jungle. Where mid crosses the river at map centre, river wins by design.
  - Tunable via `LANE_DEPTH` and `BASE_DEPTH`. These are judgement calls, not derived constants — at `LANE_DEPTH = 2600` the two L-shaped lanes covered 49% of the map; 1700 brings them to ~17% each.
  - Returns: Baron Pit, Dragon Pit, Blue Base, Red Base, Top Lane, Bot Lane, River, Mid Lane, Blue Top Jungle, Blue Bot Jungle, Red Top Jungle, Red Bot Jungle. **"Unknown" is no longer reachable** on the playable map, and `ZoneClassifierTest` sweeps a grid to keep it that way.

### Controllers / endpoints

- `controller/SummonerController` (base `/api/player`) — typed record responses.
  - `GET /api/player/{gameName}/{tagLine}` → `SummonerResponse`
  - `GET /api/player/matches/{puuid}` → `MatchListResponse`
- `controller/MatchController` (base `/api`) — raw Riot passthrough plus the analysis endpoints.
  - `GET /api/matches/{puuid}` → raw Riot JSON. *Same underlying data as the typed route above, different shape — these are distinct paths, not a route collision, but keep the distinction in mind.*
  - `GET /api/match/{matchId}` → raw Riot JSON
  - `GET /api/timeline/{matchId}` → raw Riot JSON
  - `GET /api/deaths/{matchId}/{participantId}` → `List<DeathEvent>` (location and killer only)
  - `GET /api/analysis/{matchId}/{participantId}` → `List<AnalyzedDeath>` — **the primary endpoint. The frontend should consume this one.**
- `TestController` (root package) — trivial `GET /` health string.

### Models

All under `model/`, all Java `record` types:

- `SummonerResponse` — puuid, gameName, tagLine
- `MatchListResponse` — puuid, matchIds
- `DeathEvent` — timestamp (mm:ss), timestampMs, killerChampion, assistChampions, x, y, pixelX, pixelY, zone
- `ObjectiveContext` — baronAlive, dragonAlive, lastBaronTakenBy, lastDragonTakenBy, myTeamTookLastBaron, myTeamTookLastDragon. The `lastTakenBy` fields are `Integer` and **nullable**; null means that objective had not been taken yet at that point in the game.
- `AnalyzedDeath` — a `DeathEvent` paired with its `ObjectiveContext`

## Conventions

- DTOs are Java `record` types under `model/`.
- Riot responses are handled as raw JSON and navigated with Jackson `JsonNode` trees rather than mapped to full POJOs — parsing is deliberately partial, pulling only the needed fields. This is a resilience-over-type-safety tradeoff: Riot adding fields elsewhere in a payload won't break parsing. Internal DTOs crossing an API boundary are still typed records.
- Spring components use constructor injection.
- Stateless, reusable analyzers are `@Component`s. Analyzers holding per-match state (`ObjectiveAnalyzer`) are constructed directly.

## Known gaps — do not mistake these for intentional design

- **Errors are swallowed.** `SummonerService` returns `null` and `TimeAnalyzer` returns an empty list on failure, so a parse error is indistinguishable from a legitimately empty result. If you touch these classes, propagating real errors is a welcome improvement.
- **No caching or rate-limit handling.** One match analysis is ~2 Riot calls; 10 matches is 20–30. Dev keys throttle almost immediately at that volume. **Multi-match analysis is blocked on Phase 3 and should not be attempted before the caching layer exists.**
- **No persistence.** Every request re-fetches from Riot.
- **Region hardcoded to `americas`**; match lookups hardcoded to the 10 most recent games.
- **Test coverage is thin** — 2 test classes against 15 source classes.
