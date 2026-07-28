# MEMORY — Session Log

A running record of working sessions on LeagueAnalyzer, so future sessions (and future-you) can pick up with context. Newest session on top.

---

## Session — July 2026: PRD redraft, Phase 1.1 planning, and the ObjectiveAnalyzer simplification

### What we set out to do
- Generate a `CLAUDE.md` map of the Java/Maven backend (done — `/init`).
- Redraft the PRD around the real product vision (mistake analysis → AI coaching).
- Start building **Phase 1.1 — Objective Context Analyzer** (the first "real coaching" feature).

### Docs produced/updated
- **`CLAUDE.md`** — codebase map (commands, architecture, the `application.properties`/Riot-key gotcha). Points to `PRD.md`.
- **`PRD.md`** — full redraft, supersedes the old PDF. Key changes vs. the PDF:
  - Zone classification marked **done** (it was "Priority 1 / not implemented" in the PDF but is already shipped).
  - **AI Coaching decoupled from replay rendering** — coaching runs on timeline analysis alone; `.rofl` replay video is a deferred, separate track (needs Windows + game client + GPU).
  - New **Phase 3 "Foundation for Scale"** (Postgres + caching/rate-limit) inserted before multi-match analysis.
  - Added Risks (§7) and Tech-Debt (§8) sections.
  - ⚠️ `PRD.md` §5 still has a "Design decisions" block referencing the 4-file design we later deleted (see below) — it's slightly stale.

### Step 0 — verified the Riot data against a real match (findings that matter)
Pulled real data for **LittleChaddha#NA1**, chose match **NA1_5602190523** (41-min game, 3 Barons, 6 dragons incl. 2 Elders + soul, Herald, Grubs). Kept a slim fixture:
- **`backend/src/test/resources/fixtures/objective_context_NA1_5602190523.json`** (8.7 KB — flattened: `objectiveEvents`/`targetDeaths` arrays, NOT raw `info→frames→events` shape).

Confirmed schema + findings:
- Kills come from `ELITE_MONSTER_KILL` events (`monsterType` = `DRAGON`/`BARON_NASHOR`/`RIFTHERALD`/`HORDE`; `monsterSubType` only on dragons, incl. `ELDER_DRAGON`; assists/subType can be absent).
- **Riot gives kills, NOT spawns.** Spawn times must be computed (first-spawn constant + respawn timer). This is the *only* reason any math exists.
- **Baron first spawns ~25:00 on patch 16.14, NOT 20:00** (my remembered value was wrong — verified against real Baron kill at 27:35).
- **Cloudflare in front of Riot blocks non-browser User-Agents** (`error 1010` → 403). The reference client needed a `User-Agent` header. ⚠️ Java's `RestTemplate` default UA may hit this — **verify when running the real app**; if so, set a `User-Agent` in `RiotApiClient`.
- The `?api_key=` query-param method still works (earlier "it's deprecated" claim was wrong — it was the Cloudflare UA block).
- Elder/soul: trust the explicit `ELDER_DRAGON` subtype; do NOT trust `DRAGON_SOUL_GIVEN.teamId` (fires with garbage `teamId:0`).

### The big pivot: simplified from a 4-file design to a single file
- I first built a "production-shaped" design: `ObjectiveEvent` + `AliveInterval` + `ObjectiveTimers` + `ObjectiveTimeline` (+ a passing 5-test suite). It worked but was **over-engineered for a student learning project** — too many files, confusing.
- **Deleted all 4 classes + their test** (kept the fixture). Decision: build one plain **`ObjectiveAnalyzer.java`** with plain `List<Long>` kill-time lists instead of records/containers.
- Reasoning distilled for learning:
  - Goal of the file: given a player's death time, answer "was Baron/Dragon/etc. **up** when they died?" → turns a raw death into *context* (coaching).
  - Core idea: each objective is alive in a window `[spawn, kill]`; "was it up?" = "is the death time inside a window?"
  - Only wrinkle: dragons/Baron respawn, so repeat spawns = `previousKill + respawnTimer`. Herald/Grubs spawn once (no wrinkle).
  - Timestamps stored as `long` (whole ms — exact comparisons, no float fuzz).
  - Simple version intentionally drops Herald/Grubs/Elder/Souls to get one thing working first; they're cheap to add back later (mostly more `ELITE_MONSTER_KILL` lists), Souls being the only one with real extra logic.

### Where the user (student) left off — building it themselves
Chose to hand-code `ObjectiveAnalyzer.java` to actually learn. Progress:
- Declared `baronKillTimes` and `dragonKillTimes` lists.
- Wrote **`wasBaronAlive(long deathTime)`** — **logic reviewed and correct** (slides a `[spawn, kill]` window through the game; handles dead gaps, post-last-kill respawn, and the empty-list case for free). Assumes `baronKillTimes` is chronological (guaranteed if added while walking frames in order).
- Next: test it via a quick `main` (IDE green-arrow) using real fixture numbers — Baron kills `1_655_218 / 2_031_827 / 2_416_680`; expect `wasBaronAlive(1_631_000)=true`, `(1_400_000)=false`, `(1_700_000)=false`.

### Pick up next
1. Run/verify `wasBaronAlive` against the fixture numbers.
2. Add `wasDragonAlive` (same pattern, dragon list, 5-min respawn).
3. Populate the lists from the real timeline by walking `info→frames→events` for `ELITE_MONSTER_KILL` (use `TimeAnalyzer` as the template — it already does the same walk for `CHAMPION_KILL`).
4. Wire into the death flow: `TimeAnalyzer` already extracts each death's `timestamp` — feed those into `wasBaronAlive`/`wasDragonAlive` and attach the answer to the death output.
5. When running the live app: refresh the 24h Riot dev key in `application.properties`, and watch for the Cloudflare User-Agent 403.

### Working style note
User is a student and wants to **write the code themselves** to learn — favor plain-English logic/pseudocode and concept explanations over dumping code skeletons or building it for them. Keep replies concise.
