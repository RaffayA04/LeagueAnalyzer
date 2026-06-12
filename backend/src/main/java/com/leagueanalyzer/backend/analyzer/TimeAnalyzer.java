package com.leagueanalyzer.backend.analyzer;
import com.leagueanalyzer.backend.analyzer.MapCoordinateConverter;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.leagueanalyzer.backend.model.DeathEvent;
import java.util.*;
import org.springframework.stereotype.Component;

@Component
public class TimeAnalyzer {
    private final ObjectMapper objectMapper = new ObjectMapper();
    private final MapCoordinateConverter mapCoordinateConverter;
    private final ZoneClassifier zoneClassifier;

    public TimeAnalyzer(MapCoordinateConverter mapCoordinateConverter, ZoneClassifier zoneClassifier) {
        this.mapCoordinateConverter = mapCoordinateConverter;
        this.zoneClassifier = zoneClassifier;
    }

    public List<DeathEvent> findDeaths(String timelineJson, String matchJson, int participantId) {
        try {
            JsonNode timelineRoot = objectMapper.readTree(timelineJson);
            JsonNode matchRoot = objectMapper.readTree(matchJson);

            JsonNode frames = timelineRoot.get("info").get("frames");
            JsonNode participants = matchRoot.get("info").get("participants");

            HashMap<Integer, String> championMap = new HashMap<>();
            for(JsonNode participant : participants) {
                int id = participant.get("participantId").asInt();
                String championName = participant.get("championName").asText();
                championMap.put(id, championName);
            }

            List<DeathEvent> deaths = new ArrayList<>();
    
            for (JsonNode frame : frames) {
                JsonNode events = frame.get("events");

                for (JsonNode event : events) {
                    String type = event.get("type").asText();

                    if (type.equals("CHAMPION_KILL")) {
                        int victimId = event.get("victimId").asInt();

                        if (victimId == participantId) {
                            long timestamp = event.get("timestamp").asLong();
                            int killerId = event.get("killerId").asInt();
                            JsonNode assists = event.get("assistingParticipantIds");
                            String killerChampion = championMap.getOrDefault(killerId, "Unknown");
                            String assistChampions = formatAssists(assists, championMap);

                            int x = event.get("position").get("x").asInt();
                            int y = event.get("position").get("y").asInt();

                            int[] pixels = mapCoordinateConverter.convertToPixel(x, y);
                            String zone = zoneClassifier.getZone(x,y);

                            deaths.add(new DeathEvent (
                                formatTimestamp(timestamp),
                                killerChampion,
                                assistChampions,
                                x,
                                y,
                                pixels[0],
                                pixels[1],
                                zone
                            ));
                        }
                    }
                }
            }

            return deaths;

        } catch (Exception e) {
            return Collections.emptyList();
        }
    }

    private String formatTimestamp(long timestampMs) {
        long totalSeconds = timestampMs / 1000;
        long minutes = totalSeconds / 60;
        long seconds = totalSeconds % 60;
        return String.format("%02d:%02d", minutes, seconds);
    }

    private String formatAssists(JsonNode assists, Map<Integer, String> championMap) {
        if (assists == null || !assists.isArray() || assists.size() == 0) {
            return "none";
        }
        
        StringBuilder result = new StringBuilder();
        for (int i = 0; i< assists.size(); i++) {
            int assistId = assists.get(i).asInt();
            result.append(championMap.getOrDefault(assistId, "Unknown"));

            if ( i < assists.size() - 1 ) {
                result.append(", ");
            }
        }

        return result.toString();
    }
}
