package com.leagueanalyzer.backend.controller;

import com.leagueanalyzer.backend.client.RiotApiClient;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import com.leagueanalyzer.backend.analyzer.TimeAnalyzer;
import com.leagueanalyzer.backend.model.AnalyzedDeath;
import com.leagueanalyzer.backend.model.MatchAnalysis;
import com.leagueanalyzer.backend.model.PlayerOverview;
import com.leagueanalyzer.backend.model.DeathEvent;
import com.leagueanalyzer.backend.service.MatchAnalysisService;
import com.leagueanalyzer.backend.service.PlayerOverviewService;
import java.util.*;

@RestController
@RequestMapping("/api")
public class MatchController {
    private final RiotApiClient riotApiClient;
    private final TimeAnalyzer timeAnalyzer;
    private final MatchAnalysisService matchAnalysisService;
    private final PlayerOverviewService playerOverviewService;

    public MatchController(
        RiotApiClient riotApiClient,
        TimeAnalyzer timeAnalyzer,
        MatchAnalysisService matchAnalysisService,
        PlayerOverviewService playerOverviewService) {

        this.riotApiClient = riotApiClient;
        this.timeAnalyzer = timeAnalyzer;
        this.matchAnalysisService = matchAnalysisService;
        this.playerOverviewService = playerOverviewService;
    }

    /**
     * Every ranked game the overview screen needs, in one request.
     *
     * This replaces what the browser used to do as 3 calls per game: resolve
     * the participant from match detail, then fetch the analysis. Twenty games
     * that way is sixty round trips from the client; this is one.
     */
    @GetMapping("/overview/{puuid}")
    public PlayerOverview getOverview(
        @PathVariable String puuid,
        @RequestParam(defaultValue = "20") int count) {

        return playerOverviewService.overview(puuid, count);
    }

    @GetMapping("/matches/{puuid}")
    public String getMatchesByAccount(@PathVariable String puuid) {
        return riotApiClient.getMatchIds(puuid);
    }

    @GetMapping("/match/{matchId}")
    public String getMatch(@PathVariable String matchId) {
        return riotApiClient.getMatchDetails(matchId);
    }

    @GetMapping("/timeline/{matchId}")
    public String getTimeline(@PathVariable String matchId) {
        return riotApiClient.getTimeline(matchId);
    }

    @GetMapping("/deaths/{matchId}/{participantId}")
    public List<DeathEvent> getDeaths(
        @PathVariable String matchId,
        @PathVariable int participantId) {

            String timelineJson = riotApiClient.getTimeline(matchId);
            String matchJson = riotApiClient.getMatchDetails(matchId);
            
        return timeAnalyzer.findDeaths(
                timelineJson,
                matchJson,
                participantId
        );
    }

    @GetMapping("/analysis/{matchId}/{participantId}")
    public MatchAnalysis getAnalysis(
        @PathVariable String matchId,
        @PathVariable int participantId) throws Exception {

        return matchAnalysisService.analyzeMatch(matchId, participantId);
    }

}
