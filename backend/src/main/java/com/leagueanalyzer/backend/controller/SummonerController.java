package com.leagueanalyzer.backend.controller;

import com.leagueanalyzer.backend.model.MatchListResponse;
import com.leagueanalyzer.backend.model.SummonerResponse;
import com.leagueanalyzer.backend.service.SummonerService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;


@RestController
@RequestMapping("/api/player")
public class SummonerController {

    private final SummonerService summonerService;

    public SummonerController(SummonerService summonerService) {
        this.summonerService = summonerService;
    }

    @GetMapping("/{gameName}/{tagLine}")
    public SummonerResponse getPlayer(
        @PathVariable String gameName,
        @PathVariable String tagLine) {

            return summonerService.getsummoner(gameName, tagLine);
        }

    @GetMapping("/matches/{puuid}")
    public MatchListResponse getMatches(@PathVariable String puuid) {
        return summonerService.getMatches(puuid);
    }
    

}
