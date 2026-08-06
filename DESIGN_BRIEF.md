# LeagueAnalyzer — Frontend Design Brief

A brief for designing the web frontend. The backend described here is **built and working**; every field and example below comes from real API responses, not a mockup.

---

## 1. What it is

LeagueAnalyzer answers one question about a League of Legends match a player just played:

> **"Where did I die, and what was happening on the map when I did?"**

League gives players a scoreboard — kills, deaths, gold, damage. It does not tell you that four of your deaths were in the river, or that you died 24 seconds before the enemy took Baron. That context is what separates *reporting* from *coaching*, and it's the product.

The tone is a training tool, not a hype product. Players come here after losing a game and want a clear read on what went wrong. Honest and legible beats celebratory.

---

## 2. Who it's for

A League player, roughly intermediate, reviewing their own recent games. They know the game's vocabulary cold — Baron, Drake, soul, river, jungle quadrants, mid lane — so the interface should use that language directly rather than explaining it.

They are not a data analyst. They want to glance at a screen and see a pattern.

---

## 3. The one flow

There is a single path through the app:

```
enter Riot ID  →  pick one of your recent matches  →  see your deaths, in context
```

That's it. No accounts, no login, no settings, no saved history. A Riot ID looks like `Faker#KR1` — a game name and a tag line.

The third screen is the product. The first two exist to reach it.

---

## 4. The real data

### Screen 1 — Riot ID lookup
`GET /api/player/{gameName}/{tagLine}` returns:
```json
{ "puuid": "...", "gameName": "Raffay", "tagLine": "NA1" }
```

### Screen 2 — Match list
`GET /api/player/matches/{puuid}` returns **the 10 most recent match IDs only**:
```json
{ "puuid": "...", "matchIds": ["NA1_5602190523", "NA1_5601884412", "..."] }
```

> **Important design constraint:** the match list endpoint returns *nothing but IDs*. There is no champion played, win/loss, KDA, date, or game mode available for the list without a second API call per match. Design the match picker around this limitation — either a plain list of matches, or accept that richer cards mean 10 extra requests. Do not design a match list that shows data the backend cannot supply.

### Screen 3 — The analysis *(the main screen)*
`GET /api/analysis/{matchId}/{participantId}` returns an array. One real entry:

```json
{
  "death": {
    "timestamp": "27:11",
    "timestampMs": 1631927,
    "killerChampion": "Zaahen",
    "assistChampions": "Samira, Milio",
    "x": 6240,
    "y": 8154,
    "pixelX": 217,
    "pixelY": 232,
    "zone": "River"
  },
  "objectives": {
    "baronAlive": true,
    "dragonAlive": false,
    "lastBaronTakenBy": null,
    "lastDragonTakenBy": 200,
    "myTeamTookLastBaron": false,
    "myTeamTookLastDragon": true
  }
}
```

**Field notes:**

| Field | Meaning |
|---|---|
| `timestamp` | pre-formatted `mm:ss`, ready to display |
| `killerChampion` / `assistChampions` | champion names; assists are one comma-joined string, or the literal `"none"` |
| `pixelX` / `pixelY` | position on a **512×512** minimap image, already converted and Y-flipped — plot directly |
| `zone` | one of the 12 names listed below |
| `baronAlive` / `dragonAlive` | was that objective up at this moment |
| `lastBaronTakenBy` / `lastDragonTakenBy` | team id `100` or `200`, or **`null`** meaning not yet taken this game |
| `myTeamTook*` | the same fact from the player's perspective — this is the one to phrase copy around |

**Zone values** (exactly these twelve, no others):
`Baron Pit` · `Dragon Pit` · `Blue Base` · `Red Base` · `Top Lane` · `Mid Lane` · `Bot Lane` · `River` · `Blue Top Jungle` · `Blue Bot Jungle` · `Red Top Jungle` · `Red Bot Jungle`

---

## 5. What a real match looks like

A genuine result — 16 deaths in one 41-minute game:

```
03:00  River             killed by Milio
06:11  Bot Lane          killed by Samira          drake up
07:58  Red Bot Jungle    killed by Samira
10:48  Bot Lane          killed by Samira
12:28  River             killed by Samira
14:37  Mid Lane          killed by Katarina
17:02  Mid Lane          killed by Milio
18:19  Mid Lane          killed by Heimerdinger
19:06  Mid Lane          killed by Samira          drake up
22:32  Mid Lane          killed by Katarina
27:11  River             killed by Zaahen          baron up
29:09  Blue Bot Jungle   killed by Zaahen
32:07  Mid Lane          killed by Samira
34:35  Top Lane          killed by Katarina
37:17  Blue Bot Jungle   killed by Zaahen
40:44  Red Bot Jungle    killed by Samira
```

Design against numbers like these. **A bad game has 15–20 deaths; a good one has 2–4.** The layout has to stay readable at both extremes — a design that only looks right with 5 rows will break here.

Note the patterns a good design would surface without the user hunting: **6 of 16 deaths were on mid lane, and Samira alone killed this player 7 times.** Those are the insights; the list is just the evidence. Only 3 of 16 deaths happened while an objective was up — so an "objective context" treatment that dominates the layout would be mostly empty space. Most rows have nothing to say on that axis.

---

## 6. Screens to design

1. **Search** — enter a Riot ID. Needs an error state (player not found).
2. **Match picker** — choose from 10 recent matches. Constrained as noted in §4.
3. **Analysis** — the deaths, with objective context. This is where the design effort belongs.

For screen 3, useful things to consider:
- A **minimap plot** of the deaths. `pixelX`/`pixelY` are pre-computed for a 512×512 map image, so dots can be placed directly. Clustering is the point — a player who dies in the same spot repeatedly should see it immediately. do not generate a photo of the map, pull from the internet or ask for a photo of summoners rift.
- A **death list**, chronological, showing time / zone / killer / objective state.
- A **summary** above the detail: total deaths, most common zone, most frequent killer, how many deaths happened while an objective was up. All derivable in the browser from the array.
- A way to make **objective context** feel meaningful rather than a stray boolean. "Baron was alive" is a flag; *"you died in the river while Baron was up"* is coaching.

---

## 7. Constraints and honesty

**Design only what exists.** These are on the roadmap but **not built** — do not design screens for them:
- AI-generated coaching text
- Multi-match / cross-game trends and history
- Automatic mistake detection ("you overextended")
- Replay video or playback
- Accounts, saved players, or any persistence

**Also true:**
- No login, no user accounts, no dark/light preference stored anywhere.
- Every visit is a fresh fetch — there is no caching layer yet, and a full analysis is ~2 API calls to Riot.
- Requests take a **noticeable moment** (fetching a full match timeline is ~1.2 MB). Loading states are not optional.
- The player's own champion is **not** currently in the response — only the champions who killed them.
- Riot has strict rules about their assets. Champion portraits and the official minimap image come from Riot's Data Dragon CDN; don't design around art that can't be licensed.

**Participant ID** is `1`–`10` and identifies a player within a match. The frontend will need to resolve which participant the user is; treat it as available.

---

## 8. Visual direction

Deliberately open — but a few grounding notes:

- The subject has a strong existing visual world (light-UI, the Rift's blue/red team split). Team `100` is blue side, `200` is red side, and using those colours for team ownership will read instantly to any player.
- The minimap is square, and the map's own geometry is diagonal — mid runs corner to corner, the river crosses it. Layouts that respect that diagonal will feel native to the game.
- Death data is fundamentally *negative* information. Avoid a design that feels like it's celebrating the player's mistakes, and avoid one that feels punishing. Neutral and clinical is the right register.
- It should look competent on a phone. Players check this kind of thing on their phone right after a game.
- Highlight the player's champion in the game summary.
---

## 9. Stack

React, talking to a Spring Boot JSON API on a different origin. Static site, no server-side rendering. Whatever is designed has to be buildable as plain React components with CSS.
