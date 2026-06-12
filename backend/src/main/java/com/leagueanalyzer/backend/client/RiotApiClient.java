package com.leagueanalyzer.backend.client;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestTemplate;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;

@Component
public class RiotApiClient {

    @Value("${riot.api.key}")
    private String apiKey;
    private final RestTemplate restTemplate = new RestTemplate();

    public String getAccountByRiotID(String gameName, String tagLine) {

        String encodedName = URLEncoder.encode(gameName, StandardCharsets.UTF_8);
        String encodedTag = URLEncoder.encode(tagLine, StandardCharsets.UTF_8);
        String url = "https://americas.api.riotgames.com/riot/account/v1/accounts/by-riot-id/"
                + encodedName + "/" + encodedTag
                + "?api_key=" + apiKey;

        return restTemplate.getForObject(url, String.class);
    }

    public String getMatchIds(String puuid) {

        String url = "https://americas.api.riotgames.com/lol/match/v5/matches/by-puuid/"
                + puuid
                + "/ids?start=0&count=10"
                + "&api_key=" + apiKey;
        return restTemplate.getForObject(url, String.class);

    }

    public String getMatchDetails(String matchId) {

        String url = "https://americas.api.riotgames.com/lol/match/v5/matches/"
                + matchId
                + "?api_key=" + apiKey;
        return restTemplate.getForObject(url, String.class);

    }

    public String getTimeline(String matchId) {

        String url = "https://americas.api.riotgames.com/lol/match/v5/matches/"
                + matchId
                + "/timeline"
                + "?api_key=" + apiKey;

        return restTemplate.getForObject(url, String.class);
    }

   
    
}
