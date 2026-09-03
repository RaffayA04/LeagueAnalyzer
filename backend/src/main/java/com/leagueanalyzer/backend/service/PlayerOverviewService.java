package com.leagueanalyzer.backend.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.leagueanalyzer.backend.cache.AnalysisCache;
import com.leagueanalyzer.backend.client.RiotApiClient;
import com.leagueanalyzer.backend.model.GameSummary;
import com.leagueanalyzer.backend.model.MatchAnalysis;
import com.leagueanalyzer.backend.model.PlayerOverview;
import jakarta.annotation.PreDestroy;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.ThreadFactory;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * Builds the twenty-game overview: the orchestration layer for everything the
 * aggregate screen shows.
 *
 * Measured against a real account, a timeline is ~775 KB and a match detail
 * ~78 KB, and a single Riot call round-trips in ~0.35s. Twenty games is forty
 * calls, so the whole job is bound by how many can be in flight at once.
 */
@Service
public class PlayerOverviewService {

    /**
     * Six workers, and the number is set by Riot's rate limit rather than by
     * the machine. A personal key allows 20 requests/second (and 100 per two
     * minutes); at ~0.35s per call, six in flight peaks near 17/s, which stays
     * under the ceiling. Eight would touch it.
     *
     * The pool size is also the memory ceiling: at most six timelines are held
     * at once, so peak heap is a constant rather than something that grows with
     * the number of games requested. That is the reason not to simply hand
     * twenty futures to the common pool.
     */
    private static final int WORKERS = 6;

    private static final int MAX_GAMES = 20;

    private static final Logger log = LoggerFactory.getLogger(PlayerOverviewService.class);

    private final RiotApiClient riotApiClient;
    private final MatchAnalysisService matchAnalysisService;
    private final AnalysisCache cache;
    private final ObjectMapper objectMapper = new ObjectMapper();
    private final ExecutorService pool;

    public PlayerOverviewService(RiotApiClient riotApiClient,
                                 MatchAnalysisService matchAnalysisService,
                                 AnalysisCache cache) {
        this.riotApiClient = riotApiClient;
        this.matchAnalysisService = matchAnalysisService;
        this.cache = cache;

        AtomicInteger n = new AtomicInteger();
        ThreadFactory factory = r -> {
            Thread t = new Thread(r, "overview-" + n.incrementAndGet());
            t.setDaemon(true);
            return t;
        };
        this.pool = Executors.newFixedThreadPool(WORKERS, factory);
    }

    @PreDestroy
    void shutdown() {
        pool.shutdownNow();
    }

    public PlayerOverview overview(String puuid, int count) {
        int wanted = Math.max(1, Math.min(count, MAX_GAMES));
        List<String> matchIds = rankedSoloMatchIds(puuid, wanted);

        List<CompletableFuture<GameSummary>> futures = new ArrayList<>();
        for (String matchId : matchIds) {
            futures.add(CompletableFuture.supplyAsync(() -> summarize(matchId, puuid), pool));
        }

        List<GameSummary> games = new ArrayList<>();
        int analyzed = 0;
        for (CompletableFuture<GameSummary> future : futures) {
            GameSummary game = future.join();
            games.add(game);
            if (GameSummary.OK.equals(game.status())) analyzed++;
        }

        return new PlayerOverview(puuid, matchIds.size(), analyzed, games);
    }

    /**
     * Ranked Solo/Duo only. Riot filters server-side, so this returns twenty
     * Summoner's Rift games rather than twenty games of any mode that then have
     * to be sieved — and a player with only twelve ranked games gets twelve,
     * which the response reports rather than padding from another queue.
     */
    private List<String> rankedSoloMatchIds(String puuid, int count) {
        List<String> ids = new ArrayList<>();
        try {
            JsonNode root = objectMapper.readTree(
                riotApiClient.getMatchIds(puuid, RiotApiClient.RANKED_SOLO, count));
            for (JsonNode node : root) ids.add(node.asText());
        } catch (Exception e) {
            return List.of();
        }
        return ids;
    }

    /**
     * One game, cache-first. Runs on a pool thread, so it must never throw:
     * a failure becomes a status on the returned summary, and the game still
     * appears in the list. A game that vanished silently would leave the
     * heatmap claiming a sample size it is not plotting.
     */
    private GameSummary summarize(String matchId, String puuid) {
        GameSummary cached = cache.get(matchId, puuid);
        if (cached != null) return cached;

        String matchJson;
        String timelineJson;
        try {
            matchJson = withRetry(matchId, () -> riotApiClient.getMatchDetails(matchId));
            timelineJson = withRetry(matchId, () -> riotApiClient.getTimeline(matchId));
        } catch (HttpClientErrorException.TooManyRequests e) {
            log.warn("Rate limited on {} after retries", matchId);
            return GameSummary.failed(matchId, GameSummary.RATE_LIMITED);
        } catch (Exception e) {
            log.warn("Fetch failed for {}: {}", matchId, e.toString());
            return GameSummary.failed(matchId, GameSummary.FETCH_FAILED);
        }

        try {
            JsonNode info = objectMapper.readTree(matchJson).get("info");
            JsonNode me = findParticipant(info, puuid);
            if (me == null) return GameSummary.failed(matchId, GameSummary.NOT_IN_MATCH);

            int participantId = me.get("participantId").asInt();
            int teamId = me.get("teamId").asInt();

            MatchAnalysis analysis =
                matchAnalysisService.analyze(timelineJson, matchJson, participantId, teamId);

            GameSummary summary = new GameSummary(
                matchId,
                GameSummary.OK,
                me.get("championName").asText(),
                me.get("win").asBoolean(),
                teamId,
                me.get("kills").asInt(),
                me.get("deaths").asInt(),
                me.get("assists").asInt(),
                durationMs(info),
                info.path("gameEndTimestamp").asLong(0L),
                info.path("queueId").asInt(0),
                analysis.deaths(),
                analysis.objectives()
            );

            cache.put(matchId, puuid, summary);
            return summary;
        } catch (Exception e) {
            log.warn("Analysis failed for {}: {}", matchId, e.toString());
            return GameSummary.failed(matchId, GameSummary.FETCH_FAILED);
        }
    }

    /**
     * Riot answers a burst over the limit with 429 and a Retry-After in whole
     * seconds. Twenty games is forty calls against a 100-per-two-minutes budget,
     * so a second viewer arriving mid-load will collide; waiting out the window
     * is the difference between a slightly slower screen and a broken one.
     *
     * Bounded at two attempts. Beyond that the budget is genuinely spent, and
     * blocking a worker longer only spreads the stall to the other games.
     */
    private String withRetry(String matchId, java.util.function.Supplier<String> call) {
        try {
            return call.get();
        } catch (HttpClientErrorException.TooManyRequests e) {
            long waitMs = retryAfterMs(e);
            log.info("429 on {}, waiting {}ms", matchId, waitMs);
            try {
                Thread.sleep(waitMs);
            } catch (InterruptedException ie) {
                Thread.currentThread().interrupt();
                throw e;
            }
            return call.get();
        }
    }

    private long retryAfterMs(HttpClientErrorException.TooManyRequests e) {
        String header = e.getResponseHeaders() == null
            ? null : e.getResponseHeaders().getFirst("Retry-After");
        try {
            // Cap it: a long Retry-After should fail the game, not hang the request.
            return Math.min(Long.parseLong(header) * 1000L, 5_000L);
        } catch (Exception ignored) {
            return 1_000L;
        }
    }

    /**
     * The overview is keyed by puuid, so the participant number — which is what
     * the analysis endpoints take — is resolved here rather than in the browser.
     * Doing it client-side cost a separate match-detail fetch per game.
     */
    private JsonNode findParticipant(JsonNode info, String puuid) {
        for (JsonNode participant : info.get("participants")) {
            if (puuid.equals(participant.path("puuid").asText())) return participant;
        }
        return null;
    }

    /**
     * `gameDuration` changed units partway through Match-V5's life. Matches that
     * carry a `gameEndTimestamp` report it in seconds; older ones report
     * milliseconds. Reading it blind makes old games look 1000x longer.
     */
    private long durationMs(JsonNode info) {
        long duration = info.path("gameDuration").asLong(0L);
        return info.has("gameEndTimestamp") ? duration * 1000L : duration;
    }
}
