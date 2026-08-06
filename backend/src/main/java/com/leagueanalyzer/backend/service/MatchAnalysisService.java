package com.leagueanalyzer.backend.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.leagueanalyzer.backend.analyzer.ObjectiveAnalyzer;
import com.leagueanalyzer.backend.analyzer.TimeAnalyzer;
import com.leagueanalyzer.backend.client.RiotApiClient;
import com.leagueanalyzer.backend.model.AnalyzedDeath;
import com.leagueanalyzer.backend.model.DeathEvent;
import com.leagueanalyzer.backend.model.MatchAnalysis;
import com.leagueanalyzer.backend.model.ObjectiveContext;
import com.leagueanalyzer.backend.model.ObjectiveEvent;
import java.util.ArrayList;
import java.util.List;
import org.springframework.stereotype.Service;

/**
 * Combines the death analysis with the objective state at each death, which is
 * the first output that reads as coaching rather than reporting.
 */
@Service
public class MatchAnalysisService {
    private final ObjectMapper objectMapper = new ObjectMapper();
    private final RiotApiClient riotApiClient;
    private final TimeAnalyzer timeAnalyzer;

    public MatchAnalysisService(RiotApiClient riotApiClient, TimeAnalyzer timeAnalyzer) {
        this.riotApiClient = riotApiClient;
        this.timeAnalyzer = timeAnalyzer;
    }

    public MatchAnalysis analyzeMatch(String matchId, int participantId) throws Exception {
        String timelineJson = riotApiClient.getTimeline(matchId);
        String matchJson = riotApiClient.getMatchDetails(matchId);

        int playerTeamId = findTeamId(matchJson, participantId);

        List<DeathEvent> deaths = timeAnalyzer.findDeaths(timelineJson, matchJson, participantId);
        ObjectiveAnalyzer objectives = new ObjectiveAnalyzer(timelineJson, playerTeamId);

        List<AnalyzedDeath> analyzed = new ArrayList<>();
        for (DeathEvent death : deaths) {
            long at = death.timestampMs();
            analyzed.add(new AnalyzedDeath(
                death,
                new ObjectiveContext(
                    objectives.wasBaronAlive(at),
                    objectives.wasDragonAlive(at),
                    objectives.lastBaronTakenBy(at),
                    objectives.lastDragonTakenBy(at),
                    objectives.myTeamTookLastBaron(at),
                    objectives.myTeamTookLastDragon(at)
                )
            ));
        }

        List<ObjectiveEvent> ledger = new ArrayList<>();
        for (ObjectiveAnalyzer.ObjectiveTaken taken : objectives.objectivesTaken()) {
            ledger.add(new ObjectiveEvent(
                taken.monster(),
                taken.subType(),
                formatTimestamp(taken.timestampMs()),
                taken.timestampMs(),
                taken.teamId(),
                taken.teamId() == playerTeamId
            ));
        }

        return new MatchAnalysis(playerTeamId, analyzed, ledger);
    }

    private String formatTimestamp(long timestampMs) {
        long totalSeconds = timestampMs / 1000;
        return String.format("%02d:%02d", totalSeconds / 60, totalSeconds % 60);
    }

    /** Riot puts the participant -> team mapping in match details, not the timeline. */
    private int findTeamId(String matchJson, int participantId) throws Exception {
        JsonNode participants = objectMapper.readTree(matchJson).get("info").get("participants");
        for (JsonNode participant : participants) {
            if (participant.get("participantId").asInt() == participantId) {
                return participant.get("teamId").asInt();
            }
        }
        throw new IllegalArgumentException("No participant " + participantId + " in this match");
    }
}
