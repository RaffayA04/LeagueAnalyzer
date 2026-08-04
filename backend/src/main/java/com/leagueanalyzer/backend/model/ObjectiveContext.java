package com.leagueanalyzer.backend.model;

/**
 * The objective state of the game at the moment of a single death.
 *
 * The "lastTakenBy" fields are null when that objective had not been taken yet
 * at this point in the game.
 */
public record ObjectiveContext (
    boolean baronAlive,
    boolean dragonAlive,
    Integer lastBaronTakenBy,
    Integer lastDragonTakenBy,
    boolean myTeamTookLastBaron,
    boolean myTeamTookLastDragon
) {}
