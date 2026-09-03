package com.leagueanalyzer.backend.client;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.stereotype.Component;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.web.client.RestTemplate;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.ArrayDeque;
import java.util.Deque;

@Component
public class RiotApiClient {

    private static final String HOST = "https://americas.api.riotgames.com";

    /** Ranked Solo/Duo. The overview is queue-locked so every game is Summoner's
     *  Rift — ZoneClassifier and the minimap only model that map, and an ARAM
     *  game would plot deaths onto a map it was never played on. */
    public static final int RANKED_SOLO = 420;

    /**
     * A personal key allows 20 requests per second (and 100 per two minutes).
     * Sixteen leaves headroom for the burst at the start of an overview, where
     * every worker fires at once.
     *
     * This lives in the client rather than in the pool size because the limit
     * is per key, not per caller: two features each staying politely under the
     * ceiling still add up to 429s. Pacing here covers every caller at once.
     *
     * Note this only guards the per-second limit. The 100-per-two-minutes
     * budget cannot be paced around at forty calls per overview — that one is
     * what the cache and the 429 retry are for.
     */
    private static final int MAX_PER_SECOND = 16;

    private final Deque<Long> recentCalls = new ArrayDeque<>();

    @Value("${riot.api.key}")
    private String apiKey;

    private final RestTemplate restTemplate;

    public RiotApiClient() {
        // A bare RestTemplate has no timeouts at all. With one request in flight
        // that means a slow upstream hangs one user; once the overview runs a
        // worker pool it means a hung call retires a worker permanently, and
        // after six of them the service is dead with nothing in the logs.
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(5_000);
        factory.setReadTimeout(10_000);
        this.restTemplate = new RestTemplate(factory);
    }

    /**
     * The key travels as a header rather than a query parameter. Riot accepts
     * both, but a query string reaches access logs, proxies and browser
     * history; a header does not.
     */
    private String get(String path) {
        acquirePermit();
        HttpHeaders headers = new HttpHeaders();
        headers.set("X-Riot-Token", apiKey);
        return restTemplate.exchange(
            HOST + path, HttpMethod.GET, new HttpEntity<>(headers), String.class
        ).getBody();
    }

    /** Sliding one-second window. Blocks the calling worker until the window
     *  has room, which is exactly the behaviour we want: back-pressure on our
     *  own threads rather than a 429 from Riot. */
    private void acquirePermit() {
        while (true) {
            long sleepMs;
            synchronized (recentCalls) {
                long now = System.currentTimeMillis();
                while (!recentCalls.isEmpty() && recentCalls.peekFirst() <= now - 1000) {
                    recentCalls.pollFirst();
                }
                if (recentCalls.size() < MAX_PER_SECOND) {
                    recentCalls.addLast(now);
                    return;
                }
                sleepMs = recentCalls.peekFirst() + 1000 - now;
            }
            try {
                Thread.sleep(Math.max(1, sleepMs));
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                return;
            }
        }
    }

    public String getAccountByRiotID(String gameName, String tagLine) {
        return get("/riot/account/v1/accounts/by-riot-id/"
                + URLEncoder.encode(gameName, StandardCharsets.UTF_8) + "/"
                + URLEncoder.encode(tagLine, StandardCharsets.UTF_8));
    }

    /** The ten most recent of any queue — the original behaviour, still used by
     *  the single-match flow. */
    public String getMatchIds(String puuid) {
        return get("/lol/match/v5/matches/by-puuid/" + puuid + "/ids?start=0&count=10");
    }

    /** Most recent `count` match ids in one queue. Riot caps `count` at 100. */
    public String getMatchIds(String puuid, int queue, int count) {
        return get("/lol/match/v5/matches/by-puuid/" + puuid
                + "/ids?queue=" + queue + "&start=0&count=" + Math.min(count, 100));
    }

    /** ~78 KB. Carries champion, K/D/A, win and team — everything but positions. */
    public String getMatchDetails(String matchId) {
        return get("/lol/match/v5/matches/" + matchId);
    }

    /** ~775 KB. The expensive one, and the only source of death coordinates. */
    public String getTimeline(String matchId) {
        return get("/lol/match/v5/matches/" + matchId + "/timeline");
    }
}
