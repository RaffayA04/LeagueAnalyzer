package com.leagueanalyzer.backend.analyzer;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.ArrayList;
import java.util.List;

public class ObjectiveAnalyzer {
    private record ObjectiveKill(long timestamp, int teamId) {}
    private final List<ObjectiveKill> baronKills = new ArrayList<>();
    private final List<ObjectiveKill> dragonKills = new ArrayList<>();
    private final int playerTeamId;

    public ObjectiveAnalyzer(String timelineJson, int playerTeamId) throws Exception {
        JsonNode timeline = new ObjectMapper().readTree(timelineJson);
        this.playerTeamId = playerTeamId;


        for (JsonNode frame : timeline.get("info").get("frames")) {
            //splits timeline into frames
            JsonNode events = frame.get("events");
            if (events == null) continue;
            for(JsonNode event : events) { //each frame has list of events
                if (!event.get("type").asText().equals("ELITE_MONSTER_KILL")) continue;
                String monster = event.get("monsterType").asText();
                String subtype = event.path("monsterSubType").asText();
                int teamId = event.get("killerTeamId").asInt();
                long time = event.get("timestamp").asLong();
                if(monster.equals("BARON_NASHOR")) { baronKills.add(new ObjectiveKill(time, teamId));}
                if(monster.equals("DRAGON") && (!subtype.equals("ELDER_DRAGON"))) { dragonKills.add(new ObjectiveKill (time, teamId));}
            }
        }
    }

    public boolean wasBaronAlive(long deathTime) {
        long baronSpawn = 25 * 60 * 1000;

        for (ObjectiveKill kill : baronKills) {
            if (deathTime >= baronSpawn && deathTime < kill.timestamp()) return true;
            baronSpawn = kill.timestamp() + 6 * 60 * 1000;
        }
        return deathTime >= baronSpawn;
    }

    public boolean wasDragonAlive(long deathTime) {
        long dragonSpawn = 5 * 60 * 1000;

        for (ObjectiveKill kill : dragonKills) {
            if (deathTime >= dragonSpawn && deathTime < kill.timestamp()) return true;
            dragonSpawn = kill.timestamp() + 5 * 60 * 1000;
        }
        return deathTime >= dragonSpawn;
    }

    // Team that took the most recent dragon at or before deathTime, or null if none had been taken yet.
    public Integer lastDragonTakenBy(long deathTime) {
        return lastTakenBy(dragonKills, deathTime);
    }

    // Team that took the most recent baron at or before deathTime, or null if none had been taken yet.
    public Integer lastBaronTakenBy(long deathTime) {
        return lastTakenBy(baronKills, deathTime);
    }

    public boolean myTeamTookLastDragon(long deathTime) {
        Integer team = lastDragonTakenBy(deathTime);
        return team != null && team == playerTeamId;
    }

    public boolean myTeamTookLastBaron(long deathTime) {
        Integer team = lastBaronTakenBy(deathTime);
        return team != null && team == playerTeamId;
    }

    // Kills are in ascending time order, so the last one we walk past is the most recent.
    private Integer lastTakenBy(List<ObjectiveKill> kills, long deathTime) {
        Integer team = null;
        for (ObjectiveKill kill : kills) {
            if (kill.timestamp() > deathTime) break;
            team = kill.teamId();
        }
        return team;
    }

    //lets think what i need to actually make an 'objective analyzer'
    // dragon and baron kills saved to a data structure, arraylist
    // time when objectives spawn and retrieve when they were killed to figure out next spawn
    //

}
