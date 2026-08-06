package com.leagueanalyzer.backend.analyzer;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

public class ObjectiveAnalyzer {
    private static final int DRAGONS_FOR_SOUL = 4;

    private record ObjectiveKill(long timestamp, int teamId) {}

    /**
     * One objective changing hands. Unlike the aliveness queries, which only look
     * backwards from a death, this is the whole game's ledger — which is what makes
     * "Baron was up when you died" mean anything.
     */
    public record ObjectiveTaken(String monster, String subType, long timestampMs, int teamId) {}

    private final List<ObjectiveKill> baronKills = new ArrayList<>();
    private final List<ObjectiveKill> dragonKills = new ArrayList<>();
    private final List<ObjectiveTaken> objectivesTaken = new ArrayList<>();
    private final Map<Integer, Integer> dragonsByTeam = new HashMap<>();
    private final int playerTeamId;

    // When a team takes its 4th dragon it earns soul, and elemental drakes stop
    // spawning for the rest of the game. Null if no team got there.
    private Long soulTime = null;

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
                if(monster.equals("DRAGON") && (!subtype.equals("ELDER_DRAGON"))) {
                    dragonKills.add(new ObjectiveKill (time, teamId));

                    int taken = dragonsByTeam.getOrDefault(teamId, 0) + 1;
                    dragonsByTeam.put(teamId, taken);
                    if (taken == DRAGONS_FOR_SOUL && soulTime == null) { soulTime = time; }
                }

                // Elder is excluded from the drake respawn maths above, but it still
                // belongs in the ledger — losing one matters as much as any Baron.
                if (monster.equals("BARON_NASHOR") || monster.equals("DRAGON")) {
                    objectivesTaken.add(new ObjectiveTaken(monster, subtype.isEmpty() ? null : subtype, time, teamId));
                }
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

    // True if an elemental drake was up. Elder is a separate objective on its own
    // timer and is deliberately not covered here.
    public boolean wasDragonAlive(long deathTime) {
        // Once a team has soul, elemental drakes stop spawning for the rest of the game.
        if (soulTime != null && deathTime >= soulTime) return false;

        long dragonSpawn = 5 * 60 * 1000;

        for (ObjectiveKill kill : dragonKills) {
            if (deathTime >= dragonSpawn && deathTime < kill.timestamp()) return true;
            dragonSpawn = kill.timestamp() + 5 * 60 * 1000;
        }
        return deathTime >= dragonSpawn;
    }

    /** Every Baron and Dragon taken this game, in the order they fell. */
    public List<ObjectiveTaken> objectivesTaken() {
        return List.copyOf(objectivesTaken);
    }

    public int playerTeamId() {
        return playerTeamId;
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
