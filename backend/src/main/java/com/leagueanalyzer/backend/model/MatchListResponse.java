package com.leagueanalyzer.backend.model;
import java.util.List;

public record MatchListResponse(
    String puuid,
    List<String> matchIds
) {}
