package com.leagueanalyzer.backend.model;

import java.util.List;

/**
 * Every game the overview screen needs, in one response.
 *
 * `requested` and `analyzed` are separate on purpose. A player with twelve
 * ranked games, or one whose timeline fetch failed twice, needs the screen to
 * say so rather than quietly present a smaller sample as if it were the whole
 * twenty — the win-rate split is only readable against a known denominator.
 *
 * Aggregates (top zone, the death-count split, game-phase counts) are not here.
 * They are reductions over a hundred-odd items that the browser already holds,
 * and `stats.js` is where every other derivation in this project lives. Putting
 * them here would mean maintaining the same rule in two languages.
 */
public record PlayerOverview(
    String puuid,
    int requested,
    int analyzed,
    List<GameSummary> games
) {}
