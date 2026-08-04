package com.leagueanalyzer.backend.model;

public record DeathEvent (
    String timestamp,
    long timestampMs,
    String killerChampion,
    String assistChampions,
    int x,
    int y,
    int pixelX,
    int pixelY,
    String zone
) {}
