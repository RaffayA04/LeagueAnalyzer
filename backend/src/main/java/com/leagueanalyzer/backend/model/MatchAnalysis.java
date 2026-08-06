package com.leagueanalyzer.backend.model;

import java.util.List;

/**
 * The full analysis of one player's match.
 *
 * The deaths carry backward-looking objective state ("was Baron up, who took the
 * last one"). The objective ledger is the whole game's timeline of who took what,
 * which is what lets a death be read against what happened next.
 */
public record MatchAnalysis (
    int playerTeamId,
    List<AnalyzedDeath> deaths,
    List<ObjectiveEvent> objectives
) {}
