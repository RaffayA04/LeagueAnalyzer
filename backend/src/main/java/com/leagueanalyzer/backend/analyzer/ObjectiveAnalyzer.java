package com.leagueanalyzer.backend.analyzer;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.ArrayList;
import java.util.List;

public class ObjectiveAnalyzer {
    private final List<Long> baronKillTimes = new ArrayList<>();
    private final List<Long> dragonKillTimes = new ArrayList<>();

    public ObjectiveAnalyzer(String timelineJson) throws Exception {
        JsonNode timeline = new ObjectMapper().readTree(timelineJson);

        for (JsonNode frame : timeline.get("info").get("frames")) {
            //splits timeline into frames
            for(JsonNode event : timeline.get("info").get("events")) {
                //each frame has list of events
                if (!event.get("type").asText().equals("ELITE_MONSTER_KILL")) continue;
                String monster = event.get("monsterType").asText();
                long time = event.get("timestamp").asLong();
                if(monster.equals("BARON_NASHOR")) { baronKillTimes.add(time);}
                if(monster.equals("DRAGON")) { dragonKillTimes.add(time);}
            }
        }
    }

    public boolean wasBaronAlive(long deathTime) {
        long baronSpawn = 25 * 60 * 1000;

        for (long kill : baronKillTimes) {
            if (deathTime >= baronSpawn && deathTime < kill) return true;
            baronSpawn = kill + 6 * 60 * 1000;
        }
        return deathTime >= baronSpawn;
    }

    public boolean wasDragonAlive(long deathTime) {
        long dragonSpawn = 5 * 60 * 1000;

        for (long kill : dragonKillTimes) {
            if (deathTime >= dragonSpawn && deathTime < kill) return true;
            dragonSpawn = kill + 5 * 60 * 1000;
        }
        return deathTime >= dragonSpawn;
    }

    //lets think what i need to actually make an 'objective analyzer'

    //first i need to parse when baron was killed and when the dragons were killed and then add it to the list.

    //

}
