# LeagueAnalyzer — Product Requirements Document

> **Status:** Living document. Supersedes `LeagueAnalyzer - Product Requirements Document.pdf`.
> **Last revised:** 2026-07-16

---

## 1. Product Overview

LeagueAnalyzer is a League of Legends match-analysis and coaching platform built on Spring Boot and Riot's Match-V5 / Timeline-V5 APIs.

It ingests a player's recent games, reconstructs what happened from timeline data, **automatically identifies mistakes**, and turns them into **actionable, AI-generated coaching feedback** — the kind of guidance a coach would give while reviewing a VOD, delivered automatically.

The long-term product is comparable to Replayit.gg, Mobalytics, and U.GG Insights, but differentiated by **automated mistake detection and AI coaching driven by timeline reconstruction** — with in-browser replay visualization as a later visual layer.

### Core value proposition
> "Here are the specific mistakes that cost you this game, where and when they happened, and what to do differently next time."

### Design principle: coaching does not depend on rendered replays
The most important strategic decision in this document: **AI coaching is built on timeline analysis, not on video.** Everything needed to tell a player *what went wrong and why* is derivable from Match-V5 + Timeline-V5 data we already fetch. Rendered replay clips are a **visual enhancement**, not a prerequisite — and they carry an order-of-magnitude more infrastructure cost (see §7). This keeps the hardest, riskiest component (replay rendering) off the critical path to a shippable product.

---

## 2. Tech Stack

**Backend (current):**
- Java 17
- Spring Boot 3.4.1
- Maven

**Data source:**
- Riot Games API — Account-V1, Match-V5, Timeline-V5
- Regional routing: `americas` (currently hardcoded; see §8 open items)

**Planned (in roadmap order of need):**
- PostgreSQL — persistence for parsed matches and aggregated stats (needed by Phase 3)
- A caching + rate-limit layer in front of the Riot client (needed by Phase 3)
- AI analysis service — LLM-driven coaching over structured analysis output (Phase 4)
- React frontend — player dashboards, heatmaps, coaching views (Phase 4/5)
- Replay processing server + GPU clip rendering — `.rofl` handling and video generation (Phase 6, separate track)

---

## 3. Current Architecture

Single Maven module under `backend/`. Request flow: **Controller → Service / Analyzer → RiotApiClient → Riot API.**

```
backend/src/main/java/com/leagueanalyzer/backend/
├── BackendApplication.java          # Spring Boot entry point
├── TestController.java              # GET / health check
├── client/
│   └── RiotApiClient.java           # ALL Riot HTTP calls; returns raw JSON strings
├── controller/
│   ├── SummonerController.java      # /api/player/*  — parsed record responses
│   └── MatchController.java         # /api/*         — raw JSON passthrough + death analysis
├── service/
│   └── SummonerService.java         # parses account/match-list JSON into records
├── analyzer/
│   ├── TimeAnalyzer.java            # walks timeline frames, extracts death events
│   ├── MapCoordinateConverter.java  # world coords → 512×512 minimap pixels
│   └── ZoneClassifier.java          # world coords → named map region
└── model/
    ├── SummonerResponse.java        # record(puuid, gameName, tagLine)
    ├── MatchListResponse.java       # record(puuid, matchIds)
    └── DeathEvent.java              # record(timestamp, killer, assists, x, y, pixelX, pixelY, zone)
```

**Conventions:** DTOs are Java `record`s. Riot responses are navigated as Jackson `JsonNode` trees, parsing only needed fields (partial deserialization). Spring components use constructor injection.

---

## 4. Completed Features

| # | Feature | Endpoint | Notes |
|---|---------|----------|-------|
| 1 | Riot ID lookup | `GET /api/player/{gameName}/{tagLine}` | Account-V1 → returns PUUID, gameName, tagLine |
| 2 | Match ID retrieval | `GET /api/player/matches/{puuid}` (parsed) · `GET /api/matches/{puuid}` (raw) | Match-V5; **hardcoded to 10 most recent** |
| 3 | Match details | `GET /api/match/{matchId}` | Match-V5; raw JSON (participants, champions, teams, stats) |
| 4 | Timeline retrieval | `GET /api/timeline/{matchId}` | Timeline-V5; raw JSON (kills, objectives, purchases, wards, etc.) |
| 5 | Death analyzer | `GET /api/deaths/{matchId}/{participantId}` | Scans `CHAMPION_KILL` where `victimId == participantId` |
| 6 | Champion mapping | (within #5) | `participantId → championName`, so output reads "Killed by Ahri" not "participant 8" |
| 7 | Coordinate conversion | (within #5) | `MapCoordinateConverter`: world coords → 512×512 minimap pixels (Y-axis flipped) |
| 8 | **Map zone classification** ✅ | (within #5) | `ZoneClassifier`: world coords → "River", "Baron Pit", "Top Lane", etc. **Done — was "Priority 1" in the prior PRD.** |

**Death analyzer example output:**
```
09:56  Killed by Ahri     Assists: Nautilus   Position: 5226, 8824   Pixel: 182, 209   Zone: River
16:26  Killed by Lee Sin  Assists: none       Position: 2587, 9898   Pixel: 92, 173    Zone: Top Lane
```

**Known-working flow (all functional):**
`Riot ID → PUUID → Match IDs → Match Details → Timeline → Death Analyzer (with zone + pixel mapping)`

---

## 5. Product Roadmap (Re-Sequenced)

The prior PRD listed features P1–P8 in a single line ending in replay rendering → AI coaching. This revision makes three changes:

1. **Zone classification is complete** — removed from the roadmap (see §4).
2. **A persistence + caching foundation is inserted before multi-match analysis** — it was previously implicit under "Future" but is a hard dependency for any cross-game feature.
3. **AI coaching is decoupled from replay rendering** and moved *before* it. Replay video becomes a separate, later track rather than a prerequisite for coaching.

The roadmap is grouped into phases. Each phase produces something usable on its own.

### Phase 1 — First Real Coaching Insight

#### 1.1 Objective Context Analyzer  *(was Priority 2)*
**Goal:** Determine the objective state of the game at the moment of each death, converting raw deaths into contextual events.

**Output examples:**
- "Died 12 seconds before Dragon spawned."
- "Died while Baron was alive."
- "Died before the soul-point fight."

**Why first:** This is the first output that is genuinely *coaching* rather than *reporting*, and it is cheap — the timeline already contains objective events (`ELITE_MONSTER_KILL`, `BUILDING_KILL`) and spawn/respawn timers are derivable. **No new data source required.**

**Depends on:** existing timeline + death analyzer. No new infrastructure.

**Design decisions (settled by step-0 schema verification against a real match — fixture: `backend/src/test/resources/fixtures/objective_context_NA1_5602190523.json`):**
- **Core is a pure function of `(objective events, targetPlayerTeamId, deathTime)`** → `List<ObjectiveContext>`. The player's team comes from *match* details (participant→team join); objective `killerTeamId` is on the timeline event itself.
- **Three query primitives:** `state-at-T` (aliveness), `nearest-spawn` (projected from first-spawn + respawn constants), `nearest-kill` (observed). Kill- and state-queries need no constants; only spawn-projection does.
- **Relevance is a weighted function, not a flat threshold** — widen the window for late-game / high-value objectives (Baron, Elder, soul-point), narrow it for trivial early ones. Game phase is a first-class input (dying near a *spawn* matters more late, when the death is the enabling man-down pick).
- **Observe, don't compute, for soul/elder:** trust the explicit `ELDER_DRAGON` `monsterSubType`; **do not** trust `DRAGON_SOUL_GIVEN.teamId` (fires spuriously with `teamId:0`). This removes the planned dragon-counting logic.
- **Defensive parsing:** `monsterSubType` and `assistingParticipantIds` are absent on non-dragon / grub kills — default them.
- **Timers are patch-keyed config, treated as assumptions.** Real data: patch 16.14 Baron first-spawn ≈ 25:00 (not 20:00), Dragon first ≈ 5:00.
- **Scope guard:** Summoner's Rift only (`mapId == 11`); return "unavailable" for other modes. `HORDE` (Void Grubs) parsed but out of v1 scope; wording stays proximity-based, never causal ("died 24s before your team took Baron", not "your death lost Baron").

### Phase 2 — Visualization Primitive

#### 2.1 Death Heatmap  *(was Priority 3)*
**Goal:** Plot deaths on a Summoner's Rift image using the pixel coordinates already produced by `MapCoordinateConverter`.

**Input:** map pixels (already computed). **Output:** heatmap image / overlay data.

**Use cases:** common death locations, overextension detection.

**Note:** Can ship as server-rendered image or as coordinate data for the frontend to render. Prefer the latter once the React app exists, to keep rendering client-side.

### Phase 3 — Foundation for Scale (NEW — hard dependency for everything below)

These are not user-facing features, but nothing after Phase 2 is possible without them. **This phase must land before multi-match analysis.**

#### 3.1 Persistence layer (PostgreSQL)
Store parsed match analyses, death events, and per-player aggregates. Required for any cross-game feature, "recurring issues over time," and to avoid re-fetching/re-parsing on every request.

#### 3.2 Caching + Riot rate-limit handling
Wrap `RiotApiClient` with:
- A cache keyed by match ID / PUUID (match data is immutable once a game ends — ideal for caching).
- Rate-limit awareness (respect Riot's per-second / per-2-minute limits; handle `429` with backoff/retry).

**Why critical:** Multi-match analysis of 10 games is ~20–30 Riot calls with zero caching today. Dev keys throttle almost immediately. Without this layer, Phase 3.3 onward will constantly hit `429`s.

#### 3.3 Multi-Match Analysis  *(was Priority 4)*
**Goal:** Aggregate analysis across a player's recent matches.

**Flow:** `Player → recent matches → per-match analysis (cached) → aggregate statistics`

**Output examples:** most common death locations, average deaths before objectives, most frequent killers, recurring death zones.

**Depends on:** 3.1 + 3.2.

### Phase 4 — Core Product

#### 4.1 Mistake Detection Engine  *(was Priority 5 — "LeagueAnalyzer's core value")*
**Goal:** Automatically classify deaths/plays as specific, named mistakes.

**Output examples:**
- Died alone in a side lane.
- Died before an objective your team needed.
- Died while your team was grouped elsewhere on the map.
- Overstayed after winning a fight.

**Key insight:** Most of these are computable from **timeline + match data already fetched** — per-frame participant positions, objective timers, and teammate locations. **No replay video required.** This is what makes decoupling from replays possible.

**Depends on:** 1.1 (objective context), 3.x (positions across frames, persistence for patterns).

#### 4.2 AI Coach  *(was Priority 8 — moved forward, ahead of replays)*
**Goal:** Generate natural-language coaching feedback from structured analysis.

**Input:** timeline events + match details + detected mistakes (from 4.1). **Not** rendered clips.

**Output example:**
> "You died 4 times in the river while objectives were spawning. Consider warding deeper and grouping earlier."

**Why here, not last:** The AI coach's input is structured mistake data, which exists after 4.1. It does **not** need video. Shipping coaching here delivers the product's core promise without waiting on replay infrastructure.

**Depends on:** 4.1. Requires the AI analysis service (LLM integration).

### Phase 5 — Frontend

#### 5.1 React Frontend
Player search, match list, per-match breakdown, death heatmap rendering, objective-context timeline, and AI coaching display. Consumes the backend API built in Phases 1–4.

*(The frontend can begin in parallel once Phase 1 endpoints stabilize; listed here as the point where a cohesive UI becomes necessary.)*

### Phase 6 — Replay Track (SEPARATE, LATER — high cost, off critical path)

Grouped and deferred because these share a heavyweight infrastructure dependency and are **not** required for coaching.

#### 6.1 Replay Clip Generation  *(was Priority 6)*
**Goal:** Generate video clips around detected mistakes (e.g., death at 12:42 → clip 12:12–12:57).

**Reality check:** `.rofl` files are Riot's proprietary, undocumented replay format. There is **no API to render them to video**. The realistic path is automating an actual League client in replay/spectator mode and screen-capturing it — requiring a Windows environment, a running game install, and a GPU per render. This is an entire ops/infrastructure project.

**Implementation sketch:** user uploads `.rofl` → replay processing server drives the game client → GPU renders → clip produced.

#### 6.2 Replay Visualization  *(was Priority 7)*
**Goal:** In-browser replay viewing — timeline scrubber, events, heatmaps, death markers.

**Long-Term Vision (revised dependency chain):**
```
Riot API
   ↓
Timeline Analysis  ──►  Objective Context  ──►  Mistake Detection  ──►  AI Coaching   (the product)
   ↓
Replay Clip Generation  ──►  Replay Visualization                                     (later visual layer)
```
Note the split: coaching is reachable through the top line alone. Replays hang off the side.

---

## 6. MVP Definition

**MVP = Phases 1 through 4** (plus a minimal frontend from Phase 5 to surface it):

A user enters their Riot ID and, for a recent game, receives:
1. Where and when they died, with map zone and objective context (Phases 1–2).
2. Named, specific mistakes detected automatically (Phase 4.1).
3. AI-generated coaching feedback summarizing what to improve (Phase 4.2).

**Explicitly NOT in the MVP:** rendered replay video, in-browser replay playback (Phase 6). The MVP proves the core coaching value with zero replay infrastructure.

---

## 7. Risks & Constraints

| Risk | Impact | Mitigation |
|------|--------|------------|
| `.rofl` replay rendering complexity | Very high — needs Windows + game client + GPU per render | Keep it off the critical path (Phase 6); ship coaching without it |
| Riot API rate limits | Blocks multi-match analysis | Caching + backoff layer (Phase 3.2) before any cross-game feature |
| Dev API key expires every 24h | Local dev friction | Documented in `CLAUDE.md`; consider a production key application when public |
| **Riot API is behind Cloudflare** — blocks non-browser `User-Agent`s (`error 1010` → HTTP 403) | Confirmed with the reference `urllib` client; **`RestTemplate`'s default `Java/17` UA is a plausible victim** | Set an explicit `User-Agent` header in `RiotApiClient`. **Verify by running the app** before treating as fixed. |
| Patch-dependent objective timers | "before-spawn" contexts mislabeled if constants are stale (e.g. Baron first spawns ~25:00 in patch 16.14, **not** 20:00) | Externalize timers as patch-keyed config; prefer observed events; treat every remembered number as an assumption |
| Riot ToS / data-use rules for replays & scraping | Legal/compliance | Review Riot's developer policies before building the replay track |
| No persistence today | Blocks aggregation & history | PostgreSQL in Phase 3.1 |
| Error swallowing (`null`/empty on parse failure) | Silent failures as features stack | Introduce proper error handling as analysis logic grows |

---

## 8. Known Technical Debt / Open Items

Carried from the current codebase; address opportunistically or as phases demand:

- **Duplicate matches route:** `SummonerController` (`/api/player/matches/{puuid}`, parsed) and `MatchController` (`/api/matches/{puuid}`, raw) both expose "matches for a PUUID." Consolidate or clearly namespace.
- **API key in query string:** `RiotApiClient` appends `?api_key=`. This still works (verified — the query-param method is *not* deprecated), but the `X-Riot-Token` header is cleaner and keeps the key out of URLs/logs. Low urgency; do it alongside the `User-Agent` fix.
- **Hardcoded region (`americas`) and match count (10):** parameterize for other regions and configurable history depth.
- **Error handling:** `SummonerService` returns `null`, analyzers return empty lists on failure. Introduce typed errors / proper HTTP status responses.
- **`TestController`** at the root package is a scaffold health check; fold into a proper health/actuator endpoint eventually.

---

## 9. Current Development Status

- **Phase:** Backend analytics foundation (Phase 1 entry).
- **Completed milestone:** Parsing Riot timeline data into structured death analysis with map-zone and pixel-coordinate enrichment (Completed Features 1–8).
- **Completion estimate:** ~25–30% of MVP (Phases 1–4). Zone classification — previously the top open item — is now done, and the roadmap has been re-sequenced to reach coaching without replay infrastructure.
- **Next up:** Phase 1.1 — Objective Context Analyzer.
