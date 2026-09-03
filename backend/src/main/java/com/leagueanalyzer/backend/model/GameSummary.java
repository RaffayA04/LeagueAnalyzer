package com.leagueanalyzer.backend.model;

import java.util.List;

/**
 * One game, from the player's point of view, with its deaths already analyzed.
 *
 * This is what the twenty-game overview is built out of, and it is deliberately
 * small: a handful of scalars plus the death list. That matters because this —
 * not the raw Riot JSON it came from — is what gets cached. The timeline it was
 * derived from is roughly 775 KB; this is a few KB. Caching the expensive small
 * thing rather than the cheap big one is what keeps twenty games in memory.
 *
 * `status` is OK, or names why the game could not be analyzed. A failed game
 * still appears in the list: silently dropping it would leave the heatmap
 * claiming to show twenty games while plotting seventeen.
 */
public record GameSummary(
    String matchId,
    String status,
    String championName,
    boolean win,
    int teamId,
    int kills,
    int deaths,
    int assists,
    long gameDurationMs,
    long gameEndTimestamp,
    int queueId,
    List<AnalyzedDeath> deathEvents,
    List<ObjectiveEvent> objectives
) {
    public static final String OK = "OK";
    public static final String FETCH_FAILED = "FETCH_FAILED";
    public static final String NOT_IN_MATCH = "NOT_IN_MATCH";
    public static final String RATE_LIMITED = "RATE_LIMITED";

    /** A game we could not analyze, carrying only the id and the reason. */
    public static GameSummary failed(String matchId, String status) {
        return new GameSummary(matchId, status, null, false, 0, 0, 0, 0, 0L, 0L, 0,
                               List.of(), List.of());
    }
}
