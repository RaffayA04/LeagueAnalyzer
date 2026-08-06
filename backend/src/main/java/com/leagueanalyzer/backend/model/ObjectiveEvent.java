package com.leagueanalyzer.backend.model;

/**
 * One objective taken during the match.
 *
 * `monster` is BARON_NASHOR or DRAGON. `subType` names the drake
 * (HEXTECH_DRAGON, ELDER_DRAGON, ...) and is null for Baron.
 * `myTeam` is the same fact as `teamId`, resolved to the player's point of view.
 */
public record ObjectiveEvent (
    String monster,
    String subType,
    String timestamp,
    long timestampMs,
    int teamId,
    boolean myTeam
) {}
