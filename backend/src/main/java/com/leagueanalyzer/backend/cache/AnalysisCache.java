package com.leagueanalyzer.backend.cache;

import com.leagueanalyzer.backend.model.GameSummary;
import org.springframework.stereotype.Component;

import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * A bounded cache of analyzed games, keyed by match and player.
 *
 * Two decisions worth keeping:
 *
 * 1. It caches the *derived* GameSummary, not the JSON it came from. A timeline
 *    is ~775 KB, which is ~1.5 MB once it is a Java String and far more as a
 *    parsed tree; twenty of those would fill the heap with data we had already
 *    finished reading. A GameSummary is a few KB, and it is the expensive half
 *    anyway — a network round trip plus a parse. Cache the small expensive
 *    thing, not the big cheap one.
 *
 * 2. It never needs invalidating. A finished match is immutable: Riot will not
 *    change it, so a hit can never be stale. Entries are evicted for space, not
 *    for correctness — which is why the whole class is this short.
 *
 * The 20-per-second and 100-per-two-minute limits on a personal key make this
 * load-bearing rather than an optimisation: one cold twenty-game overview costs
 * forty calls, so without a cache the app supports two of them per two minutes
 * across all users.
 */
@Component
public class AnalysisCache {

    /** ~500 games at a few KB each — single-digit megabytes, well inside a
     *  512 MB instance, and 25 full overviews' worth of history. */
    private static final int MAX_ENTRIES = 500;

    // accessOrder=true makes this an LRU, but it also mutates on get(), so
    // reads need the same synchronisation as writes.
    private final Map<String, GameSummary> entries = Collections.synchronizedMap(
        new LinkedHashMap<>(64, 0.75f, true) {
            @Override
            protected boolean removeEldestEntry(Map.Entry<String, GameSummary> eldest) {
                return size() > MAX_ENTRIES;
            }
        });

    private static String key(String matchId, String puuid) {
        return matchId + ":" + puuid;
    }

    public GameSummary get(String matchId, String puuid) {
        return entries.get(key(matchId, puuid));
    }

    /** Only successful analyses are stored. A fetch that failed on a timeout
     *  should be retried on the next load, not remembered as the answer. */
    public void put(String matchId, String puuid, GameSummary summary) {
        if (summary != null && GameSummary.OK.equals(summary.status())) {
            entries.put(key(matchId, puuid), summary);
        }
    }

    public int size() {
        return entries.size();
    }
}
