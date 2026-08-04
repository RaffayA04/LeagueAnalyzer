package com.leagueanalyzer.backend.model;

/** A single death paired with the objective state at that moment. */
public record AnalyzedDeath (
    DeathEvent death,
    ObjectiveContext objectives
) {}
