# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

LeagueAnalyzer is a Spring Boot REST backend that fetches League of Legends match data from the Riot Games API and analyzes it — currently focused on locating and classifying a player's death events on the Summoner's Rift map. All code lives under `backend/` (a single Maven module, Java 17, Spring Boot 3.4.1).

The product vision, roadmap, and phase sequencing live in `PRD.md` at the repo root — read it before planning new features. In short: the near-term goal is automated mistake detection and AI coaching driven by timeline analysis; rendered replay video is a deliberately deferred, separate track (not required for coaching).

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

Riot dev API keys expire every 24 hours, so a working key must be refreshed for local runs.

## Architecture

Request flow is a conventional layered pipeline: **Controller → Service/Analyzer → RiotApiClient → Riot API**.

- `client/RiotApiClient` — the only class that talks to Riot. Wraps a `RestTemplate` and returns **raw JSON strings** (not deserialized objects). All endpoints target the `americas` regional routing host. Match ID lookups are hardcoded to the 10 most recent matches.
- `service/SummonerService` — parses raw account/match-list JSON into typed `record` responses (`SummonerResponse`, `MatchListResponse`) using a Jackson `ObjectMapper`. Note: on any parse error it returns `null` (swallowed exception).
- `analyzer/TimeAnalyzer` — the core analysis logic. Given a match's timeline JSON + match JSON, it walks every timeline frame's events, filters `CHAMPION_KILL` events where the victim is the target participant, resolves killer/assist participant IDs to champion names, and builds `DeathEvent` records. Delegates coordinate work to the two helpers below.
- `analyzer/MapCoordinateConverter` — converts Riot's in-game world coordinates (≈ -120 to ~14900 on each axis) to pixel coordinates on a 512×512 minimap image, flipping the Y axis (Riot's origin is bottom-left, image origin is top-left).
- `analyzer/ZoneClassifier` — maps world (x, y) to a named region (Baron Pit, Dragon Pit, lanes, jungles, River, bases) via ordered bounding-box checks; order matters since the first match wins.

### Controllers / endpoints

Two controllers with overlapping concerns — be aware both define a `/api/matches/{puuid}` route via different base paths:

- `controller/SummonerController` (`/api/player`) — returns parsed records: `GET /{gameName}/{tagLine}`, `GET /matches/{puuid}`.
- `controller/MatchController` (`/api`) — returns raw Riot JSON passthrough for `/matches/{puuid}`, `/match/{matchId}`, `/timeline/{matchId}`, and the analyzed `GET /deaths/{matchId}/{participantId}` which returns `List<DeathEvent>`.
- `TestController` (root package) — trivial `GET /` health string.

### Conventions

- DTOs are Java `record` types under `model/`.
- Riot responses are handled as raw JSON and navigated with Jackson `JsonNode` trees rather than mapped to full POJOs — parsing is deliberately partial, pulling only the needed fields.
- Spring components use constructor injection.
