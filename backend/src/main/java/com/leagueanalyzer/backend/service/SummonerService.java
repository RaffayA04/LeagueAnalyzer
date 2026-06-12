package com.leagueanalyzer.backend.service;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.leagueanalyzer.backend.client.RiotApiClient;
import com.leagueanalyzer.backend.model.MatchListResponse;
import com.leagueanalyzer.backend.model.SummonerResponse;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;

@Service
public class SummonerService {
    
    private final RiotApiClient riotApiClient;
    private final ObjectMapper objectMapper = new ObjectMapper();

    public SummonerService(RiotApiClient riotApiClient) {
        this.riotApiClient = riotApiClient;
    }

    public SummonerResponse getsummoner(String gameName, String tagLine) {
        try {
            String raw = riotApiClient.getAccountByRiotID(gameName, tagLine);
            JsonNode root = objectMapper.readTree(raw);

            return new SummonerResponse(
                root.get("puuid").asText(),
                root.get("gameName").asText(),
                root.get("tagLine").asText()
            );
        } catch (Exception e) {
            return null;
        }
    }

    public MatchListResponse getMatches(String puuid) {
        try {
            String raw = riotApiClient.getMatchIds(puuid);
            JsonNode root = objectMapper.readTree(raw);

            List<String> matchIds = new ArrayList<>();
            for (JsonNode node : root) {
                matchIds.add(node.asText());
            }

            return new MatchListResponse(puuid, matchIds);
        } catch (Exception e) {
            return null;
        }
    }
}
