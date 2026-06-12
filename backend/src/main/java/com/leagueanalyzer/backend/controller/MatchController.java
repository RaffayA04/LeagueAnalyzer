package com.leagueanalyzer.backend.controller;

import com.leagueanalyzer.backend.client.RiotApiClient;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import com.leagueanalyzer.backend.analyzer.TimeAnalyzer;
import com.leagueanalyzer.backend.model.DeathEvent;
import java.util.*;

@RestController
@RequestMapping("/api")
public class MatchController {
    private final RiotApiClient riotApiClient;
    private final TimeAnalyzer timeAnalyzer;

    public MatchController(
        RiotApiClient riotApiClient,
        TimeAnalyzer timeAnalyzer) {

        this.riotApiClient = riotApiClient;
        this.timeAnalyzer = timeAnalyzer;
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

    
}
